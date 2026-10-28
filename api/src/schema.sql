-- Plain Postgres. Runs unchanged on Supabase (set DATABASE_URL) and on PGlite (local/tests).
CREATE TABLE IF NOT EXISTS players (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- PK
  username         text NOT NULL,
  password_hash    text NOT NULL,
  ingest_token_hash text NOT NULL,
  rating           integer NOT NULL DEFAULT 1200,
  rated_matches    integer NOT NULL DEFAULT 0,
  rated_wins       integer NOT NULL DEFAULT 0,
  is_seed          boolean NOT NULL DEFAULT false,   -- development simulator accounts, always labelled in the UI
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower ON players (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS players_ingest_token ON players (ingest_token_hash);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, -- PK
  player_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE, -- FK -> players.id
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- PK
  submitter_id  uuid NOT NULL REFERENCES players(id), -- FK -> players.id
  match_id      text NOT NULL,                 -- the game's id; unique only per submitter
  payload       jsonb NOT NULL,
  payload_sha   text NOT NULL,
  p1_id         uuid NOT NULL REFERENCES players(id), -- FK -> players.id
  p2_id         uuid REFERENCES players(id), -- FK -> players.id; null = guest / CPU / unregistered
  winner        text NOT NULL,
  played_at     timestamptz NOT NULL,
  rated         boolean NOT NULL DEFAULT false,
  p1_rating_before integer, p1_rating_after integer,
  p2_rating_before integer, p2_rating_after integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submitter_id, match_id)
);
CREATE INDEX IF NOT EXISTS matches_p1 ON matches (p1_id, played_at DESC);
CREATE INDEX IF NOT EXISTS matches_p2 ON matches (p2_id, played_at DESC);

CREATE TABLE IF NOT EXISTS replays (
  match_pk     uuid PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE, -- PK, FK -> matches.id
  payload      jsonb NOT NULL,
  payload_sha  text NOT NULL,
  total_frames integer NOT NULL,
  insights     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching (
  match_pk    uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE, -- FK -> matches.id
  perspective smallint NOT NULL CHECK (perspective IN (1, 2)),
  status      text NOT NULL CHECK (status IN ('pending', 'ready', 'fallback')),
  source      text,                            -- 'llm:<model>' | 'rule-based'
  content     jsonb,
  error       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_pk, perspective) -- Composite PK
);
