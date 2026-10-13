/* ============================================================
   ai.js — commandement ennemi : rôles, manœuvres, ripostes
   ============================================================ */

class Commander {
  constructor(world, side, camp) {
    this.world = world;
    this.side = side;
    this.camp = camp;             // données de la campagne
    this.think = 0;
    this.phase = 'attack';        // attack | defend
    this.flankSide = 1;           // 1 = sud, -1 = nord
    this.flankTimer = 0;
  }

  centroid(list) {
    let x = 0, y = 0, n = 0;
    for (const u of list) if (u.alive && u.state !== 'rout') { x += u.x; y += u.y; n++; }
    return n ? { x: x / n, y: y / n, n } : { x: 0, y: 0, n: 0 };
  }

  unitsOf(side) { return this.world.units.filter((u) => u.side === side && u.alive && u.state !== 'rout'); }

  update(dt) {
    this.think -= dt;
    this.flankTimer -= dt;
    if (this.think > 0) return;
    this.think = 1.6;

    const mine = this.unitsOf(this.side);
    if (!mine.length) return;
    const foe = this.unitsOf(this.side === 'fr' ? 'en' : 'fr');
    if (!foe.length) return;

    const myC = this.centroid(mine);
    const foeC = this.centroid(foe);

    /* --- orientation de l'effort : axe entre les deux armées --- */
    let dirX = foeC.x - myC.x;
    let dirY = foeC.y - myC.y;
    const nAxis = Math.hypot(dirX, dirY) || 1;
    dirX /= nAxis; dirY /= nAxis;

    // on alterne le flanc privilégié toutes les ~40 s
    if (this.flankTimer <= 0) { this.flankSide *= -1; this.flankTimer = 40; }

    /* --- bascule en défensive si l'armée est mal en point --- */
    const str = this.strength(mine), strF = this.strength(foe);
    this.phase = str < strF * 0.55 ? 'defend' : 'attack';

    this.assignWaves(mine);

    for (const u of mine) {
      if (u.order && u.order.manual) continue;      // ordre donné par un joueur adverse : on respecte
      const D = u.def;

      // ---------- officiers et sous-officiers : restent au centre ----------
      if (D.key === 'CMD' || D.key === 'NCO') {
        const home = this.camp.deploy[this.side === 'fr' ? 'fr' : 'en'];
        const tx = U.lerp(myC.x, home.x + home.w / 2, 0.35);
        const ty = U.lerp(myC.y, home.y + home.h / 2, 0.35);
        this.goto(u, tx, ty);
        continue;
      }

      // ---------- l'Empereur reste au centre des feux ----------
      if (D.imperial) {
        this.goto(u, myC.x - dirX * 120, myC.y - dirY * 120);
        continue;
      }

      // ---------- artillerie : en batterie, en arrière ----------
      if (D.key === 'ART') {
        const bk = 200;
        const tx = myC.x - dirX * bk + dirY * this.flankSide * 90;
        const ty = myC.y - dirY * bk - dirX * this.flankSide * 90;
        const near = this.nearestEnemy(u, 520);
        if (near && U.dist(u.x, u.y, near.x, near.y) > (D.range || 300) * 0.72) {
          this.goto(u, near.x - dirX * (D.range || 300) * 0.55, near.y - dirY * (D.range || 300) * 0.55);
        } else {
          this.hold(u, tx, ty);
        }
        continue;
      }

      // ---------- cavalerie : charge sur le flanc opposé, ou percée ----------
      if (D.key === 'CAV') {
        const mark = this.findFlankTarget(foe, dirX, dirY);
        if (mark) {
          const d = U.dist(u.x, u.y, mark.x, mark.y);
          if (d < (D.chargeRange || 160)) {
            u.setOrder('charge', mark.x, mark.y);
          } else {
            this.goto(u, mark.x - dirX * 40, mark.y - dirY * 40);
          }
        } else if (this.phase === 'attack') {
          this.goto(u, foeC.x - dirX * 200, foeC.y - dirY * 200);
        } else {
          this.hold(u, myC.x - dirX * 140, myC.y - dirY * 140);
        }
        continue;
      }

      // ---------- sapeurs : au travail sur les ouvrages ----------
      if (D.key === 'SAP') {
        const fort = this.nearestEnemyFort(u, 900);
        if (fort && this.phase !== 'defend') {
          this.goto(u, fort.x, fort.y);
          if (U.dist(u.x, u.y, fort.x, fort.y) < u.reach() + fort.r + 6) u.setOrder('hold', u.x, u.y);
        } else {
          this.goto(u, foeC.x - dirX * 260, foeC.y - dirY * 260);
        }
        continue;
      }

      // ---------- infanterie : on avance par échelons ----------
      const near = this.nearestEnemy(u, 520);
      if (!u.aiCommitted && near && U.dist(u.x, u.y, near.x, near.y) <= u.reach() + 10) u.aiCommitted = true;
      const lateral = dirY * this.flankSide * 40 * (U.dist(u.x, u.y, myC.x, myC.y) / 400);

      if (!u.aiReady) {
        // unité de seconde vague : elle tient sa position
        this.hold(u, u.x, u.y);
      } else if (this.phase === 'defend') {
        const tx = myC.x + dirX * 160 + lateral, ty = myC.y + dirY * 160 + lateral;
        if (near && U.dist(u.x, u.y, near.x, near.y) < u.reach() + 10) u.setOrder('hold', u.x, u.y);
        else this.goto(u, tx, ty);
      } else if (near) {
        if (U.dist(u.x, u.y, near.x, near.y) <= u.reach() + 6) {
          u.setOrder('hold', u.x, u.y);
        } else {
          this.goto(u, near.x, near.y);
        }
      } else {
        this.goto(u, foeC.x - dirX * 200, foeC.y - dirY * 200);
      }
    }
  }

