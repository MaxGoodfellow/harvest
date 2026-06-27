// Parses/validates the "Import Monsters (CSV)" format into the same
// creatureData shape src/repositories/importer.js's importCreature()
// already consumes (so the actual DB writes reuse that natural-key-
// resolving, transactional logic rather than duplicating it).
//
// One CSV row = one component. A monster with N components spans N rows,
// with the monster-level columns (Monster Name, Level, Size, ...) repeated
// on every row. Monster-level columns are only read from the FIRST row seen
// for a given Monster Name — if they differ on a later row for the same
// monster, the later value is silently ignored (deliberate: makes
// "fill down the column" spreadsheet habits safe rather than an error).
// Leave every Component column blank on a row to import a monster with no
// component on that line.

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const INTELLIGENCE_CATEGORIES = ['Non-sapient', 'Animal-level', 'Sapient', 'Humanoid', 'Unique NPC'];
const PROFICIENCIES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

// Documents every column for both the downloadable template and the
// Import/Export page's reference table — single source of truth so the two
// never drift apart.
const FIELD_DOCS = [
  { header: 'Monster Name', level: 'Monster', required: true, type: 'text', description: 'The monster\'s name. Every row sharing the same Monster Name is grouped into one monster — repeat it on every row for that monster\'s components.' },
  { header: 'Level', level: 'Monster', required: true, type: 'integer, -1 to 30', description: 'Creature level. Drives the auto-computed base DC and Total Harvest Value (level² × 200cp). Read only from the first row for each monster.' },
  { header: 'Size', level: 'Monster', required: true, type: 'Tiny | Small | Medium | Large | Huge | Gargantuan', description: 'Creature size.' },
  { header: 'Rarity', level: 'Monster', required: false, type: 'common | uncommon | rare | unique', description: 'Defaults to common if blank.' },
  { header: 'Creature Type', level: 'Monster', required: true, type: 'text', description: 'Free text, e.g. Animal, Dragon, Undead.' },
  { header: 'Intelligence Category', level: 'Monster', required: false, type: 'Non-sapient | Animal-level | Sapient | Humanoid | Unique NPC', description: 'Defaults to Animal-level. Sapient/Humanoid/Unique NPC trigger the desecration/crime warning on the Monster Detail page.' },
  { header: 'Harvest Tier', level: 'Monster', required: true, type: 'integer, 0-3', description: 'GM-facing difficulty/value tier shown on the Monsters list and Dashboard.' },
  { header: 'Required Proficiency', level: 'Monster', required: false, type: 'Untrained | Trained | Expert | Master | Legendary', description: 'Defaults to Trained.' },
  { header: 'Tags', level: 'Monster', required: false, type: 'harvest tag names, separated by ;', description: 'e.g. "Hide;Meat;Bone;Trophy". Each name must already exist as a harvest tag.' },
  { header: 'Is Signature', level: 'Monster', required: false, type: 'true/false', description: 'Exempts the monster from the component value cap. Signature tables themselves (e.g. the Black Dragon\'s Acid Sac row) cannot be created via this CSV import — use JSON import or the UI for those.' },
  { header: 'Is Morally Sensitive', level: 'Monster', required: false, type: 'true/false', description: 'Forces the desecration/crime warning even if Intelligence Category alone would not trigger it.' },
  { header: 'Use Manual Value', level: 'Monster', required: false, type: 'true/false', description: 'If true, Manual Total Harvest Value (cp) is used instead of the level² × 200cp formula.' },
  { header: 'Manual Total Harvest Value (cp)', level: 'Monster', required: false, type: 'integer, copper pieces', description: 'Only used when Use Manual Value is true.' },
  { header: 'Description', level: 'Monster', required: false, type: 'text', description: 'Flavor text shown on the Monster Detail page.' },
  { header: 'GM Notes', level: 'Monster', required: false, type: 'text', description: 'Hidden by default behind a "GM notes" expander on the Monster Detail page.' },
  { header: 'Component Name', level: 'Component', required: false, type: 'text', description: 'Leave every Component column blank on a row to import the monster with no component from that row. If set, Component Harvest Tag becomes required.' },
  { header: 'Component Harvest Tag', level: 'Component', required: 'if Component Name is set', type: 'harvest tag name', description: 'Must match an existing harvest tag (e.g. Hide, Meat, Organ, Venom).' },
  { header: 'Component Skill', level: 'Component', required: false, type: 'skill name', description: 'The primary skill used to harvest this component (e.g. Survival, Medicine).' },
  { header: 'Component Alt Skills', level: 'Component', required: false, type: 'skill names, separated by ;', description: 'Other skills usable for the same action — shown in the Harvest Calculator\'s "Skill used" picker, e.g. "Crafting;Arcana".' },
  { header: 'Component Description', level: 'Component', required: false, type: 'text', description: 'Shown on the Monster Detail page.' },
  { header: 'Component Base DC Modifier', level: 'Component', required: false, type: 'integer', description: 'Added to the monster\'s base DC for this component. Defaults to 0. Ignored if Component Use Manual DC is true.' },
  { header: 'Component Use Manual DC', level: 'Component', required: false, type: 'true/false', description: 'If true, Component Manual DC replaces Component Base DC Modifier.' },
  { header: 'Component Manual DC', level: 'Component', required: 'if Use Manual DC is true', type: 'integer', description: 'DC modifier override; only used when Component Use Manual DC is true.' },
  { header: 'Component Use Fixed Value', level: 'Component', required: false, type: 'true/false', description: 'If true, Component Fixed Value (cp) replaces the percentage-of-Total-Harvest-Value calculation.' },
  { header: 'Component Fixed Value (cp)', level: 'Component', required: 'if Use Fixed Value is true', type: 'integer, copper pieces', description: 'Flat crafting value; only used when Component Use Fixed Value is true.' },
  { header: 'Component Value Percentage', level: 'Component', required: 'unless Use Fixed Value is true', type: 'decimal, e.g. 30 for 30%', description: 'This component\'s share of the monster\'s Total Harvest Value. The sum across one monster\'s components should not exceed 100 unless the monster Is Signature.' },
  { header: 'Component Sale Value Percentage Override', level: 'Component', required: false, type: 'decimal', description: 'Overrides a buyer\'s default sale percentage for this specific component in the Harvest Calculator. Leave blank to use the buyer\'s default.' },
  { header: 'Component Is Hazardous', level: 'Component', required: false, type: 'true/false', description: 'Marks the component as able to trigger a hazard on a critical failure (e.g. a venom sac).' },
  { header: 'Component Hazard Type', level: 'Component', required: false, type: 'hazard type name', description: 'Must match an existing hazard type (e.g. Poison Exposure, Acid Splash). Only relevant if Component Is Hazardous is true.' },
  { header: 'Component Hazard Save Type Override', level: 'Component', required: false, type: 'text, e.g. Reflex', description: 'Overrides the hazard type\'s default save (Fortitude/Reflex/Will).' },
  { header: 'Component Hazard DC Modifier', level: 'Component', required: false, type: 'integer', description: 'Added to the final DC to get the hazard save DC. Defaults to 0.' },
  { header: 'Component Crafting Uses', level: 'Component', required: false, type: 'text', description: 'Free text describing what the harvested material can be used for.' },
  { header: 'Component Is Formula Required', level: 'Component', required: false, type: 'true/false', description: 'Flags that crafting with this material requires a formula.' },
  { header: 'Component Is Formula Unlocking', level: 'Component', required: false, type: 'true/false', description: 'Flags that harvesting this material unlocks a crafting formula.' },
  { header: 'Component Sort Order', level: 'Component', required: false, type: 'integer', description: 'Controls display order among a monster\'s components. Defaults to 0.' },
];

