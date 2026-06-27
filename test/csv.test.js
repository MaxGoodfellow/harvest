const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv, parseCsv } = require('../src/lib/csv');

test('toCsv renders a header row and one row per item', () => {
  const csv = toCsv(
    [{ name: 'Wolf', level: 1 }, { name: 'Bear', level: 3 }],
    [
      { label: 'Name', value: (r) => r.name },
      { label: 'Level', value: (r) => r.level },
    ]
  );
  assert.equal(csv, 'Name,Level\r\nWolf,1\r\nBear,3');
});

test('toCsv quotes and escapes cells containing commas, quotes, or newlines', () => {
  const csv = toCsv(
    [{ note: 'has, a comma' }, { note: 'has "quotes"' }, { note: 'has\na newline' }],
    [{ label: 'Note', value: (r) => r.note }]
  );
  assert.equal(csv, 'Note\r\n"has, a comma"\r\n"has ""quotes"""\r\n"has\na newline"');
});

test('toCsv renders null/undefined as an empty cell', () => {
  const csv = toCsv([{ value: null }, { value: undefined }], [{ label: 'V', value: (r) => r.value }]);
  assert.equal(csv, 'V\r\n\r\n');
});

test('parseCsv reads a header row and returns one object per data row', () => {
  const rows = parseCsv('Name,Level\r\nWolf,1\r\nBear,3');
  assert.deepEqual(rows, [
    { Name: 'Wolf', Level: '1' },
    { Name: 'Bear', Level: '3' },
  ]);
});

test('parseCsv handles quoted fields with commas, escaped quotes, and embedded newlines', () => {
  const rows = parseCsv('Note\r\n"has, a comma"\r\n"has ""quotes"""\r\n"has\na newline"');
  assert.deepEqual(rows, [
    { Note: 'has, a comma' },
    { Note: 'has "quotes"' },
    { Note: 'has\na newline' },
  ]);
});

test('parseCsv tolerates a leading BOM and bare \\n line endings', () => {
  const rows = parseCsv('﻿Name,Level\nWolf,1\nBear,3');
  assert.deepEqual(rows, [
    { Name: 'Wolf', Level: '1' },
    { Name: 'Bear', Level: '3' },
  ]);
});

test('parseCsv pads missing trailing cells with empty strings', () => {
  const rows = parseCsv('A,B,C\r\n1,2');
  assert.deepEqual(rows, [{ A: '1', B: '2', C: '' }]);
});

test('parseCsv returns an empty array for blank input', () => {
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('\r\n'), []);
});

test('toCsv and parseCsv round-trip values containing commas, quotes, and newlines', () => {
  const original = [{ name: 'Has, a comma' }, { name: 'Has "quotes"' }, { name: 'Has\na newline' }];
  const csv = toCsv(original, [{ label: 'name', value: (r) => r.name }]);
  const parsed = parseCsv(csv);
  assert.deepEqual(parsed, original);
});
