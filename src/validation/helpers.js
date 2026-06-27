const { z } = require('zod');

// HTML checkboxes submit "on" when checked and are simply absent when not —
// there's no false value to coerce, so this treats "missing" as false.
const checkbox = () => z.preprocess((v) => v === 'on' || v === true || v === 'true', z.boolean());

// HTML number/text inputs left blank submit '' — coercing that straight to a
// number would silently become 0 instead of "no value", so blank/nullish
// inputs are normalized to null before the real type check runs.
const optionalInt = () =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().int().nullable());

const optionalNumber = () =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.coerce.number().nullable());

const optionalString = () =>
  z.preprocess((v) => (v === '' || v === undefined || v === null ? null : v), z.string().nullable());

module.exports = { checkbox, optionalInt, optionalNumber, optionalString };
