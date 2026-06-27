# CLAUDE.md — PF2e Harvesting Manager

@~/.claude/SERVER.md

> Blueprint for Claude Code. Read this file fully before writing code. It is the
> source of truth for scope, stack, schema, and the harvesting rules engine.
> When the spec and this file disagree, **this file wins**. When in doubt about a
> game rule, the values in the seed tables win over anything hard-coded.

> **Server context:** this app is part of a shared, **path-based** server estate
> (`https://<base-domain>/harvest`). The line above imports `SERVER.md`
> (canonical `~/.claude/SERVER.md`) for the host, reverse proxy, and the port /
> DB / cookie registries. **Do not invent** a port, DB name, or cookie name — use
> this app's allocation (DB `harvest`, user `harvest`, cookie `harvest.sid`,
> `BASE_PATH=/harvest`), and claim any new allocation in SERVER.md first.
> Build the app **base-path aware**: mount under `BASE_PATH`, prefix every asset
> URL / form action / redirect with it, and scope the session cookie `Path` to
> it — assuming domain root will break it behind the proxy. No secrets live in
> SERVER.md; they're in `.env`.
>
> **Accepted risk (decided 2026-06-25):** this file calls for a dedicated
> least-privilege `harvest` DB user (below and in §6). Per `SERVER.md`,
> assigning a different DB user/password per app isn't currently possible on
> the shared server — so this app will likely end up on the same shared
> `maxtime` account as the other four apps when it's actually deployed there,
> not its own `harvest` user. Treat the dedicated-user language below as the
> aspiration, not a blocker; revisit if that constraint is lifted.

---

## 1. What we are building

A **single-admin, admin-facing** web app for a Pathfinder 2e GM to manage
monsters and their harvesting / skinning information: harvestable components,
DCs, skills, time, value, risks, crafting value, preservation, tools, and full
**signature harvest tables** for bosses and unique creatures. Developed locally,
**hosted on a server** for everyday use (see §16 / §16.5).

The GM workflow during a session:

> select a monster → select a component → apply context modifiers → enter (or
> roll) a result → instantly see the degree of success and yield → optionally
> push the harvested material into the party inventory.

This is **not** a player-facing tool — no public view. Auth is off in dev for
convenience but **must be enabled before the server is reachable by anyone else**
(§16). The app makes no external/third-party calls; all data stays on your DB.

**Language:** the entire UI is in **English** — creature names, PF2e terms, and
component names are English by convention. (Code, comments, and this blueprint
are English too.)

---

## 2. Tech stack (pinned)

Server-rendered Node app with MySQL. This mirrors the existing in-house "What?"
stack for consistency and fast local setup.

| Layer        | Choice                                              |
|--------------|-----------------------------------------------------|
| Runtime      | Node.js ≥ 20 (LTS)                                  |
| Web framework| Express 4                                           |
| Database     | MySQL 8 (use the `mysql2/promise` driver + pool)    |
| Views        | EJS server-rendered, with `express-ejs-layouts`     |
| Interactivity| Vanilla JS + `fetch` to small JSON endpoints (calculator, live DC). No SPA framework. HTMX is acceptable if it stays simple. |
| Validation   | `zod` for request/body validation                   |
| Migrations   | Plain numbered `.sql` files + a tiny custom runner (see §6) |
| Tests        | Node's built-in `node:test` + `assert` (no Jest needed) |
| Lint/format  | ESLint + Prettier                                   |
| Config       | `dotenv` (`.env`, never committed), env-driven for dev **and** server |
| Hardening    | `helmet`, `express-rate-limit`, CSRF tokens on forms, secure session cookies (see §16) |

**Do not** introduce React/Vue/Tauri/Electron. **Do not** use an ORM that hides
SQL (no Prisma/Sequelize); use `mysql2` with a thin repository layer so the SQL
stays readable and the schema below maps 1:1.

Why this stack: fastest to stand up locally, print-friendly out of the box
(EJS → HTML → browser print), no runtime external dependencies (vendor all
assets — see §16), and easy to harden for a server because routes already pass
through an auth middleware seam.

**Deployment target:** developed locally, but **runs on a server eventually**
(internal/self-hosted, likely behind a reverse proxy). Build for that from day
one — see §16 (security/hardening) and §16.5 (deployment). Don't assume
`localhost`, don't assume a single trusted machine, and make config fully
environment-driven so the same code runs in dev and prod with different `.env`.

