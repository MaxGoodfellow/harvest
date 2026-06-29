const test = require('node:test');
const assert = require('node:assert/strict');
const { parseImageDataUrl, MAX_BYTES } = require('../src/validation/settings');

// A real 1x1 transparent PNG, so Buffer.from(..., 'base64') round-trips a
// valid byte sequence rather than arbitrary text.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('parseImageDataUrl accepts a valid PNG data URL', () => {
  const result = parseImageDataUrl(`data:image/png;base64,${TINY_PNG_BASE64}`);
  assert.equal(result.error, undefined);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.extension, 'png');
  assert.equal(result.buffer.length, 68);
});

test('parseImageDataUrl accepts jpeg/webp/gif mime prefixes', () => {
  for (const [mime, ext] of [['jpeg', 'jpg'], ['webp', 'webp'], ['gif', 'gif']]) {
    const result = parseImageDataUrl(`data:image/${mime};base64,${TINY_PNG_BASE64}`);
    assert.equal(result.error, undefined, `expected image/${mime} to be accepted`);
    assert.equal(result.extension, ext);
  }
});

test('parseImageDataUrl rejects a non-image mime type', () => {
  const result = parseImageDataUrl(`data:application/pdf;base64,${TINY_PNG_BASE64}`);
  assert.match(result.error, /supported image type/);
});

test('parseImageDataUrl rejects an unsupported image type (e.g. svg)', () => {
  const result = parseImageDataUrl(`data:image/svg+xml;base64,${TINY_PNG_BASE64}`);
  assert.match(result.error, /supported image type/);
});

test('parseImageDataUrl rejects malformed/missing input', () => {
  assert.match(parseImageDataUrl('').error, /supported image type/);
  assert.match(parseImageDataUrl(undefined).error, /supported image type/);
  assert.match(parseImageDataUrl('not a data url').error, /supported image type/);
});

test('parseImageDataUrl rejects an empty (zero-byte) image', () => {
  const result = parseImageDataUrl('data:image/png;base64,');
  assert.match(result.error, /empty/);
});

test('parseImageDataUrl rejects an image over the size limit', () => {
  // Build a base64 payload whose decoded size exceeds MAX_BYTES.
  const oversized = Buffer.alloc(MAX_BYTES + 1024, 1).toString('base64');
  const result = parseImageDataUrl(`data:image/png;base64,${oversized}`);
  assert.match(result.error, /too large/);
});

test('parseImageDataUrl accepts an image right at the size limit', () => {
  const atLimit = Buffer.alloc(MAX_BYTES, 1).toString('base64');
  const result = parseImageDataUrl(`data:image/png;base64,${atLimit}`);
  assert.equal(result.error, undefined);
  assert.equal(result.buffer.length, MAX_BYTES);
});
