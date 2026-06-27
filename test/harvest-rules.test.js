const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/lib/harvest-rules');

// Mirrors db/seeds/02_dc_by_level.js (CLAUDE.md §8.1)
const DC_TABLE = [
  [-1, 13], [0, 14], [1, 15], [2, 16], [3, 18], [4, 19], [5, 20], [6, 22],
  [7, 23], [8, 24], [9, 26], [10, 27], [11, 28], [12, 30], [13, 31], [14, 32],
  [15, 34], [16, 35], [17, 36], [18, 38], [19, 39], [20, 40],
].map(([level, dc]) => ({ level, dc }));

// Mirrors db/seeds/06_hazards.js (CLAUDE.md §8.9)
const HAZARD_DAMAGE_TABLE = [
  { level_min: -1, level_max: 2, damage_dice: '1d6' },
  { level_min: 3, level_max: 5, damage_dice: '2d6' },
  { level_min: 6, level_max: 8, damage_dice: '4d6' },
  { level_min: 9, level_max: 11, damage_dice: '6d6' },
  { level_min: 12, level_max: 14, damage_dice: '8d6' },
  { level_min: 15, level_max: 17, damage_dice: '10d6' },
  { level_min: 18, level_max: 20, damage_dice: '12d6' },
];

test('baseDcForLevel matches the full -1..20 table', () => {
  for (const { level, dc } of DC_TABLE) {
    assert.equal(rules.baseDcForLevel(level, DC_TABLE), dc);
  }
});

test('baseDcForLevel throws for an unseeded level', () => {
  assert.throws(() => rules.baseDcForLevel(99, DC_TABLE));
});

test('totalHarvestValueCp applies the level^2 * 200cp formula', () => {
  assert.equal(rules.totalHarvestValueCp(3), 1800);
  assert.equal(rules.totalHarvestValueCp(10), 20000);
});

test('totalHarvestValueCp floors level -1/0/1 to their minimums', () => {
  assert.equal(rules.totalHarvestValueCp(-1), 200); // (-1)^2*200=200, already above the 50cp floor
  assert.equal(rules.totalHarvestValueCp(0), 100); // 0^2*200=0, floored to 100cp
  assert.equal(rules.totalHarvestValueCp(1), 200); // 1^2*200=200, equals the 200cp floor
});

test('totalHarvestValueCp returns the manual override verbatim, bypassing the floor', () => {
  assert.equal(rules.totalHarvestValueCp(0, { manual: 10 }), 10);
});

test('componentValueCp computes a percentage of total harvest value', () => {
  const value = rules.componentValueCp(1000, { use_fixed_value: false, value_percentage: 30 });
  assert.equal(value, 300);
});

test('componentValueCp returns the fixed value when use_fixed_value is set', () => {
  const value = rules.componentValueCp(1000, { use_fixed_value: true, fixed_crafting_value_cp: 75 });
  assert.equal(value, 75);
});

test('componentAllocationWarning flags over-100% allocation for non-signature creatures', () => {
  const components = [
    { value_percentage: 60 },
    { value_percentage: 50 },
  ];
  const result = rules.componentAllocationWarning(components, { isSignature: false });
  assert.equal(result.sumPercentage, 110);
  assert.equal(result.overCap, true);
});

test('componentAllocationWarning exempts signature creatures from the cap', () => {
  const components = [{ value_percentage: 60 }, { value_percentage: 50 }];
  const result = rules.componentAllocationWarning(components, { isSignature: true });
  assert.equal(result.overCap, false);
});

test('componentAllocationWarning ignores fixed-value components in the percentage sum', () => {
  const components = [{ value_percentage: 80 }, { use_fixed_value: true, fixed_crafting_value_cp: 500 }];
  const result = rules.componentAllocationWarning(components);
  assert.equal(result.sumPercentage, 80);
  assert.equal(result.overCap, false);
});