---

## 3. How to run (target dev experience)

```bash
npm install
cp .env.example .env          # fill in MySQL creds + DB name
npm run db:create             # create database if missing
npm run db:migrate            # apply all migrations
npm run db:seed               # load seed + example data
npm run dev                   # nodemon, http://localhost:3000
npm test                      # run calculation unit tests
```

For the server, `NODE_ENV=production npm start` (plain `node src/server.js`,
no nodemon) behind a process manager and reverse proxy — see §16.5.

Also provide: `npm run db:reset` (drop → create → migrate → seed),
`npm run db:backup` and `npm run db:restore` (see §13 Import/Export).

`.env.example`:
```
NODE_ENV=development          # "production" on the server
PORT=3000
HOST=127.0.0.1               # bind localhost in dev; 127.0.0.1 on server too (proxy fronts it)
TRUST_PROXY=0                # set to 1 (or the hop count) when behind nginx/Apache
BASE_PATH=/harvest      # path-based mount prefix; "" when run at root in dev
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=harvest
DB_PASSWORD=change-me
DB_NAME=harvest
DB_CONNECTION_LIMIT=10
# --- auth (off in dev, turn on before the server is reachable by anyone else) ---
AUTH_ENABLED=false
SESSION_SECRET=change-me-long-random
ADMIN_USERNAME=gm
ADMIN_PASSWORD_HASH=          # bcrypt/argon2 hash, set when AUTH_ENABLED=true
```

---

## 4. Repository layout

```
.
├── CLAUDE.md
├── README.md
├── package.json
├── .env.example
├── src/
│   ├── server.js              # express bootstrap, layouts, static, error handler
│   ├── db/
│   │   ├── pool.js            # mysql2 promise pool (single export)
│   │   ├── migrate.js         # migration runner (tracks schema_migrations)
│   │   └── seed.js            # seed runner (idempotent upserts)
│   ├── lib/
│   │   ├── harvest-rules.js   # PURE rules engine — NO db, NO express (see §8)
│   │   ├── money.js           # cp <-> gp/sp/cp formatting & parsing
│   │   └── degrees.js         # PF2e degree-of-success helper (re-used by rules)
│   ├── repositories/          # one file per aggregate (creatures, components…)
│   ├── routes/                # express routers, one per page group
│   ├── middleware/
│   │   └── auth.js            # no-op today; single seam for future auth
│   └── validation/            # zod schemas per form
├── views/                     # EJS: layout.ejs + pages + partials
│   ├── partials/
│   └── ...
├── public/                    # css, client JS, print stylesheet
├── db/
│   ├── migrations/            # 001_init.sql, 002_*.sql, ...
│   └── seeds/                 # rules + example data (.sql or .js)
└── test/                      # *.test.js — focused on lib/harvest-rules
```

**Hard rule:** all game math lives in `src/lib/harvest-rules.js` and is pure
(inputs → outputs, no DB, no I/O). Routes and views call it; tests cover it
directly. Never duplicate a formula in a view or a route.

---

## 5. Money & units conventions

- **All money is stored as integer copper pieces (cp)** in columns ending `_cp`.
  1 gp = 100 cp, 1 sp = 10 cp.
- `money.js` provides `toCp({gp,sp,cp})`, `fromCp(cp) -> {gp,sp,cp}`, and
  `formatCp(cp)` (e.g. `"12 gp 5 sp"`), driven by the `currency_display` setting.
- Time is stored in **minutes** as integers, with min/max columns where the spec
  gives ranges (e.g. Gargantuan full harvest = 1–2 days). Provide a
  `formatMinutes()` helper for display (`"2 hours"`, `"1–2 days"`).
- Dice are stored as **strings** like `"4d6"` (`hazard_damage_dice`,
  `signature_rows.crafting_uses` stays text, etc.). No dice roller needed for
  hazard damage — just display the expression and save type.

---

## 6. Database: MySQL specifics

Use the schema in §7. It is the SQLite-oriented spec adapted to MySQL 8. Apply
these conventions:

