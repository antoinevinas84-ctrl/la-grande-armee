/* ============================================================
   render.js — terrain, unités, effets, habillage d'écran
   ============================================================ */

/* ---------- effets temporels ---------- */
class FX {
  constructor() { this.parts = []; this.max = 900; }
  add(p) { if (this.parts.length < this.max) this.parts.push(p); }

  muzzle(x, y, ang) {
    for (let i = 0; i < 7; i++) {
      const a = ang + U.rand(-0.5, 0.5);
      const s = U.rand(30, 120);
      this.add({ t: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: U.rand(4, 9), life: 0.55, max: 0.55, c: '255,238,190' });
    }
  }
  cannonSmoke(x, y) {
    this.add({ t: 'puff', x, y, vx: U.rand(-8, 8), vy: U.rand(-8, 8), r: U.rand(16, 26), life: 1.5, max: 1.5, c: '190,190,185' });
  }
  explosion(x, y, r) {
    for (let i = 0; i < 12; i++) {
      const a = U.rand(0, 6.2832), s = U.rand(20, 90) * (0.5 + r / 40);
      this.add({
        t: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: U.rand(r * 0.3, r * 0.8), life: U.rand(0.5, 1.1), max: 1.1, c: U.pick(['120,110,100', '90,85,78', '200,190,170']),
      });
    }
    this.add({ t: 'boom', x, y, r: r * 1.1, life: 0.28, max: 0.28 });
  }
  spark(x, y) {
    for (let i = 0; i < 4; i++) {
      const a = U.rand(0, 6.2832), s = U.rand(30, 110);
      this.add({ t: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: U.rand(1.4, 3), life: U.rand(0.16, 0.3), max: 0.3, c: '255,220,140' });
    }
  }
  blood(x, y) {
    for (let i = 0; i < 3; i++) {
      const a = U.rand(0, 6.2832), s = U.rand(10, 45);
      this.add({ t: 'puff', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: U.rand(1.5, 3), life: 0.35, max: 0.35, c: '150,30,24' });
    }
  }
  dust(x, y) {
    this.add({ t: 'puff', x, y, vx: U.rand(-20, 20), vy: U.rand(-20, 20), r: U.rand(3, 7), life: 0.5, max: 0.5, c: '215,205,175' });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (p.t === 'puff') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.90; p.vy *= 0.90;
        p.r += dt * 14;
      }
    }
  }
  draw(g) {
    for (const p of this.parts) {
      const k = U.clamp(p.life / p.max, 0, 1);
      if (p.t === 'boom') {
        g.globalAlpha = k;
        g.strokeStyle = 'rgba(255,240,200,0.9)';
        g.lineWidth = 3 * k;
        g.beginPath(); g.arc(p.x, p.y, p.r * (1.4 - k), 0, 6.2832); g.stroke();
      } else {
        g.globalAlpha = k * 0.75;
        g.fillStyle = 'rgba(' + p.c + ',1)';
        g.beginPath(); g.arc(p.x, p.y, p.r * (1.4 - k * 0.4), 0, 6.2832); g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}

/* ---------- formes de symboles ---------- */
function drawGlyph(g, glyph, x, y, r, rot) {
  g.beginPath();
  switch (glyph) {
    case 'circle':
      g.arc(x, y, r, 0, 6.2832);
      break;
    case 'triangle': {
      const s = r * 1.18;
      const c = Math.cos(rot), sn = Math.sin(rot);
      const p = (px, py) => [x + px * c - py * sn, y + px * sn + py * c];
      const a = p(0, -s), b = p(s * 0.92, s * 0.72), c2 = p(-s * 0.92, s * 0.72);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.closePath();
      break;
    }
    case 'square': {
      const c = Math.cos(rot), sn = Math.sin(rot);
      const s = r * 0.95;
      const corners = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([px, py]) => [x + px * c - py * sn, y + px * sn + py * c]);
      g.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < 4; i++) g.lineTo(corners[i][0], corners[i][1]);
      g.closePath();
      break;
    }
    case 'cross': {
      const s = r * 1.05, t = r * 0.38;
      g.moveTo(x - s, y - s); g.lineTo(x - t, y - t); g.lineTo(x + t, y + t); g.lineTo(x + s, y + s);
      g.moveTo(x + s, y - s); g.lineTo(x + t, y - t); g.lineTo(x - t, y + t); g.lineTo(x - s, y + s);
      g.lineWidth = Math.max(3, r * 0.42); g.lineCap = 'round';
      g.stroke();
      g.lineWidth = 1;
      break;
    }
    case 'star5':
    case 'star4':
    case 'star8': {
      const n = glyph === 'star4' ? 4 : glyph === 'star8' ? 8 : 5;
      const inner = glyph === 'star4' ? 0.30 : glyph === 'star8' ? 0.52 : 0.46;
      const R = glyph === 'star4' ? r * 1.5 : r * 1.62;
      for (let i = 0; i < n * 2; i++) {
        const a = rot - Math.PI / 2 + (i * Math.PI) / n;
        const rr = i % 2 === 0 ? R : R * inner;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      break;
    }
  }
}

/* ---------- rendu d'une unité ---------- */
function drawUnit(g, u, world, sel) {
  const D = u.def;
  const r = D.radius;
  const side = u.side === 'fr' ? COL.fr : COL.en;
  const sideDark = u.side === 'fr' ? COL.frDark : COL.enDark;
  const rout = u.state === 'rout';

  g.save();

  /* ombre */
  g.globalAlpha = 0.28;
  g.fillStyle = '#000';
  g.beginPath(); g.ellipse(u.x + 2, u.y + 4, r * 1.05, r * 0.7, 0, 0, 6.2832); g.fill();
  g.globalAlpha = 1;

  if (u.inAura) {                      // léger halo d'inspiration
    g.globalAlpha = 0.16;
    g.fillStyle = D.imperial ? '#ffe9a8' : '#fff3c0';
    g.beginPath(); g.arc(u.x, u.y, r * 2.1, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
  }

  if (rout) g.globalAlpha = 0.75;

  /* corps */
  const bodyCol = rout ? '#6b6b6b' : (u.hitFlash > 0 ? '#ffffff' : side);

  if (D.key === 'CMD' || D.key === 'NCO' || D.key === 'EMP') {
    // officiers : étoile seule, corps coloré selon le grade
    const gold = D.key === 'CMD' || D.key === 'EMP';
    g.fillStyle = rout ? '#7a7a7a' : (gold ? (u.side === 'fr' ? '#f2cf6a' : '#ffd9a0') : '#dfe6f2');
    g.strokeStyle = u.side === 'fr' ? '#2a3d8f' : '#8a2118';
    g.lineWidth = 2;
    drawGlyph(g, D.glyph, u.x, u.y, r * 0.82, u.facing + (D.key === 'NCO' ? 0.4 : 0));
    g.fill(); g.stroke();
    if (D.key === 'EMP') {
      g.globalAlpha = 0.55 + 0.25 * Math.sin(world.time * 3);
      g.strokeStyle = '#ffe9a8'; g.lineWidth = 2;
      g.beginPath(); g.arc(u.x, u.y, r * 2.0, 0, 6.2832); g.stroke();
      g.globalAlpha = 1;
    }
  } else {
    drawGlyph(g, D.glyph, u.x, u.y, r, u.facing);
    g.fillStyle = bodyCol; g.fill();
    g.lineWidth = 1.6; g.strokeStyle = sideDark; g.stroke();
    // reflet
    g.globalAlpha = 0.30; g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(u.x - r * 0.25, u.y - r * 0.3, r * 0.34, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
  }

  g.globalAlpha = 1;

  /* anneau d'effectif */
  const ratio = U.clamp(u.ratio, 0, 1);
  g.lineWidth = 2.6;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.arc(u.x, u.y, r + 4.2, -Math.PI * 0.5, -Math.PI * 0.5 + 6.2832); g.stroke();
  g.strokeStyle = ratio > 0.6 ? '#8fe08f' : ratio > 0.3 ? '#e8cf6a' : '#e86a55';
  g.beginPath(); g.arc(u.x, u.y, r + 4.2, -Math.PI * 0.5, -Math.PI * 0.5 + 6.2832 * ratio); g.stroke();

  /* barre de moral (seulement si critique ou sélectionnée) */
  if (sel || u.morale < u.maxMorale * 0.55) {
    const w = r * 2.6;
    const y = u.y - r - 9;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(u.x - w / 2, y, w, 3);
    const mm = U.clamp(u.morale / Math.max(1, u.maxMorale + u.bMorMax), 0, 1);
    g.fillStyle = rout ? '#ff5a4a' : mm > 0.5 ? '#5fd46f' : mm > 0.25 ? '#e6c352' : '#e8523c';
    g.fillRect(u.x - w / 2, y, w * mm, 3);
  }

  /* état "en charge" */
  if (u.chargeTimer > 0) {
    g.strokeStyle = 'rgba(255,220,120,0.85)'; g.lineWidth = 2;
    g.beginPath(); g.arc(u.x, u.y, r + 8, world.time * 6, world.time * 6 + 2.2); g.stroke();
  }

  /* sélection */
  if (sel) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.setLineDash([4, 4]);
    g.lineDashOffset = -world.time * 14;
    g.beginPath(); g.arc(u.x, u.y, r + 7, 0, 6.2832); g.stroke();
    g.setLineDash([]);
  }

  /* étiquette */
  if (sel || world.hover === u) {
    g.font = '600 11px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    const label = u.name;
    const wdt = g.measureText(label).width + 10;
    g.fillStyle = 'rgba(12,10,6,0.82)';
    g.fillRect(u.x - wdt / 2, u.y + r + 10, wdt, 14);
    g.fillStyle = rout ? '#ff9a8a' : '#f0e6cc';
    g.fillText(label, u.x, u.y + r + 20);
  }

  g.restore();
}

/* ---------- rendu principal ---------- */
const Renderer = {
  ctx: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  },

  resize(world) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
  },

  draw(world) {
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#20301c';
    g.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const v = world.view;
    g.save();
    g.translate(v.ox, v.oy);
    g.scale(v.zoom, v.zoom);

    /* --- carte --- */
    world.map.draw(g);

    /* --- surimpressions de l'éditeur --- */
    if (world.phase === 'sandbox') this.editorOverlay(g, world);

    /* --- zones de déploiement --- */
    if (world.phase === 'deploy') {
      this.deployZone(g, world, world.camp.deploy.fr, '#3a5fd0');
      this.deployZone(g, world, world.camp.deploy.en, '#cf3a2c');
    }

    /* --- objectifs --- */
    for (const o of world.map.objectives) {
      const held = world.objectiveHeld(o);
      g.strokeStyle = held ? 'rgba(120,230,120,0.9)' : 'rgba(240,220,140,0.65)';
      g.lineWidth = 2.5; g.setLineDash([8, 7]);
      g.lineDashOffset = -world.time * 16;
      g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.2832); g.stroke();
      g.setLineDash([]);
      if (o.optional) {
        g.fillStyle = 'rgba(240,220,140,0.75)';
        g.font = 'italic 12px Georgia, serif'; g.textAlign = 'center';
        g.fillText(o.name + ' (facultatif)', o.x, o.y - o.r - 8);
      }
    }

    /* ---Traits de front (optionnel) --- */

    /* --- auras --- */
    for (const u of world.units) {
      if (!u.alive || !u.def.auraR) continue;
      if (u.side !== world.playerSide) continue;
      const R = u.def.auraR;
      const grd = g.createRadialGradient(u.x, u.y, R * 0.25, u.x, u.y, R);
      grd.addColorStop(0, 'rgba(255,225,150,0.13)');
      grd.addColorStop(1, 'rgba(255,225,150,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(u.x, u.y, R, 0, 6.2832); g.fill();
      g.strokeStyle = 'rgba(255,225,150,0.22)'; g.lineWidth = 1.2;
      g.setLineDash([3, 6]);
      g.beginPath(); g.arc(u.x, u.y, R, 0, 6.2832); g.stroke();
      g.setLineDash([]);
    }

    /* --- fortifications : état --- */
    for (const f of world.forts) {
      if (!f.alive) {
        g.globalAlpha = 0.35;
        g.fillStyle = '#3a3324';
        g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, 6.2832); g.fill();
        g.globalAlpha = 1;
        continue;
      }
      const col = f.side === 'fr' ? COL.fr : COL.en;
      g.strokeStyle = col; g.lineWidth = 2;
      g.setLineDash([5, 5]);
      g.beginPath(); g.ellipse(f.x, f.y, f.r * 1.25, f.r * 0.85, 0, 0, 6.2832); g.stroke();
      g.setLineDash([]);
      if (f.hitFlash > 0) { g.globalAlpha = f.hitFlash * 2; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, 6.2832); g.fill(); g.globalAlpha = 1; }

      // jauge
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(f.x - 24, f.y - f.r * 0.85 - 12, 48, 4);
      g.fillStyle = '#e8cf6a'; g.fillRect(f.x - 24, f.y - f.r * 0.85 - 12, 48 * f.ratio, 4);
      g.font = '10px Georgia, serif'; g.textAlign = 'center';
      g.fillStyle = '#efe6cf';
      g.fillText(f.name, f.x, f.y - f.r * 0.85 - 17);
    }

    /* --- unités triées par profondeur --- */
    const sorted = world.units.filter((u) => u.alive).slice().sort((a, b) => a.y - b.y);
    for (const u of sorted) drawUnit(g, u, world, world.selected.has(u.id));

    /* --- projectiles --- */
    for (const s of world.shells) {
      g.save();
      g.translate(s.x, s.y); g.rotate(s.facing);
      g.fillStyle = '#22201c';
      g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(-14, -1, 10, 2);
      g.restore();
    }

    /* --- effets --- */
    world.fx.draw(g);

    /* --- ordre en cours (trait) --- */
    if (world.dragOrder) {
      const o = world.dragOrder;
      g.strokeStyle = o.attack ? 'rgba(255,140,90,0.9)' : 'rgba(255,255,255,0.8)';
      g.lineWidth = 2; g.setLineDash([6, 5]);
      g.beginPath(); g.moveTo(o.x0, o.y0); g.lineTo(o.x1, o.y1); g.stroke();
      g.setLineDash([]);
      const col = o.attack ? '#ff8c5a' : '#ffffff';
      g.strokeStyle = col; g.lineWidth = 2;
      const r = 9 + Math.sin(world.time * 6) * 1.5;
      g.beginPath(); g.arc(o.x1, o.y1, r, 0, 6.2832); g.stroke();
      if (o.attack) {
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          g.moveTo(o.x1, o.y1);
          g.lineTo(o.x1 + Math.cos(a) * 16, o.y1 + Math.sin(a) * 16);
        }
        g.stroke();
      }
    }

    /* --- rectangle de sélection --- */
    if (world.dragBox) {
      const b = world.dragBox;
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1;
      g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    }

    /* --- ordre de portée au survol d'une unité de joueur --- */
    if (world.selected.size === 1 && world.phase === 'battle') {
      for (const u of world.units) {
        if (u.id !== [...world.selected][0] || !u.alive) continue;
        if (u.def.range > 120) {
          g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(u.x, u.y, u.def.range, 0, 6.2832); g.stroke();
        }
        break;
      }
    }

    g.restore();

    /* --- vignette --- */
    const vg = g.createRadialGradient(
      window.innerWidth / 2, window.innerHeight / 2, Math.min(window.innerWidth, window.innerHeight) * 0.35,
      window.innerWidth / 2, window.innerHeight / 2, Math.max(window.innerWidth, window.innerHeight) * 0.75
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, window.innerWidth, window.innerHeight);
  },

  /* ---------- surimpressions du bac à sable ---------- */
