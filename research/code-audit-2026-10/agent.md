# 代码体检 批次 3：akari-agent（Go，只读审计）

日期 2026-10-26 · 基线 akari-agent main `c227ebd`（xray-core `v1.260327.0`、toolchain go1.27.2）· 对照：PR akari-agent#37（分支 `xray-26.10.21`，xray `v1.260327.1-0.20261021…`、toolchain go1.27.3）。无代码改动；实验只在 scratch 的副本里做。

状态：**全范围已读**，更新器 / 来源白名单 / 会话 / 计数 / 租约 / checkpoint / ACME / 屏蔽规则 / 延迟 / 机器指标 / 协议模块 / release / 单元 / CI 逐行读过；`cmd/thirdparty`、`cmd/akari-sign`、`scripts/{systemd,openrc}-test` 与 fuzz/测试代码只抽查（见「方法说明」）。xray 内部相关的结论都标了适用版本。

## 摘要

| 严重度 | 数量 |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 2 |
| P3 | 19 |

没有发现多记 / 重复计费、撤权绕过、状态哈希与面板定义不一致、租约误处理、会话 goroutine 泄漏或数据竞争：`go test -race ./...` 与 `-tags canary` 全套（含真实 xray 客户端）在 main 上全绿，总语句覆盖率 83.5%。两个 P1 一个是**安全边界**（xray 版本相关，PR#37 已修），一个是**发版门**（CI 红，PR#37 已带修复）。

## P1

### P1-1 代理用户可以经节点访问节点自己的回环 / 内网 / 链路本地地址（xray v26.3.27，main）
- 位置：`core.go:968-970`（`buildConfigFor` 的唯一出站是裸 `{"protocol":"freedom"}`，无 `finalRules`）
- 类别：安全边界 / SSRF（横向移动）
- 适用版本：**main（xray-core v1.260327.0）**。已核对 xray 源码：该版本的 `proxy/freedom` 没有 final rules 概念；`v1.260327.1-0.20261021…`（PR#37）新增 `getDefaultFinalRule`，对入站 `vless / vmess / trojan / hysteria / shadowsocks*` 默认 `defaultBlockPrivateRule`（`freedom.go:160-171`）。
- 推理与证据：任何持有有效套餐的用户（含最低价、甚至体验账号）连上节点后，可以把目的地设成 `127.0.0.1:<端口>`、`169.254.169.254`（云元数据，可能含实例凭据）、`10.0.0.0/8` 等，freedom 直接连出，gate 只管“谁”不管“去哪”。节点上的本地服务（包括 agent 自己的状态目录无关，但 SSH、数据库、面板同机部署时的面板端口、云内网）都暴露给付费用户。现有测试（`rt_*_canary_test.go`、`billing_canary_test.go`）全部靠转发到回环回显服务器通过——也就是测试本身证明了回环可达；PR#37 为此给 `TestMain` 设 `AKARI_ALLOW_PRIVATE_DESTINATIONS=1`。W29 审计规则的自定义 IP 规则不能代替它（见 P3-9：IP 规则只匹配 IP 字面量目的地、默认关）。
- 影响：节点所在网络内的横向访问、元数据凭据窃取、对本机服务的未授权访问。
- 修法：合并 PR#37（升级 xray 即默认修复）；合并前确认 (a) 中转入口的派生入站 / 面板健康检查不依赖 agent 出站到私网地址；(b) 生产不设 `AKARI_ALLOW_PRIVATE_DESTINATIONS`（PR 里是进程环境变量，root 能在 drop-in 里设置，文档不要把它写成功能）；(c) 补一个金丝雀：用户经 vless / ss2022 / hysteria 连 `127.0.0.1` 与 `169.254.169.254` 必须被拒（现在没有任何反向用例）。

