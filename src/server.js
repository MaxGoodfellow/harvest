require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const pool = require('./db/pool');
const auth = require('./middleware/auth');
const buildSessionMiddleware = require('./middleware/session');
const csrf = require('./middleware/csrf');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const monstersRouter = require('./routes/monsters');
const calculatorRouter = require('./routes/calculator');
const buyersRouter = require('./routes/buyers');
const inventoryRouter = require('./routes/inventory');
const sessionsRouter = require('./routes/sessions');
const craftingRouter = require('./routes/crafting');
const importExportRouter = require('./routes/importExport');
const { formatCp, formatMinutes, formatMinutesRange } = require('./lib/money');

const BASE_PATH = process.env.BASE_PATH || '';
const PORT = Number(process.env.PORT) || 3004;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();

app.set('trust proxy', Number(process.env.TRUST_PROXY) || 0);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);
// Bumped from the 100kb default — the JSON/CSV import forms post a full
// file's contents as one text field, and form-urlencoding a CSV inflates it
// (commas/quotes/newlines each become a 3-byte %XX escape), so the encoded
// body can run several times larger than the source file.
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(expressLayouts);
app.set('layout', 'layout');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
router.use(express.static(path.join(__dirname, '..', 'public')));

// Health check stays unauthenticated (process managers/monitoring shouldn't
// need credentials) and ahead of the session/CSRF stack since it does
// neither.
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

router.use(buildSessionMiddleware());
router.use((req, res, next) => {
  res.locals.isAuthenticated = Boolean(req.session.isAuthenticated);
  res.locals.currentPath = req.path;
  next();
});
router.use(csrf.attachToken);
router.use(csrf.verifyToken);

// Login/logout must be reachable before the auth gate below, or a logged-out
// GM could never reach the login form.
router.use('/', authRouter);

router.use(auth);

router.get('/', (req, res) => res.redirect(`${BASE_PATH}/dashboard`));
router.use('/dashboard', dashboardRouter);
router.use('/monsters/api', apiLimiter);
router.use('/monsters', monstersRouter);
router.use('/calculator', apiLimiter, calculatorRouter);
router.use('/buyers', buyersRouter);
router.use('/inventory', inventoryRouter);
router.use('/sessions', sessionsRouter);
router.use('/crafting', craftingRouter);
router.use('/import-export', importExportRouter);

app.use(BASE_PATH, router);
app.locals.basePath = BASE_PATH;
app.locals.formatCp = formatCp;
app.locals.formatMinutes = formatMinutes;
app.locals.formatMinutesRange = formatMinutesRange;

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message;
  res.status(status).render('errors/500', { title: 'Error', message });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Harvest listening on http://${HOST}:${PORT}${BASE_PATH}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
