// 存档:始终存一份在本机;如果网站跑在自带的服务器上并且已登录,再同步到云端。
(function (root) {
  'use strict';

  const LOCAL_KEY = 'cloud-pet:v2';
  const TOKEN_KEY = 'cloud-pet:token';
  const USER_KEY = 'cloud-pet:user';

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  let server = false;
  let token = ls.get(TOKEN_KEY);
  let user = ls.get(USER_KEY);
  let timer = null;
  let pending;

  function forget() {
    token = null;
    user = null;
    ls.del(TOKEN_KEY);
    ls.del(USER_KEY);
  }

  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) forget();
    if (!res.ok) throw new Error(data.error || '网络好像出了点问题');
    return data;
  }

  async function init() {
    if (!location.protocol.startsWith('http')) return;
    try {
      server = (await fetch('/api/health')).ok;
    } catch {
      server = false;
    }
  }

  function loadLocal() {
    try { return JSON.parse(ls.get(LOCAL_KEY)); } catch { return null; }
  }

  // remote: 是否同步到云端(定时结算只存本机,用户操作才上传)
  function save(state, { remote = false, now = false } = {}) {
    if (state) ls.set(LOCAL_KEY, JSON.stringify(state));
    else ls.del(LOCAL_KEY);
    if (!remote || !server || !token) return;
    pending = state;
    clearTimeout(timer);
    timer = setTimeout(flush, now ? 0 : 1500);
  }

  async function flush() {
    if (pending === undefined) return;
    const state = pending;
    pending = undefined;
    try {
      await api('PUT', '/api/state', { state });
    } catch (err) {
      console.warn('同步失败', err);
    }
  }

  async function loadRemote() {
    return (await api('GET', '/api/state')).state;
  }

  async function auth(kind, username, password) {
    const data = await api('POST', `/api/${kind}`, { username, password });
    token = data.token;
    user = data.username;
    ls.set(TOKEN_KEY, token);
    ls.set(USER_KEY, user);
  }

  async function logout() {
    await flush();
    if (token) api('POST', '/api/logout').catch(() => {});
    forget();
  }

  // 关页面前把没传完的存档送出去
  window.addEventListener('pagehide', () => {
    if (pending === undefined || !token) return;
    fetch('/api/state', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state: pending }),
    }).catch(() => {});
  });

  root.Store = {
    init, loadLocal, save, flush, loadRemote, auth, logout,
    get serverAvailable() { return server; },
    get user() { return user; },
    get loggedIn() { return server && !!token; },
  };
})(window);
