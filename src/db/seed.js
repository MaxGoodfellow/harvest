require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SEEDS_DIR = path.join(__dirname, '..', '..', 'db', 'seeds');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_'))
    .sort();

  await connection.beginTransaction();
  try {
    for (const file of files) {
      console.log(`Seeding ${file}...`);
      const seed = require(path.join(SEEDS_DIR, file));
      await seed(connection);
    }
    await connection.commit();
    console.log('Seed complete.');
  } catch (err) {
    await connection.rollback();
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
