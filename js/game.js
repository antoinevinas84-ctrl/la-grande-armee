/* ============================================================
   game.js — état du jeu, boucle principale, mise en place
   ============================================================ */

const SAVE_KEY = 'grande-armee-progress-v1';

class World {
  constructor(camp, game) {
    this.camp = camp;
    this.game = game;
    this.map = new GameMap(camp.map);
    this.units = [];
    this.forts = [];
    this.shells = [];
    this.fx = new FX();
    this.audio = game.audio;
    this.playerSide = 'fr';
    this.selected = new Set();
    this.hover = null;
    this.dragBox = null;
    this.dragOrder = null;
    this.time = 0;
    this.dt = 0;
    this.phase = 'deploy';        // deploy | battle | over
    this.result = null;
    this.aura = { active: false, t: 0, cd: 0 };
    this.reinforced = false;
    this.startMen = 0;
    this.deaths = [];
    this.view = { zoom: 1, ox: 0, oy: 0 };

    for (const f of camp.forts || []) this.forts.push(new Fort(f, f.side));
  }

  byId(id) { return this.units.find((u) => u.id === id); }
  /** encore sur le champ de bataille (une unité en rupture y est toujours) */
  onField(side) { return this.units.filter((u) => u.alive && u.side === side); }
  /** unités combattantes : ni détruites, ni en rupture */
  aliveOf(side) { return this.units.filter((u) => u.alive && u.side === side && u.state !== 'rout'); }
  count(side) { return this.onField(side).length; }

  totalMen(side) {
    let s = 0;
    for (const u of this.units) if (u.alive && u.side === side) s += u.men;
    return s;
  }

  /* ---- mise en place des unités ---- */
  place(blocks, side, zone) {
    const list = [];
    // compte total pour répartir proprement en lignes et colonnes
    let total = 0;
    for (const b of blocks) total += (b.n || 1);

    const cols = U.clamp(Math.round(Math.sqrt(total * (zone.h / Math.max(1, zone.w)))), 2, 7);
    const rows = Math.ceil(total / cols);
    let idx = 0;

    for (const b of blocks) {
      const n = b.n || 1;
      for (let i = 0; i < n; i++) {
        const cx = zone.x + zone.w * ((idx % cols) + 0.5) / cols;
        const cy = zone.y + zone.h * (Math.floor(idx / cols) + 0.5) / rows;
        idx++;
        const p = this.map.nearestFreeInZone(cx, cy, b.cls, zone) ||
                  this.map.nearestFree(cx, cy, b.cls, 300);
        const u = new Unit({
          side, cls: b.cls, quality: b.quality || 'line',
          name: n > 1 ? `${b.name} ${romanIndex(i + 1)}` : b.name,
          x: p.x, y: p.y,
        });
        this.units.push(u);
        list.push(u);
      }
    }
    return list;
  }

  /* ---- projectiles ---- */
  spawnShell(from, target, dmg) {
    const D = from.def;
    this.shells.push({
      x: from.x + Math.cos(from.facing) * 14,
      y: from.y + Math.sin(from.facing) * 14,
      facing: from.facing,
      speed: D.key === 'ART' ? D.shellSpeed || 400 : 520,
      dmg, from, target,
      splash: from.kind === 'fort' ? 0 : (D.splash || 0),
    });
  }

  onRout(u) {
    this.game.banner(u.side === 'fr' ? u.name + ' rompt !' : u.name + ' se disloque !', u.side === 'en');
    this.game.audio.crackle();
  }

  onRally(u) {
    if (u.side === 'fr') this.game.banner(u.name + ' se reforme !');
  }

  capture(u) {
    // l'unité fuit le champ de bataille : elle est faite prisonnière
    this.captured = (this.captured || 0) + u.men;
    u.captured = true;
    u.men = 0;
    u.state = 'gone';
  }