### P1-2 发版门与夜间 CI 变红：agent 的 smoke 任务引用了不存在的 `spa/`，govulncheck 命中两个公告
- 位置：`.github/workflows/ci.yml:233`（`cache-dependency-path: akari-panel/spa/package-lock.json`）；`Makefile:119-127`（`vulncheck`）；`.github/workflows/release.yml:28-32,56-58`
- 类别：CI / 发布流水线
- 证据：`gh run`：main 的夜间 `ci`（2026-10-25、10-26）都失败，失败任务为 `smoke (akari-panel main + this agent)` 与 `govulncheck`；smoke 日志 `Some specified paths were not resolved, unable to cache dependencies`——面板 W36 后 `spa/` 已不存在（现为 `portal/`、`admin/` 的 lockfile，面板 CI 已改）。govulncheck 复现（本机）：GO-2026-6809（`crypto/x509@go1.27.2`，fixed go1.27.3，由 `identity.go:257 id.leaf.Verify` 触达）、GO-2026-6651（xray `pinnedPeerCertSha256`，fixed 在 PR#37 的 xray 提交；调用链只是 init / 字符串化，agent 不用该功能，**实际不可利用**）。`VULN_ALLOW` 为空 → `make vulncheck` fail closed。
- 影响：①所有触及 Go 代码的 agent PR（smoke 分组）必红，必需检查名单卡住；②`release.yml` 的 `ci` 预发布门（workflow_call 全套）与 `make vulncheck` 步骤都过不了——**现在无法发 agent 版本**，也就无法把 P1-1 的修复发出去；③夜间红灯会让真正的新红灯被忽略。
- 修法：PR#37 已含 smoke 路径修复（`720e3d7`）和 toolchain go1.27.3 + 新 xray（同时清掉两个公告）——先合它。另：`vulncheck` 用 `govulncheck@latest` 未钉版本（GO-STYLE 要求钉住），建议钉版本并在失败时区分“标准库公告（只需升 toolchain）”与“依赖公告”。

## P2

### P2-1 root 更新器按 agent 写的请求下防火墙规则，可对宿主任意端口（含 SSH）下 drop（R44）
- 位置：`sourcefilter.go:99-126`（`normalizeFilters` 只要求 1–65535）、`sourcefilter.go:142-198`（`nftScript`）、`sourcefilter_root_linux.go:104-146`
- 类别：权限边界 / 可用性
- 推理：R44 把 `nft` 放进 root 更新器，请求文件来自 agent 目录（不可信），更新器重新校验并自己渲染脚本——文件处理、nft 脚本注入面都做得对（O_NOFOLLOW、单链接、属主、先删后读、严格 JSON、模糊测试；脚本只含数字与 `netip` 打印的网段，表名固定）。但**语义校验缺失**：被攻破的 agent（xray 漏洞 → agent 进程）或被攻破的面板，可以写 `port=22, tcp, cidrs=[1.2.3.4/32]`，更新器就会在 `inet akari_sources` 的 input 钩子里对 22 端口的新连接除该网段外全部 drop（`ct state new`，且表在重启前一直在，agent 之后发空请求才删）。把 DynamicUser 级别的进程变成“能让宿主 SSH / 监控端口不可达”的进程，比 R44 之前多出一类能力。仅可用性（只能 drop，不能 accept / redirect / 读包），所以 P2。
- 修法（任选）：更新器只接受“当前 agent 实际监听”的端口（读 `/proc/net/{tcp,tcp6,udp,udp6}` 里属主 uid = agent 的 socket，或 agent 请求里带入站端口并由更新器与 `/proc` 交叉验证）；至少黑名单本机 sshd 监听端口 / 22；表带 `meta skuid` 无意义（入站）所以不能那样限制。补模糊 / 单元测试：port 22 且该端口不属于 agent → 拒绝。

