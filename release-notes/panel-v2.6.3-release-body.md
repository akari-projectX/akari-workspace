> **可以从 v2.6.x 原地升级**（`akari-ctl upgrade`，无需重装），升级前安装器会先备份。本版只更新依赖，没有数据库迁移，也没有功能变化。
>
> **节点：不需要升级 agent。** 协议号仍为 8，v0.6.x 的 agent 照常工作；建议节点用 agent v0.6.3。

## 安装

```
curl -fsSL https://github.com/akari-projectX/akari-panel/releases/download/v2.6.3/install.sh | sh
```

支持 Debian 12/13、Ubuntu 22.04/24.04；Docker 部署见 `docs/DEPLOY.md`，镜像（`deploy/.env` 的 `AKARI_IMAGE`）：

```
ghcr.io/akari-projectx/akari-panel:2.6.3@sha256:REPLACE-WITH-THE-RELEASE-DIGEST
```

使用前请按 `docs/DEPLOY.md`「Verify a release」校验签名。

---

本版是例行的依赖更新。

## 依赖更新
- 运行镜像的底座 `distroless/static-debian13` 更新到最新的安全补丁版本。
- 构建门户与后台用的 Node 镜像更新到最新补丁版本。
- 门户与后台的 npm 依赖（小版本 / 补丁）更新。
- 安装器测试用的 Debian 13、Ubuntu 24.04 镜像更新（只影响 CI）。
