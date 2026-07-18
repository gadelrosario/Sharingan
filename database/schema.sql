
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_key TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    position TEXT NOT NULL CHECK(position IN ('QB','RB','WR','TE','K','DST')),
    nfl_team TEXT,
    bye_week INTEGER,
    age REAL,
    status TEXT DEFAULT 'active',
    injury_status TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_players_name ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);

CREATE TABLE IF NOT EXISTS external_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    external_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, external_id),
    UNIQUE(player_id, provider),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ranking_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('expert','market','consensus','platform')),
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expert_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    scoring_format TEXT NOT NULL DEFAULT 'half_ppr',
    overall_rank REAL,
    position_rank REAL,
    tier TEXT,
    tier_order REAL,
    notes TEXT,
    source_updated_at TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, source_id, season, scoring_format),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES ranking_sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rankings_lookup
ON expert_rankings(source_id, season, scoring_format, position_rank);

CREATE TABLE IF NOT EXISTS market_adp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    scoring_format TEXT NOT NULL DEFAULT 'half_ppr',
    adp REAL,
    position_adp REAL,
    sample_size INTEGER,
    seven_day_change REAL,
    source_updated_at TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, source_id, season, scoring_format),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES ranking_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    scoring_format TEXT NOT NULL DEFAULT 'half_ppr',
    fantasy_points REAL,
    fantasy_points_per_game REAL,
    games REAL,
    pass_attempts REAL,
    pass_completions REAL,
    passing_yards REAL,
    passing_tds REAL,
    interceptions REAL,
    rush_attempts REAL,
    rushing_yards REAL,
    rushing_tds REAL,
    targets REAL,
    receptions REAL,
    receiving_yards REAL,
    receiving_tds REAL,
    fumbles REAL,
    source_updated_at TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, source_id, season, scoring_format),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES ranking_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    season_sos_rank REAL,
    playoff_sos_rank REAL,
    weeks_15_17_rank REAL,
    source_updated_at TEXT,
    imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, source_id, season),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY(source_id) REFERENCES ranking_sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hq_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    scoring_format TEXT NOT NULL DEFAULT 'half_ppr',
    hq_grade REAL,
    expert_agreement REAL,
    market_value REAL,
    tier_scarcity REAL,
    wait_probability REAL,
    upside REAL,
    risk REAL,
    replacement_value REAL,
    league_winner_score REAL,
    model_version TEXT NOT NULL DEFAULT 'v1',
    calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, season, scoring_format, model_version),
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'started',
    error_message TEXT
);

CREATE VIEW IF NOT EXISTS player_master_view AS
SELECT
    p.id AS player_id,
    p.canonical_key,
    p.full_name,
    p.position,
    p.nfl_team,
    MAX(CASE WHEN rs.source_key='bdge' THEN er.position_rank END) AS bdge_rank,
    MAX(CASE WHEN rs.source_key='bdge' THEN er.tier END) AS bdge_tier,
    MAX(CASE WHEN rs.source_key='flock' THEN er.position_rank END) AS flock_rank,
    MAX(CASE WHEN rs.source_key='flock' THEN er.tier END) AS flock_tier,
    MAX(CASE WHEN rs.source_key='sleeper' THEN ma.adp END) AS sleeper_adp,
    MAX(CASE WHEN rs.source_key='yahoo' THEN ma.adp END) AS yahoo_adp,
    MAX(CASE WHEN rs.source_key='consensus' THEN ma.adp END) AS consensus_adp
FROM players p
LEFT JOIN expert_rankings er ON er.player_id = p.id AND er.season = 2026
LEFT JOIN ranking_sources rs ON rs.id = er.source_id
LEFT JOIN market_adp ma ON ma.player_id = p.id AND ma.season = 2026
LEFT JOIN ranking_sources rs2 ON rs2.id = ma.source_id
GROUP BY p.id;
