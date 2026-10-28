# Akari agent v0.6.2

配合面板 v2.2.0 的功能版本。协议号仍为 8，与 v0.6.0 / v0.6.1 完全互通，面板 v2.1.0 与 v2.2.0 都可使用；可以通过面板「更新」页灰度升级。

## 新功能

- **按服务器允许用户访问本机内网 / 回环地址**（能力 `private-destinations`）：面板下发的 `ConfigSnapshot.allow_private_destinations` 决定 xray 的 freedom 出站是否放行去往私有、回环、链路本地地址的连接。关闭（默认）时保持 xray 的默认规则——代理用户不能访问节点本机服务、云元数据地址（169.254.169.254）和所在内网；开启时放行。变更随快照下发，agent 重建内核一次，不参与 state hash（由配置版本携带）。需要面板 v2.2.0 才能在后台设置；配合旧面板时字段缺省，行为等同默认值。

## 不兼容变更

- **环境变量 `AKARI_ALLOW_PRIVATE_DESTINATIONS` 已移除**，不再有任何效果（只剩单元测试用的内部开关）。之前靠它放行内网的节点，升级后内网访问会重新被拦截；请在面板对应服务器的设置里打开「允许用户访问本机内网/回环地址」（面板 v2.2.0 起提供）。

## 文档

- README 新增「xray-core 分支」一节：说明长期使用 [akari-projectX/xray-core](https://github.com/akari-projectX/xray-core) 分支（上游已拒绝 `ActivityTimer` 自锁修复）的原因、补丁内容，以及每次升级 xray 时要做的步骤。
- 删除已过时的 GPL 评估：二进制不再链接任何 GPL 模块（v0.6.0 起 xray-core 不再依赖 `sagernet/sing*`）。同时订正 README 中过时的说法（受管协议列表、`akari server add`、撤权方式是系统设置）。

## 升级说明

- 与面板的兼容：v0.6.2 agent 连 v2.1.0 面板正常，仅无法使用新开关；v2.2.0 面板连 v0.6.0 / v0.6.1 agent 正常，若打开了新开关会在节点与服务器列表显示「agent 过旧……设置未生效」警告，旧 agent 会忽略该字段。
- 推荐顺序：先升级 agent，再升级面板（见面板 v2.2.0 说明）。
- 无数据、配置迁移；systemd / OpenRC 单元与 v0.6.1 相同。

## 校验

二进制、自更新清单（manifest）与 `SHA256SUMS` 均已签名；校验方法见面板 `docs/DEPLOY.md`「Verify a release」。许可证明见 `THIRD_PARTY_LICENSES.txt`（`./akari-agent -licenses` 输出同样内容）。
