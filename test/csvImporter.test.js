const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMonstersCsv } = require('../src/repositories/csvImporter');

function baseRow(overrides = {}) {
  return {
    'Monster Name': 'Wolf',
    Level: '1',
    Size: 'Medium',
    Rarity: '',
    'Creature Type': 'Animal',
    'Intelligence Category': '',
    'Harvest Tier': '1',
    'Required Proficiency': '',
    Tags: 'Hide;Meat',
    'Is Signature': '',
    'Is Morally Sensitive': '',
    'Use Manual Value': '',
    'Manual Total Harvest Value (cp)': '',
    Description: '',
    'GM Notes': '',
    'Component Name': '',
    'Component Harvest Tag': '',
    'Component Skill': '',
    'Component Alt Skills': '',
    'Component Description': '',
    'Component Base DC Modifier': '',
    'Component Use Manual DC': '',
    'Component Manual DC': '',
    'Component Use Fixed Value': '',
    'Component Fixed Value (cp)': '',
    'Component Value Percentage': '',
    'Component Sale Value Percentage Override': '',
    'Component Is Hazardous': '',
    'Component Hazard Type': '',
    'Component Hazard Save Type Override': '',
    'Component Hazard DC Modifier': '',
    'Component Crafting Uses': '',
    'Component Is Formula Required': '',
    'Component Is Formula Unlocking': '',
    'Component Sort Order': '',
    ...overrides,
  };
}

test('parses a monster with no components when all component fields are blank', () => {
  const { creatures, errors } = parseMonstersCsv([baseRow()]);
  assert.deepEqual(errors, []);
  assert.equal(creatures.length, 1);
  assert.equal(creatures[0].name, 'Wolf');
  assert.equal(creatures[0].level, 1);
  assert.deepEqual(creatures[0].tags, ['Hide', 'Meat']);
  assert.deepEqual(creatures[0].components, []);
});

test('groups multiple rows with the same Monster Name into one creature with multiple components', () => {
  const rows = [
    baseRow({ 'Component Name': 'Wolf Hide', 'Component Harvest Tag': 'Hide', 'Component Value Percentage': '30' }),
    baseRow({ 'Component Name': 'Wolf Meat', 'Component Harvest Tag': 'Meat', 'Component Value Percentage': '20' }),
  ];
  const { creatures, errors } = parseMonstersCsv(rows);
  assert.deepEqual(errors, []);
  assert.equal(creatures.length, 1);
  assert.equal(creatures[0].components.length, 2);
  assert.equal(creatures[0].components[0].name, 'Wolf Hide');
  assert.equal(creatures[0].components[1].name, 'Wolf Meat');
});

test('ignores monster-level fields on rows after the first for the same monster', () => {
  const rows = [
    baseRow({ Level: '1' }),
    baseRow({ Level: '99', 'Component Name': 'Wolf Hide', 'Component Harvest Tag': 'Hide', 'Component Value Percentage': '30' }),
  ];
  const { creatures, errors } = parseMonstersCsv(rows);
  assert.deepEqual(errors, []);
  assert.equal(creatures[0].level, 1);
});

test('requires Monster Name, Level, Size, Creature Type, and Harvest Tier', () => {
  const row = baseRow({ 'Monster Name': '', Level: '', Size: '', 'Creature Type': '', 'Harvest Tier': '' });
  const { errors } = parseMonstersCsv([row]);
  assert.match(errors.join('\n'), /Row 2: Monster Name is required/);
});

test('validates Size against the allowed enum', () => {
  const { errors } = parseMonstersCsv([baseRow({ Size: 'Massive' })]);
  assert.match(errors.join('\n'), /Row 2: Size must be one of Tiny, Small, Medium, Large, Huge, Gargantuan/);
});

test('requires Component Harvest Tag when Component Name is set', () => {
  const { errors } = parseMonstersCsv([baseRow({ 'Component Name': 'Wolf Hide', 'Component Value Percentage': '30' })]);
  assert.match(errors.join('\n'), /Row 2: Component Harvest Tag is required/);
});

test('requires Component Value Percentage unless Component Use Fixed Value is true', () => {
  const { errors } = parseMonstersCsv([baseRow({ 'Component Name': 'Wolf Hide', 'Component Harvest Tag': 'Hide' })]);
  assert.match(errors.join('\n'), /Component Value Percentage is required unless/);
});

test('requires Component Fixed Value (cp) when Component Use Fixed Value is true, and skips the percentage requirement', () => {
  const row = baseRow({
    'Component Name': 'Wolf Hide',
    'Component Harvest Tag': 'Hide',
    'Component Use Fixed Value': 'true',
  });
  const { errors } = parseMonstersCsv([row]);
  assert.match(errors.join('\n'), /Component Fixed Value \(cp\) is required when/);
  assert.doesNotMatch(errors.join('\n'), /Component Value Percentage is required/);
});

test('parses boolean fields case-insensitively in several spellings', () => {
  for (const truthy of ['true', 'TRUE', 'yes', '1']) {
    const { creatures, errors } = parseMonstersCsv([baseRow({ 'Is Signature': truthy })]);
    assert.deepEqual(errors, []);
    assert.equal(creatures[0].is_signature, true, `expected "${truthy}" to parse as true`);
  }
  for (const falsy of ['false', 'FALSE', 'no', '0', '']) {
    const { creatures, errors } = parseMonstersCsv([baseRow({ 'Is Signature': falsy })]);
    assert.deepEqual(errors, []);
    assert.equal(creatures[0].is_signature, false, `expected "${falsy}" to parse as false`);
  }
});

test('rejects an unrecognized boolean value with a row-numbered error', () => {
  const { errors } = parseMonstersCsv([baseRow({ 'Is Signature': 'maybe' })]);
  assert.match(errors.join('\n'), /Row 2: Is Signature must be true\/false \(got "maybe"\)/);
});

test('splits Tags and Component Alt Skills on semicolons and trims whitespace', () => {
  const row = baseRow({
    Tags: ' Hide ; Meat ;Bone',
    'Component Name': 'Wolf Hide',
    'Component Harvest Tag': 'Hide',
    'Component Value Percentage': '30',
    'Component Alt Skills': 'Crafting; Arcana',
  });
  const { creatures } = parseMonstersCsv([row]);
  assert.deepEqual(creatures[0].tags, ['Hide', 'Meat', 'Bone']);
  assert.deepEqual(creatures[0].components[0].alternateSkills, ['Crafting', 'Arcana']);
});

test('reports a row-numbered error for a non-integer Level', () => {
  const { errors } = parseMonstersCsv([baseRow({ Level: 'one' })]);
  assert.match(errors.join('\n'), /Row 2: Level must be a whole number \(got "one"\)/);
});

test('only flags Monster Name once and skips the rest of the row when it is blank', () => {
  const { creatures, errors } = parseMonstersCsv([baseRow({ 'Monster Name': '' })]);
  assert.equal(creatures.length, 0);
  assert.equal(errors.length, 1);
});
