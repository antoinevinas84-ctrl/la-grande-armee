/* ============================================================
   sandbox.js — scénarios personnalisés (bac à sable)
   Carte vierge, tout est modifiable : terrain, murs, rivières,
   ponts, fortifications, placement libre des troupes, temps infini.
   ============================================================ */

const SANDBOX_KEY = 'grande-armee-scenarios-v1';
const SANDBOX_MAX = 20;

const Sandbox = {
  /* ---------------- état de l'éditeur ---------------- */
  tool: 'select',
  paintKind: 'forest',
  brush: 46,
  wallW: 14,
  side: 'fr',
  cls: 'INF',
  quality: 'line',
  fortSide: 'en',
  drag: null,        // { type, pts:[] }
  painting: false,
  hoverX: 0, hoverY: 0,
  name: 'Mon scénario',

  tools: [
    { key: 'select', label: 'Sélection',        hint: 'Cliquez une unité, puis cliquez ailleurs pour la déplacer.' },
    { key: 'paint',  label: 'Peindre',         hint: 'Maintenez le bouton pour peindre le terrain. Molette ou [ ] pour la taille.' },
    { key: 'wall',   label: 'Mur / fort',       hint: 'Tracez un mur : infranchissable, et +35 % de défense pour qui s\'y appuie.' },
    { key: 'river',  label: 'Rivière',          hint: 'Cavalerie et artillerie ne la franchissent qu\'aux ponts. Infanterie et sapeurs peuvent la passer.' },
    { key: 'road',   label: 'Route',            hint: 'Les unités y avancent 60 % plus vite.' },
    { key: 'bridge', label: 'Pont',             hint: 'Cliquez sur une rivière pour y poser un pont.' },
    { key: 'fort',   label: 'Redoute',          hint: 'Ouvrage fortifié qui tire sur les ennemis. Utilisez le bouton de camp pour changer de côté.' },
    { key: 'town',   label: 'Village',          hint: 'Village : couvert de +32 %, ralentit légèrement.' },
    { key: 'water',  label: 'Étendue d\'eau',   hint: 'Peignez un lac : totalement infranchissable.' },
    { key: 'unit',   label: 'Ajouter une troupe', hint: 'Cliquez sur la carte pour poser l\'unité choisie dans la palette.' },
    { key: 'erase',  label: 'Gomme',            hint: 'Cliquez pour supprimer une unité, un mur, un ouvrage…' },
  ],

  hint() {
    const t = this.tools.find((x) => x.key === this.tool);
    return t ? t.hint : '';
  },

  reset() {
    this.tool = 'select';
    this.drag = null;
    this.painting = false;
    this.side = 'fr';
    this.cls = 'INF';
    this.fortSide = 'en';
    this.name = 'Mon scénario';
    UI.buildSandboxPanels(this);
  },

  /* ---------------- peinture ---------------- */

  paintAt(x, y) {
    const map = Game.world.map;
    const r = Math.max(10, this.brush * 0.5);
    if (this.tool === 'water') {
      map.addFeature({ type: 'water', poly: GameMap.circlePoly(x, y, r, 14) });
      map.pushOut(Game.world.units, 'INF');
    } else if (this.tool === 'paint') {
      map.addFeature({ type: 'patch', shape: 'e', x, y, rx: r, ry: r, kind: this.paintKind });
    }
  },

  /* ---------------- tracés ---------------- */

  beginDraw(x, y) {
    if (this.tool === 'wall' || this.tool === 'river' || this.tool === 'road') {
      this.drag = { type: this.tool, pts: [[x, y]] };
    } else if (this.tool === 'paint' || this.tool === 'water') {
      this.painting = true;
      this.paintAt(x, y);
    }
  },

  extendDraw(x, y) {
    if (!this.drag) {
      if (this.painting) this.paintAt(x, y);
      return;
    }
    const pts = this.drag.pts;
    const last = pts[pts.length - 1];
    if (U.dist(last[0], last[1], x, y) <= 14) return;

    // si l'on continue tout droit, on prolonge le segment au lieu d'ajouter un point
    if (pts.length >= 2) {
      const p = pts[pts.length - 2];
      let d = Math.abs(Math.atan2(last[1] - p[1], last[0] - p[0]) - Math.atan2(y - last[1], x - last[0]));
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < 0.2) { pts[pts.length - 1] = [x, y]; return; }
    }
    pts.push([x, y]);
  },

  endDraw(x, y) {
    this.painting = false;
    const d = this.drag;
    this.drag = null;
    if (!d) return null;

    const pts = d.pts;
    if (pts.length < 2) pts.push([x + 30, y]);
    const map = Game.world.map;
    let f;
    if (d.type === 'wall') f = map.addFeature({ type: 'wall', pts, w: this.wallW });
    else if (d.type === 'river') f = map.addFeature({ type: 'river', pts, w: 12 });
    else f = map.addFeature({ type: 'road', pts, w: 7 });

    if (d.type === 'wall') map.pushOut(Game.world.units, 'INF');
    return f;
  },

  /* ---------------- clic simple ---------------- */

  clickAt(x, y, shift) {
    const w = Game.world;
    const map = w.map;
    switch (this.tool) {
      case 'bridge': map.addFeature({ type: 'bridge', x, y }); Game.audio.blip(); break;
      case 'town':   map.addFeature({ type: 'town', x, y, size: 12, name: 'Village' }); Game.audio.blip(); break;
      case 'fort':
        map.addFeature({ type: 'fort', x, y, r: 28, name: 'Redoute ' + (w.forts.length + 1), hp: 500, side: this.fortSide });
        w.syncForts();
        Game.audio.blip();
        break;
      case 'unit':   this.addUnit(x, y, shift); break;
      case 'erase':  this.eraseAt(x, y); break;
    }
  },

  addUnit(x, y, shift) {
    const w = Game.world;
    const side = shift ? (this.side === 'fr' ? 'en' : 'fr') : this.side;
    const cls = this.cls;
    const p = w.map.nearestFree(x, y, cls, 240);
    const u = new Unit({
      side, cls, quality: this.quality,
      name: CLASSES[cls].name, x: p.x, y: p.y,
    });
    w.units.push(u);
    if (side === 'fr') UI.buildRoster(Game);
    Game.audio.blip();
    return u;
  },

  eraseAt(x, y) {
    const w = Game.world;
    const map = w.map;
    const u = Game.unitAt(x, y);
    if (u) {
      w.units.splice(w.units.indexOf(u), 1);
      if (u.side === 'fr') UI.buildRoster(Game);
      Game.audio.blip();
      return;
    }
    const f = map.removeFeatureAt(x, y, ['wall', 'river', 'road', 'fort', 'town', 'bridge'], 46);
    if (f) {
      if (f.type === 'fort') w.syncForts();
      Game.audio.blip();
    }
  },

  /* ---------------- sauvegarde ---------------- */

  serialize(name) {
    const w = Game.world;
    const feats = w.map.features.map((f) => {
      const c = Object.assign({}, f);
      delete c._z; delete c.__b;
      return c;
    });
    return {
      name: (name || this.name || 'Mon scénario').trim(),
      savedAt: Date.now(),
      w: w.map.w, h: w.map.h,
      features: feats,
      units: w.units.map((u) => ({ side: u.side, cls: u.cls, quality: u.quality.key, name: u.name, x: Math.round(u.x), y: Math.round(u.y) })),
    };
  },

  save(name) {
    const record = this.serialize(name);
    if (!record.name) record.name = 'Scénario sans titre';
    this.name = record.name;
    const list = Sandbox.list();
    const i = list.findIndex((r) => r.name === record.name);
    if (i >= 0) list[i] = record; else list.unshift(record);
    list.splice(SANDBOX_MAX);
    try {
      localStorage.setItem(SANDBOX_KEY, JSON.stringify(list));
      return record;
    } catch (err) {
      return null;
    }
  },

  list() {
    try {
      const raw = localStorage.getItem(SANDBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  },

  delete(name) {
    const list = Sandbox.list().filter((r) => r.name !== name);
    try { localStorage.setItem(SANDBOX_KEY, JSON.stringify(list)); } catch (err) { /* ignore */ }
  },
};