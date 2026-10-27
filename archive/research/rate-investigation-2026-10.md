# 中转入口倍率"未生效"调查（next-02，2026-10-09）

> 只读调查：未改任何仓库、未连任何服务器。代码基线 = akari-panel `28a9539`（release: v0.4.0，与测试面板版本一致）、akari-agent `f670028`。复现用本地临时 PostgreSQL 18 + Valkey 容器与真实结算代码（`FLUSH_SQL` / `compact_pass` / 后台 HTTP 路由），测试代码只在临时 worktree 中，已删除。

## 1. 结论

> **更新（2026-10-09，用户补充）**：倍率是当天流量之后改成 10 倍的；但用户实测**改为 10 倍后经该入口下载 1.2 GB，只扣了很少流量**——与本报告"立即生效"的结论矛盾，**定案撤回**，改由 next04 用真实面板 + agent + 客户端在本地端到端复现（见 §8）。**next04 结论**：面板结算与扣量正确；找到两个机制：R1 改倍率会改订阅节点名，客户端刷新订阅后选择回落到直连，按 1x 扣费；R2 Vision splice 连接上的字节在 xray 重建或 agent 重启时整段丢失。详见 §8.1。

**判定：其他——既不是"延迟生效"，也不是"没有生效"。**

- 倍率在**下一次结算**（≤5 s 一次）就生效，代码里没有任何缓存、快照或延迟同步的倍率副本。中转流量每一批都按中转入口自己的倍率计费，不会落到落地节点的直连入口（1x）上。
- 同一个入口、同一天出现 3.815 这样的分数比例，只有两种可能：
  - (a) 当天这个入口的倍率**被改过**（最可能：先按 1x 跑了约 68.7% 的字节，之后才是 10x）；
  - (b) 看到的数字是**多个入口/多个时刻加在一起**的（显示口径问题，见 §4）。
- 用户给出的精确数字满足不了"只有 1x 和 10x"：(billed − raw) mod 9 = 2，而纯 1x/10x 组合必须为 0（§3）。所以当天至少还有极少量字节（最少 1–14 字节即可）按第三种倍率结算，或者两个数字不是同一次读取得到的。
- 两种情况都要用测试面板上的审计日志来定案（§6 的 SQL，由用户自己运行）。

**置信度**："代码会立即按新倍率结算、中转不会被记成 1x"——高（代码路径 + 6 个真库测试）。"测试面板上是当天改过倍率"——中，待 §6 的 Q2/Q3 确认。

## 2. 倍率的完整路径（问题 1）

| 环节 | 位置 | 说明 |
|---|---|---|
| 后台创建中转 | `admin/src/console/pages/entrance-drawer.tsx:451-473`（`RelayDialog`，默认 `rate: "1"`，提交 `Number(f.rate)`） | 倍率随 `POST /nodes/{id}/entrances` 一起发送 |
| 后台编辑入口 | `entrance-drawer.tsx:64`（表单初值 `String(e.rate)`）、`:107-134`（保存时**整张表单**一起 PATCH，`rate` 每次都发） | `PATCH /entrances/{id}` |
| 新建节点的直连 | `admin/src/console/pages/node-dialogs.tsx:315-321`（`rate !== 1` 才发送） | — |
| API → 千分比 | `src/entrances.rs:419-435` `rate_permille`：`x*1000` 取整，超过 3 位小数直接拒绝（400 `entrance.rate_invalid`），不会悄悄四舍五入 | — |
| 写库 | 创建 `src/entrances.rs:685`（不传时默认 1000）、`:731-741`；编辑 `:562-563`；审计 `entrance.create` / `entrance.update`，前后快照都含 `rate_permille`（`src/audit.rs:205-215`） | 改倍率**不** bump agent，也不需要：agent 完全不知道倍率 |
| 时段规则 | `src/rates.rs`；SQL 函数 `akari_entrance_rate`（`migrations/1038_entrance_rate_rules.sql:48-68`，每次调用都实时读 `entrances` 与 `entrance_rate_rules`） | 审计 `entrance.rate_rules.set` |
| 结算 | `src/traffic.rs:753-766`：`ef` CTE 在**每次 flush 的 SQL 语句里**读倍率。无规则：直接取 `e.rate_permille`（#92 快速路径）；有规则：`LEAST(akari_entrance_rate(now), akari_entrance_rate(now-30s))`。`:909-912`：`charge = floor(billed × mult / 1000)` | flush 每 5 s 一次（`traffic.rs:1690-1692`） |
| 历史 | 同一条语句写 `traffic_daily_pending`（`traffic.rs:921-927`，raw = 接受的字节，billed = charge）→ `compact_pass` 每 30 s 折叠进 `traffic_daily` 与 `traffic_entrance_daily`（`traffic.rs:1475-1527`，纯加法，raw 与 billed 来自同一行） | — |
| 显示 | 后台节点视图 `rate`/`rate_now`（`entrances.rs:168-175`）、门户 `/me/nodes`（`nodestat.rs:1231`）、订阅节点名 "… 10.0x"（`sub/mod.rs:325`、`sub/proxy.rs:190-192`）都用 `akari_entrance_rate(now)` 实时计算 | 订阅名是**客户端**里的副本，客户端刷新订阅后才变（只影响显示） |

