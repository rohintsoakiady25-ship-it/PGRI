-- =====================================================================
-- PGRI — 2/2 : tables
-- À lancer dans la base pgri, avec le compte pgri :
--
--   psql -h localhost -U pgri -d pgri -f sql/02-creer-tables.sql
--
-- Équivalent de ce que crée le backend en développement (DB_SYNCHRONIZE=true),
-- à partir des entités TypeORM (src/modules/**/entities). Tenir ce fichier à jour
-- à chaque nouvelle entité.
-- =====================================================================

-- Génération des identifiants uuid (utilisée par TypeORM)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- Utilisateurs : comptes Active Directory et comptes locaux
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateur (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    login               varchar(100)             NOT NULL,             -- en minuscules (sAMAccountName pour l'AD)
    source              varchar(10)              NOT NULL,             -- 'AD' ou 'LOCAL'
    mot_de_passe_hash   varchar(100),                                  -- empreinte bcrypt, comptes LOCAL uniquement
    nom_complet         varchar(150)             NOT NULL,
    email               varchar(150),
    direction           varchar(100),
    service             varchar(100),
    roles               text                     NOT NULL DEFAULT 'DEMANDEUR', -- liste séparée par des virgules
    actif               boolean                  NOT NULL DEFAULT true,
    derniere_connexion  timestamp with time zone,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_utilisateur PRIMARY KEY (id),
    CONSTRAINT uq_utilisateur_login_source UNIQUE (login, source),
    CONSTRAINT ck_utilisateur_source CHECK (source IN ('AD', 'LOCAL')),
    CONSTRAINT ck_utilisateur_mot_de_passe CHECK (source = 'AD' OR mot_de_passe_hash IS NOT NULL)
);

COMMENT ON TABLE  utilisateur                   IS 'Comptes PGRI : Active Directory (créés à la connexion) et comptes locaux';
COMMENT ON COLUMN utilisateur.mot_de_passe_hash IS 'Empreinte bcrypt ; jamais de mot de passe en clair ; vide pour les comptes AD';
COMMENT ON COLUMN utilisateur.roles             IS 'DEMANDEUR, LOGISTIQUE, MAGASINIER, ASSISTANTE_DIRECTION, ADMIN (séparés par des virgules)';

-- ---------------------------------------------------------------------
-- Véhicules (Ressource > Vehicule, héritage « tables concrètes » :
-- les colonnes communes de Ressource — id, nom, actif, dates — sont répétées ici)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicule (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    nom                 varchar(150)             NOT NULL,             -- « marque modèle — immatriculation »
    actif               boolean                  NOT NULL DEFAULT true,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    immatriculation     varchar(20)              NOT NULL,             -- en majuscules, ex. « 1234 TBA »
    marque_modele       varchar(100)             NOT NULL,
    nb_places           smallint                 NOT NULL,
    kilometrage         integer                  NOT NULL DEFAULT 0,
    etat_technique      varchar(20)              NOT NULL DEFAULT 'BON',
    CONSTRAINT pk_vehicule PRIMARY KEY (id),
    CONSTRAINT uq_vehicule_immatriculation UNIQUE (immatriculation),
    CONSTRAINT ck_vehicule_etat CHECK (etat_technique IN ('BON', 'A_SURVEILLER', 'EN_REPARATION')),
    CONSTRAINT ck_vehicule_places CHECK (nb_places BETWEEN 1 AND 60),
    CONSTRAINT ck_vehicule_kilometrage CHECK (kilometrage >= 0)
);

COMMENT ON TABLE  vehicule                IS 'Véhicules de MNP affectables aux déplacements de service';
COMMENT ON COLUMN vehicule.etat_technique IS 'BON, A_SURVEILLER ou EN_REPARATION';

-- ---------------------------------------------------------------------
-- Chauffeurs (personnes affectées aux missions, distinctes de Ressource)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chauffeur (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    nom_complet         varchar(150)             NOT NULL,
    matricule           varchar(20)              NOT NULL,             -- matricule du personnel MNP
    telephone           varchar(30),
    numero_permis       varchar(30),                                   -- facultatif, en majuscules
    actif               boolean                  NOT NULL DEFAULT true,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_chauffeur PRIMARY KEY (id),
    CONSTRAINT uq_chauffeur_matricule UNIQUE (matricule),
    CONSTRAINT uq_chauffeur_permis UNIQUE (numero_permis)
);

COMMENT ON TABLE chauffeur IS 'Chauffeurs affectables aux missions par le responsable logistique';

-- Le premier compte local administrateur se crée avec le backend (mot de passe chiffré) :
--   npm run seed:admin
