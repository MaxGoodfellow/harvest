const express = require('express');
const mysql = require('mysql2/promise');
const creaturesRepo = require('../repositories/creatures');
const buyersRepo = require('../repositories/buyers');
const inventoryRepo = require('../repositories/materialsInventory');
const { importSchema } = require('../validation/importExport');
const { importAll, importCreaturesWithReport } = require('../repositories/importer');
const { FIELD_DOCS, HEADERS, parseMonstersCsv } = require('../repositories/csvImporter');
const { toCsv, parseCsv } = require('../lib/csv');
const { formatCp } = require('../lib/money');

const router = express.Router();

async function withConnection(fn) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

// Whole-file atomicity for the JSON importer (small, deliberate snapshots —
// see importAll's own comment for why this differs from the CSV path).
async function runImportInTransaction(data) {
  return withConnection(async (conn) => {
    try {
      await conn.beginTransaction();
      const result = await importAll(conn, data);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  });
}

router.get('/', (req, res) => {
  res.render('import-export/index', {
    title: 'Import / Export',
    result: null,
    csvReport: null,
    error: null,
    csvErrors: null,
    fieldDocs: FIELD_DOCS,
  });
});

// JSON export covers creatures (with components/tags/signature tables) and
// buyers — the GM-authored "content" tables. Reference/seed tables (skills,
// harvest_tags, dc_by_level, etc.) are intentionally excluded: they're owned
// by `db:seed` and re-created idempotently there, and operational tables
// (harvest_attempts, materials_inventory, crafting_projects, sessions) are
// excluded because they're heavily ID-coupled to a specific database's
// history rather than portable authored content. Use `db:backup`/`db:restore`
// (mysqldump) for full-fidelity, all-tables backups instead.
router.get('/json', async (req, res, next) => {
  try {
    const summaries = await creaturesRepo.list({ includeArchived: true });
    const creatures = await Promise.all(summaries.map((c) => creaturesRepo.getById(c.id, { includeArchived: true })));
    const buyers = await buyersRepo.list({ includeArchived: true });

    const exportData = {
      exportedAt: new Date().toISOString(),
      creatures: creatures.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.name),
      })),
      buyers,
    };

    res.setHeader('Content-Disposition', `attachment; filename="harvest-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err) {
    next(err);
  }
});

router.get('/monsters.csv', async (req, res, next) => {
  try {
    const creatures = await creaturesRepo.list({ includeArchived: true });
    const csv = toCsv(creatures, [
      { label: 'Name', value: (c) => c.name },
      { label: 'Level', value: (c) => c.level },
      { label: 'Size', value: (c) => c.size },
      { label: 'Rarity', value: (c) => c.rarity },
      { label: 'Creature Type', value: (c) => c.creature_type },
      { label: 'Harvest Tier', value: (c) => c.harvest_tier },
      { label: 'Tags', value: (c) => c.tags.join('; ') },
      { label: 'Signature', value: (c) => (c.is_signature ? 'yes' : 'no') },
      { label: 'Archived', value: (c) => (c.archived_at ? 'yes' : 'no') },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="monsters-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/inventory.csv', async (req, res, next) => {
  try {
    const items = await inventoryRepo.list({ includeArchived: true });
    const csv = toCsv(items, [
      { label: 'Name', value: (i) => i.name },
      { label: 'Creature', value: (i) => i.creature_name || '' },
      { label: 'Quality', value: (i) => i.quality },
      { label: 'Value (cp)', value: (i) => i.crafting_value_cp },
      { label: 'Value', value: (i) => formatCp(i.crafting_value_cp) },
      { label: 'Status', value: (i) => i.status },
      { label: 'Condition', value: (i) => i.condition || '' },
      { label: 'Preserved Until', value: (i) => (i.preserved_until ? new Date(i.preserved_until).toISOString().slice(0, 10) : '') },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post('/json', async (req, res) => {
  let parsedJson;
  try {
    parsedJson = JSON.parse(req.body.jsonData || '');
  } catch (err) {
    return res.status(400).render('import-export/index', {
      title: 'Import / Export',
      result: null,
      csvReport: null,
      error: `Invalid JSON: ${err.message}`,
      csvErrors: null,
      fieldDocs: FIELD_DOCS,
    });
  }

  const parsed = importSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return res.status(400).render('import-export/index', {
      title: 'Import / Export',
      result: null,
      csvReport: null,
      error: `Invalid import shape: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      csvErrors: null,
      fieldDocs: FIELD_DOCS,
    });
  }

  try {
    const result = await runImportInTransaction(parsed.data);
    res.render('import-export/index', {
      title: 'Import / Export',
      result,
      csvReport: null,
      error: null,
      csvErrors: null,
      fieldDocs: FIELD_DOCS,
    });
  } catch (err) {
    res.status(400).render('import-export/index', {
      title: 'Import / Export',
      result: null,
      csvReport: null,
      error: `Import failed, nothing was changed: ${err.message}`,
      csvErrors: null,
      fieldDocs: FIELD_DOCS,
    });
  }
});