**没有任何懒刷新的倍率副本**：没有 Valkey 缓存，desired snapshot 和 agent 配置里也没有倍率，派生入站不带倍率。结算按"入口 id → 当前倍率"在 SQL 里实时取。

**生效延迟上界**：

- 改完提交后，**下一次 flush** 就用新倍率，约 0–5 s。从流量发生算起：agent 每 10 s 上报一次（`akari-agent/agent.go:175`）+ flush 周期 5 s，所以改动之后产生的流量最多在 ~15 s 后按新倍率结算。
- 规则不会让基础倍率延迟：`LEAST(now, now-30s)` 两个时刻用的都是**当前**的表内容，没有历史版本。规则窗口的边界本来就会晚 30 s，但那是 D9 的设计（只少计）。
- 反方向需要注意（不是本问题的原因）：倍率是"**结算时**"生效，不是"**流量发生时**"。以下情况里，改动前跑出的字节如果改动后才结算，会按新倍率计：
  - agent 断线后补发的最终计数（最长到断线租约 24 h、重连额度窗口）；
  - flush 失败后重试的行。

  测试 B3 证实了这一点。

## 3. 中转专项与数字分析（问题 2）

**中转流量的归属**：

- 面板下发：中转入口 = 落地节点上 tag 为 `e<wire_no>` 的派生入站（`src/entrances.rs:75-93`），每个用户有**独立凭据**，xray email = `<用户UUID>#<wire_no>`（`src/grpc.rs:2173-2186`，快照 `:2332`）。
- agent 统计：每个 email 一组计数器（`akari-agent/core.go:760-773`），上报时原样带 email（`core.go:864-877`）。只有限速/在线数才按 `#` 前的账号合并（`gate.go:37-45`），流量不合并。
- 面板映射：`refresh_members` 把 `<uuid>#<wire>` 映射回 (中转入口, 用户)（`src/traffic.rs:1263-1287`）。未知 key 一律丢弃，**不会**降级成直连 key。
- 由于凭据独立，中转的凭据在直连入站上根本无法认证，所以中转流量不可能按直连 1x 计费。
- R43 计数键 `(server, entrance, user, session)`，每行都按本行入口的倍率结算。#92 快速路径与 D9 路径的结果相同（测试 D）。

**3.815 的算术**：

- 用户数字：raw = 544,892,830，billed = 2,078,538,885，比例 3.81458。
- 若只有 1x 和 10x：10x 部分 = (B−R)/9 = 170,405,117.22 —— **不是整数**。
- 倍率为整数时，`floor(billed × mult / 1000)` 每行都是精确的整数倍（`traffic.rs:910`），上/下行拆分加起来也恰好等于 billed（`:911`、`:924-926`），所以纯 1x/10x 必须满足 (B−R) ≡ 0 (mod 9)。实际 ≡ 2。
- 单一倍率也对不上：3.814x → 2,078,221,253；3.815x → 2,078,766,146。

**能凑出精确数字的组合**（第三种倍率 k，"最少有多少字节按 k 结算"）：

| 组合 | 最少的 k 倍字节 | 10x 字节 | 1x 字节 |
|---|---|---|---|
| 1x + 10x + 0x | 7 | 170,405,118 | 374,487,705 |
| 1x + 10x + 0.5x | 14 | 170,405,118 | 374,487,698 |
| 1x + 10x + 2x | 2 | 170,405,117 | 374,487,711 |
| 1x + 10x + 3x | 1 | 170,405,117 | 374,487,712 |
| 1x + 10x + 10.5x | 4 | 170,405,113 | 374,487,713 |
| 1x + 10x + 100x | 无解 | — | — |

只用两个整数倍率也能凑出（例如 1x+6x、2x+7x、3x+4x、0x+5x），但都与"创建为 1x、设为 10x"的叙述不符。

**结论**：

- 当天约 **68.7% 的字节按 1x、31.3% 按 10x**。外加从个位数到任意多的字节按第三种倍率结算，或者 2 字节的差异来自读数本身（两次查询之间有新结算被折叠，或抄写误差）。
- 能产生第三种倍率的代码路径只有"管理员设置的值"：基础倍率任意 3 位小数，或时段规则。没有任何自动产生的中间值。
- 有一个后台表单陷阱会产生 0x：`Number("") === 0`。倍率框留空保存会通过前端校验（`entrance-drawer.tsx:107-108`、`:457-460`），API 收到 `rate: 0`，入口就变成免费（测试 F）。
- **逐项排除**：
  - 每行取整：整数倍率不取整，非整数倍率每行每次最多少 1 字节；
  - 压缩/月汇总：纯加法；
  - 部分 flush 重试：幂等，按重试时的倍率；
  - departed / GCRA 截断：只缩小接受的 raw，倍率照常乘；
  - 用户级与入口级：`traffic_entrance_daily` 按 (入口, 日) 唯一。

  这些都不会产生第三种比例。

## 4. raw / billed 的写入与各处显示（问题 3、问题 2 扩展）

