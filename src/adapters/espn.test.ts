import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ESPN_WNBA, normalizeEspn } from './espn.ts';

const OPTS = { timeZone: 'America/Mexico_City', locale: 'es-MX' };
const fixture: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/espn-wnba-scoreboard.json', import.meta.url), 'utf8'),
);

test('normalizes the WNBA scoreboard', () => {
  const games = normalizeEspn(fixture, ESPN_WNBA, OPTS);
  assert.equal(games.length, 2);
  const liberty = games.find((g) => g.id === 'wnba-401857046');
  assert.ok(liberty);
  assert.equal(liberty.league, 'wnba');
  assert.equal(liberty.home.abbrev, 'NY');
  assert.equal(liberty.away.abbrev, 'DAL');
  assert.equal(liberty.venue, 'Barclays Center');
  assert.equal(liberty.tv, 'ESPN');
  assert.ok(liberty.home.logoUrl?.includes('espncdn'));
});

test('midnight-UTC tipoff buckets to the local calendar day', () => {
  const games = normalizeEspn(fixture, ESPN_WNBA, OPTS);
  for (const g of games) {
    assert.equal(g.localDate, '2026-07-07'); // events are 00:00Z and 02:00Z on July 8 UTC
  }
});

test('scheduled games expose no scores even though ESPN sends "0"', () => {
  const games = normalizeEspn(fixture, ESPN_WNBA, OPTS);
  for (const g of games) {
    assert.equal(g.status, 'scheduled');
    assert.equal(g.homeScore, undefined);
    assert.equal(g.awayScore, undefined);
    assert.equal(g.statusDetail, undefined);
  }
});