### P2-2 签名的 rollback manifest 无失效期、不绑定“从哪个版本回滚”，可被重放
- 位置：`release/release.go:229-250`（`Policy.Check`）、`updater_linux.go:459-477`（`verify`）
- 类别：更新信任模型
- 推理：降级只由 `m.Rollback` 一个布尔放行：`c < 0 && !m.Rollback → 拒绝`，否则任何低于当前的版本都接受。manifest 没有“仅适用于从 X 回滚”“失效时间”“最低允许版本”字段，`created_at` 只做格式校验不参与策略。一旦发布者为某次事故签过一个 rollback manifest（含 sig），任何能把它递给节点的人（被攻破的面板，或本机 agent 直接写 apply 请求）可以在之后任意时刻把任何升级过的节点降回那个版本——即便那个版本后来被发现有漏洞。非 rollback 的旧 manifest 同理：版本号比当前高就接受，没有“安全下限”概念（节点可被“升级”到一个已知有洞但比当前高的旧签名版本）。信任根在发布私钥，所以不是任意代码执行，但削弱了“面板被攻破最多只能拖延更新”的承诺（CLAUDE.md M6）。
- 修法：manifest schema 2 增加 `rollback_from`（仅当 running == 该值才接受）与 `expires`（或 `not_after`）；再加全局 `min_version`（编进二进制或写在已验签的最新 manifest 里，更新器持久化，单调上升）。同步面板 `updates.rs`、`proto/update_vector.json` 与 fuzz。

## P3

