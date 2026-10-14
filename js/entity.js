/* ============================================================
   entity.js — unités, fortifications, ordres et ordres de bataille
   ============================================================ */

let UNIT_ID = 1;

/** Modificateur global : un moral bas rend l'unité moins efficace */
function moraleMod(m, max) { return 0.55 + 0.45 * U.clamp(m / Math.max(1, max), 0, 1); }
function fatigueMod(f) { return f >= 70 ? 0.55 : f >= 40 ? 0.78 : f >= 15 ? 0.94 : 1.0; }

class Unit {
  constructor(opts) {
    const def = CLASSES[opts.cls];
    const q = QUALITY[opts.quality || 'line'];

    this.id = UNIT_ID++;
    this.kind = 'unit';
    this.side = opts.side;               // 'fr' | 'en'
    this.cls = opts.cls;
    this.def = def;
    this.quality = q;
    this.name = opts.name || def.name;

    this.x = opts.x; this.y = opts.y;
    this.facing = opts.side === 'fr' ? 0 : Math.PI;

    this.maxMen = Math.round(def.men * (q.key === 'guard' ? 1.15 : 1));
    this.men = this.maxMen;
    this.maxMorale = Math.round(def.morale * q.morale);
    this.morale = this.maxMorale;
    this.fatigue = 0;

    this.state = 'idle';                 // idle | advance | move | engage | charge | rout
    this.order = { type: 'advance', x: this.x, y: this.y };
    this.target = null;
    this.targetFort = null;
    this.fireCd = U.rand(0, 1);
    this.chargeTimer = 0;
    this.chargesLeft = def.key === 'CAV' ? 2 : (def.key === 'SAP' ? 1 : 0);
    this.reforming = 0;
    this.routTimer = 0;
    this.lastHitBy = null;
    this.hitFlash = 0;
    this.kills = 0;
    this.casualties = 0;

    // bonus recalculés chaque tick par world.applyAuras()
    this.bAtk = 1; this.bDef = 1; this.bMor = 0; this.bRegen = 1; this.bMorMax = 0;
    this.inAura = false;
  }

  get alive() { return this.men > 0; }
  get ratio() { return this.men / this.maxMen; }
  get imperial() { return !!this.def.imperial; }

  /* --------- statistiques effectives --------- */
  atk() {
    let a = this.def.atk * this.quality.atk * moraleMod(this.morale, this.maxMorale) * fatigueMod(this.fatigue) * this.bAtk;
    if (this.chargeTimer > 0) a *= this.def.chargeAtk || 1.3;
    if (this.morale < 22) a *= 0.7;
    return a;
  }
  def2() {
    return this.def.def * this.quality.def * moraleMod(this.morale, this.maxMorale) * this.bDef;
  }
  reach() { return this.def.range + this.def.radius; }
  speedNow() {
    const s = this.def.speed * (this.state === 'charge' ? 1.65 : 1) *
      (0.55 + 0.45 * (1 - this.fatigue / 140));
    return s;
  }

