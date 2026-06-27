const pool = require('../db/pool');
const auditLog = require('./auditLog');

const COLUMNS = [
  'harvest_attempt_id', 'component_id', 'creature_id', 'campaign_id', 'location_id',
  'name', 'quality', 'crafting_value_cp', 'status', 'condition', 'preserved_until', 'notes',
];

const STATUSES = ['available', 'sold', 'used', 'spoiled', 'destroyed', 'gifted', 'quest_item'];

async function list({ status, campaignId, locationId, includeArchived = false } = {}) {
  const where = [];
  const params = [];
  if (!includeArchived) where.push('mi.archived_at IS NULL');
  if (status) {
    where.push('mi.status = ?');
    params.push(status);
  }
  if (campaignId) {
    where.push('mi.campaign_id = ?');
    params.push(campaignId);
  }
  if (locationId) {
    where.push('mi.location_id = ?');
    params.push(locationId);
  }

  const [rows] = await pool.query(
    `SELECT mi.*, cr.name AS creature_name
     FROM materials_inventory mi
     LEFT JOIN creatures cr ON cr.id = mi.creature_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY mi.created_at DESC`,
    params
  );
  return rows;
}

async function getById(id, { includeArchived = false } = {}) {
  const where = includeArchived ? 'mi.id = ?' : 'mi.id = ? AND mi.archived_at IS NULL';
  const [rows] = await pool.query(
    `SELECT mi.*, cr.name AS creature_name FROM materials_inventory mi
     LEFT JOIN creatures cr ON cr.id = mi.creature_id
     WHERE ${where}`,
    [id]
  );
  return rows[0] || null;
}

async function create(data) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO materials_inventory (${colList}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  await auditLog.record('materials_inventory', result.insertId, 'create', null, data);
  return result.insertId;
}

async function update(id, data) {
  const before = await getById(id, { includeArchived: true });
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  if (cols.length) {
    const setClause = cols.map((c) => `\`${c}\` = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE materials_inventory SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  await auditLog.record('materials_inventory', id, 'update', before, data);
}

async function archive(id) {
  const before = await getById(id, { includeArchived: true });
  await pool.query('UPDATE materials_inventory SET archived_at = NOW() WHERE id = ?', [id]);
  await auditLog.record('materials_inventory', id, 'update', before, { archived: true });
}

async function unarchive(id) {
  await pool.query('UPDATE materials_inventory SET archived_at = NULL WHERE id = ?', [id]);
  await auditLog.record('materials_inventory', id, 'update', null, { archived: false });
}

module.exports = { COLUMNS, STATUSES, list, getById, create, update, archive, unarchive };
