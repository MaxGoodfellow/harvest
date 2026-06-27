const express = require('express');
const sessionsRepo = require('../repositories/harvestSessions');
const attemptsRepo = require('../repositories/harvestAttempts');
const lookups = require('../repositories/lookups');
const { harvestSessionSchema } = require('../validation/harvestSession');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [sessions, unassignedAttempts] = await Promise.all([
      sessionsRepo.list(),
      attemptsRepo.list({ sessionId: null }),
    ]);
    res.render('sessions/index', {
      title: 'Session Log',
      sessions,
      unassignedAttempts,
      currentPath: req.originalUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const campaigns = await lookups.campaigns();
    res.render('sessions/form', { title: 'New Session', mode: 'create', session: {}, errors: null, campaigns });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = harvestSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      const campaigns = await lookups.campaigns();
      return res.status(400).render('sessions/form', {
        title: 'New Session',
        mode: 'create',
        session: req.body,
        errors: parsed.error.flatten().fieldErrors,
        campaigns,
      });
    }
    const id = await sessionsRepo.create(parsed.data);
    res.redirect(`${req.app.locals.basePath}/sessions/${id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const session = await sessionsRepo.getById(req.params.id);
    if (!session) return res.status(404).render('errors/404', { title: 'Not found' });
    const attempts = await attemptsRepo.list({ sessionId: session.id });
    const allSessions = await sessionsRepo.list();
    res.render('sessions/show', {
      title: session.name,
      session,
      attempts,
      sessions: allSessions,
      currentPath: req.originalUrl,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const session = await sessionsRepo.getById(req.params.id);
    if (!session) return res.status(404).render('errors/404', { title: 'Not found' });
    const campaigns = await lookups.campaigns();
    res.render('sessions/form', { title: `Edit ${session.name}`, mode: 'edit', session, errors: null, campaigns });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const parsed = harvestSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      const session = await sessionsRepo.getById(req.params.id);
      const campaigns = await lookups.campaigns();
      return res.status(400).render('sessions/form', {
        title: `Edit ${session.name}`,
        mode: 'edit',
        session: { ...session, ...req.body, id: session.id },
        errors: parsed.error.flatten().fieldErrors,
        campaigns,
      });
    }
    await sessionsRepo.update(req.params.id, parsed.data);
    res.redirect(`${req.app.locals.basePath}/sessions/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/attempts/:attemptId/assign', async (req, res, next) => {
  try {
    await attemptsRepo.assignSession(req.params.attemptId, req.body.sessionId || null);
    res.redirect(req.body.returnTo || `${req.app.locals.basePath}/sessions`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
