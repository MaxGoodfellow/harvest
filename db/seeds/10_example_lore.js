const { upsert, getId } = require('./_helpers');

// Worked examples of the §8.4 Lore modifier (-2 specific), using the lore
// names from the GM-provided harvest skill mapping ("Hunting Lore",
// "Leatherworking Lore", "Alchemical Lore") rather than invented names.
// Superseded the earlier ad hoc "Wolf Tracking Lore" placeholder.

async function linkComponentLore(conn, creatureName, componentName, loreName, loreDescription, dcModifier) {
  const loreId = await upsert(conn, 'lores', ['name'], {
    name: loreName,
    description: loreDescription,
  });

  const creatureId = await getId(conn, 'creatures', 'name', creatureName);
  const [componentRows] = await conn.query(
    'SELECT id FROM components WHERE creature_id = ? AND name = ?',
    [creatureId, componentName]
  );
  if (!componentRows.length) return;

  await conn.query(
    `INSERT INTO component_lores (component_id, lore_id, dc_modifier) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE dc_modifier = ?`,
    [componentRows[0].id, loreId, dcModifier, dcModifier]
  );
}

async function seed(conn) {
  await conn.query('DELETE FROM lores WHERE name = ?', ['Wolf Tracking Lore']);

  await linkComponentLore(
    conn,
    'Wolf',
    'Wolf Pelt Trophy',
    'Hunting Lore',
    'Specific expertise in tracking and hunting game animals.',
    -2
  );
  await linkComponentLore(
    conn,
    'Wolf',
    'Wolf Hide',
    'Leatherworking Lore',
    'Specific expertise in tanning and preparing hides for leatherworking.',
    -2
  );
  await linkComponentLore(
    conn,
    'Giant Spider',
    'Venom Sac',
    'Alchemical Lore',
    'Specific expertise in handling and extracting alchemical/venom components.',
    -2
  );
}

module.exports = seed;
