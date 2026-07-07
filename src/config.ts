import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Config, LeagueConfig, LeagueId, TeamFilter } from './types.ts';
import { LEAGUE_IDS } from './types.ts';
import { isRecord } from './util.ts';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

function parseTeamFilter(value: unknown, league: string): TeamFilter {
  if (value === 'all') return 'all';
  if (Array.isArray(value) && value.every((t): t is string => typeof t === 'string')) return value;
  throw new Error(`config: leagues.${league}.teams must be "all" or an array of strings`);
}

function parseLeague(value: unknown, league: string): LeagueConfig {
  if (!isRecord(value)) throw new Error(`config: leagues.${league} must be an object`);
  if (typeof value.enabled !== 'boolean') throw new Error(`config: leagues.${league}.enabled must be a boolean`);
  if (typeof value.label !== 'string') throw new Error(`config: leagues.${league}.label must be a string`);
  return { enabled: value.enabled, label: value.label, teams: parseTeamFilter(value.teams, league) };
}

export function parseConfig(raw: unknown): Config {
  if (!isRecord(raw)) throw new Error('config: root must be an object');
  const { historyDays, upcomingDays, locale, timezone, leagues } = raw;
  if (typeof historyDays !== 'number' || !Number.isInteger(historyDays) || historyDays < 0) {
    throw new Error('config: historyDays must be a non-negative integer');
  }
  if (typeof upcomingDays !== 'number' || !Number.isInteger(upcomingDays) || upcomingDays < 0) {
    throw new Error('config: upcomingDays must be a non-negative integer');
  }
  if (typeof locale !== 'string') throw new Error('config: locale must be a string');
  if (timezone !== null && typeof timezone !== 'string') throw new Error('config: timezone must be a string or null');
  if (!isRecord(leagues)) throw new Error('config: leagues must be an object');

  const parsed = {} as Record<LeagueId, LeagueConfig>;
  for (const id of LEAGUE_IDS) {
    parsed[id] = parseLeague(leagues[id], id);
  }
  return { historyDays, upcomingDays, locale, timezone, leagues: parsed };
}

export function loadConfig(path: string = new URL('../config.json', import.meta.url).pathname): Config {
  return parseConfig(JSON.parse(readFileSync(path, 'utf8')));
}

export function resolveTimezone(config: Config): string {
  return config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
