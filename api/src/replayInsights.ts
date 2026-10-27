import type { ReplayPayload } from './contracts';

const TPS = 60;
export interface PlayerReplayInsight {
  attackPresses: number;
  blockPresses: number;
  longestBlockHold: { startTick: number; endTick: number; seconds: number } | null;
  peakAttackBurst: { startTick: number; endTick: number; presses: number } | null; // most attack presses in any 1-second window
}
export interface ReplayInsights {
  basis: 'inputs-only';
  note: string;
  durationSec: number;
  p1: PlayerReplayInsight; p2: PlayerReplayInsight;
  activity: { startSec: number; p1Attacks: number; p2Attacks: number }[]; // per 5 s window
}

/** Everything here comes from button states. The replay carries no hit/miss events, so no claim about them is made. */
export function analyseReplay(r: ReplayPayload): ReplayInsights {
  const total = r.total_frames;
  const analyse = (key: 'p1' | 'p2') => {
    let prev = new Set<string>();
    let attackPresses = 0, blockPresses = 0;
    const attackTicks: number[] = [];
    let blockStart = -1;
    let best: PlayerReplayInsight['longestBlockHold'] = null;
    const closeBlock = (end: number) => {
      if (blockStart < 0) return;
      const len = end - blockStart;
      if (!best || len > best.endTick - best.startTick) best = { startTick: blockStart, endTick: end, seconds: +(len / TPS).toFixed(2) };
      blockStart = -1;
    };
    for (const e of r.frames) {
      const cur = new Set<string>(e[key]);
      for (const a of ['punch', 'kick']) if (cur.has(a) && !prev.has(a)) { attackPresses++; attackTicks.push(e.f); }
      if (cur.has('block') && !prev.has('block')) { blockPresses++; blockStart = e.f; }
      if (!cur.has('block') && prev.has('block')) closeBlock(e.f);
      prev = cur;
    }
    closeBlock(total);
    let burst: PlayerReplayInsight['peakAttackBurst'] = null;
    for (let i = 0, j = 0; i < attackTicks.length; i++) {
      while (attackTicks[i] - attackTicks[j] >= TPS) j++;
      const n = i - j + 1;
      if (!burst || n > burst.presses) burst = { startTick: attackTicks[j], endTick: attackTicks[i], presses: n };
    }
    return { insight: { attackPresses, blockPresses, longestBlockHold: best, peakAttackBurst: burst } as PlayerReplayInsight, attackTicks };
  };
  const a1 = analyse('p1'), a2 = analyse('p2');
  const windows = Math.ceil(total / (5 * TPS));
  const activity = Array.from({ length: windows }, (_, i) => ({ startSec: i * 5, p1Attacks: 0, p2Attacks: 0 }));
  for (const t of a1.attackTicks) activity[Math.floor(t / (5 * TPS))].p1Attacks++;
  for (const t of a2.attackTicks) activity[Math.floor(t / (5 * TPS))].p2Attacks++;
  return {
    basis: 'inputs-only',
    note: 'Derived from recorded button presses only. The replay file has no hit/miss events, so these insights cannot say where a hit landed or was missed.',
    durationSec: +(total / TPS).toFixed(1),
    p1: a1.insight, p2: a2.insight, activity,
  };
}