test('finalDc sums modifiers and returns a labeled breakdown', () => {
  const result = rules.finalDc({
    baseDc: 18,
    modifiers: [
      { label: 'Component difficulty', value: 1 },
      { label: 'Body condition: Minor Damage', value: 1 },
      { label: 'Lore: Dragon Lore', value: -2 },
    ],
  });
  assert.equal(result.dc, 18);
  assert.deepEqual(result.breakdown, [
    { label: 'Base DC', value: 18 },
    { label: 'Component difficulty', value: 1 },
    { label: 'Body condition: Minor Damage', value: 1 },
    { label: 'Lore: Dragon Lore', value: -2 },
  ]);
});

test('qualityForDegree maps each degree to the spec quality', () => {
  assert.equal(rules.qualityForDegree('critical_success'), 'Pristine');
  assert.equal(rules.qualityForDegree('success'), 'Standard');
  assert.equal(rules.qualityForDegree('failure'), 'Poor');
  assert.equal(rules.qualityForDegree('critical_failure'), 'Ruined');
});

test('qualityForDegree respects a GM override', () => {
  assert.equal(rules.qualityForDegree('failure', 'Standard'), 'Standard');
});

test('valueForQuality applies 25/100/150% for Poor/Standard/Pristine', () => {
  assert.equal(rules.valueForQuality(1000, 'Poor').valueCp, 250);
  assert.equal(rules.valueForQuality(1000, 'Standard').valueCp, 1000);
  assert.equal(rules.valueForQuality(1000, 'Pristine', { allowExceedCap: true }).valueCp, 1500);
});

test('valueForQuality clamps Pristine to 100% unless allowExceedCap is set', () => {
  const result = rules.valueForQuality(1000, 'Pristine');
  assert.equal(result.valueCp, 1000);
  assert.equal(result.cappedAt100, true);
});

test('valueForQuality lets a signature/pristine_can_exceed_cap caller exceed the cap', () => {
  const result = rules.valueForQuality(1000, 'Pristine', { allowExceedCap: true });
  assert.equal(result.valueCp, 1500);
  assert.equal(result.cappedAt100, false);
});

test('saleValueCp rounds to the nearest copper', () => {
  assert.equal(rules.saleValueCp(999, 50), 500); // 499.5 -> 500
  assert.equal(rules.saleValueCp(100, 25), 25);
  assert.equal(rules.saleValueCp(100, 75), 75);
});

test('hazardFor returns null when the component is not hazardous', () => {
  assert.equal(
    rules.hazardFor({
      level: 5,
      isHazardous: false,
      degree: 'critical_failure',
      finalDc: 20,
      damageTable: HAZARD_DAMAGE_TABLE,
    }),
    null
  );
});

test('hazardFor returns null on a non-critical-failure degree by default', () => {
  assert.equal(
    rules.hazardFor({
      level: 5,
      isHazardous: true,
      degree: 'failure',
      finalDc: 20,
      damageTable: HAZARD_DAMAGE_TABLE,
    }),
    null
  );
});

test('hazardFor triggers on failure when triggerOnFailure is set', () => {
  const result = rules.hazardFor({
    level: 5,
    isHazardous: true,
    degree: 'failure',
    finalDc: 20,
    damageTable: HAZARD_DAMAGE_TABLE,
    triggerOnFailure: true,
    saveType: 'Fortitude',
  });
  assert.equal(result.damageDice, '2d6');
});

test('hazardFor picks the correct damage band and computes hazard DC', () => {
  const result = rules.hazardFor({
    level: 7,
    isHazardous: true,
    degree: 'critical_failure',
    finalDc: 24,
    hazardDcModifier: 2,
    saveType: 'Reflex',
    damageTable: HAZARD_DAMAGE_TABLE,
  });
  assert.deepEqual(result, { damageDice: '4d6', saveType: 'Reflex', hazardDc: 26 });
});

test('hazardFor covers the level -1 band', () => {
  const result = rules.hazardFor({
    level: -1,
    isHazardous: true,
    degree: 'critical_failure',
    finalDc: 13,
    saveType: 'Fortitude',
    damageTable: HAZARD_DAMAGE_TABLE,
  });
  assert.equal(result.damageDice, '1d6');
});
