const { z } = require('zod');
const { checkbox, optionalInt, optionalString } = require('./helpers');

const craftingProjectSchema = z.object({
  campaign_id: optionalInt(),
  name: z.string().min(1).max(150),
  item_gp_cost_cp: z.coerce.number().int().min(0),
  is_formula_required: checkbox(),
  is_formula_unlocking: checkbox(),
  status: z.string().min(1).max(30).default('planned'),
  notes: optionalString(),
});

module.exports = { craftingProjectSchema };
