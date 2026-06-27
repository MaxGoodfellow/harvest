const test = require('node:test');
const assert = require('node:assert/strict');
const { degreeOfSuccess } = require('../src/lib/degrees');

test('degreeOfSuccess: critical success at dc+10', () => {
  assert.equal(degreeOfSuccess(30, 20, 15).degree, 'critical_success');
});

test('degreeOfSuccess: success at exactly dc', () => {
  assert.equal(degreeOfSuccess(20, 20, 15).degree, 'success');
});

test('degreeOfSuccess: failure below dc but above dc-10', () => {
  assert.equal(degreeOfSuccess(15, 20, 10).degree, 'failure');
});

test('degreeOfSuccess: critical failure at dc-10 or below', () => {
  assert.equal(degreeOfSuccess(10, 20, 5).degree, 'critical_failure');
});

test('degreeOfSuccess: nat 20 shifts success up to critical success', () => {
  const result = degreeOfSuccess(20, 20, 20);
  assert.equal(result.degree, 'critical_success');
  assert.equal(result.shifted, true);
});

test('degreeOfSuccess: nat 20 shifts failure up to success', () => {
  const result = degreeOfSuccess(15, 20, 20);
  assert.equal(result.degree, 'success');
  assert.equal(result.shifted, true);
});

test('degreeOfSuccess: nat 20 clamps at critical success (no further shift)', () => {
  const result = degreeOfSuccess(35, 20, 20);
  assert.equal(result.degree, 'critical_success');
  assert.equal(result.shifted, false);
});

test('degreeOfSuccess: nat 1 shifts success down to failure', () => {
  const result = degreeOfSuccess(20, 20, 1);
  assert.equal(result.degree, 'failure');
  assert.equal(result.shifted, true);
});

test('degreeOfSuccess: nat 1 clamps at critical failure (no further shift)', () => {
  const result = degreeOfSuccess(5, 20, 1);
  assert.equal(result.degree, 'critical_failure');
  assert.equal(result.shifted, false);
});

test('degreeOfSuccess: non-1/20 natural die does not shift', () => {
  const result = degreeOfSuccess(20, 20, 12);
  assert.equal(result.degree, 'success');
  assert.equal(result.shifted, false);
});
