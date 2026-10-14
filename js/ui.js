/* ============================================================
   ui.js — écrans, fiches d'unités, barre d'unités, infobulles
   ============================================================ */

const UI = (function () {

  const $ = (id) => document.getElementById(id);

  /* ---------- petit dessin SVG des symboles ---------- */
  function glyphSVG(cls, color, stroke) {
    const s = 20;
    const c = s / 2;
    const common = `fill="${color}" stroke="${stroke || 'rgba(0,0,0,.55)'}" stroke-width="1.6"`;
    let inner = '';
    switch (cls) {
      case 'INF':
        inner = `<circle cx="${c}" cy="${c}" r="6.5" ${common}/>`; break;
      case 'CAV':
        inner = `<polygon points="${c},3.5 ${c + 6.5},16 ${c - 6.5},16" ${common}/>`; break;
      case 'ART':
        inner = `<rect x="4.5" y="4.5" width="11" height="11" ${common}/>`; break;
      case 'SAP':
        inner = `<path d="M5 5 L15 15 M15 5 L5 15" stroke="${color}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`; break;
      case 'CMD': {
        let pts = '';
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 8 : 3.6;
          pts += (c + Math.cos(a) * r).toFixed(1) + ',' + (c + Math.sin(a) * r).toFixed(1) + ' ';
        }
        inner = `<polygon points="${pts}" fill="#f2cf6a" stroke="#7a5a12" stroke-width="1.4"/>`; break;
      }
      case 'NCO': {
        let pts = '';
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 4 + 0.4;
          const r = i % 2 === 0 ? 8.5 : 2.4;
          pts += (c + Math.cos(a) * r).toFixed(1) + ',' + (c + Math.sin(a) * r).toFixed(1) + ' ';
        }
        inner = `<polygon points="${pts}" fill="#dfe6f2" stroke="#5b6480" stroke-width="1.3"/>`; break;
      }
      case 'EMP': {
        let pts = '';
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 8;
          const r = i % 2 === 0 ? 8.6 : 4.4;
          pts += (c + Math.cos(a) * r).toFixed(1) + ',' + (c + Math.sin(a) * r).toFixed(1) + ' ';
        }
        inner = `<circle cx="${c}" cy="${c}" r="9.4" fill="none" stroke="#ffe9a8" stroke-width="1"/>
                 <polygon points="${pts}" fill="#ffe08a" stroke="#8a6a1e" stroke-width="1.3"/>`; break;
      }
    }
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${inner}</svg>`;
  }

  /* ---------- écran courant ---------- */
  function show(name) {
    for (const id of ['menu', 'briefing', 'result', 'howto', 'sandbox-ui', 'sb-loadscreen']) {
      $(id).classList.add('hidden');
    }
    $('deploy-screen').classList.add('hidden');
    $('battle-ui').classList.add('hidden');
    if (name === 'battle') {
      $('battle-ui').classList.remove('hidden');
    } else if (name === 'deploy') {
      $('battle-ui').classList.remove('hidden');
      $('deploy-screen').classList.remove('hidden');
    } else if (name === 'sandbox') {
      $('battle-ui').classList.remove('hidden');
      $('sandbox-ui').classList.remove('hidden');
    } else if (name) {
      $(name).classList.remove('hidden');
    }
  }

  /* ---------- carte des campagnes ---------- */
  function buildCampaignList(game) {
    const list = $('campaign-list');
    list.innerHTML = '';
    const unlocked = game.progress.max;

    CAMPAIGNS.forEach((c) => {
      const locked = c.num > unlocked;
      const done = game.progress.done.includes(c.id);
      const el = document.createElement('div');
      el.className = 'camp' + (locked ? ' locked' : '') + (done ? ' done' : '');
      const stars = c.difficulty;
      let diff = '';
      for (let i = 0; i < 5; i++) diff += `<i class="${i < stars ? 'on' : ''}"></i>`;
      el.innerHTML =
        `<div class="cnum">CAMPAGNE ${roman(c.num)}</div>` +
        `<h3>${c.name}</h3>` +
        `<div class="cdate">${c.date} — ${c.place}</div>` +
        `<div class="cdiff">${diff}</div>` +
        (done ? `<div class="clock">&#10003;</div>` : '');
      if (!locked) el.addEventListener('click', () => game.openBriefing(c));
      list.appendChild(el);
    });
  }

  function roman(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n] || String(n);
  }

  /* ---------- briefing ---------- */
  function fillBriefing(camp, game) {
    $('br-num').textContent = 'Campagne ' + roman(camp.num);
    $('br-name').textContent = camp.name;
    $('br-date').textContent = camp.date + ' — ' + camp.place;
    $('br-text').innerHTML = camp.brief.map((p) => `<p>${p}</p>`).join('') +
      `<p class="quote">« ${camp.quote} »</p>`;

    const count = (list, side) => {
      let men = 0, units = 0;
      for (const b of list) {
        const n = b.n || 1;
        units += n;
        const base = CLASSES[b.cls].men * (b.cls === 'CMD' || b.cls === 'NCO' || b.cls === 'EMP' ? 1 : 1);
        men += base * n;
      }
      return { men, units };
    };
    const f = count(camp.player), e = count(camp.enemy);

    $('br-forces').innerHTML =
      `<div class="force-row fr"><span class="lg">${glyphSVG('INF', COL.fr)}</span><span class="fr-name">Grande Armée</span><span class="fr-n">${U.fmt(f.men)} h · ${f.units} u</span></div>` +
      `<div class="force-row en"><span class="lg">${glyphSVG('INF', COL.en)}</span><span class="fr-name">Armée alliée</span><span class="fr-n">${U.fmt(e.men)} h · ${e.units} u</span></div>`;

    $('br-obj').innerHTML = camp.objectives.map((o) => `<li>${o}</li>`).join('');
    $('br-cmd').innerHTML = camp.commanders.map((c) =>
      `<div style="margin-bottom:6px"><b style="color:${c.side === 'fr' ? COL.frLight : COL.enLight}">${c.name}</b> <em>${c.role}</em><br><span style="color:#b6ab8f">${c.note}</span></div>`
    ).join('');

    $('btn-deploy').textContent = 'Phase de déploiement →';
  }

  /* ---------- barre d'unités ---------- */
  function buildRoster(game) {
    const r = $('roster');
    r.innerHTML = '';
    for (const u of game.world.units) {
      if (u.side !== game.world.playerSide) continue;
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.dataset.id = u.id;
      chip.innerHTML =
        `<span class="chip-gl">${glyphSVG(u.cls, u.side === 'fr' ? COL.frLight : COL.enLight)}</span>` +
        `<div><div class="chip-name">${shortName(u)}</div><div class="chip-sub">${u.def.name}</div></div>` +
        `<i class="chip-bar" style="width:100%"></i><i class="chip-bar mor" style="width:100%"></i>`;
      chip.addEventListener('click', (ev) => {
        if (ev.shiftKey) game.toggleSelect(u.id);
        else game.selectOnly(u.id);
      });
      r.appendChild(chip);
    }
  }

  function shortName(u) {
    const n = u.name.replace(/ \(renfort\)$/, '');
    return n.length > 15 ? n.slice(0, 14) + '…' : n;
  }

  function syncRoster(game) {
    for (const chip of document.querySelectorAll('#roster .chip')) {
      const id = +chip.dataset.id;
      const u = game.world.byId(id);
      if (!u) continue;
      chip.classList.toggle('sel', game.world.selected.has(id));
      chip.classList.toggle('dead', !u.alive);
      const bars = chip.querySelectorAll('.chip-bar');
      bars[0].style.width = (U.clamp(u.ratio, 0, 1) * 100) + '%';
      bars[1].style.width = (U.clamp(u.morale / Math.max(1, u.maxMorale), 0, 1) * 100) + '%';
      bars[1].style.top = '0'; bars[1].style.bottom = 'auto';
    }
  }

  /* ---------- fiche unité ---------- */
  function syncUnitCard(game) {
    const card = $('unit-card');
    const ids = [...game.world.selected];
    if (!ids.length) { card.classList.add('hidden'); return; }
    const u = game.world.byId(ids[0]);
    if (!u || !u.alive) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');

    $('uc-glyph').innerHTML = glyphSVG(u.cls, u.side === 'fr' ? COL.frLight : COL.enLight);
    $('uc-name').textContent = u.name;
    const q = u.quality.tag ? ' · ' + u.quality.tag : '';
    $('uc-class').textContent = u.def.name + q;

    $('uc-hp').style.width = (u.ratio * 100) + '%';
    $('uc-hp-txt').textContent = Math.round(u.men);
    $('uc-mor').style.width = (U.clamp(u.morale / Math.max(1, u.maxMorale + u.bMorMax), 0, 1) * 100) + '%';
    $('uc-mor-txt').textContent = Math.round(u.morale);
    $('uc-fat').style.width = (U.clamp(u.fatigue / 100, 0, 1) * 100) + '%';
    $('uc-fat-txt').textContent = Math.round(u.fatigue);

    const st = $('uc-status');
    st.textContent = u.statusLabel();
    st.className = 'uc-status' + (u.state === 'engage' ? ' combat' : u.state === 'rout' ? ' rout' : '');

    let traits = [];
    for (const t of u.def.traits) traits.push('<span class="trait gold">' + t + '</span>');
    if (u.inAura) traits.push('<span class="trait good">Sous influence</span>');
    if (u.bAtk > 1.001) traits.push('<span class="trait good">Attaque +' + Math.round((u.bAtk - 1) * 100) + '%</span>');
    if (u.bDef > 1.001) traits.push('<span class="trait good">Défense +' + Math.round((u.bDef - 1) * 100) + '%</span>');
    if (u.fatigue > 55) traits.push('<span class="trait bad">Épuisée</span>');
    if (u.chargesLeft > 0) traits.push('<span class="trait">Charges : ' + u.chargesLeft + '</span>');
    $('uc-traits').innerHTML = traits.join('');

    $('uc-desc').textContent = u.def.desc + (ids.length > 1 ? `  (+${ids.length - 1} autre(s) sélectionnée(s))` : '');
  }

  /* ---------- panneau impérial ---------- */
  function syncAuraCard(game) {
    const w = game.world;
    const emp = w.units.find((u) => u.side === 'fr' && u.imperial && u.alive);
    const card = $('aura-card');
    if (!emp) {
      card.classList.add('hidden');
      $('btn-aura').classList.remove('ready', 'active');
      $('btn-aura').disabled = true;
      return;
    }
    card.classList.remove('hidden');
    const a = w.aura;
    const status = a.active ? 'ACTIVE' : a.cd > 0 ? U.clock(a.cd) : 'PRÊT';
    const pct = a.active ? a.t / BAL.auraDuration : 1 - a.cd / BAL.auraCooldown;
    $('aura-body').innerHTML =
      `<div style="color:${a.active ? '#ffe9a8' : 'var(--txt-dim)'};font-weight:700;letter-spacing:.1em">${status}</div>` +
      `<div class="aura-bar"><i style="width:${U.clamp(pct, 0, 1) * 100}%"></i></div>` +
      `<div>Autour de l'Empereur (<b style="color:#ffe9a8">${emp.def.auraR} px</b>) : ` +
      `<b style="color:#ffe9a8">+${Math.round(emp.def.auraAtk * 100)} % d'attaque</b>, ` +
      `<b style="color:#ffe9a8">+${emp.def.auraMoraleBonus} de moral</b>, ` +
      `moral reconstitué ${Math.round(emp.def.auraMoraleRegen * 100)} % plus vite.</div>` +
      `<div style="margin-top:6px;color:#b6ab8f">Les unités ainsi soutenues ne rompent pas : ` +
      `l'Empereur est <b style="color:#ffe9a8">${U.fmt(emp.men)}</b> hommes et son état-major veille sur lui.</div>`;

    const btn = $('btn-aura');
    btn.classList.toggle('active', a.active);
    btn.classList.toggle('ready', !a.active && a.cd <= 0);
    btn.disabled = !a.active && a.cd > 0;
  }

  /* ---------- barre supérieure ---------- */
  function syncTopbar(game) {
    const w = game.world;
    $('tb-campaign').textContent = w.camp.name;
    $('tb-date').textContent = w.camp.date;
    $('tb-clock').textContent = U.clock(w.time);
    $('tb-str').textContent = U.fmt(strength(w, 'fr'));
    $('tb-ene').textContent = U.fmt(strength(w, 'en'));
    const obj = w.currentObjective();
    $('tb-objective').textContent = obj;
  }

  function strength(w, side) {
    let s = 0;
    for (const u of w.units) {
      if (!u.alive || u.side !== side) continue;
      s += u.men * (u.cls === 'CAV' ? 1.3 : u.cls === 'ART' ? 0.75 : 1);
    }
    return s;
  }

  /* ---------- bannière ---------- */
  let bannerTimer = null;
  function banner(text, enemy) {
    const b = $('banner');
    b.textContent = text;
    b.className = 'banner' + (enemy ? ' enemy' : '');
    b.classList.remove('hidden');
    // relance l'animation
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
  }

  /* ---------- infobulle ---------- */
  function tooltip(game, x, y) {
    const tip = $('tooltip');
    const u = game.world.hover;
    if (!u || !u.alive || (u.kind !== 'unit' && u.kind !== 'fort')) { tip.classList.add('hidden'); return; }
    const side = u.side === 'fr' ? COL.frLight : COL.enLight;
    let html;
    if (u.kind === 'fort') {
      html = `<b>${u.name}</b>Ouvrage fortifié · ${u.side === 'fr' ? 'Français' : 'Adverse'}<br>Intégrité ${Math.round(u.ratio * 100)} %`;
    } else {
      const eff = Math.round(U.clamp(u.morale / Math.max(1, u.maxMorale), 0, 1) * 100);
      html = `<b>${u.name}</b>` +
        `<span style="color:${side}">${u.def.name}${u.quality.tag ? ' · ' + u.quality.tag : ''}</span><br>` +
        `Effectif <span class="tstat">${Math.round(u.men)}</span> · Moral <span class="${eff > 50 ? 'tstat' : 'tdown'}">${Math.round(u.morale)}</span><br>` +
        `Attaque ${Math.round(u.atk())} · Défense ${Math.round(u.def2())} · Portée ${u.def.range}`;
    }
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, x + 16) + 'px';
    tip.style.top = Math.min(window.innerHeight - h - 8, y + 16) + 'px';
  }

  /* ---------- résultat ---------- */
  function result(game, win, stats) {
    $('res-banner').textContent = win ? 'VICTOIRE' : 'DÉFAITE';
    $('res-banner').className = 'res-banner ' + (win ? 'win' : 'lose');
    $('res-rank').textContent = win ? rankText(stats) : 'La campagne s\'arrête ici.';
    $('res-text').textContent = win ? stats.text : stats.text;
    $('res-stats').innerHTML =
      stat('Durée', U.clock(stats.time)) +
      stat('Effectif restant', U.fmt(stats.left)) +
      stat('Prisonniers', U.fmt(stats.captured)) +
      stat('Pertes', U.fmt(stats.lost)) +
      (stats.objTotal ? stat('Objectifs', stats.obj + '/' + stats.objTotal) : '');

    const next = CAMPAIGNS[stats.num];
    const btn = $('btn-res-next');
    if (win && next) { btn.textContent = 'Campagne suivante : ' + next.name; btn.classList.remove('hidden'); }
    else btn.classList.add('hidden');
    show('result');
  }

  function rankText(s) {
    if (s.obj > 0 && s.lossRatio < 0.25) return "Une victoire éclatante : l'armée ennemie est anéantie et l'objectif atteint.";
    if (s.obj > 0) return "Une victoire honorable, digne des annales.";
    if (s.lossRatio < 0.2) return "L'adversaire a cédé, mais l'armée est à reconstituer.";
    return "La victoire est acquise, au prix du sang et des ruines.";
  }

  function stat(v, l) {
    return `<div class="res-stat"><div class="rs-v">${v}</div><div class="rs-l">${l}</div></div>`;
  }

  /* ---------- légende ---------- */
  /* ============================================================
   Bac à sable — panneaux de l'éditeur
   ============================================================ */
