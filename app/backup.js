import { backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './server.js';
import { root } from './config.js';
const app = createApp();
try {
  const directory = join(root, 'backups');
  mkdirSync(directory, { recursive: true });
  const target = join(
    directory,
    `pharmacy-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  );
  await backup(app.store.db, target);
  console.log(`Consistent database snapshot saved: ${target}`);
  console.log(
    'Protect this snapshot with encrypted storage. Keep DATA_KEY separately. See BACKEND.md for restore and retention.',
  );
} finally {
  app.close();
}
