const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const APP_VERSION = 'v26-pdf-map-bulk-import';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_DATA_PATH = path.join(ROOT, 'data', 'db.json');
const DATA_PATH = process.env.JIMOWAN_DATA_PATH || DEFAULT_DATA_PATH;

// Renderなどで使う限定公開用パスワード。
// ローカル確認では未設定でも動くように、初期値は jimowan にしています。
// 本番公開時は必ず Render の Environment Variables で JIMOWAN_PASSWORD を設定してください。
const APP_PASSWORD = process.env.JIMOWAN_PASSWORD || 'jimowan';
const SESSION_SECRET = process.env.JIMOWAN_SESSION_SECRET || crypto
  .createHash('sha256')
  .update(`jimowan-session:${APP_PASSWORD}`)
  .digest('hex');
const SESSION_COOKIE = 'jimowan_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14日

const PHOTO_CACHE = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

function ensureDb() {
  if (fs.existsSync(DATA_PATH)) return;
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  if (fs.existsSync(DEFAULT_DATA_PATH)) {
    fs.copyFileSync(DEFAULT_DATA_PATH, DATA_PATH);
  } else {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ wonderlands: [] }, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function send(res, status, data, contentType = 'application/json; charset=utf-8', extraHeaders = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 70_000_000) {
        req.destroy();
        reject(new Error('Request body is too large. KML取込は70MBまで対応しています'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionCookie(req) {
  const payload = Buffer.from(JSON.stringify({
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS
  })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(session.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function isPublicPath(pathname) {
  return pathname === '/login'
    || pathname === '/login.html'
    || pathname === '/api/login'
    || pathname === '/api/auth'
    || pathname === '/api/health'
    || pathname === '/styles.css'
    || pathname === '/favicon.ico';
}

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 500);
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, n));
}

function rankingFields(w) {
  const votes = w.votes || { unknown: 0, surprise: 0, try: 0, voters: 0 };
  const total = Number(votes.unknown || 0) + Number(votes.surprise || 0) + Number(votes.try || 0);
  const voters = Number(votes.voters || 0);
  return {
    ...w,
    ranking: {
      unknown: Number(votes.unknown || 0),
      surprise: Number(votes.surprise || 0),
      try: Number(votes.try || 0),
      total,
      voters,
      avgUnknown: voters ? Number((votes.unknown / voters).toFixed(2)) : 0,
      avgSurprise: voters ? Number((votes.surprise / voters).toFixed(2)) : 0,
      avgTry: voters ? Number((votes.try / voters).toFixed(2)) : 0,
      avgTotal: voters ? Number((total / voters).toFixed(2)) : 0
    }
  };
}

function sortedWonderlands(db) {
  return db.wonderlands
    .map(rankingFields)
    .sort((a, b) => {
      if (b.ranking.total !== a.ranking.total) return b.ranking.total - a.ranking.total;
      if (b.ranking.avgTotal !== a.ranking.avgTotal) return b.ranking.avgTotal - a.ranking.avgTotal;
      return new Date(a.createdAt) - new Date(b.createdAt);
    })
    .map((w, index) => ({ ...w, rank: index + 1 }));
}

function uniqueNonEmpty(values) {
  return Array.from(new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean)));
}

function titleKeyword(title = '') {
  return String(title)
    .replace(/ワンダーランド/g, '')
    .replace(/[＋+]/g, ' ')
    .replace(/[・／/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPhotoQueries(w) {
  const firstSpot = w?.spots?.[0]?.name || '';
  const secondSpot = w?.spots?.[1]?.name || '';
  const tag = Array.isArray(w?.tags) ? (w.tags.find((t) => !['KML取込','東京ウォーキングマップ','ウォーキング'].includes(String(t))) || '') : '';
  const keyword = titleKeyword(w?.title || '');
  return uniqueNonEmpty([
    firstSpot,
    secondSpot,
    [firstSpot, w?.area].filter(Boolean).join(' '),
    [keyword, w?.area].filter(Boolean).join(' '),
    [w?.area, tag].filter(Boolean).join(' '),
    keyword,
    w?.area,
    w?.locality
  ]).slice(0, 8);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Jimowan/1.0 (photo-search)' } });
  if (!response.ok) throw new Error(`Photo lookup failed: ${response.status}`);
  return response.json();
}

async function searchWikipediaPhoto(term) {
  const searchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&utf8=1&format=json&srlimit=3`;
  const data = await fetchJson(searchUrl);
  const items = data?.query?.search || [];
  for (const item of items) {
    const title = item?.title;
    if (!title) continue;
    try {
      const summaryUrl = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summary = await fetchJson(summaryUrl);
      const imageUrl = summary?.originalimage?.source || summary?.thumbnail?.source || '';
      if (imageUrl) {
        return {
          imageUrl,
          pageUrl: summary?.content_urls?.desktop?.page || `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          sourceName: 'Wikipedia',
          title
        };
      }
    } catch (error) {
      // continue
    }
  }
  return null;
}

