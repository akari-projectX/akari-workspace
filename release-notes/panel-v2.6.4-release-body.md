> **可以从 v2.6.x 原地升级**（`akari-ctl upgrade`，无需重装），升级前安装器会先备份。本版只改用户门户的界面，没有数据库迁移。
>
> **节点：不需要升级 agent。** 协议号仍为 8，v0.6.x 的 agent 照常工作；建议节点用 agent v0.6.3。

## 安装

```
curl -fsSL https://github.com/akari-projectX/akari-panel/releases/download/v2.6.4/install.sh | sh
```

支持 Debian 12/13、Ubuntu 22.04/24.04；Docker 部署见 `docs/DEPLOY.md`，镜像（`deploy/.env` 的 `AKARI_IMAGE`）：

```
ghcr.io/akari-projectx/akari-panel:2.6.4@sha256:REPLACE-WITH-THE-RELEASE-DIGEST
```

使用前请按 `docs/DEPLOY.md`「Verify a release」校验签名。

---

本版是门户的几处小修。

- **iPhone 顶部不再发黑**：iOS 26 的 Safari 按页面顶栏的颜色给状态栏和地址栏上色；顶栏原来是半透明的，Safari 取不到颜色，浅色页面顶部会变成黑色。顶栏改成不透明的页面底色。
- **下拉菜单不再伸出屏幕**：手机上「接入配置 › 导入到客户端 › 更多」等小菜单靠近屏幕边缘时会自动挪回来。
- **图标去掉方框和底色**：仪表盘「教程」大行的平台图标不再套方框（悬停时标题变蓝）；顶栏「更多」菜单里的图标不再有灰色底块。
