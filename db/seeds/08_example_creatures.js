const { upsert, getId, linkJunction } = require('./_helpers');

// CLAUDE.md §12 example creatures 1-4 (Black Dragon is seeded separately in
// 09_black_dragon_signature.js since it's signature-table-only, no regular
// components). component_*_dc_modifier values follow the §8.4 component-
// difficulty reference table (meat/bone -1..0, hide/scale +0, organ +1..+2,
// venom sac +2). Levels/sizes/creature_type for Giant Spider and Grizzly Bear
// aren't pinned by CLAUDE.md ("level placeholder" for the Spider) — using
// their standard PF2e Bestiary stats (Giant Spider lvl 2 Medium Animal,
// Grizzly Bear lvl 3 Large Animal) as a reasonable default.
//
// Primary/alternate skill assignments follow the GM-provided harvest skill
// mapping (Survival=default physical harvest; Crafting=crafting-grade hide/
// chitin/scale/bone prep; Medicine=organs/glands/blood/eyes; Nature=animal-
// specific afflictions) rather than being invented during seeding.

async function seedCreature(conn, creature, components) {
  const creatureId = await upsert(conn, 'creatures', ['name'], {
    name: creature.name,
    level: creature.level,
    size: creature.size,
    rarity: creature.rarity || 'common',
    creature_type: creature.creature_type,
    intelligence_category: creature.intelligence_category || 'Animal-level',
    harvest_tier: creature.harvest_tier,
    required_proficiency: creature.required_proficiency || 'Trained',
    is_signature: false,
    is_morally_sensitive: false,
    use_manual_value: false,
    manual_total_harvest_value_cp: null,
    total_harvest_value_formula: '(level^2) * 200 cp',
    description: creature.description || null,
    gm_notes: creature.gm_notes || null,
  });

  for (const tagName of creature.tags) {
    const tagId = await getId(conn, 'harvest_tags', 'name', tagName);
    await linkJunction(conn, 'creature_harvest_tags', ['creature_id', 'harvest_tag_id'], [
      creatureId,
      tagId,
    ]);
  }

  for (const component of components) {
    const tagId = await getId(conn, 'harvest_tags', 'name', component.tag);
    const skillId = component.skill ? await getId(conn, 'skills', 'name', component.skill) : null;
    const hazardTypeId = component.hazardType
      ? await getId(conn, 'hazard_types', 'name', component.hazardType)
      : null;

    const componentId = await upsert(conn, 'components', ['creature_id', 'name'], {
      creature_id: creatureId,
      harvest_tag_id: tagId,
      skill_id: skillId,
      name: component.name,
      description: component.description || null,
      base_dc_modifier: component.dcModifier || 0,
      use_manual_dc: false,
      manual_dc: null,
      use_fixed_value: false,
      fixed_crafting_value_cp: null,
      value_percentage: component.valuePercentage,
      sale_value_percentage: null,
      is_hazardous: Boolean(component.hazardType),
      hazard_type_id: hazardTypeId,
      hazard_save_type: component.hazardSaveType || null,
      hazard_dc_modifier: component.hazardDcModifier || 0,
      crafting_uses: component.craftingUses || null,
      is_formula_required: false,
      is_formula_unlocking: false,
      sort_order: component.sortOrder || 0,
    });

    // Clear stale links first — altSkills can change between seed runs, and
    // linkJunction alone only adds rows, it never removes stale ones.
    await conn.query('DELETE FROM component_alternate_skills WHERE component_id = ?', [componentId]);
    for (const altSkillName of component.altSkills || []) {
      const altSkillId = await getId(conn, 'skills', 'name', altSkillName);
      await linkJunction(conn, 'component_alternate_skills', ['component_id', 'skill_id'], [
        componentId,
        altSkillId,
      ]);
    }
  }

  return creatureId;
}

