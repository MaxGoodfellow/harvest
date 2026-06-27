const { z } = require('zod');
const { optionalInt, optionalString } = require('./helpers');

const materialsInventorySchema = z.object({
  creature_id: optionalInt(),
  component_id: optionalInt(),
  campaign_id: optionalInt(),
  location_id: optionalInt(),
  name: z.string().min(1).max(150),
  quality: z.enum(['Poor', 'Standard', 'Pristine', 'Ruined']).default('Standard'),
  crafting_value_cp: z.coerce.number().int().min(0).default(0),
  status: z.enum(['available', 'sold', 'used', 'spoiled', 'destroyed', 'gifted', 'quest_item']).default('available'),
  condition: optionalString(),
  preserved_until: optionalString(),
  notes: optionalString(),
});

module.exports = { materialsInventorySchema };
