-- 001_init.sql — full schema per CLAUDE.md §7
-- Engine/charset/collation per §6 throughout.

-- ===== Core / config =====

CREATE TABLE settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL,
  value TEXT,
  value_type VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaigns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sources (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sources_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  campaign_id BIGINT UNSIGNED NULL,
  region_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_locations_campaign_id (campaign_id),
  CONSTRAINT fk_locations_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dc_by_level (
  level TINYINT NOT NULL PRIMARY KEY,
  dc TINYINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE size_time_rules (
  size ENUM('Tiny','Small','Medium','Large','Huge','Gargantuan') NOT NULL PRIMARY KEY,
  per_component_minutes INT NOT NULL,
  full_harvest_minutes_min INT NOT NULL,
  full_harvest_minutes_max INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE skills (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lores_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE harvest_tags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  default_skills_json JSON NULL,
  default_risks TEXT,
  default_examples TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_harvest_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hazard_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  default_save_type VARCHAR(30) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hazard_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hazard_damage_by_level (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level_min TINYINT NOT NULL,
  level_max TINYINT NOT NULL,
  damage_dice VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_hazard_damage_band (level_min, level_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE body_condition_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  dc_modifier INT NULL,
  is_impossible BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_body_condition_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE death_time_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  dc_modifier INT NULL,
  restricted_to_tags_json JSON NULL,
  allows_no_degradation BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_death_time_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tool_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dc_modifier INT NOT NULL DEFAULT 0,
  cost_cp INT NULL,
  bulk DECIMAL(4,1) NULL,
  min_size ENUM('Tiny','Small','Medium','Large','Huge','Gargantuan') NULL,
  applies_to_tags_json JSON NULL,
  applies_to_creature_types_json JSON NULL,
  some_parts_impossible BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tool_modifiers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE environment_modifiers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  dc_modifier INT NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_environment_modifiers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Creatures & harvesting =====

CREATE TABLE creatures (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  level SMALLINT NOT NULL,
  size ENUM('Tiny','Small','Medium','Large','Huge','Gargantuan') NOT NULL,
  rarity ENUM('common','uncommon','rare','unique') NOT NULL DEFAULT 'common',
  creature_type VARCHAR(50) NOT NULL,
  intelligence_category ENUM('Non-sapient','Animal-level','Sapient','Humanoid','Unique NPC') NOT NULL DEFAULT 'Animal-level',
  harvest_tier TINYINT NOT NULL DEFAULT 0,
  required_proficiency ENUM('Untrained','Trained','Expert','Master','Legendary') NOT NULL DEFAULT 'Trained',
  campaign_id BIGINT UNSIGNED NULL,
  source_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  is_signature BOOLEAN NOT NULL DEFAULT FALSE,
  is_morally_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  use_manual_value BOOLEAN NOT NULL DEFAULT FALSE,
  manual_total_harvest_value_cp INT NULL,
  total_harvest_value_formula VARCHAR(100) NULL,
  description TEXT,
  gm_notes TEXT,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_creatures_name (name),
  KEY idx_creatures_level (level),
  KEY idx_creatures_harvest_tier (harvest_tier),
  KEY idx_creatures_creature_type (creature_type),
  CONSTRAINT fk_creatures_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL,
  CONSTRAINT fk_creatures_source FOREIGN KEY (source_id) REFERENCES sources (id) ON DELETE SET NULL,
  CONSTRAINT fk_creatures_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE creature_harvest_tags (
  creature_id BIGINT UNSIGNED NOT NULL,
  harvest_tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (creature_id, harvest_tag_id),
  CONSTRAINT fk_cht_creature FOREIGN KEY (creature_id) REFERENCES creatures (id) ON DELETE CASCADE,
  CONSTRAINT fk_cht_tag FOREIGN KEY (harvest_tag_id) REFERENCES harvest_tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE components (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  creature_id BIGINT UNSIGNED NOT NULL,
  harvest_tag_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  base_dc_modifier INT NOT NULL DEFAULT 0,
  use_manual_dc BOOLEAN NOT NULL DEFAULT FALSE,
  manual_dc INT NULL,
  use_fixed_value BOOLEAN NOT NULL DEFAULT FALSE,
  fixed_crafting_value_cp INT NULL,
  value_percentage DECIMAL(6,2) NULL,
  sale_value_percentage DECIMAL(6,2) NULL,
  is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
  hazard_type_id BIGINT UNSIGNED NULL,
  hazard_save_type VARCHAR(30) NULL,
  hazard_dc_modifier INT NOT NULL DEFAULT 0,
  crafting_uses TEXT,
  is_formula_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_formula_unlocking BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_components_creature_id (creature_id),
  KEY idx_components_harvest_tag_id (harvest_tag_id),
  CONSTRAINT fk_components_creature FOREIGN KEY (creature_id) REFERENCES creatures (id) ON DELETE CASCADE,
  CONSTRAINT fk_components_tag FOREIGN KEY (harvest_tag_id) REFERENCES harvest_tags (id),
  CONSTRAINT fk_components_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE SET NULL,
  CONSTRAINT fk_components_hazard_type FOREIGN KEY (hazard_type_id) REFERENCES hazard_types (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE component_alternate_skills (
  component_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (component_id, skill_id),
  CONSTRAINT fk_cas_component FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE CASCADE,
  CONSTRAINT fk_cas_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE component_lores (
  component_id BIGINT UNSIGNED NOT NULL,
  lore_id BIGINT UNSIGNED NOT NULL,
  dc_modifier INT NOT NULL DEFAULT -2,
  PRIMARY KEY (component_id, lore_id),
  CONSTRAINT fk_cl_component FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE CASCADE,
  CONSTRAINT fk_cl_lore FOREIGN KEY (lore_id) REFERENCES lores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Signature tables =====

CREATE TABLE signature_tables (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  creature_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_signature_tables_creature (creature_id),
  CONSTRAINT fk_signature_tables_creature FOREIGN KEY (creature_id) REFERENCES creatures (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signature_rows (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  signature_table_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  dc_modifier INT NOT NULL DEFAULT 0,
  time_minutes INT NULL,
  time_display VARCHAR(50) NULL,
  critical_success_text TEXT,
  success_text TEXT,
  failure_text TEXT,
  critical_failure_text TEXT,
  crafting_uses TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_signature_rows_table_id (signature_table_id),
  CONSTRAINT fk_signature_rows_table FOREIGN KEY (signature_table_id) REFERENCES signature_tables (id) ON DELETE CASCADE,
  CONSTRAINT fk_signature_rows_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signature_row_alternate_skills (
  signature_row_id BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (signature_row_id, skill_id),
  CONSTRAINT fk_sras_row FOREIGN KEY (signature_row_id) REFERENCES signature_rows (id) ON DELETE CASCADE,
  CONSTRAINT fk_sras_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Markets =====

CREATE TABLE buyers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  buyer_type VARCHAR(50) NOT NULL DEFAULT 'Standard',
  default_sale_percentage DECIMAL(6,2) NOT NULL DEFAULT 50.00,
  location_id BIGINT UNSIGNED NULL,
  campaign_id BIGINT UNSIGNED NULL,
  notes TEXT,
  moral_legal_warning TEXT,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_buyers_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL,
  CONSTRAINT fk_buyers_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE buyer_accepted_tags (
  buyer_id BIGINT UNSIGNED NOT NULL,
  harvest_tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (buyer_id, harvest_tag_id),
  CONSTRAINT fk_bat_buyer FOREIGN KEY (buyer_id) REFERENCES buyers (id) ON DELETE CASCADE,
  CONSTRAINT fk_bat_tag FOREIGN KEY (harvest_tag_id) REFERENCES harvest_tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE buyer_rejected_tags (
  buyer_id BIGINT UNSIGNED NOT NULL,
  harvest_tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (buyer_id, harvest_tag_id),
  CONSTRAINT fk_brt_buyer FOREIGN KEY (buyer_id) REFERENCES buyers (id) ON DELETE CASCADE,
  CONSTRAINT fk_brt_tag FOREIGN KEY (harvest_tag_id) REFERENCES harvest_tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Play & inventory =====

CREATE TABLE harvest_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  session_date DATE NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_harvest_sessions_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE harvest_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  harvest_session_id BIGINT UNSIGNED NULL,
  creature_id BIGINT UNSIGNED NOT NULL,
  component_id BIGINT UNSIGNED NULL,
  signature_row_id BIGINT UNSIGNED NULL,
  skill_id BIGINT UNSIGNED NULL,
  body_condition_modifier_id BIGINT UNSIGNED NULL,
  death_time_modifier_id BIGINT UNSIGNED NULL,
  tool_modifier_id BIGINT UNSIGNED NULL,
  environment_modifier_id BIGINT UNSIGNED NULL,
  lore_id BIGINT UNSIGNED NULL,
  final_dc INT NOT NULL,
  dc_modifiers_json JSON NULL,
  roll_total INT NULL,
  natural_die TINYINT NULL,
  degree_of_success ENUM('critical_success','success','failure','critical_failure') NULL,
  quality ENUM('Poor','Standard','Pristine','Ruined') NULL,
  gm_override_quality BOOLEAN NOT NULL DEFAULT FALSE,
  crafting_value_cp INT NULL,
  hazard_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  hazard_damage_dice VARCHAR(20) NULL,
  hazard_save_result VARCHAR(30) NULL,
  notes TEXT,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_harvest_attempts_creature_id (creature_id),
  KEY idx_harvest_attempts_session_id (harvest_session_id),
  CONSTRAINT fk_attempts_session FOREIGN KEY (harvest_session_id) REFERENCES harvest_sessions (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_creature FOREIGN KEY (creature_id) REFERENCES creatures (id) ON DELETE CASCADE,
  CONSTRAINT fk_attempts_component FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_signature_row FOREIGN KEY (signature_row_id) REFERENCES signature_rows (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_skill FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_body_condition FOREIGN KEY (body_condition_modifier_id) REFERENCES body_condition_modifiers (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_death_time FOREIGN KEY (death_time_modifier_id) REFERENCES death_time_modifiers (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_tool FOREIGN KEY (tool_modifier_id) REFERENCES tool_modifiers (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_environment FOREIGN KEY (environment_modifier_id) REFERENCES environment_modifiers (id) ON DELETE SET NULL,
  CONSTRAINT fk_attempts_lore FOREIGN KEY (lore_id) REFERENCES lores (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE materials_inventory (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  harvest_attempt_id BIGINT UNSIGNED NULL,
  component_id BIGINT UNSIGNED NULL,
  creature_id BIGINT UNSIGNED NULL,
  campaign_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  quality ENUM('Poor','Standard','Pristine','Ruined') NOT NULL DEFAULT 'Standard',
  crafting_value_cp INT NOT NULL DEFAULT 0,
  status ENUM('available','sold','used','spoiled','destroyed','gifted','quest_item') NOT NULL DEFAULT 'available',
  `condition` VARCHAR(50) NULL,
  preserved_until DATE NULL,
  notes TEXT,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_materials_inventory_status (status),
  CONSTRAINT fk_inventory_attempt FOREIGN KEY (harvest_attempt_id) REFERENCES harvest_attempts (id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_component FOREIGN KEY (component_id) REFERENCES components (id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_creature FOREIGN KEY (creature_id) REFERENCES creatures (id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crafting_projects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  item_gp_cost_cp INT NOT NULL DEFAULT 0,
  is_formula_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_formula_unlocking BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_crafting_projects_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE crafting_project_materials (
  crafting_project_id BIGINT UNSIGNED NOT NULL,
  materials_inventory_id BIGINT UNSIGNED NOT NULL,
  value_applied_cp INT NOT NULL DEFAULT 0,
  PRIMARY KEY (crafting_project_id, materials_inventory_id),
  CONSTRAINT fk_cpm_project FOREIGN KEY (crafting_project_id) REFERENCES crafting_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_cpm_material FOREIGN KEY (materials_inventory_id) REFERENCES materials_inventory (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== Audit =====

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action ENUM('create','update','delete') NOT NULL,
  old_value_json JSON NULL,
  new_value_json JSON NULL,
  changed_by VARCHAR(100) NOT NULL DEFAULT 'gm',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_log_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
