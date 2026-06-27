const { upsert } = require('./_helpers');

// CLAUDE.md §10 "Default skills"
const SKILLS = [
  { name: 'Survival', description: 'Default skill for physical harvest (hide, meat, bone, trophies).' },
  { name: 'Crafting', description: 'Material preparation and refinement.' },
  { name: 'Medicine', description: 'Organs, blood, glands.' },
  { name: 'Nature', description: 'Animals, beasts, plants.' },
  { name: 'Arcana', description: 'Dragons, magical components.' },
  { name: 'Occultism', description: 'Aberrations, oozes.' },
  { name: 'Religion', description: 'Undead, fiends, celestials.' },
  { name: 'Society', description: 'Humanoid-related harvesting and identification.' },
  { name: 'Thievery', description: 'Delicate or concealed extraction.' },
  { name: 'Lore', description: 'Specific creature/component knowledge.' },
];

async function seed(conn) {
  for (const row of SKILLS) {
    await upsert(conn, 'skills', ['name'], row);
  }
}

module.exports = seed;
