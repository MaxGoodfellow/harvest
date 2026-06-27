// JSON/CSV monster import. Reuses the same upsert-by-natural-key helpers the
// seed scripts use (db/seeds/_helpers.js) so re-importing the same data is
// idempotent (matches by creature/buyer name rather than ID) and so foreign
// keys are resolved by name rather than by the source's numeric IDs, which
// won't generally match the target DB's auto-increment sequence for
// reference tables.
const path = require('path');
const { upsert, linkJunction } = require(path.join('..', '..', 'db', 'seeds', '_helpers'));

const CREATURE_COLUMNS = [
  'level', 'size', 'rarity', 'creature_type', 'intelligence_category', 'harvest_tier',
  'required_proficiency', 'is_signature', 'is_morally_sensitive', 'use_manual_value',
  'manual_total_harvest_value_cp', 'total_harvest_value_formula', 'description', 'gm_notes',
];

const COMPONENT_COLUMNS = [
  'name', 'description', 'base_dc_modifier', 'use_manual_dc', 'manual_dc', 'use_fixed_value',
  'fixed_crafting_value_cp', 'value_percentage', 'sale_value_percentage', 'is_hazardous',
  'hazard_save_type', 'hazard_dc_modifier', 'crafting_uses', 'is_formula_required',
  'is_formula_unlocking', 'sort_order',
];

const SIGNATURE_ROW_COLUMNS = [
  'name', 'dc_modifier', 'time_minutes', 'time_display', 'critical_success_text', 'success_text',
  'failure_text', 'critical_failure_text', 'crafting_uses', 'sort_order',
];

function pick(source, columns) {
  const data = {};
  for (const col of columns) data[col] = source[col];
  return data;
}

function altSkillNames(list) {
  return (list || []).map((s) => (typeof s === 'string' ? s : s.name));
}

// Reference tables (skills/harvest_tags/hazard_types) don't change during an
// import, so loading them once into name->id maps avoids one SELECT per
// name per row — at CSV-import scale (tens of thousands of rows, mostly
// reusing the same handful of tag/skill names) that's the difference
// between 3 queries and tens of thousands of them, which was the main
// reason a large import was slow enough to collide with other DB activity
// and deadlock.
async function buildReferenceCache(conn) {
  const [[skills], [harvestTags], [hazardTypes]] = await Promise.all([
    conn.query('SELECT id, name FROM skills'),
    conn.query('SELECT id, name FROM harvest_tags'),
    conn.query('SELECT id, name FROM hazard_types'),
  ]);
  return {
    skills: new Map(skills.map((r) => [r.name, r.id])),
    harvestTags: new Map(harvestTags.map((r) => [r.name, r.id])),
    hazardTypes: new Map(hazardTypes.map((r) => [r.name, r.id])),
  };
}

function cacheGet(map, name, table) {
  const id = map.get(name);
  if (id === undefined) throw new Error(`${table} with name=${name} not found`);
  return id;
}

async function importCreature(conn, creatureData, cache) {
  const creatureId = await upsert(conn, 'creatures', ['name'], {
    name: creatureData.name,
    ...pick(creatureData, CREATURE_COLUMNS),
  });

  await conn.query('DELETE FROM creature_harvest_tags WHERE creature_id = ?', [creatureId]);
  for (const tagName of creatureData.tags || []) {
    const tagId = cacheGet(cache.harvestTags, tagName.name || tagName, 'harvest_tags');
    await linkJunction(conn, 'creature_harvest_tags', ['creature_id', 'harvest_tag_id'], [
      creatureId,
      tagId,
    ]);
  }

  for (const comp of creatureData.components || []) {
    const tagId = cacheGet(cache.harvestTags, comp.harvest_tag_name, 'harvest_tags');
    const skillId = comp.skill_name ? cacheGet(cache.skills, comp.skill_name, 'skills') : null;
    const hazardTypeId = comp.hazard_type_name
      ? cacheGet(cache.hazardTypes, comp.hazard_type_name, 'hazard_types')
      : null;

    const componentId = await upsert(conn, 'components', ['creature_id', 'name'], {
      creature_id: creatureId,
      harvest_tag_id: tagId,
      skill_id: skillId,
      hazard_type_id: hazardTypeId,
      ...pick(comp, COMPONENT_COLUMNS),
    });

    await conn.query('DELETE FROM component_alternate_skills WHERE component_id = ?', [componentId]);
    for (const altName of altSkillNames(comp.alternateSkills)) {
      const altId = cacheGet(cache.skills, altName, 'skills');
      await linkJunction(conn, 'component_alternate_skills', ['component_id', 'skill_id'], [
        componentId,
        altId,
      ]);
    }
  }

  if (creatureData.signatureTable) {
    const signatureTableId = await upsert(conn, 'signature_tables', ['creature_id'], {
      creature_id: creatureId,
      name: creatureData.signatureTable.name,
      description: creatureData.signatureTable.description || null,
    });

    for (const row of creatureData.signatureTable.rows || []) {
      const skillId = row.skill_name ? cacheGet(cache.skills, row.skill_name, 'skills') : null;
      const rowId = await upsert(conn, 'signature_rows', ['signature_table_id', 'name'], {
        signature_table_id: signatureTableId,
        skill_id: skillId,
        ...pick(row, SIGNATURE_ROW_COLUMNS),
      });

      await conn.query('DELETE FROM signature_row_alternate_skills WHERE signature_row_id = ?', [rowId]);
      for (const altName of altSkillNames(row.alternateSkills)) {
        const altId = cacheGet(cache.skills, altName, 'skills');
        await linkJunction(conn, 'signature_row_alternate_skills', ['signature_row_id', 'skill_id'], [
          rowId,
          altId,
        ]);
      }
    }
  }

  return creatureId;
}

