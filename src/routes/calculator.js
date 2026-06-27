const express = require('express');
const pool = require('../db/pool');
const creaturesRepo = require('../repositories/creatures');
const buyersRepo = require('../repositories/buyers');
const inventoryRepo = require('../repositories/materialsInventory');
const sessionsRepo = require('../repositories/harvestSessions');
const lookups = require('../repositories/lookups');
const rules = require('../lib/harvest-rules');

const router = express.Router();

async function loadLookups() {
  const [
    creatures,
    buyers,
    sessions,
    bodyConditionModifiers,
    deathTimeModifiers,
    toolModifiers,
    environmentModifiers,
    settings,
    dcTable,
    sizeTimeRules,
    hazardDamageByLevel,
  ] = await Promise.all([
    creaturesRepo.list({}),
    buyersRepo.list({}),
    sessionsRepo.list(),
    lookups.bodyConditionModifiers(),
    lookups.deathTimeModifiers(),
    lookups.toolModifiers(),
    lookups.environmentModifiers(),
    lookups.settings(),
    lookups.dcByLevel(),
    lookups.sizeTimeRules(),
    lookups.hazardDamageByLevel(),
  ]);
  return {
    creatures,
    buyers,
    sessions,
    bodyConditionModifiers,
    deathTimeModifiers,
    toolModifiers,
    environmentModifiers,
    settings,
    dcTable,
    sizeTimeRules,
    hazardDamageByLevel,
  };
}

async function loreOptionsForComponent(componentId) {
  if (!componentId) return [];
  const [rows] = await pool.query(
    `SELECT l.id, l.name, cl.dc_modifier
     FROM component_lores cl JOIN lores l ON l.id = cl.lore_id
     WHERE cl.component_id = ?`,
    [componentId]
  );
  return rows;
}

// Components (componentsRepo.listByCreature) and signature rows
// (signatureTablesRepo.getByCreatureId) both shape their primary/alternate
// skills the same way (skill_id/skill_name + an alternateSkills array), so
// one helper covers "which skills can be used for this action" either way.
function skillOptionsFor(record) {
  const options = [];
  if (record.skill_id) options.push({ id: record.skill_id, name: record.skill_name });
  for (const alt of record.alternateSkills || []) {
    if (!options.some((o) => o.id === alt.id)) options.push({ id: alt.id, name: alt.name });
  }
  return options;
}

