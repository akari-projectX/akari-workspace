
稳定性与隐私修复版本。协议号仍为 8，与 v0.6.0 完全互通，面板 v2.0.0 与 v2.1.0 都可使用；可以通过面板「更新」页灰度升级。

## 修复

- **xray 计时器自锁导致连接与资源泄漏**：上游 xray-core 的 `ActivityTimer` 在极少数时序下会自己锁死，被锁住的连接（及其 goroutine、文件描述符、旧内核实例）永远不会释放。在持续高频建连断连的浸泡测试里，大约每小时会泄漏 77 个连接处理器。本版本改用修复了该问题的 xray-core 分支构建（[akari-projectX/xray-core](https://github.com/akari-projectX/xray-core) `akari/v26.10.21`，在 v26.10.21 基础上只改这一处）。上游拒绝了这个修复，所以之后每次升级 xray 都会把补丁带到新版本（步骤见 README「xray-core 分支」）。
- **撤权时直接关闭客户端连接**：撤销或轮换某个用户的凭据时，除了中断该用户正在转发的流量，还会直接关闭客户端的连接（TCP、XHTTP、Hysteria、gRPC 按各自的连接粒度处理），客户端会立刻发现，不必等超时。

## 隐私

- **关闭 xray 访问日志**：之前 xray 会把每个连接的用户、客户端地址和**目标主机**写进节点日志（journal）。现在访问日志完全关闭，只保留错误日志。

## 清理

- 删除只为旧版面板与旧节点保留的兼容代码：
  - v1 引导文件格式（证书与私钥写在配置里）；
  - 面板不支持续期时的退避；
  - 旧自更新启动器的残留清理；
  - 旧更新器单元无法刷新时的降级分支；
  - 「单元已过期」能力标志（`stale-units`）。
- 节点上的 systemd / OpenRC 单元只来自 agent 二进制本身（`-print-unit`），面板不再保存副本。

## 测试

- 新增浸泡测试 `make soak`：真实 agent 对假面板，客户端放在独立进程，持续增删、轮换用户并定期重建内核，检查内存、goroutine 和文件描述符是否回到基线，以及计费字节与客户端实际收发是否吻合。60 分钟实测通过。

## 校验

二进制、自更新清单（manifest）与 `SHA256SUMS` 均已签名；校验方法见面板 `docs/DEPLOY.md`「Verify a release」。许可证明见 `THIRD_PARTY_LICENSES.txt`（`./akari-agent -licenses` 输出同样内容）。

---

## Licensing

akari-agent's own source code is MIT licensed. The release **binaries** statically link
xray-core (MPL-2.0) and other permissively licensed modules; no GPL module is linked
(xray-core no longer depends on `sagernet/sing*`). Corresponding source is this tag
(`make dist` reproduces the binary).
Every linked module and its licence text: `THIRD_PARTY_LICENSES.txt` (also printed by
`akari-agent -licenses`).


## What's Changed
* Agent soak test (make soak) and xray access log off by @mwnydev in https://github.com/akari-projectX/akari-agent/pull/42
* Soak findings: revocation stalls are client-side; xray ActivityTimer self-deadlock leaks handlers by @mwnydev in https://github.com/akari-projectX/akari-agent/pull/43
* Compatibility-code cleanup (agent) by @mwnydev in https://github.com/akari-projectX/akari-agent/pull/45
* Remove the stale-units status flag by @mwnydev in https://github.com/akari-projectX/akari-agent/pull/46


**Full Changelog**: https://github.com/akari-projectX/akari-agent/compare/v0.6.0...v0.6.1
