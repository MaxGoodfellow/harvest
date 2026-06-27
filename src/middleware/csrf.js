const crypto = require('crypto');

// Minimal session-bound CSRF protection (csurf is deprecated/unmaintained).
// A token is generated once per session and exposed to every view as
// `csrfToken`; state-changing requests must echo it back in `_csrf`.
function attachToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function verifyToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const submitted = req.body && req.body._csrf;
  const expected = req.session.csrfToken;
  if (!expected || !submitted || submitted !== expected) {
    return res.status(403).render('errors/500', {
      title: 'Forbidden',
      message: 'Your session expired or this form was submitted from outside the app. Please reload the page and try again.',
    });
  }
  next();
}

module.exports = { attachToken, verifyToken };
