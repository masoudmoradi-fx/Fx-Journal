/*
 * Tradyar language layer (English default, Persian optional).
 * - Remove the single <script src="i18n.js"> line from index.html and the site is exactly the English version again.
 * - The choice is stored in localStorage ("tradyar-lang") and switches <html lang/dir>.
 * - fa.js (the English → Persian dictionary) is loaded only when Persian is active.
 * - A MutationObserver translates anything React renders later (text nodes + placeholder/title/aria-label/alt).
 */
(function () {
  'use strict';
  var KEY = 'tradyar-lang';
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap';
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  var WEEK_FA = ['د', 'س', 'چ', 'پ', 'ج', 'ش', 'ی']; // Monday-first calendar header

  var root = document.documentElement;
  var base = '';
  try { base = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, ''); } catch (e) {}

  var lang = 'en';
  try { lang = localStorage.getItem(KEY) === 'fa' ? 'fa' : 'en'; } catch (e) {}

  var FA = null, loading = null, observer = null, fontAdded = false;
  var textOrig = new WeakMap(), textOut = new WeakMap();   // Text node -> original English / last Persian we wrote
  var attrOrig = new WeakMap(), attrOut = new WeakMap();   // Element -> { attr: value }
  var cache = new Map();
  var regexes = null;

  /* ---------- translation core ---------- */
  function prepare() {
    regexes = [];
    var p = (FA && FA.patterns) || [];
    for (var i = 0; i < p.length; i++) {
      try { regexes.push({ re: new RegExp(p[i].re), fa: p[i].fa }); } catch (e) {}
    }
    cache.clear();
  }

  function dateFa(core) {
    if (!/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(core)) return null;
    var d = new Date(core + ' 12:00:00');
    if (isNaN(d.getTime())) return null;
    try { return d.toLocaleDateString('fa-IR'); } catch (e) { return null; }
  }

  function tCore(core, depth) {
    if (!FA) return core;
    if (cache.has(core)) return cache.get(core);
    var out = FA.exact[core];
    if (out === undefined) {
      out = dateFa(core);
      if (out === null) {
        out = core;
        if (depth < 3 && /[A-Za-z]/.test(core)) {
          for (var i = 0; i < regexes.length; i++) {
            var m = regexes[i].re.exec(core);
            if (m) {
              var g = m.groups || {};
              out = regexes[i].fa.replace(/\{(\d+)\}/g, function (_, k) {
                var v = g['t' + k];
                return v === undefined ? '' : tText(v, depth + 1);
              });
              break;
            }
          }
        }
      }
    }
    if (out === core && depth < 3) {
      // "• message" / "· message": translate the message, keep the marker
      var b = /^([\u2022\u00b7\-\u2013\u2014*]\s+)([\s\S]+)$/.exec(core);
      if (b) { var r1 = tCore(b[2], depth + 1); if (r1 !== b[2]) out = b[1] + r1; }
      // several messages joined with " · ": translate each piece
      if (out === core && core.indexOf(' \u00b7 ') > 0) {
        var pieces = core.split(' \u00b7 '), res = [], changed = false;
        for (var k = 0; k < pieces.length; k++) {
          var piece = pieces[k], tr;
          if (k === 0) { tr = tCore(piece, depth + 1); }
          else {
            tr = tCore('\u00b7 ' + piece, depth + 1);
            if (tr === '\u00b7 ' + piece) { var t2 = tCore(piece, depth + 1); tr = '\u00b7 ' + t2; }
          }
          if (tr !== (k === 0 ? piece : '\u00b7 ' + piece)) changed = true;
          res.push(tr);
        }
        if (changed) out = res.join(' ');
      }
    }
    if (cache.size > 5000) cache.clear();
    cache.set(core, out);
    return out;
  }

  function tText(str, depth) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str);
    if (!m[2]) return str;
    return m[1] + tCore(m[2], depth || 0) + m[3];
  }

  function weekdayLetter(node, core) {
    if (!/^[MTWFS]$/.test(core)) return null;
    var el = node.parentNode;
    for (var up = 0; el && up < 3; up++, el = el.parentNode) {
      var par = el.parentNode;
      if (par && par.children && par.children.length === 7) {
        var idx = Array.prototype.indexOf.call(par.children, el);
        return idx >= 0 ? WEEK_FA[idx] : null;
      }
    }
    return null;
  }

  /* ---------- DOM walkers ---------- */
  function skipEl(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP[n.tagName] || n.isContentEditable || (n.hasAttribute && n.hasAttribute('data-no-i18n'))) return true;
    }
    return false;
  }

  function doText(node) {
    if (lang !== 'fa' || !FA) return;
    var cur = node.data;
    if (textOut.has(node) && textOut.get(node) === cur) return; // our own output
    if (!node.parentNode || skipEl(node.parentNode)) return;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(cur);
    if (!m[2]) return;
    var wl = weekdayLetter(node, m[2]);
    var out = wl ? m[1] + wl + m[3] : tText(cur, 0);
    textOrig.set(node, cur);
    if (out !== cur) { textOut.set(node, out); node.data = out; } else { textOut.delete(node); }
  }

  function doAttrs(el) {
    if (lang !== 'fa' || !FA || skipEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var cur = el.getAttribute(a);
      var outs = attrOut.get(el);
      if (outs && outs[a] === cur) continue;
      var out = tText(cur, 0);
      var origs = attrOrig.get(el) || {}; origs[a] = cur; attrOrig.set(el, origs);
      if (out !== cur) {
        var o = outs || {}; o[a] = out; attrOut.set(el, o);
        el.setAttribute(a, out);
      }
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { doText(node); return; }
    if (node.nodeType !== 1 || SKIP[node.tagName]) return;
    doAttrs(node);
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function restore(node) {
    if (node.nodeType === 3) {
      if (textOut.has(node) && node.data === textOut.get(node)) node.data = textOrig.get(node);
      textOut.delete(node); textOrig.delete(node);
      return;
    }
    if (node.nodeType !== 1) return;
    var outs = attrOut.get(node), origs = attrOrig.get(node);
    if (outs && origs) {
      for (var a in outs) if (node.getAttribute(a) === outs[a]) node.setAttribute(a, origs[a]);
    }
    attrOut.delete(node); attrOrig.delete(node);
    for (var c = node.firstChild; c; c = c.nextSibling) restore(c);
  }

  var titleOrig = null;
  function doTitle() {
    if (lang === 'fa' && FA) {
      if (titleOrig === null) titleOrig = document.title;
      document.title = tText(titleOrig, 0);
    } else if (titleOrig !== null) { document.title = titleOrig; titleOrig = null; }
  }

  /* ---------- observer ---------- */
  function onMutations(list) {
    if (lang !== 'fa' || !FA) return;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doAttrs(r.target);
      else if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    }
  }
  function startObserver() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(onMutations);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---------- native dialogs ---------- */
  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (msg) {
      var a = Array.prototype.slice.call(arguments);
      if (lang === 'fa' && FA && a.length) a[0] = tText(String(a[0]), 0);
      return orig.apply(window, a);
    };
  });

  /* ---------- loading ---------- */
  function addFont() {
    if (fontAdded || !document.head) return;
    fontAdded = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_URL;
    document.head.appendChild(l);
  }
  function loadFA() {
    if (FA) return Promise.resolve();
    if (window.TRADYAR_FA) { FA = window.TRADYAR_FA; prepare(); return Promise.resolve(); }
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = base + 'fa.js';
      s.onload = function () { FA = window.TRADYAR_FA; prepare(); resolve(); };
      s.onerror = function () { loading = null; reject(new Error('fa.js failed to load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /* ---------- switching ---------- */
  function setAttrs(l) {
    root.lang = l;
    root.dir = l === 'fa' ? 'rtl' : 'ltr';
  }
  function updateButton() {
    // language chips rendered by the app (drawer item, login button) show the language you would switch to
    var chips = document.querySelectorAll('[data-lang-chip]');
    for (var i = 0; i < chips.length; i++) chips[i].textContent = lang === 'fa' ? 'English' : '\u0641\u0627\u0631\u0633\u06cc';
  }
  function setLang(l) {
    l = l === 'fa' ? 'fa' : 'en';
    try { localStorage.setItem(KEY, l); } catch (e) {}
    if (l === 'fa') {
      return loadFA().then(function () {
        lang = 'fa'; setAttrs('fa'); addFont();
        startObserver(); walk(document.documentElement); doTitle(); updateButton();
      }, function () { /* dictionary unavailable: stay in English */ });
    }
    lang = 'en'; setAttrs('en');
    restore(document.documentElement); doTitle(); updateButton();
    window.dispatchEvent(new Event('resize')); // let charts re-measure
    return Promise.resolve();
  }

  window.TradyarI18n = {
    setLang: setLang,
    getLang: function () { return lang; },
    toggle: function () { return setLang(lang === 'fa' ? 'en' : 'fa'); },
    t: function (s) { return lang === 'fa' && FA ? tText(String(s), 0) : s; },
    _load: function (dict) { FA = dict; prepare(); lang = 'fa'; } // used by tests
  };

  /* ---------- boot ---------- */
  if (lang === 'fa') {
    setAttrs('fa'); // direction is right before first paint
    if (document.readyState === 'loading' && base) {
      // load the dictionary synchronously so nothing is painted in English first
      document.write('<script src="' + base + 'fa.js"><\/script>');
    }
    // after the parser executes fa.js, TRADYAR_FA exists; use it on DOM ready
    var finish = function () {
      if (window.TRADYAR_FA) { FA = window.TRADYAR_FA; prepare(); addFont(); startObserver(); walk(document.documentElement); doTitle(); }
      else { lang = 'en'; setAttrs('en'); }
      updateButton();
    };
    if (window.TRADYAR_FA) { FA = window.TRADYAR_FA; prepare(); startObserver(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', finish); else finish();
  }
})();