// Shared by the GET picker (live recompute) and the POST save-as-attempt
// handler so both resolve the exact same DC/value/hazard result from the
// same set of submitted params.
async function resolveCalculation(params, lookupData) {
  const { dcTable, sizeTimeRules, settings, hazardDamageByLevel } = lookupData;

  if (!params.creatureId) return null;
  const creature = await creaturesRepo.getById(params.creatureId);
  if (!creature) return null;

  let selection = null;
  if (params.target) {
    const [type, idStr] = params.target.split(':');
    const id = Number(idStr);
    if (type === 'component') {
      const record = creature.components.find((c) => c.id === id);
      if (record) selection = { type: 'component', record };
    } else if (type === 'signature' && creature.signatureTable) {
      const record = creature.signatureTable.rows.find((r) => r.id === id);
      if (record) selection = { type: 'signature', record };
    }
  }
  if (!selection) return { creature, selection: null };

  const skillOptions = skillOptionsFor(selection.record);
  const selectedSkillId =
    params.skillId !== undefined && params.skillId !== ''
      ? Number(params.skillId)
      : selection.record.skill_id || null;

  const baseDc = rules.baseDcForLevel(creature.level, dcTable);
  const modifiers = [];
  let impossible = false;

  if (selection.type === 'component') {
    const comp = selection.record;
    modifiers.push({
      label: `Component: ${comp.name}`,
      value: comp.use_manual_dc ? comp.manual_dc : comp.base_dc_modifier,
    });
  } else {
    modifiers.push({ label: `Signature: ${selection.record.name}`, value: selection.record.dc_modifier });
  }

  if (params.bodyConditionId) {
    const bc = lookupData.bodyConditionModifiers.find((b) => b.id === Number(params.bodyConditionId));
    if (bc) {
      if (bc.is_impossible) impossible = true;
      else modifiers.push({ label: `Body condition: ${bc.name}`, value: bc.dc_modifier });
    }
  }
  if (params.deathTimeId) {
    const dt = lookupData.deathTimeModifiers.find((d) => d.id === Number(params.deathTimeId));
    if (dt) modifiers.push({ label: `Time since death: ${dt.name}`, value: dt.dc_modifier });
  }
  if (params.toolId) {
    const tool = lookupData.toolModifiers.find((t) => t.id === Number(params.toolId));
    if (tool) modifiers.push({ label: `Tool: ${tool.name}`, value: tool.dc_modifier });
  }
  if (params.environmentId) {
    const env = lookupData.environmentModifiers.find((e) => e.id === Number(params.environmentId));
    if (env) modifiers.push({ label: `Environment: ${env.name}`, value: env.dc_modifier });
  }

  let loreOptions = [];
  if (selection.type === 'component') {
    loreOptions = await loreOptionsForComponent(selection.record.id);
    if (params.loreId) {
      const lore = loreOptions.find((l) => l.id === Number(params.loreId));
      if (lore) modifiers.push({ label: `Lore: ${lore.name}`, value: lore.dc_modifier });
    }
  }

  const finalDcResult = rules.finalDc({ baseDc, modifiers });

  let timeMinutes;
  let timeDisplay;
  if (selection.type === 'signature') {
    timeMinutes = selection.record.time_minutes;
    timeDisplay = selection.record.time_display;
  } else {
    const sizeRule = sizeTimeRules.find((s) => s.size === creature.size);
    timeMinutes = sizeRule ? sizeRule.per_component_minutes : null;
  }

  const selectedBuyer = params.buyerId
    ? lookupData.buyers.find((b) => b.id === Number(params.buyerId))
    : null;

  const buyerPct =
    params.buyerPct !== undefined && params.buyerPct !== ''
      ? Number(params.buyerPct)
      : selectedBuyer
        ? selectedBuyer.default_sale_percentage
        : settings.default_sale_percentage;

  // §10 buyer accepted/rejected tags gate the sale, not the harvest — only
  // meaningful once a component (with a real harvest_tag) is selected.
  let buyerWarning = null;
  if (selectedBuyer && selection.type === 'component') {
    const tagName = selection.record.harvest_tag_name;
    if (selectedBuyer.rejectedTags.includes(tagName)) {
      buyerWarning = `${selectedBuyer.name} won't take ${tagName} components.`;
      if (selectedBuyer.moral_legal_warning) buyerWarning += ` ${selectedBuyer.moral_legal_warning}`;
    } else if (selectedBuyer.acceptedTags.length && !selectedBuyer.acceptedTags.includes(tagName)) {
      buyerWarning = `${selectedBuyer.name} doesn't typically deal in ${tagName} components.`;
    }
  }

  let rollResult = null;
  if (!impossible && params.rollDie !== undefined && params.rollDie !== '') {
    const naturalDie = Number(params.rollDie);
    const skillBonus = params.skillBonus !== undefined && params.skillBonus !== '' ? Number(params.skillBonus) : 0;
    const total = naturalDie + skillBonus;
    const { degree, shifted } = rules.degreeOfSuccess(total, finalDcResult.dc, naturalDie);
    const quality = rules.qualityForDegree(degree, params.gmOverrideQuality || null);

    let valueResult = null;
    let saleValueCp = null;
    let resultText = null;

    if (selection.type === 'component') {
      const comp = selection.record;
      const totalHarvestValueCp = rules.totalHarvestValueCp(creature.level, {
        manual: creature.use_manual_value ? creature.manual_total_harvest_value_cp : null,
      });
      const craftingValueCp = rules.componentValueCp(totalHarvestValueCp, comp);
      const allowExceedCap =
        creature.is_signature || (quality === 'Pristine' && settings.pristine_can_exceed_cap);
      valueResult = rules.valueForQuality(craftingValueCp, quality, { allowExceedCap });
      const effectiveBuyerPct = comp.sale_value_percentage !== null ? comp.sale_value_percentage : buyerPct;
      saleValueCp = rules.saleValueCp(valueResult.valueCp, effectiveBuyerPct);
    } else {
      // Signature rows are narrative, not formula-valued (CLAUDE.md §12 only
      // specifies result text + crafting uses for them, no value_percentage).
      const textByQuality = {
        Pristine: selection.record.critical_success_text,
        Standard: selection.record.success_text,
        Poor: selection.record.failure_text,
        Ruined: selection.record.critical_failure_text,
      };
      resultText = textByQuality[quality];
    }

    let hazard = null;
    if (selection.type === 'component' && selection.record.is_hazardous) {
      const hazardSaveType = selection.record.hazard_save_type || null;
      hazard = rules.hazardFor({
        level: creature.level,
        isHazardous: true,
        degree,
        finalDc: finalDcResult.dc,
        hazardDcModifier: selection.record.hazard_dc_modifier,
        saveType: hazardSaveType,
        damageTable: hazardDamageByLevel,
      });
    }

    rollResult = { total, naturalDie, skillBonus, degree, shifted, quality, valueResult, saleValueCp, resultText, hazard };
  }

  return {
    creature,
    selection,
    impossible,
    loreOptions,
    skillOptions,
    selectedSkillId,
    breakdown: { baseDc, dc: finalDcResult.dc, modifiers: finalDcResult.breakdown, timeMinutes, timeDisplay },
    selectedBuyer,
    buyerPct,
    buyerWarning,
    rollResult,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const lookupData = await loadLookups();
    const calculation = await resolveCalculation(req.query, lookupData);
    res.render('calculator/index', { title: 'Harvest Calculator', ...lookupData, query: req.query, calculation });
  } catch (err) {
    next(err);
  }
});

