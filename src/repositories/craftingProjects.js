const pool = require('../db/pool');
const auditLog = require('./auditLog');

const COLUMNS = [
  'campaign_id', 'name', 'item_gp_cost_cp', 'is_formula_required',
  'is_formula_unlocking', 'status', 'notes',
];

async function list() {
  const [rows] = await pool.query(`
    SELECT cp.*, COALESCE(SUM(cpm.value_applied_cp), 0) AS total_applied_cp
    FROM crafting_projects cp
    LEFT JOIN crafting_project_materials cpm ON cpm.crafting_project_id = cp.id
    GROUP BY cp.id
    ORDER BY cp.created_at DESC
  `);
  return rows;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM crafting_projects WHERE id = ?', [id]);
  if (!rows.length) return null;
  const project = rows[0];

  const [materials] = await pool.query(
    `SELECT mi.*, cpm.value_applied_cp FROM crafting_project_materials cpm
     JOIN materials_inventory mi ON mi.id = cpm.materials_inventory_id
     WHERE cpm.crafting_project_id = ?`,
    [id]
  );
  project.materials = materials;
  project.totalAppliedCp = materials.reduce((sum, m) => sum + m.value_applied_cp, 0);

  return project;
}

async function create(data) {
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  const values = cols.map((c) => data[c]);
  const [result] = await pool.query(
    `INSERT INTO crafting_projects (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    values
  );
  await auditLog.record('crafting_project', result.insertId, 'create', null, data);
  return result.insertId;
}

async function update(id, data) {
  const before = await getById(id);
  const cols = COLUMNS.filter((c) => data[c] !== undefined);
  if (cols.length) {
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => data[c]);
    await pool.query(`UPDATE crafting_projects SET ${setClause} WHERE id = ?`, [...values, id]);
  }
  await auditLog.record('crafting_project', id, 'update', before, data);
}

// Attaching a material consumes the whole inventory item against the
// project (materials_inventory rows are discrete harvested items, not a
// fungible currency pool) — its full crafting_value_cp is applied and its
// status flips to 'used'.
async function attachMaterial(projectId, materialId) {
  const [materialRows] = await pool.query('SELECT crafting_value_cp FROM materials_inventory WHERE id = ?', [
    materialId,
  ]);
  if (!materialRows.length) throw new Error('Material not found');
  const valueAppliedCp = materialRows[0].crafting_value_cp;

  await pool.query(
    `INSERT INTO crafting_project_materials (crafting_project_id, materials_inventory_id, value_applied_cp)
     VALUES (?, ?, ?)`,
    [projectId, materialId, valueAppliedCp]
  );
  await pool.query('UPDATE materials_inventory SET status = ? WHERE id = ?', ['used', materialId]);
  await auditLog.record('crafting_project', projectId, 'update', null, {
    attached_material_id: materialId,
    value_applied_cp: valueAppliedCp,
  });
}

async function detachMaterial(projectId, materialId) {
  await pool.query(
    'DELETE FROM crafting_project_materials WHERE crafting_project_id = ? AND materials_inventory_id = ?',
    [projectId, materialId]
  );
  await pool.query('UPDATE materials_inventory SET status = ? WHERE id = ?', ['available', materialId]);
  await auditLog.record('crafting_project', projectId, 'update', null, { detached_material_id: materialId });
}

module.exports = { COLUMNS, list, getById, create, update, attachMaterial, detachMaterial };
