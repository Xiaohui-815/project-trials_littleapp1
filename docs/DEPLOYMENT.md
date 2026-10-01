# 测试部署说明

目标仓库：[Xiaohui-815/project-trials_littleapp1](https://github.com/Xiaohui-815/project-trials_littleapp1)。本阶段使用 GitHub Pages 默认地址，不购买正式域名、不申请备案，也不自动开通付费服务。

## 1. GitHub Pages

1. 将本项目推送至仓库 `main` 分支。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 在 **Actions → Verify and publish test frontend** 查看发布结果。缺少 CloudBase 配置时仍可发布等待接入页面；此页面不能用于真实账号测试。
4. 以 Actions 部署返回的 `page_url` 为实际链接；该仓库的预期默认地址为 `https://xiaohui-815.github.io/project-trials_littleapp1/`。在部署成功前不要将预期地址作为已上线地址。

普通测试用户无需 GitHub 账号。GitHub 仓库只存源码，积分与用户数据不写入仓库。不要将任何测试数据、账号密码、管理密钥提交到仓库。

## 2. 创建 CloudBase 测试环境

由账号所有者进入[腾讯云 CloudBase 控制台](https://tcb.cloud.tencent.com/)，创建独立的测试环境，优先上海地域，启用**文档型数据库**和云函数。先检查控制台显示的套餐与费用，不在未确认费用时开通付费资源。

记录环境 ID 和地域（例如 `ap-shanghai`）。本实现使用文档数据库 SDK，不适用于仅启用 PostgreSQL 的环境。生产环境与测试环境应分开。

## 3. 数据库及函数权限

在文档型数据库创建 `point_records` 集合：

- 将自定义安全规则设为 `cloudbase/database.rules.json` 的内容，即客户端直接读写均为 `false`。
- 按 `cloudbase/indexes.json` 创建非唯一复合索引：`ownerId` 升序、`incomeDate` 降序、`_id` 降序。
- `_id` 使用数据库默认唯一约束，保证同一提交不会插入两笔收入。

函数使用服务端 SDK，权限由业务逻辑强制检查。函数身份只读取平台上下文中的用户 UID，并检查注册邮箱。请求中的 `ownerId`、`uid` 等字段不能决定身份。

创建 `points-ledger` **事件型云函数**：

- 运行环境 `Nodejs20.19`，入口 `index.main`，内存 256 MB，超时 20 秒。
- 上传目录为 `cloudfunctions/points-ledger/`，保留其中所有 `.js`、`.mjs`、`package.json` 和 `package-lock.json` 文件。
- 安装该目录的 npm 依赖（`npm ci --omit=dev`），不要使用根目录的前端依赖。
- 通过 CloudBase SDK 调用。**不要启用匿名 HTTP 触发器，不要配置公开绕过身份的 HTTP 网关。**
- 在平台支持的调用安全规则中限制已登录用户，并关闭应用匿名登录；业务代码仍会检查邮箱身份。

也可使用官方 CloudBase CLI 登录后部署。复制 `cloudbaserc.example.json` 为 `cloudbaserc.local.json`，填写环境 ID，再按当前 CLI 的配置文件选项运行 `tcb fn deploy points-ledger`。本项目不自动创建云资源。

## 4. 托管邮箱认证

1. 在 CloudBase 身份认证中开启邮箱注册／验证码验证及邮箱密码登录，允许新用户自行注册，关闭匿名登录。
2. 配置发件邮箱及 SMTP 服务，验证注册邮件和密码重置邮件能送达测试邮箱。邮件授权码仅配置在云控制台。
3. 开启托管登录页，展示邮箱注册、密码登录和找回密码入口。
4. 在安全来源中添加实际 GitHub Pages 域名；在认证回调白名单中精确添加站点根地址，包含仓库路径和末尾 `/`，不要使用任意来源通配符。
5. 从控制台复制实际托管认证页 HTTPS 地址，形如 `https://控制台提供的域名/__auth/`。保留控制台提供的 `app_id`、`client_id`、`config_version` 参数（如有）。不可填写 GitHub Pages 的 `/__auth/` 地址。
6. 生成浏览器可公开的 **Publishable Key**，不要使用管理密钥、SecretId 或 SecretKey。

### GitHub Pages 的跨域登录注意点

CloudBase JS SDK 3.10.1 的 `toDefaultLoginPage` 会将 `/__auth/` 放在回调地址的同源下，而 GitHub Pages 没有该路由。因此 `src/lib/auth-url.ts` 按 SDK 的参数结构跳转到**显式配置的 CloudBase 托管认证域名**，回调使用 GitHub Pages 的完整仓库根路径；SDK 启用 `detectSessionInUrl` 消费认证回调。

跨域托管登录必须在真实 CloudBase 环境配置后验证。需确认该环境支持外部回调、回调白名单有效、返回的认证信息能被 SDK 换成有效会话。如果托管登录配置仅允许同源回调，应先在 CloudBase 控制台配置受支持的 Web 客户端授权方式，再调整认证适配器；**不得通过在 Pages 上增加密码表单、把访问令牌跨域粘贴或使用模拟会话绕过。** 本地测试无法代替此验证。

## 5. GitHub Actions 公开变量

在仓库 **Settings → Secrets and variables → Actions → Variables** 添加：

| 变量 | 值 |
| --- | --- |
| `VITE_CLOUDBASE_ENV_ID` | 测试环境 ID |
| `VITE_CLOUDBASE_REGION` | 环境地域，例如 `ap-shanghai` |
| `VITE_CLOUDBASE_PUBLISHABLE_KEY` | 浏览器可公开 Publishable Key |
| `VITE_CLOUDBASE_AUTH_URL` | CloudBase 托管 `/__auth/` 完整地址 |

发布流程自动设置仓库路径 `/project-trials_littleapp1/` 和函数名 `points-ledger`。配置缺失一部分会让检查失败，避免发布一半可用的账号配置。全部为空时明确发布等待接入页面。

`VITE_*` 内容会进入浏览器构建产物，绝不能放管理密钥。所有私密配置只进入云服务端。添加变量后重新运行发布工作流。

## 6. 联调后才能邀请真实测试

按 [验收说明](ACCEPTANCE.md) 执行两邮箱账号的注册、密码登录、找回密码、双账号隔离、跨设备持久化及大陆网络验证。全部通过后，再向测试人员分享链接。

GitHub Pages 的默认域名访问情况以测试人员实际网络为准。失败时保留数据和错误提示，不静默切换到浏览器存储。云函数日志只记录错误码，不记录密码、令牌、邮箱或备注。

## 7. 更新、撤回与数据保留

- 前端更新：推送 `main` 后自动测试并发布。
- 云函数更新：使用同一测试环境部署；不要清空 `point_records`。
- 撤回前端：重跑之前提交的发布流程或提交回退，不自动删除云端数据。
- 停止测试：关闭注册或撤下 Pages，保留云数据库；正式迁移前确定数据保留安排。

## 官方参考

- [CloudBase 身份认证](https://docs.cloudbase.net/api-reference/webv2/authentication)
- [CloudBase 云函数部署](https://docs.cloudbase.net/en/cli-v1/functions/deploy)
- [GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
