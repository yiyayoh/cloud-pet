// 云养宠物服务器:提供静态页面 + 账号 + 存档接口。只用 Node 自带模块,数据存在一个 JSON 文件里。
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 64 * 1024;
const SESSION_TTL = 90 * 24 * 3600 * 1000;
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createDb(file) {
  let data = { users: {}, sessions: {} };
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  let timer = null;

  function writeNow() {
    clearTimeout(timer);
    timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  return {
    data,
    save() {
      if (!timer) timer = setTimeout(writeNow, 200);
    },
    flush() {
      if (timer) writeNow();
    },
  };
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, '数据太大了'));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '请求格式不对'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function createServer({ dataFile = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json') } = {}) {
  const db = createDb(dataFile);
  const fails = new Map(); // ip -> { n, since }

  function issueToken(username) {
    const token = crypto.randomBytes(32).toString('hex');
    db.data.sessions[sha256(token)] = { username, createdAt: Date.now() };
    db.save();
    return token;
  }

  function currentUser(req) {
    const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
    const session = m && db.data.sessions[sha256(m[1])];
    if (!session || Date.now() - session.createdAt > SESSION_TTL) throw new HttpError(401, '请先登录');
    const user = db.data.users[session.username];
    if (!user) throw new HttpError(401, '请先登录');
    return { user, tokenHash: sha256(m[1]) };
  }

  function checkCredentials({ username, password }) {
    if (typeof username !== 'string' || !/^[\w一-龥]{2,16}$/.test(username)) {
      throw new HttpError(400, '用户名需要 2–16 位,可用中文、字母、数字和下划线');
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 64) {
      throw new HttpError(400, '密码需要 6–64 位');
    }
    return { username, password };
  }

  function rateLimit(ip) {
    const f = fails.get(ip);
    if (f && Date.now() - f.since < LOGIN_WINDOW && f.n >= LOGIN_MAX_FAILS) {
      throw new HttpError(429, '尝试次数太多了,过十分钟再试吧');
    }
  }

  function recordFail(ip) {
    const f = fails.get(ip);
    if (!f || Date.now() - f.since > LOGIN_WINDOW) fails.set(ip, { n: 1, since: Date.now() });
    else f.n++;
  }

  const routes = {
    'GET /api/health': () => ({ ok: true }),

    'POST /api/register': async (req) => {
      const { username, password } = checkCredentials(await readJson(req));
      if (db.data.users[username]) throw new HttpError(409, '这个用户名已经有人用了');
      const salt = crypto.randomBytes(16).toString('hex');
      db.data.users[username] = { salt, hash: hashPassword(password, salt), createdAt: Date.now(), state: null };
      return { token: issueToken(username), username };
    },

    'POST /api/login': async (req) => {
      const ip = req.socket.remoteAddress;
      rateLimit(ip);
      const { username, password } = await readJson(req);
      const user = typeof username === 'string' && db.data.users[username];
      const ok = user && typeof password === 'string'
        && crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.salt), 'hex'), Buffer.from(user.hash, 'hex'));
      if (!ok) {
        recordFail(ip);
        throw new HttpError(401, '用户名或密码不对');
      }
      fails.delete(ip);
      return { token: issueToken(username), username };
    },

    'POST /api/logout': (req) => {
      const { tokenHash } = currentUser(req);
      delete db.data.sessions[tokenHash];
      db.save();
      return { ok: true };
    },

    'GET /api/state': (req) => ({ state: currentUser(req).user.state }),

    'PUT /api/state': async (req) => {
      const { user } = currentUser(req);
      const { state } = await readJson(req);
      if (state !== null && (typeof state !== 'object' || Array.isArray(state))) {
        throw new HttpError(400, '存档格式不对');
      }
      user.state = state;
      user.savedAt = Date.now();
      db.save();
      return { ok: true, savedAt: user.savedAt };
    },
  };

  function serveStatic(req, res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      throw new HttpError(400, 'bad path');
    }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'forbidden' });
    fs.readFile(file, (err, buf) => {
      if (err) return sendJson(res, 404, { error: '找不到页面' });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      const route = routes[`${req.method} ${pathname}`];
      if (!route) {
        if (pathname.startsWith('/api/')) throw new HttpError(404, '没有这个接口');
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
        return serveStatic(req, res, pathname);
      }
      sendJson(res, 200, await route(req));
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      sendJson(res, err.status || 500, { error: err.status ? err.message : '服务器开小差了' });
    }
  });

  server.on('close', () => db.flush());
  return server;
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const server = createServer();
  server.listen(port, () => console.log(`云养宠物已启动:http://localhost:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
