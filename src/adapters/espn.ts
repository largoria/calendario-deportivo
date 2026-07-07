import type { Game, LeagueId } from '../types.ts';
import type { LocalizeOpts } from '../util.ts';
import { compactDate, fetchJson, formatLocalTime, isRecord, localDateOf } from '../util.ts';

interface EspnTeam {
  id?: string;
  displayName?: string;
  abbreviation?: string;
  logo?: string;
}

interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  team?: EspnTeam;
}

interface EspnCompetition {
  competitors?: EspnCompetitor[];
  venue?: { fullName?: string };
  broadcasts?: Array<{ names?: string[] }>;
}

interface EspnEvent {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; shortDetail?: string; description?: string } };
  competitions?: EspnCompetition[];
}

interface EspnScoreboard {
  events?: EspnEvent[];
}

export interface EspnLeagueSpec {
  league: LeagueId;
  leagueLabel: string;
  /** ESPN API path segment, e.g. "basketball/wnba". */
  path: string;
}

export const ESPN_WNBA: EspnLeagueSpec = { league: 'wnba', leagueLabel: 'WNBA', path: 'basketball/wnba' };
export const ESPN_NBA: EspnLeagueSpec = { league: 'nba', leagueLabel: 'NBA', path: 'basketball/nba' };
export const ESPN_NWSL: EspnLeagueSpec = { league: 'nwsl', leagueLabel: 'NWSL', path: 'soccer/usa.nwsl' };

function toStatus(state: string | undefined): Game['status'] {
  if (state === 'post') return 'final';
  if (state === 'in') return 'live';
  return 'scheduled';
}

function toTeamInfo(competitor: EspnCompetitor | undefined): Game['home'] {
  const team = competitor?.team ?? {};
  return {
    id: team.id,
    name: team.displayName ?? 'TBD',
    abbrev: team.abbreviation ?? team.displayName ?? 'TBD',
    logoUrl: team.logo,
  };
}

function toScore(competitor: EspnCompetitor | undefined, status: Game['status']): number | undefined {
  if (status === 'scheduled') return undefined;
  const n = Number(competitor?.score);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeEspn(raw: unknown, spec: EspnLeagueSpec, opts: LocalizeOpts): Game[] {
  if (!isRecord(raw)) return [];
  const response = raw as EspnScoreboard;
  const games: Game[] = [];
  for (const event of response.events ?? []) {
    if (event.id === undefined || event.date === undefined) continue;
    const competition = event.competitions?.[0];
    const home = competition?.competitors?.find((c) => c.homeAway === 'home');
    const away = competition?.competitors?.find((c) => c.homeAway === 'away');
    const status = toStatus(event.status?.type?.state);
    games.push({
      id: `${spec.league}-${event.id}`,
      league: spec.league,
      leagueLabel: spec.leagueLabel,
      localDate: localDateOf(event.date, opts.timeZone),
      startISO: event.date,
      startLocal: formatLocalTime(event.date, opts),
      status,
      statusDetail:
        status === 'scheduled' ? undefined : event.status?.type?.shortDetail ?? event.status?.type?.description,
      home: toTeamInfo(home),
      away: toTeamInfo(away),
      homeScore: toScore(home, status),
      awayScore: toScore(away, status),
      venue: competition?.venue?.fullName,
      tv: competition?.broadcasts?.[0]?.names?.[0],
    });
  }
  return games;
}

export async function fetchEspn(
  spec: EspnLeagueSpec,
  range: { startDate: string; endDate: string },
  opts: LocalizeOpts,
): Promise<Game[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/${spec.path}/scoreboard` +
    `?dates=${compactDate(range.startDate)}-${compactDate(range.endDate)}&limit=200`;
  return normalizeEspn(await fetchJson(url), spec, opts);
}