editorOverlay(g, world) {
  const sb = Sandbox;
  const x = sb.hoverX, y = sb.hoverY;
  if (!x && !y) return;

  g.save();

  // grille discrète pour situer le curseur
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.lineWidth = 1;
  const step = 80;
  const x0 = Math.floor((x - 400) / step) * step, x1 = x + 400;
  const y0 = Math.floor((y - 300) / step) * step, y1 = y + 300;
  g.beginPath();
  for (let gx = x0; gx <= x1; gx += step) { g.moveTo(gx, y0); g.lineTo(gx, y1); }
  for (let gy = y0; gy <= y1; gy += step) { g.moveTo(x0, gy); g.lineTo(x1, gy); }
  g.stroke();

  // tracé en cours
  if (sb.drag) {
    const col = sb.drag.type === 'wall' ? 'rgba(210,180,120,0.95)'
      : sb.drag.type === 'river' ? 'rgba(110,180,240,0.95)' : 'rgba(230,210,160,0.95)';
    g.strokeStyle = col;
    g.lineWidth = sb.drag.type === 'wall' ? sb.wallW : (sb.drag.type === 'river' ? 12 : 7);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(sb.drag.pts[0][0], sb.drag.pts[0][1]);
    for (let i = 1; i < sb.drag.pts.length; i++) g.lineTo(sb.drag.pts[i][0], sb.drag.pts[i][1]);
    g.lineTo(x, y);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
    g.setLineDash([6, 5]);
    g.stroke();
    g.setLineDash([]);
  }

  // pinceau / zone d'action
  if (sb.tool === 'paint' || sb.tool === 'water') {
    const r = Math.max(10, sb.brush * 0.5);
    const col = sb.tool === 'water' ? 'rgba(90,160,235,0.9)' : 'rgba(220,235,160,0.9)';
    g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.stroke();
    g.globalAlpha = 0.18; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
  } else if (sb.tool === 'unit') {
    const p = world.map.nearestFree(x, y, sb.cls, 240);
    g.strokeStyle = sb.side === 'fr' ? 'rgba(143,176,255,0.95)' : 'rgba(255,154,134,0.95)';
    g.lineWidth = 2; g.setLineDash([5, 4]);
    g.beginPath(); g.arc(p.x, p.y, CLASSES[sb.cls].radius + 9, 0, 6.2832); g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(p.x - 14, p.y); g.lineTo(p.x + 14, p.y);
    g.moveTo(p.x, p.y - 14); g.lineTo(p.x, p.y + 14);
    g.stroke();
  } else if (sb.tool === 'erase') {
    g.strokeStyle = 'rgba(255,120,100,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 22, 0, 6.2832); g.stroke();
    g.beginPath(); g.moveTo(x - 11, y - 11); g.lineTo(x + 11, y + 11); g.stroke();
  } else if (sb.tool === 'select') {
    const u = world.hover;
    if (u) {
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
      g.beginPath(); g.arc(u.x, u.y, u.def.radius + 8, 0, 6.2832); g.stroke();
      g.setLineDash([]);
    }
  }

  // aide contextuelle
  const label = sb.tool === 'fort'
    ? (sb.fortSide === 'fr' ? 'Redoute française' : 'Redoute adverse')
    : sb.tool === 'unit' ? CLASSES[sb.cls].name + (sb.side === 'fr' ? ' (Français)' : ' (Adverse)') : '';
  if (label) {
    g.font = '600 12px "Segoe UI", sans-serif';
    g.textAlign = 'left';
    const w = g.measureText(label).width + 14;
    g.fillStyle = 'rgba(12,10,6,0.85)';
    g.fillRect(x + 16, y - 30, w, 20);
    g.fillStyle = '#f0e6cc';
    g.fillText(label, x + 23, y - 16);
  }

  g.restore();
},

deployZone(g, world, z, color) {
    g.save();
    g.globalAlpha = 0.14;
    g.fillStyle = color;
    g.fillRect(z.x, z.y, z.w, z.h);
    g.globalAlpha = 0.85;
    g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([10, 8]);
    g.lineDashOffset = -world.time * 12;
    g.strokeRect(z.x, z.y, z.w, z.h);
    g.setLineDash([]);
    g.restore();
  },
};