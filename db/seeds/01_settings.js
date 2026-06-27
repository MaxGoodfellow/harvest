const { upsert } = require('./_helpers');

const SETTINGS = [
  { key: 'default_sale_percentage', value: '50', value_type: 'number', description: 'Default % of crafting value a standard buyer pays.' },
  { key: 'default_crafting_percentage', value: '100', value_type: 'number', description: 'Default % of total harvest value assigned to a component at Standard quality.' },
  { key: 'pristine_can_exceed_cap', value: 'false', value_type: 'boolean', description: 'Allow a Pristine (150%) result to push a component above the creature\'s Total Harvest Value cap.' },
  { key: 'humanoid_warnings_enabled', value: 'true', value_type: 'boolean', description: 'Show the desecration/crime warning for Sapient/Humanoid/Unique NPC or morally-sensitive creatures.' },
  { key: 'default_campaign_name', value: 'Default Campaign', value_type: 'string', description: 'Campaign pre-selected on new-creature forms.' },
  { key: 'default_market', value: 'Local Market', value_type: 'string', description: 'Buyer/market pre-selected on the Harvest Calculator.' },
  { key: 'currency_display', value: 'gp_sp_cp', value_type: 'string', description: 'Money formatting style used by money.js formatCp().' },
  { key: 'use_auto_value_formula', value: 'true', value_type: 'boolean', description: 'Auto-fill Total Harvest Value from level unless a creature opts into a manual value.' },
];

async function seed(conn) {
  for (const row of SETTINGS) {
    await upsert(conn, 'settings', ['key'], row);
  }
}

module.exports = seed;
