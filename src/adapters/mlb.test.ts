import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gameMatchesTeams } from '../util.ts';
import { normalizeMlb } from './mlb.ts';

const OPTS = { timeZone: 'America/Mexico_City', locale: 'es-MX' };
const fixture: unknown = JSON.parse(readFileSync(new URL('./fixtures/mlb-schedule.json', import.meta.url), 'utf8'));

test('normalizes a week of Dodgers games', () => {
  const games = normalizeMlb(fixture, OPTS);
  assert.equal(games.length, 7);
  for (const g of games) {
    assert.equal(g.league, 'mlb');
    assert.match(g.id, /^mlb-\d+$/);
    assert.ok(g.startLocal.length > 0);
  }
});

test('night game after UTC midnight buckets to the local calendar day', () => {
  const games = normalizeMlb(fixture, OPTS);
  const tonight = games.find((g) => g.startISO === '2026-07-08T02:10:00Z');
  assert.ok(tonight);
  assert.equal(tonight.localDate, '2026-07-07');
  assert.equal(tonight.status, 'scheduled');
  assert.equal(tonight.home.abbrev, 'LAD');
  assert.equal(tonight.away.abbrev, 'COL');
  assert.equal(tonight.homeScore, undefined);
  assert.equal(tonight.statusDetail, undefined);
});

test('finished game carries final status and scores', () => {
  const games = normalizeMlb(fixture, OPTS);
  const first = games.find((g) => g.startISO === '2026-07-02T01:40:00Z');
  assert.ok(first);
  assert.equal(first.status, 'final');
  assert.equal(first.homeScore, 7);
  assert.equal(first.awayScore, 1);
});

test('team filter matches by name fragment, abbrev, and id', () => {
  const games = normalizeMlb(fixture, OPTS);
  assert.equal(games.filter((g) => gameMatchesTeams(g, ['Dodgers'])).length, 7);
  assert.equal(games.filter((g) => gameMatchesTeams(g, ['LAD'])).length, 7);
  assert.equal(games.filter((g) => gameMatchesTeams(g, ['119'])).length, 7);
  assert.equal(games.filter((g) => gameMatchesTeams(g, ['Yankees'])).length, 0);
  assert.equal(games.filter((g) => gameMatchesTeams(g, 'all')).length, 7);
});
