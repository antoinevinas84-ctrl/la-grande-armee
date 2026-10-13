/* ============================================================
   map.js — carte du champ de bataille : rendu, terrain, déplacements
   ============================================================ */

class GameMap {
  constructor(def) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
    this.water = def.water || [];
    this.rivers = def.rivers || [];
    this.bridges = def.bridges || [];
    this.roads = def.roads || [];
    this.patches = def.terrain || [];
    this.towns = def.towns || [];
    this.forts = def.forts || [];
    this.objectives = def.objectives || [];
    this.cache = null;
    this.build();
  }

  /* ---------------- requêtes ---------------- */

  isWater(x, y) {
    for (const poly of this.water) if (U.inPoly(x, y, poly)) return true;
    return false;
  }

  /** distance au centre d'une rivière (les ponts comptent aussi) */
  riverDist(x, y) {
    let best = Infinity;
    for (const r of this.rivers) {
      const p = r.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const d = U.segDist2(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  onBridge(x, y) {
    for (const b of this.bridges) if (U.dist(x, y, b.x, b.y) < 46) return true;
    return false;
  }

  roadDist(x, y) {
    let best = Infinity;
    for (const r of this.roads) {
      const p = r.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const d = U.segDist2(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  }

  patchAt(x, y) {
    let best = null, bestArea = Infinity;
    for (const t of this.patches) {
      const hit = t.shape === 'r' ? U.inRect(x, y, t) : U.inEllipse(x, y, t);
      if (hit) {
        const area = t.shape === 'r' ? t.w * t.h : t.rx * t.ry;
        if (area < bestArea) { bestArea = area; best = t; }   // le plus petit gagne
      }
    }
    return best;
  }

  /** renvoie { key, speed, cover } du terrain en (x,y) */
  terrainAt(x, y) {
    if (this.isWater(x, y)) return { key: 'water', speed: 0, cover: 1 };

    const bridge = this.onBridge(x, y);
    const rd = this.roadDist(x, y);
    if (rd < 7 && !bridge) return { key: 'road', speed: TERRAIN.road.speed, cover: TERRAIN.road.cover };

    const p = this.patchAt(x, y);
    if (p) {
      const t = TERRAIN[p.kind];
      let speed = t.speed;
      if (p.kind === 'forest' && this.roadDist(x, y) < 14) speed *= 1.15;
      return { key: p.kind, speed, cover: t.cover };
    }
    if (this.riverDist(x, y) < 6) return { key: 'river', speed: TERRAIN.river.speed, cover: TERRAIN.river.cover };
    return { key: 'plain', speed: TERRAIN.plain.speed, cover: TERRAIN.plain.cover };
  }

  /** une unité peut-elle se trouver ici ? */
  canStand(x, y, cls) {
    if (this.isWater(x, y)) return false;
    const t = this.terrainAt(x, y);
    if (t.key === 'river') {
      // artillerie et cavalerie : passage interdit hors des ponts
      if ((cls === 'ART' || cls === 'CAV') && !this.onBridge(x, y)) return false;
      if (cls === 'SAP') return true;
      if (cls === 'INF' || cls === 'CMD' || cls === 'NCO' || cls === 'EMP') return true;
    }
    return true;
  }

  /** vitesse effective d'une unité en (x,y) */
  unitSpeedAt(x, y, cls, base) {
    const t = this.terrainAt(x, y);
    let s = base * t.speed;
    if (t.key === 'river' && !this.onBridge(x, y)) {
      s = base * (cls === 'SAP' ? 0.62 : 0.30);
    }
    if (this.onBridge(x, y)) s *= cls === 'SAP' ? 1.6 : 1.0;
    if (t.key === 'forest') s *= cls === 'SAP' ? 1.25 : 1.0;
    return s;
  }

  /** ramène un point dans les limites de la carte */
  clampPoint(x, y) {
    return { x: U.clamp(x, 8, this.w - 8), y: U.clamp(y, 8, this.h - 8) };
  }

  /** position libre proche de (x,y) pour une unité de ce type */
  nearestFree(x, y, cls, maxR = 260) {
    const c = this.clampPoint(x, y);
    if (this.canStand(c.x, c.y, cls)) return c;
    for (let r = 16; r <= maxR; r += 16) {
      const steps = 10 + Math.floor(r / 6);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2 + r;
        const nx = c.x + Math.cos(a) * r, ny = c.y + Math.sin(a) * r;
        if (nx < 20 || ny < 20 || nx > this.w - 20 || ny > this.h - 20) continue;
        if (this.canStand(nx, ny, cls)) return { x: nx, y: ny };
      }
    }
    return c;
  }

  /** comme nearestFree mais en restant à l'intérieur de la zone donnée */
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

  /* ---------------- rendu (mis en cache) ---------------- */

  build() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    U.srand(this.def.seed || 42);

    /* --- terre de base avec un relief léger --- */
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

    /* --- plaques de terrain --- */
    for (const p of this.patches) {
      const col = TERRAIN[p.kind].color;
      g.save();
      g.beginPath();
      if (p.shape === 'r') {
        // bords irréguliers
        const j = 16;
        g.moveTo(p.x, p.y);
        for (let i = 0; i < 12; i++) {
          const t = i / 12, ang = t * 6.2832;
          const rx = p.w / 2, ry = p.h / 2;
          const cx = p.x + rx + Math.cos(ang) * rx;
          const cy = p.y + ry + Math.sin(ang) * ry;
          g.lineTo(cx + U.rand(-j, j), cy + U.rand(-j, j));
        }
        g.closePath();
      } else {
        g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.2832);
      }
      g.fillStyle = col; g.fill();
      g.globalAlpha = 0.5; g.lineWidth = 2;
      g.strokeStyle = U.mix(col, '#000000', 0.18); g.stroke();
      g.restore();
    }

    /* --- forêts : bosquets d'arbres --- */
    for (const p of this.patches) {
      if (p.kind !== 'forest') continue;
      g.save();
      g.beginPath();
      if (p.shape === 'r') g.rect(p.x, p.y, p.w, p.h); else g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.2832);
      g.clip();
      const count = p.shape === 'r' ? Math.floor(p.w * p.h / 210) : Math.floor(p.rx * p.ry / 130);
      for (let i = 0; i < count; i++) {
        const x = p.shape === 'r' ? U.rand(p.x, p.x + p.w) : p.x + U.rand(-p.rx, p.rx);
        const y = p.shape === 'r' ? U.rand(p.y, p.y + p.h) : p.y + U.rand(-p.ry, p.ry);
        const r = U.rand(5, 9.5);
        g.fillStyle = 'rgba(22,52,16,0.30)';
        g.beginPath(); g.ellipse(x + 2, y + 3, r, r * 0.8, 0, 0, 6.2832); g.fill();
        g.fillStyle = U.pick(['#3e6b2a', '#4a7a30', '#375f24', '#51833a']);
        g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      }
      g.restore();
    }

    /* --- buttes : courbes de niveau --- */
    for (const p of this.patches) {
      if (p.kind !== 'hill') continue;
      g.save();
      g.beginPath();
      if (p.shape === 'r') g.rect(p.x, p.y, p.w, p.h); else g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.2832);
      g.clip();
      g.strokeStyle = 'rgba(120,105,50,0.35)'; g.lineWidth = 1.6;
      const cx = p.shape === 'r' ? p.x + p.w / 2 : p.x;
      const cy = p.shape === 'r' ? p.y + p.h / 2 : p.y;
      for (let k = 1; k <= 4; k++) {
        g.beginPath();
        const s = k / 4.4;
        g.ellipse(cx, cy, (p.w || p.rx * 2) / 2 * s, (p.h || p.ry * 2) / 2 * s, 0, 0, 6.2832);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,210,0.13)';
      g.beginPath(); g.ellipse(cx, cy - 6, (p.w || p.rx * 2) / 3, (p.h || p.ry * 2) / 3, 0, 0, 6.2832); g.fill();
      g.restore();
    }

    /* --- marais --- */
    for (const p of this.patches) {
      if (p.kind !== 'marsh') continue;
      g.save();
      g.beginPath();
      if (p.shape === 'r') g.rect(p.x, p.y, p.w, p.h); else g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 6.2832);
      g.clip();
      g.strokeStyle = 'rgba(90,120,140,0.4)'; g.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = p.shape === 'r' ? U.rand(p.x, p.x + p.w) : p.x + U.rand(-p.rx, p.rx);
        const y = p.shape === 'r' ? U.rand(p.y, p.y + p.h) : p.y + U.rand(-p.ry, p.ry);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + U.rand(-9, 9), y + U.rand(-5, 5)); g.stroke();
      }
      g.restore();
    }

    /* --- routes --- */
    for (const r of this.roads) this._stroke(g, r.pts, r.w || 7, '#c2ab7e');
    for (const r of this.roads) this._stroke(g, r.pts, (r.w || 7) * 0.42, '#ddc79a');

    /* --- eaux --- */
    for (const poly of this.water) {
      g.beginPath();
      g.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i][0], poly[i][1]);
      g.closePath();
      g.fillStyle = '#3f72ad'; g.fill();
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 70; i++) {
        g.beginPath();
        g.ellipse(U.rand(this.w), U.rand(this.h), U.rand(20, 90), U.rand(6, 20), U.rand(-0.4, 0.4), 0, 6.2832);
        g.fill();
      }
      g.restore();
      g.lineWidth = 4; g.strokeStyle = '#c9cf94'; g.stroke();   // rive claire
    }

    /* --- rivières --- */
    for (const r of this.rivers) {
      this._stroke(g, r.pts, r.w + 5, '#9ab27a');
      this._stroke(g, r.pts, r.w, '#4a86c8');
      this._stroke(g, r.pts, r.w * 0.35, '#7fb4e6');
    }

    /* --- ponts --- */
    for (const b of this.bridges) {
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = '#7a5c36';
      g.fillRect(-30, -10, 60, 20);
      g.fillStyle = '#9c7845';
      for (let i = -26; i <= 22; i += 8) g.fillRect(i, -10, 5, 20);
      g.strokeStyle = '#4a3520'; g.lineWidth = 2; g.strokeRect(-30, -10, 60, 20);
      g.restore();
    }

    /* --- villages --- */
    for (const t of this.towns) this._drawVillage(g, t.x, t.y, t.size || 12);

    for (const p of this.patches) {
      if (p.kind !== 'village') continue;
      const cx = p.shape === 'r' ? p.x + p.w / 2 : p.x;
      const cy = p.shape === 'r' ? p.y + p.h / 2 : p.y;
      const n = p.shape === 'r' ? Math.floor(p.w * p.h / 900) : 12;
      for (let i = 0; i < n; i++) {
        const x = p.shape === 'r' ? U.rand(p.x + 6, p.x + p.w - 6) : p.x + U.rand(-p.rx * 0.8, p.rx * 0.8);
        const y = p.shape === 'r' ? U.rand(p.y + 6, p.y + p.h - 6) : p.y + U.rand(-p.ry * 0.8, p.ry * 0.8);
        this._house(g, x, y, U.rand(0, Math.PI));
      }
    }

    /* --- fortifications : corps de terre --- */
    for (const f of this.forts) this._drawFort(g, f);

    /* --- cadre --- */
    g.strokeStyle = 'rgba(40,32,14,0.5)'; g.lineWidth = 6;
    g.strokeRect(3, 3, this.w - 6, this.h - 6);

    this.cache = c;
  }

  _stroke(g, pts, width, color) {
    g.save();
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.restore();
  }

  _drawVillage(g, x, y, size) {
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

  _drawFort(g, f) {
    g.save();
    g.translate(f.x, f.y);
    // terre-plein
    g.fillStyle = 'rgba(120,105,60,0.9)';
    g.beginPath(); g.ellipse(0, 0, f.r * 1.25, f.r * 0.85, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#6d5f33'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, f.r * 1.25, f.r * 0.85, 0, 0, 6.2832); g.stroke();
    // rempart en dents de scie
    g.fillStyle = '#8d7a49';
    const n = Math.max(6, Math.round(f.r / 4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832;
      const x = Math.cos(a) * f.r, y = Math.sin(a) * f.r * 0.68;
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath();
      g.moveTo(-5, -7); g.lineTo(5, -7); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
  }

  draw(ctx) {
    ctx.drawImage(this.cache, 0, 0);
  }
}