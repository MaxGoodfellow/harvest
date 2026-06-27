const express = require('express');
const buyersRepo = require('../repositories/buyers');
const harvestTagsRepo = require('../repositories/harvestTags');
const lookups = require('../repositories/lookups');
const { buyerSchema } = require('../validation/buyer');

const router = express.Router();

async function loadFormLookups() {
  const [tags, locations, campaigns] = await Promise.all([
    harvestTagsRepo.listAll(),
    lookups.locations(),
    lookups.campaigns(),
  ]);
  return { tags, locations, campaigns };
}

router.get('/', async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === '1';
    const buyers = await buyersRepo.list({ includeArchived });
    res.render('buyers/index', { title: 'Buyers / Markets', buyers, includeArchived });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const formLookups = await loadFormLookups();
    res.render('buyers/form', {
      title: 'New Buyer',
      mode: 'create',
      buyer: {},
      errors: null,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = buyerSchema.safeParse(req.body);
    if (!parsed.success) {
      const formLookups = await loadFormLookups();
      return res.status(400).render('buyers/form', {
        title: 'New Buyer',
        mode: 'create',
        buyer: req.body,
        errors: parsed.error.flatten().fieldErrors,
        ...formLookups,
      });
    }
    const { accepted_tag_ids, rejected_tag_ids, ...data } = parsed.data;
    const id = await buyersRepo.create(data, accepted_tag_ids, rejected_tag_ids);
    res.redirect(`${req.app.locals.basePath}/buyers/${id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const buyer = await buyersRepo.getById(req.params.id, { includeArchived: true });
    if (!buyer) return res.status(404).render('errors/404', { title: 'Not found' });
    res.render('buyers/show', { title: buyer.name, buyer });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const buyer = await buyersRepo.getById(req.params.id, { includeArchived: true });
    if (!buyer) return res.status(404).render('errors/404', { title: 'Not found' });
    const formLookups = await loadFormLookups();
    res.render('buyers/form', {
      title: `Edit ${buyer.name}`,
      mode: 'edit',
      buyer,
      errors: null,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const parsed = buyerSchema.safeParse(req.body);
    if (!parsed.success) {
      const buyer = await buyersRepo.getById(req.params.id, { includeArchived: true });
      const formLookups = await loadFormLookups();
      return res.status(400).render('buyers/form', {
        title: `Edit ${buyer.name}`,
        mode: 'edit',
        buyer: { ...buyer, ...req.body, id: buyer.id },
        errors: parsed.error.flatten().fieldErrors,
        ...formLookups,
      });
    }
    const { accepted_tag_ids, rejected_tag_ids, ...data } = parsed.data;
    await buyersRepo.update(req.params.id, data, accepted_tag_ids, rejected_tag_ids);
    res.redirect(`${req.app.locals.basePath}/buyers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    await buyersRepo.archive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/buyers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unarchive', async (req, res, next) => {
  try {
    await buyersRepo.unarchive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/buyers/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
