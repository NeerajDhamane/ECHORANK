CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  owner_brand_id TEXT,              -- NULL = tracked brand; else competitor of that brand
  deleted_at TEXT,                  -- Soft deletion preserves append-only chat history
  name TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',        -- JSON array of alternate names for mention detection
  website TEXT,
  industry TEXT,
  auto_track INTEGER NOT NULL DEFAULT 0,      -- Module 22: scheduled tracking on/off
  track_frequency TEXT DEFAULT 'daily',       -- Module 22: daily | weekly
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  topic_id TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- active | suggested | inactive
  locale TEXT DEFAULT 'global',            -- Module 25
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT                         -- Soft deletion preserves chat history
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (prompt_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tracking_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed
  trigger TEXT DEFAULT 'manual',           -- manual | scheduled
  label TEXT,                              -- optional: 'baseline' | 'post-fix' for the case study
  total_expected INTEGER NOT NULL DEFAULT 0 -- prompts x providers, for progress bars
);

-- Atomic fact table: one row per (run x prompt x platform). APPEND-ONLY.
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  locale TEXT DEFAULT 'global',            -- Module 25: copied from the prompt at run time (chats are immutable)
  is_simulated INTEGER NOT NULL DEFAULT 0,
  raw_response TEXT,
  mentioned INTEGER NOT NULL DEFAULT 0,
  position INTEGER,                        -- 1-based rank among all brands found; NULL if absent
  sentiment TEXT,                          -- positive | neutral | negative
  sentiment_score REAL,                    -- -1..1
  brands_found TEXT DEFAULT '[]',          -- JSON [{brandId,name,position,sentiment,sentimentScore}] (competitor sentiment needed by Module 19)
  cited_sources TEXT DEFAULT '[]',         -- JSON array of normalized domains
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'other'       -- review|docs|forum|news|social|corporate|other
);

CREATE TABLE IF NOT EXISTS chat_sources (
  chat_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  citation_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (chat_id, source_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  run_id TEXT,
  category TEXT NOT NULL,                  -- content | authority | technical
  priority TEXT NOT NULL,                  -- high | medium | low
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  evidence TEXT,                           -- JSON: the exact numbers that triggered the rule
  basis TEXT,                              -- short literature/rationale note shown under "Why this rule?" 
  status TEXT NOT NULL DEFAULT 'open',     -- open | in_progress | done
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discovery_items (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  prompt_id TEXT,
  platform TEXT NOT NULL DEFAULT 'reddit',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  subreddit TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  relevance REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',      -- new | saved | dismissed
  found_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_id, url)
);

CREATE TABLE IF NOT EXISTS crawl_audits (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  url TEXT NOT NULL,
  result TEXT NOT NULL,                    -- JSON of every check
  score INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_scores (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  label TEXT,
  content TEXT NOT NULL,
  features TEXT NOT NULL,                  -- JSON of computed NLP features
  score INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  prompt_id TEXT,
  brief TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  type TEXT NOT NULL,                      -- visibility_drop | competitor_gain | negative_sentiment | lost_prompt
  threshold REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  rule_id TEXT,
  source_run_id TEXT,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,              -- Module 21: unguessable share token
  snapshot TEXT NOT NULL,                  -- JSON snapshot of report data (never live-queried)
  date_from TEXT, date_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_check_cache (
  cache_key TEXT PRIMARY KEY,              -- Module 24: hash(brand|question)
  result TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_check_log (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Migration 004: per-key daily limits for expensive programmatic tracking runs.
CREATE TABLE IF NOT EXISTS api_key_usage (
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  track_runs INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_brands_user ON brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_prompts_brand ON prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_runs_brand ON tracking_runs(brand_id);
CREATE INDEX IF NOT EXISTS idx_chats_run ON chats(run_id);
CREATE INDEX IF NOT EXISTS idx_chats_brand ON chats(brand_id);
CREATE INDEX IF NOT EXISTS idx_chats_prompt ON chats(prompt_id);
CREATE INDEX IF NOT EXISTS idx_recs_brand ON recommendations(brand_id);
CREATE INDEX IF NOT EXISTS idx_discovery_brand ON discovery_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_alerts_brand ON alerts(brand_id);
CREATE INDEX IF NOT EXISTS idx_pubcheck_ip ON public_check_log(ip, created_at);
