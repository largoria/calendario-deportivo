import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeArchiveDays, mergeHistory } from './history.ts';
import type { CalendarioData, Game, LeagueResult } from './types.ts';

function game(overrides: Partial<Game> & { id: string; localDate: string }): Game {
  return {
    league: 'wnba',
    leagueLabel: 'WNBA',
    startISO: `${overrides.localDate}T23:00:00Z`,
    startLocal: '5:00 p.m.',
    status: 'scheduled',
    home: { name: 'Home', abbrev: 'HOM' },
    away: { name: 'Away', abbrev: 'AWY' },
    ...overrides,
  };
}

const LEAGUES: LeagueResult[] = [{ league: 'wnba', ok: true, count: 1 }];

function opts(today: string, overrides: { historyDays?: number; upcomingDays?: number; leagues?: LeagueResult[] } = {}) {
  return {
    generatedAt: `${today}T12:00:00Z`,
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today,
    historyDays: overrides.historyDays ?? 7,
    upcomingDays: overrides.upcomingDays ?? 14,
    leagues: overrides.leagues ?? LEAGUES,
  };
}

test('buckets fresh games by day, ascending, and always includes today', () => {
  const fresh = [
    game({ id: 'wnba-2', localDate: '2026-07-06' }),
    game({ id: 'wnba-1', localDate: '2026-07-05' }),
  ];
  const { data, archivedDays } = mergeHistory(null, fresh, opts('2026-07-07'));
  assert.deepEqual(data.days.map((d) => d.date), ['2026-07-05', '2026-07-06', '2026-07-07']);
  assert.equal(data.today, '2026-07-07');
  assert.deepEqual(data.days.at(-1)?.games, []);
  assert.deepEqual(archivedDays, []);
});

test('today is inserted in sorted position between history and upcoming', () => {
  const fresh = [
    game({ id: 'wnba-past', localDate: '2026-07-05', status: 'final' }),
    game({ id: 'wnba-future', localDate: '2026-07-10' }),
  ];
  const { data } = mergeHistory(null, fresh, opts('2026-07-07'));
  assert.deepEqual(data.days.map((d) => d.date), ['2026-07-05', '2026-07-07', '2026-07-10']);
  assert.deepEqual(data.days[1]?.games, []);
});

test('fresh game wins on id collision (status/score upgrade)', () => {
  const prev: CalendarioData = {
    generatedAt: '2026-07-07T06:00:00Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today: '2026-07-07',
    days: [{ date: '2026-07-07', games: [game({ id: 'wnba-1', localDate: '2026-07-07', status: 'scheduled' })] }],
    leagues: LEAGUES,
  };
  const fresh = [game({ id: 'wnba-1', localDate: '2026-07-07', status: 'final', homeScore: 90, awayScore: 81 })];
  const { data } = mergeHistory(prev, fresh, opts('2026-07-07'));
  const merged = data.days.at(-1)?.games[0];
  assert.equal(merged?.status, 'final');
  assert.equal(merged?.homeScore, 90);
});

test('games only present in the previous file survive the merge', () => {
  const prev: CalendarioData = {
    generatedAt: '2026-07-06T06:00:00Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today: '2026-07-06',
    days: [{ date: '2026-07-04', games: [game({ id: 'wnba-old', localDate: '2026-07-04', status: 'final' })] }],
    leagues: LEAGUES,
  };
  const { data } = mergeHistory(prev, [game({ id: 'wnba-new', localDate: '2026-07-07' })], opts('2026-07-07'));
  assert.ok(data.days.some((d) => d.games.some((g) => g.id === 'wnba-old')));
});

