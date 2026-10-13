/* ============================================================
   combat.js — acquisition des cibles, tirs, dégâts, moral, auras
   ============================================================ */

/* ------------------------------------------------------------
   1. Auras : officiers, sous-officiers, Empereur, galvanisation
   ------------------------------------------------------------ */
function applyAuras(world) {
  const list = world.units;
  for (const u of list) {
    u.bAtk = 1; u.bDef = 1; u.bMor = 0; u.bRegen = 1; u.bMorMax = 0; u.inAura = false;
  }

  for (const a of list) {
    if (!a.alive || a.state === 'rout' || !a.def.auraR) continue;
    const r2 = a.def.auraR * a.def.auraR;
    for (const u of list) {
      if (u === a || u.side !== a.side) continue;
      if (U.dist2(a.x, a.y, u.x, u.y) > r2) continue;
      u.inAura = true;
      // les auras ne s'additionnent pas : la meilleure l'emporte
      u.auraAtk = Math.max(u.auraAtk || 0, a.def.auraAtk || 0);
      u.auraDef = Math.max(u.auraDef || 0, a.def.auraDef || 0);
      u.bMor += a.def.auraMoraleBonus || 0;
      u.bRegen += a.def.auraMoraleRegen || 0;
      u.bMorMax += a.def.auraMoraleBonus || 0;
    }
  }

  for (const u of list) {
    u.bAtk = 1 + (u.auraAtk || 0);
    u.bDef = 1 + (u.auraDef || 0);
  }

  // galvanisation : Présence impériale
  if (world.aura.active) {
    for (const u of list) {
      if (u.side !== 'fr') continue;
      u.bAtk *= 1.35;
      u.bRegen *= 1.5;
      u.bMorMax += 25;
    }
  }
}

/* ------------------------------------------------------------
   2. Acquisition des cibles
   ------------------------------------------------------------ */
function acquireTargets(world) {
  const list = world.units;

  // combien d'alliés visent déjà chaque cible : on évite le massacre en cascade
  const load = new Map();
  for (const u of list) {
    if (!u.alive || !u.target) continue;
    load.set(u.target.id, (load.get(u.target.id) || 0) + 1);
  }

  for (const u of list) {
    if (!u.alive || !u.canFight()) { u.target = null; u.targetFort = null; continue; }

    const aggro = u.def.aggro;
    let best = null, bd = Infinity, bestFree = null, bfd = Infinity;
    let bestFort = null, bfd2 = Infinity;

    for (const e of list) {
      if (e.side === u.side || !e.alive || e.state === 'rout') continue;
      const d = U.dist(u.x, u.y, e.x, e.y) - e.def.radius;
      const lim = Math.max(aggro, u.reach() + 10);
      if (d >= lim) continue;
      if (d < bd) { bd = d; best = e; }
      // une cible déjà attaquée par deux alliés est délaissée au profit d'une autre
      const n = load.get(e.id) || 0;
      if (n < 2 && d < bfd) { bfd = d; bestFree = e; }
    }
    if (bestFree) best = bestFree;

    for (const f of world.forts) {
      if (f.side === u.side || !f.alive) continue;
      const d = U.dist(u.x, u.y, f.x, f.y) - f.r;
      const lim = Math.max(aggro * 0.7, u.reach() + f.r);
      if (d < lim && d < bfd2) { bfd2 = d; bestFort = f; }
    }

    // artillerie : garde ses distances, ne sert pas à bout portant
    if (u.cls === 'ART') {
      const dT = best ? U.dist(u.x, u.y, best.x, best.y) : Infinity;
      if (dT < (u.def.minRange || 0)) {
        // trop près : elle se replie, sauf si un ouvrage est à portée de tir
        if (!(bestFort && U.dist(u.x, u.y, bestFort.x, bestFort.y) <= u.def.range)) {
          best = null; bestFort = null;
        }
      }
    }

    // sapeurs : préfèrent l'ouvrage fortifié
    if (u.cls === 'SAP' && bestFort && (!best || bfd < bd * 0.85)) {
      u.target = null; u.targetFort = bestFort; continue;
    }

    // officiers et sous-officiers : ils ne quittent pas leur ligne
    const fixed = (u.def.key === 'CMD' || u.def.key === 'NCO');
    const leash = fixed ? u.def.auraR + 60 : (u.order.type === 'hold' ? aggro * 0.8 : Infinity);

    if (best && leash !== Infinity) {
      if (U.dist(u.x, u.y, best.x, best.y) > leash + u.reach()) { best = null; }
    }
    if (bestFort && leash !== Infinity) {
      if (U.dist(u.x, u.y, bestFort.x, bestFort.y) > leash) { bestFort = null; }
    }

    u.target = best;
    u.targetFort = best ? null : bestFort;
    if (u.target) load.set(u.target.id, (load.get(u.target.id) || 0) + 1);
  }
}

/* ------------------------------------------------------------
   3. Résolution : artillerie à distance, choc au contact
   ------------------------------------------------------------ */
