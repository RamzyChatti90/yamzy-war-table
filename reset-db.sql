-- ════════════════════════════════════════════════════════════════════
-- WAR TABLE ⚔ — reset-db.sql
-- Vide TOUTES les tables pos_* pour repartir d'une base fraîche.
-- Garde les migrations Flyway (V58, V59, V60) — DDL préservé.
--
-- Usage :
--   docker exec -i yamzy-postgres psql -U yamzy -d yamzy_world < reset-db.sql
-- Ou (depuis psql) :
--   \i reset-db.sql
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- TRUNCATE en cascade (respecte les FK) — plus rapide que DELETE
TRUNCATE TABLE
  pos_stakeholder_feedback,
  pos_stakeholder,
  pos_dod_dor_check,
  pos_checklist_launch,
  pos_planning_version,
  pos_project_template,
  pos_daily_standup,
  pos_retrospective,
  pos_capacity_member,
  pos_overtime,
  pos_milestone,
  pos_quarter,
  pos_adr,
  pos_glossary,
  pos_lesson,
  pos_tech_debt,
  pos_risk,
  pos_ticket,
  pos_sprint,
  pos_phase,
  pos_project
RESTART IDENTITY CASCADE;

-- Vérif
SELECT
  'pos_project'  AS tbl, COUNT(*) AS n FROM pos_project UNION ALL
SELECT 'pos_ticket',         COUNT(*) FROM pos_ticket UNION ALL
SELECT 'pos_sprint',         COUNT(*) FROM pos_sprint UNION ALL
SELECT 'pos_planning_version', COUNT(*) FROM pos_planning_version;

COMMIT;
