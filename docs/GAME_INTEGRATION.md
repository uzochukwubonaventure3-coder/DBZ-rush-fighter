# What the game does today, and what is still missing

Verified by reading the uploaded source (`stats_io.cpp`, `simulation.cpp`, `main.cpp`, `replay_io.cpp`, `sample_stats.json`).

## Works today (platform consumes it unchanged)
* After every match `main.cpp` writes `stats/<match_id>.json` (nlohmann/json). Shape = `contracts/match.v1.schema.json`.
* If the player presses Y, `replays/<match_id>.json` is written (change-only frames). Shape = `replay.v1.schema.json`. Same `match_id` as the stats (newer `main.cpp`).
* `dbs_game.exe --replay <file>` plays a replay file.

## Not in the game yet (needs game-side work)
1. **No HTTP upload.** Nothing in the uploaded files uses libcurl. Needed: POST the stats JSON to `/v1/matches` with `Authorization: Bearer <ingest token>` (+ `X-Player2-Token` for a second registered player); PUT the replay JSON to `/v1/matches/by-game-id/<match_id>/replay`. Non-blocking, retry later if offline (a duplicate is safe).
2. **No config for the token.** Needs e.g. `player_config.json` `{ "api_url": "...", "ingest_token": "dbzi_..." }`.
3. **Names are hardcoded** "Player 1"/"Player 2" (TODO in main.cpp). Harmless: the platform ignores them for identity.
4. **No per-event log.** Stats are per-round totals; the replay holds only buttons. The platform therefore cannot say "you missed a block at frame 840". Replay insights are input-derived only (block holds, attack bursts, activity per 5 s). To enable hit-level coaching the game would emit an `events: [{tick, type}]` list.
5. **No `rush://` URL handler.** Only the `--replay` command-line flag exists. The dashboard can offer a download + command.
6. `specials` is always 0 and `finishing_move` never `special` until special moves exist.

## Assumed, not verified (headers `match.h`, `input.h`, `recorder.h` were not in the upload)
* Best of 3, first to 2 round wins (`ROUNDS_TO_WIN` in `contracts.ts`).
* When `winner` is `"none"` is unknown; it is accepted and never rated.

## Trust limit
Any holder of an ingest token can forge a result. Validation catches impossible payloads, not plausible fake ones. Real protection would be re-simulating the replay server-side with the game's headless `Simulation`.
