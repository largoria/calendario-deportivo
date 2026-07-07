import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeTsdb } from './thesportsdb.ts';

const OPTS = { timeZone: 'America/Mexico_City', locale: 'es-MX' };
const NOW = new Date('2026-07-07T18:00:00Z');
const past: unknown = JSON.parse(readFileSync(new URL('./fixtures/tsdb-past.json', import.meta.url), 'utf8'));
const next: unknown = JSON.parse(readFileSync(new URL('./fixtures/tsdb-next.json', import.meta.url), 'utf8'));

test('normalizes a finished Liga MX Femenil match', () => {
  const games = normalizeTsdb(past, OPTS, NOW);
  assert.equal(games.length, 1);
  const final = games[0];
  assert.ok(final);
  assert.equal(final.id, 'ligamxfemenil-2472485');
  assert.equal(final.league, 'ligamxfemenil');
  assert.equal(final.status, 'final');
  assert.equal(final.homeScore, 3);
  assert.equal(final.awayScore, 0);
  assert.equal(final.localDate, '2026-05-17'); // 18:00Z → 12:00 in Mexico City
  assert.equal(final.venue, 'Estadio Ciudad de los Deportes');
});

test('shortens club names for display', () => {
  const games = normalizeTsdb(past, OPTS, NOW);
  const final = games[0];
  assert.ok(final);
  assert.equal(final.home.name, 'CF América Femenil');
  assert.equal(final.home.abbrev, 'América');
  assert.equal(final.away.abbrev, 'Monterrey');
});

test('off-season empty payload (events: null) yields no games', () => {
  assert.deepEqual(normalizeTsdb(next, OPTS, NOW), []);
});
