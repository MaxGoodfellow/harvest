const { upsert } = require('./_helpers');

// CLAUDE.md §10 "Default hazard types" with default save types per spec:
// Reflex for acid/fire/electric/ooze; Fortitude for poison/disease/cold;
// Will/Fortitude for undead; Will for occult/fiendish. Divine Backlash and
// Magical Instability aren't covered by that grouping — inferred as Will
// (divine, alongside occult/fiendish) and Reflex (a magical "burst" mishap).
// Elemental Backlash isn't in CLAUDE.md's list either — added 2026-06-26 at
// the user's request (their CSV import referenced it), Reflex per their
// choice, matching the other elemental "burst/discharge" hazards.
const HAZARD_TYPES = [
  { name: 'Acid Splash', default_save_type: 'Reflex', description: 'Corrosive splash from a ruptured acid component.' },
  { name: 'Poison Exposure', default_save_type: 'Fortitude', description: 'Toxin exposure from venom or poison glands.' },
  { name: 'Disease Exposure', default_save_type: 'Fortitude', description: 'Infectious exposure from diseased tissue or fluids.' },
  { name: 'Fire Burst', default_save_type: 'Reflex', description: 'Sudden combustion of a fire-touched component.' },
  { name: 'Cold Rupture', default_save_type: 'Fortitude', description: 'Frost shock from a cold-touched component.' },
  { name: 'Electric Shock', default_save_type: 'Reflex', description: 'Discharge from an electrically-charged component.' },
  { name: 'Undead Backlash', default_save_type: 'Will or Fortitude', description: 'Necrotic backlash from undead remains.' },
  { name: 'Occult Vision', default_save_type: 'Will', description: 'Disturbing vision or mental strain from occult tissue.' },
  { name: 'Fiendish Contamination', default_save_type: 'Will', description: 'Corrupting taint from fiendish remains.' },
  { name: 'Ooze Corrosion', default_save_type: 'Reflex', description: 'Corrosive exposure from ooze residue.' },
  { name: 'Divine Backlash', default_save_type: 'Will', description: 'Divine retribution from mishandled celestial/divine remains.' },
  { name: 'Magical Instability', default_save_type: 'Reflex', description: 'Uncontrolled magical discharge from an unstable component.' },
  { name: 'Elemental Backlash', default_save_type: 'Reflex', description: 'Sudden elemental discharge from a generically elemental-infused component.' },
  { name: 'Necrotic Contamination', default_save_type: 'Fortitude', description: 'Bodily decay/contamination from necrotic remains.' },
  { name: 'Occult Contamination', default_save_type: 'Will', description: 'Mental/spiritual taint from occult-touched remains.' },
];

// CLAUDE.md §8.9 hazard_damage_by_level. Bands start at level -1 (rather than
// 0) so level -1 creatures still resolve to the lowest band.
const HAZARD_DAMAGE_BANDS = [
  [-1, 2, '1d6'],
  [3, 5, '2d6'],
  [6, 8, '4d6'],
  [9, 11, '6d6'],
  [12, 14, '8d6'],
  [15, 17, '10d6'],
  [18, 20, '12d6'],
];

async function seed(conn) {
  for (const row of HAZARD_TYPES) {
    await upsert(conn, 'hazard_types', ['name'], row);
  }
  for (const [level_min, level_max, damage_dice] of HAZARD_DAMAGE_BANDS) {
    await upsert(conn, 'hazard_damage_by_level', ['level_min', 'level_max'], {
      level_min,
      level_max,
      damage_dice,
    });
  }
}

module.exports = seed;
