// Wipes the LOCAL D1 database and fills it with a fake camp (same data as the prototype).
// Dev user ?as=1 is Kuba (organizer), ?as=2 is Tomek, ?as=26 is Ania, and so on.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let seed = 23
const rnd = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646)
const one = (a) => a[Math.floor(rnd() * a.length)]
const shuffle = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1])
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

const sql = []
for (const t of ['day_status', 'pick_rank', 'pick', 'participant', 'offering_day', 'offering', 'wave', 'camp_day', 'camp', 'activity_photo', 'activity'])
  sql.push(`DELETE FROM ${t};`)

sql.push(`INSERT INTO camp (id, name) VALUES (1, 'Nyttårs camp 2026');`)
const DAYS = [1, 2, 3, 4]
DAYS.forEach((d) => sql.push(`INSERT INTO camp_day (id, camp_id, day_no, date) VALUES (${d}, 1, ${d}, '2026-12-${27 + d}');`))
for (const [b, dt] of [['U15', '2026-10-01'], ['U18', '2026-10-08'], ['O18', '2026-10-15']]) sql.push(`INSERT INTO wave VALUES (1, '${b}', '${dt}');`)

const ACTS = [
  ['Kajaki', 'Spływ Wieprzem, 12 km, kamizelki na miejscu.'], ['Wspinaczka', 'Ścianka + skałki z instruktorem.'],
  ['Piłka nożna', 'Turniej drużyn mieszanych.'], ['Siatkówka', 'Plażówka przy jeziorze.'],
  ['Warsztaty plastyczne', 'Malowanie na szkle i linoryt.'], ['Gotowanie', 'Chleb i pierogi na kolację dla wszystkich.'],
  ['Rajd rowerowy', '35 km po okolicy.'], ['Teatr', 'Dwa dni prób, spektakl wieczorem.'],
  ['Survival', 'Nocleg w lesie, orientacja w terenie.'], ['Fotografia', 'Plener i obróbka zdjęć w telefonie.'],
  ['Warsztaty muzyczne', 'Cały obóz: zespół gra na koncercie finałowym.'], ['Taniec', 'Choreografia na koncert.'],
  ['Łucznictwo', 'Strzelanie do tarcz, zawody na koniec.'],
]
ACTS.forEach(([n, d], i) => sql.push(`INSERT INTO activity (id, name, description) VALUES (${i + 1}, ${q(n)}, ${q(d)});`))
const act = (name) => ACTS.findIndex((a) => a[0] === name) + 1

const OFF = []
const o = (name, days, x = {}) => OFF.push({ id: OFF.length + 1, act: act(name), days, gender: x.g ?? null, brackets: x.b ?? null, cap: x.cap ?? null, hot: x.hot ? 1 : 0 })
o('Kajaki', [1], { cap: 20, hot: true }); o('Kajaki', [3], { cap: 20 })
o('Wspinaczka', [1], { g: 'K', cap: 12, hot: true }); o('Wspinaczka', [2], { g: 'M', cap: 12, hot: true })
o('Piłka nożna', [1], { g: 'M' }); o('Piłka nożna', [2]); o('Piłka nożna', [4])
o('Siatkówka', [2]); o('Siatkówka', [3]); o('Warsztaty plastyczne', [1]); o('Warsztaty plastyczne', [3])
o('Gotowanie', [2], { cap: 10, hot: true }); o('Gotowanie', [4], { cap: 10 })
o('Rajd rowerowy', [3], { b: ['U18', 'O18'], cap: 25 }); o('Teatr', [1, 2], { cap: 15 })
o('Survival', [3, 4], { b: ['O18'], cap: 14, hot: true }); o('Fotografia', [2]); o('Fotografia', [4])
o('Warsztaty muzyczne', [1, 2, 3, 4], { cap: 30 }); o('Taniec', [3], { g: 'K' }); o('Taniec', [4])
o('Łucznictwo', [4], { b: ['U15'], cap: 16, hot: true }); o('Łucznictwo', [1], { b: ['U18', 'O18'], cap: 16 })
for (const x of OFF) {
  sql.push(`INSERT INTO offering (id, camp_id, activity_id, gender, brackets, capacity, high_demand) VALUES (${x.id}, 1, ${x.act}, ${q(x.gender)}, ${q(x.brackets?.join(','))}, ${q(x.cap)}, ${x.hot});`)
  x.days.forEach((d) => sql.push(`INSERT INTO offering_day VALUES (${x.id}, ${d});`))
}

