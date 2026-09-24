# 02 · Domain core: ranking resolution

`src/domain/` is pure TypeScript, built test-first.

- Types: Offering (days, gender, brackets), Participant, Ranking per day, Pick condition (`people[]` or `min` of own gender), DayStatus.
- `eligible(participant, offering)`.
- `resolve(plans)` returns the current choice per participant per day, plus conflicts.
  - Decided or Registered day → #1, ignoring conditions.
  - Wondering day → the highest pick whose condition is met by others' *current choices*.
  - Iterate from "everyone at #1" until stable. Mutual conditions end up met.
  - A multi-day pick must win on all of its days. Otherwise it's a conflict and drops out.
  - A conflict is reported only if the pick outranks the current choice on some day.
- `dayStatus` (Undecided when the ranking is empty).

**Done when:** tests cover a single pick, an unmet condition that falls through, a "min N of own gender" condition, a mutual pair, a chain of 3, a multi-day conflict, Decided ignoring conditions, and termination on an oscillating setup.