function buildSandboxPanels(sb) {
  const tl = $('sb-tool-list');
  tl.innerHTML = '';
  for (const t of sb.tools) {
    const b = document.createElement('button');
    b.className = 'sb-tool' + (sb.tool === t.key ? ' active' : '');
    b.textContent = t.label;
    b.dataset.tool = t.key;
    b.addEventListener('click', () => { sb.tool = t.key; buildSandboxPanels(sb); });
    tl.appendChild(b);
  }
  $('sb-hint').textContent = sb.hint();
  $('sb-fortside-row').style.display = sb.tool === 'fort' ? '' : 'none';

  const ul = $('sb-unit-list');
  ul.innerHTML = '';
  for (const u of SANDBOX_UNITS) {
    const b = document.createElement('div');
    b.className = 'sb-unit' + (sb.tool === 'unit' && sb.cls === u.key ? ' active' : '');
    b.innerHTML = '<span class="glyph">' + glyphSVG(u.key, sb.side === 'fr' ? COL.frLight : COL.enLight) + '</span><span>' + u.label + '</span>';
    b.addEventListener('click', () => { sb.tool = 'unit'; sb.cls = u.key; buildSandboxPanels(sb); });
    ul.appendChild(b);
  }
  for (const b of document.querySelectorAll('#sb-palette .sb-side[data-side]')) b.classList.toggle('active', b.dataset.side === sb.side);
  for (const b of document.querySelectorAll('#sb-palette .sb-side[data-fortside]')) b.classList.toggle('active', b.dataset.fortside === sb.fortSide);

  const ql = $('sb-quality');
  ql.innerHTML = '';
  for (const key of ['conscript', 'line', 'veteran', 'guard', 'cossack']) {
    const b = document.createElement('button');
    b.className = 'sb-q' + (sb.quality === key ? ' active' : '');
    b.textContent = QUALITY[key].label;
    b.addEventListener('click', () => { sb.quality = key; buildSandboxPanels(sb); });
    ql.appendChild(b);
  }

  $('sb-brush').value = sb.brush;
  $('sb-brush-val').textContent = sb.brush;
  $('sb-wallw').value = sb.wallW;
  $('sb-wallw-val').textContent = sb.wallW;
  if (document.activeElement !== $('sb-title')) $('sb-title').value = sb.name || 'Mon scénario';

  updateSandboxCounts();
  syncSandboxBar();
}

