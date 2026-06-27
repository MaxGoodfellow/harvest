const { z } = require('zod');
const { optionalInt, optionalString } = require('./helpers');

const harvestSessionSchema = z.object({
  campaign_id: optionalInt(),
  name: z.string().min(1).max(150),
  session_date: optionalString(),
  notes: optionalString(),
});

module.exports = { harvestSessionSchema };
