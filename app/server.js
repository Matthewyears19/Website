import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { business, root } from './config.js';
import { openStore, hash, token, passwordHash, passwordMatches } from './store.js';
import { page, layout, adminPage, escape } from './pages.js';
import { fail, email, text, validateContent, validateForm } from './validation.js';

export function createApp(options = {}) {
  const mode = options.mode ?? process.env.APP_MODE ?? 'demo';
  const port = Number(options.port ?? process.env.PORT ?? 4173);
  const origin = options.origin ?? process.env.SITE_ORIGIN ?? `http://127.0.0.1:${port}`;
  const mailMode = options.mailMode ?? process.env.MAIL_MODE ?? 'preview';
  if (!['demo', 'test', 'live'].includes(mode) || !['preview', 'resend'].includes(mailMode))
    throw new Error('Invalid application or email mode.');
  if (mode === 'demo' && mailMode !== 'preview')
    throw new Error('Demo mode cannot send email. Use test mode.');
  const recipient = mode === 'live' ? business.email : process.env.TEST_EMAIL;
  if (
    mode === 'live' &&
    (process.env.LAUNCH_APPROVED !== 'yes' ||
      mailMode !== 'resend' ||
      !origin.startsWith('https://'))
  )
    throw new Error('Live launch requires approval, HTTPS and configured email.');
  if (
    mailMode === 'resend' &&
    (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM || !recipient)
  )
    throw new Error('Email sender, API key and recipient are required.');
  if (mode === 'test' && mailMode === 'resend') email(recipient);
  const directory = options.directory ?? process.env.DATA_DIR ?? path.join(root, 'data');
  mkdirSync(directory, { recursive: true });
  const keyFile = path.join(directory, 'local-key');
  let key = options.key ?? (process.env.DATA_KEY ? Buffer.from(process.env.DATA_KEY, 'hex') : null);
  if (!key) {
    if (mode !== 'demo')
      throw new Error('Set DATA_KEY to 64 random hex characters outside demo mode.');
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32), { mode: 0o600 });
    key = readFileSync(keyFile);
  }
  if (key.length !== 32) throw new Error('DATA_KEY must contain 32 bytes.');
  const store = openStore(path.join(directory, 'pharmacy.sqlite'), key);
  const { db } = store;
  const retentionDays = Number(process.env.RETENTION_DAYS ?? 7);
  if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 30)
    throw new Error('RETENTION_DAYS must be 1–30.');
  const formTokens = new Map(),
    rates = new Map();
  const secure = origin.startsWith('https://');
  const cookie = (value, maxAge) =>
    `moston_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const session = (req) => {
    const raw = /(?:^|;\s*)moston_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? '',
    )?.[1];
    return raw
      ? db
          .prepare(
            'SELECT sessions.*,users.name,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>? AND users.active=1',
          )
          .get(hash(raw), Date.now())
      : null;
  };
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type });
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  };
  const rate = (req, group, max) => {
    const k = group + ':' + req.socket.remoteAddress;
    const now = Date.now();
    let r = rates.get(k);
    if (!r || r.until < now) {
      r = { count: 0, until: now + 15 * 60 * 1000 };
      rates.set(k, r);
    }
    if (++r.count > max) fail('Too many attempts. Please wait 15 minutes and try again.', 429);
  };
  async function body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 80000) fail('Request too large.', 413);
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    try {
      if ((req.headers['content-type'] ?? '').startsWith('application/json'))
        return JSON.parse(raw);
      if ((req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded'))
        return Object.fromEntries(new URLSearchParams(raw));
    } catch {
      fail('Invalid request.');
    }
    fail('Unsupported request format.', 415);
  }
  let working = false;
  async function flush() {
    if (working) return;
    working = true;
    try {
      const now = Date.now();
      // Payloads expire even if delivery fails. Metadata remains for troubleshooting.
      db.prepare(
        "UPDATE outbox SET payload=NULL,state=CASE WHEN state='pending' THEN 'expired' ELSE state END WHERE created<? AND payload IS NOT NULL",
      ).run(now - retentionDays * 86400000);
      db.prepare('DELETE FROM outbox WHERE created<?').run(now - 30 * 86400000);
      db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
      for (const [k, v] of formTokens) if (v < now) formTokens.delete(k);
      for (const [k, v] of rates) if (v.until < now) rates.delete(k);
      if (mailMode !== 'resend') return;
      const rows = db
        .prepare("SELECT * FROM outbox WHERE state='pending' AND next_attempt<=? LIMIT 10")
        .all(now);
      for (const row of rows) {
        // Provider deduplication expires after 24h. Stop automatic retries before then.
        if (now - row.created > 23 * 3600000) {
          db.prepare("UPDATE outbox SET state='needs-review' WHERE id=?").run(row.id);
          continue;
        }
        const data = store.decrypt(row.payload);
        try {
          const response = await (options.deliveryFetch ?? fetch)('https://api.resend.com/emails', {
            method: 'POST',
            signal: AbortSignal.timeout(15000),
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': row.id,
            },
            body: JSON.stringify({
              from: process.env.MAIL_FROM,
              to: [recipient],
              reply_to: data.email,
              subject: `${mode === 'test' ? '[TEST] ' : ''}Moston Pharmacy: ${row.kind === 'prescription' ? 'prescription registration' : 'website enquiry'} (${row.id.slice(0, 8)})`,
              text: Object.entries(data)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n\n'),
            }),
          });
          if (!response.ok) throw new Error('Delivery provider rejected request');
          const result = await response.json();
          // Provider acceptance is not evidence that the recipient received the email.
          db.prepare(
            "UPDATE outbox SET state='accepted',payload=NULL,provider_id=?,attempts=attempts+1 WHERE id=?",
          ).run(String(result.id ?? ''), row.id);
        } catch {
          db.prepare('UPDATE outbox SET attempts=attempts+1,next_attempt=? WHERE id=?').run(
            now + Math.min(3600000, 60000 * 2 ** Math.min(row.attempts, 6)),
            row.id,
          );
        }
      }
    } finally {
      working = false;
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    );
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    if (mode !== 'live') res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    try {
      const pathname = new URL(req.url, origin).pathname;
      if (req.method === 'POST') {
        if (req.headers.origin !== origin) fail('This request did not come from the website.', 403);
        if (pathname === '/api/login') {
          rate(req, 'login', 10);
          const d = await body(req);
          const address = email(d.email);
          const pw = text(d.password, 'password', 200);
          const u = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(address);
          // Do equivalent password work for unknown accounts.
          const fallback = passwordHash('unused-local-comparison', 'fixed-salt-for-timing');
          if (!passwordMatches(pw, u?.password ?? fallback) || !u)
            fail('Email or password was not recognised.', 401);
          const t = token(),
            csrf = token();
          db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
            hash(t),
            u.id,
            csrf,
            Date.now() + 8 * 3600000,
          );
          res.setHeader('Set-Cookie', cookie(t, 8 * 3600));
          return send(res, 200, { ok: true });
        }
        if (pathname.startsWith('/api/forms/')) {
          rate(req, 'forms', 10);
          const d = await body(req);
          if (d.website) fail('Unable to accept this submission.');
          if (typeof d.csrf !== 'string' || (formTokens.get(d.csrf) ?? 0) < Date.now())
            fail('Your form expired. Reload this page and try again.', 403);
          if (typeof d.submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(d.submissionId))
            fail('Invalid submission reference.');
          const kind = pathname.split('/').pop(),
            clean = validateForm(kind, d);
          const existing = db.prepare('SELECT id FROM outbox WHERE id=?').get(d.submissionId);
          if (!existing)
            db.prepare(
              'INSERT INTO outbox(id,kind,payload,state,created,next_attempt) VALUES(?,?,?,?,?,?)',
            ).run(
              d.submissionId,
              kind,
              store.encrypt(clean),
              mailMode === 'preview' ? 'preview' : 'pending',
              Date.now(),
              Date.now(),
            );
          const message =
            mailMode === 'preview'
              ? 'Demonstration saved locally. No email has been sent.'
              : `Your ${kind === 'prescription' ? 'registration request' : 'message'} has been received for processing. Reference: ${d.submissionId.slice(0, 8)}. This does not confirm a prescription or delivery.`;
          if ((req.headers.accept ?? '').includes('application/json'))
            return send(res, 200, { ok: true, message });
          return send(
            res,
            200,
            layout(
              'Request received',
              `<section class="section"><div class="wrap narrow"><h1>Thank you</h1><p>${escape(message)}</p><a href="/">Return home</a></div></section>`,
              { mode },
            ),
            'text/html; charset=utf-8',
          );
        }
        const s = session(req);
        if (!s) fail('Please sign in.', 401);
        if (req.headers['x-csrf-token'] !== s.csrf) fail('Please reload and try again.', 403);
        if (pathname === '/api/logout') {
          db.prepare('DELETE FROM sessions WHERE token=?').run(s.token);
          res.setHeader('Set-Cookie', cookie('', 0));
          return send(res, 200, { ok: true });
        }
        if (pathname === '/api/content') {
          store.saveContent(validateContent(await body(req)), s.user_id);
          return send(res, 200, store.content());
        }
        fail('Not found.', 404);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') fail('Method not allowed.', 405);
      if (pathname === '/api/admin') {
        const s = session(req);
        if (!s) fail('Please sign in.', 401);
        return send(res, 200, {
          user: { name: s.name, email: s.email },
          csrf: s.csrf,
          content: store.content(),
          queue: db.prepare('SELECT state,COUNT(*) AS count FROM outbox GROUP BY state').all(),
          audit: db
            .prepare(
              'SELECT audit.at,users.name,audit.action FROM audit LEFT JOIN users ON users.id=audit.user_id ORDER BY audit.id DESC LIMIT 10',
            )
            .all(),
        });
      }
      if (pathname === '/health') return send(res, 200, { ok: true });
      const assets = {
        '/public/site.css': ['site.css', 'text/css'],
        '/public/site.js': ['site.js', 'text/javascript'],
        '/public/admin.js': ['admin.js', 'text/javascript'],
        '/public/logo.png': ['logo.png', 'image/png'],
        '/public/favicon.png': ['favicon.png', 'image/png'],
        '/public/BMI.webp': ['BMI.webp', 'image/webp'],
      };
      if (assets[pathname]) {
        const [file, type] = assets[pathname];
        return send(res, 200, readFileSync(path.join(root, 'public', file)), type);
      }
      const redirects = {
        '/index.html': '/',
        '/index.php': '/',
        '/contact.html': '/contact',
        '/findus.html': '/find-us',
        '/Weight.html': '/weight-management',
        '/PharmacyFirst.html': '/pharmacy-first',
        '/prescription%20delivery.html': '/prescriptions',
        '/team.html': '/contact',
        '/form.php': '/prescriptions',
        '/services.php': '/#services',
        '/complaints.php': '/complaints',
      };
      if (redirects[pathname]) {
        res.writeHead(301, { Location: redirects[pathname] });
        return res.end();
      }
      if (pathname === '/robots.txt')
        return send(
          res,
          200,
          mode === 'live'
            ? 'User-agent: *\nDisallow: /admin\nDisallow: /api/'
            : 'User-agent: *\nDisallow: /',
          'text/plain',
        );
      let html = pathname === '/admin' ? adminPage(mode) : page(pathname, store.content(), mode);
      if (!html)
        return send(
          res,
          404,
          layout(
            'Page not found',
            '<section class="section"><div class="wrap"><h1>We couldn’t find that page.</h1><a href="/">Return to the homepage</a></div></section>',
            { mode },
          ),
          'text/html; charset=utf-8',
        );
      if (html.includes('__FORM_CSRF__')) {
        if (formTokens.size > 10000) fail('Please try again shortly.', 503);
        const t = token();
        formTokens.set(t, Date.now() + 3600000);
        html = html.replace('__FORM_CSRF__', t).replace('__SUBMISSION_ID__', token());
      }
      return send(res, 200, html, 'text/html; charset=utf-8');
    } catch (e) {
      const status = e.status ?? 500;
      const message =
        status === 500
          ? 'Something went wrong. Please try again, or call the pharmacy.'
          : e.message;
      send(res, status, { error: message });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  const timer = setInterval(
    () =>
      flush().catch(() =>
        console.error('Queue maintenance failed; check storage and configuration.'),
      ),
    30000,
  );
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return {
    server,
    store,
    flush,
    mode,
    origin,
    close: () => {
      clearInterval(timer);
      db.close();
    },
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', () =>
    console.log(`Moston preview: ${app.origin} (${app.mode})`),
  );
}