  /** ennemi le plus proche, dans un rayon donné */
  nearestEnemy(world, maxD) {
    let best = null, bd = maxD;
    for (const e of world.units) {
      if (e.side === this.side || !e.alive || e.state === 'rout') continue;
      const d = U.dist(this.x, this.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** le combat est-il possible dans l'instant ? */
  canFight() { return this.state !== 'rout' && this.men > 0 && this.reforming <= 0; }

  /* --------- ordres --------- */
  setOrder(type, x, y) {
    if (this.state === 'rout') return;
    const p = U.clamp(x, 10, 1416);
    const q = U.clamp(y, 10, 886);
    this.order = { type, x: p, y: q };
    if (type === 'hold') this.state = 'idle';
    else if (type === 'charge' && this.chargesLeft > 0) this.state = 'charge';
    else this.state = type === 'move' ? 'move' : 'advance';
    if (type !== 'hold') this.reforming = 0;
  }

  /* --------- dégâts --------- */
  hurt(amount, moraleHit, by) {
    if (!this.alive) return;
    const men = amount * 0.85;
    this.men = Math.max(0, this.men - men);
    this.casualties += men;
    this.morale -= moraleHit;
    this.hitFlash = 0.22;
    this.lastHitBy = by;
    if (this.men <= 0) this.morale = 0;
  }

  addMorale(v) { this.morale = U.clamp(this.morale + v, 0, this.maxMorale + this.bMorMax); }

  /* --------- déplacement --------- */
  update(dt, world) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (!this.alive) return;   // l'unité détruite est retirée par world.reap()

    if (this.reforming > 0) {
      this.reforming -= dt;
      if (this.reforming <= 0 && this.morale > 28) this.state = 'idle';
      return;
    }

    /* ---------- rupture ---------- */
    if (this.state !== 'rout' && this.morale <= 0.5) {
      if (this.def.immuneRout) {
        this.morale = 1;
      } else {
        this.state = 'rout';
        this.routTimer = 0;
        this.target = null;
        world.onRout(this);
      }
    }

    if (this.state === 'rout') {
      this.routTimer += dt;
      this.fatigue = Math.min(100, this.fatigue + dt * 2);

      // ralliement : un sous-officier peut redresser une compagnie qui rompt (une seule fois)
      if (this.routTimer > 4 && !this.rallied && this.ratio > 0.25 && U.chance(dt * 0.25) && this.tryRally(world)) return;

      // fuite : s'éloigne de l'ennemi le plus proche
      let src = null, best = Infinity;
      for (const u of world.units) {
        if (u.side === this.side || !u.alive) continue;
        const d = U.dist2(this.x, this.y, u.x, u.y);
        if (d < best) { best = d; src = u; }
      }
      let ax, ay;
      if (src) { const d = Math.sqrt(best) || 1; ax = this.x + (this.x - src.x) / d; ay = this.y + (this.y - src.y) / d; }
      else {
        const cx = this.side === 'fr' ? 0 : world.map.w;
        const d = Math.hypot(cx - this.x, this.y - world.map.h / 2) || 1;
        ax = this.x + (cx - this.x) / d; ay = this.y + (this.y - world.map.h / 2) / d;
      }
      this.moveToward(ax, ay, this.def.speed * 1.25, dt, world, true);
      // capturée si elle atteint le bord du champ de bataille
      if (this.x < 25 || this.y < 25 || this.x > world.map.w - 25 || this.y > world.map.h - 25 || this.routTimer > 16) {
        world.capture(this);
      }
      return;
    }

    /* ---------- minuteries ---------- */
    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0 && this.cls === 'CAV') { this.reforming = 2.4; this.state = 'idle'; }
    }
    this.fatigue = Math.max(0, this.fatigue - dt * (this.state === 'charge' ? 0 : 1.6));

    /* ---------- l'artillerie se replie si l'ennemi vient trop près ---------- */
    if (this.def.key === 'ART') {
      const foe = this.nearestEnemy(world, (this.def.minRange || 0) + 30);
      if (foe) {
        const d = U.dist(this.x, this.y, foe.x, foe.y);
        if (d < (this.def.minRange || 0) + 10) {
          const ax = this.x + (this.x - foe.x), ay = this.y + (this.y - foe.y);
          this.moveToward(ax, ay, this.mapSpeed(world, this.def.speed * 1.15), dt, world, false);
          this.facing = Math.atan2(foe.y - this.y, foe.x - this.x);
          return;
        }
      }
    }

    /* ---------- destination ---------- */
    let dest = null, spd = this.speedNow(), stopRange = 0;

    const engaged = this.target && this.target.alive &&
      U.dist(this.x, this.y, this.target.x, this.target.y) <= this.reach() + 4;
    const fortEngaged = this.targetFort && this.targetFort.alive &&
      U.dist(this.x, this.y, this.targetFort.x, this.targetFort.y) <= this.reach() + this.targetFort.r;

    if (this.order.type === 'hold') {
      dest = null;
    } else if (this.order.type === 'advance') {
      const t = this.target;
      // on s'arrête juste avant le contact : au-delà, ce serait une suicide
      const contact = Math.max(this.reach() * 0.72, 24);
      if (t && !engaged) { dest = { x: t.x, y: t.y }; stopRange = contact; }
      else if (this.targetFort && !fortEngaged) { dest = { x: this.targetFort.x, y: this.targetFort.y }; stopRange = this.reach() + this.targetFort.r - 6; }
      else {
        // aucune cible en vue : on avance quand même vers l'ennemi le plus proche
        const foe = this.nearestEnemy(world, Infinity);
        if (foe) {
          dest = { x: foe.x, y: foe.y };
          stopRange = contact;
        }
      }
    } else if (this.order.type === 'move') {
      dest = { x: this.order.x, y: this.order.y };
      stopRange = 6;
    } else if (this.order.type === 'attack' || this.order.type === 'charge') {
      dest = { x: this.order.x, y: this.order.y };
      stopRange = 6;
      if (this.state === 'charge' && U.dist(this.x, this.y, dest.x, dest.y) < 24) {
        this.chargeTimer = 3.2;
        this.chargesLeft--;
        this.fatigue = Math.min(100, this.fatigue + 38);
        this.state = 'engage';
      }
    }

    /* ---------- état d'affichage ---------- */
    if (engaged || fortEngaged) {
      if (this.state !== 'charge' || this.chargeTimer > 0) this.state = 'engage';
    } else if (this.state === 'engage') {
      this.state = this.order.type === 'advance' ? 'advance' : 'move';
    }

    /* ---------- déplacement effectif ---------- */
    if (dest) {
      const d = U.dist(this.x, this.y, dest.x, dest.y);
      if (d > stopRange) {
        const base = this.state === 'charge' ? (this.def.chargeSpeed || this.def.speed * 1.8) : spd;
        const v = this.mapSpeed(world, base);
        if (this.state !== 'charge') this.fatigue = Math.min(100, this.fatigue + dt * 0.25 * this.def.fatigue);
        this.moveToward(dest.x, dest.y, v, dt, world, false);
        if (this.order.type === 'move' && d < stopRange + 14) this.order = { type: 'hold', x: this.x, y: this.y }, this.state = 'idle';
      } else if (this.order.type === 'move' || this.order.type === 'attack') {
        this.order = { type: 'hold', x: this.x, y: this.y };
        this.state = 'idle';
      }
    }
  }