const HEADERS = FIELD_DOCS.map((f) => f.header);

function splitList(value) {
  return (value || '').split(';').map((s) => s.trim()).filter(Boolean);
}

function parseBool(value, fieldLabel, rowNum, errors) {
  const v = (value || '').trim().toLowerCase();
  if (v === '' || v === 'false' || v === 'no' || v === '0') return false;
  if (v === 'true' || v === 'yes' || v === '1') return true;
  errors.push(`Row ${rowNum}: ${fieldLabel} must be true/false (got "${value}")`);
  return false;
}

function parseIntField(value, fieldLabel, rowNum, errors, { required = false } = {}) {
  const v = (value || '').trim();
  if (v === '') {
    if (required) errors.push(`Row ${rowNum}: ${fieldLabel} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n)) {
    errors.push(`Row ${rowNum}: ${fieldLabel} must be a whole number (got "${value}")`);
    return null;
  }
  return n;
}

function parseDecimalField(value, fieldLabel, rowNum, errors) {
  const v = (value || '').trim();
  if (v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) {
    errors.push(`Row ${rowNum}: ${fieldLabel} must be a number (got "${value}")`);
    return null;
  }
  return n;
}

function validateEnum(value, allowed, fieldLabel, rowNum, errors) {
  if (value && !allowed.includes(value)) {
    errors.push(`Row ${rowNum}: ${fieldLabel} must be one of ${allowed.join(', ')} (got "${value}")`);
  }
}

// Pure — no DB access. Reference-data names (harvest tags, skills, hazard
// types) are resolved later, inside the transaction, by importCreature().
function parseMonstersCsv(rows) {
  const errors = [];
  const creaturesByName = new Map();
  const order = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for the header row, +1 for 1-based rows

    const name = (row['Monster Name'] || '').trim();
    if (!name) {
      errors.push(`Row ${rowNum}: Monster Name is required`);
      return;
    }

    let creature = creaturesByName.get(name);
    if (!creature) {
      const size = (row['Size'] || '').trim();
      const creatureType = (row['Creature Type'] || '').trim();
      const rarity = (row['Rarity'] || '').trim() || 'common';
      const intelligence = (row['Intelligence Category'] || '').trim() || 'Animal-level';
      const proficiency = (row['Required Proficiency'] || '').trim() || 'Trained';

      const level = parseIntField(row['Level'], 'Level', rowNum, errors, { required: true });
      if (!size) errors.push(`Row ${rowNum}: Size is required`);
      validateEnum(size, SIZES, 'Size', rowNum, errors);
      if (!creatureType) errors.push(`Row ${rowNum}: Creature Type is required`);
      const harvestTier = parseIntField(row['Harvest Tier'], 'Harvest Tier', rowNum, errors, { required: true });
      if (harvestTier !== null && (harvestTier < 0 || harvestTier > 3)) {
        errors.push(`Row ${rowNum}: Harvest Tier must be 0-3 (got "${row['Harvest Tier']}")`);
      }
      validateEnum(rarity, RARITIES, 'Rarity', rowNum, errors);
      validateEnum(intelligence, INTELLIGENCE_CATEGORIES, 'Intelligence Category', rowNum, errors);
      validateEnum(proficiency, PROFICIENCIES, 'Required Proficiency', rowNum, errors);

      const useManualValue = parseBool(row['Use Manual Value'], 'Use Manual Value', rowNum, errors);
      const manualValue = parseIntField(
        row['Manual Total Harvest Value (cp)'],
        'Manual Total Harvest Value (cp)',
        rowNum,
        errors
      );

      creature = {
        name,
        level,
        size,
        rarity,
        creature_type: creatureType,
        intelligence_category: intelligence,
        harvest_tier: harvestTier,
        required_proficiency: proficiency,
        is_signature: parseBool(row['Is Signature'], 'Is Signature', rowNum, errors),
        is_morally_sensitive: parseBool(row['Is Morally Sensitive'], 'Is Morally Sensitive', rowNum, errors),
        use_manual_value: useManualValue,
        manual_total_harvest_value_cp: useManualValue ? manualValue : null,
        total_harvest_value_formula: '(level^2) * 200 cp',
        description: row['Description'] || null,
        gm_notes: row['GM Notes'] || null,
        tags: splitList(row['Tags']),
        components: [],
      };
      creaturesByName.set(name, creature);
      order.push(name);
    }

    const componentName = (row['Component Name'] || '').trim();
    if (!componentName) return;

    const harvestTagName = (row['Component Harvest Tag'] || '').trim();
    if (!harvestTagName) {
      errors.push(`Row ${rowNum}: Component Harvest Tag is required when Component Name is set`);
    }

    const useFixedValue = parseBool(row['Component Use Fixed Value'], 'Component Use Fixed Value', rowNum, errors);
    const useManualDc = parseBool(row['Component Use Manual DC'], 'Component Use Manual DC', rowNum, errors);

    const valuePercentage = parseDecimalField(
      row['Component Value Percentage'],
      'Component Value Percentage',
      rowNum,
      errors
    );
    const fixedValue = parseIntField(row['Component Fixed Value (cp)'], 'Component Fixed Value (cp)', rowNum, errors);
    if (!useFixedValue && valuePercentage === null) {
      errors.push(`Row ${rowNum}: Component Value Percentage is required unless Component Use Fixed Value is true`);
    }
    if (useFixedValue && fixedValue === null) {
      errors.push(`Row ${rowNum}: Component Fixed Value (cp) is required when Component Use Fixed Value is true`);
    }

    creature.components.push({
      name: componentName,
      harvest_tag_name: harvestTagName,
      skill_name: row['Component Skill'] || null,
      alternateSkills: splitList(row['Component Alt Skills']),
      description: row['Component Description'] || null,
      base_dc_modifier:
        parseIntField(row['Component Base DC Modifier'], 'Component Base DC Modifier', rowNum, errors) || 0,
      use_manual_dc: useManualDc,
      manual_dc: parseIntField(row['Component Manual DC'], 'Component Manual DC', rowNum, errors),
      use_fixed_value: useFixedValue,
      fixed_crafting_value_cp: fixedValue,
      value_percentage: valuePercentage,
      sale_value_percentage: parseDecimalField(
        row['Component Sale Value Percentage Override'],
        'Component Sale Value Percentage Override',
        rowNum,
        errors
      ),
      is_hazardous: parseBool(row['Component Is Hazardous'], 'Component Is Hazardous', rowNum, errors),
      hazard_type_name: row['Component Hazard Type'] || null,
      hazard_save_type: row['Component Hazard Save Type Override'] || null,
      hazard_dc_modifier:
        parseIntField(row['Component Hazard DC Modifier'], 'Component Hazard DC Modifier', rowNum, errors) || 0,
      crafting_uses: row['Component Crafting Uses'] || null,
      is_formula_required: parseBool(row['Component Is Formula Required'], 'Component Is Formula Required', rowNum, errors),
      is_formula_unlocking: parseBool(row['Component Is Formula Unlocking'], 'Component Is Formula Unlocking', rowNum, errors),
      sort_order: parseIntField(row['Component Sort Order'], 'Component Sort Order', rowNum, errors) || 0,
    });
  });

  return { creatures: order.map((n) => creaturesByName.get(n)), errors };
}

module.exports = { FIELD_DOCS, HEADERS, parseMonstersCsv };
