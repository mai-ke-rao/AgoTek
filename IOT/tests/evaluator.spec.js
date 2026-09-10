const { test, expect } = require('@playwright/test');
const { evaluate, compare, evaluateClause, toNumber, valueKey } = require('../automation/evaluator');

// §7.1 — deterministic, no DB, no server. The evaluator is the layer wired to
// real hardware, so its truth table is pinned exactly.

const clause = (overrides = {}) => ({
  devId: 'sensor',
  variable: 'temperature',
  comparator: 'gt',
  threshold: 30,
  ...overrides,
});

const latest = (entries) => new Map(Object.entries(entries));

test.describe('compare — every comparator at the boundary', () => {
  const table = [
    // comparator, value, threshold, expected
    ['lt', 29, 30, true], ['lt', 30, 30, false], ['lt', 31, 30, false],
    ['lte', 29, 30, true], ['lte', 30, 30, true], ['lte', 31, 30, false],
    ['gt', 29, 30, false], ['gt', 30, 30, false], ['gt', 31, 30, true],
    ['gte', 29, 30, false], ['gte', 30, 30, true], ['gte', 31, 30, true],
    ['eq', 30, 30, true], ['eq', 30.0001, 30, false],
    ['neq', 30, 30, false], ['neq', 29, 30, true],
  ];

  for (const [comparator, value, threshold, expected] of table) {
    test(`${value} ${comparator} ${threshold} → ${expected}`, () => {
      expect(compare(comparator, value, threshold)).toBe(expected);
    });
  }

  test('unknown comparator is false, not a throw', () => {
    expect(compare('between', 1, 2)).toBe(false);
  });
});

test.describe('evaluateClause', () => {
  test('true when the latest value satisfies the comparison', () => {
    expect(evaluateClause(clause(), latest({ 'sensor:temperature': 35 }))).toBe(true);
  });

  test('missing variable is false and does not throw', () => {
    expect(evaluateClause(clause(), latest({}))).toBe(false);
    expect(evaluateClause(clause(), latest({ 'sensor:humidity': 99 }))).toBe(false);
  });

  test('non-numeric values are false', () => {
    for (const bad of ['warm', '', null, undefined, {}, [], NaN]) {
      expect(evaluateClause(clause(), latest({ 'sensor:temperature': bad }))).toBe(false);
    }
  });

  test('numeric strings and booleans are coerced', () => {
    expect(evaluateClause(clause(), latest({ 'sensor:temperature': '35.5' }))).toBe(true);
    expect(evaluateClause(clause({ comparator: 'eq', threshold: 1 }), latest({ 'sensor:temperature': true }))).toBe(true);
  });

  test('is keyed by device AND variable', () => {
    expect(evaluateClause(clause({ devId: 'other' }), latest({ 'sensor:temperature': 35 }))).toBe(false);
  });
});

test.describe('evaluate — combinators', () => {
  const temp = clause();
  const humidity = clause({ variable: 'humidity', comparator: 'lt', threshold: 50 });

  test('AND: one true, one false → false', () => {
    expect(evaluate('AND', [temp, humidity], latest({ 'sensor:temperature': 35, 'sensor:humidity': 70 }))).toBe(false);
  });

  test('AND: both true → true', () => {
    expect(evaluate('AND', [temp, humidity], latest({ 'sensor:temperature': 35, 'sensor:humidity': 40 }))).toBe(true);
  });

  test('OR: either true → true', () => {
    expect(evaluate('OR', [temp, humidity], latest({ 'sensor:temperature': 10, 'sensor:humidity': 40 }))).toBe(true);
    expect(evaluate('OR', [temp, humidity], latest({ 'sensor:temperature': 35, 'sensor:humidity': 70 }))).toBe(true);
  });

  test('OR: neither true → false', () => {
    expect(evaluate('OR', [temp, humidity], latest({ 'sensor:temperature': 10, 'sensor:humidity': 70 }))).toBe(false);
  });

  test('AND with a missing variable is false', () => {
    expect(evaluate('AND', [temp, humidity], latest({ 'sensor:temperature': 35 }))).toBe(false);
  });

  test('no clauses is false, never vacuously true', () => {
    expect(evaluate('AND', [], latest({}))).toBe(false);
    expect(evaluate('OR', [], latest({}))).toBe(false);
  });

  test('single-clause rule behaves the same under either combinator', () => {
    expect(evaluate('AND', [temp], latest({ 'sensor:temperature': 35 }))).toBe(true);
    expect(evaluate('OR', [temp], latest({ 'sensor:temperature': 35 }))).toBe(true);
  });
});

test.describe('helpers', () => {
  test('valueKey joins device and variable', () => {
    expect(valueKey('dev', 'temperature')).toBe('dev:temperature');
  });

  test('toNumber', () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(true)).toBe(1);
    expect(Number.isNaN(toNumber('abc'))).toBe(true);
    expect(Number.isNaN(toNumber(null))).toBe(true);
  });
});
