import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { matchSchema, replaySchema, validateMatch, validateReplay } from './contracts';
import { classify, features, perspective } from './analytics';
import { sha256 } from './auth';
import { HttpError, attachReplay, historyFor, ingestMatch, login, playerFromIngest, playerFromSession, registerPlayer, rotateIngestToken, scheduleCoaching, type Platform, type Player } from './service';

declare module 'express-serve-static-core' { interface Request { player?: Player; player2?: Player | null } }

export interface AppOptions { webOrigin?: string; rateLimits?: boolean }

const bearer = (req: Request, header = 'authorization') => {
  const v = req.header(header);
  if (!v) return null;
  return header === 'authorization' ? (v.startsWith('Bearer ') ? v.slice(7).trim() : null) : v.trim();
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createApp(pf: Platform, opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CORS: only the configured dashboard origin.
  app.use((req, res, next) => {
    const origin = req.header('origin');
    if (origin && opts.webOrigin && origin === opts.webOrigin) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
    }
    if (req.method === 'OPTIONS') return void res.sendStatus(204);
    next();
  });

  const limit = (windowMs: number, max: number) => opts.rateLimits === false ? ((_q: Request, _s: Response, n: NextFunction) => n()) : rateLimit({ windowMs, limit: max, standardHeaders: true, legacyHeaders: false, message: { error: 'too many requests' } });
  app.use(limit(60_000, 300));
  const authLimit = limit(15 * 60_000, 30);

  const session = async (req: Request, _res: Response, next: NextFunction) => {
    const t = bearer(req);
    const p = t?.startsWith('dbzs_') ? await playerFromSession(pf.db, t) : null;
    if (!p) throw new HttpError(401, 'sign in required');
    req.player = p; next();
  };
  const ingest = async (req: Request, _res: Response, next: NextFunction) => {
    const t = bearer(req);
    const p = t?.startsWith('dbzi_') ? await playerFromIngest(pf.db, t) : null;
    if (!p) throw new HttpError(401, 'invalid ingest token');
    req.player = p;
    const t2 = bearer(req, 'x-player2-token');
    if (t2) {
      const p2 = t2.startsWith('dbzi_') ? await playerFromIngest(pf.db, t2) : null;
      if (!p2) throw new HttpError(401, 'invalid player 2 token');
      req.player2 = p2;
    }
    next();
  };
  const sessionOrIngest = async (req: Request, res: Response, next: NextFunction) => {
    const t = bearer(req);
    return t?.startsWith('dbzi_') ? ingest(req, res, next) : session(req, res, next);
  };

  /* ---------- public ---------- */
  app.get('/v1/health', async (_q, res) => { await pf.db.query('SELECT 1'); res.json({ ok: true, coach: pf.coach?.name ?? 'rule-based' }); });
  app.get('/v1/schema/match.v1.json', (_q, res) => void res.json(matchSchema));
  app.get('/v1/schema/replay.v1.json', (_q, res) => void res.json(replaySchema));

  app.get('/v1/leaderboard', async (req, res) => {
    const n = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    const r = await pf.db.query<any>(`SELECT username, rating, rated_matches, rated_wins, is_seed FROM players WHERE rated_matches > 0 AND is_seed = false ORDER BY rating DESC, rated_matches DESC, created_at ASC LIMIT $1`, [n]);
    res.json({ players: r.rows.map((p, i) => ({ rank: i + 1, username: p.username, rating: p.rating, ratedMatches: p.rated_matches, ratedWins: p.rated_wins, seed: p.is_seed })) });
  });

  /* ---------- accounts ---------- */
  const json = express.json({ limit: '16kb' });
  app.post('/v1/auth/register', authLimit, json, async (req, res) => {
    const { username, password } = req.body ?? {};
    const r = await registerPlayer(pf.db, String(username ?? ''), password);
    res.status(201).json({ username: r.username, sessionToken: r.sessionToken, ingestToken: r.ingestToken, note: 'The ingest token is shown once. Put it in the game config.' });
  });
  app.post('/v1/auth/login', authLimit, json, async (req, res) => {
    res.json(await login(pf.db, req.body?.username ?? '', req.body?.password ?? ''));
  });
  app.post('/v1/auth/logout', session, async (req, res) => { await pf.db.query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(bearer(req)!)]); res.json({ ok: true }); });
  app.post('/v1/me/ingest-token/rotate', session, async (req, res) => { res.json({ ingestToken: await rotateIngestToken(pf.db, req.player!.id), note: 'The previous token no longer works.' }); });

  /* ---------- game -> platform ---------- */
  app.post('/v1/matches', ingest, express.json({ limit: '64kb' }), async (req, res) => {
    const v = validateMatch(req.body);
    if (!v.ok) throw new HttpError(422, 'match payload failed validation', v.errors);
    const out = await ingestMatch(pf, req.player!, req.player2 ?? null, v.value);
    res.status(out.duplicate ? 200 : 201).json({ matchId: out.id, duplicate: out.duplicate, rated: out.rated, ratings: out.ratings });
  });
  app.put('/v1/matches/by-game-id/:gameMatchId/replay', ingest, express.json({ limit: '4mb' }), async (req, res) => {
    const v = validateReplay(req.body);
    if (!v.ok) throw new HttpError(422, 'replay payload failed validation', v.errors);
    const out = await attachReplay(pf, req.player!, req.params.gameMatchId as string, v.value);
    res.status(out.duplicate ? 200 : 201).json(out);
  });

  /* ---------- dashboard ---------- */
  const mineRow = async (req: Request) => {
    const id = req.params.id as string;
    if (!UUID.test(id)) throw new HttpError(404, 'match not found');
    const r = await pf.db.query<any>(`SELECT m.*, p1.username AS p1_name, p2.username AS p2_name FROM matches m JOIN players p1 ON p1.id = m.p1_id LEFT JOIN players p2 ON p2.id = m.p2_id WHERE m.id = $1 AND (m.p1_id = $2 OR m.p2_id = $2)`, [id, req.player!.id]);
    if (!r.rows[0]) throw new HttpError(404, 'match not found');
    return r.rows[0];
  };

  app.get('/v1/me', session, async (req, res) => {
    const p = (await pf.db.query<any>(`SELECT username, rating, rated_matches, rated_wins FROM players WHERE id = $1`, [req.player!.id])).rows[0];
    res.json({ username: p.username, rating: p.rating, ratedMatches: p.rated_matches, ratedWins: p.rated_wins });
  });

  app.get('/v1/me/overview', session, async (req, res) => {
    const me = req.player!.id;
    const p = (await pf.db.query<any>(`SELECT username, rating, rated_matches, rated_wins FROM players WHERE id = $1`, [me])).rows[0];
    const hist = await historyFor(pf.db, me, 30);            // newest first
    const recent = hist.slice(0, 10).map((h) => h.p);
    const cls = classify(recent);
    const wins = hist.filter((h) => h.p.won === true).length, losses = hist.filter((h) => h.p.won === false).length;
    const ratings = (await pf.db.query<any>(`SELECT played_at, CASE WHEN p1_id = $1 THEN p1_rating_after ELSE p2_rating_after END AS rating FROM matches WHERE rated AND (p1_id = $1 OR p2_id = $1) ORDER BY played_at ASC LIMIT 100`, [me])).rows;
    res.json({
      player: { username: p.username, rating: p.rating, ratedMatches: p.rated_matches, ratedWins: p.rated_wins },
      record: { matches: hist.length, wins, losses, undecided: hist.length - wins - losses, window: 'last 30 matches' },
      playstyle: cls,
      progression: [...hist].reverse().map((h) => { const f = features([h.p]); return { matchId: h.id, playedAt: h.playedAt, won: h.p.won, blockRate: f.blockRate, connectRate: f.connectRate, damageShare: f.damageShare, attacksPerMin: f.attacksPerMin }; }),
      ratingHistory: ratings.map((r) => ({ playedAt: r.played_at, rating: r.rating })),
    });
  });

  app.get('/v1/matches', session, async (req, res) => {
    const me = req.player!.id;
    const n = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
    const r = await pf.db.query<any>(
      `SELECT m.id, m.played_at, m.winner, m.rated, m.p1_id, m.payload, m.p1_rating_before, m.p1_rating_after, m.p2_rating_before, m.p2_rating_after,
              p1.username AS p1_name, p2.username AS p2_name, EXISTS (SELECT 1 FROM replays r WHERE r.match_pk = m.id) AS has_replay
         FROM matches m JOIN players p1 ON p1.id = m.p1_id LEFT JOIN players p2 ON p2.id = m.p2_id
        WHERE m.p1_id = $1 OR m.p2_id = $1 ORDER BY m.played_at DESC, m.created_at DESC LIMIT $2`, [me, n]);
    res.json({ matches: r.rows.map((x) => {
      const side = x.p1_id === me ? 1 : 2, ps = perspective(x.payload, side);
      const before = side === 1 ? x.p1_rating_before : x.p2_rating_before, after = side === 1 ? x.p1_rating_after : x.p2_rating_after;
      return { id: x.id, playedAt: x.played_at, result: ps.won === null ? 'undecided' : ps.won ? 'won' : 'lost',
        character: ps.character, opponentCharacter: ps.opponentCharacter,
        opponent: side === 1 ? (x.p2_name ? { username: x.p2_name, registered: true } : { label: 'Guest / CPU', registered: false }) : { username: x.p1_name, registered: true },
        rated: x.rated, ratingChange: x.rated ? after - before : null, hasReplay: x.has_replay, roundsWon: ps.rounds.filter((r) => r.won === true).length, roundsLost: ps.rounds.filter((r) => r.won === false).length };
    }) });
  });

  app.get('/v1/matches/:id', session, async (req, res) => {
    const x = await mineRow(req);
    const side = x.p1_id === req.player!.id ? 1 : 2;
    const ps = perspective(x.payload, side);
    const co = (await pf.db.query<any>(`SELECT status, source, content, error, updated_at FROM coaching WHERE match_pk = $1 AND perspective = $2`, [x.id, side])).rows[0];
    const rp = (await pf.db.query<any>(`SELECT insights, total_frames FROM replays WHERE match_pk = $1`, [x.id])).rows[0];
    const before = side === 1 ? x.p1_rating_before : x.p2_rating_before, after = side === 1 ? x.p1_rating_after : x.p2_rating_after;
    let insights = null;
    if (rp) { const i = rp.insights; insights = { ...i, you: side === 1 ? i.p1 : i.p2, opponent: side === 1 ? i.p2 : i.p1, p1: undefined, p2: undefined, activity: i.activity.map((a: any) => ({ startSec: a.startSec, you: side === 1 ? a.p1Attacks : a.p2Attacks, opponent: side === 1 ? a.p2Attacks : a.p1Attacks })) }; }
    res.json({
      id: x.id, playedAt: x.played_at, gameMatchId: x.match_id, result: ps.won === null ? 'undecided' : ps.won ? 'won' : 'lost',
      you: { character: ps.character, style: ps.style }, opponent: { character: ps.opponentCharacter, registered: side === 2 || !!x.p2_id, username: side === 1 ? x.p2_name : x.p1_name },
      rounds: ps.rounds, features: features([ps]),
      rating: x.rated ? { before, after, change: after - before } : null, rated: x.rated,
      coaching: co ? { status: co.status, source: co.source, content: co.content, error: co.error } : null,
      replay: rp ? { available: true, totalFrames: rp.total_frames, insights } : { available: false },
    });
  });

  app.post('/v1/matches/:id/coaching/retry', session, async (req, res) => {
    const x = await mineRow(req);
    await pf.db.query(`UPDATE coaching SET status='pending', error=NULL, updated_at=now() WHERE match_pk = $1`, [x.id]);
    scheduleCoaching(pf, x.id);
    res.status(202).json({ status: 'pending' });
  });

  app.get('/v1/matches/:id/replay', sessionOrIngest, async (req, res) => {
    await mineRow(req);
    const r = await pf.db.query<any>(`SELECT payload FROM replays WHERE match_pk = $1`, [req.params.id]);
    if (!r.rows[0]) throw new HttpError(404, 'no replay saved for this match');
    res.json(r.rows[0].payload);
  });

  /* ---------- errors ---------- */
  app.use((_req, _res, next) => next(new HttpError(404, 'not found')));
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, details: err.details });
    if (err?.type === 'entity.too.large') return void res.status(413).json({ error: 'payload too large' });
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return void res.status(400).json({ error: 'invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });
  return app;
}