router.get('/monsters-template.csv', (req, res) => {
  const example = [
    {
      'Monster Name': 'Wolf', Level: '1', Size: 'Medium', Rarity: 'common', 'Creature Type': 'Animal',
      'Intelligence Category': 'Animal-level', 'Harvest Tier': '1', 'Required Proficiency': 'Trained',
      Tags: 'Hide;Meat;Bone;Trophy', 'Is Signature': 'false', 'Is Morally Sensitive': 'false',
      'Use Manual Value': 'false', 'Manual Total Harvest Value (cp)': '', Description: 'A common predator found in forests and plains.', 'GM Notes': '',
      'Component Name': 'Wolf Hide', 'Component Harvest Tag': 'Hide', 'Component Skill': 'Survival', 'Component Alt Skills': 'Crafting',
      'Component Description': '', 'Component Base DC Modifier': '0', 'Component Use Manual DC': 'false', 'Component Manual DC': '',
      'Component Use Fixed Value': 'false', 'Component Fixed Value (cp)': '', 'Component Value Percentage': '30',
      'Component Sale Value Percentage Override': '', 'Component Is Hazardous': 'false', 'Component Hazard Type': '',
      'Component Hazard Save Type Override': '', 'Component Hazard DC Modifier': '0', 'Component Crafting Uses': 'Leather armor, cloaks, trim.',
      'Component Is Formula Required': 'false', 'Component Is Formula Unlocking': 'false', 'Component Sort Order': '1',
    },
    {
      'Monster Name': 'Wolf', Level: '1', Size: 'Medium', Rarity: 'common', 'Creature Type': 'Animal',
      'Intelligence Category': 'Animal-level', 'Harvest Tier': '1', 'Required Proficiency': 'Trained',
      Tags: 'Hide;Meat;Bone;Trophy', 'Is Signature': 'false', 'Is Morally Sensitive': 'false',
      'Use Manual Value': 'false', 'Manual Total Harvest Value (cp)': '', Description: 'A common predator found in forests and plains.', 'GM Notes': '',
      'Component Name': 'Wolf Meat', 'Component Harvest Tag': 'Meat', 'Component Skill': 'Survival', 'Component Alt Skills': '',
      'Component Description': '', 'Component Base DC Modifier': '-1', 'Component Use Manual DC': 'false', 'Component Manual DC': '',
      'Component Use Fixed Value': 'false', 'Component Fixed Value (cp)': '', 'Component Value Percentage': '20',
      'Component Sale Value Percentage Override': '', 'Component Is Hazardous': 'false', 'Component Hazard Type': '',
      'Component Hazard Save Type Override': '', 'Component Hazard DC Modifier': '0', 'Component Crafting Uses': 'Rations, trail food.',
      'Component Is Formula Required': 'false', 'Component Is Formula Unlocking': 'false', 'Component Sort Order': '2',
    },
    {
      'Monster Name': 'Wolf', Level: '1', Size: 'Medium', Rarity: 'common', 'Creature Type': 'Animal',
      'Intelligence Category': 'Animal-level', 'Harvest Tier': '1', 'Required Proficiency': 'Trained',
      Tags: 'Hide;Meat;Bone;Trophy', 'Is Signature': 'false', 'Is Morally Sensitive': 'false',
      'Use Manual Value': 'false', 'Manual Total Harvest Value (cp)': '', Description: 'A common predator found in forests and plains.', 'GM Notes': '',
      'Component Name': 'Wolf Bone', 'Component Harvest Tag': 'Bone', 'Component Skill': 'Survival', 'Component Alt Skills': 'Crafting',
      'Component Description': '', 'Component Base DC Modifier': '-1', 'Component Use Manual DC': 'false', 'Component Manual DC': '',
      'Component Use Fixed Value': 'false', 'Component Fixed Value (cp)': '', 'Component Value Percentage': '20',
      'Component Sale Value Percentage Override': '', 'Component Is Hazardous': 'false', 'Component Hazard Type': '',
      'Component Hazard Save Type Override': '', 'Component Hazard DC Modifier': '0', 'Component Crafting Uses': 'Simple tools, arrowheads.',
      'Component Is Formula Required': 'false', 'Component Is Formula Unlocking': 'false', 'Component Sort Order': '3',
    },
    {
      'Monster Name': 'Wolf', Level: '1', Size: 'Medium', Rarity: 'common', 'Creature Type': 'Animal',
      'Intelligence Category': 'Animal-level', 'Harvest Tier': '1', 'Required Proficiency': 'Trained',
      Tags: 'Hide;Meat;Bone;Trophy', 'Is Signature': 'false', 'Is Morally Sensitive': 'false',
      'Use Manual Value': 'false', 'Manual Total Harvest Value (cp)': '', Description: 'A common predator found in forests and plains.', 'GM Notes': '',
      'Component Name': 'Wolf Pelt Trophy', 'Component Harvest Tag': 'Trophy', 'Component Skill': 'Survival', 'Component Alt Skills': '',
      'Component Description': '', 'Component Base DC Modifier': '0', 'Component Use Manual DC': 'false', 'Component Manual DC': '',
      'Component Use Fixed Value': 'false', 'Component Fixed Value (cp)': '', 'Component Value Percentage': '30',
      'Component Sale Value Percentage Override': '', 'Component Is Hazardous': 'false', 'Component Hazard Type': '',
      'Component Hazard Save Type Override': '', 'Component Hazard DC Modifier': '0', 'Component Crafting Uses': 'Wall mount, trophy display.',
      'Component Is Formula Required': 'false', 'Component Is Formula Unlocking': 'false', 'Component Sort Order': '4',
    },
  ];

  const csv = toCsv(example, HEADERS.map((h) => ({ label: h, value: (r) => r[h] })));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="monsters-import-template.csv"');
  res.send(csv);
});