function resolveCombat(world, dt) {
  for (const u of world.units) {
    if (!u.alive || !u.canFight()) continue;
    u.fireCd -= dt;

    /* --------- artillerie --------- */
    if (u.def.key === 'ART') {
      const t = u.target;
      const f = (!t || u.fireCd > 0) ? u.targetFort : null;
      if (t && u.fireCd <= 0) {
        const d = U.dist(u.x, u.y, t.x, t.y);
        if (d >= (u.def.minRange || 0) && d <= u.def.range) {
          shoot(world, u, t, u.def.atk * u.quality.atk * moraleMod(u.morale, u.maxMorale) * u.bAtk);
          continue;
        }
      }
      if (f && u.fireCd <= 0 && U.dist(u.x, u.y, f.x, f.y) <= u.def.range) {
        shoot(world, u, f, u.def.atk * 0.8 * u.bAtk);
      }
      continue;
    }

    /* --------- choc contre une unité --------- */
    const t = u.target;
    if (t && t.alive && t.state !== 'rout') {
      if (U.dist(u.x, u.y, t.x, t.y) - t.def.radius <= u.reach()) {
        u.facing = Math.atan2(t.y - u.y, t.x - u.x);
        applyPressure(world, u, t, dt);
        continue;
      }
    }

    /* --------- choc contre un ouvrage --------- */
    const f = u.targetFort;
    if (f && f.alive && U.dist(u.x, u.y, f.x, f.y) - f.r <= u.reach()) {
      u.facing = Math.atan2(f.y - u.y, f.x - u.x);
      const bonus = (u.def.fort || 1) * moraleMod(u.morale, u.maxMorale) * u.bAtk;
      f.hp -= u.def.atk * bonus * dt * 1.1;
      f.hitFlash = 0.15;
      u.fatigue = Math.min(100, u.fatigue + dt * 1.1 * u.def.fatigue);
      if (U.chance(dt * 5)) {
        world.fx.spark(f.x + U.rand(-f.r, f.r), f.y + U.rand(-f.r * 0.6, f.r * 0.6));
        world.audio.impact(f.x, f.y);
      }
    }
  }

  for (const f of world.forts) f.update(dt, world);
}

function shoot(world, u, target, dmg) {
  u.fireCd = 1 / u.def.dps;
  u.facing = Math.atan2(target.y - u.y, target.x - u.x);
  world.spawnShell(u, target, dmg);
  world.audio.cannon(u.x, u.y);
  world.fx.muzzle(u.x + Math.cos(u.facing) * 15, u.y + Math.sin(u.facing) * 15, u.facing);
}

/* ------------------------------------------------------------
   4. Pression de combat : pertes, moral, ruptures
   ------------------------------------------------------------ */
function applyPressure(world, a, d, dt) {
  if (!d.alive || !a.canFight() || d.state === 'rout') return;

  const A = a.def;
  let atk = a.atk() * BAL.defAdvantage;   // attaquer coûte toujours plus cher que défendre
  let def = d.def2();

  // couvert du terrain
  const terr = world.map.terrainAt(d.x, d.y);
  def *= terr.cover;

  const cm = classMods(A.key, d.def.key);
  atk *= cm.atk;
  def *= cm.def;

  // unité de choc
  if (A.shock) atk *= A.shock;

  // charge de cavalerie : bonus de flanc
  if (a.chargeTimer > 0 && A.flank) atk *= A.flank * 1.15;

  const raw = atk / Math.max(4, def);
  // la courbe aplatit l'écart : un léger avantage ne suffit pas à tout décider
  const pressure = U.clamp(Math.pow(Math.max(0.01, raw), BAL.pressureExp), 0.05, 4);

  // pertes en hommes
  const frac = Math.min(0.5, BAL.casualtyK * pressure * dt);
  const menLost = d.men * frac;

  if (U.chance(frac * 70)) {
    world.fx.blood(d.x + U.rand(-9, 9), d.y + U.rand(-9, 9));
    world.audio.crackle();
  }

  d.hurt(menLost, frac * BAL.moraleCasK, a);
  a.fatigue = Math.min(100, a.fatigue + dt * 0.45 * A.fatigue);

  // moral
  const maxM = d.maxMorale + d.bMorMax;
  if (pressure > 1.02) {
    d.morale -= (pressure - 1.0) * BAL.pressureDrain * dt;
    // une unité déjà entamée peut entraîner ses voisins, mais lentement :
    // c'est ce qui rend une disforte de l'armée contagieuse.
    if (pressure > 2.0 && d.morale < maxM * 0.65) {
      const spread = (pressure - 2.0) * 4.5 * dt;
      for (const o of world.units) {
        if (o === d || o.side !== d.side || !o.alive || o.state === 'rout') continue;
        if (U.dist(d.x, d.y, o.x, o.y) < 115) o.morale -= spread;
      }
    }
  } else {
    // le moral se refait quand on n'est pas surchargé, sans jamais dépasser son plafond
    d.morale = Math.min(maxM, d.morale + (0.99 - pressure) * 4 * dt * (d.def.antiRout ? 1.4 : 1));
  }

  // un sous-officier dans le secteur retarde la rupture
  if (d.def.antiRout && d.inAura) d.morale = Math.min(maxM, d.morale + dt * 4);

  if (d.men <= 0 && a.side !== d.side) a.kills++;
}

