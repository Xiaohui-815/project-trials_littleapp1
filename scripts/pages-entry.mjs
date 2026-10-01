import { mkdirSync, writeFileSync } from 'node:fs';
const url = 'https://codex-project-trials-d7a0d8825a1-1452380991.tcloudbaseapp.com/';
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>经营积分账本</title><style>body{font:18px system-ui;max-width:640px;margin:15vh auto;padding:24px;color:#20342f}a{color:#14745b}</style><h1>经营积分账本</h1><p>测试账本已迁至 CloudBase，注册、登录与记录保存在同一站点。</p><p><a href="${url}">打开测试账本 →</a></p></html>`);
