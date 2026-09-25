-- Offerings are no longer restricted by age bracket. Instead each has three signup groups
-- (mentees = U15/U18, mentors taking part, mentors not taking part = O18), each with its own capacity.
ALTER TABLE offering DROP COLUMN brackets;
ALTER TABLE offering RENAME COLUMN capacity TO capacity_mentee;       -- NULL = unlimited
ALTER TABLE offering ADD COLUMN capacity_mentor_in INTEGER;
ALTER TABLE offering ADD COLUMN capacity_mentor_out INTEGER;

-- An O18 pick: the mentor takes part in the activity ('in') or not ('out'). NULL = in.
ALTER TABLE pick ADD COLUMN mentor_role TEXT CHECK (mentor_role IN ('in', 'out'));
