import type { Game } from '../types.ts';
import type { LocalizeOpts } from '../util.ts';
import { fetchJson, formatLocalTime, isRecord, localDateOf } from '../util.ts';

interface MlbTeam {
  id?: number;
  name?: string;
  abbreviation?: string;
}

interface MlbGameSide {
  team?: MlbTeam;
  score?: number;
}

interface MlbGame {
  gamePk?: number;
  gameDate?: string;
  officialDate?: string;
  status?: { abstractGameState?: string; detailedState?: string };
  teams?: { home?: MlbGameSide; away?: MlbGameSide };
  venue?: { name?: string };
}

interface MlbScheduleResponse {
  dates?: Array<{ games?: MlbGame[] }>;
}

function toStatus(abstractGameState: string | undefined): Game['status'] {
  if (abstractGameState === 'Final') return 'final';
  if (abstractGameState === 'Live') return 'live';
  return 'scheduled';
}

function toTeamInfo(side: MlbGameSide | undefined): Game['home'] {
  const team = side?.team ?? {};
  return {
    id: team.id !== undefined ? String(team.id) : undefined,
    name: team.name ?? 'TBD',
    abbrev: team.abbreviation ?? team.name ?? 'TBD',
    logoUrl: team.id !== undefined ? `https://www.mlbstatic.com/team-logos/${team.id}.svg` : undefined,
  };
}

export function normalizeMlb(raw: unknown, opts: LocalizeOpts): Game[] {
  if (!isRecord(raw)) return [];
  const response = raw as MlbScheduleResponse;
  const games: Game[] = [];
  for (const date of response.dates ?? []) {
    for (const g of date.games ?? []) {
      if (g.gamePk === undefined || g.gameDate === undefined) continue;
      const status = toStatus(g.status?.abstractGameState);
      games.push({
        id: `mlb-${g.gamePk}`,
        league: 'mlb',
        leagueLabel: 'MLB',
        localDate: localDateOf(g.gameDate, opts.timeZone),
        startISO: g.gameDate,
        startLocal: formatLocalTime(g.gameDate, opts),
        status,
        statusDetail: status === 'scheduled' ? undefined : g.status?.detailedState,
        home: toTeamInfo(g.teams?.home),
        away: toTeamInfo(g.teams?.away),
        homeScore: g.teams?.home?.score,
        awayScore: g.teams?.away?.score,
        venue: g.venue?.name,
      });
    }
  }
  return games;
}

export async function fetchMlb(range: { startDate: string; endDate: string }, opts: LocalizeOpts): Promise<Game[]> {
  const url =
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1` +
    `&startDate=${range.startDate}&endDate=${range.endDate}&hydrate=team`;
  return normalizeMlb(await fetchJson(url), opts);
}