- Engine `InnoDB`, charset `utf8mb4`, collation `utf8mb4_unicode_ci`.
- PKs: `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`. FKs: `BIGINT UNSIGNED`.
- Money: `INT` (cp). Minutes: `INT`. Percentages: `DECIMAL(6,2)` (store `100.00`
  for 100%) or `SMALLINT` — pick `DECIMAL(6,2)` and be consistent.
- Timestamps: `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
  `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
- Soft delete: `archived_at TIMESTAMP NULL` on `creatures`, `buyers`,
  `materials_inventory` (and `campaigns`). Repositories filter
  `archived_at IS NULL` by default; expose an `includeArchived` flag.
- `*_json` columns use the native MySQL **`JSON`** type
  (`dc_modifiers_json`, `audit_log.old_value_json` / `new_value_json`).
- Fixed vocabularies use MySQL `ENUM` (or a `CHECK`-validated `VARCHAR`) — these
  are stable game vocab, distinct from the *configurable* modifier tables:
  - `size`: `Tiny,Small,Medium,Large,Huge,Gargantuan`
  - `rarity`: `common,uncommon,rare,unique`
  - `intelligence_category`: `Non-sapient,Animal-level,Sapient,Humanoid,Unique NPC`
  - `harvest_tier`: `0,1,2,3` (store as `TINYINT`)
  - `required_proficiency`: `Untrained,Trained,Expert,Master,Legendary`
  - `degree_of_success`: `critical_success,success,failure,critical_failure`
  - `quality`: `Poor,Standard,Pristine,Ruined`
  - inventory `status`: `available,sold,used,spoiled,destroyed,gifted,quest_item`
  - inventory `condition`: free-ish text but seed a controlled list.
- All `FOREIGN KEY` constraints explicit. Use `ON DELETE CASCADE` for owned
  children (components → creature, signature_rows → signature_table,
  junction tables). Use `ON DELETE SET NULL` for optional references
  (creature.location_id, buyer.location_id).

### Migration runner (`src/db/migrate.js`)
- Read `db/migrations/*.sql` in filename order.
- Maintain a `schema_migrations(version VARCHAR PK, applied_at TIMESTAMP)` table.
- Apply each unapplied file inside a transaction; record the version.
- Idempotent: re-running applies nothing new.
- Files are split-on-`;` aware or run as multi-statement (set
  `multipleStatements: true` only on the migration connection, never the app pool).

### Required indexes (create in migrations)
`creatures.name`, `creatures.level`, `creatures.harvest_tier`,
`creatures.creature_type`, `components.creature_id`,
`components.harvest_tag_id`, `materials_inventory.status`,
`harvest_attempts.creature_id`, `harvest_attempts.harvest_session_id`.

---

## 7. Schema (tables)

Implement exactly these tables and columns (MySQL types per §6). Junction tables
have composite PKs. This is the spec's normalized schema — reproduce all of it.

**Core / config:** `settings`, `campaigns`, `sources`, `locations`,
`dc_by_level`, `size_time_rules`, `skills`, `lores`, `harvest_tags`,
`hazard_types`, `hazard_damage_by_level`, `body_condition_modifiers`,
`death_time_modifiers`, `tool_modifiers`, `environment_modifiers`.

**Creatures & harvesting:** `creatures`, `creature_harvest_tags` (junction),
`components`, `component_alternate_skills` (junction),
`component_lores` (junction + `dc_modifier`).

**Signature tables:** `signature_tables`, `signature_rows`,
`signature_row_alternate_skills` (junction).

**Markets:** `buyers`, `buyer_accepted_tags` (junction),
`buyer_rejected_tags` (junction).

**Play & inventory:** `harvest_sessions`, `harvest_attempts`,
`materials_inventory`, `crafting_projects`, `crafting_project_materials`.

**Audit:** `audit_log`.

> The full column list per table is in the pasted spec (`/spec`). Keep column
> names **identical** to the spec so future imports line up. Notable columns to
> not drop: `creatures.total_harvest_value_formula`, `use_manual_value`,
> `manual_total_harvest_value_cp`, `is_signature`, `is_morally_sensitive`;
> `components.use_manual_dc`, `use_fixed_value`, `value_percentage`,
> `sale_value_percentage`, `hazard_dc_modifier`; `harvest_attempts.dc_modifiers_json`.

