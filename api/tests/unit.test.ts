import { describe, expect, it } from 'vitest';
import { eloUpdate, expectedScore } from '../src/elo';
import { validateMatch, validateReplay } from '../src/contracts';
import { classify, features, perspective } from '../src/analytics';
import { analyseReplay } from '../src/replayInsights';
import { clone, constructedReplay, realSample } from './helpers';

describe('Elo', () => {
  it('equal ratings: winner +16, loser -16', () => expect(eloUpdate(1200, 1200, true)).toEqual({ deltaA: 16, deltaB: -16 }));
  it('is always zero-sum, including after rounding', () => {
    for (let a = 800; a <= 2000; a += 137) for (let b = 800; b <= 2000; b += 91) for (const w of [true, false]) {
      const { deltaA, deltaB } = eloUpdate(a, b, w); expect(deltaA + deltaB).toBe(0);
    }
  });
  it('an upset pays more than an expected win', () => {
    expect(eloUpdate(1000, 1400, true).deltaA).toBeGreaterThan(eloUpdate(1400, 1000, true).deltaA);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 2);
  });
});

describe('match contract (real game output)', () => {
  it('accepts the real sample_stats.json written by the game', () => {
    const r = validateMatch(realSample(), Date.parse('2026-10-26T15:00:00Z'));
    expect(r.ok).toBe(true);
  });
  const bad = (mutate: (m: any) => void, now = Date.parse('2026-10-26T15:00:00Z')) => { const m: any = clone(realSample()); mutate(m); return validateMatch(m, now); };
  it('rejects missing/mistyped fields', () => {
    expect(bad((m) => delete m.rounds).ok).toBe(false);
    expect(bad((m) => (m.p1_style.punches = '5')).ok).toBe(false);
    expect(bad((m) => (m.winner = 'player3')).ok).toBe(false);
    expect(bad((m) => (m.match_id = '../etc/passwd')).ok).toBe(false);
    expect(bad((m) => (m.rounds[0].p1_hits = -1)).ok).toBe(false);
  });
  it('rejects a winner that the rounds do not support', () => expect(bad((m) => (m.winner = 'player2')).ok).toBe(false));
  it('rejects rounds that continue after the match was decided', () => expect(bad((m) => m.rounds.push({ ...m.rounds[1], round_number: 3 })).ok).toBe(false));
  it('rejects non-sequential round numbers', () => expect(bad((m) => (m.rounds[1].round_number = 5)).ok).toBe(false));
  it('rejects more connected attacks than attacks thrown (forged hit counts)', () => expect(bad((m) => (m.rounds[0].p1_hits = 5000)).ok).toBe(false));
  it('rejects timestamps more than a day in the future', () => expect(bad((m) => (m.timestamp = '2027-01-01T00:00:00Z')).ok).toBe(false));
  it('rejects a special finish by a player who threw no specials', () => expect(bad((m) => (m.rounds[0].finishing_move = 'special')).ok).toBe(false));
  it('accepts winner "none" (the game can emit it) without claiming a result', () => expect(bad((m) => { m.winner = 'none'; }).ok).toBe(true));
});

describe('replay contract + insights', () => {
  const m = realSample();
  it('accepts a change-only replay and computes input-derived insights', () => {
    const r = constructedReplay(m); expect(validateReplay(r).ok).toBe(true);
    const i = analyseReplay(r);
    expect(i.basis).toBe('inputs-only');
    expect(i.p1.attackPresses).toBe(3);                       // punch@100, kick@110, punch@114
    expect(i.p1.peakAttackBurst).toEqual({ startTick: 100, endTick: 114, presses: 3 });
    expect(i.p1.longestBlockHold).toEqual({ startTick: 300, endTick: 560, seconds: 4.33 });
    expect(i.p2.longestBlockHold?.startTick).toBe(100);       // p2 block 100..118 and unbroken until 118
    expect(i.activity[0].p1Attacks).toBe(3);
  });
  it('rejects frames out of order, past total_frames, unknown buttons, wrong fps', () => {
    const r: any = constructedReplay(m);
    expect(validateReplay({ ...r, frames: [{ f: 5, p1: [], p2: [] }, { f: 5, p1: [], p2: [] }] }).ok).toBe(false);
    expect(validateReplay({ ...r, frames: [{ f: r.total_frames, p1: [], p2: [] }] }).ok).toBe(false);
    expect(validateReplay({ ...r, frames: [{ f: 1, p1: ['hadouken'], p2: [] }] }).ok).toBe(false);
    expect(validateReplay({ ...r, fps: 30 }).ok).toBe(false);
  });
});

describe('playstyle classifier', () => {
  const p = (over: any = {}) => { const x: any = clone(realSample()); Object.assign(x.p1_style, over.style ?? {}); x.rounds.forEach((r: any) => Object.assign(r, over.round ?? {})); return perspective(x, 1); };
  it('features come from the counters the game actually emits', () => {
    const f = features([perspective(realSample(), 1)]);
    expect(f.fightSeconds).toBe(75);
    expect(f.attacksPerMin).toBeCloseTo((65 + 42) / 1.25, 1);
    expect(f.connectRate).toBeCloseTo((16 + 20 + 0) / 107, 3);
    expect(f.blockRate).toBeCloseTo(4 / (4 + 26), 3);
  });
  it('labels high attack rate + low block rate as Aggressive', () => expect(classify([p()]).label).toBe('Aggressive'));
  it('labels high block rate + low attack rate as Defensive', () => {
    const c = classify([p({ style: { punches: 10, kicks: 6, jumps: 1, crouches: 1 }, round: { p1_blocks: 12, p2_hits: 4, p1_hits: 3 } })]);
    expect(c.label).toBe('Defensive');
  });
  it('is Balanced when nothing was fought, and provisional with <3 matches', () => {
    expect(classify([]).label).toBe('Balanced');
    expect(classify([p()]).provisional).toBe(true);
    expect(classify([p(), p(), p()]).provisional).toBe(false);
  });
});