- 写入：`traffic_entrance_daily.up/down` = 本批**接受**的字节（截断后），`billed_bytes` = 同一行的 charge，在同一条语句里写 pending，再由同一次压缩折叠（`traffic.rs:921-927`、`:1507-1524`）。raw 列不会包含 billed 没算的字节，反之亦然。测试 A 末尾的 `assert_history` 断言 Σ 历史 = 结算。
- **会显示混合比例的地方**（都是"多入口相加"，不是倍率错误）：
  - **门户 → 流量 → "有效倍率"列**：`spa/src/lib/traffic.ts:32` 用 `billed / raw` 现算，按**节点名**汇总，范围默认本月（`spa/src/pages/dash/traffic.tsx:49`、`:225-234`），数据来自 `trafficlog::my_nodes`（`src/trafficlog.rs:435-458`）。同一节点的直连（1x）与中转（10x）被加在一起，比例落在 1–10 之间，例如 "×3.81"。接口其实返回了实时倍率数组 `rates`，但前端没用。
  - **后台节点抽屉 → 节点流量**：`node_days`（`src/trafficlog.rs:350-364`）按节点汇总所有入口（`admin/src/console/pages/node-dialogs.tsx:1070-1110`）。
  - **后台服务器抽屉 "节点流量（原始 / 计费）"**：`nodes.traffic_raw_bytes / traffic_billed_bytes`，全部入口、全部历史（`server-drawer.tsx:109-110`）。
  - 后台用户抽屉按节点汇总（`user-drawer.tsx:1137`）。
  - 测试 A：中转 10x、直连 1x 同时有流量时，节点汇总比例 = **7.9231**，而单看中转入口 = 10.0000。
- 后台与门户里**没有**任何地方按入口显示每日 raw/billed。要看单个入口只能直接查 `traffic_entrance_daily`。
- **倍率显示与结算口径一致**：都是 `entrances.rate_permille` / `akari_entrance_rate`。门户的"有效倍率"列是唯一用别的东西（历史 billed/raw）冒充倍率的显示。

## 5. 本地复现（问题 4）与后台流程（扩展问题 3）

环境：本地 docker `postgres:18-alpine` + `valkey:9-alpine`。每个测试使用一个独立 schema 并跑完全部迁移。走真实的 `apply_create_relay` / `apply_update` / HTTP 路由 / `TrafficBuffer` / `FLUSH_SQL` / `compact_pass`。上报 key 与 agent 一致（`<uuid>#1`）。所有测试通过。摘录如下：

```
A 中转创建即 10x（无规则快速路径），同时有直连 1x 流量
A batch 1  中转 raw=100000007 billed=1000000070 eff=10.0000 | 直连 raw=30000001 billed=30000001 eff=1.0000
…（5 批全部 10.0000 / 1.0000）
A traffic_entrance_daily 中转 raw=500000105 billed=5000001050 ratio=10.0000
A traffic_entrance_daily 直连 raw=150000015 billed=150000015  ratio=1.0000
A node_days（后台节点流量） raw=650000120 billed=5150001065 ratio=7.9231

B 中途改倍率
B1 10x                         raw=1000000 billed=10000000 eff=10
-- PATCH 10 -> 2 提交
B2 改后第一次 flush            raw=1000000 billed=2000000  eff=2      ← 立即生效
-- 已上报（2x 期间）但未结算，此时 PATCH 2 -> 10
B3 改前上报、改后结算          raw=1000000 billed=10000000 eff=10     ← 按结算时倍率
审计：entrance.create →10000；entrance.update 10000→2000；2000→10000

C 创建时用默认 1x，跑了流量后才设为 10x（字节数按报告比例）
4 批 1x 共 374,487,713；PATCH 1→10；3 批 10x 共 170,405,117
C traffic_entrance_daily raw=544892830 billed=2078538883 ratio=3.8146 (billed-raw) mod 9 = 0
  （与用户的 2,078,538,885 只差 2 字节，见 §3）

D 时段规则路径：刚建的全周 10x 规则 → 第一次 flush 就是 10x；规则改 3x → 下一次 flush 就是 3x（无 30 s 滞后）

F 后台真实请求体经 HTTP 路由
POST（RelayDialog，rate:10）           → 201，rate_permille=10000
PATCH 抽屉整表单 rate 10 / 10.5        → 10000 / 10500
PATCH 抽屉倍率框留空（Number("")=0）   → 200，rate_permille=0   ← 免费入口，无任何提示
PATCH rate 10.0001                     → 400 entrance.rate_invalid（不改库）
陈旧抽屉：打开时倍率 1，另一处改成 10，陈旧抽屉只改名保存 → rate_permille=1000（被改回）
```

后台端到端结论：

- 输入单位是"倍"（0–100，3 位小数），API 转千分比，没有单位错位。
- 创建时倍率字段**会**被保存，不存在"创建时被忽略、先存默认 1000"的路径。
- 两个真实风险：
  - **倍率框留空 = 0x**；
  - 编辑抽屉每次保存都会发送整张表单（包括倍率）。如果表单是打开时的旧值（另一个标签页或另一个管理员在此期间改过倍率），改名、改分组等任何保存都会把倍率**静默改回旧值**。

  这两种情况都会在审计里留下 `entrance.update` 行，§6 的 Q2 能看到。

## 6. 在测试面板上确认（用户自己运行，只读）

用 psql 连测试面板数据库（只读），先设置变量：

