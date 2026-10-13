/* ============================================================
   input.js — souris, clavier, sélection et ordres
   ============================================================ */

const Input = {
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  downPos: { x: 0, y: 0 },
  attackMode: false,

  init(canvas, game) {
    this.canvas = canvas;
    this.game = game;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => game.onResize());
  },

  toWorld(e) {
    const v = this.game.world.view;
    return { x: (e.clientX - v.ox) / v.zoom, y: (e.clientY - v.oy) / v.zoom };
  },

  onDown(e) {
    const g = this.game, w = this.toWorld(e);
    this.mouse.down = true;
    this.downPos = { x: e.clientX, y: e.clientY };
    g.audio.ensure();

    if (e.button === 0) {
      if (g.world.phase === 'deploy') {
        const u = g.unitAt(w.x, w.y);
        if (u && u.side === g.world.playerSide) {
          g.selectOnly(u.id);
          this.dragDeploy = { u, x: u.x, y: u.y };
        }
        return;
      }
      // sélection
      const u = g.unitAt(w.x, w.y);
      if (u && u.side === g.world.playerSide) {
        if (e.shiftKey) g.toggleSelect(u.id);
        else if (!g.world.selected.has(u.id)) g.selectOnly(u.id);
        g.dragBox = { x: w.x, y: w.y, w: 0, h: 0 };
      } else if (!e.shiftKey) {
        g.clearSelection();
        g.dragBox = { x: w.x, y: w.y, w: 0, h: 0 };
      }
    } else if (e.button === 2) {
      const attack = this.attackMode || e.shiftKey;
      const targets = g.selectedUnits();
      if (targets.length) {
        g.issueOrder(targets, w.x, w.y, attack ? 'attack' : 'move');
        g.audio.blip();
      }
    }
  },

  onMove(e) {
    const v = this.game.world.view;
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    this.mouse.wx = (e.clientX - v.ox) / v.zoom;
    this.mouse.wy = (e.clientY - v.oy) / v.zoom;

    const g = this.game;
    g.world.hover = g.unitAt(this.mouse.wx, this.mouse.wy);
    g.updateTooltip(e.clientX, e.clientY);

    if (this.dragDeploy && this.mouse.down) {
      this.dragDeploy.u.x = this.mouse.wx;
      this.dragDeploy.u.y = this.mouse.wy;
    }
    if (this.mouse.down && g.dragBox) {
      g.dragBox.w = this.mouse.wx - g.dragBox.x;
      g.dragBox.h = this.mouse.wy - g.dragBox.y;
    }
  },

  onUp(e) {
    const g = this.game;
    if (this.dragDeploy) { this.dragDeploy = null; this.mouse.down = false; return; }

    if (e.button === 0 && g.dragBox) {
      const b = g.dragBox;
      const small = Math.abs(b.w) < 6 && Math.abs(b.h) < 6;
      if (!small) {
        const x0 = Math.min(b.x, b.x + b.w), x1 = Math.max(b.x, b.x + b.w);
        const y0 = Math.min(b.y, b.y + b.h), y1 = Math.max(b.y, b.y + b.h);
        let ids = [];
        for (const u of g.world.units) {
          if (!u.alive || u.side !== g.world.playerSide) continue;
          if (u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) ids.push(u.id);
        }
        if (ids.length) {
          if (!e.shiftKey) g.world.selected.clear();
          for (const id of ids) g.world.selected.add(id);
        }
      }
      g.dragBox = null;
      g.syncPanel();
    }
    this.mouse.down = false;
  },

  onWheel(e) {
    e.preventDefault();
    const g = this.game;
    const v = g.world.view;
    const before = { x: (e.clientX - v.ox) / v.zoom, y: (e.clientY - v.oy) / v.zoom };
    v.zoom = U.clamp(v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.35, 2.6);
    v.ox = e.clientX - before.x * v.zoom;
    v.oy = e.clientY - before.y * v.zoom;
    g.clampView();
  },

  onKey(e) {
    const g = this.game;
    const k = e.key.toLowerCase();

    if (g.screen !== 'battle') {
      if (k === 'escape' && g.screen === 'howto') g.closeHowto();
      return;
    }

    switch (k) {
      case ' ': e.preventDefault(); g.togglePause(); break;
      case '1': g.setSpeed(1); break;
      case '2': g.setSpeed(2); break;
      case '3': g.setSpeed(3); break;
      case 'h': g.orderHold(); break;
      case 'c': g.orderChargeAll(); break;
      case 'e': g.triggerAura(); break;
      case 'a': this.attackMode = !this.attackMode; g.flashHint(this.attackMode ? 'Mode attaque-mouvement : cliquez sur la destination' : 'Ordre de mouvement'); break;
      case 'escape': g.pauseToMenu(); break;
      case 'q': case '+': case '=': g.zoomBy(1.15); break;
      case 'w': case '-': case '_': g.zoomBy(1 / 1.15); break;
      case 'f': g.focusSelection(); break;
    }
  },
};