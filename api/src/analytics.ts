import type { MatchPayload, Style } from './contracts';

/** One match seen from one player's side: "me" and "opponent". */
export interface Perspective {
  won: boolean | null;
  character: string; opponentCharacter: string;
  style: Style;
  rounds: { won: boolean | null; hitsLanded: number; hitsTaken: number; blocks: number; opponentBlocks: number; durationSec: number; finishingMove: string }[];
}

export function perspective(m: MatchPayload, side: 1 | 2): Perspective {
  const me = side === 1 ? 'p1' : 'p2';
  const mine = side === 1 ? m.player1 : m.player2;
  const theirs = side === 1 ? m.player2 : m.player1;
  return {
    won: m.winner === 'none' ? null : m.winner === (side === 1 ? 'player1' : 'player2'),
    character: mine.character, opponentCharacter: theirs.character,
    style: side === 1 ? m.p1_style : m.p2_style,
    rounds: m.rounds.map((r) => ({
      won: r.winner === 'draw' ? null : r.winner === me,
      hitsLanded: side === 1 ? r.p1_hits : r.p2_hits,
      hitsTaken: side === 1 ? r.p2_hits : r.p1_hits,
      blocks: side === 1 ? r.p1_blocks : r.p2_blocks,
      opponentBlocks: side === 1 ? r.p2_blocks : r.p1_blocks,
      durationSec: r.duration_sec,
      finishingMove: r.finishing_move,
    })),
  };
}

export interface Features {
  fightSeconds: number;
  attacksPerMin: number;
  blockRate: number | null;      // blocked / (blocked + landed on me): how often I stopped an attack that reached me
  connectRate: number | null;    // my attacks that reached the opponent (landed or blocked) / attacks thrown
  damageShare: number | null;    // hits I landed / (landed + taken)
  mobilityPerMin: number;        // (jumps + crouches) per minute
  variety: number;               // 0..1 normalised entropy of the five action counters
}

export function features(ps: Perspective[]): Features {
  let sec = 0, atk = 0, landed = 0, taken = 0, blocks = 0, oppBlocks = 0, mob = 0;
  const c = [0, 0, 0, 0, 0];
  for (const p of ps) {
    const s = p.style;
    atk += s.punches + s.kicks + s.specials; mob += s.jumps + s.crouches;
    c[0] += s.punches; c[1] += s.kicks; c[2] += s.specials; c[3] += s.jumps; c[4] += s.crouches;
    for (const r of p.rounds) { sec += r.durationSec; landed += r.hitsLanded; taken += r.hitsTaken; blocks += r.blocks; oppBlocks += r.opponentBlocks; }
  }
  const total = c.reduce((a, b) => a + b, 0);
  const nonZero = c.filter((x) => x > 0).length;
  const entropy = total === 0 ? 0 : -c.filter((x) => x > 0).reduce((a, x) => a + (x / total) * Math.log(x / total), 0);
  const minutes = Math.max(sec, 1) / 60;
  return {
    fightSeconds: sec,
    attacksPerMin: atk / minutes,
    blockRate: blocks + taken > 0 ? blocks / (blocks + taken) : null,
    connectRate: atk > 0 ? (landed + oppBlocks) / atk : null,
    damageShare: landed + taken > 0 ? landed / (landed + taken) : null,
    mobilityPerMin: mob / minutes,
    variety: nonZero > 1 ? entropy / Math.log(5) : 0,
  };
}

/**
 * PROVISIONAL thresholds. They are reasoned guesses, not fitted to real player data.
 * Calibrate against real matches (see docs/evaluation) before presenting results as validated.
 */
export const THRESHOLDS = {
  aggressiveAttacksPerMin: 55, aggressiveMaxBlockRate: 0.25,
  defensiveBlockRate: 0.45, defensiveMaxAttacksPerMin: 40,
  technicalVariety: 0.85, technicalConnectRate: 0.45, technicalMobilityPerMin: 8,
};

export type Playstyle = 'Aggressive' | 'Defensive' | 'Technical' | 'Balanced';
export interface Classification {
  label: Playstyle; provisional: boolean; matchesUsed: number; features: Features;
  matched: { aggressive: boolean; defensive: boolean; technical: boolean };
}

export function classify(ps: Perspective[]): Classification {
  const f = features(ps);
  const T = THRESHOLDS;
  const matched = {
    aggressive: f.attacksPerMin >= T.aggressiveAttacksPerMin && (f.blockRate ?? 0) <= T.aggressiveMaxBlockRate,
    defensive: (f.blockRate ?? 0) >= T.defensiveBlockRate && f.attacksPerMin <= T.defensiveMaxAttacksPerMin,
    technical: f.variety >= T.technicalVariety && (f.connectRate ?? 0) >= T.technicalConnectRate && f.mobilityPerMin >= T.technicalMobilityPerMin,
  };
  const label: Playstyle = ps.length === 0 || f.fightSeconds === 0 ? 'Balanced'
    : matched.aggressive ? 'Aggressive' : matched.defensive ? 'Defensive' : matched.technical ? 'Technical' : 'Balanced';
  return { label, provisional: ps.length < 3, matchesUsed: ps.length, features: f, matched };
}
