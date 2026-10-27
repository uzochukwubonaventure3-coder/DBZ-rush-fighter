import { createHash } from 'node:crypto';
import type { Db, Queryable } from './db';
import { canonical, type MatchPayload, type ReplayPayload } from './contracts';
import { eloUpdate } from './elo';
import { classify, features, perspective, type Perspective } from './analytics';
import { analyseReplay } from './replayInsights';
import { coachWithFallback, type CoachFacts, type CoachProvider } from './coach';
import { hashPassword, newToken, sha256, verifyPassword } from './auth';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export interface Player { id: string; username: string; rating: number }
const sha = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');

export interface Platform {
  db: Db;
  coach: CoachProvider | null;
  jobs: Set<Promise<unknown>>;
  idle(): Promise<void>;
}
export function createPlatform(db: Db, coach: CoachProvider | null): Platform {
  const jobs = new Set<Promise<unknown>>();
  return { db, coach, jobs, async idle() { while (jobs.size) await Promise.allSettled([...jobs]); } };
}

/* ---------------------------------------------------------------- accounts */
export async function registerPlayer(db: Db, username: string, password: string, seed = false) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new HttpError(422, 'username must be 3-20 letters, digits or underscores');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new HttpError(422, 'password must be 8-128 characters');
  const ingest = newToken('dbzi');
  try {
    const r = await db.query<{ id: string }>(
      `INSERT INTO players (username, password_hash, ingest_token_hash, is_seed) VALUES ($1,$2,$3,$4) RETURNING id`,
      [username, await hashPassword(password), sha256(ingest), seed]);
    return { id: r.rows[0].id, username, ingestToken: ingest, sessionToken: await createSession(db, r.rows[0].id) };
  } catch (e: any) {
    if (e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message))) throw new HttpError(409, 'username already taken');
    throw e;
  }
}
async function createSession(db: Queryable, playerId: string) {
  const t = newToken('dbzs');
  await db.query(`INSERT INTO sessions (token_hash, player_id, expires_at) VALUES ($1,$2, now() + interval '7 days')`, [sha256(t), playerId]);
  return t;
}
export async function login(db: Db, username: string, password: string) {
  const r = await db.query<any>(`SELECT id, password_hash FROM players WHERE lower(username) = lower($1)`, [String(username)]);
  // same work and same message whether or not the user exists
  const ok = r.rows[0] ? await verifyPassword(String(password), r.rows[0].password_hash) : (await verifyPassword('x', 'scrypt$AAAA$AAAA'), false);
  if (!ok) throw new HttpError(401, 'invalid username or password');
  return { sessionToken: await createSession(db, r.rows[0].id) };
}
export async function rotateIngestToken(db: Db, playerId: string) {
  const t = newToken('dbzi');
  await db.query(`UPDATE players SET ingest_token_hash = $2 WHERE id = $1`, [playerId, sha256(t)]);
  return t;
}
export async function playerFromSession(db: Db, token: string): Promise<Player | null> {
  const r = await db.query<Player>(`SELECT p.id, p.username, p.rating FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)]);
  return r.rows[0] ?? null;
}
export async function playerFromIngest(db: Db, token: string): Promise<Player | null> {
  const r = await db.query<Player>(`SELECT id, username, rating FROM players WHERE ingest_token_hash = $1`, [sha256(token)]);
  return r.rows[0] ?? null;
}

/* ------------------------------------------------------------------ ingest */
export interface IngestResult {
  id: string; duplicate: boolean; rated: boolean;
  ratings: { p1: { before: number; after: number }; p2?: { before: number; after: number } } | null;
}

export async function ingestMatch(pf: Platform, submitter: Player, p2: Player | null, m: MatchPayload): Promise<IngestResult> {
  const hash = sha(m);
  const p2id = p2 && p2.id !== submitter.id ? p2.id : null;   // playing yourself is never rated
  const wantRated = p2id !== null && m.winner !== 'none';

  const out = await pf.db.tx(async (q) => {
    const ids = [submitter.id, ...(p2id ? [p2id] : [])].sort();
    const locked = await q.query<{ id: string; rating: number }>(`SELECT id, rating FROM players WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [ids]);
    const rating = (id: string) => locked.rows.find((r) => r.id === id)!.rating;

    const ins = await q.query<{ id: string }>(
      `INSERT INTO matches (submitter_id, match_id, payload, payload_sha, p1_id, p2_id, winner, played_at)
       VALUES ($1,$2,$3::jsonb,$4,$1,$5,$6,$7) ON CONFLICT (submitter_id, match_id) DO NOTHING RETURNING id`,
      [submitter.id, m.match_id, JSON.stringify(m), hash, p2id, m.winner, m.timestamp]);

    if (!ins.rows.length) {
      const ex = (await q.query<any>(`SELECT * FROM matches WHERE submitter_id = $1 AND match_id = $2`, [submitter.id, m.match_id])).rows[0];
      if (ex.payload_sha !== hash) throw new HttpError(409, 'match_id already used with different content');
      return { id: ex.id as string, duplicate: true, rated: ex.rated as boolean,
        ratings: ex.rated ? { p1: { before: ex.p1_rating_before, after: ex.p1_rating_after }, p2: { before: ex.p2_rating_before, after: ex.p2_rating_after } } : null };
    }
    const id = ins.rows[0].id;

    let ratings: IngestResult['ratings'] = null;
    if (wantRated) {
      const r1 = rating(submitter.id), r2 = rating(p2id!);
      const p1Won = m.winner === 'player1';
      const { deltaA, deltaB } = eloUpdate(r1, r2, p1Won);
      await q.query(`UPDATE players SET rating = rating + $2, rated_matches = rated_matches + 1, rated_wins = rated_wins + $3 WHERE id = $1`, [submitter.id, deltaA, p1Won ? 1 : 0]);
      await q.query(`UPDATE players SET rating = rating + $2, rated_matches = rated_matches + 1, rated_wins = rated_wins + $3 WHERE id = $1`, [p2id, deltaB, p1Won ? 0 : 1]);
      await q.query(`UPDATE matches SET rated = true, p1_rating_before=$2, p1_rating_after=$3, p2_rating_before=$4, p2_rating_after=$5 WHERE id = $1`, [id, r1, r1 + deltaA, r2, r2 + deltaB]);
      ratings = { p1: { before: r1, after: r1 + deltaA }, p2: { before: r2, after: r2 + deltaB } };
    }
    await q.query(`INSERT INTO coaching (match_pk, perspective, status) VALUES ($1,1,'pending')`, [id]);
    if (p2id) await q.query(`INSERT INTO coaching (match_pk, perspective, status) VALUES ($1,2,'pending')`, [id]);
    return { id, duplicate: false, rated: wantRated, ratings };
  });

  if (!out.duplicate) scheduleCoaching(pf, out.id);
  return out;
}

