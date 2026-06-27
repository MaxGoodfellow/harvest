const express = require('express');
const creaturesRepo = require('../repositories/creatures');
const componentsRepo = require('../repositories/components');
const harvestTagsRepo = require('../repositories/harvestTags');
const lookups = require('../repositories/lookups');
const rules = require('../lib/harvest-rules');
const { creatureSchema } = require('../validation/creature');
const { componentSchema } = require('../validation/component');

const router = express.Router();

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const INTELLIGENCE_CATEGORIES = ['Non-sapient', 'Animal-level', 'Sapient', 'Humanoid', 'Unique NPC'];
const PROFICIENCIES = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

async function loadFormLookups() {
  const [tags, sources, locations, campaigns, skills, hazardTypes] = await Promise.all([
    harvestTagsRepo.listAll(),
    lookups.sources(),
    lookups.locations(),
    lookups.campaigns(),
    lookups.skills(),
    lookups.hazardTypes(),
  ]);
  return { tags, sources, locations, campaigns, skills, hazardTypes };
}

async function deriveCreatureFacts(creature) {
  const [dcTable, settings] = await Promise.all([lookups.dcByLevel(), lookups.settings()]);
  const baseDc = rules.baseDcForLevel(creature.level, dcTable);
  const totalHarvestValueCp = rules.totalHarvestValueCp(creature.level, {
    manual: creature.use_manual_value ? creature.manual_total_harvest_value_cp : null,
  });
  const allocationWarning = rules.componentAllocationWarning(creature.components, {
    isSignature: creature.is_signature,
  });
  const showHumanoidWarning =
    settings.humanoid_warnings_enabled &&
    (INTELLIGENCE_CATEGORIES.slice(2).includes(creature.intelligence_category) ||
      creature.is_morally_sensitive);

  return { baseDc, totalHarvestValueCp, allocationWarning, showHumanoidWarning, settings };
}

router.get('/', async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search || undefined,
      tag: req.query.tag || undefined,
      size: req.query.size || undefined,
      creatureType: req.query.creatureType || undefined,
      harvestTier: req.query.harvestTier || undefined,
      campaignId: req.query.campaignId || undefined,
      locationId: req.query.locationId || undefined,
      sourceId: req.query.sourceId || undefined,
      levelMin: req.query.levelMin || undefined,
      levelMax: req.query.levelMax || undefined,
      hasHazardousComponents: req.query.hasHazardousComponents === '1',
      craftingUse: req.query.craftingUse || undefined,
      moralSensitivity: req.query.moralSensitivity === '1',
      hasSignatureTable: req.query.hasSignatureTable === '1',
      includeArchived: req.query.includeArchived === '1',
    };

    const [creatures, tags] = await Promise.all([creaturesRepo.list(filters), harvestTagsRepo.listAll()]);

    res.render('monsters/index', { title: 'Monsters', creatures, tags, filters });
  } catch (err) {
    next(err);
  }
});

router.get('/api/autofill', async (req, res, next) => {
  try {
    const level = Number(req.query.level);
    if (Number.isNaN(level)) return res.status(400).json({ error: 'level is required' });
    const dcTable = await lookups.dcByLevel();
    const baseDc = rules.baseDcForLevel(level, dcTable);
    const totalHarvestValueCp = rules.totalHarvestValueCp(level);
    res.json({ baseDc, totalHarvestValueCp });
  } catch (err) {
    next(err);
  }
});

