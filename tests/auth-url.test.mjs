import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedAuthUrl } from '../src/lib/auth-url.ts';

test('hosted sign-in preserves the same-origin callback', () => {
  const callback = 'https://login.example.com/';
  const url = new URL(hostedAuthUrl('https://login.example.com/__auth/?client_id=web-client&app_id=test-app', 'test-env', callback));
  assert.equal(url.origin, 'https://login.example.com');
  assert.equal(url.pathname, '/__auth/');
  assert.equal(url.searchParams.get('redirect_uri'), callback);
  assert.equal(url.searchParams.get('client_id'), 'web-client');
  assert.equal(url.searchParams.get('env_id'), 'test-env');
  assert.equal(url.searchParams.get('app_id'), 'test-app');
});

test('hosted auth rejects insecure, credential-bearing or invalid sign-in destinations', () => {
  const callback = 'https://example.github.io/app/';
  for (const url of ['http://login.example.com/__auth/', 'https://login.example.com/signin', 'https://user:password@login.example.com/__auth/', 'https://login.example.com/__auth/#token']) {
    assert.throws(() => hostedAuthUrl(url, 'test-env', callback));
  }
  assert.throws(() => hostedAuthUrl('https://login.example.com/__auth/', 'test-env', 'http://public.example.com/'));
  assert.throws(() => hostedAuthUrl('https://login.example.com/__auth/', 'test-env', 'https://example.github.io/app/'));
});