  reap() {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.state === 'gone') { this.units.splice(i, 1); continue; }
      if (!u.alive) {
        this.deaths.push(u);
        if (u.def.key === 'CMD' || u.def.key === 'NCO' || u.def.imperial) {
          for (const o of this.units) {
            if (o.side === u.side && o.alive && U.dist(o.x, o.y, u.x, u.y) < (u.def.auraR || 140)) {
              o.morale = Math.max(0, o.morale + BAL.officerDeathMorale);
            }
          }
          this.game.banner(
            u.side === 'fr'
              ? (u.def.imperial ? "L'EMPEREUR EST HORS DE COMBAT !" : u.name + ' est hors de combat !')
              : u.name + ' est éliminé !',
            u.side === 'en'
          );
          if (u.def.imperial) {
            // l'Empereur tombe : tout l'état de l'armée s'effondre
            for (const o of this.units) if (o.side === 'fr' && o.alive) o.morale = Math.max(0, o.morale - 45);
            this.game.onEmperorDown();
          }
        }
        u.state = 'gone';
      }
    }
    for (const f of this.forts) if (f.hp <= 0 && f.alive) { f.alive = false; f.hp = 0; }
  }

  objectiveHeld(o) {
    let inside = 0;
    for (const u of this.units) {
      if (!u.alive || u.side !== this.playerSide || u.state === 'rout') continue;
      if (U.dist(u.x, u.y, o.x, o.y) <= o.r) inside++;
    }
    return inside > 0;
  }

  currentObjective() {
    const foes = this.aliveOf('en').length;
    const mine = this.aliveOf('fr').length;
    if (!mine) return 'Défaite : l\'armée française est anéantie';
    if (!foes) return 'Victoire : l\'armée adverse est anéantie';
    return 'Détruire l\'armée adverse (' + foes + ' unités restantes)';
  }
}

function romanIndex(i) {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i - 1] || String(i);
}

/* ============================================================
   Game
   ============================================================ */
