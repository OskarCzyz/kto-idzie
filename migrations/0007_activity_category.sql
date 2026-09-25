-- Every activity has a category (required when saving; NULL only for activities saved before this).
ALTER TABLE activity ADD COLUMN category TEXT
  CHECK (category IN ('Camp Host', 'Kreatywne', 'Jedzenie', 'Gry', 'Media', 'Muzyka', 'Na Zewnątrz', 'Sport', 'Sporty Zimowe'));
