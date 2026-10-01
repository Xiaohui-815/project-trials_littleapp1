// CloudBase's hosted login requires a same-origin callback and session storage.
export function hostedAuthUrl(authUrl: string, envId: string, returnUrl: string) {
  const url = new URL(authUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/__auth/') {
    throw new Error('托管登录地址需为控制台提供的 HTTPS /__auth/ 地址。');
  }
  if (url.hash) throw new Error('托管登录地址不能包含片段参数。');
  const target = new URL(returnUrl);
  if (target.origin !== url.origin) throw new Error('账本与托管登录页必须部署在同一域名。');
  if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) {
    throw new Error('登录回调必须使用 HTTPS。');
  }
  url.searchParams.set('env_id', envId);
  if (!url.searchParams.has('client_id')) url.searchParams.set('client_id', envId);
  if (!url.searchParams.has('config_version')) url.searchParams.set('config_version', 'env');
  url.searchParams.set('redirect_uri', target.href);
  return url.href;
}