1. **P3-1 计数窗口检查（已量化，非缺陷）**：`stopLocked` 先读计数器再 `Close()`，理论上有“读到关闭”之间的尾部丢失。实验（scratch，Vision 回环全速 ~600 MB/s，Rebuild 中途）：`Rebuild` 耗时 0.9–1.5 ms，读之后到关闭之间多出 0–64 KiB（≤0.01%），只会少计。无需处理；`billing_canary_test.go` 的断言 `billed >= received` 因计数先于客户端读到会被在途缓冲（≤8 MiB）掩盖，抓不到这个尾部，若要守住可改成测“关闭后计数器值 − final”。
2. **P3-2 checkpoint 每秒全量重算**：`agent.go checkpointLocked` 每次 `TrafficSnapshot()` 构造全部 `UserTraffic` + proto.Marshal + 整体字节比较。基准（scratch，`BenchmarkCheckpoint`）：1k 行 0.57 ms / 288 KB；2 万行 13.5 ms / 5.8 MB、2.6 万次分配；8 万行（2 万用户 × 4 入口）46 ms / 23.8 MB、10.4 万次分配 —— 每秒 ~5% 单核 + 24 MB 垃圾，且这 46 ms 持有 `applyMu`（TryLock，不阻塞 handleDown 以外的东西，但会让 handleDown 排队）；活跃流量时每秒写 ~4.8 MB 页缓存。大节点上建议只序列化“自上次 checkpoint 起变化的行”做增量槽，或把间隔随行数自适应（8 万行时 3–5 s）。
3. **P3-3 `maxFinals=64` 丢最旧**：`agent.go:1076-1089` 丢弃时不区分“已发未确认”。面板侧 `MAX_DIRTY_SESSIONS_PER_SERVER=16`（`akari-panel/src/traffic.rs:59,334`）：一次性重放超过 16 个未落盘会话，多出的被面板丢弃，而 agent 在流稳定 60 s 后就当作已送达删除（面板只记 warn）。只会在面板反复闪断且每次都 Snapshot 的病态下出现（只少计）；建议 agent 一次最多重放 8 个会话、其余等下一轮 `confirm` 之后，或面板对被丢弃的会话回 Ack。
4. **P3-4 `issued` / `counted` 随用户 churn 在单个实例生命周期内只增不减**：`core.go addUserLocked` / `registerCountersLocked`。REMOVE 后 `issued[tag][uid]`（保留给 Hysteria / mux 复活）和 `m.counted[uid]`（保留尾部计费）要到下一次 Rebuild 才清。长期不 Snapshot 的节点（高 churn）线性增长，每个 (用户, 入口) 约 1–2 KB。建议：REMOVE 且最终计数已确认后（`finals.confirm` 过 60 s）清理 `counted`，`issued` 加上限 / TTL。
5. **P3-5 `CoreManager` 非 test 路径的死代码**：`deadcode`（linux/amd64）：`CoreManager.Connections`、`CoreManager.Tombstones`、`newInstance`、`buildConfig`、`newInstanceWith`（只剩测试 / bench 使用）、`protocolManifest.kernelVersion`、`initSys.embeddedUnits`。staticcheck 只有测试里 3 条：`testutil_test.go:133 selfSigned` 未使用（U1000）、`enroll_test.go:276` 与 `stall_test.go:64` 的废弃 API（SA1019）。
6. **P3-6 `LoadConfig` 默认 `ServerName = PanelAddr` 带端口**：`config.go:54-56`；`panel_addr` 形如 `host:443` 时 TLS ServerName 不合法。面板生成的 bootstrap 一定带 `server_name`，所以只影响手写配置；改成 `net.SplitHostPort`。
7. **P3-7 vless 账号用宽松 `json.Unmarshal` 进 proto 结构体**：`proto_vless.go:36-43`。其他模块都用 `decodeStrict` + 白名单字段；vless 会接受 `reverse`、`encryption`、`xorMode` 等（CLAUDE.md 已承认 reverse 绕过 dispatcher）。面板可信，但应与其他模块一致：本地 struct `{id, flow}` + `DisallowUnknownFields`，再构造 `vless.Account`。
8. **P3-8 `refusedCert` 靠字符串匹配 TLS 告警**：`enroll.go:271` `strings.Contains(err.Error(), "remote error: tls:")`（GO-STYLE：禁止字符串匹配；改 `errors.As` 到 `*tls.AlertError` / `tls.RecordHeaderError` 或 `net.OpError`）。
9. **P3-9 W29 的 IP 规则对域名目的地不生效（已文档化）**：`blockrules.go:295` `DomainStrategy: AsIs`；DEPLOY §3h 已写“IP 规则只匹配以 IP 形式请求的目标”。结果是自定义 IP 黑名单可被“域名解析到该 IP”绕过。接受的话请在后台规则表单旁加一行提示；若要真正拦，需要 `IPIfNonMatch` 并承担 DNS 解析成本（或依赖 P1-1 的 freedom finalRules 拦私网）。
10. **P3-10 来源白名单窗口**：派生入站在 Snapshot 的 Rebuild 里立即开始接受连接，`Apply` 只是把请求文件写出（更新器 ≈1 s 内应用，自更新监看期间由 watch 循环处理）；这 ~1 s（以及更新器缺失 / 无 nft 时的全部时间）只靠每入口独立凭据隔离——文档已写。可选：先等结果（有上限 2 s）再 Rebuild，或让 Rebuild 先不启动 relay 入站。
11. **P3-11 `ci-changes.sh` 分组遗漏**：`sourcefilter*.go`、`updater_openrc_linux.go` 不在 `systemd` / `openrc` 分组里（`update*.go` 前缀不匹配）。R44 的更新器 nft 路径由 `make systemd-test` / `openrc-test` 覆盖，只改 `sourcefilter.go` 的 PR 会跳过这两个容器测试。把 `sourcefilter*.go`、`updater*.go` 补进两组。
12. **P3-12 文档不一致**：`update.go:19-31` 目录布局写 `update/finals.json`，实际 `main.go:197` 把 `finalsStore` 放在**状态目录根**（仅无 `finalsStore` 时回退 `upd.dir`）；`finalStore()` 的两个位置并存，旧版本（更新器目录）写的 finals 会被新版本读不到——目前无已发布版本使用 `update/finals.json` 的迹象（A29 起就是状态目录），建议删掉回退并改文档。
13. **P3-13 `writeSecret` 崩溃遗留 `.tmp` 私钥副本**：`identity.go:276` 崩溃在 rename 前会留下 0600 的 `.identity.pem.*.tmp`（含私钥），无清理。`loadIdentities` 启动时清 `.*.tmp`（glob）即可。
14. **P3-14 延迟探测 URL 无目的地限制**：`latency.go:69-75` 只校验 scheme / host；面板 URL 可使节点向内网 / 元数据发 GET（只回延迟，无响应体外传）。面板是可信方，P3；若做 P1-1 的同类防护，可在 `DialContext` 里拒绝私网。
15. **P3-15 GO-STYLE 抽样偏差**：无 `.golangci.yml`，CI 只有 `gofmt` + `go vet`（GO-STYLE「机器检查」未落地）；导出名无文档：`NewAgent`、`LoadConfig`、`IdentityConfig`、`NewCoreManager`；`Agent.procCtx` 把 `context.Context` 存进结构体；库代码里的 `context.Background()`（`core.go` 5 处）；`main` 包无包注释；`vulncheck` 用 `@latest`。核心文件注释质量高，goroutine 都有明确退出（逐个核对过）。
16. **P3-16 测试缺口**（覆盖率 `main.go` 25%、`updater_openrc_linux.go` 58%、`enroll.go` 65%、`updater_linux.go` 74%）：缺口主要在 `enroll.go` 的 `storeError` 分支、`PermissionDenied` 且已有身份分支、`updater_linux.go` 的 `rollback_failed` 路径与 `Units` 中断恢复、OpenRC 看门狗；另外没有“reverse 用例”：私网目的地被拒（P1-1）、nft 端口不属于 agent（P2-1）、`loadLeaf` I/O 错误不覆盖证书（P2-3）、manifest 重放（P2-2）。
17. **P3-17 OpenRC 更新器与 agent 沙箱已知缺口**：`openrc/akari-agent-update` 是普通 root 的 shell 循环，无能力裁剪 / 只读文件系统（脚本头已写明“Not reproduced”）。一条保险：循环里每秒 `[ -e … ] || [ -L … ]` 取决于 agent 目录里的名字存在性，只是触发，不读内容，安全。`start_pre` 以 root 在 agent 属主目录里 `wc -c <agent.log`：agent 把它换成 FIFO 会让启动卡住（只影响自己的重启）；日志文件由 supervise-daemon 在 `setuid` 之后打开（已读 OpenRC 源码 `supervise-daemon.c:473 < 578`），不是 root 追加任意文件的提权。
18. **P3-18 `ensureFiles` 在“读不出来”时用自签占位证书覆盖已有的 CA 证书**（`acme.go:266-281`）：`loadLeaf` 的任何错误（`EMFILE`、`EIO`、PEM 损坏、key / cert 不配对）都走“写占位”。`writePair` 先 rename key 再 rename cert，两次 rename 之间进程被杀（或掉电）会留下“新 key + 旧 cert”的不配对一对，下次启动 `Configure → ensureFiles` 判定无效并写占位——新证书只在内存里、已丢，旧证书也被覆盖，随后重新下单（Let's Encrypt 同域名重复证书限额每周 5 张），期间 TLS 入站服务自签证书；`wasPlaceholder` 还会触发 `onIssued` 重载入站（断连）。同进程内 `Configure` 与 `step` 的写入由 `m.mu` 串行，不会互相踩。概率低、后果大。修法：只在两个文件都不存在（`os.ErrNotExist`）或 PEM 确定无效时写占位；I/O 错误返回错误并保持原文件；`writePair` 写成同目录 `.new` 对再依次 rename，并在启动时修复“key 新 cert 旧”。补测试：`loadLeaf` 注入 `EIO` 不得覆盖。
19. **P3-19 新 xray 让 SS2022 墓碑机制过时，两条路径同时存在（复杂度 / 待确认）**（`core.go:491-559,703-715`、`proto_ss2022.go`；新 xray `proxy/shadowsocks_2022/inbound_multi.go:139-158`）：W9 墓碑存在是因为 v26.3.27 的 `RemoveUser` 做 swap-delete；新版本改成按邮箱和 PSK 哈希的映射，`RemoveUser` 不再交换删除。若在途握手也不再按下标取用户，`shrinkUnsafe` / `WouldShrinkUnsafe` / `maxTombstones` / 协议 5 墓碑语义 / 面板 `SS_TOMBSTONE_PROTOCOL` 都只服务旧内核。待确认：新版连接路径是否仍按下标访问（本次只读了 Add / Remove）。**不要在 PR#37 里改**；合并后另开评估，先对新内核跑 `ss_tombstone_test.go` 的并发版。

