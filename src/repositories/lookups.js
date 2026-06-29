const pool = require('../db/pool');

async function listAll(table, orderBy = 'name') {
  const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
  return rows;
}

const skills = () => listAll('skills');
const lores = () => listAll('lores');
const sources = () => listAll('sources');
const locations = () => listAll('locations');
const campaigns = () => listAll('campaigns');
const dcByLevel = () => listAll('dc_by_level', 'level');
const sizeTimeRules = () => pool.query('SELECT * FROM size_time_rules').then(([rows]) => rows);
const bodyConditionModifiers = () => listAll('body_condition_modifiers');
const deathTimeModifiers = () => listAll('death_time_modifiers');
const toolModifiers = () => listAll('tool_modifiers');
const environmentModifiers = () => listAll('environment_modifiers');
const hazardTypes = () => listAll('hazard_types');
const hazardDamageByLevel = () => listAll('hazard_damage_by_level', 'level_min');

async function settings() {
  const [rows] = await pool.query('SELECT `key`, value, value_type FROM settings');
  const map = {};
  for (const row of rows) {
    if (row.value_type === 'number') map[row.key] = Number(row.value);
    else if (row.value_type === 'boolean') map[row.key] = row.value === 'true';
    else map[row.key] = row.value;
  }
  return map;
}

async function setSetting(key, value, valueType = 'string') {
  await pool.query(
    `INSERT INTO settings (\`key\`, value, value_type) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = ?, value_type = ?`,
    [key, value, valueType, value, valueType]
  );
}

module.exports = {
  skills,
  lores,
  sources,
  locations,
  campaigns,
  dcByLevel,
  sizeTimeRules,
  bodyConditionModifiers,
  deathTimeModifiers,
  toolModifiers,
  environmentModifiers,
  hazardTypes,
  hazardDamageByLevel,
  settings,
  setSetting,
};
