// Validates a base64 data: URL (read client-side via FileReader.readAsDataURL
// and posted as a normal text field — same no-multipart-needed approach as
// the CSV/JSON importers' FileReader-into-hidden-field pattern). Pure, no
// DB/I/O, easy to unit test.
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*=*)$/;

function parseImageDataUrl(dataUrl) {
  const match = DATA_URL_PATTERN.exec(dataUrl || '');
  if (!match) {
    return { error: "That file isn't a supported image type (PNG, JPEG, WebP, or GIF)." };
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length === 0) {
    return { error: 'The uploaded file is empty.' };
  }
  if (buffer.length > MAX_BYTES) {
    return { error: `Image is too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB) — max ${MAX_BYTES / 1024 / 1024}MB.` };
  }

  return { mimeType, buffer, extension: MIME_EXT[mimeType] };
}

module.exports = { parseImageDataUrl, MAX_BYTES };
