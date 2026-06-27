// PF2e Harvesting Manager rules engine. Pure functions only — no DB, no I/O.
// Modifier VALUES come from seed tables and are passed in; formulas live here.
// See CLAUDE.md §8 for the spec this module implements.
const { degreeOfSuccess } = require('./degrees');

// §8.1 — base DC from creature level, looked up from the dc_by_level seed table.
function baseDcForLevel(level, dcTable) {
  const row = dcTable.find((r) => Number(r.level) === Number(level));
  if (!row) throw new Error(`No DC entry for level ${level}`);
  return row.dc;
}

// §8.2 — Total Harvest Value. use_manual_value creatures pass `manual` and
// get it back verbatim (a deliberate GM override, not subject to the floor).
// Negative levels square positive, so the floor logic runs unconditionally
// rather than special-casing level < 0.
function totalHarvestValueCp(level, { manual } = {}) {
  if (manual !== undefined && manual !== null) return manual;
  const raw = Math.round(level * level * 200);
  if (level <= -1) return Math.max(raw, 50);
  if (level === 0) return Math.max(raw, 100);
  if (level === 1) return Math.max(raw, 200);
  return raw;
}

// §8.3 — component value: fixed override or % of total harvest value.
function componentValueCp(totalCp, component) {
  if (component.use_fixed_value) return component.fixed_crafting_value_cp;
  return Math.round(totalCp * (Number(component.value_percentage) / 100));
}

// §8.3 — design-time cap check: sum of percentage-based components' value_
// percentage must not exceed 100% unless the creature is_signature. Fixed-
// value components are excluded since they're not part of the percentage
// allocation.
function componentAllocationWarning(components, { isSignature = false } = {}) {
  const sumPercentage = components.reduce((sum, c) => {
    if (c.use_fixed_value) return sum;
    return sum + Number(c.value_percentage || 0);
  }, 0);
  return { sumPercentage, overCap: !isSignature && sumPercentage > 100 };
}

// §8.4 — final DC: base + every modifier in the breakdown array.
function finalDc({ baseDc, modifiers = [] }) {
  const dc = modifiers.reduce((sum, m) => sum + m.value, baseDc);
  return { dc, breakdown: [{ label: 'Base DC', value: baseDc }, ...modifiers] };
}

// §8.6 — quality from degree of success, GM-overridable.
const QUALITY_BY_DEGREE = {
  critical_success: 'Pristine',
  success: 'Standard',
  failure: 'Poor',
  critical_failure: 'Ruined',
};

function qualityForDegree(degree, gmOverride) {
  if (gmOverride) return gmOverride;
  const quality = QUALITY_BY_DEGREE[degree];
  if (!quality) throw new Error(`Unknown degree: ${degree}`);
  return quality;
}

// §8.7 — value by quality. Pristine (150%) is clamped back to the component's
// Standard (100%) value unless allowExceedCap is set (signature creature, or
// the pristine_can_exceed_cap setting is on).
const QUALITY_PERCENTAGES = { Poor: 0.25, Standard: 1, Pristine: 1.5, Ruined: 0 };

function valueForQuality(craftingValueCp, quality, { allowExceedCap = false } = {}) {
  const pct = QUALITY_PERCENTAGES[quality];
  if (pct === undefined) throw new Error(`Unknown quality: ${quality}`);
  let valueCp = Math.round(craftingValueCp * pct);
  let cappedAt100 = false;
  if (quality === 'Pristine' && !allowExceedCap && valueCp > craftingValueCp) {
    valueCp = craftingValueCp;
    cappedAt100 = true;
  }
  return { valueCp, cappedAt100 };
}

// §8.8 — sale value.
function saleValueCp(craftingValueCp, buyerPct) {
  return Math.round(craftingValueCp * (buyerPct / 100));
}

// §8.9 — hazard on critical failure (or failure, if the GM opts in via
// triggerOnFailure). damageTable rows are {level_min, level_max, damage_dice}.
function hazardFor({
  level,
  isHazardous,
  degree,
  finalDc: finalDcValue,
  hazardDcModifier = 0,
  saveType,
  damageTable,
  triggerOnFailure = false,
}) {
  if (!isHazardous) return null;
  const triggers = degree === 'critical_failure' || (triggerOnFailure && degree === 'failure');
  if (!triggers) return null;

  const band = damageTable.find((b) => level >= b.level_min && level <= b.level_max);
  if (!band) throw new Error(`No hazard damage band for level ${level}`);

  return {
    damageDice: band.damage_dice,
    saveType,
    hazardDc: finalDcValue + hazardDcModifier,
  };
}

module.exports = {
  baseDcForLevel,
  totalHarvestValueCp,
  componentValueCp,
  componentAllocationWarning,
  finalDc,
  degreeOfSuccess,
  qualityForDegree,
  valueForQuality,
  saleValueCp,
  hazardFor,
};
