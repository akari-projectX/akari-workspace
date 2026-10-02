# sing-box 作为第二内核：技术验证结论（2026-10-02）

**状态：用户决定暂不做（2026-10-02）。** 裁决见 `SPRINT.md` R29、R28。重启前先读本文。

本目录：
- `akari-singbox.patch`（422 行）、`akari-singquic.patch`（141 行）：最小的下标安全补丁原型（基于 sing-box v1.14.2 / sing-quic v0.6.0，覆盖 VLESS、Hysteria2、TUIC）。上游是 GPL-3.0-or-later，补丁同样受 GPL 约束。
- `prototype-src.tgz`：验证代码（不打补丁的 gate/tracker 原型、真实客户端测试、竞争测试、资源测量脚本）。

## 结论

有条件可行（M8），**不维护长期通用 fork**，只在上游版本上维护小补丁集。重启前须满足以下条件：
1. 有 xray 无法满足的产品需求（TUIC / AnyTLS 等）；
2. 命名合规：sing-box LICENSE 附加条款规定衍生作品不得使用其名称，二进制不能叫 `*-singbox`；
3. 先尝试把 sing-quic 的小修复提给上游。

估计 22–26 人日，之后每月 1–2 天变基。

## 事实（验证代码实测）

**不 fork，只用上游 v1.14.2 的公开 API**（`box.New`、`Router().AppendTracker`、`InboundManager.Create`、自定义 outbound `akari-gate`）。用真实 sing-box 客户端测了 6 种协议：VLESS-REALITY-Vision、VLESS+smux、Hysteria2、TUIC、AnyTLS、SS2022。

- **撤权**：
  - 现有流（包括 mux 子流、QUIC 流）全部被切断，新的 TCP/UDP 被拒绝，出站拨号次数为 0，其他用户不受影响。
  - 外层 mux 连接和 QUIC 会话本身仍保持打开，但其上新开的流都被拒绝。
  - 不 fork 的话，无法在仍打开的会话上区分轮换后的新凭据和旧凭据。
- **计费**：TCP 和 UDP 都精确（xudp、QUIC datagram、UoT、SS UDP）。
- **限速**：1 MiB/s 的限制实测 0.96–1.02 MiB/s。
- **新增用户**：用 `InboundManager.Create` 替换同名入站，耗时约 11ms。
  - TCP 系协议不影响其他用户。
  - **Hysteria2/TUIC 的现有会话全部断流约 30s**（等客户端空闲超时）→ QUIC 必须打补丁。
- **上游自带的 SSM `UpdateUsers` 不安全**：并发握手时 0.16s 内就 `index out of range` panic，`-race` 报 9 处竞争。与 cedar fork、xray SS2022 属同一类下标竞争问题。

**补丁设计**：
- 用户身份用指针（`adapter.ManagedUser`）放在 auth context 里；(名字, 凭据) 不变时复用同一个指针。
- 用户表不可变，整表通过 `atomic.Pointer` 发布。
- gate 只放行 `allowed[key] == ctx 指针` 的连接。

补丁实测：
- 新增用户耗时 168–260µs，其他用户无影响；删除用户即断开；轮换凭据后旧会话被拒。
- `-race` 下 30s 内换表 17,706 次，期间路由 62,617 条连接：**0 串号、0 身份违规、0 竞争报告**。
- 1 万用户时换表耗时 37–59ms。

**维护成本**：
- 发版节奏：一年 41 个稳定 tag；每 6 个月一个 minor 版本，且每次都有破坏性的 adapter 改动。
- 我们碰到的接口一年内 5 次破坏性变更（`SetTracker` 改为 `AppendTracker`、box.Context 新增注册表、`RoutedFlow`、`onClose` 形式的 handler）。
- 补丁在相隔 41 个提交的两个 tag 之间就已经无法直接应用。
- 上游维护者明确拒绝这类钩子：#2621、#852、#3022 被拒；#4085、#4274、#4275 未合并就关闭；#4512 无回应。
- cedar2025 的 fork 从未变基，落后约 22 个稳定版本。

**资源**（剥离符号后）：

| 构建 | 二进制大小 | 空闲（100 用户 × 3 入站） | 100 个活跃连接 |
|---|---|---|---|
| xray agent | 33.0MB | 36MB | 54MB |
| sing-box 精简版 | 22.2MB | 23MB | 44MB |

**许可证**：链接的 58 个模块里，GPL-3.0+ 的有 sing、sing-box、sing-mux、sing-quic、sing-shadowsocks(2)、sing-shadowtls、sing-snell、sing-tun、sing-vmess、fswatch、sing-anytls，其余都与 GPLv3 兼容。agent 的二进制本来就是 GPL 组合作品（R19），引入 sing-box 不改变这一点。

## 集成要点（重启时用）

**agent 侧**
- 把 agent 用到的 12 个 `CoreManager` 方法抽成 `Kernel` 接口（Rebuild、Teardown、ApplyUserOps、WouldDropCredential、WouldShrinkUnsafe、StateHash、TrafficSnapshot、SessionID、UserCount、Connections、Running、Version）。
- **每个内核一个独立的 Go module**：xray v26.3.27 依赖 sing v0.5.1，和 sing-box 的版本冲突，放在同一个 module 会改变 xray 构建的依赖图。
- 自更新 manifest 按内核分开。

**面板侧**
- 在 AgentInfo 中加上内核类型。
- `nodetpl.rs` 增加 sing-box 渲染器；state hash v2 不需要改。
- 模板差异：sing-box 没有 xhttp；需要新增 TUIC、AnyTLS（`protocols.rs`、`sub.rs`）。

**测试**：`rt_matrix_test.go` 的场景表可以直接复用，换成 sing-box 客户端即可。

## 工作量（估计）

| 工作项 | 人日 |
|---|---|
| Kernel 接口 + 构建/发布拆分 | 3 |
| sing-box CoreManager + gate | 6 |
| 其余 4 种协议的补丁 + fork 的 CI/变基工具 | 5 |
| 面板渲染/校验/订阅/UI | 6 |
| 金丝雀测试、smoke、hk-1 压测 | 4 |
| 许可证与文档 | 1 |

## 尚未验证

- 能否通过公开的 `InboundRegistry` 注入我们自己的入站类型，从而不用 fork sing-box。
- 第三方 QUIC 客户端的恢复时间。
- 在真实网络、真实 REALITY 目标站下的表现。
