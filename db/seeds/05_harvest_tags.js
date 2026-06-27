const { upsert } = require('./_helpers');

// CLAUDE.md §10 "Harvest tags". "Disease" is added beyond the documented
// default list because §12's Goblin Dog example explicitly calls for a
// Disease tag (infectious saliva) and harvest_tags is admin-managed seed
// data, not a fixed ENUM (§6).
const HARVEST_TAGS = [
  { name: 'Hide', description: 'Skin, scale, or chitin harvested for armor and leatherworking.', default_skills_json: JSON.stringify(['Survival', 'Crafting']), default_risks: 'Minimal — mostly quality loss from poor handling.', default_examples: 'Leather hide, scales, chitin plates.' },
  { name: 'Meat', description: 'Edible flesh.', default_skills_json: JSON.stringify(['Survival']), default_risks: 'Spoilage if not preserved quickly.', default_examples: 'Steaks, roasts, jerky.' },
  { name: 'Bone', description: 'Bones, claws, horns, teeth.', default_skills_json: JSON.stringify(['Survival', 'Crafting']), default_risks: 'Minimal.', default_examples: 'Bone weapons, trophies, crafting components.' },
  { name: 'Organ', description: 'Internal organs.', default_skills_json: JSON.stringify(['Medicine']), default_risks: 'Spoilage, contamination.', default_examples: 'Heart, liver, glands.' },
  { name: 'Blood', description: 'Blood or ichor.', default_skills_json: JSON.stringify(['Medicine']), default_risks: 'Spoilage, coagulation.', default_examples: 'Vials of blood, ichor samples.' },
  { name: 'Venom', description: 'Venom glands and sacs.', default_skills_json: JSON.stringify(['Medicine', 'Nature']), default_risks: 'Poison exposure if mishandled.', default_examples: 'Venom sacs, stingers.' },
  { name: 'Acid', description: 'Acid glands and sacs.', default_skills_json: JSON.stringify(['Medicine', 'Arcana']), default_risks: 'Acid burns, corrosive spills.', default_examples: 'Acid sacs, corrosive glands.' },
  { name: 'Elemental', description: 'Elemental-infused tissue.', default_skills_json: JSON.stringify(['Arcana', 'Nature']), default_risks: 'Elemental backlash (burns, shocks, frost).', default_examples: 'Elemental cores, infused tissue.' },
  { name: 'Magical', description: 'Magically-charged components.', default_skills_json: JSON.stringify(['Arcana']), default_risks: 'Magical instability.', default_examples: 'Magical essence, charged scales/organs.' },
  { name: 'Occult', description: 'Occult-touched components.', default_skills_json: JSON.stringify(['Occultism']), default_risks: 'Occult backlash, vision/sanity effects.', default_examples: 'Occult organs, aberrant tissue.' },
  { name: 'Divine', description: 'Divinely-touched components.', default_skills_json: JSON.stringify(['Religion']), default_risks: 'Divine backlash.', default_examples: 'Divine ichor, celestial/fiendish remains.' },
  { name: 'Undead', description: 'Undead remains.', default_skills_json: JSON.stringify(['Religion', 'Occultism']), default_risks: 'Undead backlash, disease.', default_examples: 'Undead bone, necrotic tissue.' },
  { name: 'Plant', description: 'Plant creature components.', default_skills_json: JSON.stringify(['Nature']), default_risks: 'Spore exposure, toxins.', default_examples: 'Bark, sap, spores.' },
  { name: 'Ooze', description: 'Ooze components.', default_skills_json: JSON.stringify(['Occultism', 'Nature']), default_risks: 'Corrosion, acid exposure.', default_examples: 'Ooze cores, corrosive residue.' },
  { name: 'Construct', description: 'Construct components.', default_skills_json: JSON.stringify(['Crafting', 'Arcana']), default_risks: 'Mechanical or magical traps.', default_examples: 'Construct cores, animating runes.' },
  { name: 'Trophy', description: 'Display trophies.', default_skills_json: JSON.stringify(['Survival']), default_risks: 'Minimal.', default_examples: 'Mounted heads, claws, hides.' },
  { name: 'Humanoid', description: 'Humanoid remains.', default_skills_json: JSON.stringify(['Society', 'Religion']), default_risks: 'Legal, moral, and religious consequences.', default_examples: 'Humanoid trophies, gear, evidence.' },
  { name: 'Disease', description: 'Infectious tissue or fluids.', default_skills_json: JSON.stringify(['Medicine']), default_risks: 'Disease exposure.', default_examples: 'Infectious saliva, diseased tissue.' },
];

async function seed(conn) {
  for (const row of HARVEST_TAGS) {
    await upsert(conn, 'harvest_tags', ['name'], row);
  }
}

module.exports = seed;
