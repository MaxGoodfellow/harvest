const { upsert, getId, linkJunction } = require('./_helpers');

// CLAUDE.md §12 item 5 + signature table. "Black Dragon (placeholder)" has no
// pinned level — using the PF2e Young Black Dragon (level 7, Large, Dragon,
// uncommon) as the placeholder stat block. Sapient + is_morally_sensitive
// because it's a unique, named creature (triggers the §9 humanoid/desecration
// warning, which reads sensibly for a dragon too).
//
// Of the 7 signature rows, only Acid Sac's skill list ("Medicine or Arcana")
// is pinned by CLAUDE.md §12 — kept exactly as specified. The other 6 rows'
// primary/alternate skills follow the GM-provided harvest skill mapping
// ("Dragon or magical beast parts -> Arcana, Survival, or Dragon Lore";
// hide/chitin/scale/bone -> Crafting or Survival; organs/blood -> Medicine).
async function seed(conn) {
  const creatureId = await upsert(conn, 'creatures', ['name'], {
    name: 'Black Dragon (placeholder)',
    level: 7,
    size: 'Large',
    rarity: 'uncommon',
    creature_type: 'Dragon',
    intelligence_category: 'Sapient',
    harvest_tier: 3,
    required_proficiency: 'Expert',
    is_signature: true,
    is_morally_sensitive: true,
    use_manual_value: false,
    manual_total_harvest_value_cp: null,
    total_harvest_value_formula: '(level^2) * 200 cp',
    description: 'A young black dragon — corrosive breath, swamp-dweller, signature harvest table.',
    gm_notes: 'Placeholder stat block; replace level/stats with the specific dragon used in your campaign.',
  });

  for (const tagName of ['Hide', 'Bone', 'Organ', 'Blood', 'Acid', 'Magical', 'Trophy']) {
    const tagId = await getId(conn, 'harvest_tags', 'name', tagName);
    await linkJunction(conn, 'creature_harvest_tags', ['creature_id', 'harvest_tag_id'], [
      creatureId,
      tagId,
    ]);
  }

  const signatureTableId = await upsert(conn, 'signature_tables', ['creature_id'], {
    creature_id: creatureId,
    name: 'Black Dragon Signature Harvest Table',
    description: 'Full signature harvest table for the Black Dragon placeholder.',
  });

  const survivalId = await getId(conn, 'skills', 'name', 'Survival');
  const medicineId = await getId(conn, 'skills', 'name', 'Medicine');
  const arcanaId = await getId(conn, 'skills', 'name', 'Arcana');
  const craftingId = await getId(conn, 'skills', 'name', 'Crafting');

  const rows = [
    {
      name: 'Black Dragon Hide/Scales',
      skill_id: survivalId,
      alt_skill_ids: [craftingId, arcanaId],
      dc_modifier: 0,
      time_minutes: 60,
      time_display: '1 hour',
      critical_success_text: 'Pristine, unblemished scales — superior crafting material.',
      success_text: 'Standard dragon hide section, usable for armor crafting.',
      failure_text: 'Hide torn or damaged — reduced value.',
      critical_failure_text: 'Hide ruined beyond use.',
      crafting_uses: 'Dragonhide armor, shields, decorative crafting.',
      sort_order: 1,
    },
    {
      name: 'Acid Sac',
      skill_id: medicineId,
      alt_skill_ids: [arcanaId],
      dc_modifier: 4,
      time_minutes: 60,
      time_display: '1 hour',
      critical_success_text: 'Intact pristine acid sac, rare crafting component.',
      success_text: 'Standard acid sac sample.',
      failure_text: 'Leaking unstable sac — half value or extra time.',
      critical_failure_text: 'Acid burst, component ruined; basic Reflex save vs harvest DC.',
      crafting_uses: 'Acid flasks, acid-resistant items, corrosive runes, alchemical research.',
      sort_order: 2,
    },
    {
      name: 'Teeth/Claws/Horns',
      skill_id: survivalId,
      alt_skill_ids: [craftingId, arcanaId],
      dc_modifier: 0,
      time_minutes: 30,
      time_display: '30 minutes',
      critical_success_text: 'Pristine, unbroken set — premium crafting material.',
      success_text: 'Standard set of teeth/claws/horns, useful for weapon crafting.',
      failure_text: 'Chipped or cracked — reduced value.',
      critical_failure_text: 'Destroyed in the attempt.',
      crafting_uses: 'Natural weapons, jewelry, trophy crafting.',
      sort_order: 3,
    },
    {
      name: 'Dragon Blood',
      skill_id: medicineId,
      alt_skill_ids: [arcanaId],
      dc_modifier: 1,
      time_minutes: 30,
      time_display: '30 minutes',
      critical_success_text: 'Potent, magically-charged blood sample.',
      success_text: 'Standard vial of dragon blood.',
      failure_text: 'Sample contaminated or degraded.',
      critical_failure_text: 'Blood spoils, unusable.',
      crafting_uses: 'Alchemical elixirs, blood-based rituals, resistance potions.',
      sort_order: 4,
    },
    {
      name: 'Dragon Heart',
      skill_id: medicineId,
      alt_skill_ids: [arcanaId],
      dc_modifier: 2,
      time_minutes: 60,
      time_display: '1 hour',
      critical_success_text: 'Still resonating with draconic power — exceptional component.',
      success_text: 'Standard dragon heart, valuable arcane component.',
      failure_text: 'Heart damaged in extraction — reduced value.',
      critical_failure_text: 'Heart destroyed.',
      crafting_uses: 'High-tier alchemical items, arcane foci, rare crafting recipes.',
      sort_order: 5,
    },
    {
      name: 'Dragon Eyes',
      skill_id: medicineId,
      alt_skill_ids: [arcanaId],
      dc_modifier: 1,
      time_minutes: 30,
      time_display: '30 minutes',
      critical_success_text: 'Perfectly preserved eyes, prized by alchemists and seers.',
      success_text: 'Standard pair of dragon eyes.',
      failure_text: 'Eyes damaged.',
      critical_failure_text: 'Eyes destroyed, unusable.',
      crafting_uses: 'Scrying components, alchemical reagents, curios.',
      sort_order: 6,
    },
    {
      name: 'Trophy Head',
      skill_id: survivalId,
      alt_skill_ids: [arcanaId],
      dc_modifier: 0,
      time_minutes: 120,
      time_display: '2 hours',
      critical_success_text: 'Magnificent, perfectly preserved trophy — a hall centerpiece.',
      success_text: 'Standard mounted trophy head.',
      failure_text: 'Head damaged during removal.',
      critical_failure_text: 'Head destroyed, unusable.',
      crafting_uses: 'Trophy display, intimidation/reputation use, sold to collectors.',
      sort_order: 7,
    },
  ];

  for (const row of rows) {
    const { alt_skill_ids, ...data } = row;
    const rowId = await upsert(conn, 'signature_rows', ['signature_table_id', 'name'], {
      signature_table_id: signatureTableId,
      ...data,
    });
    // Clear stale links first — alt_skill_ids can change between seed runs
    // (e.g. when this file's definitions are edited), and linkJunction alone
    // only adds rows, it never removes ones that are no longer current.
    await conn.query('DELETE FROM signature_row_alternate_skills WHERE signature_row_id = ?', [rowId]);
    for (const altSkillId of alt_skill_ids) {
      await linkJunction(conn, 'signature_row_alternate_skills', ['signature_row_id', 'skill_id'], [
        rowId,
        altSkillId,
      ]);
    }
  }
}

module.exports = seed;
