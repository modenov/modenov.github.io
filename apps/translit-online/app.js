// Plain JS transliteration tuned for SEO slugs/URLs.
// - Base map for Russian→Latin with configurable variants for ё, й, ц, щ, э.
// - Two case modes: 'lower' (recommended) and 'original' (preserve caps best‑effort).
// - Sanitization: keep [a-z0-9] plus chosen separator; collapse repeats; trim edges.

(function(){
  const els = {
    src: document.getElementById('src'),
    dst: document.getElementById('dst'),
    convert: document.getElementById('convertBtn'),
    copy: document.getElementById('copyBtn'),
    clear: document.getElementById('clearBtn')
  };

  // Dynamic year in footer
  document.getElementById('year').textContent = new Date().getFullYear();

  // Read radio value helper
  function val(name){
    const i = document.querySelector(`input[name="${name}"]:checked`);
    return i ? i.value : '';
  }

  // Build transliteration map based on current settings
  function buildMap(){
    const yo = val('yo');        // 'yo' or 'e' for 'ё'
    const iy = val('iy');        // 'j' or 'y' for 'й'
    const ts = val('ts');        // 'c' or 'ts' for 'ц'
    const shch = val('shch');    // 'shch' | 'sch' | 'shh' for 'щ'
    const eh = val('eh');        // 'eh' or 'e' for 'э'

    const base = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':yo,'ж':'zh','з':'z','и':'i','й':iy,
      'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
      'х':'h',
      'ц':ts,
      'ч':'ch','ш':'sh','щ':shch,'ъ':'','ы':'y','ь':'','э':eh,'ю':'yu','я':'ya'
    };
    return base;
  }

  // Preserve capitalization best‑effort for original case
  function applyCase(srcChar, chunk, preserve){
    if(!preserve) return chunk.toLowerCase();
    if(srcChar.toUpperCase() === srcChar && srcChar.toLowerCase() !== srcChar){
      if(!chunk) return '';
      return chunk.charAt(0).toUpperCase() + chunk.slice(1);
    }
    return chunk;
  }

  function transliterateText(input){
    const caseMode = val('case');
    const preserve = (caseMode === 'original');
    const sep = val('sep');
    const map = buildMap();

    let out = '';
    for(const ch of input){
      const lower = ch.toLowerCase();
      if(Object.prototype.hasOwnProperty.call(map, lower)){
        out += applyCase(ch, map[lower], preserve);
      } else {
        out += ch;
      }
    }

    // Normalize whitespace
    out = out.replace(/[\s\t\n\r]+/g, ' ');

    if(!preserve){
      out = out.toLowerCase();
    }

    // Replace spaces with chosen separator
    out = out.replace(/ /g, sep);

    // Allow only [a-z0-9] and the chosen separator
    const escSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allowed = `a-z0-9${escSep}`;
    const disallowedRe = new RegExp(`[^${allowed}]`, 'g');
    out = out.replace(disallowedRe, sep);

    // Collapse repeated separators
    const collapseRe = new RegExp(`${escSep}{2,}`, 'g');
    out = out.replace(collapseRe, sep);

    // Trim separators at edges
    const trimRe = new RegExp(`^${escSep}|${escSep}$`, 'g');
    out = out.replace(trimRe, '');

    // If separator is space, also trim extra spaces
    if(sep === ' '){
      out = out.replace(/\s{2,}/g, ' ').trim();
    }

    return out;
  }

  function doConvert(){
    els.dst.value = transliterateText(els.src.value);
  }

  els.convert.addEventListener('click', doConvert);

  els.copy.addEventListener('click', async () => {
    try{
      await navigator.clipboard.writeText(els.dst.value);
      feedback(els.copy, 'Скопировано!');
    }catch(err){
      // Fallback: select text and let user copy
      els.dst.removeAttribute('readonly');
      els.dst.select();
      const ok = document.execCommand && document.execCommand('copy');
      els.dst.setAttribute('readonly','');
      feedback(els.copy, ok ? 'Скопировано!' : 'Скопируйте вручную');
    }
  });

  els.clear.addEventListener('click', () => {
    els.src.value = '';
    els.src.focus();
  });

  // Live re-convert on settings change
  document.querySelectorAll('.settings input[type="radio"]').forEach(r => {
    r.addEventListener('change', doConvert);
  });

  function feedback(btn, text){
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(()=>btn.textContent = old, 900);
  }
})();