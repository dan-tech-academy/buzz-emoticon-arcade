import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { mergeProgress } from '../src/progress.js';

const newer = { owned: ['smile', 'angel'], equipped: 'angel', level: 2, best: 500 };

test('equipment and checkpoint saves in an old tab preserve the newer resume stage', () => {
  const old = createGame(0, { owned: ['devil'], equipped: 'devil', score: 200 });
  const result = mergeProgress(newer, old);
  assert.equal(result.level, 2);
  assert.equal(result.equipped, 'devil');
  assert.equal(result.best, 500);
  assert.deepEqual(result.owned, ['smile', 'angel', 'devil']);
});

test('a stale boss win advances progress only if it is newer', () => {
  const old = createGame(0);
  assert.equal(mergeProgress(newer, old, 'advance').level, 2);
  assert.equal(mergeProgress({ ...newer, level: 0 }, old, 'advance').level, 1);
  assert.equal(mergeProgress(newer, createGame(2), 'advance').level, 2);
});

test('an intentional Angel replay can select stage1 without losing unlocks or best', () => {
  const replay = createGame(0, newer);
  const result = mergeProgress(newer, replay, 'restart');
  assert.equal(result.level, 0);
  assert.equal(result.equipped, 'angel');
  assert.deepEqual(result.owned, newer.owned);
  assert.equal(result.best, 500);
});

test('a new record is merged without rolling the selected stage back', () => {
  const old = createGame(0, { score: 900 });
  const result = mergeProgress(newer, old);
  assert.equal(result.best, 900);
  assert.equal(result.level, 2);
});
