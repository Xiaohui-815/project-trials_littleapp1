# 经营积分账本

优先适配电脑浏览器的个人积分收入账本。前端使用 React + TypeScript + Vite，发布到 CloudBase 静态托管；源码保存在 GitHub。邮箱注册和登录在同域 CloudBase 托管认证页完成，数据由云函数及文档数据库管理。

## 已实现

- 个人积分概览、收入明细、月度和年度统计，支持手机基本浏览。
- 新增、补录、编辑、删除记录；两位小数精确存储；北京时间日期归属。
- 云函数身份校验、账号数据隔离、完整数据汇总、重复提交保护及并发修改检查。
- 托管认证接入、账号退出、配置缺失与网络失败状态。
- GitHub Actions 自动测试、构建及 Pages 发布。

## 当前接入状态

测试环境和网站已部署：[打开测试账本](https://codex-project-trials-d7a0d8825a1-1452380991.tcloudbaseapp.com/)。数据库仅服务端可读写，邮箱认证和平台邮件代发已开启。**真实邮箱注册、数据库持久化、跨设备同步与大陆网络实测仍待完成。**

没有配置时，发布页面显示“等待开通测试环境”，不会收集密码、创建模拟账号或用浏览器存储代替云数据库。`?preview=1` 仅在本地开发模式提供明确标注的示例界面，使用内存数据、刷新重置；生产构建不包含该功能。

## 本地运行

要求 Node.js 22.18+ 或 24，npm。

```sh
npm ci
npm run dev
```

- 页面：`http://127.0.0.1:5173/`
- 界面预览：`http://127.0.0.1:5173/?preview=1#/overview`
- 真实云端接入：复制 `.env.example` 为 `.env.local`，按照 [测试部署说明](docs/DEPLOYMENT.md) 填写公开配置并重启开发服务器。

## 验证

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

如 Windows 已安装 Edge，可在 PowerShell 使用：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

测试结果与未验证项目见 [验收说明](docs/ACCEPTANCE.md)。

## 结构

- `src/`：桌面优先界面、CloudBase 客户端与开发模式预览。
- `cloudfunctions/points-ledger/`：可独立部署的云函数、业务校验与数据库访问。
- `cloudbase/`：文档数据库访问规则和索引说明。
- `.github/workflows/pages.yml`：GitHub Pages 测试和发布流程。
- `docs/`：配置、接口、验收和已知限制。

生产构建只上传 `dist/`，不上传云函数或密钥。网站只记录积分收入，不提供兑换、支付或交易功能。