/** modificateurs croisés entre classes */
function classMods(A, B) {
  const att = { INF: 1, CAV: 1, ART: 1, SAP: 1, CMD: 1, NCO: 1, EMP: 1 };
  const df = { INF: 1, CAV: 1, ART: 1, SAP: 1, CMD: 1, NCO: 1, EMP: 1 };

  if (A === 'CAV') { att.INF = 1.30; att.ART = 1.60; att.SAP = 0.80; }
  if (A === 'SAP') { att.INF = 1.15; att.ART = 1.45; df.CAV = 1.25; }
  if (A === 'INF') { df.CAV = 0.92; df.ART = 1.15; }
  if (A === 'CMD' || A === 'NCO') { att.ART = 1.25; att.INF = 0.95; }

  if (B === 'CAV') { df.INF = 0.80; df.ART = 1.35; }
  if (B === 'ART') { df.INF = 1.20; df.ART = 0.80; }
  if (B === 'CMD' || B === 'NCO') { att.ART = 1.45; att.INF = 0.90; }
  if (B === 'EMP') { df.INF = 1.25; df.CAV = 1.25; df.ART = 1.25; df.SAP = 1.25; df.CMD = 1.25; df.NCO = 1.25; }

  return { atk: att[A], def: df[B] };
}

/* ------------------------------------------------------------
   5. Entretien : moral hors combat, séparation, nettoyage
   ------------------------------------------------------------ */
function updateUpkeep(world, dt) {
  const list = world.units;

  for (const u of list) {
    if (!u.alive || u.state === 'rout') continue;
    const engaged = u.target && U.dist(u.x, u.y, u.target.x, u.target.y) < u.reach() + 20;
    if (!engaged) {
      const regen = u.def.regen * u.quality.regen * u.bRegen * (u.inAura ? 1.12 : 1);
      const max = u.maxMorale + u.bMorMax;
      u.morale = Math.min(max, u.morale + regen * dt);
    }
    u.fatigue = Math.max(0, u.fatigue - dt * 1.6);
  }

  // séparation des corps
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive || a.kind !== 'unit') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive || b.kind !== 'unit') continue;
      const min = a.def.radius + b.def.radius;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.001) {
        const push = (min - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }

  // aucune unité ne doit sortir du champ de bataille
  const m = world.map;
  for (const u of list) {
    if (u.x < 4 || u.y < 4 || u.x > m.w - 4 || u.y > m.h - 4) {
      const c = m.clampPoint(u.x, u.y);
      u.x = c.x; u.y = c.y;
    }
  }

  world.reap();
}

/* ------------------------------------------------------------
   6. Projectiles
   ------------------------------------------------------------ */
function updateShells(world, dt) {
  for (let i = world.shells.length - 1; i >= 0; i--) {
    const s = world.shells[i];
    const tgt = s.target;

    if (!tgt || !tgt.alive) { world.shells.splice(i, 1); continue; }

    const tx = tgt.x, ty = tgt.y;
    const rad = tgt.kind === 'fort' ? tgt.r : tgt.def.radius;
    const d = U.dist(s.x, s.y, tx, ty);

    s.facing = Math.atan2(ty - s.y, tx - s.x);
    if (d <= s.speed * dt + rad * 0.5) {
      impact(world, s, tx, ty);
      world.shells.splice(i, 1);
      continue;
    }
    s.x += (tx - s.x) / d * s.speed * dt;
    s.y += (ty - s.y) / d * s.speed * dt;
  }
}

function impact(world, s, x, y) {
  const from = s.from;
  const dmg = s.dmg;
  const splash = s.splash || 0;

  world.fx.explosion(x, y, Math.max(9, splash * 0.65));
  world.audio.impact(x, y);

  if (splash > 0) {
    // le tir direct : l'obus frappe la cible, l'éclatement effleure les voisins
    if (s.target && s.target.alive && s.target.kind !== 'fort') {
      s.target.hurt(dmg * 0.16, 0.9, from);
    }
    for (const u of world.units) {
      if (!u.alive || u.side === from.side || u.state === 'rout') continue;
      if (u === s.target) continue;
      const d = U.dist(x, y, u.x, u.y);
      if (d <= splash + u.def.radius) {
        const f = 1 - U.clamp((d - splash * 0.3) / splash, 0, 1);
        u.hurt(dmg * 0.13 * f, 0.5 * f, from);
      }
    }
    for (const f of world.forts) {
      if (!f.alive || f.side === from.side) continue;
      if (U.dist(x, y, f.x, f.y) <= splash + f.r) { f.hp -= dmg * 0.4; f.hitFlash = 0.2; }
    }
  } else if (s.target && s.target.alive) {
    if (s.target.kind === 'fort') { s.target.hp -= dmg; s.target.hitFlash = 0.2; }
    else s.target.hurt(dmg * 0.5, 0.7, from);
  }
}