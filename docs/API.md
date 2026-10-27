# API (v1)

Auth: **session token** (`dbzs_…`, dashboard) or **ingest token** (`dbzi_…`, the game). Header `Authorization: Bearer <token>`.
Errors are `{ "error": string, "details"?: [{path, message}] }`.

| Method & path | Auth | Notes |
|---|---|---|
| POST `/v1/auth/register` `{username,password}` | – | 201 `{sessionToken, ingestToken}`; ingest token shown once |
| POST `/v1/auth/login` | – | `{sessionToken}` (7 days) |
| POST `/v1/auth/logout` | session | ends the session server-side |
| POST `/v1/me/ingest-token/rotate` | session | old token stops working |
| **POST `/v1/matches`** | ingest, optional `X-Player2-Token` | body = match payload. 201 new, **200 duplicate**, 409 same id/different content, 422 invalid |
| **PUT `/v1/matches/by-game-id/:gameMatchId/replay`** | ingest | replay payload, 201/200/409/422/404 |
| GET `/v1/me`, `/v1/me/overview` | session | rating, record, playstyle, progression, rating history |
| GET `/v1/matches`, `/v1/matches/:id` | session | per-player perspective; detail includes coaching + replay insights |
| POST `/v1/matches/:id/coaching/retry` | session | 202 |
| GET `/v1/matches/:id/replay` | session or ingest | raw replay JSON for the game's `--replay` |
| GET `/v1/leaderboard?limit=` | public | rated players only; `seed:true` marks dev data |
| GET `/v1/schema/match.v1.json`, `/replay.v1.json` | public | the contract |

## Rules
* **Identity**: the game's `player1.name` is display text only. Identity comes from the ingest token. `X-Player2-Token` identifies a second registered player on the same machine.
* **Rated** only when both players are registered, are different accounts, and `winner != "none"`. Guest/CPU matches are stored, analysed and coached but never change Elo (K=32, start 1200, zero-sum).
* **Idempotency** key: `(submitting account, match_id)`. `match_id` is a local-time timestamp with 1 s resolution, so it is *not* globally unique; it is scoped per account. Same key + same content (canonical hash) → 200, nothing changes. Same key + different content → 409.
* **Atomic**: player rows are locked, match insert + both rating updates + history commit in one transaction.
* **Semantic checks** beyond JSON Schema: sequential rounds; winner follows from rounds (first to 2); no rounds after the decider; connected attacks ≤ attacks thrown; no `special` finish without specials; timestamp ≤ now+24 h.
* **Replay checks**: schema; frame numbers strictly increasing and < `total_frames`; characters and match id match; `total_frames` ≥ fight time in the stats.
