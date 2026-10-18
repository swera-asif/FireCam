import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
const hashPassword = promisify(scrypt);
const resources = new Set(['cameras', 'sensors', 'zones', 'alerts', 'contacts', 'floors']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const publicUser = u => ({ id: u.id, username: u.username, fullName: u.fullName, phoneNumber: u.phoneNumber });
const digest = value => createHash('sha256').update(value).digest('hex');
const textField = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
function problem(status, message) { return Object.assign(new Error(message), { status }); }

export async function createApp({ dataDir = process.env.FIRECAM_DATA_DIR || resolve(root, '.data') } = {}) {
  await mkdir(dataDir, { recursive: true });
  const db = new DatabaseSync(resolve(dataDir, 'firecam.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, password TEXT NOT NULL, fullName TEXT, phoneNumber TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, userId INTEGER REFERENCES users(id), expires INTEGER);
    CREATE TABLE IF NOT EXISTS records (id INTEGER PRIMARY KEY, userId INTEGER REFERENCES users(id), kind TEXT, data TEXT);
    CREATE INDEX IF NOT EXISTS owner_records ON records(userId,kind);
    CREATE TABLE IF NOT EXISTS preferences (userId INTEGER PRIMARY KEY REFERENCES users(id), data TEXT);
  `);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  const subscribers = new Map();
  const attempts = new Map();
  const list = (userId, kind) => db.prepare('SELECT id,data FROM records WHERE userId=? AND kind=? ORDER BY id DESC').all(userId, kind).map(r => ({ ...JSON.parse(r.data), id: r.id }));
  const getRecord = (userId, kind, id) => { const r = db.prepare('SELECT id,data FROM records WHERE userId=? AND kind=? AND id=?').get(userId, kind, id); return r ? { ...JSON.parse(r.data), id: r.id } : null; };
  const emit = userId => { for (const s of subscribers.get(userId) || []) s.write('event: change\ndata: {}\n\n'); };
  const insert = (userId, kind, data) => { const result = db.prepare('INSERT INTO records(userId,kind,data) VALUES(?,?,?)').run(userId, kind, JSON.stringify(data)); emit(userId); return { ...data, id: Number(result.lastInsertRowid) }; };
  const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const body = async req => {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw problem(415, 'Send JSON data.');
    let size = 0, chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 3_000_000) throw problem(413, 'The upload is too large. Maximum size is 2 MB.'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; } catch { throw problem(400, 'Invalid JSON.'); }
  };
  const cookieToken = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('firecam_session='))?.slice(16);
  const userFor = req => { const token = cookieToken(req); if (!token || token.length !== 64) return null; return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.userId WHERE token=? AND expires>?').get(digest(token), Date.now()); };
  const setSession = (req, res, userId) => {
    const old = cookieToken(req); if (old) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(old));
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions(token,userId,expires) VALUES(?,?,?)').run(digest(token), userId, Date.now() + 86400_000);
    res.setHeader('Set-Cookie', `firecam_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
  };
  const validate = (kind, value, creating) => {
    const allowed = {
      cameras: ['name','location','floorId','status','imageUrl','source','positionX','positionY'],
      sensors: ['name','location','floorId','type','status','positionX','positionY'],
      zones: ['name','status','floorId','positionX','positionY','width','height'],
      alerts: ['type','status','location','message','severity','aiVerified','timestamp','resolvedAt','simulated','metadata'],
      contacts: ['name','phoneNumber','relationship','priority'],
      floors: ['name','level','background']
    }[kind];
    const clean = Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
    for (const [key, val] of Object.entries(clean)) {
      if (typeof val === 'string' && val.length > (key === 'background' ? 2_800_000 : key === 'imageUrl' ? 3000 : 2000)) throw problem(400, `${key} is too long.`);
      if (['positionX','positionY','width','height','priority','floorId'].includes(key) && (typeof val !== 'number' || !Number.isFinite(val))) throw problem(400, `Invalid ${key}.`);
    }
    for (const field of { cameras: ['name','location'], sensors: ['name','location'], zones: ['name'], alerts: ['message','location'], contacts: ['name','phoneNumber'], floors: ['name'] }[kind]) {
      if ((creating || field in clean) && !textField(clean[field], field === 'message' ? 2000 : 200)) throw problem(400, `Please enter a valid ${field}.`);
    }
    if (clean.phoneNumber && !/^[+\d ()-]{5,25}$/.test(clean.phoneNumber)) throw problem(400, 'Enter a valid phone number.');
    if (clean.imageUrl && !/^https?:\/\//i.test(clean.imageUrl)) throw problem(400, 'Camera image URL must start with http:// or https://.');
    if (clean.background && !/^data:image\/(png|jpeg|webp);base64,/.test(clean.background)) throw problem(400, 'Use a PNG, JPEG, or WebP floor plan.');
    if (kind === 'alerts') {
      if (creating) Object.assign(clean, { timestamp: new Date().toISOString(), aiVerified: false, simulated: true, status: 'active' });
      clean.aiVerified = false;
      clean.simulated = true;
      if ('status' in clean && !['active','resolved'].includes(clean.status)) throw problem(400, 'Invalid alert status.');
    }
    for (const field of ['positionX','positionY']) if (field in clean && (clean[field] < 0 || clean[field] > 95)) throw problem(400, 'Position must be between 0 and 95.');
    for (const field of ['width','height']) if (field in clean && (clean[field] < 5 || clean[field] > 95)) throw problem(400, 'Room size must be between 5 and 95.');
    if ('source' in clean && !['device','url','sample'].includes(clean.source)) throw problem(400, 'Invalid camera source.');
    if (creating && kind === 'cameras') clean.status = 'offline';
    return clean;
  };

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        if (!['GET','HEAD'].includes(req.method) && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw problem(403, 'This request must come from the FireCam app.');
        if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { service: 'firecam', version: 2, storage: 'sqlite', cameraAnalysis: false });
        if (['/api/register','/api/login'].includes(url.pathname) && req.method === 'POST') {
          const ip = req.socket.remoteAddress; const now = Date.now();
          const rate = attempts.get(ip); if (!rate || rate.until < now) attempts.set(ip, { count: 0, until: now + 600_000 });
          const current = attempts.get(ip); if (++current.count > 30) throw problem(429, 'Too many attempts. Try again in 10 minutes.');
          const b = await body(req);
          if (!textField(b.username, 100) || typeof b.password !== 'string' || b.password.length > 256) throw problem(400, 'Enter your username and password.');
          let user;
          if (url.pathname.endsWith('register')) {
            if (b.password.length < 10) throw problem(400, 'Use a password with at least 10 characters.');
            if (!/^[a-zA-Z0-9_.@+-]{3,100}$/.test(b.username)) throw problem(400, 'Use 3–100 letters, numbers, or . _ @ + - in your username.');
            if (db.prepare('SELECT id FROM users WHERE username=?').get(b.username)) throw problem(409, 'This username is already in use.');
            const salt = randomBytes(16).toString('hex');
            const hash = (await hashPassword(b.password, salt, 64)).toString('hex');
            try { const r = db.prepare('INSERT INTO users(username,password,fullName,phoneNumber) VALUES(?,?,?,?)').run(b.username, `${hash}.${salt}`, String(b.fullName || '').slice(0,100), String(b.phoneNumber || '').slice(0,30)); user = db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid); }
            catch { throw problem(409, 'This username is already in use.'); }
            insert(user.id, 'floors', { name: 'Ground floor', level: '0', background: '' });
          } else {
            user = db.prepare('SELECT * FROM users WHERE username=?').get(b.username);
            const [hash, salt] = (user?.password || `${'0'.repeat(128)}.invalid-user-salt`).split('.');
            const supplied = await hashPassword(b.password, salt, 64);
            if (!timingSafeEqual(supplied, Buffer.from(hash, 'hex')) || !user) throw problem(401, 'Incorrect username or password.');
          }
          setSession(req, res, user.id); return send(res, url.pathname.endsWith('register') ? 201 : 200, publicUser(user));
        }
        if (url.pathname === '/api/logout' && req.method === 'POST') {
          const token = cookieToken(req); if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
          res.setHeader('Set-Cookie','firecam_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(res, 200, { success: true });
        }
        const user = userFor(req); if (!user) throw problem(401, 'Please sign in to continue.');
        if (url.pathname === '/api/user') {
          if (req.method === 'GET') return send(res, 200, publicUser(user));
          if (req.method === 'PATCH') { const b = await body(req); const name = String(b.fullName ?? user.fullName).slice(0,100), phone = String(b.phoneNumber ?? user.phoneNumber).slice(0,30); db.prepare('UPDATE users SET fullName=?,phoneNumber=? WHERE id=?').run(name, phone, user.id); return send(res, 200, publicUser({ ...user, fullName: name, phoneNumber: phone })); }
        }
        if (url.pathname === '/api/bootstrap' && req.method === 'GET') return send(res, 200, { user: publicUser(user), ...Object.fromEntries([...resources].map(kind => [kind, list(user.id, kind)])), settings: JSON.parse(db.prepare('SELECT data FROM preferences WHERE userId=?').get(user.id)?.data || '{}') });
        if (url.pathname === '/api/events' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Connection':'keep-alive' }); res.write(': connected\n\n');
          if (!subscribers.has(user.id)) subscribers.set(user.id, new Set()); subscribers.get(user.id).add(res);
          const interval = setInterval(() => { if (!userFor(req)) return res.end(); res.write(': heartbeat\n\n'); }, 25_000);
          req.on('close', () => { clearInterval(interval); subscribers.get(user.id)?.delete(res); }); return;
        }
        if (url.pathname === '/api/settings') {
          if (req.method === 'GET') return send(res, 200, JSON.parse(db.prepare('SELECT data FROM preferences WHERE userId=?').get(user.id)?.data || '{}'));
          if (req.method === 'POST') { const b = await body(req); const clean = { homeName: String(b.homeName || 'My home').slice(0,100), desktopNotifications: Boolean(b.desktopNotifications), theme: b.theme === 'dark' ? 'dark' : 'light' }; db.prepare('INSERT INTO preferences VALUES(?,?) ON CONFLICT(userId) DO UPDATE SET data=excluded.data').run(user.id, JSON.stringify(clean)); emit(user.id); return send(res, 200, clean); }
        }
        const [, , kind, idString] = url.pathname.split('/');
        if (resources.has(kind)) {
          const id = Number(idString); if (idString && (!Number.isSafeInteger(id) || id < 1)) throw problem(400, 'Invalid record.');
          if (req.method === 'GET') { const data = id ? getRecord(user.id, kind, id) : list(user.id, kind); if (!data) throw problem(404,'Record not found.'); return send(res,200,data); }
          if (req.method === 'POST' && !id) { const clean = validate(kind, await body(req), true); return send(res,201,insert(user.id,kind,clean)); }
          if (['PATCH','DELETE'].includes(req.method) && id) {
            const record = getRecord(user.id,kind,id); if (!record) throw problem(404,'Record not found.');
            if (req.method === 'DELETE') { db.prepare('DELETE FROM records WHERE id=? AND userId=?').run(id,user.id); emit(user.id); return send(res,200,{ success:true }); }
            const clean = validate(kind,await body(req),false); const merged = { ...record,...clean,id }; db.prepare('UPDATE records SET data=? WHERE id=? AND userId=?').run(JSON.stringify(merged),id,user.id); emit(user.id); return send(res,200,merged);
          }
        }
        if (['/api/analyze-image','/api/verify-smoke','/api/notify-contacts'].includes(url.pathname)) throw problem(503,'This service is not connected. No monitoring, analysis, or notifications have been performed.');
        throw problem(404, 'API endpoint not found.');
      }
      if (!['GET','HEAD'].includes(req.method)) throw problem(405,'Method not allowed.');
      let path;
      try { path = resolve(root, 'public', '.' + decodeURIComponent(url.pathname)); } catch { throw problem(400,'Invalid path.'); }
      const base = resolve(root,'public'); if (path !== base && !path.startsWith(base + sep)) throw problem(403,'Forbidden.');
      if (url.pathname === '/') path = resolve(base,'index.html');
      try { if (!(await stat(path)).isFile()) throw Error(); } catch { if (!extname(url.pathname)) path=resolve(base,'index.html'); else throw problem(404,'File not found.'); }
      res.setHeader('Content-Type',mime[extname(path)] || 'application/octet-stream');
      res.setHeader('Cache-Control', extname(path) === '.html' || path.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600');
      if (req.method === 'HEAD') return res.end(); res.end(await readFile(path));
    } catch (err) { if (!res.headersSent) send(res, err.status || 500, { message: err.status ? err.message : 'An unexpected error occurred. Please try again.' }); else res.end(); }
  });
  return { server, close: () => new Promise(resolveClose => { for (const group of subscribers.values()) for (const res of group) res.end(); server.close(() => { db.close(); resolveClose(); }); server.closeAllConnections(); }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createApp(); const port = Number(process.env.PORT || 4173);
  app.server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`FireCam is ready: http://localhost:${port}`));
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
