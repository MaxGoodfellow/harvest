const pool = require('../db/pool');
const auditLog = require('./auditLog');

const COLUMNS = [
  'name', 'buyer_type', 'default_sale_percentage', 'location_id', 'campaign_id',
  'notes', 'moral_legal_warning',
];

async function attachTags(buyers) {
  if (!buyers.length) return buyers;
  const ids = buyers.map((b) => b.id);

  const [acceptedRows] = await pool.query(
    `SELECT bat.buyer_id, ht.name FROM buyer_accepted_tags bat
     JOIN harvest_tags ht ON ht.id = bat.harvest_tag_id WHERE bat.buyer_id IN (?)`,
    [ids]
  );
  const [rejectedRows] = await pool.query(
    `SELECT brt.buyer_id, ht.name FROM buyer_rejected_tags brt
     JOIN harvest_tags ht ON ht.id = brt.harvest_tag_id WHERE brt.buyer_id IN (?)`,
    [ids]
  );

  const acceptedByBuyer = new Map();
  for (const row of acceptedRows) {
    if (!acceptedByBuyer.has(row.buyer_id)) acceptedByBuyer.set(row.buyer_id, []);
    acceptedByBuyer.get(row.buyer_id).push(row.name);
  }
  const rejectedByBuyer = new Map();
  for (const row of rejectedRows) {
    if (!rejectedByBuyer.has(row.buyer_id)) rejectedByBuyer.set(row.buyer_id, []);
    rejectedByBuyer.get(row.buyer_id).push(row.name);
  }

  return buyers.map((b) => ({
    ...b,
    acceptedTags: acceptedByBuyer.get(b.id) || [],
    rejectedTags: rejectedByBuyer.get(b.id) || [],
  }));
}

async function list({ includeArchived = false } = {}) {
  const where = includeArchived ? '' : 'WHERE archived_at IS NULL';
  const [rows] = await pool.query(`SELECT * FROM buyers ${where} ORDER BY name`);
  return attachTags(rows);
}

async function getById(id, { includeArchived = false } = {}) {
  const where = includeArchived ? 'id = ?' : 'id = ? AND archived_at IS NULL';
  const [rows] = await pool.query(`SELECT * FROM buyers WHERE ${where}`, [id]);
  if (!rows.length) return null;

  const [tagged] = await attachTags(rows);

  const [acceptedIdRows] = await pool.query(
    'SELECT harvest_tag_id FROM buyer_accepted_tags WHERE buyer_id = ?',
    [id]
  );
  const [rejectedIdRows] = await pool.query(
    'SELECT harvest_tag_id FROM buyer_rejected_tags WHERE buyer_id = ?',
    [id]
  );
  tagged.acceptedTagIds = acceptedIdRows.map((r) => r.harvest_tag_id);
  tagged.rejectedTagIds = rejectedIdRows.map((r) => r.harvest_tag_id);

  return tagged;
}

async function setTagJunction(table, buyerId, tagIds) {
  await pool.query(`DELETE FROM ${table} WHERE buyer_id = ?`, [buyerId]);
  if (!tagIds || !tagIds.length) return;
  const values = tagIds.map((tagId) => [buyerId, tagId]);
  await pool.query(`INSERT INTO ${table} (buyer_id, harvest_tag_id) VALUES ?`, [values]);
}

async function create(data, acceptedTagIds = [], rejectedTagIds = []) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO buyers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  const id = result.insertId;
  await setTagJunction('buyer_accepted_tags', id, acceptedTagIds);
  await setTagJunction('buyer_rejected_tags', id, rejectedTagIds);
  await auditLog.record('buyer', id, 'create', null, data);
  return id;
}

async function update(id, data, acceptedTagIds, rejectedTagIds) {
  const before = await getById(id, { includeArchived: true });
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  if (cols.length) {
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE buyers SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  if (acceptedTagIds !== undefined) await setTagJunction('buyer_accepted_tags', id, acceptedTagIds);
  if (rejectedTagIds !== undefined) await setTagJunction('buyer_rejected_tags', id, rejectedTagIds);
  await auditLog.record('buyer', id, 'update', before, data);
}

async function archive(id) {
  const before = await getById(id, { includeArchived: true });
  await pool.query('UPDATE buyers SET archived_at = NOW() WHERE id = ?', [id]);
  await auditLog.record('buyer', id, 'update', before, { archived: true });
}

async function unarchive(id) {
  await pool.query('UPDATE buyers SET archived_at = NULL WHERE id = ?', [id]);
  await auditLog.record('buyer', id, 'update', null, { archived: false });
}

module.exports = { COLUMNS, list, getById, create, update, archive, unarchive };