async function searchCommonsPhoto(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json`;
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});
  for (const page of pages) {
    const imageInfo = page?.imageinfo?.[0];
    const imageUrl = imageInfo?.thumburl || imageInfo?.url || '';
    if (imageUrl) {
      return {
        imageUrl,
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`,
        sourceName: 'Wikimedia Commons',
        title: page.title || term
      };
    }
  }
  return null;
}

async function findRepresentativePhoto(w) {
  const queries = buildPhotoQueries(w);
  for (const term of queries) {
    try {
      const wiki = await searchWikipediaPhoto(term);
      if (wiki) return { ...wiki, query: term };
    } catch (error) {
      // continue
    }
    try {
      const commons = await searchCommonsPhoto(term);
      if (commons) return { ...commons, query: term };
    } catch (error) {
      // continue
    }
  }
  return null;
}

async function resolveWonderlandPhoto(id) {
  if (!id) return null;
  if (PHOTO_CACHE.has(id)) return PHOTO_CACHE.get(id);
  const db = readDb();
  const index = db.wonderlands.findIndex((w) => w.id === id);
  if (index === -1) return null;
  const wonderland = db.wonderlands[index];
  if (wonderland.symbolPhotoUrl || wonderland.photoUrl || wonderland.heroImage || wonderland.coverImage) {
    const existing = {
      imageUrl: wonderland.symbolPhotoUrl || wonderland.photoUrl || wonderland.heroImage || wonderland.coverImage,
      pageUrl: wonderland.symbolPhotoPageUrl || wonderland.sourceUrl || '',
      sourceName: wonderland.symbolPhotoSource || 'stored',
      title: wonderland.title || ''
    };
    PHOTO_CACHE.set(id, existing);
    return existing;
  }
  const found = await findRepresentativePhoto(wonderland);
  if (found?.imageUrl) {
    db.wonderlands[index].symbolPhotoUrl = found.imageUrl;
    db.wonderlands[index].symbolPhotoPageUrl = found.pageUrl || '';
    db.wonderlands[index].symbolPhotoSource = found.sourceName || 'Wikipedia';
    db.wonderlands[index].symbolPhotoQuery = found.query || '';
    writeDb(db);
    PHOTO_CACHE.set(id, found);
    return found;
  }
  PHOTO_CACHE.set(id, null);
  return null;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/app') pathname = '/app.html';
  if (pathname === '/login') pathname = '/login.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, { error: 'Forbidden' });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(res, 404, { error: 'Not found' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleAuthApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/auth') {
    return send(res, 200, { authenticated: isAuthenticated(req) });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await parseBody(req);
    if (!body.password || !safeEqual(body.password, APP_PASSWORD)) {
      return send(res, 401, { error: 'パスワードが違います。' });
    }
    return send(res, 200, { ok: true }, 'application/json; charset=utf-8', {
      'Set-Cookie': createSessionCookie(req)
    });
  }

  return false;
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/wonderlands') {
    const db = readDb();
    return send(res, 200, { wonderlands: sortedWonderlands(db) });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return send(res, 200, { ok: true, service: 'jimowan-webapp', version: APP_VERSION });
  }

  if (req.method === 'GET' && pathname === '/api/wonderland-photo') {
    const id = normalizeText(url.searchParams.get('id'));
    if (!id) return send(res, 400, { error: 'id is required' });
    try {
      const photo = await resolveWonderlandPhoto(id);
      return send(res, 200, { photo });
    } catch (error) {
      return send(res, 500, { error: 'photo lookup failed', detail: error.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/wonderlands') {
    const body = await parseBody(req);
    const title = normalizeText(body.title);
    const area = normalizeText(body.area);
    const creator = normalizeText(body.creator, '匿名ワンダーランド登録者');
    const locality = normalizeText(body.locality, area);
    const localities = Array.isArray(body.localities)
      ? body.localities.map((v) => normalizeText(v)).filter(Boolean).slice(0, 5)
      : String(body.locality || '')
        .split(',')
        .map((v) => normalizeText(v))
        .filter(Boolean)
        .slice(0, 5);
    if (!title || !area) {
      return send(res, 400, { error: 'title と area は必須です。' });
    }

    const spots = Array.isArray(body.spots) ? body.spots : [];
    const normalizedSpots = spots
      .filter((s) => normalizeText(s.name))
      .map((s, index) => ({
        name: normalizeText(s.name),
        arrive: normalizeText(s.arrive, index === 0 ? '10:00' : ''),
        depart: normalizeText(s.depart, ''),
        stayMin: Math.max(0, Math.round(normalizeNumber(s.stayMin, 0))),
        walkMin: Math.max(0, Math.round(normalizeNumber(s.walkMin, 0))),
        distanceKm: Math.max(0, Number(normalizeNumber(s.distanceKm, 0).toFixed(2))),
        lat: normalizeNumber(s.lat, 35.681236),
        lng: normalizeNumber(s.lng, 139.767125),
        notes: normalizeText(s.notes, '')
      }));

    if (normalizedSpots.length < 2) {
      return send(res, 400, { error: 'スポットは最低2件登録してください。' });
    }

    const routeLine = Array.isArray(body.routeLine)
      ? body.routeLine
        .map((p) => ({ lat: normalizeNumber(p.lat, NaN), lng: normalizeNumber(p.lng, NaN) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .slice(0, 900)
      : [];

    const idBase = `${title}-${area}-${Date.now()}`;
    const id = crypto.createHash('sha1').update(idBase).digest('hex').slice(0, 12);
    const newWonderland = {
      id,
      title,
      area,
      locality: locality || area,
      localities: localities.length ? localities : [locality || area],
      creator,
      catchCopy: normalizeText(body.catchCopy, '知られていない地元の魅力をつないだワンダーランド。'),
      description: normalizeText(body.description, ''),
      duration: normalizeText(body.duration, ''),
      totalDistanceKm: Number(normalizeNumber(body.totalDistanceKm, normalizedSpots.reduce((sum, s) => sum + s.distanceKm, 0)).toFixed(2)),
      totalWalkingMin: Math.round(normalizeNumber(body.totalWalkingMin, normalizedSpots.reduce((sum, s) => sum + s.walkMin, 0))),
      totalStayMin: Math.round(normalizeNumber(body.totalStayMin, normalizedSpots.reduce((sum, s) => sum + s.stayMin, 0))),
      tags: String(body.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
      coverImage: '',
      createdAt: new Date().toISOString(),
      spots: normalizedSpots,
      routeLine,
      votes: { unknown: 0, surprise: 0, try: 0, voters: 0 }
    };

    const db = readDb();
    db.wonderlands.unshift(newWonderland);
    writeDb(db);
    return send(res, 201, { wonderland: rankingFields(newWonderland) });
  }


  if (req.method === 'POST' && pathname === '/api/wonderlands/bulk') {
    const body = await parseBody(req);
    const items = Array.isArray(body.wonderlands) ? body.wonderlands.slice(0, 600) : [];
    if (!items.length) return send(res, 400, { error: 'wonderlands が空です。' });
    const db = readDb();
    const existingKeys = new Set(db.wonderlands.map((w) => `${String(w.title || '').trim()}::${String(w.area || '').trim()}`));
    const existingIds = new Set(db.wonderlands.map((w) => String(w.id || '')));
    const imported = [];
    const skipped = [];

    for (const body of items) {
      const title = normalizeText(body.title);
      const area = normalizeText(body.area);
      if (!title || !area) { skipped.push({ title, reason: 'title/area missing' }); continue; }
      const key = `${title}::${area}`;
      if (existingKeys.has(key)) { skipped.push({ title, reason: 'duplicate' }); continue; }
      const creator = normalizeText(body.creator, 'KML取込');
      const locality = normalizeText(body.locality, area);
      const localities = Array.isArray(body.localities)
        ? body.localities.map((v) => normalizeText(v)).filter(Boolean).slice(0, 5)
        : [locality].filter(Boolean);
      const normalizedSpots = (Array.isArray(body.spots) ? body.spots : [])
        .filter((s) => normalizeText(s.name))
        .map((s, index) => ({
          name: normalizeText(s.name),
          arrive: normalizeText(s.arrive, index === 0 ? '10:00' : ''),
          depart: normalizeText(s.depart, ''),
          stayMin: Math.max(0, Math.round(normalizeNumber(s.stayMin, 5))),
          walkMin: Math.max(0, Math.round(normalizeNumber(s.walkMin, 0))),
          distanceKm: Math.max(0, Number(normalizeNumber(s.distanceKm, 0).toFixed(2))),
          lat: normalizeNumber(s.lat, 35.681236),
          lng: normalizeNumber(s.lng, 139.767125),
          notes: normalizeText(s.notes, '')
        }))
        .slice(0, 60);
      if (normalizedSpots.length < 2) { skipped.push({ title, reason: 'spots < 2' }); continue; }
      const routeLine = Array.isArray(body.routeLine)
        ? body.routeLine
          .map((p) => ({ lat: normalizeNumber(p.lat, NaN), lng: normalizeNumber(p.lng, NaN) }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .slice(0, 900)
        : [];
      const suppliedId = normalizeText(body.id, '');
      const id = suppliedId && !existingIds.has(suppliedId)
        ? suppliedId
        : crypto.createHash('sha1').update(`${title}-${area}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12);
      existingIds.add(id);
      existingKeys.add(key);
      const votes = body.votes || {};
      const item = {
        id,
        title,
        area,
        locality: locality || area,
        localities: localities.length ? localities : [locality || area],
        creator,
        catchCopy: normalizeText(body.catchCopy, 'KMLから取り込んだ地元ウォーキング・ワンダーランド。'),
        description: normalizeText(body.description, ''),
        duration: normalizeText(body.duration, ''),
        totalDistanceKm: Number(normalizeNumber(body.totalDistanceKm, normalizedSpots.reduce((sum, s) => sum + s.distanceKm, 0)).toFixed(2)),
        totalWalkingMin: Math.round(normalizeNumber(body.totalWalkingMin, normalizedSpots.reduce((sum, s) => sum + s.walkMin, 0))),
        totalStayMin: Math.round(normalizeNumber(body.totalStayMin, normalizedSpots.reduce((sum, s) => sum + s.stayMin, 0))),
        tags: Array.isArray(body.tags) ? body.tags.map((t) => normalizeText(t)).filter(Boolean).slice(0, 12) : String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
        coverImage: '',
        createdAt: normalizeText(body.createdAt, new Date().toISOString()),
        spots: normalizedSpots,
        routeLine,
        votes: {
          unknown: Math.max(0, Math.round(normalizeNumber(votes.unknown, 300))),
          surprise: Math.max(0, Math.round(normalizeNumber(votes.surprise, 300))),
          try: Math.max(0, Math.round(normalizeNumber(votes.try, 300))),
          voters: Math.max(0, Math.round(normalizeNumber(votes.voters, 100)))
        },
        sourceNote: normalizeText(body.sourceNote, 'KML取込'),
        importSource: normalizeText(body.importSource, 'KML')
      };
      db.wonderlands.unshift(item);
      imported.push(rankingFields(item));
    }
    writeDb(db);
    return send(res, 201, { importedCount: imported.length, skippedCount: skipped.length, imported, skipped, wonderlands: sortedWonderlands(db) });
  }

  const voteMatch = pathname.match(/^\/api\/wonderlands\/([^/]+)\/vote$/);
  if (req.method === 'POST' && voteMatch) {
    const id = voteMatch[1];
    const body = await parseBody(req);
    const unknown = clampScore(body.unknown);
    const surprise = clampScore(body.surprise);
    const tryScore = clampScore(body.try);
    const db = readDb();
    const item = db.wonderlands.find((w) => w.id === id);
    if (!item) return send(res, 404, { error: 'Wonderland not found' });
    item.votes = item.votes || { unknown: 0, surprise: 0, try: 0, voters: 0 };
    item.votes.unknown += unknown;
    item.votes.surprise += surprise;
    item.votes.try += tryScore;
    item.votes.voters += 1;
    writeDb(db);
    return send(res, 200, { wonderlands: sortedWonderlands(db), voted: rankingFields(item) });
  }

  return send(res, 404, { error: 'API not found' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // ログアウトはGETで簡単に実行できるようにしています。
    if (req.method === 'GET' && pathname === '/logout') {
      return redirect(res, '/login', { 'Set-Cookie': clearSessionCookie() });
    }

    // 認証APIは未ログインでもアクセス可能。
    if (pathname === '/api/login' || pathname === '/api/auth') {
      const handled = await handleAuthApi(req, res);
      if (handled !== false) return;
    }

    // 未ログインの場合は、LPもアプリもAPIも保護します。
    if (!isAuthenticated(req) && !isPublicPath(pathname)) {
      if (pathname.startsWith('/api/')) {
        return send(res, 401, { error: 'ログインが必要です。' });
      }
      const next = encodeURIComponent(pathname === '/login' ? '/' : req.url);
      return redirect(res, `/login?next=${next}`);
    }

    // ログイン済みでログイン画面を開いた場合はLPへ戻します。
    if (isAuthenticated(req) && (pathname === '/login' || pathname === '/login.html')) {
      const next = url.searchParams.get('next') || '/';
      return redirect(res, next.startsWith('/') ? next : '/');
    }

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (error) {
    send(res, 500, { error: error.message || 'Internal server error' });
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`地元ワンダーランド v16 prefecture locality is running at http://localhost:${PORT}`);
  console.log(`Login password: ${process.env.JIMOWAN_PASSWORD ? 'from JIMOWAN_PASSWORD' : 'jimowan (local default)'}`);
});
