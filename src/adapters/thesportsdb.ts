import type { Game } from '../types.ts';
import type { LocalizeOpts } from '../util.ts';
import { fetchJson, formatLocalTime, isRecord, localDateOf } from '../util.ts';

const LEAGUE_ID = '5206'; // Mexico Liga MX Femenil
const API = 'https://www.thesportsdb.com/api/v1/json/123';

interface TsdbEvent {
  idEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  /** UTC, no offset suffix, e.g. "2026-05-17T18:00:00". */
  strTimestamp?: string;
  strStatus?: string | null;
  strVenue?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
}

interface TsdbResponse {
  events?: TsdbEvent[] | null;
}

const FINAL_STATUSES = new Set(['FT', 'AET', 'PEN', 'Match Finished', 'Finished']);
const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);

function toStatus(event: TsdbEvent, startISO: string, now: Date): Game['status'] {
  const s = event.strStatus ?? '';
  if (FINAL_STATUSES.has(s)) return 'final';
  if (LIVE_STATUSES.has(s) || /^\d+'?$/.test(s)) return 'live';
  // Data-entry gap fallback: scores present on a game that started hours ago means it ended.
  const hasScore = event.intHomeScore != null && event.intAwayScore != null;
  if (hasScore && now.getTime() - new Date(startISO).getTime() > 3 * 3600_000) return 'final';
  return 'scheduled';
}

function toScore(value: string | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function shortName(name: string): string {
  return name
    .replace(/^(CF|CD|Club|Deportivo)\s+/i, '')
    .replace(/\s+Femenil$/i, '')
    .trim();
}

export function normalizeTsdb(raw: unknown, opts: LocalizeOpts, now: Date): Game[] {
  if (!isRecord(raw)) return [];
  const response = raw as TsdbResponse;
  const games: Game[] = [];
  for (const event of response.events ?? []) {
    if (event.idEvent === undefined || event.strTimestamp === undefined) continue;
    const startISO = `${event.strTimestamp}Z`;
    const status = toStatus(event, startISO, now);
    games.push({
      id: `ligamxfemenil-${event.idEvent}`,
      league: 'ligamxfemenil',
      leagueLabel: 'Liga MX Femenil',
      localDate: localDateOf(startISO, opts.timeZone),
      startISO,
      startLocal: formatLocalTime(startISO, opts),
      status,
      home: { name: event.strHomeTeam ?? 'TBD', abbrev: shortName(event.strHomeTeam ?? 'TBD'), logoUrl: event.strHomeTeamBadge },
      away: { name: event.strAwayTeam ?? 'TBD', abbrev: shortName(event.strAwayTeam ?? 'TBD'), logoUrl: event.strAwayTeamBadge },
      homeScore: status === 'scheduled' ? undefined : toScore(event.intHomeScore),
      awayScore: status === 'scheduled' ? undefined : toScore(event.intAwayScore),
      venue: event.strVenue,
    });
  }
  return games;
}

export async function fetchLigaMxFemenil(opts: LocalizeOpts, now: Date): Promise<Game[]> {
  // Free-tier endpoints: last 15 results + next 15 fixtures — always spans the window.
  const [past, next] = await Promise.all([
    fetchJson(`${API}/eventspastleague.php?id=${LEAGUE_ID}`),
    fetchJson(`${API}/eventsnextleague.php?id=${LEAGUE_ID}`),
  ]);
  const games = [...normalizeTsdb(past, opts, now), ...normalizeTsdb(next, opts, now)];
  const byId = new Map(games.map((g) => [g.id, g]));
  return [...byId.values()];
}