async function seed(conn) {
  await seedCreature(
    conn,
    {
      name: 'Wolf',
      level: 1,
      size: 'Medium',
      creature_type: 'Animal',
      harvest_tier: 1,
      tags: ['Hide', 'Meat', 'Bone', 'Trophy'],
      description: 'A common predator found in forests and plains.',
    },
    [
      { name: 'Wolf Hide', tag: 'Hide', skill: 'Survival', altSkills: ['Crafting'], dcModifier: 0, valuePercentage: 30, sortOrder: 1, craftingUses: 'Leather armor, cloaks, trim.' },
      { name: 'Wolf Meat', tag: 'Meat', skill: 'Survival', dcModifier: -1, valuePercentage: 20, sortOrder: 2, craftingUses: 'Rations, trail food.' },
      { name: 'Wolf Bone', tag: 'Bone', skill: 'Survival', altSkills: ['Crafting'], dcModifier: -1, valuePercentage: 20, sortOrder: 3, craftingUses: 'Simple tools, arrowheads.' },
      { name: 'Wolf Pelt Trophy', tag: 'Trophy', skill: 'Survival', dcModifier: 0, valuePercentage: 30, sortOrder: 4, craftingUses: 'Wall mount, trophy display.' },
    ]
  );

  await seedCreature(
    conn,
    {
      name: 'Goblin Dog',
      level: 1,
      size: 'Medium',
      creature_type: 'Animal',
      harvest_tier: 2,
      tags: ['Hide', 'Meat', 'Bone', 'Disease', 'Trophy'],
      description: 'A mangy, vicious hound bred by goblins. Its saliva carries disease.',
    },
    [
      { name: 'Mangy Hide', tag: 'Hide', skill: 'Survival', altSkills: ['Crafting'], dcModifier: 0, valuePercentage: 20, sortOrder: 1, craftingUses: 'Crude leather goods.' },
      { name: 'Goblin Dog Meat', tag: 'Meat', skill: 'Survival', dcModifier: -1, valuePercentage: 15, sortOrder: 2, craftingUses: 'Rations (low quality).' },
      { name: 'Goblin Dog Bone', tag: 'Bone', skill: 'Survival', altSkills: ['Crafting'], dcModifier: -1, valuePercentage: 15, sortOrder: 3, craftingUses: 'Simple tools.' },
      { name: 'Infectious Saliva', tag: 'Disease', skill: 'Medicine', altSkills: ['Nature'], dcModifier: 1, valuePercentage: 20, sortOrder: 4, hazardType: 'Disease Exposure', hazardSaveType: 'Fortitude', hazardDcModifier: 0, craftingUses: 'Disease research, toxin crafting.' },
      { name: 'Goblin Dog Trophy', tag: 'Trophy', skill: 'Survival', dcModifier: 0, valuePercentage: 30, sortOrder: 5, craftingUses: 'Trophy display.' },
    ]
  );

  await seedCreature(
    conn,
    {
      name: 'Giant Spider',
      level: 2,
      size: 'Medium',
      creature_type: 'Animal',
      harvest_tier: 2,
      tags: ['Venom', 'Hide', 'Organ', 'Trophy'],
      description: 'An oversized, venomous arachnid.',
    },
    [
      { name: 'Venom Sac', tag: 'Venom', skill: 'Medicine', altSkills: ['Crafting'], dcModifier: 2, valuePercentage: 30, sortOrder: 1, hazardType: 'Poison Exposure', hazardSaveType: 'Fortitude', hazardDcModifier: 0, craftingUses: 'Poisons, antivenom research.' },
      { name: 'Spider Chitin', tag: 'Hide', skill: 'Survival', altSkills: ['Crafting'], dcModifier: 0, valuePercentage: 20, sortOrder: 2, craftingUses: 'Light armor plating.' },
      { name: 'Spider Organ', tag: 'Organ', skill: 'Medicine', dcModifier: 1, valuePercentage: 25, sortOrder: 3, craftingUses: 'Alchemical reagents.' },
      { name: 'Fangs and Trophy', tag: 'Trophy', skill: 'Survival', altSkills: ['Crafting'], dcModifier: 0, valuePercentage: 25, sortOrder: 4, craftingUses: 'Trophy display, dagger crafting.' },
    ]
  );

  await seedCreature(
    conn,
    {
      name: 'Grizzly Bear',
      level: 3,
      size: 'Large',
      creature_type: 'Animal',
      harvest_tier: 2,
      tags: ['Hide', 'Meat', 'Bone', 'Organ', 'Trophy'],
      description: 'A massive, powerful bear.',
    },
    [
      { name: 'Bear Hide', tag: 'Hide', skill: 'Survival', altSkills: ['Crafting'], dcModifier: 0, valuePercentage: 20, sortOrder: 1, craftingUses: 'Heavy leather armor, rugs.' },
      { name: 'Bear Meat', tag: 'Meat', skill: 'Survival', dcModifier: -1, valuePercentage: 20, sortOrder: 2, craftingUses: 'Rations.' },
      { name: 'Bear Bone', tag: 'Bone', skill: 'Survival', altSkills: ['Crafting'], dcModifier: -1, valuePercentage: 15, sortOrder: 3, craftingUses: 'Tools, weapons.' },
      { name: 'Bear Organ', tag: 'Organ', skill: 'Medicine', dcModifier: 1, valuePercentage: 20, sortOrder: 4, craftingUses: 'Alchemical reagents.' },
      { name: 'Bear Trophy', tag: 'Trophy', skill: 'Survival', dcModifier: 0, valuePercentage: 25, sortOrder: 5, craftingUses: 'Trophy mount.' },
    ]
  );
}

module.exports = seed;
