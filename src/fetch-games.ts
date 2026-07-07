import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchEspn, ESPN_NBA, ESPN_NWSL, ESPN_WNBA } from './adapters/espn.ts';
import { fetchPwhl } from './adapters/hockeytech.ts';
import { fetchMlb } from './adapters/mlb.ts';
import { fetchLigaMxFemenil } from './adapters/thesportsdb.ts';
import { loadConfig, PROJECT_ROOT, resolveTimezone } from './config.ts';
import { mergeArchiveDays, mergeHistory } from './history.ts';
import type { CalendarioData, Config, DayGames, Game, LeagueId, LeagueResult } from './types.ts';
import type { LocalizeOpts } from './util.ts';
import { addDays, gameMatchesTeams, localDateOf } from './util.ts';

const WEB_DIR = join(PROJECT_ROOT, 'web');
const DATA_JSON = join(WEB_DIR, 'data.json');
const DATA_JS = join(WEB_DIR, 'data.js');
const ARCHIVE_DIR = join(PROJECT_ROOT, 'archive');

interface DateRange {
  startDate: string;
  endDate: string;
}

function readPrevious(): CalendarioData | null {
  try {
    return JSON.parse(readFileSync(DATA_JSON, 'utf8')) as CalendarioData;
  } catch {
    return null;
  }
}

async function runLeague(
  league: LeagueId,
  config: Config,
  fetcher: () => Promise<Game[]>,
): Promise<{ result: LeagueResult; games: Game[] }> {
  const leagueConfig = config.leagues[league];
  if (!leagueConfig.enabled) return { result: { league, ok: true, count: 0 }, games: [] };
  try {
    const games = (await fetcher()).filter((g) => gameMatchesTeams(g, leagueConfig.teams));
    return { result: { league, ok: true, count: games.length }, games };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${league}] ${message}`);
    return { result: { league, ok: false, count: 0, error: message }, games: [] };
  }
}

function writeArchive(archivedDays: DayGames[]): void {
  if (archivedDays.length === 0) return;
  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const byMonth = new Map<string, DayGames[]>();
  for (const day of archivedDays) {
    const month = day.date.slice(0, 7);
    const bucket = byMonth.get(month);
    if (bucket) bucket.push(day);
    else byMonth.set(month, [day]);
  }
  for (const [month, days] of byMonth) {
    const path = join(ARCHIVE_DIR, `${month}.json`);
    let existing: DayGames[] = [];
    try {
      existing = JSON.parse(readFileSync(path, 'utf8')) as DayGames[];
    } catch {
      // First archive entry for this month.
    }
    writeFileSync(path, JSON.stringify(mergeArchiveDays(existing, days), null, 1));
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const timeZone = resolveTimezone(config);
  const opts: LocalizeOpts = { timeZone, locale: config.locale };
  const now = new Date();
  const today = localDateOf(now.toISOString(), timeZone);
  const range: DateRange = {
    startDate: addDays(today, -config.historyDays),
    endDate: addDays(today, config.upcomingDays),
  };

  const runs = await Promise.all([
    runLeague('mlb', config, () => fetchMlb(range, opts)),
    runLeague('wnba', config, () => fetchEspn(ESPN_WNBA, range, opts)),
    runLeague('nba', config, () => fetchEspn(ESPN_NBA, range, opts)),
    runLeague('nwsl', config, () => fetchEspn(ESPN_NWSL, range, opts)),
    runLeague('ligamxfemenil', config, () => fetchLigaMxFemenil(opts, now)),
    runLeague('pwhl', config, () => fetchPwhl(range, opts)),
  ]);

  const fresh = runs.flatMap((r) => r.games);
  const leagues = runs.map((r) => r.result);
  const { data, archivedDays } = mergeHistory(readPrevious(), fresh, {
    generatedAt: now.toISOString(),
    timezone: timeZone,
    locale: config.locale,
    today,
    historyDays: config.historyDays,
    upcomingDays: config.upcomingDays,
    leagues,
  });

  mkdirSync(WEB_DIR, { recursive: true });
  writeFileSync(DATA_JSON, JSON.stringify(data, null, 1));
  writeFileSync(DATA_JS, `window.CALENDARIO = ${JSON.stringify(data)};\n`);
  writeArchive(archivedDays);

  const todayCount = data.days.find((d) => d.date === today)?.games.length ?? 0;
  const failures = leagues.filter((l) => !l.ok);
  console.log(
    `${today}: ${todayCount} game(s) today, ${data.days.length} day(s) in window` +
      (failures.length > 0 ? `, FAILED: ${failures.map((f) => f.league).join(', ')}` : ''),
  );
}

await main();
