const pool = require('../db/pool');

const SELECT_BASE = `
  SELECT ha.*, cr.name AS creature_name, c.name AS component_name,
    sr.name AS signature_row_name, s.name AS skill_name
  FROM harvest_attempts ha
  JOIN creatures cr ON cr.id = ha.creature_id
  LEFT JOIN components c ON c.id = ha.component_id
  LEFT JOIN signature_rows sr ON sr.id = ha.signature_row_id
  LEFT JOIN skills s ON s.id = ha.skill_id
`;

async function list({ sessionId, creatureId } = {}) {
  const where = [];
  const params = [];
  if (sessionId !== undefined) {
    where.push(sessionId === null ? 'ha.harvest_session_id IS NULL' : 'ha.harvest_session_id = ?');
    if (sessionId !== null) params.push(sessionId);
  }
  if (creatureId) {
    where.push('ha.creature_id = ?');
    params.push(creatureId);
  }
  const [rows] = await pool.query(
    `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ha.attempted_at DESC`,
    params
  );
  return rows;
}

async function assignSession(id, sessionId) {
  await pool.query('UPDATE harvest_attempts SET harvest_session_id = ? WHERE id = ?', [
    sessionId || null,
    id,
  ]);
}

module.exports = { list, assignSession };
