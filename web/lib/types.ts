export interface Features { fightSeconds: number; attacksPerMin: number; blockRate: number | null; connectRate: number | null; damageShare: number | null; mobilityPerMin: number; variety: number }
export interface Overview {
  player: { username: string; rating: number; ratedMatches: number; ratedWins: number };
  record: { matches: number; wins: number; losses: number; undecided: number; window: string };
  playstyle: { label: 'Aggressive' | 'Defensive' | 'Technical' | 'Balanced'; provisional: boolean; matchesUsed: number; features: Features };
  progression: { matchId: string; playedAt: string; won: boolean | null; blockRate: number | null; connectRate: number | null; damageShare: number | null; attacksPerMin: number }[];
  ratingHistory: { playedAt: string; rating: number }[];
}
export interface MatchRow {
  id: string; playedAt: string; result: 'won' | 'lost' | 'undecided'; character: string; opponentCharacter: string;
  opponent: { username?: string; label?: string; registered: boolean }; rated: boolean; ratingChange: number | null; hasReplay: boolean; roundsWon: number; roundsLost: number;
}
export interface PlayerReplay { attackPresses: number; blockPresses: number; longestBlockHold: { startTick: number; endTick: number; seconds: number } | null; peakAttackBurst: { startTick: number; endTick: number; presses: number } | null }
export interface MatchDetail {
  id: string; playedAt: string; gameMatchId: string; result: 'won' | 'lost' | 'undecided';
  you: { character: string; style: { punches: number; kicks: number; specials: number; jumps: number; crouches: number } };
  opponent: { character: string; registered: boolean; username: string | null };
  rounds: { won: boolean | null; hitsLanded: number; hitsTaken: number; blocks: number; opponentBlocks: number; durationSec: number; finishingMove: string }[];
  features: Features; rated: boolean; rating: { before: number; after: number; change: number } | null;
  coaching: { status: 'pending' | 'ready' | 'fallback'; source: string | null; content: { summary: string; strengths: string[]; weaknesses: string[]; drills: string[] } | null; error: string | null } | null;
  replay: { available: false } | { available: true; totalFrames: number; insights: { note: string; durationSec: number; you: PlayerReplay; opponent: PlayerReplay; activity: { startSec: number; you: number; opponent: number }[] } };
}
export interface LeaderRow { rank: number; username: string; rating: number; ratedMatches: number; ratedWins: number; seed: boolean }
