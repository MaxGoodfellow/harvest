const { z } = require('zod');

// Loose on purpose: only the fields the importer absolutely needs to resolve
// natural keys are required. Everything else passes through untouched so the
// importer (which mirrors db/seeds/_helpers.js's upsert-by-natural-key
// pattern) can read whatever optional fields are present.
const importSchema = z.object({
  creatures: z
    .array(z.object({ name: z.string().min(1), level: z.coerce.number().int() }).passthrough())
    .optional()
    .default([]),
  buyers: z
    .array(z.object({ name: z.string().min(1), default_sale_percentage: z.coerce.number() }).passthrough())
    .optional()
    .default([]),
});

module.exports = { importSchema };
