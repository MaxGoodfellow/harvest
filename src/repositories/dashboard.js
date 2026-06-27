const pool = require('../db/pool');

async function stats() {
  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) AS total FROM creatures WHERE archived_at IS NULL'
  );
  const [[{ signatureCount }]] = await pool.query(
    'SELECT COUNT(*) AS signatureCount FROM creatures WHERE archived_at IS NULL AND is_signature = TRUE'
  );
  const [byTier] = await pool.query(
    `SELECT harvest_tier, COUNT(*) AS count FROM creatures
     WHERE archived_at IS NULL GROUP BY harvest_tier ORDER BY harvest_tier`
  );
  const [byCreatureType] = await pool.query(
    `SELECT creature_type, COUNT(*) AS count FROM creatures
     WHERE archived_at IS NULL GROUP BY creature_type ORDER BY count DESC`
  );
  const [recentlyEdited] = await pool.query(
    `SELECT id, name, level, creature_type, updated_at FROM creatures
     WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 5`
  );

  return { total, signatureCount, byTier, byCreatureType, recentlyEdited };
}

module.exports = { stats };