```
\set entrance_name '台湾'
\set day '2026-10-xx'          -- 报告的那一天（站点时区）
-- 运行 Q0，拿到中转入口的 id，再：
\set eid '<Q0 返回的 id>'
```

判读方法：

- **Q2** 能看到创建时的 `rate_after` 以及之后每一次改动的时刻（站点时区）。若创建时是 1000，或当天有 `1000→10000`（或经过 0、2 等中间值），即为情形 (a)。
- **Q3** 的 `mod9` 不为 0，说明除 1x/10x 外还有第三种倍率；`share_at_10x` 应约等于改为 10x 之后的字节占比。
- **Q6/Q7** 用会话起始时间与网卡每小时字节，对照 Q2 的改动时刻，估算改动前后的流量比例，应接近 68.7% / 31.3%。
- 若 Q2 只有一条 `entrance.create`（`rate_after = 10000`）、Q3 中转入口一行的比例却不是 10，则与代码和全部测试矛盾，需要再查（届时请保留数据库快照）。
- 若 Q3 中转入口一行就是 10.0000，说明 3.815 来自汇总显示（情形 b，例如门户"有效倍率"列或节点流量）。

```sql
-- Q0 find the entrance id (names are unique per node only)
SELECT e.id::text, e.name, n.name AS node, s.name AS server FROM entrances e JOIN nodes n ON n.id = e.node_id JOIN servers s ON s.id = e.server_id WHERE e.name LIKE '%' || :'entrance_name' || '%';
-- Q1 the entrance and its node's entrances (rates now, rules, created/updated)
SELECT e.id::text, e.kind, e.name, e.wire_no::text, e.rate_permille::text,
       akari_entrance_rate(e.id, statement_timestamp())::text AS rate_now,
       (SELECT count(*) FROM entrance_rate_rules r WHERE r.entrance_id = e.id)::text AS rules,
       to_char(e.created_at AT TIME ZONE akari_site_tz(), 'YYYY-MM-DD HH24:MI:SS') AS created_local,
       to_char(e.updated_at AT TIME ZONE akari_site_tz(), 'YYYY-MM-DD HH24:MI:SS') AS updated_local
FROM entrances e
WHERE e.node_id = (SELECT node_id FROM entrances WHERE id = :'eid'::uuid)
ORDER BY e.wire_no;
-- Q2 audit trail of the entrance: creation rate, every rate change, rule changes
SELECT to_char(a.at AT TIME ZONE akari_site_tz(), 'YYYY-MM-DD HH24:MI:SS') AS at_local,
       a.actor_label, a.action,
       a.before->>'rate_permille' AS rate_before, a.after->>'rate_permille' AS rate_after,
       CASE WHEN a.action = 'entrance.rate_rules.set' THEN a.after::text END AS rules_after
FROM audit_log a
WHERE a.target_type = 'entrance'
  AND a.target_id = :'eid'
ORDER BY a.id;
-- Q3 the day's rows of every entrance of the node: ratio, implied 10x share, mod-9 test
SELECT e.name, d.day::text, (d.up_bytes + d.down_bytes)::text AS raw, d.billed_bytes::text AS billed,
       round(d.billed_bytes::numeric / NULLIF(d.up_bytes + d.down_bytes, 0), 4)::text AS ratio,
       round((d.billed_bytes - (d.up_bytes + d.down_bytes))::numeric
             / NULLIF(9 * (d.up_bytes + d.down_bytes), 0), 4)::text AS share_at_10x_if_only_1x_10x,
       ((d.billed_bytes - (d.up_bytes + d.down_bytes)) % 9)::text AS mod9_must_be_0_for_pure_1x_10x,
       d.users::text
FROM traffic_entrance_daily d JOIN entrances e ON e.id = d.entrance_id
WHERE d.node_id = (SELECT node_id FROM entrances WHERE id = :'eid'::uuid)
  AND d.day = :'day'::date
ORDER BY e.wire_no;
-- Q4 not yet compacted (staged) rows for the node (normally empty within 30 s)
SELECT e.name, count(*)::text AS rows, sum(p.up_bytes + p.down_bytes)::text AS raw,
       sum(p.billed_bytes)::text AS billed
FROM traffic_daily_pending p JOIN entrances e ON e.id = p.entrance_id
WHERE p.node_id = (SELECT node_id FROM entrances WHERE id = :'eid'::uuid)
GROUP BY e.name;
-- Q5 per user per entrance that day (who carried the bytes, ratio per user)
SELECT d.user_id::text, e.name, (d.up_bytes + d.down_bytes)::text AS raw, d.billed_bytes::text AS billed,
       round(d.billed_bytes::numeric / NULLIF(d.up_bytes + d.down_bytes, 0), 4)::text AS ratio
FROM traffic_daily d JOIN entrances e ON e.id = d.entrance_id
WHERE d.node_id = (SELECT node_id FROM entrances WHERE id = :'eid'::uuid)
  AND d.day = :'day'::date
ORDER BY e.wire_no, d.user_id;
-- Q6 sessions on the relay: when its traffic started (first_seen) vs the audit times of Q2
SELECT c.session_id, c.user_id::text,
       to_char(c.first_seen_at AT TIME ZONE akari_site_tz(), 'YYYY-MM-DD HH24:MI:SS') AS first_seen_local,
       to_char(c.updated_at AT TIME ZONE akari_site_tz(), 'YYYY-MM-DD HH24:MI:SS') AS last_local,
       (c.up_bytes + c.down_bytes)::text AS session_cumulative
FROM traffic_counters c
WHERE c.entrance_id = :'eid'::uuid
ORDER BY c.first_seen_at;
-- Q7 landing server NIC bytes per hour that day (site time zone): the share before/after a rate change
SELECT to_char(date_trunc('hour', m.bucket AT TIME ZONE akari_site_tz()), 'YYYY-MM-DD HH24:00') AS hour_local,
       round(sum((coalesce(m.rx_bps_sum, 0) + coalesce(m.tx_bps_sum, 0)) / m.samples * 60))::int8::text AS nic_bytes_approx
FROM server_metrics_1m m
WHERE m.server_id = (SELECT server_id FROM entrances WHERE id = :'eid'::uuid)
  AND akari_site_day(m.bucket) = :'day'::date
GROUP BY 1 ORDER BY 1;
```