async function importBuyer(conn, buyerData, cache) {
  const buyerId = await upsert(conn, 'buyers', ['name'], {
    name: buyerData.name,
    buyer_type: buyerData.buyer_type || 'Standard',
    default_sale_percentage: buyerData.default_sale_percentage,
    location_id: null,
    campaign_id: null,
    notes: buyerData.notes || null,
    moral_legal_warning: buyerData.moral_legal_warning || null,
  });

  await conn.query('DELETE FROM buyer_accepted_tags WHERE buyer_id = ?', [buyerId]);
  for (const tagName of buyerData.acceptedTags || []) {
    const tagId = cacheGet(cache.harvestTags, tagName, 'harvest_tags');
    await linkJunction(conn, 'buyer_accepted_tags', ['buyer_id', 'harvest_tag_id'], [buyerId, tagId]);
  }

  await conn.query('DELETE FROM buyer_rejected_tags WHERE buyer_id = ?', [buyerId]);
  for (const tagName of buyerData.rejectedTags || []) {
    const tagId = cacheGet(cache.harvestTags, tagName, 'harvest_tags');
    await linkJunction(conn, 'buyer_rejected_tags', ['buyer_id', 'harvest_tag_id'], [buyerId, tagId]);
  }

  return buyerId;
}

// Whole-file atomicity for the JSON importer — fine at JSON-import scale
// (a handful of creatures/buyers exported as one deliberate snapshot).
async function importAll(conn, data) {
  const cache = await buildReferenceCache(conn);
  const result = { creatures: 0, buyers: 0 };
  for (const creatureData of data.creatures || []) {
    await importCreature(conn, creatureData, cache);
    result.creatures += 1;
  }
  for (const buyerData of data.buyers || []) {
    await importBuyer(conn, buyerData, cache);
    result.buyers += 1;
  }
  return result;
}

const isDeadlock = (err) => err.code === 'ER_LOCK_DEADLOCK' || err.errno === 1213;
const isLockTimeout = (err) => err.code === 'ER_LOCK_WAIT_TIMEOUT' || err.errno === 1205;

// One transaction per creature instead of one transaction for the whole
// file: at CSV-bulk-import scale (thousands of creatures), a single
// multi-minute transaction holds locks long enough to collide with anything
// else touching the same reference rows (including a double-submitted
// import), and an all-or-nothing rollback of an hour's worth of work over
// one bad row is exactly the wrong failure mode for "bulk-load my bestiary."
// Each creature gets its own short transaction, with a few retries if it
// hits a deadlock/lock-wait, and a failure is recorded and skipped rather
// than aborting the rest of the file.
async function importCreaturesWithReport(conn, creatures) {
  const cache = await buildReferenceCache(conn);
  const failures = [];
  let successCount = 0;

  for (const creatureData of creatures) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await conn.beginTransaction();
        await importCreature(conn, creatureData, cache);
        await conn.commit();
        successCount += 1;
        lastError = null;
        break;
      } catch (err) {
        await conn.rollback();
        lastError = err;
        if (isDeadlock(err) || isLockTimeout(err)) continue; // retry
        break; // not a transient error — no point retrying
      }
    }
    if (lastError) failures.push({ name: creatureData.name, error: lastError.message });
  }

  return { successCount, failures };
}

module.exports = { importAll, importCreaturesWithReport };
