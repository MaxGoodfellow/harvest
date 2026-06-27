// Idempotent upsert by natural key for tables with an auto-increment `id` PK.
// Column names are backtick-quoted since a few (e.g. settings.key) are MySQL
// reserved words.
async function upsert(conn, table, keyCols, data) {
  const keyWhere = keyCols.map((c) => `\`${c}\` = ?`).join(' AND ');
  const keyValues = keyCols.map((c) => data[c]);
  const [rows] = await conn.query(`SELECT id FROM ${table} WHERE ${keyWhere} LIMIT 1`, keyValues);

  const cols = Object.keys(data);
  const values = cols.map((c) => data[c]);

  if (rows.length) {
    const setClause = cols.map((c) => `\`${c}\` = ?`).join(', ');
    await conn.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, rows[0].id]);
    return rows[0].id;
  }

  const placeholders = cols.map(() => '?').join(', ');
  const colList = cols.map((c) => `\`${c}\``).join(', ');
  const [result] = await conn.query(
    `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
    values
  );
  return result.insertId;
}

async function getId(conn, table, col, value) {
  const [rows] = await conn.query(`SELECT id FROM ${table} WHERE ${col} = ? LIMIT 1`, [value]);
  if (!rows.length) throw new Error(`${table} with ${col}=${value} not found`);
  return rows[0].id;
}

async function linkJunction(conn, table, cols, values) {
  const placeholders = cols.map(() => '?').join(', ');
  const noopUpdate = cols.map((c) => `${c} = ${c}`).join(', ');
  await conn.query(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${noopUpdate}`,
    values
  );
}

module.exports = { upsert, getId, linkJunction };