Write the audit_log entries from the repository layer on create/update/delete of
`creatures`, `components`, `signature_*`, `materials_inventory` (entity_type,
entity_id, action, old/new JSON). Keep it best-effort; never block a write on it.

---

## 8. The rules engine (`src/lib/harvest-rules.js`)

This is the heart of the app. **Pure functions, no DB.** Modifier *values* come
from seed tables and are passed in; the *formulas* live here. Reference values
below are the seed defaults — store them in the DB, do not inline magic numbers
where a seed table exists.

### 8.1 Base DC from creature level (`dc_by_level` seed)
PF2e level-based DC:

```
Lvl: -1  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
DC:  13 14 15 16 18 19 20 22 23 24 26 27 28 30 31 32 34 35 36 38 39 40
```

### 8.2 Total Harvest Value
```
total_harvest_value = (creature_level^2) * 2 gp        // then converted to cp
minimums: level -1 => 5 sp (50 cp); level 0 => 1 gp (100 cp); level 1 => 2 gp (200 cp)
```
If `creatures.use_manual_value` is set, use `manual_total_harvest_value_cp`
instead. Negative-level squared still yields a positive product; apply the
minimum floor regardless.

### 8.3 Component value
```
if component.use_fixed_value: value = component.fixed_crafting_value_cp
else: value = round(total_harvest_value_cp * (component.value_percentage / 100))
```
Enforce the cap: the sum of component crafting values **must not exceed** the
creature's Total Harvest Value — **unless** the creature `is_signature`
(or the `pristine_can_exceed_cap` setting is on for Pristine results). Surface a
warning in the UI when components over-allocate; don't silently clamp.

### 8.4 Final DC
```
final_dc = base_dc (from level)
         + component.base_dc_modifier        (or component.manual_dc if use_manual_dc)
         + body_condition_modifier            (body_condition_modifiers seed)
         + death_time_modifier                (death_time_modifiers seed)
         + tool_modifier                      (tool_modifiers seed)
         + environment_modifier               (environment_modifiers seed)
         + lore_modifier                       (negative; component_lores / lores seed)
         + sum(other manual modifiers)
```
Keep the modifier breakdown as an array of `{label, value}` so the calculator and
`harvest_attempts.dc_modifiers_json` can show *why* the DC is what it is.

