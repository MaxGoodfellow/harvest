const { upsert } = require('./_helpers');

// CLAUDE.md §8.4 "Body condition"
const BODY_CONDITION_MODIFIERS = [
  { name: 'Fresh', dc_modifier: 0, is_impossible: false, description: 'Harvested immediately, no degradation.' },
  { name: 'Minor Damage', dc_modifier: 1, is_impossible: false, description: 'Light damage to the carcass.' },
  { name: 'Heavy Damage', dc_modifier: 2, is_impossible: false, description: 'Significant damage to the carcass.' },
  { name: 'Burned/Melted', dc_modifier: 3, is_impossible: false, description: 'Charred or melted tissue.' },
  { name: 'Frozen', dc_modifier: 3, is_impossible: false, description: 'Frozen solid; requires careful thawing or extra care.' },
  { name: 'Exploded/Dissolved', dc_modifier: 5, is_impossible: false, description: 'Carcass mostly destroyed; only scraps remain.' },
  { name: 'Destroyed', dc_modifier: null, is_impossible: true, description: 'Nothing left to harvest.' },
];

// CLAUDE.md §8.4 "Time since death". The "3d+" dc_modifier (+6) extrapolates
// the 0/1/2/4 progression — not given a literal number in CLAUDE.md, only the
// Bone/Hide/Trophy-only restriction; tune in Settings if it plays wrong.
const DEATH_TIME_MODIFIERS = [
  { name: '≤1 hour', dc_modifier: 0, restricted_to_tags_json: null, allows_no_degradation: false, description: 'Harvested within an hour of death.' },
  { name: '1-8 hours', dc_modifier: 1, restricted_to_tags_json: null, allows_no_degradation: false, description: 'Delicate parts begin to degrade.' },
  { name: '8-24 hours', dc_modifier: 2, restricted_to_tags_json: null, allows_no_degradation: false, description: 'Significant degradation.' },
  { name: '1-3 days', dc_modifier: 4, restricted_to_tags_json: null, allows_no_degradation: false, description: 'Heavy degradation.' },
  { name: '3+ days', dc_modifier: 6, restricted_to_tags_json: JSON.stringify(['Bone', 'Hide', 'Trophy']), allows_no_degradation: false, description: 'Only Bone, Hide, and Trophy components remain harvestable.' },
  { name: 'Magically Preserved', dc_modifier: 0, restricted_to_tags_json: null, allows_no_degradation: true, description: 'No time-based degradation.' },
];

// CLAUDE.md §10 "Default tools"
const TOOL_MODIFIERS = [
  { name: 'Harvesting Kit', dc_modifier: 0, cost_cp: 500, bulk: 1.0, min_size: null, applies_to_tags_json: null, applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Standard harvesting kit.' },
  { name: 'Improvised', dc_modifier: 2, cost_cp: null, bulk: null, min_size: null, applies_to_tags_json: null, applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Whatever is on hand.' },
  { name: 'None', dc_modifier: 4, cost_cp: null, bulk: null, min_size: null, applies_to_tags_json: null, applies_to_creature_types_json: null, some_parts_impossible: true, description: 'No tools at all; some parts are impossible to harvest.' },
  { name: 'Expanded Harvesting Kit', dc_modifier: -1, cost_cp: 3000, bulk: 2.0, min_size: 'Large', applies_to_tags_json: null, applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Built for Large+ creatures.' },
  { name: 'Dragonharvesting Kit', dc_modifier: -1, cost_cp: 10000, bulk: null, min_size: null, applies_to_tags_json: null, applies_to_creature_types_json: JSON.stringify(['Dragon']), some_parts_impossible: false, description: 'Specialist kit for dragons.' },
  { name: 'Alchemical Extraction Kit', dc_modifier: -1, cost_cp: 10000, bulk: null, min_size: null, applies_to_tags_json: JSON.stringify(['Venom', 'Acid']), applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Specialist kit for venom/acid/alchemical components.' },
  { name: 'Undead Remains Kit', dc_modifier: -1, cost_cp: 10000, bulk: null, min_size: null, applies_to_tags_json: JSON.stringify(['Undead']), applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Specialist kit for undead remains.' },
  { name: 'Ooze Containment Kit', dc_modifier: -1, cost_cp: 10000, bulk: null, min_size: null, applies_to_tags_json: JSON.stringify(['Ooze']), applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Specialist kit for oozes.' },
  { name: 'Specialist Kit', dc_modifier: -1, cost_cp: null, bulk: null, min_size: null, applies_to_tags_json: null, applies_to_creature_types_json: null, some_parts_impossible: false, description: 'Generic specialist kit matching the component being harvested.' },
];

// CLAUDE.md §8.4 "Tools" workshop/time-pressure/condition modifiers, split
// into environment_modifiers per the plan (kit choice vs. work conditions).
const ENVIRONMENT_MODIFIERS = [
  { name: 'Good Workshop', dc_modifier: -1, description: 'A proper, well-equipped workshop.' },
  { name: 'Specialist Workshop', dc_modifier: -2, description: 'A workshop specialized for this component type.' },
  { name: 'Under Time Pressure', dc_modifier: 2, description: 'Rushed, no time to work carefully.' },
  { name: 'Poor Light', dc_modifier: 1, description: 'Inadequate lighting.' },
  { name: 'Cramped Quarters', dc_modifier: 1, description: 'No room to work properly.' },
  { name: 'Danger Nearby', dc_modifier: 2, description: 'Distracted by an active threat.' },
];

async function seed(conn) {
  for (const row of BODY_CONDITION_MODIFIERS) {
    await upsert(conn, 'body_condition_modifiers', ['name'], row);
  }
  for (const row of DEATH_TIME_MODIFIERS) {
    await upsert(conn, 'death_time_modifiers', ['name'], row);
  }
  for (const row of TOOL_MODIFIERS) {
    await upsert(conn, 'tool_modifiers', ['name'], row);
  }
  for (const row of ENVIRONMENT_MODIFIERS) {
    await upsert(conn, 'environment_modifiers', ['name'], row);
  }
}

module.exports = seed;
