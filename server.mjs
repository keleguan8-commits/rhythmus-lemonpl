import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';
import { timingSafeEqual } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const prod = process.env.NODE_ENV === 'production';
const envFile = path.join(root, prod ? '.env.production.local' : '.env.development.local');
try {
  const content = await readFile(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      try { process.env[match[1]] = JSON.parse(match[2]); } catch { process.env[match[1]] = match[2]; }
    }
  }
} catch { /* required fields are validated below */ }
const required = ['TIDB_HOST', 'TIDB_PORT', 'TIDB_DATABASE', 'TIDB_USERNAME', 'TIDB_PASSWORD'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) throw new Error(`缺少数据库配置：${missing.join(', ')}`);
if (prod && !process.env.LIBRARY_ACCESS_KEY) throw new Error('生产运行缺少 LIBRARY_ACCESS_KEY，拒绝公开资料接口');

const pool = createPool({ host: process.env.TIDB_HOST, port: Number(process.env.TIDB_PORT),
  user: process.env.TIDB_USERNAME, password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE, connectionLimit: 5, charset: 'utf8mb4' });
await pool.query('SELECT 1');
await pool.query(`CREATE TABLE IF NOT EXISTS library_materials (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  section VARCHAR(20) NOT NULL DEFAULT 'study',
  source_url VARCHAR(2000) NOT NULL DEFAULT '',
  tags VARCHAR(240) NOT NULL DEFAULT '',
  body MEDIUMTEXT NOT NULL,
  highlights MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);
const [sectionColumns] = await pool.query("SHOW COLUMNS FROM library_materials LIKE 'section'");
if (!sectionColumns.length) await pool.query("ALTER TABLE library_materials ADD COLUMN section VARCHAR(20) NOT NULL DEFAULT 'study'");
console.log('资料库数据库连接正常');

function json(response, code, value) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function input(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk.toString('utf8');
    if (text.length > 2_000_000) { const error = new Error('资料正文超过 2 MB 限制'); error.status = 413; throw error; }
  }
  let data;
  try { data = JSON.parse(text); } catch { const error = new Error('请求内容不是有效 JSON'); error.status = 400; throw error; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { const error = new Error('请求格式错误'); error.status = 400; throw error; }
  const fields = ['title', 'kind', 'section', 'source_url', 'tags', 'body', 'highlights'];
  const item = Object.fromEntries(fields.map(key => [key, data[key]]));
  if (fields.some(key => typeof item[key] !== 'string') || !item.title.trim() || item.title.length > 160
    || !['article', 'book', 'course', 'note'].includes(item.kind) || !['study', 'ideas', 'methods'].includes(item.section) || item.source_url.length > 2000
    || item.tags.length > 240 || item.body.length > 900_000 || item.highlights.length > 900_000) {
    const error = new Error('资料字段不完整或长度超限'); error.status = 400; throw error;
  }
  if (item.source_url) {
    try { if (!['http:', 'https:'].includes(new URL(item.source_url).protocol)) throw new Error(); }
    catch { const error = new Error('来源链接必须是有效的 HTTP(S) 地址'); error.status = 400; throw error; }
  }
  item.title = item.title.trim(); return item;
}
function authorized(request) {
  if (!process.env.LIBRARY_ACCESS_KEY) return true; // development on loopback only
  let supplied = '';
  const authorization = request.headers.authorization || '';
  if (authorization.startsWith('Basic ')) {
    try { supplied = Buffer.from(authorization.slice(6), 'base64').toString('utf8').split(':').slice(1).join(':'); }
    catch { return false; }
  }
  const a = Buffer.from(supplied), b = Buffer.from(process.env.LIBRARY_ACCESS_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}
const columns = 'id,title,kind,section,source_url,tags,body,highlights,created_at,updated_at';
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'],
  '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'],
  '/library.js': ['library.js', 'text/javascript'] };
const server = http.createServer(async (request, response) => {
  try {
    const requested = new URL(request.url, 'http://localhost');
    const route = requested.pathname;
    if (!authorized(request)) {
      response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Library"', 'Cache-Control': 'no-store' });
      response.end('Authentication required'); return;
    }
    if (route.startsWith('/api/library')) {
      if (route === '/api/library' && request.method === 'GET') {
        const section = requested.searchParams.get('section') || 'study';
        if (!['study', 'ideas', 'methods'].includes(section)) return json(response, 400, { error: '无效分区' });
        const kind = requested.searchParams.get('kind') || 'all';
        if (!['all', 'article', 'book', 'course', 'note'].includes(kind)) return json(response, 400, { error: '无效类型' });
        const q = (requested.searchParams.get('q') || '').slice(0, 120);
        const page = Math.max(1, Math.min(100000, Number(requested.searchParams.get('page')) || 1));
        const where = ['section=?'], args = [section];
        if (kind !== 'all' && section === 'study') { where.push('kind=?'); args.push(kind); }
        if (q) {
          where.push('(title LIKE ? OR tags LIKE ? OR body LIKE ? OR highlights LIKE ?)');
          const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
          args.push(pattern, pattern, pattern, pattern);
        }
        const condition = where.join(' AND ');
        const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM library_materials WHERE ${condition}`, args);
        const [items] = await pool.execute(`SELECT id,title,kind,section,tags,updated_at FROM library_materials WHERE ${condition} ORDER BY updated_at DESC,id DESC LIMIT 30 OFFSET ${(page - 1) * 30}`, args);
        return json(response, 200, { items, total: Number(count.total), page });
      }
      if (route === '/api/library' && request.method === 'POST') {
        const item = await input(request), id = crypto.randomUUID();
        await pool.execute('INSERT INTO library_materials (id,title,kind,section,source_url,tags,body,highlights) VALUES (?,?,?,?,?,?,?,?)',
          [id, item.title, item.kind, item.section, item.source_url, item.tags, item.body, item.highlights]);
        const [[saved]] = await pool.execute(`SELECT ${columns} FROM library_materials WHERE id=?`, [id]);
        return json(response, 201, { item: saved });
      }
      const match = route.match(/^\/api\/library\/([\da-f-]{36})$/i);
      if (match && request.method === 'GET') {
        const [[item]] = await pool.execute(`SELECT ${columns} FROM library_materials WHERE id=?`, [match[1]]);
        return json(response, item ? 200 : 404, item ? { item } : { error: '资料不存在' });
      }
      if (match && request.method === 'PUT') {
        const item = await input(request);
        const [result] = await pool.execute('UPDATE library_materials SET title=?,kind=?,section=?,source_url=?,tags=?,body=?,highlights=? WHERE id=?',
          [item.title, item.kind, item.section, item.source_url, item.tags, item.body, item.highlights, match[1]]);
        if (!result.affectedRows) return json(response, 404, { error: '资料不存在' });
        const [[saved]] = await pool.execute(`SELECT ${columns} FROM library_materials WHERE id=?`, [match[1]]);
        return json(response, 200, { item: saved });
      }
      if (match && request.method === 'DELETE') {
        const [result] = await pool.execute('DELETE FROM library_materials WHERE id=?', [match[1]]);
        return json(response, result.affectedRows ? 200 : 404, result.affectedRows ? { ok: true } : { error: '资料不存在' });
      }
      return json(response, 404, { error: '接口不存在' });
    }
    if (!['GET', 'HEAD'].includes(request.method) || !files[route]) return json(response, 404, { error: '页面不存在' });
    const [filename, mime] = files[route]; const content = await readFile(path.join(root, filename));
    response.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (!error.status) console.error('资料库请求失败', error.message);
    json(response, error.status || 500, { error: error.status ? error.message : '服务器处理失败，请稍后重试' });
  }
});
const host = prod ? '0.0.0.0' : '127.0.0.1';
const port = Number(process.env.PORT || (prod ? 80 : 9999));
server.listen(port, host, () => console.log(`Local: http://${host}:${port}`));