/* ---------- compteurs et barre du bac à sable ---------- */
function updateSandboxCounts() {
  const g = Game;
  if (!g.world) return;
  const fr = g.world.units.filter((u) => u.side === 'fr').length;
  const en = g.world.units.filter((u) => u.side === 'en').length;
  $('sb-counts').innerHTML = '<b>' + fr + '</b> unités françaises · <i>' + en + '</i> adverses · ' +
    g.world.map.features.length + ' éléments de décor';
}

function syncSandboxBar() {
  const g = Game;
  if (!g || !g.world) return;
  document.body.classList.add('mode-sandbox');
  const battle = g.world.phase === 'battle';
  $('sb-fight').hidden = battle;
  $('sb-edit').hidden = !battle;
  $('sb-finish').hidden = !battle;
  $('sb-clear').hidden = battle;
  $('sb-save').hidden = battle;
  $('sb-load').hidden = battle;
  $('sb-title').readOnly = battle;
  $('sb-tools').classList.toggle('compact', battle);
}

/* ---------- scénarios enregistrés ---------- */
function buildSandboxHome() {
  const host = $('sb-list');
  host.innerHTML = '';
  const list = Sandbox.list();
  if (!list.length) {
    host.innerHTML = '<div class="sb-empty">Aucun scénario enregistré pour l\'instant. ' +
      'Composez votre champ de bataille, puis cliquez sur « Sauvegarder ».</div>';
    return;
  }
  for (const r of list) {
    const el = document.createElement('div');
    el.className = 'sb-card';
    const d = new Date(r.savedAt);
    el.innerHTML = '<h4>' + r.name + '</h4>' +
      '<div class="meta">' + r.units.length + ' unités · ' + r.features.length + ' éléments de décor<br>' +
      d.toLocaleDateString('fr-FR') + ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</div>' +
      '<div class="row"><button data-a="load">Charger</button><button data-a="del">Supprimer</button></div>';
    el.querySelector('[data-a=load]').addEventListener('click', () => {
      $('sb-loadscreen').classList.add('hidden');
      Game.openSandbox(r);
    });
    el.querySelector('[data-a=del]').addEventListener('click', () => { Sandbox.delete(r.name); buildSandboxHome(); });
    host.appendChild(el);
  }
}

/* ---------- légende ---------- */
function buildLegend() {
    for (const el of document.querySelectorAll('#legend .lg')) {
      const k = el.dataset.g;
      let col = COL.frLight;
      if (el.classList.contains('gold')) col = '#f2cf6a';
      else if (el.classList.contains('silver')) col = '#dfe6f2';
      else if (el.classList.contains('emp')) col = '#ffe08a';
      el.innerHTML = glyphSVG(k, col);
    }
  }

  return {
    $, show, buildCampaignList, fillBriefing, buildRoster, syncRoster, syncUnitCard,
    syncAuraCard, syncTopbar, banner, tooltip, result, glyphSVG, strength, roman, buildLegend,
    buildSandboxPanels, buildSandboxHome, updateSandboxCounts, syncSandboxBar,
  };
})();