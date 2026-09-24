-- Activities outlive a camp (library); everything else is per camp and deleted when it ends.
CREATE TABLE activity (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE activity_photo (
  id          INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  position    INTEGER NOT NULL
);

CREATE TABLE camp (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE camp_day (
  id      INTEGER PRIMARY KEY,
  camp_id INTEGER NOT NULL REFERENCES camp(id) ON DELETE CASCADE,
  day_no  INTEGER NOT NULL,
  date    TEXT,
  UNIQUE (camp_id, day_no)
);

CREATE TABLE wave (
  camp_id  INTEGER NOT NULL REFERENCES camp(id) ON DELETE CASCADE,
  bracket  TEXT NOT NULL CHECK (bracket IN ('U15', 'U18', 'O18')),
  opens_at TEXT NOT NULL,
  PRIMARY KEY (camp_id, bracket)
);

CREATE TABLE offering (
  id          INTEGER PRIMARY KEY,
  camp_id     INTEGER NOT NULL REFERENCES camp(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  gender      TEXT CHECK (gender IN ('M', 'K')),          -- NULL = everyone
  brackets    TEXT,                                        -- comma list, NULL = every bracket
  capacity    INTEGER,                                     -- NULL = unlimited
  high_demand INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE offering_day (
  offering_id INTEGER NOT NULL REFERENCES offering(id) ON DELETE CASCADE,
  camp_day_id INTEGER NOT NULL REFERENCES camp_day(id) ON DELETE CASCADE,
  PRIMARY KEY (offering_id, camp_day_id)
);

CREATE TABLE participant (
  id           INTEGER PRIMARY KEY,
  telegram_id  INTEGER NOT NULL UNIQUE,
  first_name   TEXT NOT NULL,
  last_name    TEXT,
  username     TEXT,
  photo_url    TEXT,
  gender       TEXT CHECK (gender IN ('M', 'K')),          -- NULL until onboarded
  bracket      TEXT CHECK (bracket IN ('U15', 'U18', 'O18')),
  is_organizer INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A pick = one offering in a participant's ranking, with an optional condition.
CREATE TABLE pick (
  id             INTEGER PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  offering_id    INTEGER NOT NULL REFERENCES offering(id) ON DELETE CASCADE,
  cond_people    TEXT,     -- JSON array of participant ids
  cond_min       INTEGER,  -- at least N others of own gender
  UNIQUE (participant_id, offering_id),
  CHECK (cond_people IS NULL OR cond_min IS NULL)
);

-- Rank of a pick on each day it covers (a multi-day pick can rank differently per day).
CREATE TABLE pick_rank (
  pick_id     INTEGER NOT NULL REFERENCES pick(id) ON DELETE CASCADE,
  camp_day_id INTEGER NOT NULL REFERENCES camp_day(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (pick_id, camp_day_id)
);

CREATE TABLE day_status (
  participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  camp_day_id    INTEGER NOT NULL REFERENCES camp_day(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (status IN ('wondering', 'decided', 'registered')),
  PRIMARY KEY (participant_id, camp_day_id)
);
