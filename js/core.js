/* ============================================================
   core.js — utilitaires mathématiques et helpers
   ============================================================ */
const U = (function () {

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const dist  = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };

  let _seed = 1234567;
  function srand(s) { _seed = s >>> 0 || 1; }
  function rnd() { // mulberry32
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rand = (a = 1, b) => (b === undefined ? rnd() * a : a + rnd() * (b - a));
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;

  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;

  /** distance² d'un point au segment [a,b] */
  function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
    t = clamp(t, 0, 1);
    const cx = ax + t * dx, cy = ay + t * dy;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
  }

  /** point dans un polygone (ray casting) */
  function inPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  const inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  const inEllipse = (px, py, e) => {
    const dx = (px - e.x) / e.rx, dy = (py - e.y) / e.ry;
    return dx * dx + dy * dy <= 1;
  };

  /** formatage "12 340" */
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  /** formatage temps mm:ss */
  function clock(s) {
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60), r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  /** couleur : mélange */
  function mix(c1, c2, t) {
    const a = hexRgb(c1), b = hexRgb(c2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /** renvoie l'élément de plus forte valeur dans une liste {v} */
  function strongest(list) {
    let best = null, bv = -1e9;
    for (const it of list) if (it.v > bv) { bv = it.v; best = it; }
    return best;
  }

  return {
    clamp, lerp, dist, dist2, segDist2, inPoly, inRect, inEllipse, fmt, clock,
    mix, hexRgb, srand, rnd, rand, randInt, pick, chance, deg, rad, strongest,
  };
})();