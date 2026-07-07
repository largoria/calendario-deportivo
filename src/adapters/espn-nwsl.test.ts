import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ESPN_NWSL, normalizeEspn } from './espn.ts';

const OPTS = { timeZone: 'America/Mexico_City', locale: 'es-MX' };
const fixture: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/espn-nwsl-scoreboard.json', import.meta.url), 'utf8'),
);

test('the generic ESPN adapter handles NWSL (soccer) scoreboards', () => {
  const games = normalizeEspn(fixture, ESPN_NWSL, OPTS);
  assert.ok(games.length >= 20); // 26 events in the captured 22-day window
  for (const g of games) {
    assert.equal(g.league, 'nwsl');
    assert.equal(g.leagueLabel, 'NWSL');
    assert.match(g.id, /^nwsl-\d+$/);
    assert.match(g.localDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  const finished = games.filter((g) => g.status === 'final');
  assert.ok(finished.length > 0);
  for (const g of finished) {
    assert.equal(typeof g.homeScore, 'number');
    assert.equal(typeof g.awayScore, 'number');
  }
  const scheduled = games.filter((g) => g.status === 'scheduled');
  assert.ok(scheduled.length > 0, 'fixture window should include upcoming fixtures');
});
