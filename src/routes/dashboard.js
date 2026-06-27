const express = require('express');
const dashboardRepo = require('../repositories/dashboard');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await dashboardRepo.stats();
    res.render('dashboard/index', { title: 'Dashboard', ...data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
