const { z } = require('zod');
const { checkbox, optionalInt, optionalNumber, optionalString } = require('./helpers');

const componentSchema = z.object({
  harvest_tag_id: z.coerce.number().int(),
  skill_id: optionalInt(),
  name: z.string().min(1).max(150),
  description: optionalString(),
  base_dc_modifier: z.coerce.number().int().default(0),
  use_manual_dc: checkbox(),
  manual_dc: optionalInt(),
  use_fixed_value: checkbox(),
  fixed_crafting_value_cp: optionalInt(),
  value_percentage: optionalNumber(),
  sale_value_percentage: optionalNumber(),
  is_hazardous: checkbox(),
  hazard_type_id: optionalInt(),
  hazard_save_type: optionalString(),
  hazard_dc_modifier: z.coerce.number().int().default(0),
  crafting_uses: optionalString(),
  is_formula_required: checkbox(),
  is_formula_unlocking: checkbox(),
  sort_order: z.coerce.number().int().default(0),
  alternate_skill_ids: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.coerce.number().int())
  ),
});

module.exports = { componentSchema };
