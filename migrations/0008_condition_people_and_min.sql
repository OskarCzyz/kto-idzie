-- A condition can now name people AND require a minimum at the same time, so the
-- "one or the other" CHECK on pick goes. SQLite can't drop a CHECK, so pick is rebuilt.
-- pick_rank is rebuilt first against the new table: dropping the old pick would otherwise
-- cascade-delete every rank.
CREATE TABLE pick_new (
  id             INTEGER PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participant(id) ON DELETE CASCADE,
  offering_id    INTEGER NOT NULL REFERENCES offering(id) ON DELETE CASCADE,
  cond_people    TEXT,     -- JSON array of participant ids who must all go
  cond_min       INTEGER,  -- and/or at least N others of own gender
  mentor_role    TEXT CHECK (mentor_role IN ('in', 'out')),
  UNIQUE (participant_id, offering_id)
);
INSERT INTO pick_new (id, participant_id, offering_id, cond_people, cond_min, mentor_role)
  SELECT id, participant_id, offering_id, cond_people, cond_min, mentor_role FROM pick;

CREATE TABLE pick_rank_new (
  pick_id     INTEGER NOT NULL REFERENCES pick_new(id) ON DELETE CASCADE,
  camp_day_id INTEGER NOT NULL REFERENCES camp_day(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (pick_id, camp_day_id)
);
INSERT INTO pick_rank_new (pick_id, camp_day_id, position) SELECT pick_id, camp_day_id, position FROM pick_rank;

DROP TABLE pick_rank;
DROP TABLE pick;
ALTER TABLE pick_new RENAME TO pick;           -- also repoints pick_rank_new's foreign key
ALTER TABLE pick_rank_new RENAME TO pick_rank;
