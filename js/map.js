/* ============================================================
   map.js — carte du champ de bataille
   Une carte est une liste de « features » : terrain, murs, rivières,
   routes, ponts, villages, fortifications. Tout est modifiable en
   direct, ce qui permet l'éditeur du bac à sable.
   ============================================================ */

const CELL = 140;                 // taille d'une case de l'index spatial
const PRIORITY = { water: 100, river: 92, bridge: 80, road: 70, patch: 60, wall: 55 };

class GameMap {
  constructor(def) {
    this.def = def;
    this.w = def.w || 1440;
    this.h = def.h || 900;
    this.features = [];
    this.grid = new Map();
    this.zc = 0;
    this.cache = null;
    this.objectives = def.objectives || [];
    this.loadFeatures(def);
    this.rebuild();
  }

  /* ---------------- chargement ---------------- */

  loadFeatures(def) {
    const add = (f) => {
      if (f.id === undefined) f.id = 'ft' + (this.fid = (this.fid || 0) + 1);
      f._z = this.zc++;
      this.features.push(f);
      this.indexFeature(f);
      return f;
    };
    (def.water || []).forEach((poly) => add({ type: 'water', poly }));
    (def.rivers || []).forEach((r) => add({ type: 'river', pts: r.pts, w: r.w || 12 }));
    (def.roads || []).forEach((r) => add({ type: 'road', pts: r.pts, w: r.w || 7 }));
    (def.walls || []).forEach((r) => add({ type: 'wall', pts: r.pts, w: r.w || 14 }));
    (def.bridges || []).forEach((b) => add({ type: 'bridge', x: b.x, y: b.y }));
    (def.terrain || []).forEach((t) => add(Object.assign({ type: 'patch' }, t)));
    (def.towns || []).forEach((t) => add({ type: 'town', x: t.x, y: t.y, size: t.size || 12, name: t.name || '' }));
    (def.forts || []).forEach((f) => add({
      type: 'fort', x: f.x, y: f.y, r: f.r || 28, name: f.name || 'Redoute',
      hp: f.hp || 500, side: f.side || 'en', id: f.id,
    }));
  }

  /* ---------------- index spatial ---------------- */

