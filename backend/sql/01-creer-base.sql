-- =====================================================================
-- PGRI — 1/2 : compte et base de données PostgreSQL
-- À lancer UNE fois, avec le compte administrateur « postgres » :
--
--   psql -h localhost -U postgres -d postgres -v mdp_pgri='MOT_DE_PASSE' -f sql/01-creer-base.sql
--
-- Le mot de passe choisi pour « pgri » doit être reporté dans backend/.env (DB_PASSWORD).
-- =====================================================================

-- Compte utilisé par l'application (pas de droits d'administration)
CREATE ROLE pgri LOGIN PASSWORD :'mdp_pgri';

-- Base de l'application, appartenant au compte pgri
CREATE DATABASE pgri OWNER pgri ENCODING 'UTF8' TEMPLATE template0;
