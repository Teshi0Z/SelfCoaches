/* ==========================================================================
   SelfCoaches — logique de l'application
   100% local : toutes les données vivent dans localStorage du navigateur.
   ========================================================================== */
(function(){
  "use strict";

  const STORAGE_KEY = "selfcoaches_data_v1";

  /* ---------------------------------------------------------------------- */
  /* Icônes SVG inline                                                      */
  /* ---------------------------------------------------------------------- */
  const ICON_PLUS = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  const ICON_EDIT = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>`;
  const ICON_TRASH = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_UPLOAD = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 20V9m0 0 4 4m-4-4-4 4M5 5h14" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor"/></svg>`;
  const ICON_TIMER_SMALL = `<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 9v4l3 2M10 2h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_LIST = `<svg viewBox="0 0 24 24" width="42" height="42"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const ICON_DUMBBELL_BIG = `<svg viewBox="0 0 24 24" width="46" height="46"><path d="M3 12h1.5M19.5 12H21M6 9v6M18 9v6M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ---------------------------------------------------------------------- */
  /* Utilitaires                                                             */
  /* ---------------------------------------------------------------------- */
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
  function escapeHtml(str){ return str == null ? "" : String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function nowISO(){ return new Date().toISOString(); }
  function toLocalDate(iso){
    if(!iso) return new Date(NaN);
    if(/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + "T00:00:00");
    return new Date(iso);
  }
  function formatDateShort(iso){
    const d = toLocalDate(iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"2-digit" });
  }
  function formatDateLong(iso){
    const d = toLocalDate(iso);
    return isNaN(d) ? String(iso) : d.toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" });
  }
  function formatMMSS(totalSeconds){
    totalSeconds = Math.max(0, Math.round(totalSeconds || 0));
    return String(Math.floor(totalSeconds / 60)).padStart(2,"0") + ":" + String(totalSeconds % 60).padStart(2,"0");
  }
  function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }

  /* ---------------------------------------------------------------------- */
  /* État + persistance locale                                              */
  /* ---------------------------------------------------------------------- */
  let state = null;
  function defaultState(){ return { version: 1, theme: "dark", routines: [] }; }
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && Array.isArray(parsed.routines) ? parsed : defaultState();
    }catch(e){ return defaultState(); }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch(e){ toast("Enregistrement impossible", "danger"); }
  }
  function normalizeImportedState(data){
    const out = { version: 1, theme: (data.theme === "light" ? "light" : "dark"), routines: [] };
    if(Array.isArray(data.routines)){
      out.routines = data.routines.map(r => ({
        id: r.id || uid(), name: typeof r.name === "string" ? r.name : "Routine", createdAt: r.createdAt || nowISO(),
        exercises: Array.isArray(r.exercises) ? r.exercises.map(e => ({
          id: e.id || uid(), name: typeof e.name === "string" ? e.name : "Exercice", restSeconds: Number.isFinite(e.restSeconds) ? e.restSeconds : 90,
          logs: Array.isArray(e.logs) ? e.logs.map(l => ({ id: l.id || uid(), date: l.date || todayISO(), reps: Number(l.reps)||0, sets: Number(l.sets)||0, weight: Number(l.weight)||0 })) : [],
          comments: Array.isArray(e.comments) ? e.comments.map(c => ({ id: c.id || uid(), date: c.date || nowISO(), text: typeof c.text === "string" ? c.text : "" })) : []
        })) : []
      }));
    }
    return out;
  }
  function findRoutine(id){ return state.routines.find(r => r.id === id) || null; }
  function findExercise(routine, id){ return routine ? (routine.exercises.find(e => e.id === id) || null) : null; }

  /* ---------------------------------------------------------------------- */
  /* Router                                                                  */
  /* ---------------------------------------------------------------------- */
  let route = { name: "routines" };
  function parseHash(){
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    if(parts[0] === "reglages") return { name: "reglages" };
    if(parts[0] === "routine" && parts[1]){
      if(parts[2] === "exercice" && parts[3]) return { name: "exercise", routineId: parts[1], exerciseId: parts[3] };
      return { name: "routine", routineId: parts[1] };
    }
    return { name: "routines" };
  }
  function navigate(hash){ 
    location.hash = hash; 
    route = parseHash();
    render();
  }
  function topRouteName(){ return route.name === "reglages" ? "reglages" : "routines"; }

  /* ---------------------------------------------------------------------- */
  /* Rendu instantané                                                        */
  /* ---------------------------------------------------------------------- */
  function render(){
    document.querySelectorAll(".side-link, .bottom-link").forEach(el => el.classList.toggle("active", el.dataset.route === topRouteName()));
    const root = document.getElementById("view-root"), backBtn = document.querySelector(".back-btn");
    let html = "", crumbs = [], actions = "";

    if(route.name === "routines"){
      backBtn.hidden = true; crumbs = [{ label: "Routines" }]; html = viewRoutinesList();
    } else if(route.name === "routine"){
      const r = findRoutine(route.routineId);
      if(!r){ route = { name: "routines" }; location.hash = "#/"; render(); return; }
      backBtn.hidden = false; crumbs = [{ label: "Routines", href: "#/" }, { label: r.name }];
      actions = `<button class="btn-icon" data-action="rename-routine" data-id="${r.id}" aria-label="Renommer">${ICON_EDIT}</button><button class="btn-icon danger" data-action="confirm-delete-routine" data-id="${r.id}" aria-label="Supprimer">${ICON_TRASH}</button>`;
      html = viewRoutineDetail(r);
    } else if(route.name === "exercise"){
      const r = findRoutine(route.routineId), ex = findExercise(r, route.exerciseId);
      if(!r || !ex){ route = { name: "routines" }; location.hash = "#/"; render(); return; }
      backBtn.hidden = false; crumbs = [{ label: "Routines", href: "#/" }, { label: r.name, href: `#/routine/${r.id}` }, { label: ex.name }];
      actions = `<button class="btn-icon" data-action="rename-exercise" data-routine="${r.id}" data-id="${ex.id}" aria-label="Renommer">${ICON_EDIT}</button><button class="btn-icon danger" data-action="confirm-delete-exercise" data-routine="${r.id}" data-id="${ex.id}" aria-label="Supprimer">${ICON_TRASH}</button>`;
      html = viewExerciseDetail(r, ex);
    } else if(route.name === "reglages"){
      backBtn.hidden = true; crumbs = [{ label: "Réglages" }]; html = viewSettings();
    }

    document.getElementById("breadcrumb").innerHTML = crumbs.map((c,i) => (i > 0 ? `<span class="crumb-sep">/</span>` : "") + (c.href && i < crumbs.length - 1 ? `<a href="${c.href}">${escapeHtml(c.label)}</a>` : `<b>${escapeHtml(c.label)}</b>`)).join("");
    document.getElementById("topbar-actions").innerHTML = actions;
    root.innerHTML = html; root.focus({ preventScroll: true });
    if(route.name === "exercise") initTimerUI();
  }

  function viewRoutinesList(){
    if(state.routines.length === 0) return `<div class="page-head"><div><h1>Routines</h1></div></div><div class="empty">${ICON_DUMBBELL_BIG}<h3>Aucune routine</h3><button class="btn btn-primary" data-action="new-routine">${ICON_PLUS} Nouvelle routine</button></div>`;
    const cards = state.routines.map(r => `<div class="card" data-action="open-routine" data-id="${r.id}"><div class="card-row-actions"><button class="btn-icon" data-action="rename-routine" data-id="${r.id}" title="Renommer">${ICON_EDIT}</button><button class="btn-icon danger" data-action="confirm-delete-routine" data-id="${r.id}" title="Supprimer">${ICON_TRASH}</button></div><div class="card-title">${escapeHtml(r.name)}</div><div class="card-meta">Créée le ${formatDateShort(r.createdAt)}</div><div class="card-stats"><div class="stat"><b>${r.exercises.length}</b><span>Exos</span></div><div class="stat"><b>${r.exercises.reduce((s,e)=>s+e.logs.length,0)}</b><span>Séances</span></div></div></div>`).join("");
    return `<div class="page-head"><div><h1>Routines</h1></div><div class="page-head-actions"><button class="btn btn-primary" data-action="new-routine">${ICON_PLUS} Nouvelle routine</button></div></div><div class="grid">${cards}</div>`;
  }

  function viewRoutineDetail(r){
    const body = r.exercises.length === 0 ? `<div class="empty">${ICON_LIST}<h3>Pas d'exercice</h3><button class="btn btn-primary" data-action="new-exercise" data-routine="${r.id}">${ICON_PLUS} Ajouter un exercice</button></div>` : `<div class="list">${r.exercises.map(e => {
      const last = e.logs.length ? e.logs[e.logs.length - 1] : null;
      return `<div class="list-row" data-action="open-exercise" data-routine="${r.id}" data-id="${e.id}"><div class="list-row-main"><div class="list-row-title">${escapeHtml(e.name)}</div><div class="list-row-meta">${last ? `<span>Dernier : <b>${last.weight}kg (${last.sets}×${last.reps})</b></span>` : `<span>Aucune séance</span>`} <span class="pill">${ICON_TIMER_SMALL} ${formatMMSS(e.restSeconds)}</span></div></div><div class="list-row-actions"><button class="btn-icon" data-action="rename-exercise" data-routine="${r.id}" data-id="${e.id}" title="Renommer">${ICON_EDIT}</button><button class="btn-icon danger" data-action="confirm-delete-exercise" data-routine="${r.id}" data-id="${e.id}" title="Supprimer">${ICON_TRASH}</button></div></div>`;
    }).join("")}</div>`;
    return `<div class="page-head"><div><h1>${escapeHtml(r.name)}</h1></div><div class="page-head-actions">${r.exercises.length>0 ? `<button class="btn btn-primary" data-action="new-exercise" data-routine="${r.id}">${ICON_PLUS} Ajouter</button>` : ""}</div></div>${body}`;
  }

  function viewExerciseDetail(r, ex){
    const sortedLogs = [...ex.logs].sort((a,b) => toLocalDate(b.date) - toLocalDate(a.date));
    const maxWeight = ex.logs.length ? Math.max(...ex.logs.map(l => l.weight)) : null;
    
    // MÉMOIRE AUTOMATIQUE ROBUSTE DE LA DERNIÈRE SÉANCE 🧠
    const lastLog = ex.logs.length ? ex.logs[ex.logs.length - 1] : null;
    const defReps = lastLog ? lastLog.reps : 10;
    const defSets = lastLog ? lastLog.sets : 3;
    const defWeight = lastLog ? lastLog.weight : 0;

    const restMin = Math.floor((ex.restSeconds || 90) / 60);
    const restSec = (ex.restSeconds || 90) % 60;

    const chartBlock = ex.logs.length < 2 ? `<div class="chart-empty">Encore ${2 - ex.logs.length} séance(s) pour afficher le graphique de progression.</div>` : `<div class="chart-wrap">${buildChartSVG(ex.logs)}</div>`;
    const historyBlock = sortedLogs.length === 0 ? `<p class="hint" style="color:var(--text-dim); padding:10px 0;">Aucune séance enregistrée.</p>` : sortedLogs.map(l => `<div class="history-row"><span class="history-date">${formatDateShort(l.date)}</span><span class="history-main"><span class="history-weight">${l.weight}kg</span><span>${l.sets} séries de ${l.reps} reps</span></span><button class="btn-icon danger" data-action="confirm-delete-log" data-routine="${r.id}" data-exercise="${ex.id}" data-log="${l.id}" title="Supprimer cette séance">${ICON_CLOSE}</button></div>`).join("");
    const commentsBlock = [...ex.comments].sort((a,b) => toLocalDate(b.date) - toLocalDate(a.date)).map(c => `<div class="comment"><div class="comment-head"><span class="comment-date">${formatDateLong(c.date)}</span><button class="btn-icon danger" data-action="confirm-delete-comment" data-routine="${r.id}" data-exercise="${ex.id}" data-comment="${c.id}" title="Supprimer">${ICON_CLOSE}</button></div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join("") || `<p class="hint" style="color:var(--text-dim); font-size:13px;">Aucun commentaire.</p>`;

    return `
      <div class="page-head"><div><h1>${escapeHtml(ex.name)}</h1><p class="sub">${maxWeight!=null ? `Record actuel : ${maxWeight} kg` : "Pas de record"}</p></div></div>

      <div class="panel">
        <div class="panel-title">Temps de repos</div>
        <div class="timer-wrap">
          <div class="ring" id="restRing"><svg viewBox="0 0 104 104"><circle class="ring-bg" cx="52" cy="52" r="46"></circle><circle class="ring-fg" id="ringFg" cx="52" cy="52" r="46" stroke-dasharray="289" stroke-dashoffset="0"></circle></svg><div class="ring-label" id="ringLabel">${formatMMSS(ex.restSeconds)}</div></div>
          <div class="timer-controls">
            <div class="timer-set">
              <span style="font-size:13px; color:var(--text-dim);">Minutes :</span>
              <div class="stepper" style="width:130px;">
                <button type="button" data-action="step-down" data-target="restMin" data-step="1" data-min="0" data-max="59">−</button>
                <input type="number" id="restMin" min="0" max="59" value="${restMin}" readonly>
                <button type="button" data-action="step-up" data-target="restMin" data-step="1" data-min="0" data-max="59">+</button>
              </div>
              <span style="font-size:13px; color:var(--text-dim); margin-left:8px;">Secondes :</span>
              <div class="stepper" style="width:130px;">
                <button type="button" data-action="step-down" data-target="restSec" data-step="5" data-min="0" data-max="59">−</button>
                <input type="number" id="restSec" min="0" max="59" value="${restSec}" readonly>
                <button type="button" data-action="step-up" data-target="restSec" data-step="5" data-min="0" data-max="59">+</button>
              </div>
              <button class="btn btn-secondary" data-action="save-rest" data-routine="${r.id}" data-exercise="${ex.id}" style="margin-left:auto;">Enregistrer</button>
            </div>
            <div class="timer-actions"><button class="btn btn-primary" id="timerStartBtn" data-action="timer-start">${ICON_PLAY} Démarrer</button><button class="btn btn-secondary" data-action="timer-reset">Reset</button></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Nouvelle séance (Pré-rempli avec la dernière)</div>
        <form data-action="log-submit" data-routine="${r.id}" data-exercise="${ex.id}">
          
          <div class="field-row" style="margin-bottom:12px;">
            <div class="field"><label for="logReps">Répétitions</label>
              <div class="stepper">
                <button type="button" data-action="step-down" data-target="logReps" data-step="1" data-min="0">−</button>
                <input type="number" id="logReps" inputmode="numeric" min="0" required value="${defReps}" readonly>
                <button type="button" data-action="step-up" data-target="logReps" data-step="1">+</button>
              </div>
            </div>
            <div class="field"><label for="logSets">Séries</label>
              <div class="stepper">
                <button type="button" data-action="step-down" data-target="logSets" data-step="1" data-min="0">−</button>
                <input type="number" id="logSets" inputmode="numeric" min="0" required value="${defSets}" readonly>
                <button type="button" data-action="step-up" data-target="logSets" data-step="1">+</button>
              </div>
            </div>
          </div>
          
          <div class="field" style="margin-bottom:16px;"><label for="logWeight">Poids (kg)</label>
            <div class="stepper">
              <button type="button" data-action="step-down" data-target="logWeight" data-step="0.5" data-min="0">−</button>
              <input type="number" id="logWeight" inputmode="decimal" min="0" step="0.5" required value="${defWeight}" readonly>
              <button type="button" data-action="step-up" data-target="logWeight" data-step="0.5">+</button>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block">Enregistrer la séance</button>
        </form>
      </div>

      <div class="panel">
        <div class="panel-title">Progression (Poids par date)</div>
        ${chartBlock}
      </div>

      <div class="panel">
        <div class="panel-title">Historique des séances</div>
        <div class="list">${historyBlock}</div>
      </div>

      <div class="panel">
        <div class="panel-title">Commentaires & Forme du jour</div>
        <form data-action="comment-submit" data-routine="${r.id}" data-exercise="${ex.id}" style="margin-bottom:14px;">
          <div class="field" style="margin-bottom:10px;"><textarea id="commentText" placeholder="Ex : super forme, bonne congestion..." required></textarea></div>
          <button type="submit" class="btn btn-secondary">Ajouter le commentaire</button>
        </form>
        ${commentsBlock}
      </div>`;
  }

  function viewSettings(){
    return `<div class="page-head"><div><h1>Réglages</h1><p class="sub">Gestion des données & affichage</p></div></div><div class="panel"><div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border);"><div class="settings-row-text"><h3>Thème de l'application</h3><p style="font-size:13px; color:var(--text-dim);">Noir/Bleu ou Blanc/Orange</p></div><button class="btn btn-secondary" data-action="toggle-theme">Changer de thème</button></div><div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid var(--border);"><div class="settings-row-text"><h3>Exporter les données</h3><p style="font-size:13px; color:var(--text-dim);">Sauvegarde JSON locale</p></div><button class="btn btn-secondary" data-action="export-data">${ICON_DOWNLOAD} Exporter</button></div><div class="settings-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0;"><div class="settings-row-text"><h3>Importer des données</h3><p style="font-size:13px; color:var(--text-dim);">Restaurer un fichier de sauvegarde</p></div><button class="btn btn-secondary" data-action="trigger-import">${ICON_UPLOAD} Importer</button></div></div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Graphiques SVG clairs et responsifs                                    */
  /* ---------------------------------------------------------------------- */
  function buildChartSVG(logs){
    if(logs.length < 2) return "";
    const sorted = [...logs].sort((a,b) => toLocalDate(a.date) - toLocalDate(b.date));
    const weights = sorted.map(l => l.weight), minW = Math.min(...weights), maxW = Math.max(...weights);
    const pad = { top:30, right:30, bottom:36, left:44 }, w = Math.max(500, sorted.length * 80), h = 220;
    const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom, range = (maxW - minW) || 1;
    const stepX = sorted.length > 1 ? plotW / (sorted.length - 1) : 0;
    
    const points = sorted.map((l,i) => ({
      x: pad.left + stepX * i,
      y: pad.top + plotH - ((l.weight - minW) / range) * plotH,
      log: l
    }));

    let linePath = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for(let i=0; i<points.length-1; i++){
      linePath += ` L ${points[i+1].x.toFixed(1)},${points[i+1].y.toFixed(1)}`;
    }
    const areaPath = `${linePath} L ${points[points.length-1].x.toFixed(1)},${(pad.top+plotH).toFixed(1)} L ${points[0].x.toFixed(1)},${(pad.top+plotH).toFixed(1)} Z`;
    const gid = "grad_" + uid();
    
    const pointsMarkup = points.map(p => `
      <circle class="chart-point${p.log.weight===maxW ? " pr" : ""}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5">
        <title>${formatDateShort(p.log.date)} — ${p.log.weight}kg (${p.log.sets}×${p.log.reps})</title>
      </circle>
      <text class="chart-axis-label" x="${p.x.toFixed(1)}" y="${p.y - 12}" text-anchor="middle" font-weight="700">${p.log.weight}kg</text>
    `).join("");

    const labelsMarkup = points.map(p => `
      <text class="chart-axis-label" x="${p.x.toFixed(1)}" y="${h - 10}" text-anchor="middle">${formatDateShort(p.log.date)}</text>
    `).join("");

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient>
      </defs>
      <line class="chart-gridline" x1="${pad.left}" y1="${pad.top}" x2="${w - pad.right}" y2="${pad.top}"/>
      <line class="chart-gridline" x1="${pad.left}" y1="${pad.top + plotH/2}" x2="${w - pad.right}" y2="${pad.top + plotH/2}"/>
      <line class="chart-gridline" x1="${pad.left}" y1="${pad.top + plotH}" x2="${w - pad.right}" y2="${pad.top + plotH}"/>
      
      <path d="${areaPath}" fill="url(#${gid})" stroke="none"/>
      <path d="${linePath}" class="chart-line"/>
      ${pointsMarkup}
      ${labelsMarkup}
      <text class="chart-axis-label" x="${pad.left - 8}" y="${pad.top + 4}" text-anchor="end">${maxW}kg</text>
      <text class="chart-axis-label" x="${pad.left - 8}" y="${pad.top + plotH + 4}" text-anchor="end">${minW}kg</text>
    </svg>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Modales & Double Confirmation pour Suppression                         */
  /* ---------------------------------------------------------------------- */
  function openModal(html){ const mr = document.getElementById("modal-root"); mr.innerHTML = `<div class="modal">${html}</div>`; mr.classList.add("open"); mr.setAttribute("aria-hidden","false"); }
  function closeModal(){ const mr = document.getElementById("modal-root"); mr.classList.remove("open"); mr.innerHTML = ""; }

  function modalNewRoutine(){ 
    openModal(`<h2>Nouvelle routine</h2><form data-action="submit-new-routine"><div class="field" style="margin-bottom:16px;"><label for="routineName">Nom de la routine</label><input type="text" id="routineName" placeholder="Ex : Haut du corps, Jambes..." required autofocus></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary">Créer</button></div></form>`); 
  }
  function modalRenameRoutine(r){ 
    openModal(`<h2>Renommer la routine</h2><form data-action="submit-rename-routine" data-id="${r.id}"><div class="field" style="margin-bottom:16px;"><input type="text" id="renameInput" required value="${escapeHtml(r.name)}" autofocus></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div></form>`); 
  }
  function modalNewExercise(rId){ 
    openModal(`<h2>Nouvel exercice</h2><form data-action="submit-new-exercise" data-routine="${rId}"><div class="field" style="margin-bottom:16px;"><label for="exerciseName">Nom de l'exercice</label><input type="text" id="exerciseName" placeholder="Ex : Développé couché, Tractions..." required autofocus></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary">Terminer</button></div></form>`); 
  }
  function modalRenameExercise(r, ex){ 
    openModal(`<h2>Renommer l'exercice</h2><form data-action="submit-rename-exercise" data-routine="${r.id}" data-id="${ex.id}"><div class="field" style="margin-bottom:16px;"><input type="text" id="renameInput" required value="${escapeHtml(ex.name)}" autofocus></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary">Enregistrer</button></div></form>`); 
  }

  function confirmDeleteRoutine(id){
    const r = findRoutine(id);
    if(!r) return;
    openModal(`<h2>Confirmer la suppression</h2><p>Voulez-vous vraiment supprimer la routine <b>${escapeHtml(r.name)}</b> ? Cette action est irréversible et effacera tous ses exercices et historique.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="button" class="btn btn-danger" data-action="execute-delete-routine" data-id="${id}">Oui, supprimer définitivement</button></div>`);
  }
  function confirmDeleteExercise(rId, exId){
    const r = findRoutine(rId), ex = findExercise(r, exId);
    if(!ex) return;
    openModal(`<h2>Confirmer la suppression</h2><p>Voulez-vous vraiment supprimer l'exercice <b>${escapeHtml(ex.name)}</b> ? Tout l'historique associé sera perdu.</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="button" class="btn btn-danger" data-action="execute-delete-exercise" data-routine="${rId}" data-id="${exId}">Oui, supprimer définitivement</button></div>`);
  }
  function confirmDeleteLog(rId, exId, logId){
    openModal(`<h2>Confirmer la suppression</h2><p>Voulez-vous supprimer cette séance de l'historique ?</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="button" class="btn btn-danger" data-action="execute-delete-log" data-routine="${rId}" data-exercise="${exId}" data-log="${logId}">Supprimer</button></div>`);
  }
  function confirmDeleteComment(rId, exId, cId){
    openModal(`<h2>Confirmer la suppression</h2><p>Voulez-vous supprimer ce commentaire ?</p><div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="button" class="btn btn-danger" data-action="execute-delete-comment" data-routine="${rId}" data-exercise="${exId}" data-comment="${cId}">Supprimer</button></div>`);
  }

  /* ---------------------------------------------------------------------- */
  /* Actions & Timer interactif avec bascule Démarrer / Pause               */
  /* ---------------------------------------------------------------------- */
  let timerInterval = null, timerRemaining = 0, timerTotal = 0, isTimerRunning = false;

  function initTimerUI(){ 
    stopTimer(); 
    isTimerRunning = false; 
    updateTimerButtonState(); 
  }
  function stopTimer(){ 
    if(timerInterval) clearInterval(timerInterval); 
    timerInterval = null; 
  }
  function updateTimerButtonState(){
    const btn = document.getElementById("timerStartBtn");
    if(!btn) return;
    if(isTimerRunning){
      btn.innerHTML = `${ICON_PAUSE} Pause`;
      btn.className = "btn btn-secondary";
    } else {
      btn.innerHTML = `${ICON_PLAY} ${timerRemaining > 0 && timerRemaining < timerTotal ? "Reprendre" : "Démarrer"}`;
      btn.className = "btn btn-primary";
    }
  }
  function toggleTimer(){
    if(isTimerRunning){
      stopTimer();
      isTimerRunning = false;
      updateTimerButtonState();
    } else {
      const minEl = document.getElementById("restMin"), secEl = document.getElementById("restSec");
      if(timerRemaining <= 0){
        timerTotal = timerRemaining = clamp((parseInt(minEl.value)||0)*60 + (parseInt(secEl.value)||0), 1, 3599);
      }
      isTimerRunning = true;
      updateTimerButtonState();
      stopTimer(); 
      updateTimerDisplay();
      timerInterval = setInterval(() => {
        if(--timerRemaining <= 0){
          timerRemaining = 0; 
          stopTimer(); 
          isTimerRunning = false; 
          updateTimerButtonState(); 
          updateTimerDisplay(); 
          toast("Temps de repos terminé ⏱", "success"); 
          return; 
        }
        updateTimerDisplay();
      }, 1000);
    }
  }
  function resetRestTimer(){ 
    stopTimer(); 
    isTimerRunning = false; 
    const minEl = document.getElementById("restMin"), secEl = document.getElementById("restSec"); 
    timerTotal = timerRemaining = (parseInt(minEl.value)||0)*60 + (parseInt(secEl.value)||0); 
    updateTimerButtonState();
    updateTimerDisplay(); 
  }
  function updateTimerDisplay(){ 
    const label = document.getElementById("ringLabel"), ringFg = document.getElementById("ringFg"); 
    if(label) label.textContent = formatMMSS(timerRemaining); 
    if(ringFg) ringFg.style.strokeDashoffset = String((2*Math.PI*46) * (1-(timerTotal>0?timerRemaining/timerTotal:0))); 
  }

  function toast(msg, type){ 
    const root = document.getElementById("toast-root"), el = document.createElement("div"); 
    el.className = "toast" + (type ? " " + type : ""); el.textContent = msg; 
    root.appendChild(el); setTimeout(() => el.remove(), 3000); 
  }

  function handleClick(e){
    if(e.target.id === "modal-root"){ closeModal(); return; }
    const actionEl = e.target.closest("[data-action]");
    if(!actionEl) return;
    const action = actionEl.dataset.action;

    switch(action){
      case "toggle-theme": 
        state.theme = state.theme === "dark" ? "light" : "dark"; 
        document.documentElement.setAttribute("data-theme", state.theme); 
        saveState(); 
        break;
      case "go-back": 
        navigate(route.name === "exercise" ? `#/routine/${route.routineId}` : "#/"); 
        break;
      case "new-routine": modalNewRoutine(); break;
      case "open-routine": navigate(`#/routine/${actionEl.dataset.id}`); break;
      case "rename-routine": modalRenameRoutine(findRoutine(actionEl.dataset.id)); break;
      
      case "confirm-delete-routine": confirmDeleteRoutine(actionEl.dataset.id); break;
      case "execute-delete-routine": 
        state.routines = state.routines.filter(x => x.id !== actionEl.dataset.id); 
        saveState(); closeModal(); navigate("#/"); toast("Routine supprimée", "danger"); 
        break;

      case "new-exercise": modalNewExercise(actionEl.dataset.routine); break;
      case "open-exercise": navigate(`#/routine/${actionEl.dataset.routine}/exercice/${actionEl.dataset.id}`); break;
      case "rename-exercise": modalRenameExercise(findRoutine(actionEl.dataset.routine), findExercise(findRoutine(actionEl.dataset.routine), actionEl.dataset.id)); break;
      
      case "confirm-delete-exercise": confirmDeleteExercise(actionEl.dataset.routine, actionEl.dataset.id); break;
      case "execute-delete-exercise": { 
        const r = findRoutine(actionEl.dataset.routine); 
        r.exercises = r.exercises.filter(x => x.id !== actionEl.dataset.id); 
        saveState(); closeModal(); navigate(`#/routine/${r.id}`); toast("Exercice supprimé", "danger"); 
        break; 
      }

      case "confirm-delete-log": confirmDeleteLog(actionEl.dataset.routine, actionEl.dataset.exercise, actionEl.dataset.log); break;
      case "execute-delete-log": { 
        const ex = findExercise(findRoutine(actionEl.dataset.routine), actionEl.dataset.exercise); 
        ex.logs = ex.logs.filter(l => l.id !== actionEl.dataset.log); 
        saveState(); closeModal(); render(); toast("Séance supprimée", "danger"); 
        break; 
      }

      case "confirm-delete-comment": confirmDeleteComment(actionEl.dataset.routine, actionEl.dataset.exercise, actionEl.dataset.comment); break;
      case "execute-delete-comment": {
        const ex = findExercise(findRoutine(actionEl.dataset.routine), actionEl.dataset.exercise);
        ex.comments = ex.comments.filter(c => c.id !== actionEl.dataset.comment);
        saveState(); closeModal(); render(); toast("Commentaire supprimé");
        break;
      }

      case "close-modal": closeModal(); break;
      case "timer-start": toggleTimer(); break;
      case "timer-reset": resetRestTimer(); break;
      case "save-rest": { 
        const ex = findExercise(findRoutine(actionEl.dataset.routine), actionEl.dataset.exercise); 
        ex.restSeconds = (parseInt(document.getElementById("restMin").value)||0)*60 + (parseInt(document.getElementById("restSec").value)||0); 
        saveState(); toast("Temps de repos sauvegardé", "success"); 
        break; 
      }
      
      case "step-up": {
        const target = document.getElementById(actionEl.dataset.target);
        if(target){
          const step = parseFloat(actionEl.dataset.step) || 1;
          const max = actionEl.dataset.max !== undefined ? parseFloat(actionEl.dataset.max) : Infinity;
          const current = parseFloat(target.value) || 0;
          const newVal = Math.min(max, current + step);
          target.value = target.step === "0.5" ? newVal.toFixed(1) : newVal;
        }
        break;
      }
      case "step-down": {
        const target = document.getElementById(actionEl.dataset.target);
        if(target){
          const step = parseFloat(actionEl.dataset.step) || 1;
          const min = actionEl.dataset.min !== undefined ? parseFloat(actionEl.dataset.min) : 0;
          const current = parseFloat(target.value) || 0;
          const newVal = Math.max(min, current - step);
          target.value = target.step === "0.5" ? newVal.toFixed(1) : newVal;
        }
        break;
      }

      case "export-data": exportData(); break;
      case "trigger-import": document.getElementById("import-file-input").click(); break;
    }
  }

  function handleSubmit(e){
    const form = e.target.closest("form[data-action]");
    if(!form) return;
    e.preventDefault();
    const action = form.dataset.action;

    switch(action){
      case "submit-new-routine": 
        state.routines.push({ id: uid(), name: document.getElementById("routineName").value.trim(), createdAt: nowISO(), exercises: [] }); 
        saveState(); closeModal(); render(); toast("Routine créée", "success"); 
        break;
      case "submit-rename-routine": 
        findRoutine(form.dataset.id).name = document.getElementById("renameInput").value.trim(); 
        saveState(); closeModal(); render(); toast("Routine renommée"); 
        break;
      case "submit-new-exercise": 
        findRoutine(form.dataset.routine).exercises.push({ id: uid(), name: document.getElementById("exerciseName").value.trim(), restSeconds: 90, logs: [], comments: [] }); 
        saveState(); closeModal(); render(); toast("Exercice ajouté", "success"); 
        break;
      case "submit-rename-exercise": 
        findExercise(findRoutine(form.dataset.routine), form.dataset.id).name = document.getElementById("renameInput").value.trim(); 
        saveState(); closeModal(); render(); toast("Exercice renommé"); 
        break;
      case "log-submit": {
        const ex = findExercise(findRoutine(form.dataset.routine), form.dataset.exercise);
        const reps = Number(document.getElementById("logReps").value);
        const sets = Number(document.getElementById("logSets").value);
        const weight = Number(document.getElementById("logWeight").value);
        const prevMax = ex.logs.length ? Math.max(...ex.logs.map(l => l.weight)) : 0;

        ex.logs.push({ id: uid(), date: todayISO(), reps, sets, weight });
        saveState(); render(); 

        if(ex.logs.length > 1 && weight > prevMax) toast(`Nouveau record : ${weight}kg 🎉`, "record");
        else toast("Séance enregistrée 💪", "success");
        break;
      }
      case "comment-submit": 
        findExercise(findRoutine(form.dataset.routine), form.dataset.exercise).comments.push({ id: uid(), date: nowISO(), text: document.getElementById("commentText").value.trim() }); 
        saveState(); render(); toast("Commentaire ajouté"); 
        break;
    }
  }

  function exportData(){
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `selfcoaches_backup_${todayISO()}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    toast("Export réussi", "success");
  }

  function handleImportFileChange(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      try{
        const parsed = JSON.parse(evt.target.result);
        state = normalizeImportedState(parsed);
        saveState();
        document.documentElement.setAttribute("data-theme", state.theme);
        render();
        toast("Données importées avec succès", "success");
      }catch(err){
        toast("Erreur lors de l'importation du fichier", "danger");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function init(){
    state = loadState(); 
    document.documentElement.setAttribute("data-theme", state.theme);
    if(!location.hash) location.hash = "#/";
    route = parseHash(); 
    render();

    document.addEventListener("click", handleClick); 
    document.addEventListener("submit", handleSubmit);
    const fileInput = document.getElementById("import-file-input");
    if(fileInput) fileInput.addEventListener("change", handleImportFileChange);
    window.addEventListener("hashchange", () => { route = parseHash(); render(); window.scrollTo(0,0); });
  }

  init();
})();
