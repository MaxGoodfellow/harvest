require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run db:restore -- <backup-file.sql>');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(file, 'utf8');
  const result = spawnSync(
    'mysql',
    ['-h', process.env.DB_HOST, '-P', process.env.DB_PORT, '-u', process.env.DB_USER, process.env.DB_NAME],
    { input: sql, encoding: 'utf8', env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD } }
  );

  if (result.error) {
    console.error('Failed to run mysql — is it installed and on PATH?', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(1);
  }

  console.log(`Restored ${process.env.DB_NAME} from ${file}`);
}

main();