以上 SQL 已在本地真库上逐条执行验证（列名/语法正确）。注意事项：

- 审计默认保留 365 天（`settings.rs:431`），日期不会过期。
- Q7 是网卡总量（中转两条腿与其他流量都在内），只能用来看比例。

## 7. 建议的修复（未实施）

结算本身不用改：倍率即时生效、只按结算时倍率计，与 D9"只少计"的设计一致。建议改的是**输入与显示**：

1. **后台倍率框留空不得变成 0x**：`entrance-drawer.tsx`（编辑 `:107`、新建 `:457`）与 `node-dialogs.tsx:315` 在 `f.rate.trim() === ""` 时报错。确实要设 0x 时需要明确输入 0，并弹二次确认（"免费入口"）。
2. **编辑抽屉只发送改动过的字段**（与初值 diff），或带乐观并发版本（`updated_at` / version，冲突返回 409）。这样就不会用陈旧表单把倍率静默改回去。倍率变化时 toast 显示"旧 → 新，从下一次结算起生效、不追溯"。
3. **门户"有效倍率"列**（`spa/src/lib/traffic.ts:32`）：改为显示接口已经返回的实时倍率 `rates`（多个入口则显示 "1x / 10x"）。如果保留历史比例，应改名为"平均计费比例"并加说明"按入口加权、含倍率变更前的流量"。
4. **后台按入口的每日流量**：节点流量图按入口拆分（`traffic_entrance_daily` 已有数据）。入口抽屉显示倍率变更历史（来自审计 `entrance.update` / `entrance.rate_rules.set`），运营看到混合比例时可以自己对照。
5. 文档（运营手册的倍率一节）写明：倍率从下一次结算（≤5 s）起生效，不追溯；agent 断线补发的流量按补发时的倍率计算。

**测试计划**：

- admin e2e：倍率框留空保存 → 前端报错、不发请求；两个页面同时编辑同一入口 → 后保存者不会覆盖倍率（diff 方案），或返回 409（版本方案）。
- panel 真库测试：PATCH 只带 `name` 时倍率不变（已是现有行为，加断言）；若加版本，测试旧版本返回 409。
- 门户：`trafficByNode` 单元测试——直连 1x 与中转 10x 混合时显示实时倍率而不是 3.81；e2e 快照更新。
- 保留本次的复现思路作为回归测试（traffic 真库测试）："创建即 10x 的中转入口，所有批次 billed = 10 × raw；中途改倍率后，下一次 flush 即为新倍率；改前上报、改后结算的批次按新倍率"。现有的 `multiplier_bills_scaled_never_more` 只覆盖直连，可在 `same_user_on_two_entrances_is_settled_separately` 旁边补一个中转版本。

## 8. 端到端实测（next04）

> 2026-10-09，本机 docker，未连任何服务器。全部数字来自真实面板 + 真实 agent + 真实客户端。证据保存在 `/home/lam/projet/.work/next04/`：`evidence/snaps.jsonl`（60 次采样，每次含 DB 计数器、门户接口、落地网卡字节）、`evidence/actions.log`（每次管理操作与下载的时刻和结果）、`evidence/db-final.txt`（最终的 `traffic_counters` / `traffic_entrance_daily` / 审计）、`logs/`（面板、agent、更新器、客户端日志）。

### 8.1 结论（先说答案）

**面板的计费与扣量没有问题。** 中转 10x 下载 1.2 GB，raw ≈ 1.204 GB、billed ≈ 12.04 GB，用户已用流量同样增加 12.04 GB（S1/S2/S4a）。`/me`、`/me/plan`、`users.traffic_used_bytes` 与 Σ`traffic_entrance_daily.billed_bytes` 逐字节一致。改倍率**不会**下发配置，不重建派生入站，也不重置计数器。

实测找到两个能让"经中转下载 1.2 GB 只扣很少"的机制：

**R1（最可能是用户遇到的情况；面板侧设计缺陷）：改倍率 = 改订阅里的节点名 → 客户端丢失用户的手动选择 → 回落到直连（1x）。**

