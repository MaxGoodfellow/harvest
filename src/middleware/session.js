const session = require('express-session');

// In-memory store (express-session's default) — a PM2 restart logs everyone
// out. Acceptable for a single-admin tool; matches the documented behavior
// of this server's other in-memory-session apps (the-adventurer, homepage).
// Cookie name/scoping per SERVER.md's harvest allocation.
function buildSessionMiddleware() {
  const basePath = process.env.BASE_PATH || '/';
  return session({
    name: 'harvest.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: basePath,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

module.exports = buildSessionMiddleware;
