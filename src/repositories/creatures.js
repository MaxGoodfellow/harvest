const pool = require('../db/pool');
const auditLog = require('./auditLog');
const componentsRepo = require('./components');
const signatureTablesRepo = require('./signatureTables');

const COLUMNS = [
  'name', 'level', 'size', 'rarity', 'creature_type', 'intelligence_category',
  'harvest_tier', 'required_proficiency', 'campaign_id', 'source_id', 'location_id',
  'is_signature', 'is_morally_sensitive', 'use_manual_value',
  'manual_total_harvest_value_cp', 'total_harvest_value_formula', 'description', 'gm_notes',
];

// Component columns that are safe to clone verbatim from one creature's
// component to another (excludes id/creature_id/timestamps and the joined
// display-only fields listByCreature() adds, e.g. harvest_tag_name).
const CLONEABLE_COMPONENT_COLUMNS = componentsRepo.COLUMNS.filter((c) => c !== 'creature_id');

async function list(filters = {}) {
  const where = [];
  const params = [];

  if (!filters.includeArchived) where.push('c.archived_at IS NULL');
  if (filters.search) {
    where.push('c.name LIKE ?');
    params.push(`%${filters.search}%`);
  }
  if (filters.size) {
    where.push('c.size = ?');
    params.push(filters.size);
  }
  if (filters.creatureType) {
    where.push('c.creature_type = ?');
    params.push(filters.creatureType);
  }
  if (filters.harvestTier !== undefined && filters.harvestTier !== '') {
    where.push('c.harvest_tier = ?');
    params.push(filters.harvestTier);
  }
  if (filters.campaignId) {
    where.push('c.campaign_id = ?');
    params.push(filters.campaignId);
  }
  if (filters.locationId) {
    where.push('c.location_id = ?');
    params.push(filters.locationId);
  }
  if (filters.sourceId) {
    where.push('c.source_id = ?');
    params.push(filters.sourceId);
  }
  if (filters.levelMin !== undefined && filters.levelMin !== '') {
    where.push('c.level >= ?');
    params.push(filters.levelMin);
  }
  if (filters.levelMax !== undefined && filters.levelMax !== '') {
    where.push('c.level <= ?');
    params.push(filters.levelMax);
  }
  if (filters.moralSensitivity) where.push('c.is_morally_sensitive = TRUE');
  if (filters.hasSignatureTable) where.push('c.is_signature = TRUE');
  if (filters.tag) {
    where.push(
      'c.id IN (SELECT cht.creature_id FROM creature_harvest_tags cht JOIN harvest_tags ht ON ht.id = cht.harvest_tag_id WHERE ht.name = ?)'
    );
    params.push(filters.tag);
  }
  if (filters.hasHazardousComponents) {
    where.push('c.id IN (SELECT creature_id FROM components WHERE is_hazardous = TRUE)');
  }
  if (filters.craftingUse) {
    where.push('c.id IN (SELECT creature_id FROM components WHERE crafting_uses LIKE ?)');
    params.push(`%${filters.craftingUse}%`);
  }

  const sql = `
    SELECT c.* FROM creatures c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY c.name
  `;
  const [rows] = await pool.query(sql, params);
  if (!rows.length) return rows;

  const ids = rows.map((r) => r.id);
  const [tagRows] = await pool.query(
    `SELECT cht.creature_id, ht.name FROM creature_harvest_tags cht
     JOIN harvest_tags ht ON ht.id = cht.harvest_tag_id
     WHERE cht.creature_id IN (?)`,
    [ids]
  );
  const tagsByCreature = new Map();
  for (const row of tagRows) {
    if (!tagsByCreature.has(row.creature_id)) tagsByCreature.set(row.creature_id, []);
    tagsByCreature.get(row.creature_id).push(row.name);
  }

  return rows.map((r) => ({ ...r, tags: tagsByCreature.get(r.id) || [] }));
}

async function getById(id, { includeArchived = false } = {}) {
  const where = includeArchived ? 'id = ?' : 'id = ? AND archived_at IS NULL';
  const [rows] = await pool.query(`SELECT * FROM creatures WHERE ${where}`, [id]);
  if (!rows.length) return null;
  const creature = rows[0];

  const [tagRows] = await pool.query(
    `SELECT ht.id, ht.name FROM creature_harvest_tags cht
     JOIN harvest_tags ht ON ht.id = cht.harvest_tag_id
     WHERE cht.creature_id = ? ORDER BY ht.name`,
    [id]
  );
  creature.tags = tagRows;
  creature.components = await componentsRepo.listByCreature(id);
  creature.signatureTable = await signatureTablesRepo.getByCreatureId(id);

  return creature;
}

async function setTags(creatureId, tagIds) {
  await pool.query('DELETE FROM creature_harvest_tags WHERE creature_id = ?', [creatureId]);
  if (!tagIds || !tagIds.length) return;
  const values = tagIds.map((tagId) => [creatureId, tagId]);
  await pool.query('INSERT INTO creature_harvest_tags (creature_id, harvest_tag_id) VALUES ?', [
    values,
  ]);
}

async function create(data, tagIds = []) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO creatures (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  const id = result.insertId;
  await setTags(id, tagIds);
  await auditLog.record('creature', id, 'create', null, data);
  return id;
}

async function update(id, data, tagIds) {
  const before = await getById(id, { includeArchived: true });
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  if (cols.length) {
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE creatures SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  if (tagIds !== undefined) await setTags(id, tagIds);
  await auditLog.record('creature', id, 'update', before, data);
}

async function archive(id) {
  const before = await getById(id, { includeArchived: true });
  await pool.query('UPDATE creatures SET archived_at = NOW() WHERE id = ?', [id]);
  await auditLog.record('creature', id, 'update', before, { archived: true });
}

async function unarchive(id) {
  await pool.query('UPDATE creatures SET archived_at = NULL WHERE id = ?', [id]);
  await auditLog.record('creature', id, 'update', null, { archived: false });
}

// Clones the creature's tags and regular components. Signature tables are
// hand-authored boss content and are intentionally not duplicated.
async function duplicate(id) {
  const original = await getById(id, { includeArchived: true });
  if (!original) return null;

  const newId = await create(
    { ...original, name: `${original.name} (Copy)` },
    original.tags.map((t) => t.id)
  );

  for (const component of original.components) {
    const data = {};
    for (const col of CLONEABLE_COMPONENT_COLUMNS) data[col] = component[col];
    data.alternate_skill_ids = (component.alternateSkills || []).map((s) => s.id);
    await componentsRepo.create({ creature_id: newId, ...data });
  }

  return newId;
}

module.exports = { COLUMNS, list, getById, create, update, archive, unarchive, duplicate };
