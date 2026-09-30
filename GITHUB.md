# GitHub 发布清单（组织：akari-projectX）

> 组织创建只能在网页完成；本清单按本地已配好的远程
> （`git@github.com:akari-projectX/<repo>.git`，SSH）编写。

## 可见性规划（版权要求）

| 仓库 | 可见性 | 许可证 |
|---|---|---|
| `akari-panel` | **Private** | 专有（LICENSE: All Rights Reserved） |
| `akari-client` | **Private** | 专有（同上；内嵌 mihomo MIT 需保留声明） |
| `akari-agent` | **Public** | MIT（含 THIRD-PARTY-NOTICES.md，xray-core 为 MPL-2.0） |

注意：agent 仓公开后，`proto/agent.proto`（vendor 副本）即公开——控制协议本身不依赖保密
（安全锚是 mTLS 证书与随机前缀），这是预期行为。

## 步骤

1. **建组织**：github.com/orgs/new → Free plan → 名称 `akari-projectX` → 邀请成员
   （Settings → Members；建议建 `maintainers`（write）与 `contributors`（read）两个 team）。
2. **认证**（二选一）：
   - `gh` CLI：`sudo pacman -S github-cli && gh auth login`（推荐，后续建库/保护分支可命令行）；
   - 或本机已有 SSH key：`ssh-keygen` 后把公钥加到 GitHub → Settings → SSH keys。
3. **建仓并推送**（三仓本地均已 commit，remote 已指向 `git@github.com:akari-projectX/…`）：
   ```bash
   for r in akari-panel akari-agent akari-client; do
     git -C $r push -u origin main
   done
   ```
   （若用 gh：可先 `gh repo create akari-projectX/$r --private/--public` 再推；akari-panel/client
   选 Private，akari-agent 选 Public。）
4. **分支保护**：每仓 Settings → Branches → `main`：
   - akari-agent（公开仓）：require PR + require status check（ci）
   - 私有仓：至少禁止 force push
5. **组织设置建议**：Settings → 2FA enforcement 开启；Default repository permission = Read。
6. **验证**：clone 到新目录，按各仓 README 构建（panel 需兄弟检出 onyx→akari 约定：
   `../akari-agent`）。

## 已知遗留（接手第一件事）

- ~~改名后 `make smoke` 未跑绿~~ ✅ 2026-09-30 已修（agent `pb/` 残留 onyx 绑定，Makefile 改为 `buf generate proto`），smoke 全绿。
- akari-panel / akari-agent 本地 `.git` 曾丢失，已重新 `git init -b main`：**需首次提交并重新 `git remote add origin git@github.com:akari-projectX/<repo>.git`** 后才能执行上面的推送步骤。
