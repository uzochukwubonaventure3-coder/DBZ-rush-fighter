/**
 * DEVELOPMENT SEED DATA. Not real players, not real matches.
 * Creates accounts named sim_* flagged is_seed=true (the API exposes `seed: true`; the UI must badge them)
 * and ingests synthetic matches through the same validation + ingestion path as real ones.
 *   npm run simulate -- 6 40      (players, matches)
 */
import { createDbFromEnv } from '../src/db';
import { validateMatch, type MatchPayload } from '../src/contracts';
import { createPlatform, ingestMatch, registerPlayer, type Player } from '../src/service';

const [nPlayers, nMatches] = [Number(process.argv[2] ?? 6), Number(process.argv[3] ?? 40)];
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const CHARS = ['Broly', 'Goku', 'Vegeta'];

function makeMatch(i: number, id: string, strength1: number): MatchPayload {
  const rounds: MatchPayload['rounds'] = []; let w1 = 0, w2 = 0;
  while (w1 < 2 && w2 < 2) {
    const p1 = rnd() < strength1; p1 ? w1++ : w2++;
    rounds.push({ round_number: rounds.length + 1, winner: p1 ? 'p1' : 'p2', duration_sec: int(15, 60), p1_hits: int(3, 20), p2_hits: int(3, 20), p1_blocks: int(0, 8), p2_blocks: int(0, 8), finishing_move: rnd() < 0.5 ? 'punch' : 'kick' });
  }
  const style = () => ({ punches: int(60, 110), kicks: int(40, 80), specials: 0, jumps: int(5, 25), crouches: int(2, 25) });
  return { game_id: 'fighting-game-v1', match_id: id, timestamp: new Date(Date.UTC(2026, 9, 1) + i * 3600_000).toISOString(), winner: w1 > w2 ? 'player1' : 'player2',
    player1: { name: 'sim', character: CHARS[int(0, 2)] }, player2: { name: 'sim', character: CHARS[int(0, 2)] }, rounds, p1_style: style(), p2_style: style() };
}

const db = await createDbFromEnv();
const pf = createPlatform(db, null);
const players: (Player & { skill: number })[] = [];
for (let i = 0; i < nPlayers; i++) {
  const name = `sim_${String(i + 1).padStart(2, '0')}`;
  try { const r = await registerPlayer(db, name, `seed-${Math.random().toString(36).slice(2)}-pw`, true); players.push({ id: r.id, username: name, rating: 1200, skill: 0.3 + 0.4 * (i / Math.max(nPlayers - 1, 1)) }); }
  catch { console.log(`${name} already exists, skipping`); }
}
let ok = 0;
for (let i = 0; i < nMatches && players.length > 1; i++) {
  const a = players[int(0, players.length - 1)]; let b = players[int(0, players.length - 1)]; if (b === a) b = players[(players.indexOf(a) + 1) % players.length];
  const m = makeMatch(i, `sim_${Date.now().toString(36)}_${i}`, 0.5 + (a.skill - b.skill));
  const v = validateMatch(m); if (!v.ok) throw new Error(`generator produced invalid match: ${JSON.stringify(v.errors)}`);
  await ingestMatch(pf, a, b, v.value); ok++;
}
await pf.idle();
console.log(`seeded ${players.length} sim players, ${ok} synthetic matches (labelled seed=true)`);
await db.close();
