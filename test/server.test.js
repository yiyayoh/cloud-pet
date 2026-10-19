'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server/server.js');

test('账号与云端存档', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-pet-'));
  const server = createServer({ dataFile: path.join(dir, 'db.json') });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((r) => server.close(r)));

  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  await t.test('页面和健康检查', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /云养宠物/);
    assert.equal((await call('GET', '/api/health')).body.ok, true);
    assert.equal((await fetch(`${base}/../server/server.js`)).status, 404);
    assert.equal((await fetch(`${base}/..%2fserver%2fserver.js`)).status, 403);
  });

  let token;
  await t.test('注册、重复注册、登录', async () => {
    assert.equal((await call('POST', '/api/register', { username: 'a', password: '123456' })).status, 400);
    const r = await call('POST', '/api/register', { username: '小明', password: '123456' });
    assert.equal(r.status, 200);
    assert.equal(r.body.username, '小明');
    assert.equal((await call('POST', '/api/register', { username: '小明', password: '654321' })).status, 409);
    assert.equal((await call('POST', '/api/login', { username: '小明', password: 'wrong!' })).status, 401);
    const login = await call('POST', '/api/login', { username: '小明', password: '123456' });
    assert.equal(login.status, 200);
    token = login.body.token;
  });

  await t.test('读写存档需要登录', async () => {
    assert.equal((await call('GET', '/api/state')).status, 401);
    assert.equal((await call('GET', '/api/state', undefined, token)).body.state, null);
    assert.equal((await call('PUT', '/api/state', { state: [1] }, token)).status, 400);
    assert.equal((await call('PUT', '/api/state', { state: { name: '团子', coins: 9 } }, token)).status, 200);
    assert.deepEqual((await call('GET', '/api/state', undefined, token)).body.state, { name: '团子', coins: 9 });
  });

  await t.test('退出后 token 失效', async () => {
    assert.equal((await call('POST', '/api/logout', undefined, token)).status, 200);
    assert.equal((await call('GET', '/api/state', undefined, token)).status, 401);
  });

  await t.test('数据写入文件,重启后还在', async () => {
    await new Promise((r) => server.close(r));
    const again = createServer({ dataFile: path.join(dir, 'db.json') });
    await new Promise((r) => again.listen(0, r));
    const url = `http://127.0.0.1:${again.address().port}`;
    const res = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '小明', password: '123456' }),
    });
    const { token: t2 } = await res.json();
    const s = await fetch(`${url}/api/state`, { headers: { Authorization: `Bearer ${t2}` } });
    assert.equal((await s.json()).state.name, '团子');
    await new Promise((r) => again.close(r));
    server.listen(0); // 让外层 after 的 close 能正常结束
  });
});