- 订阅节点名带实时倍率，例如 `landing-node 中转A` → `landing-node 中转A 10.0x`。代码：`src/sub/mod.rs:325` 取 `akari_entrance_rate(now)`，`src/sub/proxy.rs:189-192` 把倍率拼进名字。
- mihomo / Clash Verge 与 sing-box 都按**名字**记住 selector 的选择（mihomo `store-selected` / cache.db；sing-box `cache_file`）。刷新订阅后旧名字不存在，选择回落到 `PROXY` 组的第一个成员。
- 订阅里直连永远排在中转前面（`src/sub/mod.rs:334` `ORDER BY … e.kind <> 'direct'`；Clash 组 `src/sub/clash.rs:120`，sing-box selector `src/sub/singbox.rs:110` 不设 default）。所以第一个成员就是直连。
- 结果：用户以为在用"中转 10x"，实际走直连按 1x 扣费，中转入口上看不到这 1.2 GB。客户端界面上没有任何报错。
- 实测 S6：两个客户端都先手动选中 `landing-node 中转A`，管理员改为 10x，刷新订阅后 `now` 都变成 `landing-node 直连`。随后 1.2 GB 全部记在直连上（各 +1,203,890,7xx B，1x），中转A +0。
- 带**时段倍率规则**的入口，名字会随时段变化，每次刷新订阅都可能把选择打回直连。

**R2（已证实的 agent 缺陷，会真实丢量；用户这次是否命中待查）：XTLS Vision splice 的字节要到连接关闭时才计入；xray 实例在连接存续期间被拆除时，这部分字节整段丢失。**

- 内层是 TLS（HTTPS 下载）时，Vision 会切到内核 splice。xray 只在 `tc.ReadFrom` 返回之后才把整段字节加进用户计数器（`xray-core@v1.260327.0/proxy/proxy.go:752-769`，`statWriter.Counter.Add(w)`）。
- 实测 S2：57 s 的下载过程中，计数器每 10 s 只增长约 350 B（上行），1.2 GB 在连接关闭时一次性出现。
- agent 的 `stopLocked`（`akari-agent/core.go:200-206`）先读最终计数（`:203`），再 `instance.Close()`（`:206`）。Close 打断 splice 之后，xray 才把字节加到旧计数器上，而这个计数器已经不会再被读取，session 也已更换。
- 所有走 `stopLocked` 的路径都会丢：Snapshot/Rebuild（`core.go:239`）、`Teardown`（租约到期、自更新、SIGTERM 优雅停机，`agent.go:346/359/921`）。
- 实测：
  - S5a：config_version bump 打断下载，客户端已收 531,267,584 B，计入 5,365 B；
  - S5c：agent 重启，客户端已收 423,919,616 B，计入 10,073 B。
  - 对照组无丢失：同样被打断的非 splice 情形（S5b 明文 HTTP、SH5 Hysteria 2）计入的字节 ≥ 客户端收到的。
- 附带后果：
  1. splice 连接存续期间面板看不到它的流量，额度用尽也无法在连接中途停用；
  2. 整条连接按**关闭时**的倍率结算。S4b 中 1x→10x 的改动发生在下载中途，改动前约 500 MB 也按 10x 计。这违背 D9"只少计"的原则（反方向 10x→1x 则少计）。

**用户案例的判读**（需用户在测试面板上确认，均为只读）：

- 若 §6 Q3 显示同一节点**直连入口**当天 raw 增加 ≥ 1.2 GB，并且客户端当前选中的是直连，则是 **R1**。
- 若直连也没有这 1.2 GB，并且 node1 的 `journalctl -u akari-agent` 在下载期间有 `state applied … via snapshot` 或 agent 重启记录，下载也曾中断或重试，则是 **R2**。
- 用户描述"下载完成、无报错、扣得很少"，更符合 R1。

**置信度**：
- R1 机制：高（两个真实客户端复现）。
- R2 机制：高（真实 agent 复现 + 代码定位）。
- "用户这次就是 R1"：中（约 70%），待上述两项核对。

### 8.2 实测环境

