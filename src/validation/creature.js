const { z } = require('zod');
const { checkbox, optionalInt, optionalString } = require('./helpers');

const creatureSchema = z.object({
  name: z.string().min(1).max(150),
  level: z.coerce.number().int().min(-1).max(30),
  size: z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'unique']).default('common'),
  creature_type: z.string().min(1).max(50),
  intelligence_category: z
    .enum(['Non-sapient', 'Animal-level', 'Sapient', 'Humanoid', 'Unique NPC'])
    .default('Animal-level'),
  harvest_tier: z.coerce.number().int().min(0).max(3),
  required_proficiency: z
    .enum(['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'])
    .default('Trained'),
  campaign_id: optionalInt(),
  source_id: optionalInt(),
  location_id: optionalInt(),
  is_signature: checkbox(),
  is_morally_sensitive: checkbox(),
  use_manual_value: checkbox(),
  manual_total_harvest_value_cp: optionalInt(),
  description: optionalString(),
  gm_notes: optionalString(),
  tag_ids: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.coerce.number().int())
  ),
});

module.exports = { creatureSchema };
