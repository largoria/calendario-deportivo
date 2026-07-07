import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, PROJECT_ROOT } from './config.ts';
import type { CalendarioData, Config, DayGames, Game } from './types.ts';
import { LEAGUE_EMOJI } from './types.ts';
import { addDays, gameMatchesTeams } from './util.ts';

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const dim = (s: string): string => (useColor ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s: string): string => (useColor ? `\x1b[1m${s}\x1b[0m` : s);
const green = (s: string): string => (useColor ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (useColor ? `\x1b[31m${s}\x1b[0m` : s);

function scoreline(g: Game): string {
  return `${g.away.abbrev} ${g.awayScore ?? '?'}–${g.homeScore ?? '?'} ${g.home.abbrev}`;
}

function gameSummary(g: Game): string {
  if (g.status === 'final') return `${scoreline(g)} (final)`;
  if (g.status === 'live') return `${scoreline(g)} ${green('● ' + (g.statusDetail ?? 'en vivo'))}`;
  const tv = g.tv ? dim(` · ${g.tv}`) : '';
  return `${g.away.abbrev} @ ${g.home.abbrev} · ${g.startLocal}${tv}`;
}

function todayLines(today: DayGames, config: Config): string[] {
  const lines: string[] = [];
  const byLeague = new Map<string, Game[]>();
  for (const g of today.games) {
    const bucket = byLeague.get(g.league);
    if (bucket) bucket.push(g);
    else byLeague.set(g.league, [g]);
  }
  for (const games of byLeague.values()) {
    const first = games[0];
    if (!first) continue;
    const emoji = LEAGUE_EMOJI[first.league];
    const label = config.leagues[first.league].label.padEnd(15);
    const detail =
      games.length === 1
        ? gameSummary(first)
        : `${games.length} juegos: ${games.map(gameSummary).join(dim('  |  '))}`;
    lines.push(`${emoji} ${bold(label)} ${detail}`);
  }
  return lines;
}

/** Yesterday's finals for leagues where specific teams are followed (e.g. the Dodgers). */
function yesterdayLines(yesterday: DayGames | undefined, config: Config): string[] {
  if (!yesterday) return [];
  const lines: string[] = [];
  for (const g of yesterday.games) {
    const leagueConfig = config.leagues[g.league];
    if (leagueConfig.teams === 'all' || g.status !== 'final') continue;
    if (!gameMatchesTeams(g, leagueConfig.teams)) continue;
    const followedIsHome = gameMatchesTeams({ ...g, away: { name: '', abbrev: '' } }, leagueConfig.teams);
    const followedScore = followedIsHome ? g.homeScore : g.awayScore;
    const rivalScore = followedIsHome ? g.awayScore : g.homeScore;
    const mark =
      followedScore !== undefined && rivalScore !== undefined
        ? followedScore > rivalScore
          ? green('✓')
          : red('✗')
        : '';
    lines.push(dim(`   ayer: ${scoreline(g)} `) + mark);
  }
  return lines;
}

function main(): void {
  const config = loadConfig();
  let data: CalendarioData;
  try {
    data = JSON.parse(readFileSync(join(PROJECT_ROOT, 'web', 'data.json'), 'utf8')) as CalendarioData;
  } catch {
    console.log(dim('calendario-deportivo: sin datos (corre `npm run fetch`)'));
    return;
  }

  const todayIndex = data.days.findIndex((d) => d.date === data.today);
  const today = data.days[todayIndex];
  if (!today) return;
  const prevDay = todayIndex > 0 ? data.days[todayIndex - 1] : undefined;
  const yesterday = prevDay?.date === addDays(data.today, -1) ? prevDay : undefined;

  const lines = todayLines(today, config);
  if (lines.length === 0) lines.push(dim('sin juegos hoy 😴'));
  lines.push(...yesterdayLines(yesterday, config));

  const updated = new Date(data.generatedAt);
  const ageHours = (Date.now() - updated.getTime()) / 3600e3;
  if (ageHours > 18) {
    lines.push(red(`   ⚠ datos de hace ${Math.round(ageHours)} h`));
  }

  console.log(lines.join('\n'));
}

main();