/* ------------------------------------------------------------------ replay */
export async function attachReplay(pf: Platform, submitter: Player, matchId: string, r: ReplayPayload) {
  const row = (await pf.db.query<any>(`SELECT id, payload FROM matches WHERE submitter_id = $1 AND match_id = $2`, [submitter.id, matchId])).rows[0];
  if (!row) throw new HttpError(404, 'no match with that id; send the match stats first');
  const m = row.payload as MatchPayload;
  if (r.match_id !== matchId) throw new HttpError(422, 'replay match_id does not match the URL');
  if (r.p1_character !== m.player1.character || r.p2_character !== m.player2.character) throw new HttpError(422, 'replay characters do not match the match');
  const fightTicks = m.rounds.reduce((a, x) => a + x.duration_sec, 0) * 60 - m.rounds.length * 30; // durations are rounded to the nearest second
  if (r.total_frames < fightTicks) throw new HttpError(422, 'replay is shorter than the fighting time in the match stats');
  const hash = sha(r);
  const ex = (await pf.db.query<any>(`SELECT payload_sha FROM replays WHERE match_pk = $1`, [row.id])).rows[0];
  if (ex) {
    if (ex.payload_sha !== hash) throw new HttpError(409, 'a different replay is already stored for this match');
    return { duplicate: true };
  }
  const insights = analyseReplay(r);
  const ins = await pf.db.query(`INSERT INTO replays (match_pk, payload, payload_sha, total_frames, insights) VALUES ($1,$2::jsonb,$3,$4,$5::jsonb) ON CONFLICT (match_pk) DO NOTHING RETURNING match_pk`,
    [row.id, JSON.stringify(r), hash, r.total_frames, JSON.stringify(insights)]);
  if (!ins.rows.length) return { duplicate: true };
  await pf.db.query(`UPDATE coaching SET status='pending', error=NULL, updated_at=now() WHERE match_pk = $1`, [row.id]);
  scheduleCoaching(pf, row.id);
  return { duplicate: false };
}