// Single-admin tool, but a slow bulk import (thousands of rows) left open
// long enough for a double-submit (or a retried request) to overlap with
// itself is exactly how the per-creature transactions below could still end
// up deadlocking each other. A simple in-process guard is enough here.
let csvImportInProgress = false;

router.post('/monsters.csv', async (req, res) => {
  const renderArgs = { title: 'Import / Export', fieldDocs: FIELD_DOCS };

  if (csvImportInProgress) {
    return res.status(409).render('import-export/index', {
      ...renderArgs,
      result: null,
      csvReport: null,
      error: 'Another CSV import is already running. Wait for it to finish before starting another.',
      csvErrors: null,
    });
  }

  let rows;
  try {
    rows = parseCsv(req.body.csvData || '');
  } catch (err) {
    return res.status(400).render('import-export/index', {
      ...renderArgs,
      result: null,
      csvReport: null,
      error: `Could not read the CSV file: ${err.message}`,
      csvErrors: null,
    });
  }

  const { creatures, errors } = parseMonstersCsv(rows);
  if (errors.length) {
    return res.status(400).render('import-export/index', {
      ...renderArgs,
      result: null,
      csvReport: null,
      error: null,
      csvErrors: errors,
    });
  }

  csvImportInProgress = true;
  try {
    const csvReport = await withConnection((conn) => importCreaturesWithReport(conn, creatures));
    res.render('import-export/index', {
      ...renderArgs,
      result: null,
      csvReport,
      error: null,
      csvErrors: null,
    });
  } catch (err) {
    res.status(500).render('import-export/index', {
      ...renderArgs,
      result: null,
      csvReport: null,
      error: `Import crashed: ${err.message}`,
      csvErrors: null,
    });
  } finally {
    csvImportInProgress = false;
  }
});

module.exports = router;
