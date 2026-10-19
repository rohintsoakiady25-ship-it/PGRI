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
    superieur_direct_id uuid,                                          -- N+1 (lien, pas un rôle)
    dn_ad               varchar(500),                                  -- DN dans l'annuaire (comptes AD)
    manager_dn          varchar(500),                                  -- DN du N+1 (attribut « manager »)
    CONSTRAINT pk_utilisateur PRIMARY KEY (id),
    CONSTRAINT fk_utilisateur_superieur FOREIGN KEY (superieur_direct_id) REFERENCES utilisateur (id) ON DELETE SET NULL,
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
    marque_modele       varchar(100),                                  -- facultatif
    nb_places           smallint,                                      -- facultatif
    etat_technique      varchar(20)              NOT NULL DEFAULT 'BON',
    assurance_debut     date,
    assurance_fin       date,
    visite_technique_debut date,
    visite_technique_fin   date,
    CONSTRAINT pk_vehicule PRIMARY KEY (id),
    CONSTRAINT uq_vehicule_immatriculation UNIQUE (immatriculation),
    CONSTRAINT ck_vehicule_etat CHECK (etat_technique IN ('BON', 'A_SURVEILLER', 'EN_REPARATION')),
    CONSTRAINT ck_vehicule_places CHECK (nb_places BETWEEN 1 AND 60),
    CONSTRAINT ck_vehicule_assurance CHECK (assurance_fin >= assurance_debut),
    CONSTRAINT ck_vehicule_visite CHECK (visite_technique_fin >= visite_technique_debut)
);

COMMENT ON TABLE  vehicule                IS 'Véhicules de MNP affectables aux déplacements de service';
COMMENT ON COLUMN vehicule.etat_technique IS 'BON, A_SURVEILLER ou EN_REPARATION';
COMMENT ON COLUMN vehicule.assurance_fin IS 'Échéance de l''assurance ; à renouveler avant cette date';
COMMENT ON COLUMN vehicule.visite_technique_fin IS 'Échéance de la visite technique';

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

-- ---------------------------------------------------------------------
-- Salles de réunion (Ressource > Salle, héritage « tables concrètes »)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salle (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    nom                 varchar(150)             NOT NULL,             -- ex. « Salle 1 »
    actif               boolean                  NOT NULL DEFAULT true,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    capacite            smallint                 NOT NULL,
    localisation        varchar(150),
    CONSTRAINT pk_salle PRIMARY KEY (id),
    CONSTRAINT uq_salle_nom UNIQUE (nom),
    CONSTRAINT ck_salle_capacite CHECK (capacite BETWEEN 1 AND 500)
);

COMMENT ON TABLE salle IS 'Salles de réunion réservables (Salle 1, Salle 2…)';

-- Matériel des salles : un enregistrement par appareil (référence unique),
-- rattaché à une ou plusieurs salles ; plusieurs appareils peuvent porter le même nom
CREATE TABLE IF NOT EXISTS equipement (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    reference           varchar(30)              NOT NULL,             -- ex. VP-01, en majuscules
    nom                 varchar(100)             NOT NULL,             -- type : « Vidéoprojecteur »…
    description         varchar(255),
    plusieurs_salles    boolean                  NOT NULL DEFAULT false, -- false : une seule salle
    actif               boolean                  NOT NULL DEFAULT true,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_equipement PRIMARY KEY (id),
    CONSTRAINT uq_equipement_reference UNIQUE (reference)
);

