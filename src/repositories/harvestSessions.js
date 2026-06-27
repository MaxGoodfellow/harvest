const pool = require('../db/pool');
const auditLog = require('./auditLog');

const COLUMNS = ['campaign_id', 'name', 'session_date', 'notes'];

async function list() {
  const [rows] = await pool.query(`
    SELECT hs.*, COUNT(ha.id) AS attempt_count
    FROM harvest_sessions hs
    LEFT JOIN harvest_attempts ha ON ha.harvest_session_id = hs.id
    GROUP BY hs.id
    ORDER BY hs.session_date DESC, hs.id DESC
  `);
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM harvest_sessions WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO harvest_sessions (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  await auditLog.record('harvest_session', result.insertId, 'create', null, data);
  return result.insertId;
}

async function update(id, data) {
  const before = await getById(id);
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  if (cols.length) {
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE harvest_sessions SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  await auditLog.record('harvest_session', id, 'update', before, data);
}

module.exports = { COLUMNS, list, getById, create, update };
