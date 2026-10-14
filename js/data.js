/* ============================================================
   data.js — classes d'unités, équilibrage et campagnes
   ============================================================ */

/* ---------- Réglages généraux de combat ---------- */
const BAL = {
  casualtyK: 0.0060,         // fraction d'effectif perdue par seconde à pression = 1
  moraleCasK: 60,             // moral perdu par point de fraction d'effectif perdue
  pressureDrain: 6.0,        // moral/s quand on est nettement surchargé
  pressureExp: 0.75,         // aplatit l'écart : un petit avantage ne décide pas seul
  defAdvantage: 1.0,         // à 1.0 : l'égalité des armes décide, le terrain départage
  officerDeathMorale: -15,   // moral des voisins quand un commandant tombe
  auraDuration: 18,          // durée de la Présence impériale (s)
  auraCooldown: 45,          // recharge (s)
};

/* ---------- Couleurs ---------- */
const COL = {
  fr:      '#3a5fd0',
  frDark:  '#1e2f80',
  frLight: '#8fb0ff',
  en:      '#cf3a2c',
  enDark:  '#7d1b12',
  enLight: '#ff9a86',
  imp:     '#e8c060',
  neutral: '#8d8577',
};

/* ---------- Classes d'unités ---------- */
const CLASSES = {
  INF: {
    key: 'INF', name: 'Infanterie', glyph: 'circle', men: 130,
    atk: 15, def: 17, range: 32, dps: 1.0, speed: 33, aggro: 250,
    morale: 100, regen: 7.5, fatigue: 1.0, radius: 11,
    traits: ['Stable', 'Polyvalente'],
    desc: "Le cœur de la Grande Armée. Tient le terrain, tient les rangs. Faible seule, redoutable en masse.",
  },
  CAV: {
    key: 'CAV', name: 'Cavalerie', glyph: 'triangle', men: 105,
    atk: 27, def: 12, range: 34, chargeRange: 165, chargeSpeed: 168, dps: 1.0,
    speed: 62, aggro: 380, morale: 95, regen: 6, fatigue: 1.9, radius: 12,
    flank: 1.35, chargeAtk: 1.6,
    traits: ['Charge dévastatrice', 'Fatigue rapide'],
    desc: "Frappe les flancs et les unités disembriquées. Sa charge vaut plus que tout, puis elle est finie.",
  },
  ART: {
    key: 'ART', name: 'Artillerie', glyph: 'square', men: 85,
    atk: 30, def: 6, range: 335, minRange: 95, dps: 0.20, shellSpeed: 430, splash: 40,
    speed: 21, aggro: 420, morale: 85, regen: 4.5, fatigue: 0.25, radius: 12,
    traits: ['Tir à longue portée', 'Fragile au choc'],
    desc: "Dévaste les troupes en masse à distance. Totalement inutilisable une fois le corps à corps engagé.",
  },
  SAP: {
    key: 'SAP', name: 'Sapeur — unité de choc', glyph: 'cross', men: 100,
    atk: 21, def: 21, range: 34, dps: 1.0, speed: 41, aggro: 270,
    morale: 105, regen: 10, fatigue: 1.25, radius: 11,
    shock: 1.38, fort: 2.4, ford: 1.0, bridgeSpeed: 2.2,
    traits: ['Frappe les retranchements', 'Franchit les obstacles'],
    desc: "Le fer de lance du choc. Dégâts doublés contre les fortifications, traversée rapide des forêts et des rivières.",
  },
  CMD: {
    key: 'CMD', name: 'Commandant', glyph: 'star5', men: 45,
    atk: 13, def: 14, range: 32, dps: 1.0, speed: 45, aggro: 250,
    morale: 120, regen: 12, fatigue: 0.6, radius: 13,
    auraR: 165, auraAtk: 0.20, auraMoraleRegen: 0.35, auraCoord: true,
    traits: ['Officier', 'Inspire +20 % d\'attaque'],
    desc: "Officier supérieur. Grande étoile dorée : son relève l'attaque et la coordination de toutes les unités proches. Sa chute coûte cher.",
  },
  NCO: {
    key: 'NCO', name: 'Chef de troupe', glyph: 'star4', men: 60,
    atk: 12, def: 18, range: 32, dps: 1.0, speed: 43, aggro: 250,
    morale: 115, regen: 11, fatigue: 0.7, radius: 11,
    auraR: 135, auraDef: 0.32, auraMoraleRegen: 0.55, antiRout: true,
    traits: ['Sous-officier', 'Retarde la rupture'],
    desc: "Sous-officier : la colonne vertébrale de la compagnie. Petite étoile argentée. +32 % de défense autour de lui et, surtout, il empêche la rupture de se propager.",
  },
  EMP: {
    key: 'EMP', name: 'Napoléon Bonaparte', glyph: 'star8', men: 70,
    atk: 15, def: 30, range: 32, dps: 1.0, speed: 47, aggro: 300,
    morale: 200, regen: 16, fatigue: 0.4, radius: 15,
    auraR: 320, auraAtk: 0.22, auraMoraleBonus: 15, auraMoraleRegen: 0.9, immuneRout: true,
    imperial: true,
    traits: ['Empereur', 'Motivation +15 partout'],
    desc: "L'Empereur en personne. Tant qu'il est au milieu de ses troupes, l'armée française se bat mieux et ne rompt pas. Tout l'état de l'armée en dépend.",
  },
};

