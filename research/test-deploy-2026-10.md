# 测试环境部署与升级测试（2026-10-06，进行中：在第 0 步受阻）

状态：**未完成**。服务器已清理，发版候选（rc）尚未打出，面板/节点尚未安装。

## 已完成

| 项 | 结果 | 证据 |
|---|---|---|
| 面板主机 89.106.76.46 卸载旧面板 v0.3.2（`akari-ctl uninstall --yes --purge --confirm purge`） | 通过 | /etc/akari、/var/lib/akari、/opt/akari-valkey、akari 二进制与 akari-ctl 均已删除；PG 中无 akari 库；80/443/8443 未监听。postgresql-18 与 caddy 包按设计保留 |
| node1 95.40.55.149 卸载旧 agent（`akari-agent-uninstall`） | 通过 | 二进制、units、/etc/akari-agent、state、updater 记录、nft 规则、进程均无残留；`find / -iname '*akari*'` 为空 |
| node2 18.162.147.173 | 干净 | 无 akari 文件/服务 |
| 面板 main CI（db41630） | 通过（第 3 次尝试） | run 37484921822：第 1 次 rust 与 coverage 均因下述不稳定测试失败；16:00 UTC 后重跑通过 |

## 受阻（需要 lead 处理）

1. **面板打 tag 需要提交**：release.yml `verify-tag` 要求 tag 版本 = Cargo.toml `version`（当前 `0.3.2`）。要发 `v0.4.0-rc.1` 必须先在 main 上把 Cargo.toml（及 Cargo.lock）改为 `0.4.0-rc.1`。worker 无权自行向 main 提交（权限分类器拒绝"未请求的提交"）。
2. **agent main CI 为红**：定时运行 37451991241 的 `check-units` 失败——面板 Q1（79d88a1）把 `deploy/systemd/akari-agent.service` 第 26 行注释改成 `akari server enroll-token`，agent 正本仍为 `akari node enroll-token`。release.yml 会调用完整 CI，故 agent 发版必失败。修复（仅注释）已开 PR：akari-projectX/akari-agent#33（CI 全绿，未合并，待 lead 决定合并或关闭）。

## 发现的问题

| 严重度 | 问题 | 建议 |
|---|---|---|
| 中（CI 稳定性） | `traffic::db_tests::history_split_multiplier_site_day_boundary_replay_departed`（src/traffic.rs 约 2008 行）在每天 15:00–15:59 UTC 必失败：选择时区的条件是 `(10..15).contains(&hour)`，但注释与推导要求 UTC+14 覆盖 10:00–16:00，应为 `10..16`；15 点落到 Etc/GMT+12，与上海同一天，`assert_ne!` 失败 | 改为 `10..16` |
| 低（CI 稳定性） | 定时 CI 37448615239 中 `nodestat::tests::history_unknown_values`（src/nodestat/tests.rs:259）失败一次，疑似同类时间相关问题 | 排查 |
| 中（流程） | agent `check-units` 只在 agent CI 里检查，面板改 unit 副本不会让面板 CI 变红，导致 agent main 静默变红 | 面板 CI 加同样的对比，或规定 unit 只在 agent 侧改 |
| 低（UX） | `akari-agent-uninstall --help` 不显示帮助而是直接执行卸载（未知参数被忽略、无确认） | 未知参数报错退出；`--help` 显示用法 |
| 信息 | agent 仓库 Dependabot：GHSA-5wf9-h793-w73c（xray-core，high，pinnedPeerCertSha256 MITM），govulncheck 当前未判为可达 | 评估升级 xray-core |

## 凭据
尚未生成任何新凭据（~/secrets/akari-test-* 未创建）。
