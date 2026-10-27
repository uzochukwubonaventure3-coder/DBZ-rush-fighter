import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';

export const ROUNDS_TO_WIN = 2; // best of 3 (project spec). Not read from match.h, which was not available.

const load = (n: string) => JSON.parse(readFileSync(new URL(`../../contracts/${n}`, import.meta.url), 'utf8'));
export const matchSchema = load('match.v1.schema.json');
export const replaySchema = load('replay.v1.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const matchCheck = ajv.compile(matchSchema);
const replayCheck = ajv.compile(replaySchema);

export interface Style { punches: number; kicks: number; specials: number; jumps: number; crouches: number }
export interface Round {
  round_number: number; winner: 'p1' | 'p2' | 'draw'; duration_sec: number;
  p1_hits: number; p2_hits: number; p1_blocks: number; p2_blocks: number;
  finishing_move: 'punch' | 'kick' | 'special' | 'none';
}
export interface MatchPayload {
  schema_version?: 1; game_id: string; match_id: string; timestamp: string;
  winner: 'player1' | 'player2' | 'none';
  player1: { name: string; character: string }; player2: { name: string; character: string };
  rounds: Round[]; p1_style: Style; p2_style: Style;
}
export interface ReplayPayload {
  match_id: string; fps: 60; total_frames: number; p1_character: string; p2_character: string;
  frames: { f: number; p1: string[]; p2: string[] }[];
}
export type Problem = { path: string; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Problem[] };

const fmt = (errs: any[] | null | undefined): Problem[] =>
  (errs ?? []).slice(0, 20).map((e) => ({ path: e.instancePath || '/', message: e.message ?? 'invalid' }));

const attacks = (s: Style) => s.punches + s.kicks + s.specials;

export function validateMatch(input: unknown, now = Date.now()): Result<MatchPayload> {
  if (!matchCheck(input)) return { ok: false, errors: fmt(matchCheck.errors) };
  const m = input as unknown as MatchPayload;
  const errs: Problem[] = [];

  m.rounds.forEach((r, i) => {
    if (r.round_number !== i + 1) errs.push({ path: `/rounds/${i}/round_number`, message: `expected ${i + 1}` });
    if (r.winner === 'draw' && r.finishing_move !== 'none') errs.push({ path: `/rounds/${i}/finishing_move`, message: 'a drawn round has no finishing move' });
    if (r.finishing_move === 'special') {
      const s = r.winner === 'p1' ? m.p1_style : r.winner === 'p2' ? m.p2_style : null;
      if (s && s.specials === 0) errs.push({ path: `/rounds/${i}/finishing_move`, message: 'special finish but winner threw no specials' });
    }
  });

  // Match result must follow from the rounds: first to ROUNDS_TO_WIN, and play stops there.
  let w1 = 0, w2 = 0, decidedAt = -1;
  m.rounds.forEach((r, i) => {
    if (decidedAt >= 0) return;
    if (r.winner === 'p1') w1++;
    if (r.winner === 'p2') w2++;
    if (w1 >= ROUNDS_TO_WIN || w2 >= ROUNDS_TO_WIN) decidedAt = i;
  });
  if (m.winner === 'none') {
    // game only emits "none" for an unfinished/undecided match; accepted but never rated
  } else {
    const expected = decidedAt >= 0 ? (w1 > w2 ? 'player1' : 'player2') : null;
    if (expected === null) errs.push({ path: '/winner', message: `no player reached ${ROUNDS_TO_WIN} round wins` });
    else if (expected !== m.winner) errs.push({ path: '/winner', message: `rounds say ${expected} won` });
    else if (decidedAt !== m.rounds.length - 1) errs.push({ path: '/rounds', message: 'rounds continue after the match was decided' });
  }

  // One hit per attack (hit_connected in the game), so connected attacks cannot exceed attacks thrown.
  const conn1 = m.rounds.reduce((a, r) => a + r.p1_hits + r.p2_blocks, 0);
  const conn2 = m.rounds.reduce((a, r) => a + r.p2_hits + r.p1_blocks, 0);
  if (conn1 > attacks(m.p1_style)) errs.push({ path: '/p1_style', message: 'more connected attacks than attacks thrown' });
  if (conn2 > attacks(m.p2_style)) errs.push({ path: '/p2_style', message: 'more connected attacks than attacks thrown' });

  const t = Date.parse(m.timestamp);
  if (t > now + 24 * 3600 * 1000) errs.push({ path: '/timestamp', message: 'timestamp is in the future' });

  return errs.length ? { ok: false, errors: errs } : { ok: true, value: m };
}

export function validateReplay(input: unknown): Result<ReplayPayload> {
  if (!replayCheck(input)) return { ok: false, errors: fmt(replayCheck.errors) };
  const r = input as unknown as ReplayPayload;
  const errs: Problem[] = [];
  let last = -1;
  for (let i = 0; i < r.frames.length; i++) {
    const f = r.frames[i].f;
    if (f <= last || f >= r.total_frames) { errs.push({ path: `/frames/${i}/f`, message: 'frame numbers must increase and stay below total_frames' }); break; }
    last = f;
  }
  return errs.length ? { ok: false, errors: errs } : { ok: true, value: r };
}

/** Stable hash input: same content => same string regardless of key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
