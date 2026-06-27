const pool = require('../db/pool');

// Best-effort: audit logging must never block the write it's recording.
async function record(entityType, entityId, action, oldValue, newValue, changedBy = 'gm') {
  try {
    await pool.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, old_value_json, new_value_json, changed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entityType,
        entityId,
        action,
        oldValue === undefined || oldValue === null ? null : JSON.stringify(oldValue),
        newValue === undefined || newValue === null ? null : JSON.stringify(newValue),
        changedBy,
      ]
    );
  } catch (err) {
    console.error(`audit_log write failed for ${entityType}#${entityId} (non-blocking):`, err.message);
  }
}

module.exports = { record };
