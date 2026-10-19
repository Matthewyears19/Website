// Account provisioning stays on the server, outside the public staff editor.
import { createApp } from './server.js';
import { passwordHash } from './store.js';
import { email, text } from './validation.js';
const [action, address, name] = process.argv.slice(2);
if (!['add', 'disable', 'reset'].includes(action) || !address)
  throw new Error(
    'Usage: node --env-file-if-exists=.env app/accounts.js add|disable|reset email "Name". Set STAFF_PASSWORD through the environment for add/reset.',
  );
const app = createApp();
try {
  const e = email(address);
  if (action === 'disable') {
    app.store.db.prepare('UPDATE users SET active=0 WHERE email=?').run(e);
    app.store.db
      .prepare('DELETE FROM sessions WHERE user_id IN(SELECT id FROM users WHERE email=?)')
      .run(e);
  } else {
    const p = process.env.STAFF_PASSWORD ?? '';
    if (p.length < 14 || p.length > 200)
      throw new Error('Use a unique password of 14–200 characters.');
    if (action === 'add')
      app.store.db
        .prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)')
        .run(text(name, 'name'), e, passwordHash(p));
    else {
      app.store.db.prepare('UPDATE users SET password=? WHERE email=?').run(passwordHash(p), e);
      app.store.db
        .prepare('DELETE FROM sessions WHERE user_id IN(SELECT id FROM users WHERE email=?)')
        .run(e);
    }
  }
  console.log('Account operation completed.');
} finally {
  app.close();
}
