import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createApp } from '../app/server.js';
import { passwordHash } from '../app/store.js';
import { validateForm, validateContent } from '../app/validation.js';
import { seed } from '../app/config.js';
import { backup, DatabaseSync } from 'node:sqlite';
test('validation rejects invalid dates, missing authorisation and invalid prices', () => {
  assert.throws(() =>
    validateForm('prescription', {
      email: 'test@example.com',
      phone: '01234567890',
      title: 'Ms',
      firstName: 'Fictional',
      lastName: 'Patient',
      address: 'Test address',
      postcode: 'CW11 3PA',
      doctor: 'Test Doctor',
      surgery: 'Test Surgery',
      surgeryPostcode: 'CW11 3PA',
      dob: '2024-02-30',
      authorisation: 'yes',
    }),
  );
  assert.throws(() =>
    validateContent({
      ...seed,
      revision: 1,
      prices: [{ id: 'a', product: 'Test', dose: 'Test', price: -1 }],
    }),
  );
  assert.throws(() =>
    validateContent({
      ...seed,
      revision: 1,
      prices: [{ id: 'a', product: 'Test', dose: 'Test', price: 1.001 }],
    }),
  );
});
test('pages, account controls, publishing, form validation, encrypted queue and retention', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moston-test-'));
  const app = createApp({
    directory,
    key: randomBytes(32),
    origin: 'http://127.0.0.1:4173',
    mode: 'demo',
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (url, options = {}) => fetch(base + url, options);
  const post = (url, data, extra = {}) =>
    request(url, {
      method: 'POST',
      headers: {
        Origin: app.origin,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extra,
      },
      body: JSON.stringify(data),
    });
  try {
    for (const path of [
      '/',
      '/weight-management',
      '/prescriptions',
      '/contact',
      '/find-us',
      '/pharmacy-first',
      '/privacy',
      '/complaints',
      '/admin',
    ]) {
      const r = await request(path);
      assert.equal(r.status, 200, path);
      assert.ok(r.headers.get('content-security-policy'));
      const html = await r.text();
      assert.ok(html.includes('<main id="main">'));
      assert.ok(!html.includes('your-handle'));
      assert.ok(!html.includes('formspree.io'));
    }
    assert.equal((await request('/public/site.css')).status, 200);
    for (const secret of [
      '/app/server.js',
      '/data/pharmacy.sqlite',
      '/.env',
      '/content/pharmacist-copy.json',
    ])
      assert.equal((await request(secret)).status, 404);
    assert.equal((await request('/api/admin')).status, 401);
    app.store.db
      .prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')
      .run('Test Editor', 'editor@example.com', passwordHash('a-long-fictional-password'));
    assert.equal(
      (await post('/api/login', { email: 'editor@example.com', password: 'wrong' })).status,
      401,
    );
    const login = await post('/api/login', {
      email: 'editor@example.com',
      password: 'a-long-fictional-password',
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const admin = await (await request('/api/admin', { headers: { Cookie: cookie } })).json();
    assert.equal(admin.user.name, 'Test Editor');
    const headers = { Cookie: cookie, 'X-CSRF-Token': admin.csrf };
    const updated = structuredClone(admin.content);
    updated.prices[0].price = 201.25;
    updated.news[0].title = '<script>alert(1)</script>';
    assert.equal((await post('/api/content', updated, { Cookie: cookie })).status, 403);
    assert.equal(
      (await post('/api/content', updated, { ...headers, Origin: 'https://evil.example' })).status,
      403,
    );
    assert.equal((await post('/api/content', updated, headers)).status, 200);
    assert.equal((await post('/api/content', updated, headers)).status, 409);
    const home = await (await request('/')).text();
    assert.ok(home.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!home.includes('<script>alert(1)</script>'));
    assert.ok((await (await request('/weight-management')).text()).includes('£201.25'));
    const html = await (await request('/contact')).text();
    const csrf = /name="csrf" value="([a-f0-9]+)"/.exec(html)[1],
      submissionId = /name="submissionId" value="([a-f0-9]+)"/.exec(html)[1];
    const form = {
      csrf,
      submissionId,
      name: 'Fictional Person',
      email: 'fictional@example.com',
      phone: '',
      message: "Test only'); DROP TABLE users; --",
    };
    assert.equal((await post('/api/forms/contact', { ...form, email: 'bad' })).status, 400);
    assert.equal((await post('/api/forms/contact', { ...form, csrf: 'bad' })).status, 403);
    assert.equal((await post('/api/forms/contact', form)).status, 200);
    assert.equal((await post('/api/forms/contact', form)).status, 200);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n, 1);
    const row = app.store.db.prepare('SELECT * FROM outbox').get();
    assert.equal(row.state, 'preview');
    assert.ok(!row.payload.includes('Fictional'));
    assert.equal(app.store.decrypt(row.payload).name, 'Fictional Person');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
    const phtml = await (await request('/prescriptions')).text();
    const pform = {
      csrf: /name="csrf" value="([a-f0-9]+)"/.exec(phtml)[1],
      submissionId: /name="submissionId" value="([a-f0-9]+)"/.exec(phtml)[1],
      title: 'Ms',
      firstName: 'Fictional',
      lastName: 'Patient',
      dob: '1990-01-01',
      address: 'Fictional address',
      postcode: 'CW11 3PA',
      phone: '01234567890',
      email: 'fictional@example.com',
      doctor: 'Test Doctor',
      surgery: 'Test Surgery',
      surgeryPostcode: 'CW11 3PA',
    };
    assert.equal((await post('/api/forms/prescription', pform)).status, 400);
    assert.equal(
      (await post('/api/forms/prescription', { ...pform, authorisation: 'yes' })).status,
      200,
    );
    app.store.db.prepare('UPDATE outbox SET created=?').run(Date.now() - 8 * 86400000);
    await app.flush();
    assert.equal(
      app.store.db.prepare('SELECT COUNT(*) AS n FROM outbox WHERE payload IS NOT NULL').get().n,
      0,
    );
    assert.equal((await post('/api/logout', {}, headers)).status, 200);
    assert.equal((await request('/api/admin', { headers: { Cookie: cookie } })).status, 401);
    const snapshot = join(directory, 'snapshot.sqlite');
    await backup(app.store.db, snapshot);
    const restored = new DatabaseSync(snapshot);
    assert.equal(
      JSON.parse(restored.prepare('SELECT body FROM content').get().body).prices[0].price,
      201.25,
    );
    assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    restored.close();
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'moston-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
test('email test routing, durable retries, provider acceptance and deduplication window', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moston-test-'));
  const before = { ...process.env };
  Object.assign(process.env, {
    RESEND_API_KEY: 'fake-unit-test-key',
    MAIL_FROM: 'test@example.com',
    TEST_EMAIL: 'fictional-recipient@example.com',
  });
  let attempts = 0;
  const sent = [];
  const app = createApp({
    directory,
    key: randomBytes(32),
    mode: 'test',
    mailMode: 'resend',
    deliveryFetch: async (url, request) => {
      attempts++;
      sent.push(JSON.parse(request.body));
      return attempts === 1
        ? new Response('{}', { status: 503 })
        : new Response('{"id":"fake-provider-id"}', { status: 200 });
    },
  });
  try {
    app.store.db
      .prepare('INSERT INTO outbox(id,kind,payload,state,created,next_attempt) VALUES(?,?,?,?,?,?)')
      .run(
        'test-id',
        'contact',
        app.store.encrypt({ email: 'fictional@example.com', message: 'Fictional test' }),
        'pending',
        Date.now(),
        Date.now(),
      );
    await app.flush();
    let row = app.store.db.prepare('SELECT * FROM outbox').get();
    assert.equal(row.state, 'pending');
    assert.equal(row.attempts, 1);
    assert.ok(row.payload);
    assert.ok(row.next_attempt > Date.now());
    app.store.db.prepare('UPDATE outbox SET next_attempt=0').run();
    await app.flush();
    row = app.store.db.prepare('SELECT * FROM outbox').get();
    assert.equal(row.state, 'accepted');
    assert.equal(row.payload, null);
    assert.equal(row.provider_id, 'fake-provider-id');
    assert.deepEqual(sent[0].to, ['fictional-recipient@example.com']);
    assert.ok(sent[0].subject.startsWith('[TEST]'));
    await app.flush();
    assert.equal(attempts, 2);
    app.store.db
      .prepare('INSERT INTO outbox(id,kind,payload,state,created,next_attempt) VALUES(?,?,?,?,?,?)')
      .run(
        'old-test',
        'contact',
        app.store.encrypt({ email: 'fictional@example.com' }),
        'pending',
        Date.now() - 24 * 3600000,
        0,
      );
    await app.flush();
    assert.equal(
      app.store.db.prepare('SELECT state FROM outbox WHERE id=?').get('old-test').state,
      'needs-review',
    );
    assert.equal(attempts, 2);
  } finally {
    app.close();
    for (const key of ['RESEND_API_KEY', 'MAIL_FROM', 'TEST_EMAIL']) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'moston-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
