import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_INACTIVITY_MS,
  getAutoCloseCutoffs,
  INITIAL_INACTIVITY_MS,
  parseDuration,
} from '../src/utils/ticketPolicy.ts';

test('parseDuration accepts supported units case-insensitively', () => {
  assert.equal(parseDuration('30s'), 30_000);
  assert.equal(parseDuration(' 2H '), 7_200_000);
  assert.equal(parseDuration('3d'), 259_200_000);
  assert.equal(parseDuration('2w'), 1_209_600_000);
});

test('parseDuration rejects malformed, zero, negative, and unsafe durations', () => {
  for (const value of ['', '0m', '-2h', '2 days', '1y', '999999999999999999w']) {
    assert.equal(parseDuration(value), null, value);
  }
});

test('auto-close cutoffs distinguish initial and active inactivity', () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const cutoffs = getAutoCloseCutoffs(now);

  assert.equal(cutoffs.initial.getTime(), now.getTime() - INITIAL_INACTIVITY_MS);
  assert.equal(cutoffs.active.getTime(), now.getTime() - ACTIVE_INACTIVITY_MS);
  assert.ok(cutoffs.active < cutoffs.initial);
});