## 已核对正确（覆盖范围）

- **会话生命周期（agent.go）**：单写者 + 有界发送（256 队列、`sendStall`=60 s > keepalive 40 s、停机时只再等 `shutdownFlush`）；`session()` 返回前 join 全部子 goroutine（F3，defer 顺序 cancel → `wg.Wait` → `d.close`）；`handleDown` 持 `applyMu`、流已死不 Rebuild / 不动版本（置 dirty）；Delta 的 BASE_MISMATCH / dirty / 幂等重发三分支；Ack 报尝试版本 + 持有版本 + 状态哈希；失败不前移持有版本。Rebuild 与 Hello 之间到达的周期上报：面板只要求 Hello 之后（`grpc.rs:1441`），新会话可直接计费，不丢。
- **优雅停机 / finals / checkpoint**：`gracefulStop` 在存活流上先发最终计数再 `flush`；`stopped()` 把未确认队列落盘后才清 checkpoint；`resumeCheckpoint` 先写 finals.json 再删槽；双槽 + CRC，写入中途被杀只会让较新槽失效、回落到旧槽；重放是按会话累计值，面板幂等（GREATEST），不会多计。
- **core.go**：REPLACE 语义（先在所有入站上撤销再装）；`issued` 同凭据重装复用指针、凭据不同才新指针（Hysteria 修复、轮换后旧会话被拒）；SS2022 永不 `RemoveUser`、墓碑上限与 `BASE_MISMATCH`；计数器在装用户时注册（无首连竞态）；`stopLocked` 每次换新会话 id 并重置 `applied / issued / counted`，`TrafficSnapshot` 在同一把锁下返回 (session, 计数)；状态哈希与 `proto/agent.proto` v2 定义逐字段一致（`statehash.go` 与规范文本对照，排序、u32be 长度前缀、inbounds SHA-256 尾部）。
- **gate.go / ratelimit.go**：准入要求指针相等；`Allow` 替换会杀旧指针的存活连接；`Revoke` 杀掉并 `takeLocked` 清计数；`release` 对已被取走的连接幂等；`cutLink` 在 ctx 结束后双向立即断；`SetLimit` 无→有杀存活连接（未包装 / 可能被 splice）、改值原地生效、按账号共享桶；所有管理用户 `CanSpliceCopy=3`（vision 下行边传边计）；GCRA 预留饱和运算无溢出；测试里 `-race` 并发换指针通过。
- **租约（lease.go）**：CLOCK_BOOTTIME、0→24 h、≥1 h、≤30 d；只在当前流上接受 grant；到期在 `applyMu` 下二次检查后 Teardown、版本归零、有流则立即 Hello (0,0)；旧面板永不武装。
- **身份 / 注册 / 续期（identity.go / enroll.go）**：私钥只在节点生成、全部 0600 原子写（临时文件 + fsync + rename + fsync 目录）；注册先落盘密钥再请求、重试用同一密钥；token 只存 SHA-256 摘要；日志不含私钥或 token；新证书在其流上收到第一条面板消息才提升；被拒则丢弃 + 退避，其余失败交替使用当前证书。
- **更新器（updater_linux.go / update.go）**：逐级 `O_NOFOLLOW` 打开、`Fstat` 要求普通文件、`Nlink==1`、属主 = 状态目录属主、有上限；请求先删后读（path 单元不会循环）；staged 先拷进 root 专属文件（O_EXCL|O_NOFOLLOW，0700）再校验**副本**的大小与 SHA-256，最后才 chmod 0755 并 rename；`-print-units` 在校验过的副本上以空环境、30 s、输出有界运行；单元只替换已存在且在白名单里的三个名字；写入原子、旧单元存 `units.prev/`、EROFS 降级；回滚恢复单元 + `.prev`；结果文件 O_EXCL + `fchown` 到 fd；用自己编进去的公钥与自己的 `rolled_back` 记录重验（agent 的结论无效）。`PanelProtocol` 来自 agent 请求（可被伪造，只影响 `min_panel_protocol` 判定，P3 级，已计入 P2-2 的“旧签名 manifest”论述）。
- **来源白名单（sourcefilter\*）**：请求 / 结果都按不可信文件处理；`nftScript` 全由解析后的数值和 `netip` 规范化网段生成，表名固定，`table … / delete table …` 同事务先建后删，模糊测试保证每行形状固定；`nft` 无 shell、10 s 超时。
- **ACME（acme.go）**：域名白名单兼做路径安全；存储 0600/0700；HTTP-01 / TLS-ALPN-01 选择、退避与限流下限、ARI 退化、续期不重建；挑战监听器随订单关闭；`rewriteCertPaths` 对大小写折叠冲突和大整数无损。
- **屏蔽规则 / 延迟 / 指标 / 协议模块 / release**：策略不可变指针发布、计数器进程级 epoch、坏策略保持旧策略；探测 URL 夹范围与数量、结果夹时间；`/proc` 解析器全是纯函数 + 饱和运算 + 未知 ≠ 0（W23）；协议模块与清单一一对应（`TestModulesMatchManifest`）；semver 与面板一致（含超 uint64 的数字预发布标识）；`Verify` 有域分隔前缀；`ParseManifest` 严格解码。
- **单元与 CI**：systemd 单元 `NoNewPrivs / ProtectSystem=strict / MemoryDenyWriteExecute / SystemCallFilter / 无 ProcSubset=pid`、agent 只有 `CAP_NET_BIND_SERVICE`、更新器 `IPAddressDeny=any` + `AF_UNIX AF_NETLINK`；OpenRC 脚本凭据 0400 / noexec bind mount；全部第三方 action 钉 commit SHA；发布流程 cosign 无密钥签名 + SBOM + 清单复验；`-race` 与 canary 全套通过。