  /** répartit l'infanterie en vagues successives plutôt qu'un assaut d'un bloc */
  assignWaves(mine) {
    const line = mine.filter((u) => u.cls === 'INF' || u.cls === 'SAP');
    if (!line.length) return;
    for (const u of line) {
      if (!u.aiReady) u.aiReady = true;
      if (!u.aiCommitted) u.aiCommitted = false;
    }
    // les unités déjà au contact restent engagées, les autres arrivent par vagues
    const fresh = line.filter((u) => !u.aiCommitted);
    const already = line.length - fresh.length;
    let quota = Math.max(2, Math.ceil(fresh.length * 0.62) + already);
    for (const u of fresh) {
      if (quota > 0) { u.aiReady = true; quota--; }
      else u.aiReady = false;
    }
  }

  strength(list) {
    let s = 0;
    for (const u of list) s += u.men * (u.cls === 'CAV' ? 1.25 : u.cls === 'ART' ? 0.8 : 1) * moraleMod(u.morale, u.maxMorale);
    return s;
  }

  nearestEnemy(u, maxD) {
    let best = null, bd = maxD;
    for (const e of this.unitsOf(u.side === 'fr' ? 'en' : 'fr')) {
      const d = U.dist(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  nearestEnemyFort(u, maxD) {
    let best = null, bd = maxD;
    for (const f of this.world.forts) {
      if (!f.alive || f.side === u.side) continue;
      const d = U.dist(u.x, u.y, f.x, f.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  /** cherche une cible exposée sur le flanc opposé à l'axe d'attaque */
  findFlankTarget(foe, dirX, dirY) {
    let best = null, bs = 0.5;
    for (const e of foe) {
      if (e.cls === 'CMD' || e.cls === 'EMP') continue;
      // score : éloignement de l'axe d'effort, faiblesse, vulnérabilité de la classe
      const perp = Math.abs(e.x * dirY - e.y * dirX);
      const weak = (1 - e.ratio) * 0.8 + (1 - e.morale / Math.max(1, e.maxMorale)) * 0.6;
      const vuln = (e.cls === 'ART' ? 1.1 : e.cls === 'INF' ? 0.85 : 0.5);
      const score = perp * 0.0016 + weak * 0.9 + vuln;
      if (score > bs) { bs = score; best = e; }
    }
    return best;
  }

  goto(u, x, y) {
    const p = this.world.map.nearestFree(x, y, u.cls, 200);
    if (U.dist(u.x, u.y, p.x, p.y) > 26) u.setOrder('move', p.x, p.y);
    else u.setOrder('hold', u.x, u.y);
  }

  hold(u, x, y) {
    if (U.dist(u.x, u.y, x, y) < 60) u.setOrder('hold', u.x, u.y);
    else this.goto(u, x, y);
  }
}