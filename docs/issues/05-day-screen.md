# 05 · Day screen (read)

Follows the prototype layout: day steps 1..N plus 🗒️ summary, and Wstecz/Dalej (back/next).

- `GET /api/days/:day` returns a snapshot: offerings on that day with eligibility, per offering who has it as their current choice (with day status) and who is considering it (with rank), my ranking, my current choice, conflicts, and the undecided list.
- The "Gdyby zapisy były teraz…" box (if sign-up were now), my ranking (read-only for now), and other options sorted by how many people are going.
- Ineligible offerings are hidden, with a "Pokaż też niedostępne" toggle (show unavailable too).
- Filter chips (Wszyscy / Chłopcy / Dziewczyny / Mój rocznik) and a "Gdzie idzie…" person search (where is… going).
- Capacity and 🔥 badges are shown for information only.