| 组件 | 版本 / 方式 |
|---|---|
| 面板 | GitHub release `akari-linux-amd64` v0.4.0（`28a95397fa18`，sha256 与 SHA256SUMS 一致），容器 `akari-next04-panel`，PostgreSQL 18.6 + Valkey 9 容器；站点时区 Asia/Shanghai |
| 落地节点 | GitHub release `akari-agent` v0.5.0（`f67002814600`，内嵌 xray 26.3.27），容器 `akari-next04-landing`。agent 以非 root 用户运行，只有 `CAP_NET_BIND_SERVICE`（setpriv，对应 systemd 单元）；用 `akari server add` 的 bootstrap 注册（一次性 token，mTLS） |
| 来源白名单（R44） | **未改动，使用真实路径**：root 循环每秒检查 `update/source-filter-request.json`，有请求就运行**已安装二进制**的 `-init openrc -apply-update <state> -updater-state … -update-target …`（等同 `openrc/akari-agent-update`），由它校验后 `nft -f`。生效的规则：`tcp dport 20443 ct state new ip saddr != @s0_4 drop`（Hysteria 2 中转为 `udp dport 20445 …`）。客户端用中转凭据直连落地 :20443 → 000（被丢弃） |
| 中转机 | 容器 `akari-next04-relay`，nftables DNAT `:30443/30444 → 落地 :20443/:20444`（TCP+UDP）、`:30445/udp → :20445` + masquerade（与测试 node2 的做法相同） |
| 入口 | VLESS REALITY Vision :443（dest = 本地 caddy `dest.test:443`，TLS 1.3 + h2）：直连 1x、中转A（建为 1x，后改 10x）、中转B（建即 10x）；Hysteria 2 :8443（自签证书放在 `/run/credentials/akari-agent.service/`，客户端 `skip-cert-verify` 只是本地测试需要）：直连 1x、中转H 10x |
| 文件服务器 | caddy，仅在 back 网络上（客户端不能直连），`big.bin` = 1,200,000,000 B 随机数据；HTTP（Vision 不 splice）与 HTTPS（Vision splice）两种 |
| 客户端 | mihomo v1.19.32、sing-box 1.14.2，用面板生成的订阅（UA 识别：clash-verge / sing-box）。① 每个代理一个实例（MATCH 到该代理），与 next03 的 `ct.py` 相同；② S6 使用订阅原样的 `PROXY` selector，开启 external-controller / clash_api 与 cache_file，模拟 GUI 客户端 |
| 计划 / 用户 | 套餐「Pro 测试」100 GiB/月，两个组（直连、中转），不限速（**限速用户不 splice**，`ratelimit.go:232`）；用户 alice |
| 改倍率 | 完全按后台抽屉的请求体：`PATCH /entrances/{id}`，整张表单 `{name, rate, enabled, sort, group_ids, connect_host, connect_port, listen_port, source_cidrs}`；新建中转按 `RelayDialog` 的 `POST /nodes/{id}/entrances` |

"agent 上报内容"的观测方式：`traffic_counters` 每行是 agent 上报的会话累计值（`GREATEST` 写入），每 3–15 s 采样一次。采样同时记录落地网卡字节，作为真实传输量的对照。

### 8.3 分场景结果

raw / billed 为该入口在该场景中的增量（字节）；"已用"为 `users.traffic_used_bytes` 的增量，与门户 `/me`、`/me/plan` 一致。

| # | 场景 | 客户端收到 | raw | billed | 已用 | 判定 |
|---|---|---|---|---|---|---|
| 预热 | 4 个代理各 50 MB HTTP + 各 50 MB HTTPS（中转A 1x） | 4×100 MB | 直连/中转A 各 200,334,07x | 1x | 400,668,139 | 正确 |
| S1 | 中转A 1x → 抽屉 PATCH 10x（config_version 3→3，不下发）→ mihomo HTTPS 1.2 GB（1.3 s） | 1,200,000,000 | 1,203,890,701 | 12,038,907,010 | 12,038,907,010 | 正确，10.000x |
| S2 | 中转B 建即 10x，sing-box HTTPS 1.2 GB 限速 20 MB/s（57 s） | 1,200,000,000 | 1,203,888,729 | 12,038,887,290 | 同 billed | 正确；**下载中每 10 s 只多约 350 B，连接关闭时一次计入 1.2 GB** |
| S3 | 直连 1x，mihomo HTTPS 1.2 GB @20 MB/s（对照） | 1,200,000,000 | 1,203,888,706 | 1,203,888,706 | 同 | 正确 |
| S4a | 中转A 10x，24 × 50 MB 短连接 | 1,200,000,000 | 1,204,000,291 | 12,040,002,910 | 同 | 正确 |
| S4b | 中转A 1x 开始下载 1.2 GB @20 MB/s，+25 s 改 10x | 1,200,000,000 | 1,203,882,781 | 12,038,831,310 | 同 | **整条连接按关闭时的 10x 计**（约 500 MB 是在 1x 期间传输的） |
| S4c | 中转B 10x，客户端 15 s 时中止 | 314,769,399 | 341,211,887 | ×10 | 同 | 计入（多出的是服务端已发出、仍在缓冲区中的字节） |
| S5a | 中转B 10x HTTPS（splice），+25 s 管理员改中转A 的 source_cidrs（config_version 4→5，Snapshot 重建） | 531,267,584（连接被断开） | **5,365** | 53,650 | 同 | **丢失约 531 MB raw = 5.3 GB 计费** |
| S5b | 同 S5a，但为 HTTP（无 splice） | 425,746,432 | 425,795,924 | ×10 | 同 | 无丢失 |
| S5c | 中转B 10x HTTPS（splice），+20 s agent 收到 SIGTERM 重启（优雅停机） | 423,919,616 | **10,073** | ×10 | 同 | **丢失** |
| SH | Hysteria 2 中转H 10x，mihomo 1.2 GB @20 MB/s | 1,200,000,000 | 1,203,888,704 | 12,038,887,040 | 同 | 正确；每 10 s 持续计入（QUIC 无 splice） |
| SH5 | Hysteria 2 中转H，+20 s config bump | 422,559,744 | 428,228,472 | ×10 | 同 | 无丢失 |
| S6 | GUI 式客户端：选中「landing-node 中转A」（1x）→ 改 10x → 刷新订阅（mihomo `PUT /configs?force=true`；sing-box 带 cache_file 重启）→ 下载 1.2 GB | 1,200,000,000 ×2 | 中转A **+0**；直连 +1,203,890,700 / +1,203,890,724 | 1x | +1,203,890,700 / +1,203,890,724 | **选择回落到直连，按 1x 计** |

