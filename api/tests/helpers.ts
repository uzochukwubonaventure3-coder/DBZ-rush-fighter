import { readFileSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../src/app';
import { createPgliteDb } from '../src/db';
import { createPlatform } from '../src/service';
import type { CoachProvider } from '../src/coach';
import type { MatchPayload, ReplayPayload } from '../src/contracts';

/** The exact file the game wrote (sample_stats.json from the uploaded game source). */
export const realSample = (): MatchPayload => JSON.parse(readFileSync(new URL('../../contracts/fixtures/real_game_output.sample_stats.json', import.meta.url), 'utf8'));
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const withId = (m: MatchPayload, id: string, winner: MatchPayload['winner'] = m.winner) => ({ ...clone(m), match_id: id, winner });

/** Built by hand to follow replay_io.cpp's change-only format. NOT captured from the real game. */
export function constructedReplay(m: MatchPayload, matchId = m.match_id): ReplayPayload {
  const total = m.rounds.reduce((a, r) => a + r.duration_sec, 0) * 60 + 600;
  return { match_id: matchId, fps: 60, total_frames: total, p1_character: m.player1.character, p2_character: m.player2.character, frames: [
    { f: 10, p1: ['right'], p2: ['left'] }, { f: 100, p1: ['punch'], p2: ['block'] }, { f: 104, p1: [], p2: ['block'] },
    { f: 110, p1: ['kick'], p2: ['block'] }, { f: 114, p1: ['punch'], p2: [] }, { f: 118, p1: [], p2: [] },
    { f: 300, p1: ['block'], p2: ['punch'] }, { f: 560, p1: [], p2: [] },
  ] };
}

export async function setup(coach: CoachProvider | null = null) {
  const db = await createPgliteDb();
  const pf = createPlatform(db, coach);
  const app = createApp(pf, { rateLimits: false });
  const mk = async (username: string) => {
    const r = await request(app).post('/v1/auth/register').send({ username, password: 'correct-horse-9' });
    return { username, session: r.body.sessionToken as string, ingest: r.body.ingestToken as string };
  };
  return { db, pf, app, mk };
}
