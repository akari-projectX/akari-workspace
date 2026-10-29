# Portal detail polish (approved 2026-10-29)

The user approved every draft in this folder ("都可以，开工"). Scope is **detail polish of the existing portal**: layout, navigation, page structure and copy stay as they are unless an item below says otherwise. The user rejected a full redesign earlier the same day; do not drift into one.

Each `N-*.png` shows the current page (left, real CI screenshot) and the approved draft (right). `source/` holds the drafts' HTML (hand-written mockups: spacing and structure are the spec; glyphs such as the moon icon are placeholders, use the portal's own icons and components). Colours only from `portal/src/styles/tokens.css`, two font weights, zh/en dictionary for every string.

Implementation order (one PR at a time):
1. Dialog first-open delay (bug): preload dialog chunks on idle and on hover/press; dialogs that need data open at once with a loading placeholder.
2. Shared menu and dialog styles (images 7, 8).
3. Page polish (images 1–6).

## Approved items

Dashboard (image 1)
1. Notice bar: no coloured left stripe; one card with a thin border, tag + title + text + "查看详情".
2. Lines stat: "0 / 3 在线" instead of "0 条可用线路" when lines are offline.
3. The four stats share one structure: number, label, a 4px track (flow used, online share as segments, days left; balance: empty slot), note.
4. Chart header: title + summary (with 计费) left; legend and unit on the same row, right.
5. Access config: client links become small outline buttons on one row with "更多"; QR code closer to the content; full-width divider; "重置订阅" moves to the bottom row, muted grey.
6. Pinned announcements: a pin icon instead of the outlined "置顶" pill.
7. Docs "其他分类": two-column compact list rows with ›, no big centred icon grid.
8. Lines summary: drop the grey placeholder bars and "平均延迟 —"; one summary line; legend with a "?" tooltip for the long explanation.
9. Section links ("全部公告", "全部线路", "全部文档") align with the content's right edge.
10. Even vertical rhythm between sections.

Shop (image 2)
11. Plan cards share the full row width equally.
12. Cards align: spec row and feature list on every card (features generated from plan data), buttons on one baseline.
13. "推荐" tag in brand blue.
14. "用余额抵扣" moves to the right of the "选择套餐" header.
15. Reset pack becomes a compact card (title, note, price, button together).

Lines page (image 3)
16. Fourth stat "延迟测速 300 分钟一次" → coverage (regions).
17. Refresh button vertically centred with the title block.
18. Column order/widths: 线路, 状态, 延迟, 标签, 倍率; legend next to the search box.

Settings (image 4) — restructured, same sections and content
19. Each section (账户, 登录与安全, 订阅链接, 偏好) is a card; every row = name + current state + one-line description on the left, action on the right (no middle value column).
20. "重置链接" muted grey, not orange.
21. "添加通行密钥" an ordinary button; "只用通行密钥登录" dimmed while unavailable; language and theme as text segmented controls; deletion as a final red-bordered card; side nav marks 注销账户 red.

Menus (images 5, 7)
- Every dropdown (tutorial by platform, client "更多", account menu, header "更多", sort menus): macOS-style menu — translucent blurred surface, hairline border, soft shadow, radius 10px, 26px rows, name left and grey detail right, whole row clickable (no per-row "看教程"), highlighted row = brand blue with white text, hairline separators, small grey group headers, ✓ for checked items; dark variant. Current device first in the tutorial menu.

Dialogs (image 8)
- No leading icon in any dialog; title and description left-aligned; buttons bottom-right (secondary, then primary).

Traffic detail (image 6)
- Consecutive zero-traffic days collapse into one expandable row ("10-01 – 10-27 共 27 天没有流量"); a "显示无流量的日子" switch; share column = bar + right-aligned number (no pills); numbers right-aligned with tabular figures; total row; weekday and "今天" on dates.

Not approved / not in scope: moving "线路" into the top navigation (item 22, undecided).
