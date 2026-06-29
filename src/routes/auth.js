const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const lookups = require('../repositories/lookups');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Try again in a few minutes.',
});

async function loginViewData(extra) {
  const settings = await lookups.settings();
  return {
    title: 'Log in',
    layout: false,
    backgroundImage: settings.login_background_image || null,
    ...extra,
  };
}

router.get('/login', async (req, res, next) => {
  try {
    res.render('auth/login', await loginViewData({ error: null }));
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const validUsername = username === process.env.ADMIN_USERNAME;
    const validPassword =
      validUsername &&
      process.env.ADMIN_PASSWORD_HASH &&
      (await bcrypt.compare(password || '', process.env.ADMIN_PASSWORD_HASH));

    if (!validUsername || !validPassword) {
      return res.status(401).render('auth/login', await loginViewData({ error: 'Invalid username or password.' }));
    }

    req.session.isAuthenticated = true;
    const basePath = process.env.BASE_PATH || '';
    const returnTo = req.session.returnTo || `${basePath}/dashboard`;
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect(`${process.env.BASE_PATH || ''}/login`);
  });
});

module.exports = router;