## 方法说明

- 静态阅读 `agent.go`、`core.go`、`gate.go`、`ratelimit.go`、`statehash.go`、`monitor.go`、`lease.go`、`checkpoint.go`、`identity.go`、`enroll.go`、`update*.go`、`updater_*.go`、`sourcefilter*.go`、`acme.go`、`blockrules.go`、`latency.go`、`sysstat.go`、`protocols.go`、`proto_*.go`、`units.go`、`release/release.go`、systemd / OpenRC 单元、`Makefile`、`ci.yml`、`release.yml`、`ci-changes.sh`；面板侧只 grep 了与 agent 交互的部分（流量上报接收、会话上限）。xray 内部结论对照了 `v1.260327.0` 与 `v1.260327.1-0.20261021115930-1b1647cd9ddf` 两份源码（模块缓存）。
- 运行过：`go vet ./...`（无输出）、`staticcheck ./...`、`deadcode`、`govulncheck`（见 P1-2）、`go test -race -count=1 ./...`（全绿）、`go test -tags canary -coverprofile`（全绿，331 s，总覆盖 83.5%）；scratch 里两个实验：Rebuild 尾部丢失（P3-1）、checkpoint 基准（P3-2）。**没有**运行 `make systemd-test` / `make openrc-test`（按要求），没有触碰任何密钥。
- 未逐行读：`cmd/thirdparty`（只看了 Makefile 调用与 CI）、`cmd/akari-sign`（只读了密钥加载 / 签名路径）、`manifest.go` 的 TOML 解析、`scripts/{systemd,openrc}-test`、全部 `*_test.go` 与 fuzz 语料、`pb/` 生成物。
- 待确认项：P3-19（新内核 SS2022 连接路径是否仍按下标访问）。其余结论均有源码行或实验支撑。