  bboxOf(f) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const P = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    if (f.type === 'water') f.poly.forEach((p) => P(p[0], p[1]));
    else if (f.poly) f.poly.forEach((p) => P(p[0], p[1]));
    else if (f.pts) {
      const m = (f.w || 12) + 4;
      f.pts.forEach((p) => P(p[0] - m, p[1] - m));
      f.pts.forEach((p) => P(p[0] + m, p[1] + m));
    } else if (f.type === 'patch') {
      if (f.shape === 'r') { P(f.x, f.y); P(f.x + f.w, f.y + f.h); }
      else { P(f.x - f.rx, f.y - f.ry); P(f.x + f.rx, f.y + f.ry); }
    } else if (f.type === 'bridge') { P(f.x - 50, f.y - 50); P(f.x + 50, f.y + 50); }
    else if (f.type === 'town') { P(f.x - 46, f.y - 46); P(f.x + 46, f.y + 46); }
    else if (f.type === 'fort') { P(f.x - f.r * 1.4, f.y - f.r); P(f.x + f.r * 1.4, f.y + f.r); }
    return { x0, y0, x1, y1 };
  }

  indexFeature(f) {
    const b = f.__b || (f.__b = this.bboxOf(f));
    const c0x = Math.floor(b.x0 / CELL), c1x = Math.floor(b.x1 / CELL);
    const c0y = Math.floor(b.y0 / CELL), c1y = Math.floor(b.y1 / CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const k = cx + ',' + cy;
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(f);
      }
    }
  }

  query(x, y, pad = 0) {
    const out = [];
    const c0x = Math.floor((x - pad) / CELL), c1x = Math.floor((x + pad) / CELL);
    const c0y = Math.floor((y - pad) / CELL), c1y = Math.floor((y + pad) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const arr = this.grid.get(cx + ',' + cy);
        if (!arr) continue;
        for (const f of arr) if (out.indexOf(f) < 0) out.push(f);
      }
    }
    return out;
  }

  /* ---------------- édition ---------------- */

  /** ajoute une feature, l'indexe et la dessine immédiatement sur le cache */
  addFeature(f) {
    if (f.id === undefined) f.id = 'ft' + (this.fid = (this.fid || 0) + 1);
    f._z = this.zc++;
    this.features.push(f);
    this.indexFeature(f);
    if (this.cache) this.paintFeature(f);
    return f;
  }

  /** supprime une feature et reconstruit le cache */
  removeFeature(f) {
    const i = this.features.indexOf(f);
    if (i >= 0) this.features.splice(i, 1);
    this.rebuild();
  }

  /** supprime la feature (hors terrain) la plus proche du point */
  removeFeatureAt(x, y, types, radius) {
    let best = null, bd = radius;
    for (const f of this.query(x, y, radius)) {
      if (types.indexOf(f.type) < 0) continue;
      const d = this.featureDist(f, x, y);
      if (d < bd) { bd = d; best = f; }
    }
    if (best) { this.removeFeature(best); return best; }
    return null;
  }

  /** distance du point à une feature (0 = dedans) */
  featureDist(f, x, y) {
    switch (f.type) {
      case 'wall': case 'river': case 'road': return this.polyDist(x, y, f.pts);
      case 'patch':
        if (f.shape === 'r') return U.inRect(x, y, f) ? 0 : Math.hypot(
          Math.max(f.x - x, 0, x - (f.x + f.w)), Math.max(f.y - y, 0, y - (f.y + f.h)));
        {
          const e = Math.hypot((x - f.x) / f.rx, (y - f.y) / f.ry);
          return (e - 1) * Math.min(f.rx, f.ry);
        }
      case 'fort': return Math.max(0, U.dist(x, y, f.x, f.y) - f.r);
      case 'town': return Math.max(0, U.dist(x, y, f.x, f.y) - 34);
      case 'bridge': return Math.max(0, U.dist(x, y, f.x, f.y) - 32);
      default: return Infinity;
    }
  }

  /* ---------------- requêtes ---------------- */

  isWater(x, y) {
    for (const f of this.query(x, y)) if (f.type === 'water' && U.inPoly(x, y, f.poly)) return true;
    return false;
  }

  polyDist(x, y, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = U.segDist2(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  lineDist(x, y, type) {
    let best = Infinity;
    for (const f of this.query(x, y, 8)) {
      if (f.type !== type) continue;
      const d = this.polyDist(x, y, f.pts) - (f.w || 0) / 2;
      if (d < best) best = d;
    }
    return best;
  }

  riverDist(x, y) { return this.lineDist(x, y, 'river'); }
  roadDist(x, y) { return this.lineDist(x, y, 'road'); }
  /** distance au bord du mur le plus proche (0 = dans le mur) */
  wallDist(x, y) { return this.lineDist(x, y, 'wall'); }

  onBridge(x, y) {
    for (const f of this.query(x, y, 50)) if (f.type === 'bridge' && U.dist(x, y, f.x, f.y) < 46) return true;
    return false;
  }

  /** le morceau de terrain peint le plus récemment couvre tous les autres */
  patchAt(x, y) {
    let best = null, bz = -1;
    for (const f of this.query(x, y)) {
      if (f.type !== 'patch') continue;
      const hit = f.shape === 'r' ? U.inRect(x, y, f) : U.inEllipse(x, y, f);
      if (hit && f._z > bz) { bz = f._z; best = f; }
    }
    return best;
  }

  terrainAt(x, y) {
    if (this.isWater(x, y)) return { key: 'water', speed: 0, cover: 1 };

    // un mur protège et ralentit légèrement celui qui s'y appuie
    if (this.wallDist(x, y) < 15) return { key: 'wall', speed: 0.9, cover: 1.35 };

    const bridge = this.onBridge(x, y);
    const rd = this.roadDist(x, y);
    if (rd < 7 && !bridge) return { key: 'road', speed: TERRAIN.road.speed, cover: TERRAIN.road.cover };

    const p = this.patchAt(x, y);
    if (p) {
      const t = TERRAIN[p.kind];
      let speed = t.speed;
      if (p.kind === 'forest' && rd < 14) speed *= 1.15;
      return { key: p.kind, speed, cover: t.cover };
    }
    if (this.riverDist(x, y) < 6) return { key: 'river', speed: TERRAIN.river.speed, cover: TERRAIN.river.cover };
    return { key: 'plain', speed: TERRAIN.plain.speed, cover: TERRAIN.plain.cover };
  }

  canStand(x, y, cls) {
    if (this.isWater(x, y)) return false;
    if (this.wallDist(x, y) < 5) return false;
    if (this.riverDist(x, y) < 4) {
      // artillerie et cavalerie : passage interdit hors des ponts
      if ((cls === 'ART' || cls === 'CAV') && !this.onBridge(x, y)) return false;
    }
    return true;
  }

  unitSpeedAt(x, y, cls, base) {
    const t = this.terrainAt(x, y);
    let s = base * t.speed;
    if (t.key === 'river' && !this.onBridge(x, y)) s = base * (cls === 'SAP' ? 0.62 : 0.30);
    if (this.onBridge(x, y)) s *= cls === 'SAP' ? 1.6 : 1.0;
    if (t.key === 'forest') s *= cls === 'SAP' ? 1.25 : 1.0;
    if (t.key === 'wall') s *= cls === 'SAP' ? 1.3 : 1.0;
    return s;
  }

  /* ---------------- placement ---------------- */

  clampPoint(x, y) {
    return { x: U.clamp(x, 8, this.w - 8), y: U.clamp(y, 8, this.h - 8) };
  }

  nearestFree(x, y, cls, maxR = 260) {
    const c = this.clampPoint(x, y);
    if (this.canStand(c.x, c.y, cls)) return c;
    for (let r = 14; r <= maxR; r += 14) {
      const steps = 12 + Math.floor(r / 5);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2 + r;
        const nx = c.x + Math.cos(a) * r, ny = c.y + Math.sin(a) * r;
        if (nx < 16 || ny < 16 || nx > this.w - 16 || ny > this.h - 16) continue;
        if (this.canStand(nx, ny, cls)) return { x: nx, y: ny };
      }
    }
    return c;
  }

  nearestFreeInZone(x, y, cls, zone, maxR = 220) {
    const inner = { x: zone.x + 8, y: zone.y + 8, w: Math.max(1, zone.w - 16), h: Math.max(1, zone.h - 16) };
    if (U.inRect(x, y, inner) && this.canStand(x, y, cls)) return { x, y };
    for (let r = 12; r <= maxR; r += 12) {
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 + r * 0.3;
        const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
        if (!U.inRect(nx, ny, inner)) continue;
        if (this.canStand(nx, ny, cls)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  /* ---------------- rendu ---------------- */

  rebuild() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    U.srand(this.def.seed || 42);

    g.fillStyle = '#a9bf6a';
    g.fillRect(0, 0, this.w, this.h);
    for (let i = 0; i < 220; i++) {
      const x = U.rand(this.w), y = U.rand(this.h);
      const r = U.rand(40, 190);
      g.globalAlpha = U.rand(0.03, 0.09);
      g.fillStyle = U.chance(0.5) ? '#8fa755' : '#bccf7c';
      g.beginPath(); g.ellipse(x, y, r, r * U.rand(0.5, 0.85), U.rand(0, 3.14), 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;

    for (const f of this.features) this.paintFeature(f, g);

    g.strokeStyle = 'rgba(40,32,14,0.5)'; g.lineWidth = 6;
    g.strokeRect(3, 3, this.w - 6, this.h - 6);

    this.cache = c;
  }

  /** dessine une feature (sur le cache complet si g n'est pas fourni) */
  paintFeature(f, g) {
    if (!g) g = this.cache.getContext('2d');
    switch (f.type) {
      case 'patch': this._patch(g, f); break;
      case 'water': this._water(g, f); break;
      case 'river': this._stroke(g, f.pts, f.w + 5, '#9ab27a'), this._stroke(g, f.pts, f.w, '#4a86c8'), this._stroke(g, f.pts, f.w * 0.35, '#7fb4e6'); break;
      case 'road': this._stroke(g, f.pts, f.w, '#c2ab7e'), this._stroke(g, f.pts, f.w * 0.42, '#ddc79a'); break;
      case 'wall': this._wall(g, f); break;
      case 'bridge': this._bridge(g, f); break;
      case 'town': this._village(g, f.x, f.y, f.size); break;
      case 'fort': this._fort(g, f); break;
    }
  }

  _patch(g, f) {
    const col = TERRAIN[f.kind] ? TERRAIN[f.kind].color : '#a9bf6a';
    g.save();
    g.beginPath();
    if (f.shape === 'r') {
      const j = 16;
      g.moveTo(f.x, f.y);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * 6.2832;
        const rx = f.w / 2, ry = f.h / 2;
        g.lineTo(f.x + rx + Math.cos(ang) * rx + U.rand(-j, j),
                 f.y + ry + Math.sin(ang) * ry + U.rand(-j, j));
      }
      g.closePath();
    } else {
      g.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 6.2832);
    }
    g.fillStyle = col; g.fill();
    g.globalAlpha = 0.5; g.lineWidth = 2;
    g.strokeStyle = U.mix(col, '#000000', 0.18); g.stroke();
    g.restore();

    // détails
    if (f.kind === 'forest') {
      g.save();
      g.beginPath();
      if (f.shape === 'r') g.rect(f.x, f.y, f.w, f.h); else g.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 6.2832);
      g.clip();
      const count = f.shape === 'r' ? Math.floor(f.w * f.h / 210) : Math.floor(f.rx * f.ry / 130);
      for (let i = 0; i < count; i++) {
        const x = f.shape === 'r' ? U.rand(f.x, f.x + f.w) : f.x + U.rand(-f.rx, f.rx);
        const y = f.shape === 'r' ? U.rand(f.y, f.y + f.h) : f.y + U.rand(-f.ry, f.ry);
        const r = U.rand(5, 9.5);
        g.fillStyle = 'rgba(22,52,16,0.30)';
        g.beginPath(); g.ellipse(x + 2, y + 3, r, r * 0.8, 0, 0, 6.2832); g.fill();
        g.fillStyle = U.pick(['#3e6b2a', '#4a7a30', '#375f24', '#51833a']);
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }
      g.restore();
    } else if (f.kind === 'hill') {
      g.save();
      g.beginPath();
      if (f.shape === 'r') g.rect(f.x, f.y, f.w, f.h); else g.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 6.2832);
      g.clip();
      g.strokeStyle = 'rgba(120,105,50,0.35)'; g.lineWidth = 1.6;
      const cx = f.shape === 'r' ? f.x + f.w / 2 : f.x;
      const cy = f.shape === 'r' ? f.y + f.h / 2 : f.y;
      for (let k = 1; k <= 4; k++) {
        g.beginPath();
        const s = k / 4.4;
        g.ellipse(cx, cy, (f.w || f.rx * 2) / 2 * s, (f.h || f.ry * 2) / 2 * s, 0, 0, 6.2832);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,210,0.13)';
      g.beginPath(); g.ellipse(cx, cy - 6, (f.w || f.rx * 2) / 3, (f.h || f.ry * 2) / 3, 0, 0, 6.2832); g.fill();
      g.restore();
    } else if (f.kind === 'marsh') {
      g.save();
      g.beginPath();
      if (f.shape === 'r') g.rect(f.x, f.y, f.w, f.h); else g.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, 6.2832);
      g.clip();
      g.strokeStyle = 'rgba(90,120,140,0.4)'; g.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const x = f.shape === 'r' ? U.rand(f.x, f.x + f.w) : f.x + U.rand(-f.rx, f.rx);
        const y = f.shape === 'r' ? U.rand(f.y, f.y + f.h) : f.y + U.rand(-f.ry, f.ry);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + U.rand(-9, 9), y + U.rand(-5, 5)); g.stroke();
      }
      g.restore();
    } else if (f.kind === 'village') {
      const cx = f.shape === 'r' ? f.x + f.w / 2 : f.x;
      const cy = f.shape === 'r' ? f.y + f.h / 2 : f.y;
      const n = f.shape === 'r' ? Math.floor(f.w * f.h / 900) : 10;
      for (let i = 0; i < n; i++) {
        const x = f.shape === 'r' ? U.rand(f.x + 6, f.x + f.w - 6) : cx + U.rand(-(f.rx || 60) * 0.8, (f.rx || 60) * 0.8);
        const y = f.shape === 'r' ? U.rand(f.y + 6, f.y + f.h - 6) : cy + U.rand(-(f.ry || 60) * 0.8, (f.ry || 60) * 0.8);
        this._house(g, x, y, U.rand(0, Math.PI));
      }
    }
  }

  _water(g, f) {
    g.beginPath();
    g.moveTo(f.poly[0][0], f.poly[0][1]);
    for (let i = 1; i < f.poly.length; i++) g.lineTo(f.poly[i][0], f.poly[i][1]);
    g.closePath();
    g.fillStyle = '#3f72ad'; g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.ellipse(U.rand(this.w), U.rand(this.h), U.rand(20, 90), U.rand(6, 20), U.rand(-0.4, 0.4), 0, 6.2832);
      g.fill();
    }
    g.restore();
    g.lineWidth = 4; g.strokeStyle = '#c9cf94'; g.stroke();
  }

  _wall(g, f) {
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    // ombre portée
    this._stroke(g, f.pts.map((p) => [p[0] + 2, p[1] + 3]), f.w, 'rgba(0,0,0,0.3)');
    // corps du mur
    this._stroke(g, f.pts, f.w, '#7a6a4a');
    this._stroke(g, f.pts, f.w - 4, '#a4916a');
    // créneaux
    g.fillStyle = 'rgba(60,48,26,0.5)';
    for (let i = 0; i < f.pts.length - 1; i++) {
      const a = f.pts[i], b = f.pts[i + 1];
      const len = U.dist(a[0], a[1], b[0], b[1]);
      const steps = Math.floor(len / 16);
      for (let k = 0; k <= steps; k++) {
        const t = k / Math.max(1, steps);
        const x = U.lerp(a[0], b[0], t), y = U.lerp(a[1], b[1], t);
        g.beginPath(); g.arc(x, y, (f.w - 6) / 2, 0, 6.2832); g.fill();
      }
    }
    g.restore();
  }

  _bridge(g, f) {
    g.save();
    g.translate(f.x, f.y);
    g.fillStyle = '#7a5c36'; g.fillRect(-30, -10, 60, 20);
    g.fillStyle = '#9c7845';
    for (let i = -26; i <= 22; i += 8) g.fillRect(i, -10, 5, 20);
    g.strokeStyle = '#4a3520'; g.lineWidth = 2; g.strokeRect(-30, -10, 60, 20);
    g.restore();
  }

  _fort(g, f) {
    g.save();
    g.translate(f.x, f.y);
    g.fillStyle = 'rgba(120,105,60,0.9)';
    g.beginPath(); g.ellipse(0, 0, f.r * 1.25, f.r * 0.85, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#6d5f33'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, f.r * 1.25, f.r * 0.85, 0, 0, 6.2832); g.stroke();
    g.fillStyle = '#8d7a49';
    const n = Math.max(6, Math.round(f.r / 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832;
      g.save();
      g.translate(Math.cos(a) * f.r, Math.sin(a) * f.r * 0.68);
      g.rotate(a);
      g.beginPath(); g.moveTo(-5, -7); g.lineTo(5, -7); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
  }

  _stroke(g, pts, width, color) {
    if (!pts || pts.length < 2) return;
    g.save();
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.restore();
  }

  _village(g, x, y, size) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.2832;
      this._house(g, x + Math.cos(a) * size * U.rand(0.4, 1.5), y + Math.sin(a) * size * U.rand(0.4, 1.5), U.rand(0, 3.14));
    }
    g.fillStyle = 'rgba(60,45,20,0.55)';
    g.beginPath(); g.arc(x, y, 3.5, 0, 6.2832); g.fill();
  }

  _house(g, x, y, rot) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(40,32,18,0.3)';
    g.fillRect(-5, -3, 12, 9);
    g.fillStyle = '#ded1b4'; g.fillRect(-6, -4, 11, 8);
    g.fillStyle = '#8c5a3a';
    g.beginPath(); g.moveTo(-7, -4); g.lineTo(6, -4); g.lineTo(-0.5, -10); g.closePath(); g.fill();
    g.restore();
  }

  /* ---------------- utilitaires d'édition ---------------- */

  static circlePoly(cx, cy, r, n = 12) {
    const poly = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832;
      poly.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return poly;
  }

  draw(ctx) { ctx.drawImage(this.cache, 0, 0); }

  /** pousse les unités hors d'un obstacle afin qu'elles ne restent pas coincées */
  pushOut(units, cls) {
    for (const u of units) {
      if (u.alive && !this.canStand(u.x, u.y, cls)) {
        const p = this.nearestFree(u.x, u.y, cls, 320);
        u.x = p.x; u.y = p.y;
      }
    }
  }
}