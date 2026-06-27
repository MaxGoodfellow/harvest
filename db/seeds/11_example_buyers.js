const { upsert, getId } = require('./_helpers');

// CLAUDE.md §10/§11 give default sale-percentage tiers (standard 50%,
// specialist 60-75%, poor market 25-40%) but no named example buyers —
// these three are illustrative, one per tier, so the Calculator's buyer
// picker and the accepted/rejected-tag gating have real data to exercise.

async function setTagJunction(conn, table, buyerId, tagNames) {
  await conn.query(`DELETE FROM ${table} WHERE buyer_id = ?`, [buyerId]);
  for (const tagName of tagNames) {
    const tagId = await getId(conn, 'harvest_tags', 'name', tagName);
    await conn.query(
      `INSERT INTO ${table} (buyer_id, harvest_tag_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE buyer_id = buyer_id`,
      [buyerId, tagId]
    );
  }
}

async function seed(conn) {
  const localMarketId = await upsert(conn, 'buyers', ['name'], {
    name: 'Local Market',
    buyer_type: 'Standard',
    default_sale_percentage: 50,
    location_id: null,
    campaign_id: null,
    notes: 'General goods buyer — takes most harvested materials at the standard rate.',
    moral_legal_warning: null,
  });
  await setTagJunction(conn, 'buyer_accepted_tags', localMarketId, []);
  await setTagJunction(conn, 'buyer_rejected_tags', localMarketId, ['Humanoid']);

  const alchemistGuildId = await upsert(conn, 'buyers', ['name'], {
    name: "Alchemist's Guild",
    buyer_type: 'Specialist',
    default_sale_percentage: 70,
    location_id: null,
    campaign_id: null,
    notes: 'Pays a premium for alchemically useful components.',
    moral_legal_warning: null,
  });
  await setTagJunction(conn, 'buyer_accepted_tags', alchemistGuildId, [
    'Venom', 'Acid', 'Organ', 'Blood', 'Magical',
  ]);
  await setTagJunction(conn, 'buyer_rejected_tags', alchemistGuildId, ['Humanoid']);

  const fenceId = await upsert(conn, 'buyers', ['name'], {
    name: 'Black Market Fence',
    buyer_type: 'Poor Market',
    default_sale_percentage: 30,
    location_id: null,
    campaign_id: null,
    notes: 'Asks no questions and pays poorly — but takes almost anything.',
    moral_legal_warning:
      'Dealing with this fence is itself a crime in most jurisdictions; humanoid remains will draw serious legal and reputational consequences.',
  });
  await setTagJunction(conn, 'buyer_accepted_tags', fenceId, []);
  await setTagJunction(conn, 'buyer_rejected_tags', fenceId, []);
}

module.exports = seed;