const Game = {
  screen: 'menu',
  world: null,
  audio: new Audio(),
  speed: 1,
  paused: false,
  progress: { max: 1, done: [] },

  init() {
    Renderer.init(document.getElementById('canvas'));
    Input.init(Renderer.canvas, this);
    this.loadProgress();
    this.bindUI();
    UI.buildLegend();
    UI.buildCampaignList(this);
    UI.show('menu');
    this.resize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  /* ---------- sauvegarde ---------- */
  loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.progress = JSON.parse(raw);
    } catch (err) { this.progress = { max: 1, done: [] }; }
  },
  saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress)); } catch (err) { /* mode privé */ }
  },

  /* ---------- interface ---------- */
  bindUI() {
    const $ = UI.$;
    $('btn-howto').addEventListener('click', () => { this.prevScreen = 'menu'; UI.show('howto'); this.screen = 'howto'; });
    $('btn-howto-close').addEventListener('click', () => this.closeHowto());
    $('btn-reset').addEventListener('click', () => {
      this.progress = { max: 1, done: [] };
      this.saveProgress();
      UI.buildCampaignList(this);
      UI.banner('Progression réinitialisée');
    });

    $('btn-back').addEventListener('click', () => {
      this.hideResume();
      UI.show('menu'); this.screen = 'menu'; UI.buildCampaignList(this);
    });
    $('btn-deploy').addEventListener('click', () => { this.hideResume(); this.startDeploy(); });

    $('btn-dp-auto').addEventListener('click', () => this.autoDeploy());
    $('btn-dp-clear').addEventListener('click', () => this.resetDeploy());
    $('btn-dp-start').addEventListener('click', () => this.startBattle());

    $('btn-menu').addEventListener('click', () => this.pauseToMenu());
    $('btn-pause').addEventListener('click', () => this.togglePause());
    for (const b of document.querySelectorAll('.sp-btn[data-speed]')) {
      b.addEventListener('click', () => {
        const s = +b.dataset.speed;
        this.speed = s;
        this.paused = s === 0;
        this.syncSpeedButtons();
      });
    }

    $('btn-aura').addEventListener('click', () => this.triggerAura());
    $('btn-hold').addEventListener('click', () => this.orderHold());
    $('btn-charge').addEventListener('click', () => this.orderChargeAll());
    $('btn-mute').addEventListener('click', () => {
      const m = this.audio.toggleMute();
      $('btn-mute').style.opacity = m ? 0.4 : 1;
    });

    $('btn-res-menu').addEventListener('click', () => {
      this.hideResume();
      UI.show('menu'); this.screen = 'menu'; UI.buildCampaignList(this);
    });
    $('btn-res-next').addEventListener('click', () => {
      const c = CAMPAIGNS[this.world.camp.num];
      if (c) this.openBriefing(c);
    });

    window.addEventListener('resize', () => this.resize());
  },

  syncSpeedButtons() {
    for (const b of document.querySelectorAll('.sp-btn[data-speed]')) {
      b.classList.toggle('active', +b.dataset.speed === (this.paused ? 0 : this.speed));
    }
    UI.$('btn-pause').classList.toggle('active', this.paused);
  },

  /* ---------- zone de jeu utile (entre la barre du haut et celle du bas) ---------- */
  viewRect() {
    const top = 56, bottom = 74, side = 8;
    return {
      x: side, y: top,
      w: Math.max(50, window.innerWidth - side * 2),
      h: Math.max(50, window.innerHeight - top - bottom),
    };
  },

  resize() {
    Renderer.resize();
    if (this.world) this.fitView();
  },

  clampView() {
    if (!this.world) return;
    const v = this.world.view;
    const R = this.viewRect();
    const w = this.world.map.w, h = this.world.map.h;
    const vw = R.w / v.zoom, vh = R.h / v.zoom;
    if (vw >= w) v.ox = R.x + (R.w - w * v.zoom) / 2; else v.ox = U.clamp(v.ox, R.x + R.w - w * v.zoom, R.x);
    if (vh >= h) v.oy = R.y + (R.h - h * v.zoom) / 2; else v.oy = U.clamp(v.oy, R.y + R.h - h * v.zoom, R.y);
  },

  /* ---------- écrans ---------- */
  openBriefing(camp) {
    this.camp = camp;
    UI.fillBriefing(camp, this);
    UI.show('briefing');
    this.screen = 'briefing';
  },
  closeHowto() {
    UI.show(this.prevScreen === 'battle' ? 'battle' : 'menu');
    this.screen = this.prevScreen || 'menu';
  },

  /* ---------- préparation ---------- */
  startDeploy() {
    const camp = this.camp;
    U.srand(camp.seed || 7);
    const w = new World(camp, this);
    this.world = w;
    w.place(camp.player, 'fr', camp.deploy.fr);
    w.place(camp.enemy, 'en', camp.deploy.en);
    w.startMen = w.totalMen('fr');
    w.totalStartMen = w.totalMen('fr') + w.totalMen('en');
    w.startTime = 0;

    UI.$('dp-name').textContent = camp.name;
    UI.$('dp-hint').innerHTML = 'Faites glisser vos unités dans la zone <b style="color:#8fb0ff">bleue</b>. ' +
      'Les unités déjà placées atacquent automatiquement ce qui approche. ' +
      '<b>Clic droit</b> pour donner des ordres pendant la bataille.';
    UI.buildRoster(this);
    UI.show('deploy');
    this.screen = 'deploy';
    this.fitView();
  },

  resetDeploy() {
    this.startDeploy();
  },

  autoDeploy() {
    const camp = this.camp, w = this.world;
    // on repart d'un placement propre
    this.startDeploy();
    const z = camp.deploy.fr;
    const order = { ART: 0, CMD: 2, NCO: 1, EMP: 2, INF: 3, SAP: 4, CAV: 5 };
    const mine = w.units.filter((u) => u.side === 'fr');
    mine.sort((a, b) => (order[a.cls] - order[b.cls]) || (a.y - b.y));

    // trois lignes : artillerie au fond, officiers au centre, choc et cavalerie devant
    const lines = [
      { key: ['ART'], depth: 0.18 },
      { key: ['CMD', 'NCO', 'INF'], depth: 0.48 },
      { key: ['SAP', 'CAV'], depth: 0.82 },
    ];
    for (const L of lines) {
      const group = mine.filter((u) => L.key.includes(u.cls));
      const rows = Math.max(1, Math.ceil(group.length / 6));
      group.forEach((u, i) => {
        const col = i % 6, row = Math.floor(i / 6);
        const x = z.x + z.w * ((col + 0.5) / Math.min(6, group.length));
        const y = z.y + z.h * (L.depth * 0.85 + (row + 0.5) / rows * 0.14);
        const p = w.map.nearestFreeInZone(x, y, u.cls, z, 240) || w.map.nearestFree(x, y, u.cls, 300);
        u.x = p.x; u.y = p.y;
      });
    }
  },

  fitView() {
    const w = this.world;
    const v = w.view;
    const R = this.viewRect();
    v.zoom = Math.min(R.w / w.map.w, R.h / w.map.h) * 0.99;
    this.clampView();
  },

  zoomBy(k) {
    const v = this.world.view;
    const R = this.viewRect();
    const bx = (R.x + R.w / 2 - v.ox) / v.zoom, by = (R.y + R.h / 2 - v.oy) / v.zoom;
    v.zoom = U.clamp(v.zoom * k, 0.35, 2.6);
    v.ox = R.x + R.w / 2 - bx * v.zoom;
    v.oy = R.y + R.h / 2 - by * v.zoom;
    this.clampView();
  },

  focusSelection() {
    const us = this.selectedUnits();
    if (!us.length) return;
    const cx = us.reduce((a, u) => a + u.x, 0) / us.length;
    const cy = us.reduce((a, u) => a + u.y, 0) / us.length;
    const v = this.world.view;
    const R = this.viewRect();
    v.ox = R.x + R.w / 2 - cx * v.zoom;
    v.oy = R.y + R.h / 2 - cy * v.zoom;
    this.clampView();
  },

  /* ---------- combat ---------- */
  startBattle() {
    const w = this.world;
    w.phase = 'battle';
    w.time = 0;
    this.paused = false;
    this.speed = 1;
    this.syncSpeedButtons();
    this.ai = new Commander(w, 'en', w.camp);
    UI.show('battle');
    this.screen = 'battle';
    UI.banner('En avant !');
    this.audio.ensure();
  },

  togglePause() {
    if (this.screen !== 'battle') return;
    this.paused = !this.paused;
    this.syncSpeedButtons();
  },
  setSpeed(s) {
    this.speed = s;
    this.paused = s === 0;
    this.syncSpeedButtons();
  },

  pauseToMenu() {
    if (this.screen === 'battle' || this.screen === 'deploy') {
      this.prevScreen = this.screen;
      this.screen = 'pause';
      this.paused = true;
      this.showResume();
      UI.show('menu');
      UI.buildCampaignList(this);
    }
  },

  showResume() {
    const menu = UI.$('menu');
    let b = document.getElementById('btn-resume');
    if (!b) {
      b = document.createElement('button');
      b.id = 'btn-resume';
      b.className = 'mbtn primary';
      b.textContent = 'Reprendre la partie';
      b.style.marginTop = '0';
      const inner = menu.querySelector('.menu-inner');
      inner.insertBefore(b, inner.querySelector('.campaign-list'));
      b.addEventListener('click', () => this.resume());
    }
    b.classList.remove('hidden');
  },

  hideResume() {
    const b = document.getElementById('btn-resume');
    if (b) b.classList.add('hidden');
  },

  resume() {
    if (this.screen !== 'pause' || !this.world) return;
    this.screen = this.prevScreen || 'battle';
    this.paused = false;
    this.hideResume();
    UI.show(this.screen);
  },

  /* ---------- sélection ---------- */
  unitAt(x, y) {
    const list = this.world.units.filter((u) => u.alive);
    let best = null, bd = Infinity;
    for (const u of list) {
      const d = U.dist(x, y, u.x, u.y);
      const r = u.def.radius + 11;
      if (d < r && d < bd) { bd = d; best = u; }
    }
    return best;
  },

  selectOnly(id) {
    this.world.selected.clear();
    this.world.selected.add(id);
    this.syncPanel();
  },
  toggleSelect(id) {
    if (this.world.selected.has(id)) this.world.selected.delete(id);
    else this.world.selected.add(id);
    this.syncPanel();
  },
  clearSelection() {
    this.world.selected.clear();
    this.syncPanel();
  },
  selectedUnits() {
    return this.world.units.filter((u) => this.world.selected.has(u.id) && u.alive && u.side === this.world.playerSide);
  },

  issueOrder(list, x, y, type) {
    const w = this.world;
    // répartition en formation : on décale légèrement chaque unité
    const n = list.length;
    list.forEach((u, i) => {
      let tx = x, ty = y;
      if (n > 1) {
        const ang = (i / n) * 6.2832;
        const rad = 22 + Math.sqrt(n) * 7;
        tx += Math.cos(ang) * rad;
        ty += Math.sin(ang) * rad;
      }
      const p = w.map.nearestFree(tx, ty, u.cls, 160);
      if (type === 'attack') u.setOrder('attack', p.x, p.y);
      else u.setOrder('move', p.x, p.y);
      u.order.manual = false;
    });
    // trace visuelle de l'ordre
    const c = list.reduce((a, u) => ({ x: a.x + u.x / n, y: a.y + u.y / n }), { x: 0, y: 0 });
    w.dragOrder = { x0: c.x, y0: c.y, x1: x, y1: y, attack: type === 'attack', t: 0.5 };
  },

  orderHold() {
    for (const u of this.selectedUnits()) u.setOrder('hold', u.x, u.y);
    this.flashHint('Ordre : tenir la position');
  },

  orderChargeAll() {
    const w = this.world;
    const list = this.selectedUnits();
    if (!list.length) { this.flashHint('Aucune unité sélectionnée'); return; }
    // charge générale : tous avancent droit sur le centroid ennemi
    const foes = w.units.filter((e) => e.side === 'en' && e.alive && e.state !== 'rout');
    if (!foes.length) return;
    const cx = foes.reduce((a, u) => a + u.x, 0) / foes.length;
    const cy = foes.reduce((a, u) => a + u.y, 0) / foes.length;
    let any = false;
    for (const u of list) {
      if (u.def.key === 'CAV') { u.setOrder('charge', cx, cy); any = true; }
      else if (u.def.key === 'SAP') { u.setOrder('attack', cx, cy); any = true; }
      else u.setOrder('attack', cx, cy);
    }
    this.flashHint(any ? 'CHARGE GÉNÉRALE !' : 'Attaque générale !');
    this.audio.blip();
  },

  triggerAura() {
    const w = this.world;
    if (!w || w.phase !== 'battle') return;
    if (w.aura.active || w.aura.cd > 0) return;
    if (!w.units.some((u) => u.side === 'fr' && u.imperial && u.alive)) {
      this.flashHint("L'Empereur n'est plus au champ de bataille");
      return;
    }
    w.aura.active = true;
    w.aura.t = BAL.auraDuration;
    UI.banner('PRÉSENCE IMPÉRIALE !');
    this.audio.blip();
  },

  onEmperorDown() {
    UI.banner('SANS L\'EMPEREUR, LE MORAL S\'EFFONDRE');
  },

  /* ---------- retours ---------- */
  banner(text, enemy) { UI.banner(text, enemy); },
  flashHint(text) { UI.banner(text); },
  updateTooltip(x, y) { if (this.screen === 'battle' || this.screen === 'deploy') UI.tooltip(this, x, y); },
  syncPanel() { UI.syncUnitCard(this); UI.syncRoster(this); },

  /* ---------- boucle ---------- */
  loop(now) {
    const dtReal = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.world && this.screen === 'battle' && this.world.phase === 'battle') {
      if (!this.paused) {
        const steps = this.speed;
        for (let i = 0; i < steps; i++) this.tick(dtReal);
      } else {
        this.world.fx.update(0);
      }
      UI.syncTopbar(this);
      UI.syncUnitCard(this);
      UI.syncRoster(this);
      UI.syncAuraCard(this);
      this.checkEnd();
    } else if (this.world) {
      this.world.fx.update(dtReal);
      UI.syncUnitCard(this);
      UI.syncRoster(this);
    }

    if (this.world) {
      if (this.world.dragOrder) {
        this.world.dragOrder.t -= dtReal;
        if (this.world.dragOrder.t <= 0) this.world.dragOrder = null;
      }
      Renderer.draw(this.world);
    }
    requestAnimationFrame((t) => this.loop(t));
  },

  tick(dt) {
    const w = this.world;
    w.dt = dt;
    w.time += dt;

    // capacité de l'Empereur
    if (w.aura.active) {
      w.aura.t -= dt;
      if (w.aura.t <= 0) { w.aura.active = false; w.aura.cd = BAL.auraCooldown; }
    } else if (w.aura.cd > 0) {
      w.aura.cd = Math.max(0, w.aura.cd - dt);
    }

    // renforts
    const rf = w.camp.reinforcement;
    if (rf && !w.reinforced && w.time >= rf.at) {
      w.reinforced = true;
      const zone = rf.side === 'fr' ? w.camp.deploy.fr : w.camp.deploy.en;
      const list = w.place(rf.units, rf.side, zone);
      for (const u of list) u.setOrder('advance', u.x, u.y);
      UI.banner(rf.text, rf.side === 'en');
      if (rf.side === 'fr') UI.buildRoster(this);
    }

    if (this.ai) this.ai.update(dt);

    applyAuras(w);
    acquireTargets(w);
    for (const u of w.units) u.update(dt, w);
    resolveCombat(w, dt);
    updateShells(w, dt);
    updateUpkeep(w, dt);
    w.fx.update(dt);
  },

  /* ---------- conditions de fin ---------- */
  checkEnd() {
    const w = this.world;
    if (w.phase !== 'battle') return;

    // une unité en fuite reste sur le champ : il faut la capturedieu d'attendre
    const mine = w.onField('fr');
    const foes = w.onField('en');
    const mineFighting = w.aliveOf('fr').length;
    const foesFighting = w.aliveOf('en').length;

    if (!mine.length) return this.finish(false, "La Grande Armée est anéantie. Le rêve de Napoléon s'éteint ici.");
    if (!foes.length) return this.finish(true);

    // toutes les unités ennemies sont en rupture et fuient : victoire acquise
    if (!foesFighting) {
      return this.finish(true);
    }

    if (!mineFighting) return this.finish(false, "Toutes les unités françaises ont rompu le contact.");

    // l'Empereur est hors de combat
    const emp = w.units.find((u) => u.side === 'fr' && u.imperial);
    if (!emp || !emp.alive) return this.finish(false, "Napoléon a été mis hors de combat. Sans lui, l'armée se débande.");

    // à bout de forces : la nuit tombe, on juge sur la balance des pertes
    if (w.time > 600) {
      const f = this.effective('fr'), e = this.effective('en');
      if (f >= e) return this.finish(true);
      return this.finish(false, "La nuit tombe sur un combat indécis ; le rapport des pertes est défavorable.");
    }
  },

  /** puissance effective d'un camp (hommes × qualité × moral) */
  effective(side) {
    let s = 0;
    for (const u of this.world.units) {
      if (!u.alive || u.side !== side || u.state === 'rout') continue;
      s += u.men * (u.cls === 'CAV' ? 1.3 : u.cls === 'ART' ? 0.8 : 1) * (0.35 + 0.65 * u.morale / Math.max(1, u.maxMorale));
    }
    return s;
  },

  finish(win, reason) {
    const w = this.world;
    w.phase = 'over';
    this.paused = false;

    const left = w.totalMen('fr');
    const lost = Math.max(0, w.startMen - left);
    const obj = w.map.objectives.filter((o) => w.objectiveHeld(o)).length;
    const objTotal = w.map.objectives.length;

    const stats = {
      time: w.time,
      left, lost,
      captured: U.fmt(w.captured || 0),
      obj, objTotal, num: w.camp.num,
      lossRatio: lost / Math.max(1, w.startMen),
      text: win ? victoryText(w.camp, obj, objTotal)
                : (reason || "Les forces françaises ont été vaincues sur ce champ de bataille."),
    };

    if (win) {
      if (!this.progress.done.includes(w.camp.id)) this.progress.done.push(w.camp.id);
      const next = CAMPAIGNS[w.camp.num];
      if (next && this.progress.max < next.num) this.progress.max = next.num;
      this.saveProgress();
      UI.buildCampaignList(this);
    }
    this.audio.fanfare(win);
    setTimeout(() => UI.result(this, win, stats), 900);
  },
};

function victoryText(camp, obj, objTotal) {
  const lines = [
    "L'armée ennemie est anéantie. Le champ de bataille est yours.",
    "La victoire est complète. Les drapeaux français flottent sur la plaine.",
  ];
  if (obj > 0) lines.push("Les objectifs stratégiques ont été atteints.");
  if (camp.final) lines.push("C'est ici que s'arrête l'histoire de la Grande Armée : Waterloo, 18 juin 1815.");
  return lines[Math.min(lines.length - 1, obj > 0 ? 1 : 0)];
}

/* ---------- démarrage ---------- */
window.addEventListener('DOMContentLoaded', () => Game.init());