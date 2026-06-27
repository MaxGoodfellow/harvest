const express = require('express');
const craftingRepo = require('../repositories/craftingProjects');
const inventoryRepo = require('../repositories/materialsInventory');
const lookups = require('../repositories/lookups');
const { craftingProjectSchema } = require('../validation/craftingProject');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const projects = await craftingRepo.list();
    res.render('crafting/index', { title: 'Crafting Uses', projects });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const campaigns = await lookups.campaigns();
    res.render('crafting/form', { title: 'New Crafting Project', mode: 'create', project: {}, errors: null, campaigns });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = craftingProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const campaigns = await lookups.campaigns();
      return res.status(400).render('crafting/form', {
        title: 'New Crafting Project',
        mode: 'create',
        project: req.body,
        errors: parsed.error.flatten().fieldErrors,
        campaigns,
      });
    }
    const id = await craftingRepo.create(parsed.data);
    res.redirect(`${req.app.locals.basePath}/crafting/${id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await craftingRepo.getById(req.params.id);
    if (!project) return res.status(404).render('errors/404', { title: 'Not found' });
    const availableMaterials = await inventoryRepo.list({ status: 'available' });
    res.render('crafting/show', { title: project.name, project, availableMaterials });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const project = await craftingRepo.getById(req.params.id);
    if (!project) return res.status(404).render('errors/404', { title: 'Not found' });
    const campaigns = await lookups.campaigns();
    res.render('crafting/form', { title: `Edit ${project.name}`, mode: 'edit', project, errors: null, campaigns });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const parsed = craftingProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const project = await craftingRepo.getById(req.params.id);
      const campaigns = await lookups.campaigns();
      return res.status(400).render('crafting/form', {
        title: `Edit ${project.name}`,
        mode: 'edit',
        project: { ...project, ...req.body, id: project.id },
        errors: parsed.error.flatten().fieldErrors,
        campaigns,
      });
    }
    await craftingRepo.update(req.params.id, parsed.data);
    res.redirect(`${req.app.locals.basePath}/crafting/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/materials', async (req, res, next) => {
  try {
    await craftingRepo.attachMaterial(req.params.id, req.body.materialsInventoryId);
    res.redirect(`${req.app.locals.basePath}/crafting/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/materials/:materialId/detach', async (req, res, next) => {
  try {
    await craftingRepo.detachMaterial(req.params.id, req.params.materialId);
    res.redirect(`${req.app.locals.basePath}/crafting/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
