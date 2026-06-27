const pool = require('../db/pool');

async function getByCreatureId(creatureId) {
  const [tableRows] = await pool.query('SELECT * FROM signature_tables WHERE creature_id = ?', [
    creatureId,
  ]);
  if (!tableRows.length) return null;

  const table = tableRows[0];
  const [rowRows] = await pool.query(
    `SELECT sr.*, s.name AS skill_name
     FROM signature_rows sr
     LEFT JOIN skills s ON s.id = sr.skill_id
     WHERE sr.signature_table_id = ?
     ORDER BY sr.sort_order`,
    [table.id]
  );

  for (const row of rowRows) {
    const [altSkills] = await pool.query(
      `SELECT s.id, s.name FROM signature_row_alternate_skills sras
       JOIN skills s ON s.id = sras.skill_id
       WHERE sras.signature_row_id = ?`,
      [row.id]
    );
    row.alternateSkills = altSkills;
  }

  table.rows = rowRows;
  return table;
}

async function getRowById(rowId) {
  const [rows] = await pool.query('SELECT * FROM signature_rows WHERE id = ?', [rowId]);
  return rows[0] || null;
}

module.exports = { getByCreatureId, getRowById };
