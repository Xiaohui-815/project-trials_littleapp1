import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const required = ['VITE_CLOUDBASE_ENV_ID', 'VITE_CLOUDBASE_PUBLISHABLE_KEY', 'VITE_CLOUDBASE_AUTH_URL'];
const missing = required.filter(key => !env[key]?.trim());
if (missing.length) {
  console.error(`真实账号测试尚未就绪，缺少：${missing.join(', ')}`);
  console.error('参照 docs/DEPLOYMENT.md 完成 CloudBase 配置。没有配置时，页面只显示等待接入状态。');
  process.exit(1);
}
const url = new URL(env.VITE_CLOUDBASE_AUTH_URL);
if (url.protocol !== 'https:' || url.pathname !== '/__auth/' || url.username || url.password || url.hash) {
  throw new Error('VITE_CLOUDBASE_AUTH_URL 必须是 CloudBase 的 HTTPS /__auth/ 登录地址。');
}
const basePath = env.VITE_BASE_PATH || '/';
if (basePath !== '/' && !/^\/[\w/-]*\/$/.test(basePath)) {
  throw new Error('VITE_BASE_PATH 必须以 / 开头和结尾，例如 /project-trials_littleapp1/。');
}
console.log('公开配置完整。此检查不代替真实登录、权限及数据库联调。');