Reference modifier tables to seed (these are configurable — seed, don't hard-code):

- **Creature complexity:** common animal +0; exotic/unknown +1; magical
  beast/dragon/aberration/undead/fiend/celestial +2; unique/rare/mythic +3..+5.
- **Component difficulty:** meat/basic bone/trophy -1..0; hide/scale/chitin +0;
  teeth/claws/horns +0; blood/ichor +1; organ/gland/eye +1..+2;
  venom sac/acid gland/elemental organ +2; magical essence/cursed organ +2..+4.
- **Body condition:** fresh +0; minor +1; heavy +2; burned/melted +3;
  frozen +3; exploded/dissolved +5; destroyed = impossible.
- **Time since death:** ≤1h +0; 1–8h +1 (delicate); 8–24h +2; 1–3d +4;
  3d+ only Bone/Hide/Trophy; magically preserved = no degradation.
- **Tools:** harvesting kit +0; improvised +2; none +4 (some parts impossible);
  expanded kit -1 (Large+); specialist kit -1 (matching); good workshop -1;
  specialist workshop -2; under time pressure +2; poor light/cramped/danger +1..+2.
- **Lore:** specific -2; very specific -4.

### 8.5 Degree of success (`src/lib/degrees.js`)
```
if total >= dc + 10: critical_success
elif total >= dc:    success
elif total <= dc - 10: critical_failure
else: failure
natural 20: shift result up one step
natural 1:  shift result down one step
```
Apply the nat-1/nat-20 shift **after** the threshold comparison, clamping at the
ends (can't go above crit success / below crit failure).

### 8.6 Quality from degree (GM-overridable)
```
critical_success -> Pristine
success          -> Standard
failure          -> Poor (or "half Standard" — GM selectable)
critical_failure -> Ruined / hazardous (GM selectable)
```

### 8.7 Value by quality
```
Poor = 25% | Standard = 100% | Pristine = 150%   (of component crafting value)
```
Respect the `pristine_can_exceed_cap` setting for the 150% case.

### 8.8 Sale value
```
sale_value = round(crafting_value_cp * (buyer_sale_percentage / 100))
```
Defaults: standard buyer 50%; specialist 60–75%; poor market 25–40%. Buyer
`accepted_tags` / `rejected_tags` gate whether a buyer will purchase a component
(reject → show "this buyer won't take it" + moral/legal warning if any).

### 8.9 Hazards
Only relevant when `component.is_hazardous` **and** result is critical failure
(GM may also trigger on failure). Then show:
```
damage = hazard_damage_by_level[creature_level]   (1d6 .. 12d6, see seed)
save_type = component.hazard_save_type (or hazard_type default)
hazard_dc = final_dc + component.hazard_dc_modifier
```
`hazard_damage_by_level` seed:
```
lvl 0–2:1d6 | 3–5:2d6 | 6–8:4d6 | 9–11:6d6 | 12–14:8d6 | 15–17:10d6 | 18–20:12d6
```

### Public API of the module (suggested)
```js
baseDcForLevel(level, dcTable)
totalHarvestValueCp(level, { manual })            // returns cp, floored to minimums
componentValueCp(totalCp, component)
finalDc({ baseDc, modifiers })                     // modifiers: [{label, value}]
degreeOfSuccess(total, dc, naturalDie)             // -> {degree, shifted}
qualityForDegree(degree, gmOverride)
valueForQuality(craftingValueCp, quality, { allowExceedCap })
saleValueCp(craftingValueCp, buyerPct)
hazardFor({ level, isHazardous, degree, finalDc, hazardDcModifier, saveType, damageTable })
```

---

## 9. Pages & features

Server-rendered pages (EJS), each behind the no-op `auth` middleware:

1. **Dashboard** — totals: monsters in DB, by tier, by creature type, with
   signature tables; recently edited monsters; a quick search bar.
2. **Monsters** — list with search + filters (§13), sortable table, filter chips.
   Actions: create, edit, duplicate, delete, archive.
3. **Monster Detail** — summary; tags; total harvest value; base DC; all
   components; signature table (if any); warnings; quick buttons:
   **Run Harvest Check**, **Add Material to Inventory**, **Print Harvest Sheet**.
   GM-only notes hidden by default, expandable.
4. **Create/Edit Monster** — base DC and total harvest value auto-fill from level
   (live, via a small JSON endpoint), overridable with the manual flags.
5. **Harvest Calculator** — pick monster → component → body condition → time since
   death → tools → environment → lore → time pressure → helper/Aid → market;
   show base DC, every modifier, final DC, time, value by quality, hazard if any.
   Enter a roll (total + natural die) → show degree of success + yield. A
   **Save as attempt** button writes a `harvest_attempts` row.
6. **Session Log** — `harvest_sessions` + `harvest_attempts`; record real
   in-play attempts (all fields from the spec).
7. **Material Inventory** — `materials_inventory`; status transitions
   (available/sold/used/spoiled/destroyed/gifted/quest_item); preserved-until.
8. **Crafting Uses** — `crafting_projects` + `crafting_project_materials`; apply
   material crafting value against an item's gp cost; flag formula-required /
   formula-unlocking materials.
9. **Buyers / Markets** — buyer types, default sale %, accepted/rejected tags,
   moral/legal warnings.
10. **Settings** — see §11.
11. **Import / Export** — see §13.

**Tag & component management** live on the monster edit screen and on a small
admin screen for the reusable `harvest_tags` records (name, description, default
risks, default skills, default component examples). Tags are DB records, reused
across monsters via the junction table.

### Humanoid / intelligent-creature warning
If `intelligence_category` ∈ {Sapient, Humanoid, Unique NPC} **or**
`is_morally_sensitive`, show on the detail and calculator pages:

> "Harvesting this creature may be considered desecration, monstrous behavior,
> necromancy, or a serious crime in many communities. Consider reputation, law,
> religion, and ally reactions."

Gate this behind the `humanoid_warnings_enabled` setting. Support
region-specific notes (e.g. Breachill: monster trophies usually fine, humanoid
parts heavily suspicious) via location/campaign notes surfaced near the warning.

---

## 10. Skills, tags, defaults (seed reference)

**Default skills:** Survival, Crafting, Medicine, Nature, Arcana, Occultism,
Religion, Society, Thievery, Lore. (Survival = default physical harvest; Crafting
= material prep; Medicine = organs/blood/glands; Nature = animals/beasts/plants;
Arcana = dragons/magical; Occultism = aberrations/oozes; Religion = undead/fiends/
celestials; Lore = specific knowledge.)

**Harvest tags:** Hide, Meat, Bone, Organ, Blood, Venom, Acid, Elemental,
Magical, Occult, Divine, Undead, Plant, Ooze, Construct, Trophy, Humanoid.
Seed each with description + default skills + default risks + default examples.

**Typical creature-type tag sets** (use to prefill new monsters by type):
Animal → Hide,Meat,Bone,Trophy · Beast → +Organ · Dragon → Hide,Bone,Organ,Blood,
Magical,Trophy + an energy tag · Aberration → Organ,Blood,Occult,Trophy · Fiend/
Celestial → Organ,Blood,Divine,Trophy · Undead → Undead,Bone,Occult/Divine,Trophy ·
Plant → Plant,Organ,Venom,Trophy · Ooze → Ooze,Acid,Occult · Construct →
Construct,Magical,Trophy · Humanoid → Humanoid,Trophy,Gear/Evidence.

**Default hazard types:** Acid Splash, Poison Exposure, Disease Exposure, Fire
Burst, Cold Rupture, Electric Shock, Undead Backlash, Occult Vision, Fiendish
Contamination, Ooze Corrosion, Divine Backlash, Magical Instability (with default
save types per the spec: Reflex for acid/fire/electric/ooze; Fortitude for
poison/disease/cold; Will/Fortitude for undead; Will for occult/fiendish).

**Default tools:** Harvesting Kit (5 gp, Bulk 1, +0), Improvised (+2), None (+4),
Expanded Harvesting Kit (30 gp, Bulk 2, -1 Large+), Dragonharvesting Kit (100 gp,
-1 dragons), Alchemical Extraction Kit (100 gp, -1 venom/acid/alchemical), Undead
Remains Kit (100 gp, -1 undead), Ooze Containment Kit (100 gp, -1 ooze).

**Size → time** (`size_time_rules`): per component → Tiny 10m, Small 20m, Medium
30m, Large 1h, Huge 2h, Gargantuan 4h. Full harvest → Tiny 20m, Small 1h, Medium
2h, Large 4h, Huge 8h, Gargantuan 1–2 days (store min/max).

**Preservation** (document in settings/help, model as tool/consumable notes):
Preservation Kit (10 gp, 10 uses; 1 use = 1 Small/Medium; Large 2, Huge 4,
Gargantuan 8; preserved 7 days).

**Default settings** to seed: see §11.

---

## 11. Settings (seed `settings` rows)

Each row: `key`, `value`, `value_type`, `description`. Implement:
`default_sale_percentage` (50), `default_crafting_percentage` (100),
`pristine_can_exceed_cap` (bool, default false), `humanoid_warnings_enabled`
(bool, true), `default_campaign_name`, `default_market`, `currency_display`
(`gp_sp_cp`), `use_auto_value_formula` (bool, true). The custom DC table, size/
time table, and hazard-damage table are editable via their own seed tables
(`dc_by_level`, `size_time_rules`, `hazard_damage_by_level`) — Settings just links
to editors for them. **The rules engine reads these tables, never hard-coded
copies.**

---

## 12. Seed & example data

Seed all reference tables in §10/§11. Then include example monsters:

1. **Wolf** — L1, Medium, Animal, Tier 1 — Hide, Meat, Bone, Trophy.
2. **Goblin Dog** — L1, Medium, Animal, Tier 2 — Hide, Meat, Bone, Disease,
   Trophy. Note: mangy hide + infectious saliva (Disease hazard on the saliva
   component).
3. **Giant Spider** — level placeholder, Tier 2 — Venom, Hide, Organ, Trophy
   (Venom sac hazardous: Poison Exposure / Fortitude).
4. **Grizzly Bear** — Tier 2 — Hide, Meat, Bone, Organ, Trophy.
5. **Black Dragon (placeholder)** — Tier 3 **Signature**, `is_signature = true` —
   Hide, Bone, Organ, Blood, Acid, Magical, Trophy.

**Black Dragon signature table** (one `signature_tables` row + `signature_rows`):
Black Dragon Hide/Scales · Acid Sac · Teeth/Claws/Horns · Dragon Blood ·
Dragon Heart · Dragon Eyes · Trophy Head. Implement the **Acid Sac** row exactly:

```
Skill: Medicine or Arcana   DC: base_dc + 4   Time: 1 hour
Success:          Standard acid sac sample.
Critical Success: Intact pristine acid sac, rare crafting component.
Failure:          Leaking unstable sac — half value or extra time.
Critical Failure: Acid burst, component ruined; basic Reflex save vs harvest DC.
Crafting Uses:    acid flasks, acid-resistant items, corrosive runes, alchemical research.
```

Seeds must be **idempotent** (upsert by natural key) so `db:seed` can re-run.

---

## 13. Search, filters, import/export

**Filters (Monsters page):** name, tag, level range, size, type, tier, campaign,
location, source, has-hazardous-components, crafting-use, moral sensitivity,
has-signature-table (yes/no). Render as filter chips; back them with indexed
queries.

**Import / Export:**
- JSON export of **all** data; JSON import (validate with zod, transactional).
- CSV export of monster list; CSV export of inventory.
- Printable monster harvest sheet (print stylesheet, `@media print`).
- Printable signature harvest table.
- **Backup / restore** of the local DB: `db:backup` runs `mysqldump` to a
  timestamped `.sql` in `/backups`; `db:restore <file>` loads it. Document the
  `mysqldump`/`mysql` binary dependency in the README.

All exports are local file downloads. **No external requests, ever.**

---

## 14. Testing (required)

`node:test` suites in `/test`, focused on `src/lib/`:

- `baseDcForLevel` across the whole -1..20 table.
- `totalHarvestValueCp` incl. the -1/0/1 minimum floors and manual override.
- `componentValueCp` (percentage vs fixed) and the over-cap warning (signature
  exemption, pristine-exceeds-cap setting).
- `finalDc` modifier summation incl. the breakdown array.
- `degreeOfSuccess` across all four bands **and** nat-1 / nat-20 shifts with
  end-clamping (e.g. nat-20 on a success → crit success; nat-1 on a crit failure
  stays crit failure).
- `qualityForDegree` + `valueForQuality` (25/100/150 %).
- `saleValueCp` rounding and buyer-percentage edges.
- `hazardFor` (only on crit failure / hazardous; correct dice band & save type).

Aim for full coverage of the rules engine; UI/route tests are optional.

---

## 15. Code quality & conventions

- **Separation:** rules math → `lib/`; data access → `repositories/`;
  HTTP/render → `routes/` + `views/`. Views contain no calculations.
- Validate every numeric/enum field with zod before it reaches the DB.
- Comment **non-obvious game rules** at the point of use (cite the rule, e.g.
  `// PF2e: nat 20 shifts degree up one step`).
- No magic numbers where a seed table exists — read the table.
- Type-safe-ish: JSDoc typedefs for the rules-engine inputs/outputs.
- Keep the schema additive and campaign-scoped so more PF2e campaigns drop in
  later without migration pain.
- ESLint + Prettier clean before considering a step done.

## 16. Security / hardening (dev local → server)

The app starts on your machine but **will be reachable on a server**, so treat it
as networked software, not a desktop tool. The original "no auth, fully offline"
premise is relaxed to: **single admin, but properly gated and hardened.**

- **Auth seam is real, not cosmetic.** `middleware/auth.js` enforces a session
  check when `AUTH_ENABLED=true` and is a pass-through when `false` (dev
  convenience). Ship a minimal single-admin login (username + `ADMIN_PASSWORD_HASH`
  verified with `bcrypt` or `argon2`, session in a signed cookie). **Turn auth on
  before the app is reachable by anyone but you** — never expose the unauthenticated
  app on a shared network. If multiple GMs are ever needed, the upgrade path is a
  `users` table behind the same middleware; leave room for it but don't build it now.
- **Standard middleware on every deploy:** `helmet` (security headers + a strict
  CSP that allows only self-hosted assets), `express-rate-limit` on the JSON
  endpoints (calculator/auto-fill/login), body-size limits, and **CSRF tokens on
  all state-changing forms** (server-rendered forms are CSRF-vulnerable once
  networked — generate a per-session token, validate on POST/PUT/DELETE).
- **Sessions/cookies:** `httpOnly`, `sameSite=lax`, and `secure=true` in
  production (TLS terminated at the proxy). Set `app.set('trust proxy', …)` from
  `TRUST_PROXY` so `secure` cookies and client IPs work behind the proxy.
- **Validation:** every numeric/enum/string field through zod before it touches
  SQL (already required in §15); always use **parameterized** `mysql2` queries —
  never string-concatenate user input into SQL.
- **No external data egress.** No analytics, no telemetry, no third-party calls,
  no runtime CDNs — **vendor all CSS/JS into `/public`** (also satisfies a strict
  CSP and keeps the app working on an isolated internal server). This preserves
  the spec's "all data stays local" requirement even when hosted.
- **Secrets** live only in `.env` (gitignored) / the server's environment — never
  committed, never logged. Rotate `SESSION_SECRET` and DB creds per environment.
- **Errors:** generic message + status to the client in production; full detail
  only to server logs. Don't leak stack traces or SQL to the browser.
- Backup/export features write local files on the server only (see §16.5).

## 16.5 Deployment notes (server)

Document these in the README so the box is reproducible:

- **Process:** run under a supervisor — `pm2` or a `systemd` unit — with restart
  on failure and `NODE_ENV=production`. Implement **graceful shutdown** (drain
  HTTP, then `pool.end()`) on `SIGTERM`/`SIGINT`.
- **Reverse proxy:** nginx/Apache terminates TLS and forwards to `HOST:PORT`;
  app binds `127.0.0.1` so it isn't directly exposed. Note the proxy headers the
  app expects (`X-Forwarded-Proto`/`-For`) and the matching `TRUST_PROXY`.
- **Logging:** structured logs to stdout (captured by pm2/systemd/journald); no
  secrets or full row dumps in logs.
- **Migrations on deploy:** `npm ci && npm run db:migrate` as part of the release
  step; the runner is idempotent so it's safe to run every deploy. Seeds run once
  on first provision (idempotent upserts, so re-running is harmless).
- **Backups:** `npm run db:backup` — timestamped `mysqldump` in `/backups`;
  recommend a cron entry on the server plus retention. Requires the `mysqldump`
  and `mysql` client binaries — list as a server prerequisite.
- **DB user:** the app's MySQL account needs only DML + DDL on its own schema;
  don't reuse a root/admin account.

---

## 17. Build order (milestones for Claude Code)

Work in this order, committing after each:

1. Project scaffold: package.json, eslint/prettier, express server + EJS layout,
   `helmet`, env-driven config, `.env.example`, pool, **auth middleware seam**
   (pass-through when `AUTH_ENABLED=false`), health route, graceful shutdown.
2. Migration runner + `001_init.sql` covering **all** tables/indexes/FKs in §7.
3. Seed runner + reference seeds (§10/§11) — verify with a smoke query.
4. `src/lib/` rules engine + `degrees.js` + `money.js` **with passing tests**
   (§14) before any UI consumes them.
5. Repositories for creatures, components, tags, signature tables.
6. Monsters CRUD (list/detail/create/edit/duplicate/archive) + live DC/value
   auto-fill endpoint + warnings.
7. Harvest Calculator page wired to the rules engine + Save-as-attempt.
8. Session Log, Material Inventory, Crafting Uses, Buyers/Markets.
9. Dashboard.
10. Import/Export, print sheets, backup/restore.
11. Example monsters + Black Dragon signature table seed (§12).
12. **Hardening + auth + deploy:** CSRF on forms, rate-limit + secure session
    cookies, single-admin login (§16), then process-manager/reverse-proxy notes
    in the README (§16.5). Verify the app runs with `AUTH_ENABLED=true`.
13. README (install, usage, server deploy, `mysqldump` prerequisite) and a final
    `npm run db:reset && npm test` green pass.

> Definition of done: `npm run db:reset` builds a working DB with all seeds and
> the five example monsters; `npm test` is green; the GM can pick the Black
> Dragon, run an Acid Sac check, see the degree/yield, and add the result to
> inventory — fully offline.
