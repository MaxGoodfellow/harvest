const pool = require('../db/pool');

async function listAll() {
  const [rows] = await pool.query('SELECT * FROM harvest_tags ORDER BY name');
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM harvest_tags WHERE id = ?', [id]);
  return rows[0] || null;
}

async function getByName(name) {
  const [rows] = await pool.query('SELECT * FROM harvest_tags WHERE name = ?', [name]);
  return rows[0] || null;
}

module.exports = { listAll, getById, getByName };