其他确认：
- 每次只改倍率的抽屉保存（含不变的 `source_cidrs`）都没有 bump config_version（审计 `entrance.update` 的前后快照相同，agent 无 `state applied`）。改 `source_cidrs` 才 bump，并整机 Snapshot。
- `traffic_daily_pending` 在约 30 s 内折叠进 `traffic_entrance_daily`，raw/billed 与计数器增量一致。
- 最终 Σ billed（81,460,415,777）= `users.traffic_used_bytes` = `/me.traffic_used_bytes`。

### 8.4 根因定位

**R1（面板，订阅名）**
- `src/sub/proxy.rs:189-192`：名字 = `"{base} {entrance}"`，倍率 ≠ 1 时追加 `rate_label`（"10.0x"）。
- `src/sub/mod.rs:325`：倍率取 `akari_entrance_rate(e.id, now)`，随基础倍率和时段规则变化。
- `src/sub/mod.rs:334`：直连排在中转前；`src/sub/clash.rs:120`、`src/sub/singbox.rs:110`：selector 按这个顺序列出，第一个即回落目标。
- 代码注释说"names stay unique… clients key proxies by name"。这一点没错，但"名字随倍率变"恰好让按名字记忆的选择失效。

**R2（agent，最终计数时机）**
- `akari-agent/core.go:200-206`：`stopLocked` 先 `countersLocked(nil, true)`，后 `m.instance.Close()`，随后换 session。
- xray `proxy/proxy.go:752-769`：splice 期间不计数，`ReadFrom` 返回（包括被 Close 打断）之后才 `statWriter.Counter.Add(w)`。这次加数发生在 final 读取**之后**，加在旧 session 的计数器上，之后再也不会被上报。
- gate 的 `DispatchLink`（`gate.go:319-333`）在内层 `DispatchLink` 返回之后才 `release`，即晚于 `Counter.Add`。因此可以用"等 gate 的活动分发归零"作为"字节已入账"的同步点。

### 8.5 修复建议（未实施）

**R1（面板，建议先做，改动小）**

1. 订阅里的代理名不再包含实时倍率，只用稳定的 `"{base} {entrance}"`。倍率在门户节点列表与入口说明中展示。
2. 如果运营坚持在名字里显示倍率，就做成系统设置开关（默认关），并在后台改倍率或时段规则时提示"会改变订阅节点名，客户端刷新后可能回落到第一个节点"。
3. 时段规则入口绝不把时段倍率写进名字。
4. DEPLOY 倍率一节写明："改入口/节点名称会让客户端的手动选择失效"。

**R2（agent，T1 计费修复）**

1. `stopLocked` 改为：先 `instance.Close()`（或先由 gate 取消全部活动分发），再有界等待 gate 的活动分发数归零（例如 ≤2 s，超时记 WARN 与未归零数），**之后**才 `countersLocked` 生成 final。agent 持有计数器指针（W1），实例关闭后仍可读取。Rebuild、Teardown、gracefulStop、自更新都经过这里，一处修复即可。需要 agent 性能基准（Rebuild 延迟增加 ≤ 等待时间，仅在有活动连接时）。
2. （可选，单独评估）splice 期间的可见性：用 gate 已有的活动连接表，周期性读取 splice 连接客户端 socket 的 `TCP_INFO`（`tcpi_bytes_acked` / `tcpi_bytes_received`），以增量形式上报。这样额度能在连接中途生效，倍率也按传输时段计。
   - 替代方案是对所有受管用户关闭 splice（`CanSpliceCopy = 3`），代价是 CPU，必须按 agent 性能规则先测。
   - 至少要在 DEPLOY 中说明：Vision 连接按关闭时的倍率计费，额度在连接关闭时才会被扣到。

### 8.6 回归测试计划

- **面板（R1）**：订阅黄金测试——同一入口倍率 1000 → 10000（以及加时段规则）后，Clash/sing-box/links 三种格式的代理名逐字节不变；`w30_client_formats.golden` 随之更新。e2e 门户节点列表显示倍率。
- **agent（R2，canary 标签，真实 xray 客户端）**：VLESS REALITY Vision，本地 TLS 服务器提供大文件（内层 TLS 才会 splice），限速客户端下载过程中分别触发：
  1. Rebuild（Snapshot）；
  2. `Teardown`；
  3. `gracefulStop`。
  断言 final 报告里该用户 downlink ≥ 客户端已收字节 − 一个缓冲区（当前实现会得到 ≈0，即失败）。另加单元测试，锁定 `stopLocked` 的顺序（先 Close 并等待 gate 归零，再读计数）。
- **跨仓 smoke（可选）**：在已有的 Vision 段加一次"下载中 bump config"的断言（面板 `traffic_counters` 增量 ≥ 客户端字节的 99%）。
- 本次的本地环境脚本（`api.py`、`snap.py`、`scen.py`、`client/mk.py`、`client/selreset.py`、`landing/start.sh`、`relay/relay.nft`）保留在 `/home/lam/projet/.work/next04/`，可直接用来复验修复。