/* ---------- Qualité des troupes ---------- */
const QUALITY = {
  veteran:   { key: 'veteran',   label: 'Vétérans',    atk: 1.16, def: 1.14, morale: 1.18, regen: 1.30, fatigue: 0.85, tag: 'Vétérans' },
  line:      { key: 'line',      label: 'Troupes de ligne', atk: 1.00, def: 1.00, morale: 1.00, regen: 1.00, fatigue: 1.00, tag: '' },
  conscript: { key: 'conscript', label: 'Conscrits',  atk: 0.84, def: 0.82, morale: 0.80, regen: 0.70, fatigue: 1.25, tag: 'Conscrits' },
  guard:     { key: 'guard',     label: 'Garde',       atk: 1.28, def: 1.25, morale: 1.35, regen: 1.50, fatigue: 0.70, tag: 'Garde' },
  cossack:   { key: 'cossack',   label: 'Cosaques',    atk: 1.08, def: 0.95, morale: 1.15, regen: 1.10, fatigue: 1.10, tag: 'Cosaques' },
};

/* ---------- Terrain ---------- */
const TERRAIN = {
  plain:   { name: 'Plaine',   speed: 1.00, cover: 1.00, color: '#a8bf68' },
  road:    { name: 'Route',    speed: 1.62, cover: 0.94, color: null },
  forest:  { name: 'Forêt',    speed: 0.56, cover: 1.38, color: '#4d7a34' },
  hill:    { name: 'Butte',    speed: 0.80, cover: 1.22, color: '#b9cb7c' },
  village: { name: 'Village',  speed: 0.92, cover: 1.32, color: '#cbb584' },
  marsh:   { name: 'Marais',   speed: 0.58, cover: 1.10, color: '#8aa861' },
  rock:    { name: 'Roc',      speed: 0.55, cover: 1.45, color: '#9d9d90' },
  water:   { name: 'Eau',      speed: 0.00, cover: 1.00, color: '#3d6ea8' },
  river:   { name: 'Rivière',  speed: 0.30, cover: 0.70, color: '#4a86c8' },
  wall:    { name: 'Mur',      speed: 0.90, cover: 1.35, color: '#7a6a4a' },
};

/** kinds que l'on peut peindre dans l'éditeur */
const PAINT_KINDS = [
  { key: 'plain',   label: 'Plaine' },
  { key: 'forest',  label: 'Forêt' },
  { key: 'hill',    label: 'Butte' },
  { key: 'village', label: 'Village' },
  { key: 'marsh',   label: 'Marais' },
  { key: 'rock',    label: 'Roc' },
];

/* ---------- Palette d'unités du bac à sable ---------- */
const SANDBOX_UNITS = [
  { key: 'INF', label: 'Infanterie' },
  { key: 'CAV', label: 'Cavalerie' },
  { key: 'ART', label: 'Artillerie' },
  { key: 'SAP', label: 'Sapeur / choc' },
  { key: 'CMD', label: 'Commandant' },
  { key: 'NCO', label: 'Chef de troupe' },
  { key: 'EMP', label: 'Napoléon' },
];

/* ============================================================
   CAMPAGNES
   ============================================================ */

// raccourcis de création de terrain
const rect = (x, y, w, h, kind, o) => Object.assign({ shape: 'r', x, y, w, h, kind }, o || {});
const ell  = (x, y, rx, ry, kind, o) => Object.assign({ shape: 'e', x, y, rx, ry, kind }, o || {});