/* ---------------------------------------------------------------- coaching */
export async function historyFor(db: Queryable, playerId: string, limit = 10) {
  const r = await db.query<any>(`SELECT id, payload, p1_id, played_at FROM matches WHERE p1_id = $1 OR p2_id = $1 ORDER BY played_at DESC, created_at DESC LIMIT $2`, [playerId, limit]);
  return r.rows.map((x) => ({ id: x.id as string, playedAt: x.played_at as Date, p: perspective(x.payload as MatchPayload, x.p1_id === playerId ? 1 : 2) as Perspective }));
}

export function scheduleCoaching(pf: Platform, matchPk: string) {
  const job = runCoaching(pf, matchPk).catch((e) => console.error('coaching job crashed', e)).finally(() => pf.jobs.delete(job));
  pf.jobs.add(job);
}

export async function runCoaching(pf: Platform, matchPk: string) {
  const row = (await pf.db.query<any>(`SELECT payload, p1_id, p2_id FROM matches WHERE id = $1`, [matchPk])).rows[0];
  if (!row) return;
  const m = row.payload as MatchPayload;
  const rep = (await pf.db.query<any>(`SELECT insights FROM replays WHERE match_pk = $1`, [matchPk])).rows[0]?.insights;
  for (const side of [1, 2] as const) {
    const playerId = side === 1 ? row.p1_id : row.p2_id;
    if (!playerId) continue;
    const mine = perspective(m, side);
    const hist = await historyFor(pf.db, playerId, 10);
    const cls = classify(hist.map((h) => h.p));
    const f = features([mine]);
    const ri = rep ? (side === 1 ? rep.p1 : rep.p2) : null;
    const facts: CoachFacts = {
      result: mine.won === null ? 'undecided' : mine.won ? 'won' : 'lost',
      character: mine.character, opponentCharacter: mine.opponentCharacter,
      rounds: mine.rounds.map((r, i) => ({ round: i + 1, outcome: r.won === null ? 'draw' : r.won ? 'won' : 'lost', hitsLanded: r.hitsLanded, hitsTaken: r.hitsTaken, blocks: r.blocks, durationSec: r.durationSec })),
      match: { attacksPerMin: +f.attacksPerMin.toFixed(1), blockRate: f.blockRate === null ? null : +f.blockRate.toFixed(2), connectRate: f.connectRate === null ? null : +f.connectRate.toFixed(2), damageShare: f.damageShare === null ? null : +f.damageShare.toFixed(2), mobilityPerMin: +f.mobilityPerMin.toFixed(1) },
      playstyle: { label: cls.label, provisional: cls.provisional, matchesUsed: cls.matchesUsed },
      ...(ri ? { replay: { durationSec: rep.durationSec, attackPresses: ri.attackPresses, blockPresses: ri.blockPresses, longestBlockHold: ri.longestBlockHold, peakAttackBurst: ri.peakAttackBurst } } : {}),
    };
    const o = await coachWithFallback(pf.coach, facts);
    await pf.db.query(`UPDATE coaching SET status=$3, source=$4, content=$5::jsonb, error=$6, updated_at=now() WHERE match_pk=$1 AND perspective=$2`,
      [matchPk, side, o.status, o.source, JSON.stringify(o.content), o.error ?? null]);
  }
}
