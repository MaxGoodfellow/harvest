const pool = require('../db/pool');
const auditLog = require('./auditLog');

const COLUMNS = [
  'creature_id', 'harvest_tag_id', 'skill_id', 'name', 'description',
  'base_dc_modifier', 'use_manual_dc', 'manual_dc', 'use_fixed_value',
  'fixed_crafting_value_cp', 'value_percentage', 'sale_value_percentage',
  'is_hazardous', 'hazard_type_id', 'hazard_save_type', 'hazard_dc_modifier',
  'crafting_uses', 'is_formula_required', 'is_formula_unlocking', 'sort_order',
];

async function listByCreature(creatureId) {
  const [rows] = await pool.query(
    `SELECT c.*, ht.name AS harvest_tag_name, s.name AS skill_name, htp.name AS hazard_type_name
     FROM components c
     LEFT JOIN harvest_tags ht ON ht.id = c.harvest_tag_id
     LEFT JOIN skills s ON s.id = c.skill_id
     LEFT JOIN hazard_types htp ON htp.id = c.hazard_type_id
     WHERE c.creature_id = ?
     ORDER BY c.sort_order, c.name`,
    [creatureId]
  );
  if (!rows.length) return rows;

  const ids = rows.map((r) => r.id);
  const [altRows] = await pool.query(
    `SELECT cas.component_id, s.id, s.name FROM component_alternate_skills cas
     JOIN skills s ON s.id = cas.skill_id
     WHERE cas.component_id IN (?)`,
    [ids]
  );
  const altByComponent = new Map();
  for (const row of altRows) {
    if (!altByComponent.has(row.component_id)) altByComponent.set(row.component_id, []);
    altByComponent.get(row.component_id).push({ id: row.id, name: row.name });
  }
  return rows.map((r) => ({ ...r, alternateSkills: altByComponent.get(r.id) || [] }));
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM components WHERE id = ?', [id]);
  if (!rows.length) return null;
  const component = rows[0];
  component.alternateSkillIds = await alternateSkillIds(id);
  return component;
}

async function alternateSkillIds(componentId) {
  const [rows] = await pool.query(
    'SELECT skill_id FROM component_alternate_skills WHERE component_id = ?',
    [componentId]
  );
  return rows.map((r) => r.skill_id);
}

async function setAlternateSkills(componentId, skillIds = []) {
  await pool.query('DELETE FROM component_alternate_skills WHERE component_id = ?', [componentId]);
  if (!skillIds.length) return;
  const values = skillIds.map((skillId) => [componentId, skillId]);
  await pool.query('INSERT INTO component_alternate_skills (component_id, skill_id) VALUES ?', [
    values,
  ]);
}

async function create(data) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO components (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  const id = result.insertId;
  if (data.alternate_skill_ids !== undefined) await setAlternateSkills(id, data.alternate_skill_ids);
  await auditLog.record('component', id, 'create', null, data);
  return id;
}

async function update(id, data) {
  const before = await getById(id);
  const cols = COLUMNS.filter((c) => data[c] !== undefined && c !== 'creature_id');
  if (cols.length) {
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE components SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  if (data.alternate_skill_ids !== undefined) await setAlternateSkills(id, data.alternate_skill_ids);
  await auditLog.record('component', id, 'update', before, data);
}

async function remove(id) {
  const before = await getById(id);
  await pool.query('DELETE FROM components WHERE id = ?', [id]);
  await auditLog.record('component', id, 'delete', before, null);
}

module.exports = {
  COLUMNS,
  listByCreature,
  getById,
  alternateSkillIds,
  setAlternateSkills,
  create,
  update,
  remove,
};
