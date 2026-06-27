const express = require('express');
const inventoryRepo = require('../repositories/materialsInventory');
const creaturesRepo = require('../repositories/creatures');
const lookups = require('../repositories/lookups');
const { materialsInventorySchema } = require('../validation/materialsInventory');

const router = express.Router();

async function loadFormLookups() {
  const [creatures, campaigns, locations] = await Promise.all([
    creaturesRepo.list({}),
    lookups.campaigns(),
    lookups.locations(),
  ]);
  return { creatures, campaigns, locations };
}

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || undefined,
      campaignId: req.query.campaignId || undefined,
      locationId: req.query.locationId || undefined,
      includeArchived: req.query.includeArchived === '1',
    };
    const items = await inventoryRepo.list(filters);
    res.render('inventory/index', {
      title: 'Material Inventory',
      items,
      filters,
      STATUSES: inventoryRepo.STATUSES,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const formLookups = await loadFormLookups();
    res.render('inventory/form', {
      title: 'Add Material',
      mode: 'create',
      item: { creature_id: req.query.creatureId || '', status: 'available', quality: 'Standard' },
      errors: null,
      STATUSES: inventoryRepo.STATUSES,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = materialsInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      const formLookups = await loadFormLookups();
      return res.status(400).render('inventory/form', {
        title: 'Add Material',
        mode: 'create',
        item: req.body,
        errors: parsed.error.flatten().fieldErrors,
        STATUSES: inventoryRepo.STATUSES,
        ...formLookups,
      });
    }
    const id = await inventoryRepo.create(parsed.data);
    res.redirect(`${req.app.locals.basePath}/inventory/${id}/edit`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const item = await inventoryRepo.getById(req.params.id, { includeArchived: true });
    if (!item) return res.status(404).render('errors/404', { title: 'Not found' });
    const formLookups = await loadFormLookups();
    res.render('inventory/form', {
      title: `Edit — ${item.name}`,
      mode: 'edit',
      item,
      errors: null,
      STATUSES: inventoryRepo.STATUSES,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const parsed = materialsInventorySchema.safeParse(req.body);
    if (!parsed.success) {
      const item = await inventoryRepo.getById(req.params.id, { includeArchived: true });
      const formLookups = await loadFormLookups();
      return res.status(400).render('inventory/form', {
        title: `Edit — ${item.name}`,
        mode: 'edit',
        item: { ...item, ...req.body, id: item.id },
        errors: parsed.error.flatten().fieldErrors,
        STATUSES: inventoryRepo.STATUSES,
        ...formLookups,
      });
    }
    await inventoryRepo.update(req.params.id, parsed.data);
    res.redirect(`${req.app.locals.basePath}/inventory`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    await inventoryRepo.archive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/inventory`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unarchive', async (req, res, next) => {
  try {
    await inventoryRepo.unarchive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/inventory`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
