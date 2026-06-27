require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function main() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const file = path.join(BACKUPS_DIR, `harvest_${timestamp()}.sql`);

  // Password via MYSQL_PWD env var rather than -p<password>, which would be
  // visible to other local users via `ps`. --set-gtid-purged=OFF skips the
  // SET @@GLOBAL.GTID_PURGED / SET @@SESSION.SQL_LOG_BIN statements mysqldump
  // adds by default — restoring those back into a GTID-aware server (or as a
  // non-SUPER user) fails otherwise, and this app has no replication to
  // preserve GTID state for in the first place.
  const result = spawnSync(
    'mysqldump',
    [
      '-h', process.env.DB_HOST,
      '-P', process.env.DB_PORT,
      '-u', process.env.DB_USER,
      '--set-gtid-purged=OFF',
      process.env.DB_NAME,
    ],
    { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD } }
  );

  if (result.error) {
    console.error('Failed to run mysqldump — is it installed and on PATH?', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }

  fs.writeFileSync(file, result.stdout);
  console.log(`Backup written to ${file}`);
}

main();
