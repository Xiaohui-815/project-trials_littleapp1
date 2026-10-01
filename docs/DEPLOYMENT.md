# 当前部署方案（2026-10-01 更新）

测试站点：https://codex-project-trials-d7a0d8825a1-1452380991.tcloudbaseapp.com/

网站改由 CloudBase 静态托管，源码保存在 GitHub。GitHub Pages 仅发布新站点入口。

原因：官方托管登录页只接受同源返回地址；添加安全域名不能共享跨域浏览器会话。

## 已配置

环境 codex-project-trials-d7a0d8825a1，上海 ap-shanghai。邮箱认证、密码登录、平台邮件代发开启，匿名与手机登录关闭。集合 point_records 权限 ADMINONLY，索引 owner_date_id 为 ownerId 升序、incomeDate 与 _id 降序。事件云函数 points-ledger 已部署，无 HTTP 触发器。

## 更新前端

复制 .env.example 到被 Git 忽略的 .env.production.local，填写上述环境与地域、控制台 Publishable Key，以及同域 /__auth/ 完整 URL。VITE_BASE_PATH 必须设置为 /。

依次运行 npm ci、npm test、npm run check:deploy、npm run build，然后执行：

    tcb hosting deploy dist --verify -e codex-project-trials-d7a0d8825a1 -r ap-shanghai

只上传 dist，不上传密钥与环境文件，不覆盖平台 /__auth/，不用 --prune 删除未知资源。GitHub Actions 仅测试源码并发布入口页，不自动部署 CloudBase。

## 更新云函数

参照 cloudbaserc.example.json 建立被 Git 忽略的 cloudbaserc.local.json，设置环境与地域后执行：

    tcb --config-file cloudbaserc.local.json fn deploy points-ledger

保持 Nodejs20.19、256 MB、20 秒超时、安装依赖；不创建 HTTP 触发器。

## 待验收

单元测试、云端无用户身份拒绝、集合权限与索引读回、托管文件上传校验已通过。实际邮箱注册、登录、找回密码、两账号隔离和跨设备保存仍需按 ACCEPTANCE.md 验收。

默认域名用于开发测试，有平台访问提示及频率限制；未购买正式域名。

参考：https://docs.cloudbase.net/hosting/manage