router.get('/new', async (req, res, next) => {
  try {
    const formLookups = await loadFormLookups();
    res.render('monsters/form', {
      title: 'New Monster',
      mode: 'create',
      creature: { tags: [] },
      errors: null,
      SIZES,
      RARITIES,
      INTELLIGENCE_CATEGORIES,
      PROFICIENCIES,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = creatureSchema.safeParse(req.body);
    if (!parsed.success) {
      const formLookups = await loadFormLookups();
      return res.status(400).render('monsters/form', {
        title: 'New Monster',
        mode: 'create',
        creature: req.body,
        errors: parsed.error.flatten().fieldErrors,
        SIZES,
        RARITIES,
        INTELLIGENCE_CATEGORIES,
        PROFICIENCIES,
        ...formLookups,
      });
    }
    const { tag_ids, ...data } = parsed.data;
    data.total_harvest_value_formula = '(level^2) * 200 cp';
    const id = await creaturesRepo.create(data, tag_ids);
    res.redirect(`${req.app.locals.basePath}/monsters/${id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const facts = await deriveCreatureFacts(creature);
    res.render('monsters/show', { title: creature.name, creature, ...facts });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const formLookups = await loadFormLookups();
    res.render('monsters/form', {
      title: `Edit ${creature.name}`,
      mode: 'edit',
      creature,
      errors: null,
      SIZES,
      RARITIES,
      INTELLIGENCE_CATEGORIES,
      PROFICIENCIES,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const parsed = creatureSchema.safeParse(req.body);
    if (!parsed.success) {
      const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
      const formLookups = await loadFormLookups();
      return res.status(400).render('monsters/form', {
        title: `Edit ${creature.name}`,
        mode: 'edit',
        creature: { ...creature, ...req.body, id: creature.id },
        errors: parsed.error.flatten().fieldErrors,
        SIZES,
        RARITIES,
        INTELLIGENCE_CATEGORIES,
        PROFICIENCIES,
        ...formLookups,
      });
    }
    const { tag_ids, ...data } = parsed.data;
    await creaturesRepo.update(req.params.id, data, tag_ids);
    res.redirect(`${req.app.locals.basePath}/monsters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const newId = await creaturesRepo.duplicate(req.params.id);
    if (!newId) return res.status(404).render('errors/404', { title: 'Not found' });
    res.redirect(`${req.app.locals.basePath}/monsters/${newId}/edit`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    await creaturesRepo.archive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/monsters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unarchive', async (req, res, next) => {
  try {
    await creaturesRepo.unarchive(req.params.id);
    res.redirect(`${req.app.locals.basePath}/monsters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/components/new', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const formLookups = await loadFormLookups();
    res.render('monsters/component-form', {
      title: `Add component — ${creature.name}`,
      mode: 'create',
      creature,
      component: {},
      errors: null,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/components', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const parsed = componentSchema.safeParse(req.body);
    if (!parsed.success) {
      const formLookups = await loadFormLookups();
      return res.status(400).render('monsters/component-form', {
        title: `Add component — ${creature.name}`,
        mode: 'create',
        creature,
        component: req.body,
        errors: parsed.error.flatten().fieldErrors,
        ...formLookups,
      });
    }
    await componentsRepo.create({ creature_id: creature.id, ...parsed.data });
    res.redirect(`${req.app.locals.basePath}/monsters/${creature.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/components/:componentId/edit', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const component = await componentsRepo.getById(req.params.componentId);
    if (!component) return res.status(404).render('errors/404', { title: 'Not found' });
    const formLookups = await loadFormLookups();
    res.render('monsters/component-form', {
      title: `Edit component — ${creature.name}`,
      mode: 'edit',
      creature,
      component,
      errors: null,
      ...formLookups,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/components/:componentId', async (req, res, next) => {
  try {
    const creature = await creaturesRepo.getById(req.params.id, { includeArchived: true });
    if (!creature) return res.status(404).render('errors/404', { title: 'Not found' });
    const parsed = componentSchema.safeParse(req.body);
    if (!parsed.success) {
      const formLookups = await loadFormLookups();
      return res.status(400).render('monsters/component-form', {
        title: `Edit component — ${creature.name}`,
        mode: 'edit',
        creature,
        component: { ...req.body, id: req.params.componentId },
        errors: parsed.error.flatten().fieldErrors,
        ...formLookups,
      });
    }
    await componentsRepo.update(req.params.componentId, parsed.data);
    res.redirect(`${req.app.locals.basePath}/monsters/${creature.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/components/:componentId/delete', async (req, res, next) => {
  try {
    await componentsRepo.remove(req.params.componentId);
    res.redirect(`${req.app.locals.basePath}/monsters/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
