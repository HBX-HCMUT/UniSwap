import assert from 'node:assert/strict';
import sharp from 'sharp';
import { performance } from 'node:perf_hooks';
import { eventually } from './environment.mjs';

export const password = 'UniSwapDemo123!';
export const emailOf = (actor) => actor + '@student.example.test';
export const px = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWOQ7vGGIwbiOACGgw8hAiMwJQAAAABJRU5ErkJggg==',
  'base64',
);
export async function assertImage(data) {
  const pixels = await sharp(data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(pixels.info.width, 4);
  assert.equal(pixels.info.height, 4);
  assert.equal(pixels.info.channels, 3);
  assert.deepEqual(pixels.data, Buffer.from(Array.from({ length: 16 }, () => [27, 140, 75]).flat()));
}

export const meeting = (offsetMinutes = 90) => ({
  action: 'ACCEPT',
  finalPrice: 60000,
  meetingAt: new Date(Date.now() + offsetMinutes * 60_000).toISOString(),
  meetingPlace: 'Sảnh A1',
  paymentMethod: 'COD',
});

export function client(origin, operations, webOrigin = origin) {
  const jar = new Map();
  return async (path, status, { method = 'GET', body, code } = {}) => {
    assert.ok(path.startsWith('/') && !path.startsWith('//'));
    const headers = { Origin: webOrigin };
    if (jar.size) headers.Cookie = [...jar].map(([name, value]) => name + '=' + value).join('; ');
    const form = body instanceof FormData;
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
    const start = performance.now();
    const response = await fetch(origin + '/api/v1' + path, {
      method, body: form || body === undefined ? body : JSON.stringify(body),
      headers, redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [name, value] = cookie.split(';')[0].split(/=(.*)/s);
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    const expected = Array.isArray(status) ? status : [status];
    const requestPath = path.split('?')[0];
    assert.ok(expected.includes(response.status),
      `${method} ${requestPath}: mong đợi ${expected.join('/')}, thực tế ${response.status}`
      + (data?.code ? ` (${data.code})` : ''));
    if (code) assert.equal(data.code, code, `${method} ${requestPath}: mã lỗi`);
    operations?.add(method + ' ' + requestPath);
    return { data, status: response.status, headers: response.headers, ms: performance.now() - start };
  };
}

export async function signIn(api, actor, status = 200, email = emailOf(actor)) {
  return (await api('/auth/login', status, { method: 'POST', body: { email, password } })).data;
}

export function formFor(purpose = 'LISTING', valid = true) {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', new Blob([valid ? px : 'không phải ảnh'], {
    type: valid ? 'image/png' : 'text/plain',
  }), valid ? 'anh.png' : 'anh.txt');
  return form;
}

export async function verificationLink(mailpit, email, webOrigin, minCount = 1) {
  const link = await eventually(async () => {
    const search = await fetch(mailpit + '/api/v1/search?' + new URLSearchParams({ query: 'to:' + email }),
      { redirect: 'error', signal: AbortSignal.timeout(2000) });
    assert.equal(search.status, 200, 'Mailpit cho phép tìm thư fixture');
    const { messages } = await search.json();
    const matches = (messages ?? []).filter((message) => message.To?.some(({ Address }) => Address === email));
    if (matches.length < minCount) return null;
    const messageId = matches[0].ID;
    const response = await fetch(mailpit + '/api/v1/message/' + encodeURIComponent(messageId),
      { redirect: 'error', signal: AbortSignal.timeout(2000) });
    assert.equal(response.status, 200, 'Mailpit đọc được thư fixture');
    const message = await response.json();
    return (message.Text + ' ' + message.HTML).match(/https?:\/\/[^\s"'<>]+\/verify\?token=[^\s"'<>]+/)?.[0];
  }, 12000, 'Mailpit chưa nhận được link xác minh gửi đến đúng email thử');
  const url = new URL(link.replace(/&amp;/g, '&'));
  assert.equal(url.origin, webOrigin);
  assert.equal(url.pathname, '/verify');
  assert.ok(url.searchParams.get('token'));
  return url;
}

export function apiFixture(environment, operations) {
  const anon = client(environment.apiOrigin, operations, environment.webOrigin);
  const login = async (name) => {
    const request = client(environment.apiOrigin, operations, environment.webOrigin);
    const user = await signIn(request, name);
    return { request, user };
  };
  return { anon, login, newClient: () => client(environment.apiOrigin, operations, environment.webOrigin) };
}
