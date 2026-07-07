export type LeagueId = 'mlb' | 'wnba' | 'nba' | 'nwsl' | 'ligamxfemenil' | 'pwhl';

export type GameStatus = 'scheduled' | 'live' | 'final';

export interface TeamInfo {
  /** Stable id in the source API (e.g. MLB "119"), when available. */
  id?: string;
  name: string;
  abbrev: string;
  logoUrl?: string;
}

export interface Game {
  /** League-prefixed stable id, e.g. "mlb-823929". Merge key across runs. */
  id: string;
  league: LeagueId;
  leagueLabel: string;
  /** Calendar day in the user's timezone (YYYY-MM-DD). Bucketing key. */
  localDate: string;
  startISO: string;
  /** Pre-formatted start time, e.g. "7:10 p.m." */
  startLocal: string;
  status: GameStatus;
  /** Source wording for live/final nuance, e.g. "Final/11", "Q3 5:12". */
  statusDetail?: string;
  home: TeamInfo;
  away: TeamInfo;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  tv?: string;
}

export interface DayGames {
  date: string;
  games: Game[];
}

export interface LeagueResult {
  league: LeagueId;
  ok: boolean;
  /** Games contributed this run (post team-filter). */
  count: number;
  error?: string;
}

export interface CalendarioData {
  generatedAt: string;
  timezone: string;
  locale: string;
  /** The local calendar day the file was generated on — anchor between past and upcoming. */
  today: string;
  /** Ascending by date: history, today (always present), then upcoming fixtures. */
  days: DayGames[];
  leagues: LeagueResult[];
}

export type TeamFilter = 'all' | string[];

export interface LeagueConfig {
  enabled: boolean;
  label: string;
  teams: TeamFilter;
}

export interface Config {
  historyDays: number;
  upcomingDays: number;
  locale: string;
  timezone: string | null;
  leagues: Record<LeagueId, LeagueConfig>;
}

export const LEAGUE_IDS: readonly LeagueId[] = ['mlb', 'wnba', 'nba', 'nwsl', 'ligamxfemenil', 'pwhl'];

export const LEAGUE_EMOJI: Record<LeagueId, string> = {
  mlb: '⚾',
  wnba: '🏀',
  nba: '🏀',
  nwsl: '⚽',
  ligamxfemenil: '⚽',
  pwhl: '🏒',
};