test('days beyond the window are pruned into archivedDays', () => {
  const prev: CalendarioData = {
    generatedAt: '2026-07-06T06:00:00Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today: '2026-07-06',
    days: [
      { date: '2026-06-25', games: [game({ id: 'wnba-ancient', localDate: '2026-06-25', status: 'final' })] },
      { date: '2026-07-05', games: [game({ id: 'wnba-recent', localDate: '2026-07-05', status: 'final' })] },
    ],
    leagues: LEAGUES,
  };
  const { data, archivedDays } = mergeHistory(prev, [], opts('2026-07-07'));
  assert.ok(!data.days.some((d) => d.date === '2026-06-25'));
  assert.ok(data.days.some((d) => d.date === '2026-07-05'));
  assert.deepEqual(archivedDays.map((d) => d.date), ['2026-06-25']);
  assert.equal(archivedDays[0]?.games[0]?.id, 'wnba-ancient');
});

test('upcoming fixtures are kept up to the horizon and dropped beyond it', () => {
  const fresh = [
    game({ id: 'wnba-soon', localDate: '2026-07-09' }),
    game({ id: 'wnba-horizon', localDate: '2026-07-21' }),
    game({ id: 'wnba-too-far', localDate: '2026-07-22' }),
  ];
  const { data, archivedDays } = mergeHistory(null, fresh, opts('2026-07-07'));
  assert.deepEqual(data.days.map((d) => d.date), ['2026-07-07', '2026-07-09', '2026-07-21']);
  assert.deepEqual(archivedDays, []);
});

test('upcoming fixture no longer listed by a healthy source is dropped', () => {
  const prev: CalendarioData = {
    generatedAt: '2026-07-06T06:00:00Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today: '2026-07-06',
    days: [
      { date: '2026-07-05', games: [game({ id: 'wnba-played', localDate: '2026-07-05', status: 'final' })] },
      { date: '2026-07-10', games: [game({ id: 'wnba-canceled', localDate: '2026-07-10' })] },
    ],
    leagues: LEAGUES,
  };
  const { data } = mergeHistory(prev, [], opts('2026-07-07'));
  assert.ok(data.days.some((d) => d.games.some((g) => g.id === 'wnba-played')));
  assert.ok(!data.days.some((d) => d.games.some((g) => g.id === 'wnba-canceled')));
});

test('upcoming fixtures survive when their league fetch failed this run', () => {
  const prev: CalendarioData = {
    generatedAt: '2026-07-06T06:00:00Z',
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    today: '2026-07-06',
    days: [{ date: '2026-07-10', games: [game({ id: 'wnba-keep', localDate: '2026-07-10' })] }],
    leagues: LEAGUES,
  };
  const failed: LeagueResult[] = [{ league: 'wnba', ok: false, count: 0, error: 'HTTP 500' }];
  const { data } = mergeHistory(prev, [], opts('2026-07-07', { leagues: failed }));
  assert.ok(data.days.some((d) => d.games.some((g) => g.id === 'wnba-keep')));
});

test('games within a day sort by start time', () => {
  const fresh = [
    game({ id: 'wnba-late', localDate: '2026-07-07', startISO: '2026-07-08T02:00:00Z' }),
    game({ id: 'wnba-early', localDate: '2026-07-07', startISO: '2026-07-08T00:00:00Z' }),
  ];
  const { data } = mergeHistory(null, fresh, opts('2026-07-07'));
  assert.deepEqual(data.days[0]?.games.map((g) => g.id), ['wnba-early', 'wnba-late']);
});

test('mergeArchiveDays dedupes by game id across days', () => {
  const existing = [{ date: '2026-06-25', games: [game({ id: 'wnba-a', localDate: '2026-06-25' })] }];
  const incoming = [
    { date: '2026-06-25', games: [game({ id: 'wnba-a', localDate: '2026-06-25' }), game({ id: 'wnba-b', localDate: '2026-06-25' })] },
    { date: '2026-06-26', games: [game({ id: 'wnba-c', localDate: '2026-06-26' })] },
  ];
  const merged = mergeArchiveDays(existing, incoming);
  assert.deepEqual(merged.map((d) => d.date), ['2026-06-25', '2026-06-26']);
  assert.deepEqual(merged[0]?.games.map((g) => g.id).sort(), ['wnba-a', 'wnba-b']);
});