const BOYS = 'Kuba Tomek Michał Bartek Filip Szymon Antek Kacper Wojtek Mateusz Igor Olek Staś Janek Piotrek Marcel Adam Hubert Dawid Krzyś Leon Nikodem Tymon Maks Franek'.split(' ')
const GIRLS = 'Ania Kasia Zosia Ola Marta Julia Hania Maja Lena Wiktoria Natalia Ewa Gosia Basia Iga Oliwia Amelia Nina Pola Alicja Kinga Weronika Magda Asia Tosia'.split(' ')
const PEOPLE = [...BOYS.map((n) => [n, 'M']), ...GIRLS.map((n) => [n, 'K'])].map(([name, gender], i) => {
  const r = rnd()
  return { id: i + 1, name, gender, bracket: i < 2 ? 'U18' : r < 0.4 ? 'U15' : r < 0.8 ? 'U18' : 'O18' }
})
PEOPLE.forEach((p) => sql.push(`INSERT INTO participant (id, telegram_id, first_name, gender, bracket, is_organizer) VALUES (${p.id}, ${p.id}, ${q(p.name)}, '${p.gender}', '${p.bracket}', ${p.id === 1 ? 1 : 0});`))

const eligible = (p, x) => (!x.gender || x.gender === p.gender) && (!x.brackets || x.brackets.includes(p.bracket))
let pickId = 0
for (const p of PEOPLE.slice(2)) {
  const ranking = Object.fromEntries(DAYS.map((d) => [d, []]))
  const picks = new Map()
  for (const d of DAYS) {
    if (rnd() < 0.18) continue
    for (const x of shuffle(OFF.filter((x) => x.days.includes(d) && eligible(p, x))).slice(0, 1 + Math.floor(rnd() * 3.5))) {
      if (picks.has(x.id) || (x.days.length > 1 && rnd() < 0.5)) continue
      const cond = rnd() < 0.22 ? (rnd() < 0.55 ? { people: [one(PEOPLE.filter((z) => z.id !== p.id && z.gender === p.gender)).id] } : { min: 2 + Math.floor(rnd() * 3) }) : {}
      picks.set(x.id, { id: ++pickId, cond })
      x.days.forEach((dd) => ranking[dd].push(x.id))
    }
  }
  for (const [oid, pk] of picks) sql.push(`INSERT INTO pick (id, participant_id, offering_id, cond_people, cond_min) VALUES (${pk.id}, ${p.id}, ${oid}, ${q(pk.cond.people ? JSON.stringify(pk.cond.people) : null)}, ${q(pk.cond.min)});`)
  for (const d of DAYS) {
    ranking[d].forEach((oid, i) => sql.push(`INSERT INTO pick_rank VALUES (${picks.get(oid).id}, ${d}, ${i});`))
    const r = rnd()
    if (ranking[d].length && r < 0.34 && OFF[ranking[d][0] - 1].days.length === 1) sql.push(`INSERT INTO day_status VALUES (${p.id}, ${d}, '${r < 0.22 ? 'decided' : 'registered'}');`)
  }
}
// Kuba (1) & Tomek (2): the conflict + mutual-condition demo from the prototype.
const TEATR = 15, KAJ1 = 1, LUK1 = 23, WSP_M = 4
const kp = (oid, extra = 'NULL, NULL') => { sql.push(`INSERT INTO pick (id, participant_id, offering_id, cond_people, cond_min) VALUES (${++pickId}, 1, ${oid}, ${extra});`); return pickId }
const t = kp(TEATR), k = kp(KAJ1, `NULL, 3`), l = kp(LUK1), w = kp(WSP_M, `'[2]', NULL`)
sql.push(`INSERT INTO pick_rank VALUES (${t}, 1, 0), (${k}, 1, 1), (${l}, 1, 2), (${w}, 2, 0), (${t}, 2, 1);`)
sql.push(`INSERT INTO pick (id, participant_id, offering_id, cond_people) VALUES (${++pickId}, 2, ${WSP_M}, '[1]');`, `INSERT INTO pick_rank VALUES (${pickId}, 2, 0);`)

const file = join(mkdtempSync(join(tmpdir(), 'seed-')), 'seed.sql')
writeFileSync(file, sql.join('\n'))
execSync(`npx wrangler d1 execute DB --local --file=${file}`, { stdio: 'inherit' })
console.log(`Seeded ${PEOPLE.length} participants, ${OFF.length} offerings, ${pickId} picks.`)
