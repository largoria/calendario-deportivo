import type { Game } from '../types.ts';
import type { LocalizeOpts } from '../util.ts';
import { fetchJson, formatLocalTime, isRecord, localDateOf } from '../util.ts';

const BASE =
  'https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&client_code=pwhl&key=446521baf8c38984&fmt=json';

interface HtSeason {
  season_id?: string;
  season_name?: string;
  start_date?: string;
  end_date?: string;
}

interface HtGame {
  game_id?: string;
  GameDateISO8601?: string;
  game_status?: string;
  started?: string;
  final?: string;
  home_team_name?: string;
  home_team_code?: string;
  visiting_team_name?: string;
  visiting_team_code?: string;
  home_goal_count?: string;
  visiting_goal_count?: string;
  venue_name?: string;
}

interface HtResponse {
  SiteKit?: {
    Seasons?: HtSeason[];
    Schedule?: HtGame[];
  };
}

function toStatus(g: HtGame): Game['status'] {
  if (g.final === '1') return 'final';
  if (g.started === '1') return 'live';
  return 'scheduled';
}

function toScore(value: string | undefined, status: Game['status']): number | undefined {
  if (status === 'scheduled' || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizePwhl(raw: unknown, opts: LocalizeOpts): Game[] {
  if (!isRecord(raw)) return [];
  const schedule = (raw as HtResponse).SiteKit?.Schedule ?? [];
  const games: Game[] = [];
  for (const g of schedule) {
    if (g.game_id === undefined || g.GameDateISO8601 === undefined) continue;
    const status = toStatus(g);
    games.push({
      id: `pwhl-${g.game_id}`,
      league: 'pwhl',
      leagueLabel: 'PWHL',
      localDate: localDateOf(g.GameDateISO8601, opts.timeZone),
      startISO: new Date(g.GameDateISO8601).toISOString(),
      startLocal: formatLocalTime(g.GameDateISO8601, opts),
      status,
      statusDetail: status === 'scheduled' ? undefined : g.game_status,
      home: { name: g.home_team_name ?? 'TBD', abbrev: g.home_team_code ?? g.home_team_name ?? 'TBD' },
      away: { name: g.visiting_team_name ?? 'TBD', abbrev: g.visiting_team_code ?? g.visiting_team_name ?? 'TBD' },
      homeScore: toScore(g.home_goal_count, status),
      awayScore: toScore(g.visiting_goal_count, status),
      venue: g.venue_name,
    });
  }
  return games;
}

/** Seasons whose [start_date, end_date] overlaps [startDate, endDate]. */
export function seasonsInRange(raw: unknown, range: { startDate: string; endDate: string }): string[] {
  if (!isRecord(raw)) return [];
  const seasons = (raw as HtResponse).SiteKit?.Seasons ?? [];
  return seasons
    .filter(
      (s) =>
        s.season_id !== undefined &&
        s.start_date !== undefined &&
        s.end_date !== undefined &&
        s.start_date <= range.endDate &&
        s.end_date >= range.startDate,
    )
    .map((s) => s.season_id as string);
}

export async function fetchPwhl(
  range: { startDate: string; endDate: string },
  opts: LocalizeOpts,
): Promise<Game[]> {
  const seasonIds = seasonsInRange(await fetchJson(`${BASE}&view=seasons`), range);
  // Off-season: no overlapping season, no games — skip the schedule calls entirely.
  const schedules = await Promise.all(
    seasonIds.map((id) => fetchJson(`${BASE}&view=schedule&season_id=${id}`)),
  );
  return schedules
    .flatMap((s) => normalizePwhl(s, opts))
    .filter((g) => g.localDate >= range.startDate && g.localDate <= range.endDate);
}
