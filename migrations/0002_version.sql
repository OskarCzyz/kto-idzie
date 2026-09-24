-- Bumped on every write, so clients can poll one row instead of the whole state.
CREATE TABLE app_version (id INTEGER PRIMARY KEY CHECK (id = 1), v INTEGER NOT NULL);
INSERT INTO app_version (id, v) VALUES (1, 0);
