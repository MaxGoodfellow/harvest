const test = require('node:test');
const assert = require('node:assert/strict');
const { toCp, fromCp, formatCp, formatMinutes, formatMinutesRange } = require('../src/lib/money');

test('toCp converts gp/sp/cp to copper', () => {
  assert.equal(toCp({ gp: 1, sp: 2, cp: 3 }), 123);
  assert.equal(toCp({ gp: 1 }), 100);
  assert.equal(toCp({}), 0);
});

test('fromCp converts copper back to gp/sp/cp', () => {
  assert.deepEqual(fromCp(123), { gp: 1, sp: 2, cp: 3 });
  assert.deepEqual(fromCp(0), { gp: 0, sp: 0, cp: 0 });
});

test('formatCp renders only non-zero denominations', () => {
  assert.equal(formatCp(1250), '12 gp 5 sp');
  assert.equal(formatCp(100), '1 gp');
  assert.equal(formatCp(0), '0 cp');
});

test('formatMinutes picks the right unit', () => {
  assert.equal(formatMinutes(30), '30 minutes');
  assert.equal(formatMinutes(60), '1 hour');
  assert.equal(formatMinutes(120), '2 hours');
  assert.equal(formatMinutes(1440), '1 day');
});

test('formatMinutesRange collapses equal min/max and matching units', () => {
  assert.equal(formatMinutesRange(120, 120), '2 hours');
  assert.equal(formatMinutesRange(1440, 2880), '1–2 days');
});
