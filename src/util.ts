import type { Game, TeamFilter, TeamInfo } from './types.ts';

export interface LocalizeOpts {
  timeZone: string;
  locale: string;
}

/** YYYY-MM-DD of an instant in the given timezone. */
export function localDateOf(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function formatLocalTime(iso: string, { timeZone, locale }: LocalizeOpts): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** date ± n days, in pure YYYY-MM-DD arithmetic (no timezone involved). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** YYYYMMDD form ESPN's `dates` parameter expects. */
export function compactDate(date: string): string {
  return date.replaceAll('-', '');
}

function teamMatches(team: TeamInfo, needle: string): boolean {
  const n = needle.toLowerCase();
  return (
    team.id === needle ||
    team.abbrev.toLowerCase() === n ||
    team.name.toLowerCase().includes(n)
  );
}

/** A game passes if either side matches any configured needle (id, abbrev, or name fragment). */
export function gameMatchesTeams(game: Game, teams: TeamFilter): boolean {
  if (teams === 'all') return true;
  return teams.some((needle) => teamMatches(game.home, needle) || teamMatches(game.away, needle));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as unknown;
}
