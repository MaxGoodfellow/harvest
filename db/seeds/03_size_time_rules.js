// CLAUDE.md §10 "Size -> time"
const SIZE_TIME_RULES = [
  { size: 'Tiny', per_component_minutes: 10, full_harvest_minutes_min: 20, full_harvest_minutes_max: 20 },
  { size: 'Small', per_component_minutes: 20, full_harvest_minutes_min: 60, full_harvest_minutes_max: 60 },
  { size: 'Medium', per_component_minutes: 30, full_harvest_minutes_min: 120, full_harvest_minutes_max: 120 },
  { size: 'Large', per_component_minutes: 60, full_harvest_minutes_min: 240, full_harvest_minutes_max: 240 },
  { size: 'Huge', per_component_minutes: 120, full_harvest_minutes_min: 480, full_harvest_minutes_max: 480 },
  { size: 'Gargantuan', per_component_minutes: 240, full_harvest_minutes_min: 1440, full_harvest_minutes_max: 2880 },
];

async function seed(conn) {
  for (const row of SIZE_TIME_RULES) {
    await conn.query(
      `INSERT INTO size_time_rules (size, per_component_minutes, full_harvest_minutes_min, full_harvest_minutes_max)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE per_component_minutes = ?, full_harvest_minutes_min = ?, full_harvest_minutes_max = ?`,
      [
        row.size, row.per_component_minutes, row.full_harvest_minutes_min, row.full_harvest_minutes_max,
        row.per_component_minutes, row.full_harvest_minutes_min, row.full_harvest_minutes_max,
      ]
    );
  }
}

module.exports = seed;
