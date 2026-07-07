import type { CalendarioData, DayGames, Game, LeagueResult } from './types.ts';
import { addDays } from './util.ts';

export interface MergeOpts {
  generatedAt: string;
  timezone: string;
  locale: string;
  today: string;
  historyDays: number;
  upcomingDays: number;
  leagues: LeagueResult[];
}

export interface MergeResult {
  data: CalendarioData;
  /** Days that fell out of the rolling window this run — destined for the archive. */
  archivedDays: DayGames[];
}

function bucketByDay(games: Iterable<Game>): DayGames[] {
  const byDate = new Map<string, Game[]>();
  for (const game of games) {
    const bucket = byDate.get(game.localDate);
    if (bucket) bucket.push(game);
    else byDate.set(game.localDate, [game]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayGames]) => ({
      date,
      games: dayGames.sort((a, b) => a.startISO.localeCompare(b.startISO) || a.id.localeCompare(b.id)),
    }));
}

/**
 * Merge freshly fetched games into the previous data file.
 * Fresh games win on id collision (scores/status advance); games only present in the
 * previous file survive, so results accumulate even if a source stops listing them.
 * Days older than the window are pruned and returned for archiving.
 */
export function mergeHistory(prev: CalendarioData | null, fresh: Game[], opts: MergeOpts): MergeResult {
  const freshIds = new Set(fresh.map((g) => g.id));
  const okLeagues = new Set(opts.leagues.filter((l) => l.ok).map((l) => l.league));
  const byId = new Map<string, Game>();
  for (const day of prev?.days ?? []) {
    for (const game of day.games) {
      // An upcoming fixture the (healthy) source no longer lists was rescheduled or
      // canceled — drop it. Past games always survive; failed leagues keep everything.
      const vanished =
        game.localDate > opts.today && okLeagues.has(game.league) && !freshIds.has(game.id);
      if (!vanished) byId.set(game.id, game);
    }
  }
  for (const game of fresh) byId.set(game.id, game);

  const cutoff = addDays(opts.today, -opts.historyDays);
  const horizon = addDays(opts.today, opts.upcomingDays);
  const kept: Game[] = [];
  const archived: Game[] = [];
  for (const game of byId.values()) {
    // The window is [cutoff, horizon]: history behind today, upcoming fixtures ahead.
    if (game.localDate > horizon) continue;
    if (game.localDate < cutoff) archived.push(game);
    else kept.push(game);
  }

  const days = bucketByDay(kept);
  // Today always exists so every surface can render an explicit "no games" state.
  if (!days.some((d) => d.date === opts.today)) {
    days.push({ date: opts.today, games: [] });
    days.sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    data: {
      generatedAt: opts.generatedAt,
      timezone: opts.timezone,
      locale: opts.locale,
      today: opts.today,
      days,
      leagues: opts.leagues,
    },
    archivedDays: bucketByDay(archived),
  };
}

/** Merge newly pruned days into an archive month's days (dedupe by game id, day-wise). */
export function mergeArchiveDays(existing: DayGames[], incoming: DayGames[]): DayGames[] {
  const byId = new Map<string, Game>();
  for (const day of [...existing, ...incoming]) {
    for (const game of day.games) {
      if (!byId.has(game.id)) byId.set(game.id, game);
    }
  }
  return bucketByDay(byId.values());
}