CREATE TABLE IF NOT EXISTS equipement_salle (
    equipement_id       uuid                     NOT NULL,
    salle_id            uuid                     NOT NULL,
    CONSTRAINT pk_equipement_salle PRIMARY KEY (equipement_id, salle_id),
    CONSTRAINT fk_equipement_salle_equipement FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_equipement_salle_salle FOREIGN KEY (salle_id) REFERENCES salle (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_equipement_salle_salle ON equipement_salle (salle_id);

COMMENT ON COLUMN equipement.plusieurs_salles IS 'false : installé dans une seule salle ; true : utilisable dans plusieurs salles';

-- ---------------------------------------------------------------------
-- Demandes (Demande > DemandeSalle, DemandeDeplacement, DemandeFourniture)
-- Héritage « table unique » : une seule table, la colonne « type » indique
-- le sous-type ; les colonnes propres à un sous-type sont facultatives.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demande (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    reference           varchar(20)              NOT NULL,             -- ex. SAL-2026-0001
    type                varchar(20)              NOT NULL,             -- DEPLACEMENT, SALLE ou FOURNITURE
    statut              varchar(30)              NOT NULL DEFAULT 'BROUILLON',
    demandeur_id        uuid                     NOT NULL,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    soumis_le           timestamp with time zone,
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    -- DemandeSalle (section 4.1.3)
    salle_id            uuid,
    creneau_debut       timestamp with time zone,
    creneau_fin         timestamp with time zone,
    objet               varchar(200),
    nb_participants     smallint,
    equipements_souhaites text,                                        -- liste séparée par des virgules
    participants        text,
    CONSTRAINT pk_demande PRIMARY KEY (id),
    CONSTRAINT uq_demande_reference UNIQUE (reference),
    CONSTRAINT fk_demande_demandeur FOREIGN KEY (demandeur_id) REFERENCES utilisateur (id),
    CONSTRAINT fk_demande_salle FOREIGN KEY (salle_id) REFERENCES salle (id)
);

CREATE INDEX IF NOT EXISTS ix_demande_type ON demande (type);

COMMENT ON TABLE  demande        IS 'Demandes des trois modules (héritage table unique)';
COMMENT ON COLUMN demande.statut IS 'Voir Figure 7 : EN_ATTENTE_LOGISTIQUE, CONFIRMEE, REFUSEE, ANNULEE, LIBEREE, TERMINEE…';

-- Décisions des validateurs (niveau N1 ou LOGISTIQUE)
CREATE TABLE IF NOT EXISTS validation (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    demande_id          uuid                     NOT NULL,
    niveau              varchar(20)              NOT NULL,             -- N1 ou LOGISTIQUE
    decision            varchar(20)              NOT NULL,             -- VALIDEE ou REFUSEE
    validateur_id       uuid                     NOT NULL,
    commentaire         text,
    decide_le           timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_validation PRIMARY KEY (id),
    CONSTRAINT fk_validation_demande FOREIGN KEY (demande_id) REFERENCES demande (id) ON DELETE CASCADE,
    CONSTRAINT fk_validation_validateur FOREIGN KEY (validateur_id) REFERENCES utilisateur (id)
);

-- Avis sans effet sur le statut (N+1, assistante de direction…)
CREATE TABLE IF NOT EXISTS commentaire (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    demande_id          uuid                     NOT NULL,
    auteur_id           uuid                     NOT NULL,
    texte               text                     NOT NULL,
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_commentaire PRIMARY KEY (id),
    CONSTRAINT fk_commentaire_demande FOREIGN KEY (demande_id) REFERENCES demande (id) ON DELETE CASCADE,
    CONSTRAINT fk_commentaire_auteur FOREIGN KEY (auteur_id) REFERENCES utilisateur (id)
);

-- Trace de chaque changement de statut (auteur vide : transition automatique)
CREATE TABLE IF NOT EXISTS historique_statut (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    demande_id          uuid                     NOT NULL,
    ancien_statut       varchar(30),
    nouveau_statut      varchar(30)              NOT NULL,
    auteur_id           uuid,
    commentaire         text,
    date                timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_historique_statut PRIMARY KEY (id),
    CONSTRAINT fk_historique_demande FOREIGN KEY (demande_id) REFERENCES demande (id) ON DELETE CASCADE,
    CONSTRAINT fk_historique_auteur FOREIGN KEY (auteur_id) REFERENCES utilisateur (id)
);

-- Le premier compte local administrateur se crée avec le backend (mot de passe chiffré) :
--   npm run seed:admin

-- ---------------------------------------------------------------------
-- Réglages clé / valeur (ex. jeton du lien public du planning des salles)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parametre (
    cle                 varchar(100)             NOT NULL,
    valeur              text                     NOT NULL,
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_parametre PRIMARY KEY (cle)
);

-- Appareils réservés par une demande de salle : un appareil ne sert qu'à une réservation à la fois
-- (contrôlé par l'API sur les demandes en attente ou confirmées qui se chevauchent)
CREATE TABLE IF NOT EXISTS demande_equipement (
    demande_id          uuid                     NOT NULL,
    equipement_id       uuid                     NOT NULL,
    CONSTRAINT pk_demande_equipement PRIMARY KEY (demande_id, equipement_id),
    CONSTRAINT fk_demande_equipement_demande FOREIGN KEY (demande_id) REFERENCES demande (id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_demande_equipement_equipement FOREIGN KEY (equipement_id) REFERENCES equipement (id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_demande_equipement_equipement ON demande_equipement (equipement_id);

-- ---------------------------------------------------------------------
-- Fournitures du magasin (Ressource > ArticleStock) et mouvements de stock
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS article_stock (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    nom                 varchar(150)             NOT NULL,             -- désignation, ex. « Rame de papier A4 »
    actif               boolean                  NOT NULL DEFAULT true, -- false : retiré du catalogue
    cree_le             timestamp with time zone NOT NULL DEFAULT now(),
    modifie_le          timestamp with time zone NOT NULL DEFAULT now(),
    reference           varchar(20)              NOT NULL,             -- ART-0001, attribuée par l'API
    unite               varchar(30)              NOT NULL,             -- pièce, paquet, boîte, rame…
    categorie           varchar(60),
    quantite_stock      integer                  NOT NULL DEFAULT 0,
    seuil_alerte        integer                  NOT NULL DEFAULT 0,
    fournisseur         varchar(150),
    CONSTRAINT pk_article_stock PRIMARY KEY (id),
    CONSTRAINT uq_article_stock_reference UNIQUE (reference),
    CONSTRAINT uq_article_stock_nom UNIQUE (nom),
    CONSTRAINT ck_article_stock_quantite CHECK (quantite_stock >= 0),
    CONSTRAINT ck_article_stock_seuil CHECK (seuil_alerte >= 0)
);

COMMENT ON COLUMN article_stock.seuil_alerte IS 'Stock bas quand quantite_stock <= seuil_alerte';

CREATE TABLE IF NOT EXISTS mouvement_stock (
    id                  uuid                     NOT NULL DEFAULT uuid_generate_v4(),
    article_id          uuid                     NOT NULL,
    type                varchar(12)              NOT NULL,             -- ENTREE, SORTIE ou AJUSTEMENT
    quantite            integer                  NOT NULL,             -- signée pour un ajustement (écart)
    auteur_id           uuid                     NOT NULL,
    observation         varchar(255),                                  -- fournisseur, bon de livraison, motif
    date                timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_mouvement_stock PRIMARY KEY (id),
    CONSTRAINT fk_mouvement_stock_article FOREIGN KEY (article_id) REFERENCES article_stock (id) ON DELETE CASCADE,
    CONSTRAINT fk_mouvement_stock_auteur FOREIGN KEY (auteur_id) REFERENCES utilisateur (id),
    CONSTRAINT ck_mouvement_stock_type CHECK (type IN ('ENTREE', 'SORTIE', 'AJUSTEMENT')),
    CONSTRAINT ck_mouvement_stock_quantite CHECK (quantite <> 0)
);

CREATE INDEX IF NOT EXISTS ix_mouvement_stock_article ON mouvement_stock (article_id);