router.post('/save-attempt', async (req, res, next) => {
  try {
    const lookupData = await loadLookups();
    const calculation = await resolveCalculation(req.body, lookupData);
    if (!calculation || !calculation.selection || !calculation.rollResult) {
      return res.status(400).render('errors/500', {
        title: 'Error',
        message: 'Cannot save an attempt without a creature, a target, and a roll.',
      });
    }

    const { creature, selection, breakdown, rollResult, selectedSkillId } = calculation;
    const isComponent = selection.type === 'component';

    await pool.query(
      `INSERT INTO harvest_attempts (
        harvest_session_id, creature_id, component_id, signature_row_id, skill_id,
        body_condition_modifier_id, death_time_modifier_id, tool_modifier_id,
        environment_modifier_id, lore_id, final_dc, dc_modifiers_json,
        roll_total, natural_die, degree_of_success, quality, gm_override_quality,
        crafting_value_cp, hazard_triggered, hazard_damage_dice, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.sessionId || null,
        creature.id,
        isComponent ? selection.record.id : null,
        isComponent ? null : selection.record.id,
        selectedSkillId,
        req.body.bodyConditionId || null,
        req.body.deathTimeId || null,
        req.body.toolId || null,
        req.body.environmentId || null,
        isComponent ? req.body.loreId || null : null,
        breakdown.dc,
        JSON.stringify(breakdown.modifiers),
        rollResult.total,
        rollResult.naturalDie,
        rollResult.degree,
        rollResult.quality,
        Boolean(req.body.gmOverrideQuality),
        rollResult.valueResult ? rollResult.valueResult.valueCp : null,
        Boolean(rollResult.hazard),
        rollResult.hazard ? rollResult.hazard.damageDice : null,
        isComponent ? null : rollResult.resultText,
      ]
    );

    res.redirect(
      `${req.app.locals.basePath}/calculator?creatureId=${creature.id}&target=${req.body.target}&saved=1`
    );
  } catch (err) {
    next(err);
  }
});

router.post('/add-to-inventory', async (req, res, next) => {
  try {
    const lookupData = await loadLookups();
    const calculation = await resolveCalculation(req.body, lookupData);
    if (!calculation || !calculation.selection || !calculation.rollResult) {
      return res.status(400).render('errors/500', {
        title: 'Error',
        message: 'Cannot add to inventory without a creature, a target, and a roll.',
      });
    }

    const { creature, selection, rollResult } = calculation;
    const isComponent = selection.type === 'component';

    const id = await inventoryRepo.create({
      component_id: isComponent ? selection.record.id : null,
      creature_id: creature.id,
      name: selection.record.name,
      quality: rollResult.quality,
      crafting_value_cp: rollResult.valueResult ? rollResult.valueResult.valueCp : 0,
      status: 'available',
    });

    res.redirect(`${req.app.locals.basePath}/inventory/${id}/edit`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
