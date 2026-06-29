const express = require('express');
const fs = require('fs');
const path = require('path');
const lookups = require('../repositories/lookups');
const { parseImageDataUrl } = require('../validation/settings');

const router = express.Router();
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');

function deleteIfExists(relativePath) {
  if (!relativePath) return;
  const fullPath = path.join(PUBLIC_DIR, relativePath.replace(/^\//, ''));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

router.get('/', async (req, res, next) => {
  try {
    const settings = await lookups.settings();
    res.render('settings/index', {
      title: 'Settings',
      loginBackgroundImage: settings.login_background_image || '',
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/background-image', async (req, res, next) => {
  try {
    const parsed = parseImageDataUrl(req.body.imageData);
    if (parsed.error) {
      const settings = await lookups.settings();
      return res.status(400).render('settings/index', {
        title: 'Settings',
        loginBackgroundImage: settings.login_background_image || '',
        error: parsed.error,
      });
    }

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const settings = await lookups.settings();
    deleteIfExists(settings.login_background_image);

    const filename = `login-bg-${Date.now()}.${parsed.extension}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), parsed.buffer);
    await lookups.setSetting('login_background_image', `/uploads/${filename}`, 'string');

    res.redirect(`${req.app.locals.basePath}/settings`);
  } catch (err) {
    next(err);
  }
});

router.post('/background-image/remove', async (req, res, next) => {
  try {
    const settings = await lookups.settings();
    deleteIfExists(settings.login_background_image);
    await lookups.setSetting('login_background_image', '', 'string');
    res.redirect(`${req.app.locals.basePath}/settings`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
