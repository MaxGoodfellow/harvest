// Single seam for auth. Pass-through while AUTH_ENABLED=false (dev
// convenience) — must be turned on before the server is reachable by anyone
// but the GM (see CLAUDE.md §16).
function auth(req, res, next) {
  if (process.env.AUTH_ENABLED !== 'true') return next();
  if (req.session.isAuthenticated) return next();

  const basePath = process.env.BASE_PATH || '';
  req.session.returnTo = req.originalUrl;
  return res.redirect(`${basePath}/login`);
}

module.exports = auth;
