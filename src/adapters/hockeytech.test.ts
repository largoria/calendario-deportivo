import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizePwhl, seasonsInRange } from './hockeytech.ts';

const OPTS = { timeZone: 'America/Mexico_City', locale: 'es-MX' };
const schedule: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/hockeytech-schedule.json', import.meta.url), 'utf8'),
);
const seasons: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/hockeytech-seasons.json', import.meta.url), 'utf8'),
);

test('normalizes the PWHL playoff schedule', () => {
  const games = normalizePwhl(schedule, OPTS);
  assert.equal(games.length, 13);
  const opener = games.find((g) => g.id === 'pwhl-338');
  assert.ok(opener);
  assert.equal(opener.status, 'final');
  assert.equal(opener.home.abbrev, 'BOS');
  assert.equal(opener.away.abbrev, 'OTT');
  assert.equal(opener.homeScore, 2);
  assert.equal(opener.awayScore, 1);
  assert.equal(opener.localDate, '2026-04-30'); // 19:00-04:00 → 17:00 in Mexico City
  assert.equal(opener.statusDetail, 'Final');
});

test('season overlap: off-season range selects no seasons, playoff range does', () => {
  assert.deepEqual(seasonsInRange(seasons, { startDate: '2026-07-01', endDate: '2026-07-07' }), []);
  const may = seasonsInRange(seasons, { startDate: '2026-05-20', endDate: '2026-05-27' });
  assert.ok(may.includes('9'));
});