const CAMPAIGNS = [
/* ============================================================ 1 */
{
  id: 'marengo', num: 1, name: 'Marengo', date: '14 juin 1800', place: 'Italie',
  difficulty: 1, seed: 1800,
  brief: [
    "Cinq jours de marche, de manœuvres et d'orage : Bonaparte a franchi les Alpes avec l'armée d'Italie et surpris les Austro-Sardes près de Marengo.",
    "L'infanterie française tient les lignes de ruisseau, la cavalerie de Kellermann attend sur les hauteurs, l'artillerie domine la plaine. Tout se jouera sur quelques centaines de mètres de terrain plat.",
    "L'adversaire est plus nombreux mais inexperienced. Le champ de bataille est court — vous n'aurez pas le temps d'hésiter.",
  ],
  quote: "Je veux que la paix soit campanienne.",
  objectives: [
    "Détruire ou faire rompre toutes les unités adverses.",
    "Garder Napoléon hors de danger : sa capture est une défaite.",
    "Facultatif : s'emparer du village de Marengo.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Commandant en chef', note: "Il décide de tout." },
    { side: 'fr', name: 'Jean-Baptiste Bessières', role: 'Cavalerie', note: 'Mène la charge décisive.' },
    { side: 'en', name: 'Michael von Melas', role: 'Général autrichien', note: 'Défend le plateau de Marengo.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [520, 0], [470, 120], [360, 210], [300, 330], [360, 430], [250, 540], [120, 600], [0, 560]],
    ],
    rivers: [{ pts: [[1400, 620], [1150, 600], [980, 660], [820, 700], [640, 690], [430, 740], [180, 800]], w: 13 }],
    bridges: [{ x: 1000, y: 638 }],
    roads: [
      { pts: [[60, 520], [320, 500], [560, 470], [820, 440], [1080, 400], [1400, 360]], w: 8 },
      { pts: [[820, 440], [900, 620], [960, 860]], w: 7 },
    ],
    terrain: [
      rect(620, 250, 220, 170, 'hill'), rect(880, 210, 260, 160, 'hill'),
      rect(500, 600, 300, 180, 'marsh'),
      rect(240, 300, 220, 180, 'forest'), rect(1050, 640, 280, 200, 'forest'),
      rect(1020, 300, 180, 130, 'village'),
    ],
    towns: [{ x: 1055, y: 362, name: 'Marengo', size: 13 }],
    forts: [{ x: 905, y: 270, name: 'Redoute', r: 30, hp: 400, side: 'en' }],
    objectives: [{ x: 1055, y: 362, r: 85, name: 'Village de Marengo', optional: true }],
  },
  deploy: { fr: { x: 90, y: 380, w: 300, h: 420 }, en: { x: 1060, y: 380, w: 300, h: 420 } },
  player: [
    { cls: 'INF', name: '1er régiment de ligne', n: 1, quality: 'line' },
    { cls: 'INF', name: '2e régiment de ligne', n: 1, quality: 'line' },
    { cls: 'INF', name: 'Grenadiers', n: 1, quality: 'veteran' },
    { cls: 'CAV', name: 'Cavalerie de réserve', n: 1, quality: 'line' },
    { cls: 'ART', name: 'Batterie de marine', n: 1, quality: 'line' },
    { cls: 'SAP', name: 'Sapeurs du génie', n: 1, quality: 'line' },
    { cls: 'NCO', name: 'Chef de bataillon', n: 1 },
    { cls: 'CMD', name: 'Chef de brigade', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie autrichienne', n: 4, quality: 'line' },
    { cls: 'CAV', name: 'Cavalerie légère', n: 1, quality: 'line' },
    { cls: 'ART', name: 'Batterie adverse', n: 1, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officier adverse', n: 1 },
  ],
  reinforcement: { at: 95, side: 'fr', text: 'Les divisions de Grenier arrivent !',
    units: [{ cls: 'INF', name: '3e régiment (renfort)', n: 1, quality: 'line' }] },
},

/* ============================================================ 2 */
{
  id: 'austerlitz', num: 2, name: 'Austerlitz', date: '2 décembre 1805', place: 'Moravie',
  difficulty: 2, seed: 1805,
  brief: [
    "La bataille des trois empereurs. Russes et Autrichiens se retirent sur les hauteurs de Pratzen, au sud du champ de bataille — un plateau que Bonaparte a choisi précisément pour y fendre l'armée alliée en deux.",
    "Une coalition.swap deux fois plus nombreuse, mais déployée sur dix kilomètres de front, le long d'une route boueuse. Broussier passe au nord par le col de Hollabrunn, avec les divisions Souham et Vandamme. Le soleil se lève enfin.",
    "Davout, isolé, tient déjà le plateau de Zuran. Le reste de l'armée est plus au sud. Couper la retraite, puis charger le centre ennemi : voilà tout le plan, et il ne laisse rien au hasard.",
  ],
  quote: "J'ai assez attendu deux ans dans cette campagne pour que le moment arrive enfin.",
  objectives: [
    "Détruire ou faire rompre toutes les unités alliées.",
    "Protéger Napoléon — sa capture est une défaite immédiate.",
    "Facultatif : s'emparer des hauteurs de Pratzen.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: "Au centre, il attend l'heure." },
    { side: 'fr', name: 'Michel Ney', role: 'Maréchal', note: 'Charge à la tête de la division.' },
    { side: 'fr', name: 'Louis-Nicolas Davout', role: 'Maréchal', note: 'Tient seul le plateau de Zuran.' },
    { side: 'en', name: 'Koutouzov', role: 'Général russe', note: 'Le « Prince de la Sagesse ».' },
    { side: 'en', name: 'Alexandre', role: 'Emereur russe', note: 'Présent sur le champ de bataille.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 760], [260, 800], [560, 780], [880, 820], [1200, 790], [1440, 760], [1440, 900], [0, 900]],
      [[1290, 0], [1440, 0], [1440, 210], [1360, 180], [1320, 90]],
    ],
    rivers: [{ pts: [[1280, 190], [1090, 250], [960, 300], [860, 380], [760, 430], [620, 450], [440, 430], [240, 470]], w: 12 }],
    bridges: [{ x: 855, y: 382 }, { x: 605, y: 449 }],
    roads: [
      { pts: [[120, 300], [400, 330], [700, 360], [1000, 400], [1300, 430]], w: 8 },
      { pts: [[700, 360], [720, 560], [760, 760]], w: 7 },
      { pts: [[240, 470], [420, 560], [620, 640]], w: 6 },
    ],
    terrain: [
      rect(560, 120, 380, 150, 'hill'),
      rect(300, 300, 200, 150, 'forest'), rect(940, 560, 260, 180, 'forest'),
      rect(1080, 620, 200, 140, 'marsh'),
      rect(420, 640, 180, 130, 'village'), rect(1120, 300, 180, 120, 'village'),
    ],
    towns: [{ x: 485, y: 700, name: 'Sokolnitz', size: 12 }, { x: 1200, y: 355, name: 'Telnitz', size: 11 }],
    forts: [
      { x: 700, y: 175, name: 'Pratzen', r: 42, hp: 700, side: 'en' },
      { x: 640, y: 235, name: 'Bataillons avancés', r: 26, hp: 400, side: 'en' },
    ],
    objectives: [{ x: 700, y: 200, r: 90, name: 'Hautes de Pratzen', optional: true }],
  },
  deploy: { fr: { x: 80, y: 240, w: 260, h: 480 }, en: { x: 1100, y: 240, w: 260, h: 480 } },
  player: [
    { cls: 'INF', name: 'Régiment de ligne (centre)', n: 2, quality: 'veteran' },
    { cls: 'INF', name: 'Grenadiers à pied', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie de charge', n: 2, quality: 'veteran' },
    { cls: 'ART', name: 'Batterie de gros calibre', n: 2, quality: 'line' },
    { cls: 'SAP', name: 'Sapeurs du choc', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie alliée', n: 4, quality: 'line' },
    { cls: 'INF', name: 'Grenadiers russes', n: 2, quality: 'veteran' },
    { cls: 'CAV', name: 'Cavalerie cosaque', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries alliées', n: 2, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers alliés', n: 2 },
    { cls: 'CMD', name: 'Général allié', n: 1 },
  ],
  reinforcement: { at: 120, side: 'fr', text: 'La division de Davout rejoint le combat !',
    units: [{ cls: 'INF', name: 'Division Davout (renfort)', n: 2, quality: 'veteran' }, { cls: 'ART', name: 'Batterie de réserve', n: 1, quality: 'line' }] },
},

/* ============================================================ 3 */
{
  id: 'jena', num: 3, name: 'Iéna-Auerstaedt', date: '14 octobre 1806', place: 'Prusse',
  difficulty: 3, seed: 1806,
  brief: [
    "La coalition prussienne marche sur la France avec six corps d'armée. Bonaparte est supérieur en qualité, mais inférieur en nombre.",
    "Au col de la Crucifix, la brigade Haxo tient seule le devant de Hohenlinden. En contrebas, Ney et Davout se jettent sur le Longerich. Le ravin de la Saulx est le point faible : c'est par là qu'il faut passer.",
    "Le mauvais temps, les chemins défoncés et l'obstination de Blucher ont coûté des heures à l'armée française. Chaque heure gagnée est une bataille évitée. Maintenir l'axe, enflammer le flanc, ne jamais rompre le contact.",
  ],
  quote: "Encore une fois, ils m'ont fait don de la victoire.",
  objectives: [
    "Détruire ou faire rompre toutes les unités prussiennes.",
    "Protéger Napoléon.",
    "Facultatif : tenir le plateau du col de la Crucifix.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: 'Général en chef.' },
    { side: 'fr', name: 'Michel Ney', role: 'Maréchal', note: 'Attaque frontale de Longueville.' },
    { side: 'fr', name: 'Louis-Nicolas Davout', role: 'Maréchal', note: "L'école de l'infanterie de ligne." },
    { side: 'en', name: 'Louis Ferdinand de Prusse', role: 'Prince', note: 'Commande la coalition.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [300, 0], [260, 140], [180, 250], [60, 300], [0, 290]],
      [[1100, 900], [1440, 900], [1440, 640], [1320, 700], [1200, 820]],
    ],
    rivers: [{ pts: [[300, 20], [380, 190], [520, 300], [700, 340], [880, 320], [1050, 260], [1260, 230], [1420, 250]], w: 13 }],
    bridges: [{ x: 700, y: 340 }, { x: 1055, y: 258 }],
    roads: [
      { pts: [[80, 620], [340, 580], [640, 560], [940, 560], [1240, 580], [1420, 600]], w: 8 },
      { pts: [[640, 560], [620, 320], [560, 120]], w: 7 },
      { pts: [[340, 580], [300, 300], [280, 90]], w: 6 },
    ],
    terrain: [
      rect(520, 90, 260, 140, 'hill'), rect(300, 420, 220, 150, 'forest'),
      rect(900, 400, 260, 180, 'forest'), rect(1120, 200, 200, 140, 'forest'),
      rect(820, 660, 240, 150, 'marsh'), rect(1140, 620, 180, 120, 'village'),
    ],
    towns: [{ x: 1225, y: 675, name: 'Iéna', size: 14 }],
    forts: [{ x: 650, y: 150, name: 'Col de la Crucifix', r: 34, hp: 600, side: 'en' }],
    objectives: [{ x: 650, y: 160, r: 100, name: 'Plateau du col', optional: true }],
  },
  deploy: { fr: { x: 90, y: 420, w: 260, h: 380 }, en: { x: 1080, y: 260, w: 280, h: 500 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 3, quality: 'veteran' },
    { cls: 'INF', name: 'Grenadiers', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie légère', n: 2, quality: 'veteran' },
    { cls: 'ART', name: 'Batteries', n: 2, quality: 'line' },
    { cls: 'SAP', name: 'Sapeurs', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Prussiens (ligne)', n: 5, quality: 'line' },
    { cls: 'INF', name: 'Prussiens (Garde)', n: 1, quality: 'veteran' },
    { cls: 'CAV', name: 'Cavalerie prussienne', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries prussiennes', n: 2, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers prussiens', n: 1 },
    { cls: 'CMD', name: 'Général prussien', n: 1 },
  ],
  reinforcement: { at: 140, side: 'fr', text: 'Le corps de Lefebvre arrive au contact !',
    units: [{ cls: 'INF', name: 'Corps Lefebvre (renfort)', n: 2, quality: 'veteran' }, { cls: 'CAV', name: 'Cavalerie de réserve', n: 1, quality: 'veteran' }] },
},

/* ============================================================ 4 */
{
  id: 'eylau', num: 4, name: 'Eylau', date: '7-8 février 1807', place: 'Prusse orientale',
  difficulty: 4, seed: 1807,
  brief: [
    "Le blizzard de Prusse est le vrai général de ce jour. La Grande Armée est à bout : les hommes n'ont pas mangé, les chevaux titubent, la cavalerie a fondu.",
    "Les Russes tiennent la ville d'Eylau, le cimetière et la ferme de Klein-Heiligwalde. Entre vos lignes et eux, il n'y a qu'un champ de neige et une artillerie russe intacte.",
    "Augereau attaque, mais le vent emporte la moitié de ses hommes avant même le contact. Il vous faudra tenir, canonner, puis charger au bon moment : c'est une bataille d'usure, pas de rupture.",
  ],
  quote: "Un beau champ de bataille. Mais il va falloir du temps, des canons et des morts.",
  objectives: [
    "Détruire ou faire rompre l'armée russe.",
    "Protéger Napoléon.",
    "Facultatif : s'emparer du cimetière d'Eylau.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: "Blessé, il reste sur le terrain." },
    { side: 'fr', name: 'Pierre Augereau', role: 'Maréchal', note: 'Charge à travers la tempête.' },
    { side: 'en', name: 'Bagration', role: 'Général russe', note: 'Maintient le cimetière.' },
    { side: 'en', name: 'Bennigsen', role: 'Feld-maréchal', note: "Commande l'armée russe." },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [200, 0], [170, 120], [80, 210], [0, 230]],
      [[0, 700], [200, 720], [330, 830], [300, 900], [0, 900]],
    ],
    rivers: [{ pts: [[1440, 700], [1180, 660], [980, 620], [780, 600], [560, 640], [340, 700], [120, 760]], w: 12 }],
    bridges: [{ x: 780, y: 600 }, { x: 345, y: 698 }],
    roads: [
      { pts: [[60, 420], [320, 430], [620, 440], [920, 450], [1220, 470], [1440, 490]], w: 8 },
      { pts: [[1220, 470], [1280, 280], [1320, 100]], w: 6 },
    ],
    terrain: [
      rect(1150, 300, 240, 160, 'hill'),
      rect(360, 500, 260, 170, 'forest'), rect(820, 300, 220, 150, 'forest'),
      rect(660, 700, 240, 140, 'marsh'), rect(300, 180, 200, 140, 'marsh'),
      rect(1030, 180, 180, 130, 'village'),
    ],
    towns: [{ x: 1110, y: 245, name: 'Eylau', size: 14 }, { x: 1120, y: 600, name: 'Heiligwalde', size: 10 }],
    forts: [
      { x: 1200, y: 240, name: 'Cimetière', r: 30, hp: 650, side: 'en' },
      { x: 1260, y: 560, name: 'Ferme', r: 26, hp: 420, side: 'en' },
    ],
    objectives: [{ x: 1200, y: 250, r: 80, name: "Cimetière d'Eylau", optional: true }],
  },
  deploy: { fr: { x: 80, y: 300, w: 260, h: 440 }, en: { x: 1050, y: 240, w: 300, h: 480 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 3, quality: 'conscript' },
    { cls: 'INF', name: 'Grenadiers', n: 1, quality: 'veteran' },
    { cls: 'CAV', name: 'Cavalerie restante', n: 1, quality: 'conscript' },
    { cls: 'ART', name: 'Batteries', n: 2, quality: 'veteran' },
    { cls: 'SAP', name: 'Sapeurs', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie russe', n: 6, quality: 'veteran' },
    { cls: 'CAV', name: 'Cosaques', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries russes', n: 3, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers russes', n: 1 },
    { cls: 'CMD', name: 'Général russe', n: 1 },
  ],
  reinforcement: { at: 150, side: 'fr', text: 'Ney lance la cavalerie de réserve !',
    units: [{ cls: 'CAV', name: 'Cavalerie de réserve (renfort)', n: 2, quality: 'veteran' }] },
},

/* ============================================================ 5 */
{
  id: 'wagram', num: 5, name: 'Wagram', date: '5-6 juillet 1809', place: 'Autriche',
  difficulty: 4, seed: 1809,
  brief: [
    "L'Autriche s'est mobilisée une fois de plus ; ce sera la dernière grande victoire de Napoléon sur le Danube. L'armée autrichienne s'est retranchée sur la rive gauche du Danube.",
    "La diversion de Hiller fixe l'aile autrichienne jusqu'au soir. À ce moment-là, l'armée française se retire de trois kilomètres : l'ennemi s'y précipite, s'expose, et se retrouve désordonné.",
    "Masséna se lance alors à travers le village de Wagram, pris d'assaut coûte que coûte, et la cavalerie ferme la retraite sur les ponts du Danube. Ne perdez pas l'élan.",
  ],
  quote: "Cette journée n'a pas été une bataille, mais une mêlée.",
  objectives: [
    "Détruire ou faire rompre l'armée autrichienne.",
    "Protéger Napoléon.",
    "Facultatif : s'emparer de Wagram.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: "Commande depuis Wagram." },
    { side: 'fr', name: 'André Masséna', role: 'Maréchal', note: "Assaut du village." },
    { side: 'en', name: 'Archiduc Charles', role: 'Commandant autrichien', note: 'Défensive disciplinée.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [260, 0], [200, 130], [90, 220], [0, 210]],
      [[0, 560], [240, 590], [420, 700], [520, 900], [0, 900]],
      [[1240, 900], [1440, 900], [1440, 700], [1340, 780], [1270, 870]],
    ],
    rivers: [{ pts: [[1440, 200], [1180, 240], [960, 280], [760, 300], [560, 340], [360, 380], [160, 420]], w: 14 }],
    bridges: [{ x: 760, y: 300 }, { x: 355, y: 381 }],
    roads: [
      { pts: [[60, 560], [340, 540], [640, 520], [940, 500], [1240, 480], [1440, 470]], w: 8 },
      { pts: [[640, 520], [660, 320], [700, 120]], w: 7 },
    ],
    terrain: [
      rect(520, 120, 220, 150, 'hill'), rect(980, 380, 240, 160, 'hill'),
      rect(280, 200, 220, 150, 'forest'), rect(900, 700, 260, 160, 'forest'),
      rect(240, 620, 220, 140, 'marsh'), rect(640, 500, 170, 120, 'village'),
    ],
    towns: [{ x: 720, y: 560, name: 'Wagram', size: 13 }],
    forts: [{ x: 640, y: 220, name: 'Klein-Wagram', r: 30, hp: 520, side: 'en' }],
    objectives: [{ x: 700, y: 555, r: 90, name: 'Village de Wagram', optional: true }],
  },
  deploy: { fr: { x: 90, y: 480, w: 280, h: 330 }, en: { x: 1080, y: 300, w: 280, h: 460 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 3, quality: 'veteran' },
    { cls: 'INF', name: 'Grenadiers', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie de division', n: 2, quality: 'veteran' },
    { cls: 'ART', name: 'Batteries', n: 2, quality: 'line' },
    { cls: 'SAP', name: 'Sapeurs', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie autrichienne', n: 6, quality: 'veteran' },
    { cls: 'CAV', name: 'Cavalerie hongroise', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries autrichiennes', n: 2, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers autrichiens', n: 1 },
    { cls: 'CMD', name: 'Général autrichien', n: 1 },
  ],
  reinforcement: { at: 130, side: 'fr', text: 'La division de Grouchy attaque le flanc !',
    units: [{ cls: 'CAV', name: 'Cavalerie de Grouchy', n: 2, quality: 'veteran' }, { cls: 'INF', name: 'Division de réserve', n: 1, quality: 'veteran' }] },
},

/* ============================================================ 6 */
{
  id: 'borodino', num: 6, name: 'Borodino', date: '7 septembre 1812', place: 'Russie',
  difficulty: 5, seed: 1812,
  brief: [
    "La Grande Armée a marché six mille kilomètres. Les provisions sont vides, les chevaux sont morts, et les enfants de conscrits marchent en sanglotant derrière les vieux soldats.",
    "Koutouzov a choisi le terrain : les Flèches, ces longs retranchements de bois et de terre au nord-est, dominent tout le champ de bataille. Vos unités de choc sont précisément faites pour cela.",
    "Bagration décrochera tranquillement, et Davout est seul devant lui. Il faut lui gagner du temps : ne livrez pas vos réserves au choc avant que la cavalerie russe ne vous tombe dessus.",
  ],
  quote: "Les Russes ont bien choisi leur terrain. Nous le leur prendrons.",
  objectives: [
    "Détruire ou faire rompre l'armée russe.",
    "Protéger Napoléon.",
    "Facultatif : s'emparer du Grand Réduit (Grande Flèche).",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: 'Blessé à la cuisse, il reste debout.' },
    { side: 'fr', name: 'Louis-Nicolas Davout', role: 'Maréchal', note: 'Seul face à Bagration.' },
    { side: 'fr', name: 'Michel Ney', role: 'Maréchal', note: "Charge d'honneur au sud." },
    { side: 'en', name: 'Mikhail Koutouzov', role: 'Feld-maréchal', note: 'Défensive prudente.' },
    { side: 'en', name: 'Pyotr Bagration', role: 'Prince', note: 'Défend la Grande Flèche.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [280, 0], [230, 120], [110, 210], [0, 200]],
      [[1160, 900], [1440, 900], [1440, 660], [1320, 740], [1230, 850]],
    ],
    rivers: [{ pts: [[1180, 120], [1020, 200], [900, 280], [820, 340], [780, 420], [760, 520], [700, 640], [620, 780]], w: 15 }],
    bridges: [{ x: 780, y: 420 }, { x: 626, y: 772 }],
    roads: [
      { pts: [[60, 480], [340, 460], [660, 450], [980, 450], [1300, 460], [1440, 470]], w: 8 },
      { pts: [[660, 450], [640, 220], [600, 80]], w: 6 },
    ],
    terrain: [
      rect(820, 300, 260, 170, 'hill'),
      rect(260, 220, 220, 160, 'forest'), rect(980, 620, 260, 170, 'forest'),
      rect(380, 600, 240, 150, 'forest'),
      rect(200, 420, 200, 140, 'marsh'), rect(1120, 400, 200, 140, 'village'),
    ],
    towns: [{ x: 1210, y: 470, name: 'Borodino', size: 13 }],
    forts: [
      { x: 980, y: 300, name: 'Grande Flèche', r: 40, hp: 950, side: 'en' },
      { x: 900, y: 400, name: 'Flèche nord', r: 26, hp: 450, side: 'en' },
      { x: 1080, y: 400, name: 'Flèche sud', r: 26, hp: 450, side: 'en' },
    ],
    objectives: [{ x: 980, y: 320, r: 110, name: 'Grande Flèche', optional: true }],
  },
  deploy: { fr: { x: 70, y: 360, w: 260, h: 420 }, en: { x: 1090, y: 260, w: 280, h: 500 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 3, quality: 'conscript' },
    { cls: 'INF', name: 'Garde impériale', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie', n: 2, quality: 'conscript' },
    { cls: 'ART', name: 'Batteries', n: 2, quality: 'veteran' },
    { cls: 'SAP', name: 'Sapeurs — unités de choc', n: 2, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie russe', n: 7, quality: 'veteran' },
    { cls: 'CAV', name: 'Cosaques', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries russes', n: 2, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers russes', n: 1 },
    { cls: 'CMD', name: 'Général russe', n: 1 },
  ],
  reinforcement: { at: 150, side: 'fr', text: 'La division Loison rejoint la lutte !',
    units: [{ cls: 'INF', name: 'Division de réserve', n: 2, quality: 'conscript' }, { cls: 'CAV', name: 'Cavalerie de réserve', n: 1, quality: 'conscript' }] },
},

/* ============================================================ 7 */
{
  id: 'leipzig', num: 7, name: 'Leipzig', date: '16-19 octobre 1813', place: 'Saxe',
  difficulty: 5, seed: 1813,
  brief: [
    "La bataille des Nations : plus de cinq cent mille hommes, la plus grande bataille de l'histoire. La France se bat contre l'Europe tout entière.",
    "Napoléon a préparé son dispositif avec soin : un corps isolé à droite sur une butte, la cavalerie à gauche, le centre ancré dans les villages de Möckern. Chaque îlot est défendu par des canons et des cuirassiers.",
    "Blücher ne combat pas seul. Gardez votre flanc à l'ouest, tenez Möckern, et attendez la nuit : c'est là que la bataille bascule.",
  ],
  quote: "Je les battrai partout, à la fois, et je les battrai encore !",
  objectives: [
    "Détruire ou faire rompre les forces alliées.",
    "Protéger Napoléon.",
    "Facultatif : tenir le village de Möckern.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: "Commande une armée épuisée." },
    { side: 'fr', name: 'André Masséna', role: 'Maréchal', note: 'Möckern, dans la tempête.' },
    { side: 'fr', name: 'Dominique Vandamme', role: 'Général', note: "Tient la butte de l'est." },
    { side: 'en', name: 'Gebhard von Blücher', role: 'Feld-maréchal', note: 'Arrivée par le nord.' },
    { side: 'en', name: 'Karl von Schwarzenberg', role: 'Commandant allié', note: 'Commande la coalition.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [240, 0], [200, 150], [90, 240], [0, 230]],
      [[0, 640], [220, 680], [380, 800], [340, 900], [0, 900]],
    ],
    rivers: [{ pts: [[1440, 560], [1180, 540], [960, 520], [760, 500], [560, 480], [360, 450], [140, 420]], w: 15 }],
    bridges: [{ x: 760, y: 500 }, { x: 380, y: 458 }],
    roads: [
      { pts: [[60, 300], [340, 320], [640, 340], [940, 360], [1240, 380], [1440, 390]], w: 8 },
      { pts: [[640, 340], [660, 560], [700, 800]], w: 7 },
      { pts: [[340, 320], [320, 560], [340, 800]], w: 6 },
    ],
    terrain: [
      rect(1080, 120, 220, 150, 'hill'), rect(300, 500, 240, 160, 'hill'),
      rect(820, 560, 260, 170, 'forest'), rect(180, 300, 220, 150, 'forest'),
      rect(1080, 700, 240, 150, 'marsh'), rect(700, 300, 180, 130, 'village'),
    ],
    towns: [{ x: 785, y: 365, name: 'Möckern', size: 13 }],
    forts: [
      { x: 1190, y: 190, name: "Butte de l'est", r: 34, hp: 620, side: 'fr' },
      { x: 400, y: 570, name: "Butte de l'ouest", r: 30, hp: 560, side: 'fr' },
    ],
    objectives: [{ x: 785, y: 370, r: 90, name: 'Möckern', optional: true }],
  },
  deploy: { fr: { x: 80, y: 240, w: 260, h: 480 }, en: { x: 1080, y: 180, w: 280, h: 520 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 3, quality: 'veteran' },
    { cls: 'INF', name: 'Jeunes conscrits', n: 1, quality: 'conscript' },
    { cls: 'INF', name: 'Garde', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie', n: 3, quality: 'line' },
    { cls: 'ART', name: 'Batteries', n: 3, quality: 'veteran' },
    { cls: 'SAP', name: 'Sapeurs', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 2 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie coalisée', n: 8, quality: 'veteran' },
    { cls: 'INF', name: 'Garde autrichienne', n: 2, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie coalisée', n: 2, quality: 'cossack' },
    { cls: 'ART', name: 'Batteries coalisées', n: 3, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers alliés', n: 1 },
    { cls: 'CMD', name: 'Général allié', n: 1 },
  ],
  reinforcement: { at: 160, side: 'fr', text: 'Les jeunes Français arrivent à la rescousse !',
    units: [{ cls: 'INF', name: 'Jeunes tambours', n: 2, quality: 'conscript' }] },
},

/* ============================================================ 8 */
{
  id: 'waterloo', num: 8, name: 'Waterloo', date: '18 juin 1815', place: 'Belgique',
  difficulty: 5, seed: 1815, final: true,
  brief: [
    "La dernière bataille. Wellington a choisi le terrain : un plateau sommital, rideau de haies, villages fortifiés devant lui. La Grande Armée arrive par le nord et ne pourra rouler que par les chemins trempés.",
    "Grouchy tient la droite, Ney charge à fond. Le dernier assaut français aura lieu à la tombée de la nuit, quand la pluie cessera enfin et que les longs tubes de Krupp seront hors d'atteinte.",
    "Tout repose sur la nuit : c'est elle qui amènera Blücher. Si l'armée prussienne rejoint le champ de bataille, c'est la fin. Tenez jusqu'à ce qu'elle arrive.",
  ],
  quote: "Je n'ai plus d'armée. Mais je vous ai, moi.",
  objectives: [
    "Détruire ou faire rompre les forces alliées.",
    "Protéger Napoléon — sa capture serait une défaite.",
    "Facultatif : neutraliser la redoute de Hougoumont.",
  ],
  commanders: [
    { side: 'fr', name: 'Napoléon Bonaparte', role: 'Emereur', note: 'Dernière bataille.' },
    { side: 'fr', name: 'Michel Ney', role: 'Maréchal', note: 'Charge à la tête des cavaliers.' },
    { side: 'fr', name: 'Emmanuel de Grouchy', role: 'Maréchal', note: 'Sur la droite, à la poursuite.' },
    { side: 'en', name: 'Arthur Wellesley', role: 'Duc de Wellington', note: 'Défensive maîtrisée.' },
    { side: 'en', name: 'Gebhard von Blücher', role: 'Feld-maréchal', note: 'Arrive au sud.' },
  ],
  map: {
    w: 1440, h: 900,
    water: [
      [[0, 0], [220, 0], [180, 160], [70, 250], [0, 240]],
      [[0, 700], [200, 740], [320, 860], [300, 900], [0, 900]],
      [[1180, 900], [1440, 900], [1440, 680], [1330, 760], [1250, 860]],
    ],
    rivers: [{ pts: [[1440, 300], [1200, 330], [980, 350], [780, 360], [580, 340], [380, 300], [160, 270]], w: 13 }],
    bridges: [{ x: 780, y: 360 }],
    roads: [
      { pts: [[60, 560], [340, 540], [640, 520], [940, 500], [1240, 490], [1440, 490]], w: 9 },
      { pts: [[640, 520], [700, 360], [760, 160]], w: 7 },
      { pts: [[640, 520], [600, 700], [580, 860]], w: 7 },
    ],
    terrain: [
      rect(880, 240, 380, 200, 'hill'),
      rect(300, 620, 240, 160, 'forest'), rect(1020, 640, 240, 160, 'forest'),
      rect(520, 180, 220, 150, 'marsh'), rect(900, 520, 200, 140, 'village'),
    ],
    towns: [{ x: 990, y: 585, name: 'Waterloo', size: 12 }, { x: 470, y: 700, name: 'Hougoumont', size: 11 }],
    forts: [
      { x: 430, y: 690, name: 'Hougoumont', r: 34, hp: 850, side: 'en' },
      { x: 1080, y: 300, name: 'La Haye Sainte', r: 30, hp: 780, side: 'en' },
    ],
    objectives: [
      { x: 430, y: 690, r: 70, name: 'Hougoumont', optional: true },
      { x: 1080, y: 320, r: 100, name: 'Plateau de Mont-Saint-Jean', optional: true },
    ],
  },
  deploy: { fr: { x: 70, y: 380, w: 250, h: 440 }, en: { x: 1060, y: 220, w: 300, h: 500 } },
  player: [
    { cls: 'INF', name: 'Infanterie de ligne', n: 4, quality: 'veteran' },
    { cls: 'INF', name: 'Garde impériale', n: 1, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie de réserve', n: 3, quality: 'veteran' },
    { cls: 'ART', name: 'Batteries', n: 2, quality: 'veteran' },
    { cls: 'SAP', name: 'Sapeurs', n: 1, quality: 'veteran' },
    { cls: 'NCO', name: 'Chefs de bataillon', n: 2 },
    { cls: 'CMD', name: 'Général de division', n: 1 },
    { cls: 'EMP', name: 'Napoléon Bonaparte', n: 1 },
  ],
  enemy: [
    { cls: 'INF', name: 'Infanterie britannique', n: 5, quality: 'veteran' },
    { cls: 'INF', name: 'Garde britannique', n: 2, quality: 'guard' },
    { cls: 'CAV', name: 'Cavalerie britannique', n: 2, quality: 'veteran' },
    { cls: 'ART', name: 'Batteries alliées', n: 2, quality: 'line' },
    { cls: 'NCO', name: 'Sous-officiers alliés', n: 1 },
    { cls: 'CMD', name: 'Général allié', n: 1 },
  ],
  reinforcement: { at: 170, side: 'en', text: "L'armée de Blücher arrive par le sud !",
    units: [{ cls: 'INF', name: 'Armée prussienne (renfort)', n: 2, quality: 'veteran' }, { cls: 'CAV', name: 'Cavalerie prussienne', n: 1, quality: 'cossack' }] },
},
];