  mapSpeed(world, base) {
    return world.map.unitSpeedAt(this.x, this.y, this.cls, base);
  }

  /** un officier proche peut redresser la compagnie ; true si c'est le cas */
  tryRally(world) {
    for (const o of world.units) {
      if (o === this || o.side !== this.side || !o.alive || !o.def.auraR) continue;
      const R = o.def.auraR * (o.def.antiRout ? 1.35 : 0.75);
      if (U.dist(o.x, o.y, this.x, this.y) > R) continue;
      this.state = 'idle';
      this.morale = this.maxMorale * 0.35;
      this.routTimer = 0;
      this.rallied = true;
      this.order = { type: 'hold', x: this.x, y: this.y };
      world.onRally(this);
      return true;
    }
    return false;
  }

  moveToward(tx, ty, v, dt, world, ignoreTerrain) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return;
    const step = Math.min(d, v * dt);
    let nx = this.x + (dx / d) * step;
    let ny = this.y + (dy / d) * step;
    this.facing = Math.atan2(dy, dx);

    if (ignoreTerrain || world.map.canStand(nx, ny, this.cls)) {
      const c = world.map.clampPoint(nx, ny);
      this.x = c.x; this.y = c.y;
      return;
    }
    // contournement : on essaie quelques angles
    const baseAng = Math.atan2(dy, dx);
    for (const off of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]) {
      const a = baseAng + off;
      const tx2 = this.x + Math.cos(a) * step, ty2 = this.y + Math.sin(a) * step;
      if (world.map.canStand(tx2, ty2, this.cls)) {
        const c = world.map.clampPoint(tx2, ty2);
        this.x = c.x; this.y = c.y; this.facing = a; return;
      }
    }
  }

  statusLabel() {
    if (this.state === 'rout') return 'Rupture !';
    if (this.reforming > 0) return 'Reformation';
    if (this.state === 'charge' || this.chargeTimer > 0) return 'Charge !';
    if (this.state === 'engage') return 'Au combat';
    if (this.state === 'move') return 'En marche';
    if (this.state === 'advance') return 'En avant';
    if (this.fatigue > 55) return 'Épuisée';
    return 'En position';
  }
}

/* ============================================================
   Fortification : redoute, flèche, ouvrage défensif
   ============================================================ */
class Fort {
  constructor(def, side) {
    this.kind = 'fort';
    this.fid = def.id;
    this.id = 'F' + def.name;
    this.name = def.name;
    this.x = def.x; this.y = def.y; this.r = def.r || 28;
    this.maxHp = def.hp || 500; this.hp = this.maxHp;
    this.side = side;
    this.range = 230;
    this.dps = def.hp > 800 ? 9 : 7;
    this.fireCd = U.rand(0, 2);
    this.hitFlash = 0;
    this.alive = true;
  }
  update(dt, world) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (!this.alive) return;
    this.fireCd -= dt;
    if (this.fireCd > 0) return;
    let best = null, bd = this.range;
    for (const u of world.units) {
      if (u.side === this.side || !u.alive || !u.canFight()) continue;
      const d = U.dist(this.x, this.y, u.x, u.y) - u.def.radius;
      if (d < bd) { bd = d; best = u; }
    }
    if (best) {
      this.fireCd = 2.4;
      world.spawnShell(this, best, 8);
    }
  }
  get ratio() { return this.hp / this.maxHp; }
}