/* script.js
   Tap Tempo logic and UI glue.
   Подробные комментарии внутри кода — для простоты поддержки.
*/

(function(){
  // --- Config ---
  const AUTO_RESET_MS = 3000; // >3s triggers reset
  const PASTEL_COLORS = [
    'rgba(255, 179, 186, 0.65)',
    'rgba(255, 223, 186, 0.6)',
    'rgba(255, 255, 186, 0.6)',
    'rgba(186, 255, 201, 0.6)',
    'rgba(186, 225, 255, 0.6)',
    'rgba(224, 186, 255, 0.6)'
  ];

  // --- State ---
  let taps = []; // timestamps (ms) of taps
  let lastTapAt = 0;
  let bpm = null;
  let smoothing = 8; // default averaging window
  let autoResetTimer = null;
  let metronomeEnabled = false;
  let metronomeIntervalId = null;
  let audioCtx = null;
  let metronomeGain = null;

  // --- DOM ---
  const bpmValueEl = document.getElementById('bpm-value');
  const bpmLabelEl = document.getElementById('bpm-label');
  const centerArea = document.getElementById('center-area');
  const smoothSelect = document.getElementById('smooth-select');
  const minus1 = document.getElementById('minus1');
  const plus1 = document.getElementById('plus1');
  const minus5 = document.getElementById('minus5');
  const plus5 = document.getElementById('plus5');
  const resetBtn = document.getElementById('reset');
  const copyBtn = document.getElementById('copy-bpm');
  const yearEl = document.getElementById('year');
  const metronomeToggle = document.getElementById('metronome-toggle');
  const vibrateToggle = document.getElementById('vibrate-toggle');
  const presetsList = document.getElementById('presets-list');
  const savePresetBtn = document.getElementById('save-preset');
  const clearPresetsBtn = document.getElementById('clear-presets');
  const flashOverlay = createFlashOverlay();

  // initialize UI
  yearEl.textContent = new Date().getFullYear();
  updateBpmDisplay(null);
  loadPresets();
  attachListeners();

  // -------------- Functions --------------

  function createFlashOverlay(){
    const div = document.createElement('div');
    div.className = 'flash';
    document.body.appendChild(div);
    return div;
  }

  function attachListeners(){
    // Click/tap anywhere in center-area triggers a tap
    centerArea.addEventListener('click', (e)=>{
      // If user clicked controls (buttons etc) don't count as tap
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
      handleTap();
    });

    // Touch support: a tap on touchend
    centerArea.addEventListener('touchend', (e)=>{
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
      e.preventDefault();
      handleTap();
    }, {passive:false});

    // Spacebar and other hotkeys
    window.addEventListener('keydown', (e)=>{
      // Avoid interfering when typing in inputs
      if (document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space'){
        e.preventDefault();
        handleTap();
      } else if (e.code === 'Backspace'){
        e.preventDefault();
        reset();
      } else if (e.key === 'ArrowUp'){
        e.preventDefault();
        if (e.shiftKey) adjustBpm(5); else adjustBpm(1);
      } else if (e.key === 'ArrowDown'){
        e.preventDefault();
        if (e.shiftKey) adjustBpm(-5); else adjustBpm(-1);
      } else if (e.key.toLowerCase() === 'm'){
        e.preventDefault();
        toggleMetronome();
      }
    });

    smoothSelect.addEventListener('change', (e)=>{
      smoothing = parseInt(e.target.value,10) || 8;
      recomputeBpm();
    });

    minus1.addEventListener('click', ()=>adjustBpm(-1));
    plus1.addEventListener('click', ()=>adjustBpm(1));
    minus5.addEventListener('click', ()=>adjustBpm(-5));
    plus5.addEventListener('click', ()=>adjustBpm(5));
    resetBtn.addEventListener('click', reset);
    copyBtn.addEventListener('click', copyBpmToClipboard);
    metronomeToggle.addEventListener('change', (e)=>{ metronomeEnabled = e.target.checked; updateMetronome(); });
    vibrateToggle.addEventListener('change', ()=>{}); // value read when vibrating

    savePresetBtn.addEventListener('click', saveCurrentPreset);
    clearPresetsBtn.addEventListener('click', clearPresets);

    // clicking the circle copies BPM (UX)
    document.getElementById('bpm-circle').addEventListener('click', copyBpmToClipboard);

    // When page scrolls to second slide we do nothing special; info content is static.
    // Ensure page doesn't scroll when space is pressed by default (handled above).
  }

  function handleTap(){
    const now = Date.now();
    // Visual feedback: pastel flash
    flashPastel();

    // Vibrate on supported devices and if enabled
    if (vibrateToggle.checked && navigator.vibrate){
      try{ navigator.vibrate(18); }catch(e){}
    }

    // If last tap was long ago, start fresh
    if (lastTapAt && (now - lastTapAt) > AUTO_RESET_MS){
      taps = [];
    }

    taps.push(now);
    lastTapAt = now;

    // Keep recent taps up to smoothing window + 2 (safety)
    const maxKeep = Math.max(smoothing + 2, 16);
    if (taps.length > maxKeep) taps = taps.slice(-maxKeep);

    recomputeBpm();
    scheduleAutoReset();

    // If metronome is enabled and was off, ensure it's running with new bpm
    updateMetronome();
  }

  function recomputeBpm(){
    if (taps.length < 2){
      bpm = null;
      updateBpmDisplay(null);
      return;
    }

    // Compute intervals between consecutive taps (ms)
    const intervals = [];
    for (let i=1;i<taps.length;i++){
      intervals.push(taps[i] - taps[i-1]);
    }

    // Use last N intervals for smoothing (N = smoothing - 1 basically)
    const useN = Math.min(intervals.length, Math.max(1, smoothing - 1));
    const lastIntervals = intervals.slice(-useN);

    const avgInterval = lastIntervals.reduce((a,b)=>a+b,0)/lastIntervals.length;
    const computedBpm = 60000 / avgInterval;

    // Round to 1 decimal where appropriate, but show integer mostly
    bpm = Math.round(computedBpm * 10) / 10;
    updateBpmDisplay(bpm);
  }

  function updateBpmDisplay(val){
    if (val === null || typeof val === 'undefined'){
      bpmValueEl.textContent = '—';
      bpmLabelEl.textContent = '—';
      document.title = 'Tap Tempo — by Vladimir Modenov';
    } else {
      // Show integer if it's effectively integer, else one decimal
      let display = (Math.abs(val - Math.round(val)) < 0.05) ? Math.round(val) : val.toFixed(1);
      bpmValueEl.textContent = display;
      bpmLabelEl.textContent = tempoTermForBpm(val);
      document.title = `Tap Tempo ${display} BPM — Vladimir Modenov`;
    }
    // Update presets active state (if any)
    highlightActivePreset();
  }

  function tempoTermForBpm(bpmVal){
    const b = bpmVal;
    if (b <= 20) return 'Larghissimo';
    if (b <= 40) return 'Largo';
    if (b <= 66) return 'Adagio / Larghetto';
    if (b <= 76) return 'Adagio / Andante';
    if (b <= 108) return 'Andante';
    if (b <= 120) return 'Moderato';
    if (b <= 168) return 'Allegro';
    if (b <= 200) return 'Presto';
    return 'Prestissimo';
  }

  function scheduleAutoReset(){
    if (autoResetTimer) clearTimeout(autoResetTimer);
    autoResetTimer = setTimeout(()=>{
      // reset taps but keep lastTapAt cleared
      taps = [];
      lastTapAt = 0;
      bpm = null;
      updateBpmDisplay(null);
      updateMetronome(); // stop metronome if running
    }, AUTO_RESET_MS + 20);
  }

  function reset(){
    taps = [];
    lastTapAt = 0;
    bpm = null;
    updateBpmDisplay(null);
    updateMetronome();
  }

  function adjustBpm(delta){
    if (bpm === null){
      // if no bpm yet, set a default base (e.g., 120) then adjust
      bpm = 120;
    }
    bpm = Math.max(20, Math.min(300, Math.round((bpm + delta) * 10)/10));
    updateBpmDisplay(bpm);
    saveTempBpmToTaps(bpm);
    updateMetronome();
  }

  // When user manually adjusts bpm, we invent taps array to hold this bpm for metronome continuity
  function saveTempBpmToTaps(bpmValue){
    const now = Date.now();
    // create made-up taps matching bpm: fill taps with timestamps of last few beats
    const interval = 60000 / bpmValue;
    taps = [];
    // create 6 synthetic timestamps ending now
    for (let i = 6; i >= 1; i--){
      taps.push(now - Math.round(interval * i));
    }
    taps.push(now);
    lastTapAt = now;
  }

  function copyBpmToClipboard(){
    if (!bpm) return;
    const text = String((Math.abs(bpm - Math.round(bpm)) < 0.05) ? Math.round(bpm) : bpm);
    navigator.clipboard?.writeText(text).then(()=>{
      // quick visual feedback
      flashMessage('BPM скопирован: ' + text);
    }).catch(()=>{ flashMessage('Не удалось скопировать'); });
  }

  function flashMessage(msg){
    // minimal non-blocking toast
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style,{
      position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'28px',background:'#111',color:'#fff',padding:'8px 12px',borderRadius:'8px',opacity:0.95,zIndex:9999
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),1400);
  }

  // --- Pastel flash effect ---
  function flashPastel(){
    const c = PASTEL_COLORS[Math.floor(Math.random()*PASTEL_COLORS.length)];
    flashOverlay.style.background = `linear-gradient(180deg, ${c}, rgba(255,255,255,0.6))`;
    flashOverlay.classList.add('show');
    // fade out
    setTimeout(()=>flashOverlay.classList.remove('show'), 250);
  }

  // --- Metronome using Web Audio API ---
  function ensureAudio(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      metronomeGain = audioCtx.createGain();
      metronomeGain.gain.value = 0.06; // low volume by default
      metronomeGain.connect(audioCtx.destination);
    }
  }

  function playClick(){
    try{
      ensureAudio();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      // a very short click: high freq, fast decay
      o.frequency.value = 1200;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(1.0, audioCtx.currentTime + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.06);
      o.connect(g);
      g.connect(metronomeGain);
      o.start();
      o.stop(audioCtx.currentTime + 0.07);
    }catch(e){ /* ignore WebAudio exceptions on unsupported environments */ }
  }

  function updateMetronome(){
    // Start/stop metronome according to metronomeEnabled and bpm availability
    if (metronomeEnabled && bpm){
      startMetronome();
    } else {
      stopMetronome();
    }
    // sync UI toggle
    metronomeToggle.checked = metronomeEnabled;
  }

  function startMetronome(){
    stopMetronome();
    if (!bpm) return;
    ensureAudio();
    const intervalMs = 60000 / bpm;
    // Play immediately then schedule interval
    playClick();
    metronomeIntervalId = setInterval(()=>playClick(), Math.max(40, intervalMs));
  }

  function stopMetronome(){
    if (metronomeIntervalId) {
      clearInterval(metronomeIntervalId);
      metronomeIntervalId = null;
    }
  }

  function toggleMetronome(){
    metronomeEnabled = !metronomeEnabled;
    metronomeToggle.checked = metronomeEnabled;
    updateMetronome();
  }

  // --- Presets (localStorage) ---
  const STORAGE_KEY = 'tap-tempo-presets-v1';

  function loadPresets(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      renderPresets(arr);
    }catch(e){
      renderPresets([]);
    }
  }

  function savePresets(arr){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0,30))); // keep up to 30
    renderPresets(arr);
  }

  function renderPresets(arr){
    presetsList.innerHTML = '';
    arr.forEach((p)=>{
      const btn = document.createElement('button');
      btn.className = 'preset-badge';
      btn.textContent = p + ' BPM';
      btn.title = 'Нажмите, чтобы установить';
      btn.addEventListener('click', ()=>{
        bpm = p;
        updateBpmDisplay(bpm);
        saveTempBpmToTaps(bpm);
        updateMetronome();
      });
      // right-click to remove
      btn.addEventListener('contextmenu',(e)=>{
        e.preventDefault();
        const filtered = arr.filter(x=>x!==p);
        savePresets(filtered);
      });
      presetsList.appendChild(btn);
    });
  }

  function saveCurrentPreset(){
    if (!bpm) { flashMessage('Нет значения BPM для сохранения'); return; }
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const rounded = Math.round(bpm);
      if (!arr.includes(rounded)){
        arr.unshift(rounded);
      }
      savePresets(arr);
      flashMessage('Сохранено: ' + rounded + ' BPM');
    }catch(e){
      flashMessage('Ошибка сохранения');
    }
  }

  function clearPresets(){
    localStorage.removeItem(STORAGE_KEY);
    renderPresets([]);
  }

  function highlightActivePreset(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      Array.from(presetsList.children).forEach(btn=>{
        const val = parseInt(btn.textContent,10);
        if (bpm && Math.abs(val - Math.round(bpm)) <= 1) btn.style.background = '#e8f3ff';
        else btn.style.background = '';
      });
    }catch(e){}
  }

  // --- Utilities ---


  // expose toggles for mobile vibration API
  // No external API exposure by design.

  // End of main IIFE
})();
