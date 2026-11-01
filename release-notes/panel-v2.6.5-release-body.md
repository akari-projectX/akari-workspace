> **可以从 v2.6.x 原地升级**（`akari-ctl upgrade`，无需重装），升级前安装器会先备份。本版只改用户门户的界面，没有数据库迁移。
>
> **节点：不需要升级 agent。** 协议号仍为 8，v0.6.x 的 agent 照常工作；建议节点用 agent v0.6.3。

## 安装

```
curl -fsSL https://github.com/akari-projectX/akari-panel/releases/download/v2.6.5/install.sh | sh
```

支持 Debian 12/13、Ubuntu 22.04/24.04；Docker 部署见 `docs/DEPLOY.md`，镜像（`deploy/.env` 的 `AKARI_IMAGE`）：

```
ghcr.io/akari-projectx/akari-panel:2.6.5@sha256:REPLACE-WITH-THE-RELEASE-DIGEST
```

使用前请按 `docs/DEPLOY.md`「Verify a release」校验签名。

---

本版改进登录、注册、找回密码页的人机验证（Cloudflare Turnstile，站长在后台为该表单开启时才有）。

- **点了提交才验证**：以前一打开页面就开始验证；现在进页面不验证，点「登录 / 注册 / 发送重置链接」后才开始。
- **按钮显示「正在验证…」**：验证期间按钮上写「正在验证…」，通过后自动继续登录、注册或发送重置链接。
- **出错照旧可重试**：验证出错时仍显示「人机验证加载失败」与「重试」，点「重试」后再提交。

后台登录页的人机验证不变。
