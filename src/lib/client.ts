import type { Account, LedgerClient } from '../types';
import { hostedAuthUrl } from './auth-url';

const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim();
const authUrl = import.meta.env.VITE_CLOUDBASE_AUTH_URL?.trim();
const publicKey = import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY?.trim();
const returnUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export async function createClient(): Promise<LedgerClient> {
  // Development-only visual fixture. Vite removes this branch from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1') {
    const { createPreviewClient } = await import('../preview/client');
    return createPreviewClient();
  }
  const configured = Boolean(envId && authUrl && publicKey);
  if (!configured) {
    const unavailable = async (): Promise<never> => { throw new ApiError('SETUP', '测试环境尚未连接，请联系网站创建者。'); };
    return { configured: false, preview: false, getAccount: async () => null, onAccountChange: () => () => {},
      signIn: unavailable, signOut: unavailable, list: unavailable, summary: unavailable, save: unavailable, remove: unavailable };
  }
  hostedAuthUrl(authUrl, envId, returnUrl());
  const { default: cloudbase } = await import('@cloudbase/js-sdk');
  const app = cloudbase.init({ env: envId, region: import.meta.env.VITE_CLOUDBASE_REGION || 'ap-shanghai',
    accessKey: publicKey, auth: { detectSessionInUrl: true } });
  const auth = app.auth;
  const mapUser = (user: { id?: string; email?: string; is_anonymous?: boolean } | null | undefined): Account | null =>
    user?.id && user.email && !user.is_anonymous ? { id: user.id, email: user.email } : null;
  async function invoke<T>(action: string, data: object): Promise<T> {
    try {
      const response = await app.callFunction({ name: import.meta.env.VITE_CLOUDBASE_FUNCTION_NAME || 'points-ledger', data: { action, data } });
      const body = typeof response.result === 'string' ? JSON.parse(response.result) : response.result;
      if (!body || typeof body.ok !== 'boolean') throw new Error('Invalid response');
      if (!body.ok) throw new ApiError(body.error.code, body.error.message);
      return body.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('NETWORK', '连接暂时中断，请检查网络后重试。');
    }
  }
  return {
    configured: true, preview: false,
    async getAccount() {
      const { data, error } = await auth.getSession();
      if (error) throw new Error('无法检查登录状态，请刷新页面重试。');
      return mapUser(data?.session?.user);
    },
    onAccountChange(callback) {
      const subscription = auth.onAuthStateChange((_event, session) => callback(mapUser(session?.user)));
      return () => subscription.data.subscription.unsubscribe();
    },
    async signIn() {
      // Only the build-time configured host and this site's exact base path are used.
      location.assign(hostedAuthUrl(authUrl, envId, returnUrl()));
    },
    async signOut() {
      const result = await auth.signOut();
      if (result && 'error' in result && result.error) throw new Error('退出登录未完成，请重试。');
    },
    list: filters => invoke('list', filters),
    summary: year => invoke('summary', { year }),
    save: input => invoke(input.id ? 'update' : 'create', input),
    remove: record => invoke('delete', { id: record.id, version: record.version }),
  };
}
