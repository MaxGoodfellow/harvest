const { z } = require('zod');
const { optionalInt, optionalString } = require('./helpers');

const buyerSchema = z.object({
  name: z.string().min(1).max(150),
  buyer_type: z.string().min(1).max(50).default('Standard'),
  default_sale_percentage: z.coerce.number().min(0).max(200),
  location_id: optionalInt(),
  campaign_id: optionalInt(),
  notes: optionalString(),
  moral_legal_warning: optionalString(),
  accepted_tag_ids: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.coerce.number().int())
  ),
  rejected_tag_ids: z.preprocess(
    (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.coerce.number().int())
  ),
});

module.exports = { buyerSchema };
