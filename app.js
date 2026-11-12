"use strict";
"use strict";
const { useState, useEffect, useMemo, useRef } = React;
const { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, Legend, ComposedChart } = Recharts;
try { for (const k of ['Bar', 'Area', 'Line']) { const T = Recharts[k]; if (T && T.defaultProps) T.defaultProps = Object.assign({}, T.defaultProps, { animationDuration: 1100, animationEasing: 'ease-out', animationBegin: 120 }); } } catch (e) { }
const SB_URL = 'https://ukhqzgvhbdrtkzpokrvk.supabase.co';
const SB_KEY = 'sb_publishable_KQhud6UbQqcRvhkb1sXStw_Uon9XyX3';
let sb = null;
try { if (window.supabase) sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }
function h32(str) { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0; return x + ':' + str.length; }
const Cloud = {
    uid: null, timers: {}, status: 'ok', err: '', subs: new Set(),
    setStatus(st, err) { this.status = st; this.err = err || ''; this.subs.forEach(f => { try { f(st, this.err); } catch (e) { } }); },
    ns() { return 'sb:' + this.uid + ':'; },
    dirty() { try { return JSON.parse(localStorage.getItem(this.ns() + '__dirty') || '[]'); } catch (e) { return []; } },
    setDirty(a) { try { localStorage.setItem(this.ns() + '__dirty', JSON.stringify(a)); } catch (e) { } },
    mark(k) { const d = this.dirty(); if (!d.includes(k)) { d.push(k); this.setDirty(d); } },
    unmark(k) { this.setDirty(this.dirty().filter(x => x !== k)); },
    async flush(k) {
        if (!sb || !this.uid) return;
        const v = localStorage.getItem(this.ns() + k);
        if (v === null) {
            this.unmark(k);
            if (!this.dirty().length) this.setStatus('ok');
            return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.setStatus('offline'); throw new Error('offline'); }
        let error = null, out = v, merged = false;
        try {
            // اگر از آخرین همگام‌سازی این دستگاه، دستگاه دیگری روی همین کلید نوشته باشد، اطلاعات آن را نباید بی‌صدا بازنویسی کرد
            const cur = await sb.from('user_data').select('value').eq('user_id', this.uid).eq('key', k).maybeSingle();
            if (cur.error) throw cur.error;
            if (cur.data && cur.data.value != null) {
                const sh = h32(String(cur.data.value)), base = localStorage.getItem(this.ns() + '__base:' + k);
                if (sh !== base && sh !== h32(v) && k === 'journal-trades') {
                    try {
                        const sv = JSON.parse(cur.data.value), lv = JSON.parse(v), ids = new Set(lv.map(t => t.id));
                        const extra = sv.filter(t => !ids.has(t.id));
                        if (extra.length) { out = JSON.stringify(lv.concat(extra)); merged = true; }
                    } catch (e0) { }
                }
            }
            const r = await sb.from('user_data').upsert({ user_id: this.uid, key: k, value: out, updated_at: new Date().toISOString() });
            error = r.error;
        }
        catch (e) { error = e; }
        if (!error) {
            try { localStorage.setItem(this.ns() + '__base:' + k, h32(out)); } catch (e1) { }
            if (merged) {
                try { localStorage.setItem(this.ns() + k, out); } catch (e2) { }
                setTimeout(() => { try { window.alert('روی دستگاه دیگری معامله‌ی جدیدتری ثبت شده بود؛ هر دو ادغام شدند. صفحه دوباره بارگذاری می‌شود.'); } catch (e3) { } location.reload(); }, 400);
            }
        }
        if (error) {
            this.setStatus(/row-level security|42501|violates/i.test(String((error.code || '') + ' ' + (error.message || ''))) ? 'locked' : 'error', error.message || '');
            throw error;
        }
        this.unmark(k);
        if (!this.dirty().length) this.setStatus('ok');
    },
    queue(k) { this.mark(k); this.setStatus('pending'); clearTimeout(this.timers[k]); this.timers[k] = setTimeout(() => { this.flush(k).catch(() => { }); }, 700); },
    async retry() {
        const d = this.dirty();
        if (!d.length) { this.setStatus('ok'); return true; }
        this.setStatus('pending');
        let ok = true;
        for (const k of d) { try { await this.flush(k); } catch (e) { ok = false; } }
        return ok;
    },
    hook() {
        if (this._h) return;
        this._h = true;
        window.addEventListener('online', () => { if (this.uid) this.retry(); });
        window.addEventListener('offline', () => { if (this.uid) this.setStatus('offline'); });
        setInterval(() => { if (this.uid && this.status !== 'locked' && this.dirty().length && navigator.onLine !== false) this.retry(); }, 30000);
    },
    async enter(u) {
        this.uid = u.id; storage.ns = u.ns;
        this.hook();
        if (!sb) return;
        try {
            const { data, error } = await sb.from('user_data').select('key,value').eq('user_id', this.uid);
            if (error) throw error;
            const dirty = this.dirty();
            data.forEach(r => { if (!dirty.includes(r.key)) { localStorage.setItem(this.ns() + r.key, r.value); try { localStorage.setItem(this.ns() + '__base:' + r.key, h32(String(r.value))); } catch (e) { } } });
            const asked = localStorage.getItem(this.ns() + '__mig');
            if (!asked && !data.some(r => r.key === 'journal-trades') && localStorage.getItem('journal-trades')) {
                localStorage.setItem(this.ns() + '__mig', '1');
                if (window.confirm('داده‌های قبلی این دستگاه پیدا شد. به حساب جدیدت منتقل شود؟')) {
                    const keys = [];
                    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('journal-')) keys.push(k); }
                    keys.forEach(k => { localStorage.setItem(this.ns() + k, localStorage.getItem(k)); this.mark(k); });
                }
            }
            for (const k of this.dirty()) await this.flush(k);
            this.setStatus(this.dirty().length ? 'pending' : 'ok');
        }
        catch (e) { if (this.status === 'ok') this.setStatus('error', (e && e.message) || ''); }
    },
    leave() { this.uid = null; storage.ns = ''; this.status = 'ok'; this.err = ''; }
};
const storage = {
    ns: '',
    async get(key) {
        const v = localStorage.getItem(this.ns + key);
        return v !== null ? { value: v } : null;
    },
    async set(key, value) {
        localStorage.setItem(this.ns + key, value);
        if (Cloud.uid && key.startsWith('journal-')) Cloud.queue(key);
        return { value };
    }
};
const Icon = ({ children, size = 16, color = 'currentColor', className }) => (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: className }, children));
const Plus = (p) => React.createElement(Icon, { ...p },
    React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" }));
const X = (p) => React.createElement(Icon, { ...p },
    React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }));
const Edit = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
    React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }));
const TrendingUp = (p) => React.createElement(Icon, { ...p },
    React.createElement("polyline", { points: "23 6 13.5 15.5 8.5 10.5 1 18" }),
    React.createElement("polyline", { points: "17 6 23 6 23 12" }));
const TrendingDown = (p) => React.createElement(Icon, { ...p },
    React.createElement("polyline", { points: "23 18 13.5 8.5 8.5 13.5 1 6" }),
    React.createElement("polyline", { points: "17 18 23 18 23 12" }));
const Trash2 = (p) => React.createElement(Icon, { ...p },
    React.createElement("polyline", { points: "3 6 5 6 21 6" }),
    React.createElement("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
    React.createElement("path", { d: "M10 11v6" }),
    React.createElement("path", { d: "M14 11v6" }),
    React.createElement("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }));
const Loader2 = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }));
const Award = (p) => React.createElement(Icon, { ...p },
    React.createElement("circle", { cx: "12", cy: "8", r: "7" }),
    React.createElement("polyline", { points: "8.21 13.89 7 23 12 20 17 23 15.79 13.88" }));
const Target = (p) => React.createElement(Icon, { ...p },
    React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "6" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "2" }));
const MoreVertical = (p) => React.createElement(Icon, { ...p },
    React.createElement("circle", { cx: "12", cy: "12", r: "1.3", fill: p.color || 'currentColor' }),
    React.createElement("circle", { cx: "12", cy: "5", r: "1.3", fill: p.color || 'currentColor' }),
    React.createElement("circle", { cx: "12", cy: "19", r: "1.3", fill: p.color || 'currentColor' }));
const LockIcon = (p) => React.createElement(Icon, { ...p },
    React.createElement("rect", { x: "4", y: "11", width: "16", height: "10", rx: "2.5" }),
    React.createElement("path", { d: "M8 11V7.5a4 4 0 0 1 8 0V11" }),
    React.createElement("circle", { cx: "12", cy: "16", r: "1.2", fill: p.color || 'currentColor' }));
const Palette = (p) => React.createElement(Icon, { ...p },
    React.createElement("circle", { cx: "13.5", cy: "6.5", r: "1.2", fill: p.color || 'currentColor' }),
    React.createElement("circle", { cx: "17.5", cy: "10.5", r: "1.2", fill: p.color || 'currentColor' }),
    React.createElement("circle", { cx: "8.5", cy: "7.5", r: "1.2", fill: p.color || 'currentColor' }),
    React.createElement("circle", { cx: "6.5", cy: "12.5", r: "1.2", fill: p.color || 'currentColor' }),
    React.createElement("path", { d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1a1.6 1.6 0 0 1 1.6-1.6h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z" }));
const RotateCcw = (p) => React.createElement(Icon, { ...p },
    React.createElement("polyline", { points: "1 4 1 10 7 10" }),
    React.createElement("path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" }));
const Download = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    React.createElement("polyline", { points: "7 10 12 15 17 10" }),
    React.createElement("line", { x1: "12", y1: "15", x2: "12", y2: "3" }));
const Upload = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    React.createElement("polyline", { points: "17 8 12 3 7 8" }),
    React.createElement("line", { x1: "12", y1: "3", x2: "12", y2: "15" }));
const AlertTriangle = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
    React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
    React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }));
const LayoutDashboard = (p) => React.createElement(Icon, { ...p },
    React.createElement("rect", { x: "3", y: "3", width: "7", height: "9" }),
    React.createElement("rect", { x: "14", y: "3", width: "7", height: "5" }),
    React.createElement("rect", { x: "14", y: "12", width: "7", height: "9" }),
    React.createElement("rect", { x: "3", y: "16", width: "7", height: "5" }));
const Layers = (p) => React.createElement(Icon, { ...p },
    React.createElement("polygon", { points: "12 2 2 7 12 12 22 7 12 2" }),
    React.createElement("polyline", { points: "2 17 12 22 22 17" }),
    React.createElement("polyline", { points: "2 12 12 17 22 12" }));
const CalendarDays = (p) => React.createElement(Icon, { ...p },
    React.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
    React.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
    React.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
    React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" }),
    React.createElement("path", { d: "M8 14h.01" }),
    React.createElement("path", { d: "M12 14h.01" }),
    React.createElement("path", { d: "M16 14h.01" }),
    React.createElement("path", { d: "M8 18h.01" }),
    React.createElement("path", { d: "M12 18h.01" }),
    React.createElement("path", { d: "M16 18h.01" }));
const FileText = (p) => React.createElement(Icon, { ...p },
    React.createElement("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
    React.createElement("polyline", { points: "14 2 14 8 20 8" }),
    React.createElement("line", { x1: "16", y1: "13", x2: "8", y2: "13" }),
    React.createElement("line", { x1: "16", y1: "17", x2: "8", y2: "17" }),
    React.createElement("polyline", { points: "10 9 9 9 8 9" }));
const DEFAULT_THEME = {
    bg: '#1E1A16', bgAlt: '#26211C', bgCard: '#26211C', accent: '#D4A373',
    positive: '#7BBFA4', negative: '#E08C7B', text: '#F2EAD9', navColor: '#8B5E3C', ui: 'clay'
};
const PRESET_THEMES = [
    { name: 'آبی-خاکستری تیره', bg: '#14181F', bgAlt: '#1B2029', bgCard: '#1B2029', accent: '#7FA8D6', positive: '#6FBF9F', negative: '#E0867F', text: '#E6EBF2', navColor: '#4C6E96' },
    { name: 'آبی-خاکستری روشن', bg: '#EEF1F5', bgAlt: '#E5E9EF', bgCard: '#F8FAFC', accent: '#3F6A9B', positive: '#3F7F68', negative: '#B95C55', text: '#1F2A37', navColor: '#3F6A9B' },
    { name: 'سبز جنگلی تیره', bg: '#121A16', bgAlt: '#18221D', bgCard: '#18221D', accent: '#8DBF8A', positive: '#7FCDAE', negative: '#E08C7B', text: '#E4EDE5', navColor: '#4F7A5A' },
    { name: 'سبز جنگلی روشن', bg: '#F0F4EE', bgAlt: '#E7EDE4', bgCard: '#FAFCF8', accent: '#3F6B47', positive: '#3E7A5C', negative: '#B8605A', text: '#1F2D24', navColor: '#3F6B47' },
];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const SESSIONS = ['آسیایی', 'لندن', 'نیویورک', 'همپوشانی لندن/نیویورک'];
const SYMBOL_PRESETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'GBPJPY', 'EURJPY', 'US30', 'NAS100', 'BTCUSD'];
const DAYS = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const FULL_DAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const EMOTION_TAGS = ['😌 آرام', '😰 استرس', '😤 عجله', '😎 اعتماد', '😟 ترس', '😋 طمع', '😴 خستگی', '🧘 متمرکز'];
function weekdayFaFromDate(dateStr) {
    if (!dateStr)
        return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime()))
        return '';
    return FULL_DAYS_FA[d.getDay()];
}
function toLocalISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function weekInfoFromDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime()))
        return null;
    const day = d.getDay();
    const sinceSaturday = (day + 1) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - sinceSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { key: toLocalISODate(start), start, end };
}
function fmtDateShort(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
}
function nameInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '؟';
    if (parts.length === 1)
        return parts[0].slice(0, 2);
    return `${parts[0][0]}.${parts[1][0]}`;
}
const DEFAULT_STRATEGIES = ['اردر بلاک', 'عرضه و تقاضا', 'پرایس اکشن', 'بریک‌اوت', 'پول‌بک'];
const SYMBOL_MULTIPLIERS = { XAUUSD: 100, EURUSD: 100000, GBPUSD: 100000, US30: 10, NAS100: 10, BTCUSD: 1 };
/* جفت‌ارزهای فارکس: محاسبه‌ی سود و زیان برای هر ترکیب از ارزهای اصلی (لات استاندارد = ۱۰۰٬۰۰۰ واحد) */
const CONTRACT_OVERRIDES = {}; // اندازه‌ی قرارداد هر نماد که کاربر تنظیم کرده (بروکرها فرق دارند)
const FX_CCY = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY', 'SGD', 'HKD', 'SEK', 'NOK', 'MXN', 'PLN', 'TRY', 'ZAR'];
const NUM_KEYS = ['entryPrice', 'stopLoss', 'target', 'exitPrice', 'volume', 'convRate', 'contractSize', 'commission', 'swap', 'riskPercent', 'pnl'];
function normNum(v) {
    return String(v == null ? '' : v)
        .replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0))
        .replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660))
        .replace(/[\u066B\u066C\u060C\u002F,]/g, '.')
        .replace(/\u2212/g, '-');
}
function fxPair(sym) {
    const t = String(sym || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (t.length < 6) return null;
    const b = t.slice(0, 3), q = t.slice(3, 6);
    return FX_CCY.includes(b) && FX_CCY.includes(q) && b !== q ? { base: b, quote: q } : null;
}
// برای کراس‌ها (مثل GBPJPY یا CADNZD) سود به ارز دوم می‌آید و برای تبدیل به دلار یک نرخ لازم است
function convHint(sym) {
    const p = fxPair(sym);
    if (!p || p.quote === 'USD' || p.base === 'USD') return null;
    // ارزهایی که معمولاً در برابر دلار به شکل USDXXX مظنه می‌شوند، باید معکوس شوند.
    // ارزهایی مثل EUR/GBP/AUD/NZD معمولاً با نماد XXXUSD تبدیل مستقیم دارند.
    const usdQuote = ['JPY', 'CAD', 'CHF', 'SGD', 'HKD', 'SEK', 'NOK', 'MXN', 'PLN', 'TRY', 'ZAR'];
    return usdQuote.includes(p.quote)
        ? { pair: 'USD' + p.quote, invert: true }
        : { pair: p.quote + 'USD', invert: false };
}
function defaultContract(sym) {
    const key = String(sym || '').trim().toUpperCase();
    if (fxPair(key) || !key) return 0;
    return CONTRACT_OVERRIDES[key] > 0 ? CONTRACT_OVERRIDES[key] : (Object.prototype.hasOwnProperty.call(SYMBOL_MULTIPLIERS, key) ? SYMBOL_MULTIPLIERS[key] : 0);
}
function pnlSpec(sym, price, conv, custom) {
    const key = String(sym || '').trim().toUpperCase();
    const p = fxPair(key);
    if (!p) {
        // طلا، شاخص‌ها، کریپتو و هر نماد دیگر: ارزش هر ۱ واحد حرکت برای ۱ لات (به دلار)
        const sz = parseFloat(custom) > 0 ? parseFloat(custom) : defaultContract(key);
        return sz > 0 ? { size: sz, toUsd: 1 } : null;
    }
    const size = 100000;
    if (p.quote === 'USD') return { size, toUsd: 1 };
    if (p.base === 'USD') return price > 0 ? { size, toUsd: 1 / price } : null;
    const h = convHint(key), r = parseFloat(conv);
    if (!(r > 0)) return { size, toUsd: null, need: h.pair };
    return { size, toUsd: h.invert ? 1 / r : r };
}
const DEFAULT_ACCOUNTS = [{ id: 'default', name: 'حساب اصلی', balance: 1000, currency: 'USD' }];
const PIP_SIZES = {
    EURUSD: 0.0001, GBPUSD: 0.0001, USDJPY: 0.01, EURJPY: 0.01, GBPJPY: 0.01,
    AUDUSD: 0.0001, NZDUSD: 0.0001, USDCAD: 0.0001, USDCHF: 0.0001,
    XAUUSD: 0.01, XAGUSD: 0.01, US30: 1, NAS100: 1, BTCUSD: 1, ETHUSD: 1
};
function pipSizeFor(symbol) {
    const key = String(symbol || '').trim().toUpperCase();
    if (PIP_SIZES[key]) return PIP_SIZES[key];
    const pair = fxPair(key);
    if (pair) return pair.quote === 'JPY' ? 0.01 : 0.0001;
    return 1;
}
function calcPips(t) {
    const e = parseFloat(t.entryPrice), x = parseFloat(t.exitPrice);
    if (!Number.isFinite(e) || !Number.isFinite(x))
        return 0;
    const sign = t.direction === 'خرید' ? 1 : -1;
    return ((x - e) * sign) / pipSizeFor(t.symbol);
}
function calcTradeR(t, balance) {
    const risk = balance > 0 ? balance * ((parseFloat(t.riskPercent) || 1) / 100) : 0;
    return risk ? (Number(t.pnl) || 0) / risk : 0;
}
/* ===== قوانین پلن، نمره‌ی انضباط و پایش پراپ ===== */
const DEFAULT_RULES = { riskPct: 1, maxTrades: 3, maxLossStreak: 2 };
const DEFAULT_PROP = { on: false, maxDD: 10, dailyLoss: 5, target: 10, ddType: 'static' };
const ruleOf = (a) => ({ ...DEFAULT_RULES, ...((a && a.rules) || {}) });
const propOf = (a) => ({ ...DEFAULT_PROP, ...((a && a.prop) || {}) });
const RULE_WEIGHTS = { risk: 40, trades: 30, streak: 30 };
const RULE_NAMES = { risk: 'ریسک بیشتر از پلن', trades: 'معامله‌ی بیشتر از سقف روزانه', streak: 'ادامه بعد از ضررهای پشت‌سرهم' };
const byDayTime = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '23:59').localeCompare(String(b.time || '23:59')) || (Number(a.id) || 0) - (Number(b.id) || 0);
function evalRules(accTrades, cand, rules, excludeId) {
    const same = accTrades.filter(t => t.date === cand.date && t.id !== excludeId).sort(byDayTime);
    let streak = 0;
    same.forEach(t => { const r = resultOf(t); if (r === 'loss') streak++; else if (r === 'win') streak = 0; });
    const risk = parseFloat(cand.riskPercent);
    const breaks = [];
    if (Number.isFinite(risk) && risk > rules.riskPct + 1e-9) breaks.push('risk');
    if (same.length >= rules.maxTrades) breaks.push('trades');
    if (streak >= rules.maxLossStreak) breaks.push('streak');
    const score = Math.max(0, 100 - breaks.reduce((s, k) => s + RULE_WEIGHTS[k], 0));
    return { breaks, score, count: same.length, streak, risk };
}
function propStatus(acc, accTrades, rules) {
    const p = propOf(acc);
    if (!p.on) return null;
    const init = Number(acc && acc.balance) || 0;
    if (init <= 0) return null;
    const sorted = accTrades.slice().sort(byDayTime);
    let eq = init, peak = init;
    sorted.forEach(t => { eq += Number(t.pnl) || 0; peak = Math.max(peak, eq); });
    const today = toLocalISODate(new Date());
    const todayPnl = sorted.filter(t => t.date === today).reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    const losses = sorted.filter(t => (Number(t.pnl) || 0) < 0);
    const avgLoss = losses.length >= 3 ? losses.reduce((s, t) => s - t.pnl, 0) / losses.length : init * rules.riskPct / 100;
    const lvl = (r) => r >= 1 ? 4 : r >= 0.9 ? 3 : r >= 0.75 ? 2 : r >= 0.5 ? 1 : 0;
    const mk = (used, limit) => {
        const ratio = limit > 0 ? used / limit : 0, remain = Math.max(0, limit - used);
        return { used, limit, ratio, level: lvl(ratio), remain, lossesLeft: avgLoss > 0 ? Math.floor(remain / avgLoss) : 0 };
    };
    const dd = mk(Math.max(0, (p.ddType === 'trailing' ? peak : init) - eq), init * p.maxDD / 100);
    const day = mk(Math.max(0, -todayPnl), init * p.dailyLoss / 100);
    const tgtLimit = init * p.target / 100, gain = Math.max(0, eq - init);
    const target = { used: gain, limit: tgtLimit, ratio: tgtLimit > 0 ? gain / tgtLimit : 0 };
    const last = sorted[sorted.length - 1];
    return { p, init, eq, dd, day, target, avgLoss, lastLoss: !!last && (Number(last.pnl) || 0) < 0 };
}
function propMessages(st, riskNow, rules) {
    const out = [];
    const lim = (it, name) => {
        const left = `${fmt(it.remain)}$`, n = it.lossesLeft;
        if (it.level >= 4) out.push({ tone: 'red', text: `سقف ${name} رد شده است. معامله‌ی جدید نگیر و وضعیت حساب را با قوانین شرکت پراپ بررسی کن.` });
        else if (it.level === 3) out.push({ tone: 'red', text: `به خط قرمز ${name} نزدیکی؛ فقط ${left} فاصله داری (حدود ${fmt(n)} ضرر دیگر). الان وقت حفظ حساب است، نه جبران؛ فرصت بعدی هم می‌آید.` });
        else if (it.level === 2) out.push({ tone: 'orange', text: `۷۵٪ سقف ${name} مصرف شده. یک نفس عمیق؛ ریسک را کم کن و فقط ستاپ‌های درجه‌یک را بگیر. تا خط قرمز ${left} مانده (حدود ${fmt(n)} ضرر).` });
        else if (it.level === 1) out.push({ tone: 'yellow', text: `به نیمه‌ی سقف ${name} رسیده‌ای. آرام و طبق پلن جلو برو؛ ${left} تا خط قرمز فاصله داری (حدود ${fmt(n)} ضرر).` });
    };
    lim(st.dd, 'دراودان کل');
    lim(st.day, 'ضرر روزانه');
    if (st.target.ratio >= 1) out.push({ tone: 'green', text: 'به هدف سود رسیدی 🎯 اینجا بهترین کار حفظ نتیجه است؛ معامله‌ی اضافه لازم نیست.' });
    else if (st.target.ratio >= 0.75) out.push({ tone: 'yellow', text: `به ${fmt(st.target.ratio * 100)}٪ هدف سود رسیده‌ای. نزدیکِ خط پایان بیشترین خطر عجله است؛ ریسک را بالا نبر و نگذار یک معامله‌ی بد این مسیر را خراب کند.` });
    if (st.lastLoss && Number.isFinite(riskNow) && riskNow > rules.riskPct + 1e-9)
        out.push({ tone: 'orange', text: 'معامله‌ی قبلی ضرر بود و ریسک این معامله از پلن بالاتر است. بعد از ضرر ریسک را بالا نبر؛ جبران عجولانه گران‌ترین کار است.' });
    return out;
}
const TONE_COLORS = (C) => ({ red: C.negative, orange: '#E8A15B', yellow: '#D9B84A', green: C.positive });
function PropAlert({ C, st, rules, compact, riskNow }) {
    const h = React.createElement;
    if (!st) return null;
    const msgs = propMessages(st, riskNow, rules);
    if (compact && !msgs.length) return null;
    const tc = TONE_COLORS(C);
    const lvlColor = (l) => l >= 3 ? C.negative : l === 2 ? '#E8A15B' : l === 1 ? '#D9B84A' : C.positive;
    const bar = (label, it, color) => h('div', { key: label, style: { marginBottom: 12 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, gap: 8 } },
            h('span', null, label),
            h('span', { style: { fontFamily: "'IBM Plex Mono', monospace", opacity: .8 } }, `${fmt(it.used)}$ / ${fmt(it.limit)}$`)),
        h('div', { style: { height: 7, borderRadius: 99, background: `${C.text}14`, overflow: 'hidden' } },
            h('i', { style: { display: 'block', height: '100%', width: Math.min(100, it.ratio * 100) + '%', background: color, borderRadius: 99, transition: 'width .5s' } })));
    return h('div', { className: 'glass-effect', style: { borderRadius: 16, padding: compact ? '12px 14px' : '16px 16px 12px', margin: compact ? '12px 0 0' : '0 0 14px', border: `1px solid ${C.accent}30` } },
        !compact && h('div', { style: { fontSize: 13, fontWeight: 800, marginBottom: 12 } }, '🛡 پایش حساب پراپ'),
        !compact && bar('دراودان کل ' + (st.p.ddType === 'trailing' ? '(متحرک)' : '(ثابت)'), st.dd, lvlColor(st.dd.level)),
        !compact && bar('ضرر امروز', st.day, lvlColor(st.day.level)),
        !compact && bar('پیشرفت به هدف سود', st.target, C.positive),
        msgs.map((m, i) => h('div', { key: i, style: { fontSize: 12.5, lineHeight: 1.9, padding: '9px 11px', borderRadius: 12, marginTop: i || !compact ? 8 : 0, background: `${tc[m.tone]}1c`, borderInlineStart: `3px solid ${tc[m.tone]}` } }, m.text)),
        !compact && h('div', { style: { fontSize: 10.5, opacity: .5, marginTop: 10, lineHeight: 1.7 } }, 'فقط معامله‌های بسته‌ی ثبت‌شده در ژورنال حساب می‌شوند؛ معامله‌ی باز یا سود و زیان شناور دیده نمی‌شود.'));
}
function RuleWarn({ C, ev, rules }) {
    const h = React.createElement;
    if (!ev) return null;
    const txt = (k) => k === 'risk' ? `ریسک ${fmt(ev.risk, 2)}٪ از حد پلن (${fmt(rules.riskPct, 2)}٪) بیشتر است`
        : k === 'trades' ? `این معامله‌ی ${fmt(ev.count + 1)}ام امروز توست؛ سقف پلن ${fmt(rules.maxTrades)} معامله در روز است`
            : `${fmt(ev.streak)} ضرر پشت‌سرهم داشته‌ای؛ طبق پلن باید همین‌جا متوقف می‌شدی`;
    const bad = ev.breaks.length > 0, col = bad ? '#E8A15B' : C.positive;
    return h('div', { style: { margin: '12px 0 0', padding: '12px 14px', borderRadius: 14, background: `${col}1a`, border: `1px solid ${col}55`, fontSize: 12.5, lineHeight: 1.9 } },
        h('div', { style: { fontWeight: 800, marginBottom: bad ? 6 : 0 } }, bad ? '⚠️ طبق قوانین پلن این حساب' : `✅ در چارچوب پلن · نمره ${fmt(ev.score)} از ۱۰۰`),
        ev.breaks.map(k => h('div', { key: k }, '• ' + txt(k))),
        bad && h('div', { style: { opacity: .7, marginTop: 6, fontSize: 11.5 } }, `نمره‌ی این معامله ${fmt(ev.score)} از ۱۰۰. ثبت جلویت را نمی‌گیرد، فقط با برچسب «قانون شکسته» ذخیره می‌شود.`));
}
function DisciplineCard({ C, trades, rules }) {
    const h = React.createElement;
    const scored = trades.filter(t => Array.isArray(t.ruleBreaks));
    const wrap = (...kids) => h('div', { className: 'glass-effect', style: { borderRadius: 14, padding: '26px 24px', marginBottom: 20 } }, h('div', { style: { fontSize: 14, fontWeight: 800, marginBottom: 12 } }, '🎯 انضباط و قوانین پلن'), ...kids);
    const mono = { fontFamily: "'IBM Plex Mono', monospace" };
    const rulesLine = h('div', { style: { fontSize: 11.5, opacity: .6, lineHeight: 1.9, marginTop: 12 } }, `قوانین فعلی این حساب: ریسک تا ${fmt(rules.riskPct, 2)}٪ · حداکثر ${fmt(rules.maxTrades)} معامله در روز · توقف بعد از ${fmt(rules.maxLossStreak)} ضرر پشت‌سرهم`);
    if (!scored.length)
        return wrap(h('div', { style: { fontSize: 13, opacity: .7, lineHeight: 1.9 } }, 'از این به بعد هر معامله‌ی جدید با قوانین همان لحظه نمره‌ی ۰ تا ۱۰۰ می‌گیرد و اینجا گزارش انضباطت را می‌بینی. معامله‌های قدیمی نمره ندارند.'), rulesLine);
    const good = scored.filter(t => t.ruleBreaks.length === 0), bad = scored.filter(t => t.ruleBreaks.length > 0);
    const avg = scored.reduce((s, t) => s + (Number(t.ruleScore) || 0), 0) / scored.length;
    const net = (a) => a.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    const counts = { risk: 0, trades: 0, streak: 0 };
    bad.forEach(t => t.ruleBreaks.forEach(k => { if (k in counts) counts[k]++; }));
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const col = avg >= 80 ? C.positive : avg >= 60 ? C.accent : C.negative;
    const side = (title, arr, color) => h('div', { style: { flex: 1, padding: '12px 12px', borderRadius: 12, background: `${C.text}08`, minWidth: 0 } },
        h('div', { style: { fontSize: 12, opacity: .7, marginBottom: 6 } }, title),
        h('div', { style: { ...mono, fontSize: 17, fontWeight: 700, color } }, `${net(arr) >= 0 ? '+' : ''}${fmt(net(arr))}$`),
        h('div', { style: { fontSize: 11.5, opacity: .6, marginTop: 4 } }, `${fmt(arr.length)} معامله` + (arr.length ? ` · میانگین ${fmt(net(arr) / arr.length, 1)}$` : '')));
    const cost = net(bad);
    return wrap(
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 } },
            h('b', { style: { ...mono, fontSize: 30, color: col } }, fmt(avg)), h('span', { style: { fontSize: 12.5, opacity: .7 } }, `از ۱۰۰ · میانگین نمره‌ی ${fmt(scored.length)} معامله`)),
        h('div', { style: { display: 'flex', gap: 10 } }, side('✅ در چارچوب پلن', good, C.positive), side('⚠️ خارج از قانون', bad, cost >= 0 ? C.positive : C.negative)),
        bad.length > 0 && h('div', { style: { marginTop: 14, fontSize: 13, lineHeight: 1.9 } }, 'بیشتر شکسته‌شده: ', h('b', null, RULE_NAMES[top]), ` (${fmt(counts[top])} بار)`),
        h('div', { style: { marginTop: 12, padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.9, background: bad.length === 0 ? `${C.positive}1c` : cost < 0 ? `${C.negative}1c` : `${C.accent}1c` } },
            bad.length === 0 ? 'هیچ معامله‌ی خارج از قانون نداری؛ همین‌طور ادامه بده 👏'
                : cost < 0 ? `هزینه‌ی بی‌انضباطی: ${fmt(Math.abs(cost))}$ — این مقدار را معامله‌های خارج از قانون از حسابت خورده‌اند.`
                    : `معامله‌های خارج از قانون فعلاً ${fmt(cost)}$ سود داده‌اند، ولی با ریسک بیشتر؛ این شانس است، نه سیستم. با ادامه‌ی همین روند هزینه‌اش را می‌دهی.`),
        rulesLine);
}

const EMPTY_FORM = {
    date: toLocalISODate(new Date()), symbol: 'XAUUSD', customSymbol: '', session: SESSIONS[0], timeframe: '', pnlManual: false, time: '',
    direction: 'خرید', entryPrice: '', stopLoss: '', target: '', exitPrice: '', volume: '', convRate: '', contractSize: '',
    strategy: '', result: 'win', emotion: '', pnl: '', commission: '', swap: '', riskPercent: '1', notes: '', quality: 0, followedPlan: '', mistakes: [],
};
function fmt(n, digits = 0) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function calcRR(entry, sl, tp) {
    const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(tp);
    if (isNaN(e) || isNaN(s) || isNaN(t))
        return null;
    const risk = Math.abs(e - s);
    const reward = Math.abs(t - e);
    if (risk === 0)
        return null;
    return reward / risk;
}
function rrBucketOf(rr) {
    if (rr < 1)
        return '< 1:1';
    if (rr < 2)
        return '1:1 – 2:1';
    if (rr < 3)
        return '2:1 – 3:1';
    if (rr < 4)
        return '3:1 – 4:1';
    return '4:1+';
}
const RR_BUCKETS = ['< 1:1', '1:1 – 2:1', '2:1 – 3:1', '3:1 – 4:1', '4:1+'];
function resultOf(t) {
    return t.result || (t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'be');
}
function computeStats(trades) {
    const total = trades.length;
    const resultWins = trades.filter(t => resultOf(t) === 'win');
    const resultLosses = trades.filter(t => resultOf(t) === 'loss');
    const resultBE = trades.filter(t => resultOf(t) === 'be');
    const pnlWins = trades.filter(t => t.pnl > 0);
    const pnlLosses = trades.filter(t => t.pnl < 0);
    const grossProfit = pnlWins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(pnlLosses.reduce((s, t) => s + t.pnl, 0));
    const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const winRate = total ? (resultWins.length / total) * 100 : 0;
    const winRateExclBE = (resultWins.length + resultLosses.length) ? (resultWins.length / (resultWins.length + resultLosses.length)) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
    const avgWin = pnlWins.length ? grossProfit / pnlWins.length : 0;
    const avgLoss = pnlLosses.length ? grossLoss / pnlLosses.length : 0;
    const expectancy = total ? netPnl / total : 0;
    const best = total ? Math.max(...trades.map(t => t.pnl)) : 0;
    const worst = total ? Math.min(...trades.map(t => t.pnl)) : 0;
    let peak = 0, running = 0, maxDD = 0, trough = 0, maxRunUp = 0;
    const ordered = [...trades].sort((a, b) => {
        const da = `${a.date || ''} ${a.time || '23:59'}`;
        const db = `${b.date || ''} ${b.time || '23:59'}`;
        return da.localeCompare(db) || Number(a.id || 0) - Number(b.id || 0);
    });
    ordered.forEach(t => {
        running += Number(t.pnl) || 0;
        peak = Math.max(peak, running);
        maxDD = Math.max(maxDD, peak - running);
        trough = Math.min(trough, running);
        maxRunUp = Math.max(maxRunUp, running - trough);
    });
    const totalCommission = trades.reduce((s, t) => s + (t.commission || 0), 0);
    const totalSwap = trades.reduce((s, t) => s + (t.swap || 0), 0);
    return {
        total, wins: resultWins.length, losses: resultLosses.length, bes: resultBE.length,
        grossProfit, grossLoss, netPnl, winRate, winRateExclBE, profitFactor,
        avgWin, avgLoss, expectancy, best, worst, maxDD, maxRunUp,
        totalCommission, totalSwap
    };
}
function groupBy(trades, key) {
    const map = {};
    trades.forEach(t => {
        const k = t[key];
        if (!map[k])
            map[k] = [];
        map[k].push(t);
    });
    return Object.entries(map).map(([name, list]) => ({ name, ...computeStats(list) }))
        .sort((a, b) => b.netPnl - a.netPnl);
}
function computeRStats(tradesList, balance) {
    if (!(balance > 0))
        return { totalR: 0, avgWinR: 0, avgLossR: 0, rr: 0 };
    const rs = tradesList.map(t => calcTradeR(t, balance));
    const winRs = rs.filter(r => r > 0);
    const lossRs = rs.filter(r => r < 0).map(r => Math.abs(r));
    const totalR = rs.reduce((a, b) => a + b, 0);
    const avgWinR = winRs.length ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0;
    const avgLossR = lossRs.length ? lossRs.reduce((a, b) => a + b, 0) / lossRs.length : 0;
    const rr = avgLossR > 0 ? avgWinR / avgLossR : (avgWinR > 0 ? Infinity : 0);
    return { totalR, avgWinR, avgLossR, rr };
}
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
    return `${r},${g},${b}`;
}
function useCountUp(target, duration = 700) {
    const [display, setDisplay] = useState(target);
    const prevRef = useRef(target);
    useEffect(() => {
        const from = prevRef.current;
        const to = target;
        if (from === to)
            return;
        const start = performance.now();
        let raf;
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(from + (to - from) * eased);
            if (p < 1)
                raf = requestAnimationFrame(tick);
            else
                prevRef.current = to;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return display;
}
function createRipple(e, color) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.borderRadius = '50%';
    span.style.background = color || 'rgba(255,255,255,0.35)';
    span.style.pointerEvents = 'none';
    span.style.transform = 'scale(0)';
    span.style.opacity = '0.6';
    span.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';
    const prevPos = getComputedStyle(btn).position;
    if (prevPos === 'static')
        btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(span);
    requestAnimationFrame(() => { span.style.transform = 'scale(1)'; span.style.opacity = '0'; });
    setTimeout(() => span.remove(), 600);
}
const Logo = ({ size = 38 }) => (React.createElement("div", { className: "animate-glow", style: { width: size, height: size, flexShrink: 0, borderRadius: size * 0.24, overflow: 'hidden' } }, React.createElement(TradyarMark, { size: size, id: 'hd' })));
const ProfileAvatar = ({ size = 38, accent = '#D4A657', name = '' }) => (React.createElement("div", { style: {
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(140deg, ${accent} 0%, #6b4a1c 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 3px 10px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 3px rgba(0,0,0,0.3)`,
        fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: '#1a1206', fontSize: size * 0.36,
    } }, nameInitials(name)));
const GREGORIAN_MONTHS_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const WEEKDAY_LETTERS_SAT_FIRST = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const firstWeekdaySatFirst = (year, month) => (new Date(year, month, 1).getDay() + 1) % 7;
function CustomDatePicker({ value, onChange, C }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const base = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewYear, setViewYear] = useState(base.getFullYear());
    const [viewMonth, setViewMonth] = useState(base.getMonth());
    useEffect(() => {
        const next = value ? new Date(value + 'T00:00:00') : new Date();
        if (!isNaN(next.getTime())) {
            setViewYear(next.getFullYear());
            setViewMonth(next.getMonth());
        }
    }, [value]);
    useEffect(() => {
        const onClick = (e) => { if (ref.current && !ref.current.contains(e.target))
            setOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);
    const dim = daysInMonth(viewYear, viewMonth);
    const offset = firstWeekdaySatFirst(viewYear, viewMonth);
    const cells = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
    const selectDay = (d) => {
        const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(iso);
        setOpen(false);
    };
    const prevMonth = () => { if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(y => y - 1);
    }
    else
        setViewMonth(m => m - 1); };
    const nextMonth = () => { if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(y => y + 1);
    }
    else
        setViewMonth(m => m + 1); };
    const d0 = value ? new Date(value + 'T00:00:00') : null;
    const displayLabel = d0 ? `${d0.getDate()} ${GREGORIAN_MONTHS_FA[d0.getMonth()]} ${d0.getFullYear()}` : 'انتخاب تاریخ';
    return (React.createElement("div", { style: { position: 'relative' }, ref: ref },
        React.createElement("button", { type: "button", onClick: () => setOpen(o => !o), style: { width: '100%', textAlign: 'right', background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' } }, displayLabel),
        open && (React.createElement("div", { style: { position: 'absolute', zIndex: 400, top: 'calc(100% + 6px)', right: 0, width: 272, background: C.bgCard, border: `1px solid ${C.text}22`, borderRadius: 12, padding: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 } },
                React.createElement("button", { type: "button", onClick: prevMonth, style: { background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: 17, padding: 4, lineHeight: 1 } }, "\u2039"),
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.text } },
                    GREGORIAN_MONTHS_FA[viewMonth],
                    " ",
                    viewYear),
                React.createElement("button", { type: "button", onClick: nextMonth, style: { background: 'none', border: 'none', color: C.text, cursor: 'pointer', fontSize: 17, padding: 4, lineHeight: 1 } }, "\u203A")),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 } }, WEEKDAY_LETTERS_SAT_FIRST.map((l, i) => (React.createElement("div", { key: i, style: { textAlign: 'center', fontSize: 10.5, color: `${C.text}55` } }, l)))),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 } }, cells.map((d, i) => {
                if (d === null)
                    return React.createElement("div", { key: i });
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSelected = iso === value;
                return (React.createElement("button", { key: i, type: "button", onClick: () => selectDay(d), style: {
                        aspectRatio: '1', border: 'none', borderRadius: 8, cursor: 'pointer',
                        background: isSelected ? C.accent : 'transparent',
                        color: isSelected ? C.bg : C.text, fontSize: 12.5, fontWeight: isSelected ? 700 : 400,
                        fontFamily: "'IBM Plex Mono', monospace",
                    } }, d));
            }))))));
}
function CustomTimePicker({ value, onChange, C }) {
    const [h, m] = (value || '').split(':');
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
    const fld = { flex: 1, background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 8, padding: '10px 8px', color: C.text, fontSize: 13.5 };
    return (React.createElement("div", { style: { display: 'flex', gap: 6, alignItems: 'center' } },
        React.createElement("select", { value: h || '', onChange: e => onChange(`${e.target.value}:${m || '00'}`), style: fld },
            React.createElement("option", { value: "" }, "--"),
            hours.map(hh => React.createElement("option", { key: hh, value: hh }, hh))),
        React.createElement("span", { style: { color: C.text } }, ":"),
        React.createElement("select", { value: m || '', onChange: e => onChange(`${h || '00'}:${e.target.value}`), style: fld },
            React.createElement("option", { value: "" }, "--"),
            minutes.map(mm => React.createElement("option", { key: mm, value: mm }, mm)))));
}
/* ======================================================================
   FX UI v2 — دونات و گیج شاخص‌ها، پروفایل، سه طرح ظاهری، انتخاب رنگ، فرم ثبت معامله
   ====================================================================== */
const $h = React.createElement;
const lumOf = (hex) => { try { const [r, g, b] = hexToRgb(String(hex)).split(',').map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; } catch (e) { return 0; } };
const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(String(hex)).split(',').map(n => Number(n) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    let hh = 0, s = 0;
    if (d) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        hh *= 60;
    }
    return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(hh, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const x = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + x(f(0)) + x(f(8)) + x(f(4));
}
const isHex6 = (v) => /^#[0-9a-fA-F]{6}$/.test(v || '');
const MONO = "'IBM Plex Mono', monospace";

/* ---------- دونات تعاملی ---------- */
function Donut({ size = 92, thickness = 12, segments = [], track, C, centerTop, centerSub, hoverable = true }) {
    const [on, setOn] = useState(false);
    const [act, setAct] = useState(-1);
    useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
    const r = (size - thickness - 8) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
    const live = segments.filter(x => x.value > 0).length;
    const gap = live > 1 ? 2.6 : 0;
    let acc = 0;
    const arcs = segments.map((sg, i) => {
        const frac = total ? Math.max(0, sg.value) / total : 0;
        const len = Math.max(0, frac * circ - (frac > 0 ? gap : 0));
        const off = acc * circ;
        acc += frac;
        const isAct = act === i;
        return $h('circle', {
            key: i, cx, cy, r, fill: 'none', stroke: sg.color, strokeWidth: isAct ? thickness + 4 : thickness,
            strokeDasharray: `${on ? len : 0} ${circ}`, strokeDashoffset: -off, transform: `rotate(-90 ${cx} ${cy})`,
            style: { transition: `stroke-dasharray .95s cubic-bezier(.16,1,.3,1) ${i * 0.09}s, stroke-width .2s, opacity .2s`, cursor: hoverable ? 'pointer' : 'default', opacity: act === -1 || isAct ? 1 : 0.4 },
            onMouseEnter: hoverable ? () => setAct(i) : undefined,
            onMouseLeave: hoverable ? () => setAct(-1) : undefined,
            onClick: hoverable ? (e) => { e.stopPropagation(); setAct(a => a === i ? -1 : i); } : undefined
        });
    });
    const inner = size - 2 * thickness - 8;
    const fitFs = (t, base, k) => Math.min(base, inner * 0.9 / (Math.max(1, String(t || '').length) * k));
    const seg = act >= 0 ? segments[act] : null;
    const top = seg ? (total ? Math.round(seg.value / total * 100) + '%' : '0%') : centerTop;
    const sub = seg ? seg.label : centerSub;
    return $h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { flexShrink: 0, overflow: 'visible' }, role: 'img' },
        $h('circle', { cx, cy, r, fill: 'none', stroke: track || `${C.text}14`, strokeWidth: thickness }),
        arcs,
        $h('text', { x: cx, y: cy + (sub ? 1 : size * 0.075), textAnchor: 'middle', fill: seg ? seg.color : C.text, style: { fontFamily: MONO, fontSize: fitFs(top, size * 0.205, 0.62), fontWeight: 600, transition: 'fill .2s' } }, top),
        sub ? $h('text', { x: cx, y: cy + size * 0.165, textAnchor: 'middle', fill: `${C.text}99`, style: { fontSize: fitFs(sub, size * 0.108, 0.5), fontFamily: "'Vazirmatn', sans-serif" } }, sub) : null);
}

/* ---------- گیج نیم‌دایره ---------- */
function Gauge({ value, min = -1, max = 1, size = 124, C, centerTop, centerSub }) {
    const [on, setOn] = useState(false);
    useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
    const r = size * 0.4, cx = size / 2, cy = size * 0.56, hgt = size * 0.95;
    const pt = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    const arc = (f0, f1) => { const a0 = Math.PI * (1 - f0), a1 = Math.PI * (1 - f1); const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
    const frac = clamp01((value - min) / (max - min));
    const deg = -90 + (on ? frac : 0.5) * 180;
    const zones = [[0, 0.4, C.negative], [0.4, 0.6, C.accent], [0.6, 1, C.positive]];
    return $h('svg', { width: size, height: hgt, viewBox: `0 0 ${size} ${hgt}`, style: { overflow: 'visible', flexShrink: 0 } },
        zones.map(([a, b, c], i) => $h('path', { key: i, d: arc(a + 0.012, b - 0.012), fill: 'none', stroke: c, strokeWidth: size * 0.085, strokeLinecap: 'round', opacity: 0.9 })),
        $h('g', { style: { transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${deg}deg)`, transition: 'transform 1.1s cubic-bezier(.16,1,.3,1)' } },
            $h('line', { x1: cx, y1: cy, x2: cx, y2: cy - r + 4, stroke: C.text, strokeWidth: 2.4, strokeLinecap: 'round' })),
        $h('circle', { cx, cy, r: 5, fill: C.text }),
        $h('text', { x: cx, y: cy + size * 0.21, textAnchor: 'middle', fill: C.text, style: { fontFamily: MONO, fontSize: size * 0.14, fontWeight: 600 } }, centerTop),
        centerSub ? $h('text', { x: cx, y: cy + size * 0.33, textAnchor: 'middle', fill: `${C.text}88`, style: { fontSize: size * 0.09, fontFamily: "'Vazirmatn', sans-serif" } }, centerSub) : null);
}

/* ---------- اسپارک‌لاین ---------- */
function Spark({ data, color, C, height = 46 }) {
    const [on, setOn] = useState(false);
    useEffect(() => { const t = setTimeout(() => setOn(true), 60); return () => clearTimeout(t); }, []);
    if (!data || data.length < 2)
        return $h('div', { className: 'kpi-sub' }, 'برای نمودار حداقل ۲ معامله لازم است');
    const W = 220, H = height, mn = Math.min(...data), mx = Math.max(...data), rg = (mx - mn) || 1;
    const pts = data.map((v, i) => [i / (data.length - 1) * W, H - 4 - (v - mn) / rg * (H - 10)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const gid = 'spk' + Math.abs(Math.round(data[data.length - 1] * 7 + data.length));
    return $h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: { width: '100%', height, display: 'block', marginTop: 8 } },
        $h('defs', null, $h('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
            $h('stop', { offset: '0%', stopColor: color, stopOpacity: 0.35 }), $h('stop', { offset: '100%', stopColor: color, stopOpacity: 0 }))),
        $h('path', { d: d + `L${W} ${H}L0 ${H}Z`, fill: `url(#${gid})`, style: { opacity: on ? 1 : 0, transition: 'opacity 1s .4s' } }),
        $h('path', { d, fill: 'none', stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', pathLength: 1, strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, style: { transition: 'stroke-dashoffset 1.3s cubic-bezier(.16,1,.3,1)' }, vectorEffect: 'non-scaling-stroke' }));
}

function BarPair({ a, b, C }) {
    const [on, setOn] = useState(false);
    useEffect(() => { const t = setTimeout(() => setOn(true), 80); return () => clearTimeout(t); }, []);
    const mx = Math.max(Math.abs(a.value), Math.abs(b.value), 0.0001);
    const row = (x) => $h('div', { className: 'kpi-bar-row', key: x.label },
        $h('div', { className: 'kpi-bar-head' }, $h('span', null, x.label), $h('b', { style: { color: x.color, fontFamily: MONO } }, x.text)),
        $h('div', { className: 'kpi-bar-track' }, $h('div', { className: 'kpi-bar-fill', style: { width: on ? Math.max(3, Math.abs(x.value) / mx * 100) + '%' : '0%', background: x.color } })));
    return $h('div', { style: { display: 'grid', gap: 9, width: '100%' } }, row(a), row(b));
}

function KCard({ C, title, hint, wide, glow, children }) {
    const [info, setInfo] = useState(false);
    return $h('div', { className: 'kpi-card glass-effect' + (wide ? ' kpi-wide' : ''), style: { '--kg': glow || C.accent } },
        $h('div', { className: 'kpi-top' },
            $h('span', { className: 'kpi-title' }, title),
            $h('button', { type: 'button', className: 'kpi-i', 'aria-label': 'توضیح', onClick: () => setInfo(v => !v) }, info ? '×' : 'i')),
        info ? $h('div', { className: 'kpi-hint' }, hint) : children);
}
const LegRow = ({ color, label, value }) => $h('div', { className: 'kpi-leg-row' },
    $h('i', { style: { background: color } }), $h('span', null, label), $h('b', null, value));

/* ---------- برد شاخص‌ها ---------- */
function KpiBoard({ C, stats, rStats, equityCurve, trades, netPnlAnimated, balance }) {
    const [excl, setExcl] = useState(false);
    const [more, setMore] = useState(false);
    const pos = C.positive, neg = C.negative, acc = C.accent;
    const wins = stats.wins, losses = stats.losses, bes = stats.bes || 0;
    const wr = excl ? stats.winRateExclBE : stats.winRate;
    const wrSegs = excl
        ? [{ value: wins, color: pos, label: 'برد' }, { value: losses, color: neg, label: 'باخت' }]
        : [{ value: wins, color: pos, label: 'برد' }, { value: losses, color: neg, label: 'باخت' }, { value: bes, color: acc, label: 'سر به سر' }];
    const pf = stats.profitFactor;
    const pfShown = pf === Infinity ? 3 : Math.min(3, pf);
    const pfColor = pf >= 1.5 ? pos : pf >= 1 ? acc : neg;
    const buys = trades.filter(t => t.direction === 'خرید').length, sells = trades.length - buys;
    const ratio = stats.avgLoss > 0 ? stats.avgWin / stats.avgLoss : (stats.avgWin > 0 ? Infinity : 0);
    const expR = stats.avgLoss > 0 ? stats.expectancy / stats.avgLoss : 0;
    const netColor = stats.netPnl >= 0 ? pos : neg;
    const eq = (equityCurve || []).map(e => e.equity);
    const sgn = (v) => (v >= 0 ? '+' : '');
    const planKnown = trades.filter(t => t.followedPlan === 'yes' || t.followedPlan === 'no');
    const planYes = planKnown.filter(t => t.followedPlan === 'yes').length, planNo = planKnown.length - planYes;
    const planRate = planKnown.length ? planYes / planKnown.length * 100 : null;
    const planColor = planRate === null ? acc : planRate >= 80 ? pos : planRate >= 60 ? acc : neg;
    const scoredT = trades.filter(t => typeof t.ruleScore === 'number');
    const ruleLine = scoredT.length ? $h('div', { className: 'kpi-sub', style: { marginTop: 8 } }, `نمره‌ی قوانین پلن: ${fmt(scoredT.reduce((x, t) => x + t.ruleScore, 0) / scoredT.length)} از ۱۰۰`) : null;
    return $h('div', { className: 'kpi-grid' },
        $h(KCard, { C, title: 'سود/زیان خالص', wide: true, glow: netColor, hint: 'مجموع سود و زیان همه معاملات این حساب. نمودار پایین، مسیر رشد سرمایه معامله‌به‌معامله است.' },
            $h('div', { className: 'kpi-big', style: { color: netColor } }, `${sgn(netPnlAnimated)}${fmt(netPnlAnimated)}$`),
            $h('div', { className: 'kpi-sub' }, (balance > 0 ? `${sgn(stats.netPnl)}${fmt(stats.netPnl / balance * 100, 1)}% از موجودی · ` : '') + `R کل ${sgn(rStats.totalR)}${fmt(rStats.totalR, 2)}`),
            $h(Spark, { data: eq, color: netColor, C, height: 84 })),
        $h(KCard, { C, title: 'نرخ برد', glow: pos, hint: 'درصد معاملات برنده. با کلید «بدون BE» معاملات سر‌به‌سر از مخرج حذف می‌شوند. روی هر بخش دونات بزن.' },
            $h('div', { className: 'kpi-row' },
                $h(Donut, { C, size: 92, thickness: 12, segments: wrSegs, centerTop: `${fmt(wr, 0)}%`, centerSub: excl ? 'بدون BE' : 'کل معاملات' }),
                $h('div', { className: 'kpi-leg' },
                    $h(LegRow, { color: pos, label: 'برد', value: wins }),
                    $h(LegRow, { color: neg, label: 'باخت', value: losses }),
                    !excl && $h(LegRow, { color: acc, label: 'BE', value: bes }))),
            $h('div', { className: 'kpi-seg' },
                $h('button', { type: 'button', className: !excl ? 'on' : '', onClick: () => setExcl(false) }, 'با BE'),
                $h('button', { type: 'button', className: excl ? 'on' : '', onClick: () => setExcl(true) }, 'بدون BE'))),
        $h(KCard, { C, title: 'پروفیت فکتور', glow: pfColor, hint: 'سود ناخالص ÷ زیان ناخالص. زیر ۱ یعنی ضرر، ۱ تا ۱.۵ مرزی، بالای ۱.۵ خوب و بالای ۲ عالی است.' },
            $h('div', { className: 'kpi-row' },
                $h(Donut, { C, size: 92, thickness: 11, hoverable: false, segments: [{ value: pfShown, color: pfColor, label: '' }, { value: 3 - pfShown, color: 'transparent', label: '' }], centerTop: pf === Infinity ? '∞' : fmt(pf, 2), centerSub: 'از ۳' }),
                $h('div', { className: 'kpi-leg' },
                    $h(LegRow, { color: pos, label: 'سود ناخالص', value: `${fmt(stats.grossProfit)}$` }),
                    $h(LegRow, { color: neg, label: 'زیان ناخالص', value: `${fmt(stats.grossLoss)}$` })))),
        $h(KCard, { C, title: 'پایبندی به پلن', glow: planColor, hint: 'درصد معاملاتی که هنگام ثبت «طبق پلن» علامت زده‌ای. معاملات بدون پاسخ حساب نمی‌شوند.' },
            planRate === null
                ? $h('div', { className: 'kpi-sub' }, 'هنوز در ثبت معامله به این سؤال پاسخ نداده‌ای')
                : $h('div', { className: 'kpi-row' },
                    $h(Donut, { C, size: 92, thickness: 12, segments: [{ value: planYes, color: pos, label: 'طبق پلن' }, { value: planNo, color: neg, label: 'خارج از پلن' }], centerTop: `${fmt(planRate, 0)}%`, centerSub: 'طبق پلن' }),
                    $h('div', { className: 'kpi-leg' },
                        $h(LegRow, { color: pos, label: 'طبق پلن', value: planYes }),
                        $h(LegRow, { color: neg, label: 'خارج از پلن', value: planNo }))), ruleLine),
        $h('button', { type: 'button', onClick: () => setMore(m => !m), style: { gridColumn: '1 / -1', background: 'transparent', border: `1px solid ${C.text}22`, color: `${C.text}99`, borderRadius: 12, padding: '10px 0', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } }, more ? 'جزئیات کمتر ▲' : 'جزئیات بیشتر ▼'),
        more && $h(React.Fragment, null,
        $h(KCard, { C, title: 'میانگین سود / ضرر', glow: acc, hint: 'نسبت میانگین معامله‌ی برنده به میانگین معامله‌ی بازنده. هرچه عدد بزرگ‌تر باشد، با نرخ برد کمتر هم سودده می‌مانی.' },
            $h('div', { className: 'kpi-row' },
                $h(Donut, { C, size: 92, thickness: 12, segments: [{ value: stats.avgWin, color: pos, label: 'میانگین سود' }, { value: stats.avgLoss, color: neg, label: 'میانگین ضرر' }], centerTop: ratio === Infinity ? '∞' : `1:${fmt(ratio, 1)}`, centerSub: 'سود به ضرر' }),
                $h('div', { className: 'kpi-leg' },
                    $h(LegRow, { color: pos, label: 'سود', value: `+${fmt(stats.avgWin)}$` }),
                    $h(LegRow, { color: neg, label: 'ضرر', value: `-${fmt(stats.avgLoss)}$` })))),
        $h(KCard, { C, title: 'اکسپکتنسی', glow: stats.expectancy >= 0 ? pos : neg, hint: 'میانگین سود یا زیان هر معامله. سوزن سمت سبز یعنی سیستم در بلندمدت مثبت است (مقیاس بر حسب R).' },
            $h('div', { className: 'kpi-row', style: { justifyContent: 'center' } },
                $h(Gauge, { C, value: expR, min: -1, max: 1, size: 132, centerTop: `${sgn(stats.expectancy)}${fmt(stats.expectancy, 1)}$`, centerSub: 'هر معامله' }))),
        $h(KCard, { C, title: 'تعداد معاملات', glow: acc, hint: 'تعداد کل معاملات و سهم خرید و فروش. روی هر بخش بزن تا درصدش را ببینی.' },
            $h('div', { className: 'kpi-row' },
                $h(Donut, { C, size: 92, thickness: 12, segments: [{ value: buys, color: pos, label: 'خرید' }, { value: sells, color: neg, label: 'فروش' }], centerTop: String(stats.total), centerSub: 'معامله' }),
                $h('div', { className: 'kpi-leg' },
                    $h(LegRow, { color: pos, label: 'خرید', value: buys }),
                    $h(LegRow, { color: neg, label: 'فروش', value: sells })))),
        $h(KCard, { C, title: 'رشد در برابر افت', glow: acc, hint: 'بیشترین رشد پیوسته‌ی سرمایه در برابر بیشترین افت از سقف. اگر نوار قرمز به سبز نزدیک شد، مدیریت ریسک را مرور کن.' },
            $h(BarPair, { C, a: { label: 'بیشترین رشد', value: stats.maxRunUp, text: `+${fmt(stats.maxRunUp)}$`, color: pos }, b: { label: 'بیشترین افت', value: stats.maxDD, text: `-${fmt(stats.maxDD)}$`, color: neg } })),
        $h(KCard, { C, title: 'بهترین / بدترین', glow: acc, hint: 'بزرگ‌ترین سود و بزرگ‌ترین زیان تک‌معامله. فاصله‌ی این دو نشان می‌دهد زیان‌ها تحت کنترل‌اند یا نه.' },
            $h(BarPair, { C, a: { label: 'بهترین معامله', value: stats.best, text: `+${fmt(stats.best)}$`, color: pos }, b: { label: 'بدترین معامله', value: Math.abs(stats.worst), text: `${fmt(stats.worst)}$`, color: neg } }))));
}

/* ---------- انتخاب‌گر رنگ سفارشی (بدون input نیتیو) ---------- */
const COLOR_SWATCHES = ['#8B5E3C', '#B88A6A', '#D4A373', '#E8C9A6', '#4A5D4E', '#7BBFA4', '#5A8F7B', '#C26B5A', '#E08C7B', '#F5F2EB', '#26211C', '#1E1A16', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];
function ColorField({ label, icon, value, onChange, C }) {
    const [open, setOpen] = useState(false);
    const [hex, setHex] = useState(value);
    useEffect(() => { setHex(value); }, [value]);
    const [hh, ss, ll] = hexToHsl(isHex6(value) ? value : '#888888');
    const setHsl = (a, b, c) => onChange(hslToHex(a, b, c));
    const slider = (min, max, v, onC, bg) => $h('input', { type: 'range', min, max, value: v, onChange: e => onC(Number(e.target.value)), className: 'cp-range', style: { background: bg } });
    return $h('div', { className: 'cp-row' + (open ? ' open' : '') },
        $h('button', { type: 'button', className: 'cp-head', onClick: () => setOpen(o => !o) },
            $h('span', { className: 'cp-lbl' }, $h('span', { style: { opacity: 0.7 } }, icon), ' ', label),
            $h('span', { className: 'cp-val' }, $h('code', null, value), $h('i', { className: 'cp-sw', style: { background: value } }))),
        open && $h('div', { className: 'cp-pop dropdown-open' },
            $h('div', { className: 'cp-swatches' }, COLOR_SWATCHES.map(c => $h('button', { key: c, type: 'button', 'aria-label': c, className: 'cp-s' + (c.toLowerCase() === String(value).toLowerCase() ? ' on' : ''), style: { background: c }, onClick: () => onChange(c) }))),
            $h('div', { className: 'cp-sl' }, $h('span', null, 'رنگ'), slider(0, 360, hh, v => setHsl(v, ss, ll), 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)')),
            $h('div', { className: 'cp-sl' }, $h('span', null, 'غلظت'), slider(0, 100, ss, v => setHsl(hh, v, ll), `linear-gradient(90deg,${hslToHex(hh, 0, ll)},${hslToHex(hh, 100, ll)})`)),
            $h('div', { className: 'cp-sl' }, $h('span', null, 'روشنی'), slider(0, 100, ll, v => setHsl(hh, ss, v), `linear-gradient(90deg,#000,${hslToHex(hh, ss, 50)},#fff)`)),
            $h('div', { className: 'cp-hex' }, $h('span', null, 'کد HEX'),
                $h('input', { value: hex, dir: 'ltr', maxLength: 7, onChange: e => { let v = e.target.value.trim(); if (v && v[0] !== '#')
                        v = '#' + v; setHex(v); if (isHex6(v))
                        onChange(v); } }))));
}

/* ---------- طرح‌ها و تم‌های هماهنگ با سایت ---------- */
const UI_STYLES = [
    { id: 'clay', name: 'کلی‌مورفیسم', desc: 'برجسته، نرم و خمیری' },
    { id: 'glass', name: 'گلاس‌مورفیسم', desc: 'شیشه‌ی مات با بلور' },
    { id: 'neu', name: 'نئومورفیسم', desc: 'هم‌رنگ زمینه با سایه‌ی نرم' },
];
const BLOG_PRESETS = [
    { name: 'قهوه‌ای تیره (هماهنگ با سایت)', bg: '#1E1A16', bgAlt: '#26211C', bgCard: '#26211C', accent: '#D4A373', positive: '#7BBFA4', negative: '#E08C7B', text: '#F2EAD9', navColor: '#8B5E3C' },
    { name: 'کرم روشن (هماهنگ با سایت)', bg: '#F5F2EB', bgAlt: '#EFEBE3', bgCard: '#FAF8F4', accent: '#8B5E3C', positive: '#4A7C69', negative: '#C26B5A', text: '#3E2C1F', navColor: '#8B5E3C' },
];
function StylePreview({ id, C }) {
    const light = lumOf(C.bg) > 0.6;
    const dk = light ? 'rgba(150,125,100,.4)' : 'rgba(0,0,0,.5)', lt = light ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.06)';
    const base = { height: 54, borderRadius: id === 'neu' ? 14 : 20, position: 'relative', overflow: 'hidden' };
    let st;
    if (id === 'clay')
        st = { ...base, background: `linear-gradient(145deg, ${C.bgCard}, ${C.bg})`, boxShadow: `7px 7px 14px ${dk}, -5px -5px 11px ${lt}, inset 2px 2px 4px rgba(255,255,255,.12), inset -3px -3px 6px rgba(0,0,0,.14)` };
    else if (id === 'neu')
        st = { ...base, background: C.bg, boxShadow: `6px 6px 12px ${dk}, -6px -6px 12px ${lt}` };
    else
        st = { ...base, background: `linear-gradient(135deg, ${C.accent}55, ${C.positive}33)`, border: '1px solid rgba(255,255,255,.28)', backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.35)' };
    return $h('div', { style: st },
        $h('div', { style: { position: 'absolute', top: 10, right: 12, width: 26, height: 8, borderRadius: 5, background: C.accent, opacity: 0.9 } }),
        $h('div', { style: { position: 'absolute', bottom: 10, right: 12, width: 44, height: 6, borderRadius: 4, background: `${C.text}33` } }),
        $h('div', { style: { position: 'absolute', top: 12, left: 12, width: 18, height: 18, borderRadius: '50%', background: id === 'neu' ? C.bg : C.positive, boxShadow: id === 'neu' ? `inset 2px 2px 4px ${dk}, inset -2px -2px 4px ${lt}` : 'none' } }));
}
function PersonalizationPanel({ theme, updateTheme, resetTheme }) {
    const [tab, setTab] = useState('style');
    const C = theme;
    useEffect(() => { try { document.documentElement.style.background = C.bg; document.body.style.background = C.bg; const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', C.bg); } catch (e) { } }, [C.bg]);
    const tabs = [['style', '🧩 طرح'], ['preset', '🎨 تم آماده'], ['custom', '🎛️ انتخاب رنگ']];
    const all = [...BLOG_PRESETS, ...PRESET_THEMES];
    const rows = [
        { key: 'accent', label: 'رنگ اصلی', icon: '✦' }, { key: 'navColor', label: 'رنگ نوار پایین', icon: '💠' },
        { key: 'positive', label: 'رنگ سود', icon: '📈' }, { key: 'negative', label: 'رنگ زیان', icon: '📉' },
        { key: 'text', label: 'رنگ متن', icon: '✏️' }, { key: 'bg', label: 'پس‌زمینه اصلی', icon: '🖼️' }, { key: 'bgCard', label: 'پس‌زمینه کارت‌ها', icon: '📋' },
    ];
    return $h('div', { className: 'pz' },
        $h('div', { className: 'pz-tabs', style: { background: `${C.text}0d` } }, tabs.map(([k, l]) => $h('button', { key: k, type: 'button', className: tab === k ? 'on' : '', onClick: () => setTab(k) }, l))),
        tab === 'style' && $h('div', { className: 'pz-styles' },
            UI_STYLES.map(s => $h('button', { key: s.id, type: 'button', className: 'pz-style' + ((C.ui || 'clay') === s.id ? ' on' : ''), onClick: () => updateTheme({ ui: s.id }) },
                $h(StylePreview, { id: s.id, C }),
                $h('div', { className: 'pz-style-t' }, s.name, (C.ui || 'clay') === s.id ? ' ✓' : ''),
                $h('div', { className: 'pz-style-d' }, s.desc)))),
        tab === 'preset' && $h('div', { className: 'pz-presets' }, all.map((p, i) => {
            const active = C.accent === p.accent && C.bg === p.bg && C.positive === p.positive;
            return $h('button', { key: i, type: 'button', className: 'pz-preset' + (active ? ' on' : ''), onClick: () => updateTheme(p) },
                $h('span', { className: 'pz-dots' }, [p.bg, p.bgCard, p.accent, p.positive, p.negative].map((c, j) => $h('i', { key: j, style: { background: c } }))),
                $h('span', null, p.name, active ? ' ✓' : ''));
        })),
        tab === 'custom' && $h('div', null,
            $h('div', { className: 'pz-note' }, 'روی هر ردیف بزن تا انتخاب‌گر رنگ باز شود. تغییرها همان لحظه و خودکار ذخیره می‌شوند.'),
            rows.map(r => $h(ColorField, { key: r.key, label: r.label, icon: r.icon, value: C[r.key], C, onChange: (v) => updateTheme({ [r.key]: v }) }))),
        $h('button', { type: 'button', onClick: resetTheme, className: 'pz-reset' }, $h(RotateCcw, { size: 13 }), ' بازگشت به پیش‌فرض'));
}

/* ---------- پروفایل ---------- */
function ProfileModal({ C, user, userName, setUserName, stats, trades, balance, onClose, onAppearance, onPass, onBackup, onLogout, sub, onSub }) {
    const [nm, setNm] = useState(userName || '');
    const [goal, setGoal] = useState('');
    useEffect(() => { (async () => { try {
        const g = await storage.get('journal-goal');
        if (g && g.value)
            setGoal(g.value);
    }
    catch (e) { } })(); }, []);
    useEffect(() => { const h2 = e => { if (e.key === 'Escape')
        onClose(); }; window.addEventListener('keydown', h2); return () => window.removeEventListener('keydown', h2); }, []);
    const [nmSaved, setNmSaved] = useState(false);
    const nmDirty = nm.trim().length >= 2 && nm.trim() !== userName;
    const saveName = () => { const n = nm.trim(); if (n.length < 2)
        return; setUserName(n); try {
        storage.set('journal-username', n);
    }
    catch (e) { } setNmSaved(true); setTimeout(() => setNmSaved(false), 2400); };
    const saveGoal = (v) => { setGoal(v); try {
        storage.set('journal-goal', v);
    }
    catch (e) { } };
    const sorted = [...trades].sort((a, b) => (`${a.date || ''} ${a.time || '00:00'}`).localeCompare(`${b.date || ''} ${b.time || '00:00'}`) || Number(a.id || 0) - Number(b.id || 0));
    let curW = 0, bestW = 0;
    sorted.forEach(t => { const r = resultOf(t); if (r === 'win') {
        curW++;
        bestW = Math.max(bestW, curW);
    }
    else if (r === 'loss')
        curW = 0; });
    const lastRes = sorted.length ? resultOf(sorted[sorted.length - 1]) : '';
    let streak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (resultOf(sorted[i]) === lastRes)
            streak++;
        else
            break;
    }
    const days = new Set(sorted.map(t => t.date)).size;
    const since = sorted.length ? sorted[0].date : '';
    const mk = toLocalISODate(new Date()).slice(0, 7);
    const monthPnl = trades.filter(t => String(t.date || '').startsWith(mk)).reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    const goalN = parseFloat(goal) || 0;
    const goalPct = goalN > 0 ? clamp01(monthPnl / goalN) : 0;
    const bySym = trades.length ? groupBy(trades, 'symbol') : [], bySes = trades.length ? groupBy(trades, 'session') : [], byDay = trades.length ? groupBy(trades, 'day').filter(x => x.name && x.name !== 'undefined') : [];
    const avgRisk = trades.length ? trades.reduce((s, t) => s + (Number(t.riskPercent) || 0), 0) / trades.length : 0;
    const planKnown = trades.filter(t => t.followedPlan === 'yes' || t.followedPlan === 'no');
    const planRate = planKnown.length ? planKnown.filter(t => t.followedPlan === 'yes').length / planKnown.length * 100 : null;
    const disciplined = trades.length >= 10 && trades.every(t => (Number(t.riskPercent) || 0) <= 2);
    const badges = [
        { i: '🌱', t: 'شروع مسیر', d: 'اولین معامله ثبت شد', ok: stats.total >= 1 },
        { i: '📒', t: 'ده معامله', d: '۱۰ معامله در ژورنال', ok: stats.total >= 10 },
        { i: '🏛️', t: 'پنجاه معامله', d: '۵۰ معامله در ژورنال', ok: stats.total >= 50 },
        { i: '🔥', t: 'سه برد پیاپی', d: 'سه برد پشت‌سرهم', ok: bestW >= 3 },
        { i: '⚖️', t: 'پروفیت فکتور ۱.۵+', d: 'حداقل ۱۰ معامله', ok: stats.total >= 10 && stats.profitFactor >= 1.5 },
        { i: '🛡️', t: 'ریسک منضبط', d: '۱۰ معامله با ریسک ≤ ۲٪', ok: disciplined },
        { i: '📅', t: 'هفت روز فعال', d: '۷ روز معاملاتی متفاوت', ok: days >= 7 },
        { i: '💰', t: 'سودده', d: 'سود خالص مثبت', ok: stats.netPnl > 0 },
    ];
    const unlocked = badges.filter(b => b.ok).length;
    const fav = (arr, f) => arr.length ? f(arr[0]) : '—';
    const mini = (l, v, c) => $h('div', { className: 'pf-mini', key: l }, $h('span', null, l), $h('b', { style: { color: c || C.text } }, v));
    return $h('div', { className: 'pf-back', onClick: onClose },
        $h('div', { className: 'pf-box', role: 'dialog', 'aria-label': 'پروفایل', onClick: e => e.stopPropagation() },
            $h('button', { type: 'button', className: 'pf-x', onClick: onClose, 'aria-label': 'بستن' }, '✕'),
            $h('div', { className: 'pf-hero' },
                $h(ProfileAvatar, { size: 76, accent: C.accent, name: nm || userName }),
                $h('div', { className: 'pf-id' },
                    $h('input', { className: 'pf-name', value: nm, placeholder: 'نام کاربری', maxLength: 24, onChange: e => { setNm(e.target.value); setNmSaved(false); }, onKeyDown: e => { if (e.key === 'Enter')
                            saveName(); } }),
                    (nmDirty || nmSaved) && $h('button', { type: 'button', onClick: nmDirty ? saveName : undefined, style: { alignSelf: 'flex-start', margin: '6px 0 2px', border: 0, borderRadius: 10, padding: '7px 14px', font: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: nmDirty ? 'pointer' : 'default', background: nmDirty ? C.accent : `${C.positive}30`, color: nmDirty ? '#111' : C.positive } }, nmDirty ? '✓ تأیید نام کاربری' : '✓ نام کاربری ذخیره شد'),
                    $h('div', { className: 'pf-sub' }, $h('span', { dir: 'ltr', style: { unicodeBidi: 'isolate' } }, user.email || user.name), ' 🔒' + (since ? ` · از ${since}` : '')),
                    $h('div', { className: 'pf-hint', style: { marginTop: 2 } }, 'نام را بنویس و «تأیید نام کاربری» را بزن؛ ایمیل ثابت است.'),
                    $h('div', { className: 'pf-chips' },
                        $h('span', null, `${stats.total} معامله`), $h('span', null, `${days} روز فعال`), $h('span', null, `موجودی ${fmt(balance)}$`)))),
            $h('div', { className: 'pf-grid' },
                $h('div', { className: 'pf-card' },
                    $h('div', { className: 'pf-h' }, '🎯 هدف سود این ماه'),
                    $h('div', { className: 'pf-goal' },
                        $h(Donut, { C, size: 96, thickness: 11, hoverable: false, segments: [{ value: goalPct, color: monthPnl >= 0 ? C.positive : C.negative, label: '' }, { value: 1 - goalPct, color: 'transparent', label: '' }], centerTop: goalN > 0 ? `${Math.round(goalPct * 100)}%` : '—', centerSub: 'پیشرفت' }),
                        $h('div', { className: 'pf-goal-r' },
                            $h('label', null, 'هدف (دلار)'),
                            $h('input', { value: goal, inputMode: 'decimal', placeholder: 'مثلاً 500', dir: 'ltr', onChange: e => saveGoal(e.target.value.replace(/[^0-9.]/g, '')) }),
                            $h('div', { className: 'pf-hint' }, `سود این ماه: `, $h('b', { style: { color: monthPnl >= 0 ? C.positive : C.negative, fontFamily: MONO } }, `${monthPnl >= 0 ? '+' : ''}${fmt(monthPnl)}$`))))),
                $h('div', { className: 'pf-card' },
                    $h('div', { className: 'pf-h' }, '📈 عملکرد من'),
                    $h('div', { className: 'pf-minis' },
                        mini('نرخ برد', `${fmt(stats.winRate, 0)}%`, C.accent),
                        mini('سود خالص', `${stats.netPnl >= 0 ? '+' : ''}${fmt(stats.netPnl)}$`, stats.netPnl >= 0 ? C.positive : C.negative),
                        mini('بیشترین برد پیاپی', bestW),
                        mini('روند فعلی', streak ? `${streak} ${lastRes === 'win' ? 'برد' : lastRes === 'loss' ? 'باخت' : 'BE'}` : '—', lastRes === 'win' ? C.positive : lastRes === 'loss' ? C.negative : C.text),
                        mini('میانگین ریسک', `${fmt(avgRisk, 1)}%`),
                        mini('پایبندی به پلن', planRate === null ? '—' : `${fmt(planRate, 0)}%`, planRate === null ? C.text : planRate >= 70 ? C.positive : C.accent))),
                $h('div', { className: 'pf-card' },
                    $h('div', { className: 'pf-h' }, '⭐ نقاط قوت'),
                    $h('div', { className: 'pf-minis' },
                        mini('بهترین نماد', fav(bySym, x => x.name)),
                        mini('بهترین سشن', fav(bySes, x => x.name)),
                        mini('بهترین روز', fav(byDay, x => x.name)))),
                $h('div', { className: 'pf-card pf-wide' },
                    $h('div', { className: 'pf-h' }, `🏅 دستاوردها (${unlocked}/${badges.length})`),
                    $h('div', { className: 'pf-badges' }, badges.map(b => $h('div', { key: b.t, className: 'pf-badge' + (b.ok ? ' on' : ''), title: b.d },
                        $h('span', { className: 'pf-b-i' }, b.i), $h('b', null, b.t), $h('small', null, b.d)))))),
            (() => { const si = sub ? subInfo(sub) : null; return $h('div', { className: 'sb-pf' }, $h('div', null, $h('b', null, !si ? 'اشتراک: در حال بررسی…' : si.kind === 'paid' ? 'اشتراک فعال' : si.kind === 'trial' ? 'دوره‌ی رایگان' : 'اشتراک تمام شده'), $h('small', null, !si ? '' : si.kind === 'none' ? 'برای ادامه تمدید کن' : si.fa(si.left) + ' روز مانده · تا ' + si.date)), $h('button', { type: 'button', onClick: () => { onClose(); onSub(); } }, '💳 خرید / تمدید')); })(),
            $h('div', { className: 'pf-actions' },
                $h('button', { type: 'button', onClick: () => { onClose(); onAppearance(); } }, '🎨 ظاهر و رنگ‌ها'),
                $h('button', { type: 'button', onClick: () => { onClose(); onPass(); } }, '🔑 تغییر رمز'),
                $h('button', { type: 'button', onClick: onBackup }, '💾 بک‌آپ'),
                $h('button', { type: 'button', className: 'danger', onClick: () => { onClose(); onLogout(); } }, '⎋ خروج'))));
}

/* ---------- فرم تخصصی ثبت معامله ---------- */
const MISTAKE_TAGS = ['ورود زودهنگام', 'جابه‌جایی استاپ', 'لات زیاد', 'بدون ستاپ', 'انتقام', 'FOMO', 'نقض قانون', 'خروج زودهنگام', 'قانون شکسته'];
function sessionFromTime(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
    if (!m)
        return null;
    const iran = Number(m[1]) * 60 + Number(m[2]);
    const utc = ((iran - 210) % 1440 + 1440) % 1440 / 60;
    if (utc >= 8 && utc < 13)
        return SESSIONS[1];
    if (utc >= 13 && utc < 17)
        return SESSIONS[3];
    if (utc >= 17 && utc < 22)
        return SESSIONS[2];
    return SESSIONS[0];
}
const XIcon = X;
class FormGuard extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(e) { return { err: e }; }
    render() {
        if (this.state.err) return React.createElement("div", { style: { padding: 24, textAlign: 'center', color: 'var(--fx-text)', lineHeight: 2 } },
            React.createElement("div", { style: { fontWeight: 800, marginBottom: 8 } }, "خطا در فرم معامله"),
            React.createElement("div", { dir: 'ltr', style: { fontSize: 12, opacity: .7, marginBottom: 14 } }, String(this.state.err && this.state.err.message || this.state.err)),
            React.createElement("button", { type: 'button', className: 'tf-submit', onClick: this.props.onClose }, "بستن"));
        return this.props.children;
    }
}
function TradeFormBody(P) {
    const { C, form, setForm, editingId, strategies, newStrategy, setNewStrategy, addStrategyOption, removeStrategyOption, setExitFrom, addTrade, closeFormSoft, balance, ruleEval, rules, propSt } = P;
    const [costs, setCosts] = useState(!!(form.commission || form.swap));
    const set = (k, v) => setForm(f => ({ ...f, [k]: NUM_KEYS.includes(k) ? normNum(v) : v }));
    const sym = form.symbol === 'Custom' ? (form.customSymbol || '').trim().toUpperCase() : form.symbol;
    const symFirst = useRef(true);
    useEffect(() => {
        const d = defaultContract(sym) ? String(defaultContract(sym)) : '';
        if (symFirst.current) { symFirst.current = false; if (!form.contractSize && d) set('contractSize', d); return; }
        set('contractSize', d);
    }, [sym]);
    const isBuy = form.direction === 'خرید';
    const E = parseFloat(form.entryPrice), S = parseFloat(form.stopLoss), T = parseFloat(form.target), X = parseFloat(form.exitPrice);
    const fin = Number.isFinite;
    const rr = calcRR(form.entryPrice, form.stopLoss, form.target);
    const slBad = fin(E) && fin(S) && (isBuy ? S >= E : S <= E);
    const tpBad = fin(E) && fin(T) && (isBuy ? T <= E : T >= E);
    const riskPct = parseFloat(form.riskPercent) || 0;
    const riskUsd = balance > 0 ? balance * riskPct / 100 : 0;
    const spec0 = pnlSpec(sym, E, form.convRate, form.contractSize);
    const mult = spec0 && spec0.toUsd ? spec0.size * spec0.toUsd : 0;
    const dist = fin(E) && fin(S) ? Math.abs(E - S) : 0;
    const sugLots = mult > 0 && riskUsd > 0 && dist > 0 ? Math.floor(riskUsd / (dist * mult) * 100) / 100 : 0;
    const pnl = parseFloat(form.pnl);
    const rReal = riskUsd > 0 && fin(pnl) ? pnl / riskUsd : null;
    const rrColor = rr === null ? `${C.text}66` : rr >= 2 ? C.positive : rr >= 1 ? C.accent : C.negative;
    const pts = [{ k: 'SL', v: S, c: C.negative }, { k: 'ورود', v: E, c: C.accent }, { k: 'TP', v: T, c: C.positive }, { k: 'خروج', v: X, c: C.text }].filter(p => fin(p.v));
    const lo = pts.length ? Math.min(...pts.map(p => p.v)) : 0, hi = pts.length ? Math.max(...pts.map(p => p.v)) : 0;
    const pc = (v) => hi > lo ? ((v - lo) / (hi - lo) * 100) : 50;
    const nowFill = () => { const d = new Date(), p2 = n => String(n).padStart(2, '0'); setForm(f => ({ ...f, date: toLocalISODate(d), time: `${p2(d.getHours())}:${p2(d.getMinutes())}` })); };
    const mistakes = Array.isArray(form.mistakes) ? form.mistakes : [];
    const toggleMistake = (m) => set('mistakes', mistakes.includes(m) ? mistakes.filter(x => x !== m) : [...mistakes, m]);
    const chip = (on, label, onClick, extra) => $h('button', { key: label, type: 'button', className: 'tf-chip' + (on ? ' on' : '') + (extra ? ' ' + extra : ''), onClick }, label);
    const field = (label, k, ph, cls) => $h('label', { className: 'tf-f ' + (cls || '') },
        $h('span', null, label),
        $h('input', { className: 'tf-in', type: 'text', inputMode: 'decimal', placeholder: ph || '', value: form[k], onChange: e => set(k, e.target.value) }));
    const resColor = form.result === 'win' ? C.positive : form.result === 'loss' ? C.negative : C.accent;
    return $h('div', { className: 'tf' },
        $h('div', { className: 'tf-head' },
            $h('div', null,
                $h('div', { className: 'tf-title' }, editingId ? 'ویرایش معامله' : 'ثبت معامله جدید'),
                $h('div', { className: 'tf-sub' }, `${sym || '—'} · ${form.direction} · ${form.session}`)),
            $h('button', { type: 'button', className: 'tf-close', onClick: closeFormSoft, 'aria-label': 'بستن' }, $h(XIcon, { size: 18 }))),
        $h('div', { className: 'tf-body' },
            $h('div', { className: 'tf-dirs' },
                $h('button', { type: 'button', className: 'tf-dir buy' + (isBuy ? ' on' : ''), onClick: () => set('direction', 'خرید') }, $h(TrendingUp, { size: 20 }), ' خرید (Buy)'),
                $h('button', { type: 'button', className: 'tf-dir sell' + (!isBuy ? ' on' : ''), onClick: () => set('direction', 'فروش') }, $h(TrendingDown, { size: 20 }), ' فروش (Sell)')),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '🎯 نماد و سشن'),
                $h('div', { className: 'tf-chips' }, SYMBOL_PRESETS.map(s => chip(form.symbol === s, s, () => set('symbol', s), 'mono')), chip(form.symbol === 'Custom', 'دیگر…', () => set('symbol', 'Custom'))),
                form.symbol === 'Custom' && $h('input', { className: 'tf-in', style: { marginTop: 10 }, placeholder: 'نام نماد، مثلاً USDJPY', value: form.customSymbol, onChange: e => set('customSymbol', e.target.value.toUpperCase()) }),
                $h('div', { className: 'tf-chips', style: { marginTop: 12 } },
                    SESSIONS.map(s => chip(form.session === s, s, () => set('session', s))),
                    $h('button', { type: 'button', className: 'tf-chip ghost', onClick: () => { const s = sessionFromTime(form.time); if (s)
                            set('session', s); } }, '⏱ از روی ساعت')),
                $h('div', { style: { fontSize: 12, opacity: 0.6, margin: '12px 0 6px' } }, 'تایم‌فریم ورود (اختیاری)'),
                $h('div', { className: 'tf-chips' }, TIMEFRAMES.map(tf => chip(form.timeframe === tf, tf, () => set('timeframe', form.timeframe === tf ? '' : tf), 'mono')))),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '🗓️ زمان', $h('button', { type: 'button', className: 'tf-link', onClick: nowFill }, 'همین الان')),
                $h('div', { className: 'tf-grid3' },
                    $h('div', { className: 'tf-f' }, $h('span', null, 'روز هفته'), $h('div', { className: 'tf-pill' }, weekdayFaFromDate(form.date) || '—')),
                    $h('div', { className: 'tf-f' }, $h('span', null, 'ساعت (ایران)'), $h(CustomTimePicker, { value: form.time, onChange: t => set('time', t), C })),
                    $h('div', { className: 'tf-f' }, $h('span', null, 'تاریخ'), $h(CustomDatePicker, { value: form.date, onChange: d => set('date', d), C })))),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '📐 قیمت‌ها و ریسک به ریوارد'),
                $h('div', { className: 'tf-grid2' },
                    field('قیمت ورود', 'entryPrice', '0.00', 'entry'),
                    field('استاپ لاس (SL)', 'stopLoss', '0.00', 'sl'),
                    field('تارگت (TP)', 'target', '0.00', 'tp'),
                    $h('div', { className: 'tf-f exit' }, $h('span', null, 'قیمت خروج'),
                        $h('div', { className: 'tf-exit' },
                            $h('input', { className: 'tf-in', type: 'text', inputMode: 'decimal', placeholder: '0.00', value: form.exitPrice, onChange: e => set('exitPrice', e.target.value) }),
                            $h('button', { type: 'button', className: 'tf-mini neg', onClick: () => setExitFrom('stop') }, 'SL'),
                            $h('button', { type: 'button', className: 'tf-mini pos', onClick: () => setExitFrom('target') }, 'TP')))),
                (sym && !fxPair(sym)) && $h('div', { style: { marginTop: 10 } },
                    field('ارزش هر ۱ واحد حرکت قیمت برای ۱ لات ($)', 'contractSize', '10', ''),
                    $h('div', { style: { fontSize: 11.5, opacity: .6, marginTop: 6, lineHeight: 1.8 } }, 'بروکرها فرق دارند. مثلاً اگر با ۰.۰۱ لات و ۱۰۰ واحد حرکت، ۱۰ دلار سود یا زیان می‌کنی، ۱۰ بنویس. عدد هر نماد برای دفعه‌ی بعد یادآوری می‌شود.')),
                convHint(sym) && $h('div', { style: { marginTop: 10 } },
                    field('نرخ ' + convHint(sym).pair + ' (برای تبدیل سود به دلار)', 'convRate', '0.00', ''),
                    $h('div', { style: { fontSize: 11.5, opacity: .6, marginTop: 6, lineHeight: 1.8 } }, 'این جفت‌ارز دلار ندارد؛ قیمت ' + convHint(sym).pair + ' را همان زمان بنویس تا سود به دلار حساب شود. اگر نمی‌دانی، سود را دستی بنویس.')),
                (slBad || tpBad) && $h('div', { className: 'tf-warn' }, slBad ? `⚠️ برای ${isBuy ? 'خرید' : 'فروش'}، استاپ باید ${isBuy ? 'زیر' : 'بالای'} قیمت ورود باشد.` : `⚠️ برای ${isBuy ? 'خرید' : 'فروش'}، تارگت باید ${isBuy ? 'بالای' : 'زیر'} قیمت ورود باشد.`),
                $h('div', { className: 'tf-rr' },
                    $h('div', { className: 'tf-rr-top' },
                        $h('span', null, 'ریسک به ریوارد'),
                        $h('b', { style: { color: rrColor, fontFamily: MONO } }, rr === null ? '—' : `1 : ${fmt(rr, 2)}`)),
                    $h('div', { className: 'tf-rr-bar' },
                        $h('i', { style: { width: rr === null ? '50%' : `${100 / (1 + rr)}%`, background: C.negative } }),
                        $h('i', { style: { width: rr === null ? '50%' : `${100 * rr / (1 + rr)}%`, background: C.positive } })),
                    pts.length >= 2 && hi > lo && $h('div', { className: 'tf-ladder' },
                        $h('div', { className: 'tf-lad-line' }),
                        fin(E) && fin(S) && $h('div', { className: 'tf-lad-zone', style: { left: pc(Math.min(E, S)) + '%', width: Math.abs(pc(E) - pc(S)) + '%', background: `${C.negative}55` } }),
                        fin(E) && fin(T) && $h('div', { className: 'tf-lad-zone', style: { left: pc(Math.min(E, T)) + '%', width: Math.abs(pc(E) - pc(T)) + '%', background: `${C.positive}55` } }),
                        pts.map(p => $h('div', { key: p.k, className: 'tf-lad-pt', style: { left: pc(p.v) + '%' } }, $h('i', { style: { background: p.c } }), $h('small', { style: { color: p.c } }, p.k))))),
            ),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '⚖️ اندازه پوزیشن'),
                $h('div', { className: 'tf-grid2' },
                    field('حجم (لات)', 'volume', '0.10', ''),
                    field('ریسک از موجودی (٪)', 'riskPercent', '1', '')),
                $h('div', { className: 'tf-chips', style: { marginTop: 10 } },
                    ['0.5', '1', '1.5', '2'].map(v => chip(String(form.riskPercent) === v, v + '٪', () => set('riskPercent', v), 'mono alt'))),
                $h('div', { className: 'tf-info' },
                    $h('span', null, 'ریسک دلاری: ', $h('b', null, riskUsd ? `${fmt(riskUsd, 2)}$` : '—')),
                    sugLots > 0 && $h('button', { type: 'button', className: 'tf-link', onClick: () => set('volume', String(sugLots)) }, `حجم پیشنهادی ${sugLots} لات — اعمال`))),
            $h('div', { className: 'tf-card' },
                $h('button', { type: 'button', className: 'tf-h tf-fold', onClick: () => setCosts(v => !v) }, '💳 هزینه‌ها (کارمزد و سوآپ)', $h('span', null, costs ? '▲' : '▼')),
                costs && $h('div', { className: 'tf-grid2 dropdown-open' }, field('کارمزد (Commission)', 'commission', '-2', ''), field('سوآپ (Swap)', 'swap', '-1 یا 0.5', ''))),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '🧭 استراتژی ورود'),
                $h('div', { className: 'tf-chips' },
                    chip(form.strategy === '', 'بدون استراتژی', () => set('strategy', '')),
                    strategies.map(s => $h('button', { key: s, type: 'button', className: 'tf-chip' + (form.strategy === s ? ' on' : ''), onClick: () => set('strategy', s) }, s, $h('span', { className: 'tf-x', role: 'button', onClick: (e) => { e.stopPropagation(); removeStrategyOption(s); } }, '×')))),
                $h('div', { className: 'tf-add' },
                    $h('input', { className: 'tf-in', placeholder: 'افزودن استراتژی جدید…', value: newStrategy, onChange: e => setNewStrategy(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                            e.preventDefault();
                            addStrategyOption();
                        } } }),
                    $h('button', { type: 'button', className: 'tf-mini', onClick: addStrategyOption }, $h(Plus, { size: 15 })))),
            $h('div', { className: 'tf-card tf-result' },
                $h('div', { className: 'tf-h' }, '🏁 نتیجه'),
                $h('div', { className: 'tf-pnl-row' },
                    $h('input', { className: 'tf-pnl', type: 'text', inputMode: 'text', placeholder: '150 یا -80', value: form.pnl, style: { color: form.pnl === '' ? C.text : (parseFloat(form.pnl) >= 0 ? C.positive : C.negative), borderColor: form.pnl === '' ? `${C.text}22` : (parseFloat(form.pnl) >= 0 ? `${C.positive}88` : `${C.negative}88`) }, onChange: e => { const v = normNum(e.target.value); setForm(f => ({ ...f, pnl: v, pnlManual: v !== '' })); } }),
                    $h('button', { type: 'button', className: 'tf-calc', onClick: P.calcPnlFromPrices }, '⚡ محاسبه')),
                $h('div', { className: 'tf-seg' }, [{ k: 'win', l: 'برد', c: C.positive }, { k: 'loss', l: 'باخت', c: C.negative }, { k: 'be', l: 'سر به سر', c: C.accent }].map(o => $h('button', { key: o.k, type: 'button', className: form.result === o.k ? 'on' : '', style: form.result === o.k ? { background: `${o.c}26`, color: o.c, borderColor: o.c } : null, onClick: () => set('result', o.k) }, o.l))),
                rReal !== null && $h('div', { className: 'tf-info' }, $h('span', null, 'نتیجه بر حسب R: ', $h('b', { style: { color: rReal >= 0 ? C.positive : C.negative, fontFamily: MONO } }, `${rReal >= 0 ? '+' : ''}${fmt(rReal, 2)}R`))),
                $h('div', { className: 'tf-hint' }, 'با وارد کردن ورود، خروج و حجم، سود/زیان خودکار حساب می‌شود؛ کارمزد و سوآپ هم لحاظ می‌شوند.'),
                (fin(E) && fin(X) && fin(parseFloat(form.volume))) && (() => {
                    const sp = pnlSpec(sym, X, form.convRate, form.contractSize);
                    const msg = !sp ? 'ارزش هر ۱ واحد حرکت این نماد را در بخش قیمت‌ها بنویس، یا سود را دستی وارد کن.' : (!sp.toUsd ? 'نرخ ' + sp.need + ' را در بخش قیمت‌ها وارد کن تا سود حساب شود.' : (form.pnlManual ? 'سود را دستی نوشته‌ای، برای محاسبه‌ی خودکار دکمه‌ی ⚡ را بزن.' : null));
                    return msg ? $h('div', { className: 'tf-warn', style: { marginTop: 8 } }, msg) : null;
                })()),
            $h('div', { className: 'tf-card' },
                $h('div', { className: 'tf-h' }, '🧠 روانشناسی و کیفیت اجرا'),
                $h('div', { className: 'tf-chips' }, EMOTION_TAGS.map(tag => chip(form.emotion === tag, tag, () => set('emotion', form.emotion === tag ? '' : tag)))),
                $h('input', { className: 'tf-in', style: { marginTop: 10 }, placeholder: 'یا احساس دیگری بنویس…', value: form.emotion, onChange: e => set('emotion', e.target.value) }),
                $h('div', { className: 'tf-sublabel' }, 'آیا طبق پلن معامله کردی؟'),
                $h('div', { className: 'tf-seg two' },
                    $h('button', { type: 'button', className: form.followedPlan === 'yes' ? 'on' : '', style: form.followedPlan === 'yes' ? { background: `${C.positive}26`, color: C.positive, borderColor: C.positive } : null, onClick: () => set('followedPlan', form.followedPlan === 'yes' ? '' : 'yes') }, '✅ طبق پلن'),
                    $h('button', { type: 'button', className: form.followedPlan === 'no' ? 'on' : '', style: form.followedPlan === 'no' ? { background: `${C.negative}26`, color: C.negative, borderColor: C.negative } : null, onClick: () => set('followedPlan', form.followedPlan === 'no' ? '' : 'no') }, '⚠️ خلاف پلن')),
                $h('div', { className: 'tf-sublabel' }, 'کیفیت اجرا'),
                $h('div', { className: 'tf-stars' }, [1, 2, 3, 4, 5].map(n => $h('button', { key: n, type: 'button', className: (form.quality || 0) >= n ? 'on' : '', 'aria-label': n + ' ستاره', onClick: () => set('quality', form.quality === n ? 0 : n) }, '★'))),
                $h('div', { className: 'tf-sublabel' }, 'اشتباه‌ها (اختیاری)'),
                $h('div', { className: 'tf-chips' }, MISTAKE_TAGS.map(m => chip(mistakes.includes(m), m, () => toggleMistake(m), 'warn'))),
                $h('textarea', { className: 'tf-in tf-ta', rows: 3, placeholder: 'یادداشت: چرا وارد شدی؟ چه چیزی یاد گرفتی؟', value: form.notes || '', onChange: e => set('notes', e.target.value) })),
            !editingId && ruleEval && $h(RuleWarn, { C, ev: ruleEval, rules }),
            propSt && $h(PropAlert, { C, st: propSt, rules, compact: true, riskNow: parseFloat(form.riskPercent) })),
        $h('div', { className: 'tf-foot' },
            $h('div', { className: 'tf-sum' },
                $h('span', null, `${sym || '—'} · ${form.direction}`),
                $h('b', { style: { color: resColor, fontFamily: MONO } }, form.pnl === '' ? '—' : `${parseFloat(form.pnl) >= 0 ? '+' : ''}${form.pnl}$`)),
            $h('button', { type: 'button', className: 'tf-submit ripple-btn form-submit', onClick: (e) => { createRipple(e, 'rgba(255,255,255,0.4)'); addTrade(); } }, editingId ? 'ذخیره ویرایش' : 'ثبت معامله')));
}

const LAMP_COLORS = [['#ffab3d', 'کهربایی'], ['#00f0ff', 'سایان'], ['#ff3385', 'رز'], ['#00e676', 'نعنایی'], ['#d8e5ff', 'مهتابی']];
const Auth = {
    users() { return localStorage.getItem('fx-has-account') ? [1] : []; },
    find() { return null; },
    mk(u) { const em = u.email || ''; return { id: u.id, email: em, name: em.split('@')[0] || em, ns: 'sb:' + u.id + ':' }; },
    check(email, pw) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()))
            return 'ایمیل معتبر وارد کن';
        if (String(pw || '').length < 6)
            return 'رمز عبور حداقل ۶ کاراکتر باشد';
        return '';
    },
    fa(m) {
        m = String(m || '');
        if (/invalid login/i.test(m)) return 'ایمیل یا رمز عبور اشتباه است';
        if (/already registered|already been registered/i.test(m)) return 'این ایمیل قبلاً ثبت شده؛ وارد شو';
        if (/not confirmed/i.test(m)) return 'ایمیل هنوز تأیید نشده';
        if (/expired|invalid.*(token|otp|code)|(token|otp|code).*invalid/i.test(m)) return 'کد اشتباه است یا منقضی شده؛ دوباره امتحان کن';
        if (/rate limit|too many/i.test(m)) return 'درخواست زیاد است؛ کمی بعد دوباره امتحان کن';
        if (/network|fetch/i.test(m)) return 'اتصال اینترنت را چک کن';
        return 'خطا: ' + m;
    },
    async signup(email, pw) {
        if (!sb) throw new Error('اتصال به سرور برقرار نشد؛ صفحه را دوباره باز کن');
        const bad = this.check(email, pw);
        if (bad) throw new Error(bad);
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw new Error(this.fa(error.message));
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
            throw new Error('این ایمیل قبلاً ثبت شده؛ وارد شو');
        if (!data.session) return { needsOtp: true, email: email.trim() };
        localStorage.setItem('fx-has-account', '1');
        return this.mk(data.user);
    },
    async verifyOtp(email, token, type) {
        if (!sb) throw new Error('اتصال به سرور برقرار نشد؛ صفحه را دوباره باز کن');
        const { data, error } = await sb.auth.verifyOtp({ email: String(email).trim(), token: String(token).trim(), type });
        if (error) throw new Error(this.fa(error.message));
        if (!data || !data.user) throw new Error('تأیید انجام نشد؛ دوباره امتحان کن');
        localStorage.setItem('fx-has-account', '1');
        return this.mk(data.user);
    },
    async resendSignup(email) {
        if (!sb) throw new Error('اتصال به سرور برقرار نشد');
        const { error } = await sb.auth.resend({ type: 'signup', email: String(email).trim() });
        if (error) throw new Error(this.fa(error.message));
    },
    async setNewPassword(pw) {
        if (String(pw || '').length < 6) throw new Error('رمز عبور حداقل ۶ کاراکتر باشد');
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) throw new Error(this.fa(error.message));
    },
    async login(email, pw) {
        if (!sb) throw new Error('اتصال به سرور برقرار نشد؛ صفحه را دوباره باز کن');
        if (!String(email || '').trim() || !pw) throw new Error('ایمیل و رمز عبور را وارد کن');
        const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) { const e = new Error(this.fa(error.message)); if (/not confirmed/i.test(error.message)) e.needsOtp = true; throw e; }
        localStorage.setItem('fx-has-account', '1');
        return this.mk(data.user);
    },
    async changePassword(email, oldPw, newPw) {
        const r = await sb.auth.signInWithPassword({ email, password: oldPw });
        if (r.error) throw new Error('رمز فعلی اشتباه است');
        if (String(newPw || '').length < 6) throw new Error('رمز عبور حداقل ۶ کاراکتر باشد');
        const { error } = await sb.auth.updateUser({ password: newPw });
        if (error) throw new Error(this.fa(error.message));
    },
    async reset(email) {
        if (!sb) throw new Error('اتصال به سرور برقرار نشد');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) throw new Error('اول ایمیل را در کادر بالا بنویس');
        const { error } = await sb.auth.resetPasswordForEmail(email.trim());
        if (error) throw new Error(this.fa(error.message));
    },
    start() { },
    async end() { try { if (sb) await sb.auth.signOut(); } catch (e) { } Cloud.leave(); }
};
/* ===== کد تأیید ایمیل (OTP) ===== */
const normDigits = (s) => String(s == null ? '' : s).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9]/g, '');
function OtpCard({ email, kind, verify, onDone, resend, onBack }) {
    const h = React.createElement, N = 6;
    const [vals, setVals] = useState(() => Array(N).fill(''));
    const [st, setSt] = useState('idle');
    const [msg, setMsg] = useState(null);
    const [cd, setCd] = useState(60);
    const refs = useRef([]), row = useRef(null), fails = useRef(0), alive = useRef(true);
    useEffect(() => { alive.current = true; if (refs.current[0]) refs.current[0].focus(); return () => { alive.current = false; }; }, []);
    useEffect(() => { if (cd <= 0) return; const t = setTimeout(() => setCd(c => c - 1), 1000); return () => clearTimeout(t); }, [cd]);
    const busy = st === 'busy' || st === 'merging' || st === 'ok';
    const run = async (code) => {
        if (busy) return;
        if (fails.current >= 5) { setMsg({ t: 'تلاش ناموفق زیاد بود؛ ۳۰ ثانیه صبر کن', ok: false }); return; }
        setSt('busy'); setMsg(null);
        try {
            const u = await verify(code);
            if (!alive.current) return;
            if (row.current) {
                const box = row.current.getBoundingClientRect(), center = box.left + box.width / 2;
                refs.current.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(); el.style.setProperty('--dx', (center - (r.left + r.width / 2)) + 'px'); el.style.setProperty('--delay', (i * 0.05) + 's'); });
            }
            setSt('merging');
            setTimeout(() => { if (alive.current) setSt('ok'); }, 1150);
            setTimeout(() => { if (alive.current) onDone(u); }, 1950);
        }
        catch (e) {
            if (!alive.current) return;
            fails.current++;
            if (fails.current >= 5) setTimeout(() => { fails.current = 0; }, 30000);
            setSt('err'); setMsg({ t: e.message || 'کد اشتباه است', ok: false });
            setTimeout(() => { if (!alive.current) return; setSt('idle'); setVals(Array(N).fill('')); if (refs.current[0]) refs.current[0].focus(); }, 800);
        }
    };
    const put = (i, raw) => {
        if (busy) return;
        const d = normDigits(raw), nv = vals.slice();
        if (!d) { nv[i] = ''; setVals(nv); return; }
        for (let k = 0; k < d.length && i + k < N; k++) nv[i + k] = d[k];
        setVals(nv); setMsg(null);
        const next = Math.min(i + d.length, N - 1);
        if (refs.current[next]) refs.current[next].focus();
        if (!nv.includes('')) run(nv.join(''));
    };
    const key = (i, e) => {
        if (e.key === 'Backspace' && !vals[i] && i > 0) { const nv = vals.slice(); nv[i - 1] = ''; setVals(nv); refs.current[i - 1].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1].focus();
        else if (e.key === 'ArrowRight' && i < N - 1) refs.current[i + 1].focus();
        else if (e.key === 'Enter' && !vals.includes('')) run(vals.join(''));
    };
    const doResend = async () => {
        if (cd > 0 || busy) return;
        setMsg(null);
        try { await resend(); setCd(60); setVals(Array(N).fill('')); setMsg({ t: 'کد جدید ارسال شد ✓', ok: true }); if (refs.current[0]) refs.current[0].focus(); }
        catch (e) { setMsg({ t: e.message || 'ارسال نشد؛ کمی بعد دوباره امتحان کن', ok: false }); }
    };
    const merging = st === 'merging' || st === 'ok';
    return h('main', { className: `otp-card ${st === 'err' ? 'err' : ''} ${st === 'ok' ? 'ok' : ''}`, dir: 'rtl' },
        h('h1', null, st === 'ok' ? 'تأیید شد' : kind === 'signup' ? 'ایمیلت را تأیید کن' : 'کد بازیابی رمز'),
        h('p', { className: 'otp-desc' }, 'کد ۶ رقمی ارسال‌شده به ', h('b', { dir: 'ltr' }, email), ' را وارد کن.', h('br'), 'اگر ایمیل را ندیدی، پوشه‌ی اسپم (Junk) را هم نگاه کن.'),
        h('div', { className: `otp-row ${merging ? 'merging' : ''}`, ref: row, dir: 'ltr' },
            vals.map((v, i) => h('input', { key: i, ref: el => { refs.current[i] = el; }, type: 'text', inputMode: 'numeric', autoComplete: i === 0 ? 'one-time-code' : 'off', 'aria-label': 'رقم ' + (i + 1), className: v ? 'filled' : '', value: v, onChange: e => put(i, e.target.value), onKeyDown: e => key(i, e), onFocus: e => e.target.select() }))),
        h('div', { className: `otp-msg ${msg ? 'show' : ''} ${msg && msg.ok ? 'good' : ''}`, role: 'alert' }, msg ? msg.t : ''),
        h('div', { className: 'otp-okicon' }, '✓'),
        h('button', { type: 'button', className: 'otp-btn', disabled: busy || vals.includes(''), onClick: () => run(vals.join('')) }, st === 'busy' ? 'در حال بررسی…' : 'تأیید کد'),
        h('div', { className: 'otp-foot' },
            h('button', { type: 'button', onClick: onBack, disabled: busy }, '← تغییر ایمیل'),
            h('button', { type: 'button', onClick: doResend, disabled: cd > 0 || busy }, cd > 0 ? `ارسال دوباره (${cd})` : 'ارسال دوباره')));
}
function SyncBadge({ C, onLocked }) {
    const h = React.createElement;
    const [st, setSt] = useState({ s: Cloud.status, e: Cloud.err });
    useEffect(() => { const f = (s, e) => setSt({ s, e }); Cloud.subs.add(f); setSt({ s: Cloud.status, e: Cloud.err }); return () => { Cloud.subs.delete(f); }; }, []);
    const base = { fontSize: 11.5, background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit' };
    if (st.s === 'error') return h('button', { type: 'button', onClick: () => Cloud.retry(), style: { ...base, color: C.negative, cursor: 'pointer', fontWeight: 700 } }, '⚠ همگام نشد · تلاش دوباره');
    if (st.s === 'locked') return h('button', { type: 'button', onClick: onLocked, style: { ...base, color: '#E8A15B', cursor: 'pointer', fontWeight: 700 } }, '🔒 اشتراک تمام شده · فقط روی این دستگاه ذخیره می‌شود');
    if (st.s === 'offline') return h('span', { style: { ...base, opacity: .7 } }, '○ آفلاین · ذخیره‌ی محلی');
    if (st.s === 'pending') return h('span', { style: { ...base, color: C.accent } }, '◌ در حال ذخیره…');
    return h('span', { className: 'animate-pulse', style: { ...base, color: C.accent } }, '● همگام‌شد');
}

const LAMP_SVG = `<defs>
<linearGradient id="lgBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#454c61"/><stop offset="1" stop-color="#171a23"/></linearGradient>
<linearGradient id="lgArm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2f3e"/><stop offset=".45" stop-color="#5d667c"/><stop offset="1" stop-color="#232733"/></linearGradient>
<linearGradient id="lgShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#565f77"/><stop offset=".55" stop-color="#2f3547"/><stop offset="1" stop-color="#1b1f2b"/></linearGradient>
<linearGradient id="lgBeam" gradientUnits="userSpaceOnUse" x1="178" y1="133" x2="178" y2="390"><stop offset="0" style="stop-color:var(--lamp);stop-opacity:.55"/><stop offset=".6" style="stop-color:var(--lamp);stop-opacity:.12"/><stop offset="1" style="stop-color:var(--lamp);stop-opacity:0"/></linearGradient>
</defs>
<path class="lg-beam" d="M147 133 L209 133 L274 392 L82 392 Z" fill="url(#lgBeam)"/>
<ellipse cx="100" cy="306" rx="70" ry="9" fill="#000" opacity=".35"/>
<path d="M36 297 C36 281 68 274 100 274 C132 274 164 281 164 297 C164 307 132 312 100 312 C68 312 36 307 36 297Z" fill="url(#lgBase)"/>
<ellipse cx="100" cy="284" rx="40" ry="5" fill="#fff" opacity=".07"/>
<path d="M104.4 270.9 L74.4 148.9 L65.6 151.1 L95.6 273.1Z" fill="url(#lgArm)"/>
<path d="M72.3 153.8 L180.3 87.8 L175.7 80.2 L67.7 146.2Z" fill="url(#lgArm)"/>
<line x1="108" y1="270" x2="78" y2="148" stroke="#8d96ac" stroke-width="1.7" stroke-dasharray="2.4 2.2"/>
<line x1="74.4" y1="157.3" x2="182.4" y2="91.3" stroke="#8d96ac" stroke-width="1.7" stroke-dasharray="2.4 2.2"/>
<circle cx="100" cy="272" r="8.5" fill="#2b3040" stroke="#5a627a" stroke-width="2"/><circle cx="100" cy="272" r="3" fill="#97a0b6"/>
<circle cx="70" cy="150" r="9" fill="#2b3040" stroke="#5a627a" stroke-width="2"/><circle cx="70" cy="150" r="3.4" fill="#97a0b6"/>
<g class="lg-head">
<g>
<rect x="172" y="74" width="12" height="12" rx="3" fill="#2b3040" stroke="#5a627a" stroke-width="1.4"/>
<path d="M147 131 C147 104 160 88 178 86 C196 88 209 104 209 131 Z" fill="url(#lgShade)"/>
<path d="M159 124 C159 107 165 97 173 92" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="178" cy="131" rx="31" ry="6.5" fill="#12151d"/>
<ellipse class="lg-lit" cx="178" cy="131" rx="27" ry="4.6" style="fill:var(--lamp)"/>
<ellipse class="lg-bulb" cx="178" cy="134" rx="12" ry="6.5" style="fill:var(--lamp)"/>
</g>
</g>
<circle cx="178" cy="84" r="7" fill="#2b3040" stroke="#5a627a" stroke-width="2"/><circle cx="178" cy="84" r="2.6" fill="#97a0b6"/>
<g class="lg-chain"><line x1="203" y1="136" x2="203" y2="196" stroke="#9aa3b8" stroke-width="1.5"/><circle cx="203" cy="203" r="5.5" style="fill:var(--lamp)"/></g>`;
function AuthScreen({ onAuth }) {
    const [on, setOn] = useState(false);
    const [color, setColor] = useState(() => localStorage.getItem('fx-lamp') || '#ffab3d');
    const [picked, setPicked] = useState(false);
    const [mode, setMode] = useState(Auth.users().length ? 'in' : 'up');
    const [f, setF] = useState({ user: '', pass: '', pass2: '', remember: true });
    const [showPw, setShowPw] = useState(false);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [shake, setShake] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [legal, setLegal] = useState(null);
    const [accept, setAccept] = useState(false);
    const [forgot, setForgot] = useState(false);
    const [step, setStep] = useState('form');
    const [otpEmail, setOtpEmail] = useState('');
    const [otpKind, setOtpKind] = useState('signup');
    const [recUser, setRecUser] = useState(null);
    const [np, setNp] = useState({ a: '', b: '' });
    const fails = useRef(0);
    const cvs = useRef(null);
    const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(''); };
    const fail = (m) => { setErr(m); setShake(true); setTimeout(() => setShake(false), 450); };
    const go = (m) => { setMode(m); setErr(''); setForgot(false); };
    useEffect(() => {
        if (!on || !cvs.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;
        const c = cvs.current, x = c.getContext('2d');
        let raf, w, h;
        const fit = () => { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight; };
        fit();
        const ps = Array.from({ length: 30 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + .4, vx: (Math.random() - .5) * .22, vy: -Math.random() * .28 - .05, a: Math.random() * .5 + .2 }));
        const tick = () => {
            x.clearRect(0, 0, w, h);
            x.fillStyle = color;
            ps.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.y < -5) {
                p.y = h + 5;
                p.x = Math.random() * w;
            } x.globalAlpha = p.a * .5; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.3); x.fill(); });
            raf = requestAnimationFrame(tick);
        };
        tick();
        window.addEventListener('resize', fit);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
    }, [on, color]);
    const startOtp = (email, kind) => { setOtpEmail(email); setOtpKind(kind); setStep('otp'); setErr(''); setForgot(false); };
    const finish = (u) => {
        localStorage.setItem('fx-lamp', color);
        if (picked) {
            try {
                const k = u.ns + 'journal-theme';
                const cur = JSON.parse(localStorage.getItem(k) || 'null') || DEFAULT_THEME;
                localStorage.setItem(k, JSON.stringify({ ...cur, accent: color }));
            }
            catch (e3) { }
        }
        setLeaving(true);
        setTimeout(() => onAuth(u, f.remember), 600);
    };
    const otpVerify = (code) => Auth.verifyOtp(otpEmail, code, otpKind);
    const otpDone = (u) => { if (otpKind === 'recovery') { setRecUser(u); setStep('newpass'); } else finish(u); };
    const otpResend = () => otpKind === 'recovery' ? Auth.reset(otpEmail) : Auth.resendSignup(otpEmail);
    const saveNewPass = async (e) => {
        e.preventDefault();
        if (busy) return;
        if (np.a !== np.b) return fail('رمز و تکرار آن یکسان نیست');
        setBusy(true);
        try { await Auth.setNewPassword(np.a); finish(recUser); }
        catch (e6) { fail(e6.message); setBusy(false); }
    };
    const submit = async (e) => {
        e.preventDefault();
        if (busy)
            return;
        if (fails.current >= 5)
            return fail('چند تلاش ناموفق؛ ۳۰ ثانیه صبر کن');
        setBusy(true);
        try {
            let u;
            if (mode === 'up') {
                if (f.pass !== f.pass2)
                    throw new Error('رمز و تکرار آن یکسان نیست');
                if (!accept)
                    throw new Error('برای ساخت حساب باید قوانین و حریم خصوصی را بپذیری');
                u = await Auth.signup(f.user, f.pass);
            }
            else
                u = await Auth.login(f.user, f.pass);
            if (u && u.needsOtp) { startOtp(u.email, 'signup'); setBusy(false); return; }
            finish(u);
        }
        catch (e2) {
            if (e2 && e2.needsOtp) {
                try { await Auth.resendSignup(f.user); } catch (e5) { }
                startOtp(f.user.trim(), 'signup');
                setBusy(false);
                return;
            }
            if (mode === 'in') {
                fails.current++;
                if (fails.current >= 5)
                    setTimeout(() => { fails.current = 0; }, 30000);
            }
            fail(e2.message);
            setBusy(false);
        }
    };
    const sendReset = async () => {
        try {
            await Auth.reset(f.user);
            startOtp(f.user.trim(), 'recovery');
        }
        catch (e4) { fail(e4.message); }
    };
    return (React.createElement("div", { className: `lg-root ${on ? 'on' : ''} ${leaving ? 'leaving' : ''}`, style: { '--lamp': color }, dir: "rtl" },
        React.createElement("canvas", { ref: cvs, className: "lg-dust" }),
        React.createElement("div", { className: "lg-glow" }),
        step === 'otp' && React.createElement("div", { className: "otp-bg" }, React.createElement("div", { className: "otp-shape" }), React.createElement("div", { className: "otp-shape" }), React.createElement("div", { className: "otp-shape" })),
        React.createElement("div", { className: "lg-colors" }, LAMP_COLORS.map(([c, n]) => React.createElement("button", { key: c, type: "button", title: n, "aria-label": n, className: `lg-dot ${color === c ? 'sel' : ''}`, style: { background: c }, onClick: () => { setColor(c); setPicked(true); } }))),
        React.createElement("div", { className: "lg-stage" },
            React.createElement("button", { type: "button", className: "lg-lamp", "aria-pressed": on, "aria-label": "\u0631\u0648\u0634\u0646 \u06CC\u0627 \u062E\u0627\u0645\u0648\u0634 \u06A9\u0631\u062F\u0646 \u0686\u0631\u0627\u063A", onClick: () => setOn(v => !v) },
                React.createElement("svg", { viewBox: "0 0 260 320", width: "100%", height: "100%", style: { overflow: 'visible' }, "aria-hidden": "true", dangerouslySetInnerHTML: { __html: LAMP_SVG } })),
            !on && React.createElement("div", { className: "lg-hint" }, "\u0686\u0631\u0627\u063A \u0631\u0627 \u0644\u0645\u0633 \u06A9\u0646"),
            step === 'otp' ? React.createElement(OtpCard, { key: otpEmail + otpKind, email: otpEmail, kind: otpKind, verify: otpVerify, onDone: otpDone, resend: otpResend, onBack: () => { setStep('form'); setErr(''); } }) : React.createElement("div", { className: `au-card ${shake ? 'shake' : ''}`, "aria-hidden": !on },
                React.createElement("div", { className: "au-brand" },
                    React.createElement("span", { className: "au-logo" }, React.createElement(TradyarMark, { size: 34, id: 'au' })),
                    React.createElement("span", { className: "au-wm" }, React.createElement("b", null, "Trad", React.createElement("i", null, "yar")), React.createElement("small", null, "TRADING JOURNAL"))),
                step === 'newpass' ? React.createElement("form", { key: "np", className: "au-panel", onSubmit: saveNewPass, noValidate: true },
                    React.createElement("h2", null, "رمز جدید"),
                    React.createElement("p", { className: "au-sub" }, "ایمیلت تأیید شد؛ حالا یک رمز جدید برای حسابت بنویس."),
                    React.createElement("div", { className: "au-field" },
                        React.createElement("label", { htmlFor: "au-np1" }, "رمز جدید"),
                        React.createElement("div", { className: "au-pw" },
                            React.createElement("input", { id: "au-np1", type: showPw ? 'text' : 'password', value: np.a, onChange: e => { setNp(p => ({ ...p, a: e.target.value })); setErr(''); }, autoComplete: "new-password", placeholder: "حداقل ۶ کاراکتر" }),
                            React.createElement("button", { type: "button", onClick: () => setShowPw(v => !v), "aria-label": "نمایش رمز" }, showPw ? '🙈' : '👁'))),
                    React.createElement("div", { className: "au-field" },
                        React.createElement("label", { htmlFor: "au-np2" }, "تکرار رمز جدید"),
                        React.createElement("input", { id: "au-np2", type: showPw ? 'text' : 'password', value: np.b, onChange: e => { setNp(p => ({ ...p, b: e.target.value })); setErr(''); }, autoComplete: "new-password" })),
                    err && React.createElement("div", { className: "au-err", role: "alert" }, err),
                    React.createElement("button", { className: "au-btn", disabled: busy }, busy ? '…' : 'ذخیره‌ی رمز و ورود'))
                : React.createElement("form", { key: mode, className: "au-panel", onSubmit: submit, noValidate: true },
                    React.createElement("h2", null, mode === 'in' ? 'ورود به ژورنال' : 'ساخت حساب'),
                    React.createElement("p", { className: "au-sub" }, mode === 'in' ? 'خوش برگشتی؛ ادامه‌ی مسیرت همین‌جاست.' : 'در چند ثانیه شروع کن؛ هفت روز اول رایگان است.'),
                    React.createElement("div", { className: "au-field" },
                        React.createElement("label", { htmlFor: "au-u" }, "ایمیل"),
                        React.createElement("input", { id: "au-u", type: "email", dir: "ltr", inputMode: "email", value: f.user, onChange: e => set('user', e.target.value), autoComplete: "username", autoCapitalize: "none", spellCheck: "false", placeholder: "\u0645\u062B\u0644\u0627\u064B masoud_fx" })),
                    React.createElement("div", { className: "au-field" },
                        React.createElement("label", { htmlFor: "au-p" }, "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631"),
                        React.createElement("div", { className: "au-pw" },
                            React.createElement("input", { id: "au-p", type: showPw ? 'text' : 'password', value: f.pass, onChange: e => set('pass', e.target.value), autoComplete: mode === 'in' ? 'current-password' : 'new-password', placeholder: mode === 'up' ? 'حداقل ۶ کاراکتر' : 'رمز عبور' }),
                            React.createElement("button", { type: "button", onClick: () => setShowPw(v => !v), "aria-label": "\u0646\u0645\u0627\u06CC\u0634 \u0631\u0645\u0632" }, showPw ? '🙈' : '👁'))),
                    mode === 'up' && React.createElement("div", { className: "au-field" },
                        React.createElement("label", { htmlFor: "au-p2" }, "\u062A\u06A9\u0631\u0627\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631"),
                        React.createElement("input", { id: "au-p2", type: showPw ? 'text' : 'password', value: f.pass2, onChange: e => set('pass2', e.target.value), autoComplete: "new-password" })),
                    mode === 'up' && React.createElement("label", { className: "au-accept" },
                        React.createElement("input", { type: "checkbox", checked: accept, onChange: e => { setAccept(e.target.checked); setErr(''); } }),
                        React.createElement("span", null, "قوانین استفاده و ",
                            React.createElement("a", { onClick: e => { e.preventDefault(); setLegal('terms'); } }, "حریم خصوصی"),
                            " را خوانده‌ام و می‌پذیرم")),
                    React.createElement("div", { className: "au-opts" },
                        React.createElement("label", { className: "au-check" },
                            React.createElement("input", { type: "checkbox", checked: f.remember, onChange: e => setF(p => ({ ...p, remember: e.target.checked })) }),
                            " \u0645\u0631\u0627 \u062F\u0631 \u0627\u06CC\u0646 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0646\u06AF\u0647 \u062F\u0627\u0631"),
                        mode === 'in' && React.createElement("a", { onClick: () => setForgot(v => !v) }, "\u0631\u0645\u0632 \u0631\u0627 \u0641\u0631\u0627\u0645\u0648\u0634 \u06A9\u0631\u062F\u0645")),
                    forgot && React.createElement("div", { className: "au-forgot" }, "ایمیلت را در کادر بالا بنویس و دکمه را بزن تا یک کد ۶ رقمی برای بازیابی رمز به ایمیلت برسد.", React.createElement("button", { type: "button", onClick: sendReset }, "ارسال کد بازیابی")),
                    err && React.createElement("div", { className: "au-err", role: "alert" }, err),
                    React.createElement("button", { className: "au-btn", disabled: busy }, busy ? '…' : mode === 'in' ? 'ورود' : 'ساخت حساب و ورود'),
                    React.createElement("div", { className: "au-switch" }, mode === 'in' ? React.createElement(React.Fragment, null,
                        "\u062D\u0633\u0627\u0628 \u0646\u062F\u0627\u0631\u06CC\u061F ",
                        React.createElement("a", { onClick: () => go('up') }, "\u0633\u0627\u062E\u062A \u062D\u0633\u0627\u0628")) : React.createElement(React.Fragment, null,
                        "\u0642\u0628\u0644\u0627\u064B \u062D\u0633\u0627\u0628 \u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC\u061F ",
                        React.createElement("a", { onClick: () => go('in') }, "\u0648\u0631\u0648\u062F")))),
                React.createElement("div", { className: "au-note" }, "داده‌هایت امن در حساب ابری ذخیره می‌شود و از هر دستگاه در دسترس است.",
                    React.createElement("br"),
                    React.createElement("a", { style: { cursor: 'pointer', textDecoration: 'underline' }, onClick: () => setLegal('terms') }, "قوانین و حریم خصوصی"),
                    "  ·  ",
                    React.createElement("a", { href: "blog.html", target: "_blank", rel: "noopener", style: { textDecoration: 'underline', color: 'inherit' } }, "وبلاگ")))),
        legal && React.createElement(Modal, { z: 3000, title: "قوانین و حریم خصوصی", onClose: () => setLegal(null) }, React.createElement(LegalBody, { initial: legal }))));
}
function Root() {
    useEffect(() => { window.__fxReady = true; }, []);
    const [user, setUser] = useState(undefined);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                if (!sb) { setUser(null); return; }
                const { data } = await sb.auth.getSession();
                if (data && data.session) {
                    const u = Auth.mk(data.session.user);
                    await Cloud.enter(u);
                    if (alive) setUser(u);
                }
                else if (alive) setUser(null);
            }
            catch (e) { if (alive) setUser(null); }
        })();
        const sub = sb ? sb.auth.onAuthStateChange((ev) => {
            if (ev === 'SIGNED_OUT') { Cloud.leave(); setUser(null); }
            // بازیابی رمز با کد ۶ رقمی داخل صفحه‌ی ورود انجام می‌شود
        }) : null;
        return () => { alive = false; if (sub && sub.data) sub.data.subscription.unsubscribe(); };
    }, []);
    const [splashOn, setSplashOn] = useState(true);
    let page;
    if (user === undefined)
        page = React.createElement(BootScreen, null);
    else if (!user)
        page = React.createElement(AuthScreen, { onAuth: async (u) => { await Cloud.enter(u); setUser(u); } });
    else
        page = React.createElement(TradingJournal, { key: user.id, user: user, onLogout: async () => { await Auth.end(); setUser(null); } });
    return React.createElement(React.Fragment, null,
        React.createElement("div", { id: "app-page" }, page),
        splashOn && React.createElement(Splash, { ready: user !== undefined, onDone: () => setSplashOn(false) }));
}
function Modal({ title, onClose, children, z }) {
    useEffect(() => { const h = e => { if (e.key === 'Escape')
        onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
    return (React.createElement("div", { className: "mm-back", style: z ? { zIndex: z } : undefined, onClick: onClose },
        React.createElement("div", { className: "mm-box", role: "dialog", "aria-label": title, onClick: e => e.stopPropagation() },
            React.createElement("div", { className: "mm-head" },
                React.createElement("h3", null, title),
                React.createElement("button", { type: "button", onClick: onClose, "aria-label": "\u0628\u0633\u062A\u0646" }, "\u2715")),
            children)));
}
function RiskCalc({ balance }) {
    const [bal, setBal] = useState(String(balance || 1000)), [risk, setRisk] = useState('1'), [sl, setSl] = useState('20'), [pv, setPv] = useState('10');
    const n = v => parseFloat(String(v).replace(',', '.')) || 0;
    const usd = n(bal) * n(risk) / 100, lots = n(sl) > 0 && n(pv) > 0 ? usd / (n(sl) * n(pv)) : 0;
    const fld = (l, v, s) => React.createElement("label", { className: "mm-f" },
        l,
        React.createElement("input", { inputMode: "decimal", value: v, onChange: e => s(e.target.value) }));
    return (React.createElement("div", { className: "mm-body" },
        fld('موجودی ($)', bal, setBal),
        fld('ریسک هر معامله (٪)', risk, setRisk),
        fld('حد ضرر (پیپ)', sl, setSl),
        fld('ارزش هر پیپ برای ۱ لات ($)', pv, setPv),
        React.createElement("div", { className: "mm-res" },
            React.createElement("div", null,
                React.createElement("span", null, "\u0631\u06CC\u0633\u06A9 \u062F\u0644\u0627\u0631\u06CC"),
                React.createElement("b", null,
                    usd.toFixed(2),
                    "$")),
            React.createElement("div", null,
                React.createElement("span", null, "\u062D\u062C\u0645 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC"),
                React.createElement("b", null,
                    lots.toFixed(2),
                    " \u0644\u0627\u062A"))),
        React.createElement("p", { className: "mm-hint" }, "\u0628\u0631\u0627\u06CC \u062C\u0641\u062A\u200C\u0627\u0631\u0632\u0647\u0627\u06CC \u0627\u0635\u0644\u06CC \u0628\u0627 \u062F\u0644\u0627\u0631\u060C \u0627\u0631\u0632\u0634 \u0647\u0631 \u067E\u06CC\u067E \u0628\u0631\u0627\u06CC \u06F1 \u0644\u0627\u062A \u062D\u062F\u0648\u062F\u0627\u064B \u06F1\u06F0 \u062F\u0644\u0627\u0631 \u0627\u0633\u062A\u061B \u0628\u0631\u0627\u06CC \u0637\u0644\u0627 \u0648 \u0634\u0627\u062E\u0635\u200C\u0647\u0627 \u0627\u0632 \u0628\u0631\u0648\u06A9\u0631\u062A \u0628\u06AF\u06CC\u0631.")));
}
const WALLET_ADDR = '0xBA671B304212AE8794bAce1F7c42c589D2F71A8F';
// اطلاعات پشتیبانی: فقط همین دو خط را پر کن. خالی بمانند، دکمه‌شان نشان داده نمی‌شود.
const SUPPORT_WA = '989021879076';   // مثال: '989121234567' (با کد کشور، بدون + و صفر)
const SUPPORT_IG = 'masoud_moradi_bm';   // مثال: 'masoudfx' (بدون @)
function subInfo(sub) {
    const now = Date.now();
    const tr = sub && sub.trialEnds ? new Date(sub.trialEnds).getTime() : 0;
    const pd = sub && sub.paidUntil ? new Date(sub.paidUntil).getTime() : 0;
    const end = Math.max(tr, pd);
    const kind = pd > now ? 'paid' : tr > now ? 'trial' : 'none';
    const left = Math.max(0, Math.ceil((end - now) / 864e5));
    const fa = (n) => Number(n).toLocaleString('fa-IR');
    const date = end ? new Date(end).toLocaleDateString('fa-IR') : '';
    return { kind, left, end, fa, date };
}
/* ===== هاب حساب‌ها ===== */
const HUB_COLORS = ['#E8B04B', '#5BB0E8', '#6FCF97', '#A87FD6', '#E26B8B', '#E8895B'];
function NumField({ value, onCommit, min = 0, max, suffix, w = 64 }) {
    const [t, setT] = useState(String(value));
    useEffect(() => { setT(String(value)); }, [value]);
    const commit = () => {
        let v = parseFloat(String(t).replace(',', '.'));
        if (!Number.isFinite(v) || v < min) { setT(String(value)); return; }
        if (max != null && v > max) v = max;
        setT(String(v));
        if (v !== value) onCommit(v);
    };
    return React.createElement('span', { className: 'ah-num' },
        React.createElement('input', { value: t, inputMode: 'decimal', style: { width: w }, onChange: e => setT(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } }),
        suffix && React.createElement('i', null, suffix));
}
function NameField({ value, onCommit }) {
    const [t, setT] = useState(value);
    useEffect(() => { setT(value); }, [value]);
    const commit = () => { const v = t.trim(); if (!v) { setT(value); return; } if (v !== value) onCommit(v); };
    return React.createElement('input', { className: 'ah-name', value: t, onChange: e => setT(e.target.value), onBlur: commit, onKeyDown: e => { if (e.key === 'Enter') e.target.blur(); } });
}
function AccountsHub(P) {
    const h = React.createElement;
    const { C, accounts, trades, activeAccountId, onSwitch, onUpdate, onDelete, onAdd, newName, setNewName, subx, onOpenSub } = P;
    const [open, setOpen] = useState(null);
    const rows = useMemo(() => accounts.map((a, i) => {
        const tr = trades.filter(t => (t.accountId || 'default') === a.id).sort(byDayTime);
        const st = computeStats(tr), init = Number(a.balance) || 0;
        return { a, tr, st, init, eq: init + st.netPnl, ret: init > 0 ? st.netPnl / init * 100 : 0, color: HUB_COLORS[i % HUB_COLORS.length] };
    }), [accounts, trades]);
    const all = rows.reduce((o, r) => ({ init: o.init + r.init, net: o.net + r.st.netPnl, n: o.n + r.st.total, w: o.w + r.st.wins }), { init: 0, net: 0, n: 0, w: 0 });
    const allRet = all.init > 0 ? all.net / all.init * 100 : 0, allWr = all.n ? all.w / all.n * 100 : 0;
    const data = useMemo(() => {
        const dates = Array.from(new Set(rows.flatMap(r => r.tr.map(t => t.date)))).sort();
        if (!dates.length) return [];
        const base = { d: 'شروع', __all: 0 };
        rows.forEach(r => { base[r.a.id] = 0; });
        const out = [base];
        dates.forEach(d => {
            const row = { d: d.slice(5) };
            let sumAll = 0;
            rows.forEach(r => {
                const s = r.tr.filter(t => t.date <= d).reduce((x, t) => x + (Number(t.pnl) || 0), 0);
                sumAll += s;
                row[r.a.id] = r.init > 0 ? +(s / r.init * 100).toFixed(2) : 0;
            });
            row.__all = all.init > 0 ? +(sumAll / all.init * 100).toFixed(2) : 0;
            out.push(row);
        });
        return out;
    }, [rows]);
    const info = subx ? subInfo(subx) : null;
    const subText = !info ? 'در حال بررسی…' : info.kind === 'none' ? 'اشتراکت تمام شده است' : (info.kind === 'paid' ? 'اشتراک فعال' : 'دوره‌ی رایگان') + ' · ' + info.fa(info.left) + ' روز مانده';
    const col = (v) => v >= 0 ? C.positive : C.negative;
    const sg = (v) => v >= 0 ? '+' : '';
    const m = (label, val, color) => h('div', { className: 'ah-m' }, h('small', null, label), h('b', { style: color ? { color } : null }, val));
    const lab = (txt, ctl) => h('label', { className: 'ah-row' }, h('span', null, txt), ctl);
    return h('div', { className: 'mm-body ah' },
        h('div', { className: 'ah-total' },
            h('div', { className: 'ah-total-h' }, '📊 مجموع همه‌ی حساب‌ها'),
            h('div', { className: 'ah-grid' },
                m('موجودی فعلی', `${fmt(all.init + all.net)}$`),
                m('سود/زیان کل', `${sg(all.net)}${fmt(all.net)}$`, col(all.net)),
                m('بازده کل', `${sg(allRet)}${fmt(allRet, 1)}٪`, col(allRet)),
                m('وین‌ریت', `${fmt(allWr)}٪`),
                m('تعداد معامله', fmt(all.n)),
                m('تعداد حساب', fmt(accounts.length)))),
        h('div', { className: 'ah-chart' },
            h('div', { className: 'ah-sec' }, 'رشد درصدی حساب‌ها'),
            data.length < 2
                ? h('div', { className: 'ah-empty' }, 'با ثبت اولین معامله‌ها، نمودار رشد همه‌ی حساب‌ها اینجا کنار هم دیده می‌شود.')
                : h(ResponsiveContainer, { width: '100%', height: 200 },
                    h(LineChart, { data, margin: { top: 6, right: 8, left: -14, bottom: 0 } },
                        h(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                        h(XAxis, { dataKey: 'd', stroke: `${C.text}55`, tick: { fontSize: 10 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                        h(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 10 }, axisLine: false, tickLine: false, tickFormatter: v => v + '%' }),
                        h(Tooltip, { formatter: (v) => v + '%', contentStyle: { background: C.bgCard, border: `1px solid ${C.text}22`, borderRadius: 10, fontSize: 12 }, labelStyle: { color: C.text } }),
                        h(Legend, { wrapperStyle: { fontSize: 11 } }),
                        rows.map(r => h(Line, { key: r.a.id, type: 'monotone', dataKey: r.a.id, name: r.a.name, stroke: r.color, strokeWidth: 2.2, dot: false })),
                        rows.length > 1 && h(Line, { type: 'monotone', dataKey: '__all', name: 'مجموع', stroke: C.text, strokeOpacity: .7, strokeWidth: 1.6, strokeDasharray: '5 4', dot: false })))),
        rows.map(r => {
            const a = r.a, isAct = a.id === activeAccountId, rules = ruleOf(a), p = propOf(a), isOpen = open === a.id;
            const st = isAct || isOpen ? propStatus(a, r.tr, rules) : null;
            return h('div', { key: a.id, className: 'ah-card' + (isAct ? ' act' : ''), style: { '--ac': r.color } },
                h('div', { className: 'ah-card-h' },
                    h('span', { className: 'ah-dot' }),
                    h('b', null, a.name),
                    isAct ? h('span', { className: 'ah-badge' }, 'فعال') : h('button', { type: 'button', className: 'ah-pick', onClick: () => onSwitch(a.id) }, 'انتخاب')),
                h('div', { className: 'ah-grid' },
                    m('موجودی اولیه', `${fmt(r.init)}$`),
                    m('موجودی فعلی', `${fmt(r.eq)}$`),
                    m('بازده', `${sg(r.ret)}${fmt(r.ret, 1)}٪`, col(r.ret)),
                    m('سود/زیان', `${sg(r.st.netPnl)}${fmt(r.st.netPnl)}$`, col(r.st.netPnl)),
                    m('وین‌ریت', `${fmt(r.st.winRate)}٪`),
                    m('معامله', fmt(r.st.total))),
                p.on && st && h(PropAlert, { C, st, rules, compact: true, riskNow: NaN }),
                h('div', { className: 'ah-acts' },
                    h('button', { type: 'button', onClick: () => setOpen(isOpen ? null : a.id) }, isOpen ? '▲ بستن تنظیمات' : '⚙️ تنظیمات و قوانین'),
                    accounts.length > 1 && h('button', { type: 'button', className: 'del', onClick: () => { if (window.confirm('حساب «' + a.name + '» و همه‌ی معامله‌هایش حذف شود؟ این کار برگشت ندارد.')) onDelete(a.id); } }, '🗑 حذف')),
                isOpen && h('div', { className: 'ah-set' },
                    lab('نام حساب', h(NameField, { value: a.name, onCommit: v => onUpdate(a.id, { name: v }) })),
                    lab('موجودی اولیه ($)', h(NumField, { value: Number(a.balance) || 0, w: 96, onCommit: v => onUpdate(a.id, { balance: v }) })),
                    h('div', { className: 'ah-sec' }, 'قوانین پلن'),
                    lab('ریسک هر معامله (حداکثر)', h(NumField, { value: rules.riskPct, suffix: '٪', max: 100, onCommit: v => onUpdate(a.id, { rules: { ...rules, riskPct: v } }) })),
                    lab('حداکثر معامله در روز', h(NumField, { value: rules.maxTrades, min: 1, onCommit: v => onUpdate(a.id, { rules: { ...rules, maxTrades: Math.round(v) } }) })),
                    lab('توقف بعد از ضرر پشت‌سرهم', h(NumField, { value: rules.maxLossStreak, min: 1, onCommit: v => onUpdate(a.id, { rules: { ...rules, maxLossStreak: Math.round(v) } }) })),
                    h('div', { className: 'ah-hint' }, 'شمارش ضرر پشت‌سرهم با تغییر روز صفر می‌شود و معامله‌ی سربه‌سر نه برد حساب می‌شود نه باخت. قانون شکسته جلوی ثبت را نمی‌گیرد؛ فقط هشدار و برچسب می‌گیرد.'),
                    h('div', { className: 'ah-sec' }, 'حساب پراپ'),
                    h('label', { className: 'ah-row' }, h('span', null, 'هشدار زنده‌ی دراودان'), h('input', { type: 'checkbox', checked: !!p.on, onChange: e => onUpdate(a.id, { prop: { ...p, on: e.target.checked } }) })),
                    p.on && h(React.Fragment, null,
                        lab('سقف دراودان کل', h(NumField, { value: p.maxDD, suffix: '٪', max: 100, onCommit: v => onUpdate(a.id, { prop: { ...p, maxDD: v } }) })),
                        lab('سقف ضرر روزانه', h(NumField, { value: p.dailyLoss, suffix: '٪', max: 100, onCommit: v => onUpdate(a.id, { prop: { ...p, dailyLoss: v } }) })),
                        lab('هدف سود', h(NumField, { value: p.target, suffix: '٪', max: 1000, onCommit: v => onUpdate(a.id, { prop: { ...p, target: v } }) })),
                        h('div', { className: 'ah-row' }, h('span', null, 'نوع محاسبه‌ی دراودان'),
                            h('span', { className: 'ah-seg' },
                                h('button', { type: 'button', className: p.ddType !== 'trailing' ? 'on' : '', onClick: () => onUpdate(a.id, { prop: { ...p, ddType: 'static' } }) }, 'ثابت'),
                                h('button', { type: 'button', className: p.ddType === 'trailing' ? 'on' : '', onClick: () => onUpdate(a.id, { prop: { ...p, ddType: 'trailing' } }) }, 'متحرک'))),
                        h('div', { className: 'ah-hint' }, 'درصدها نسبت به موجودی اولیه‌ی حساب‌اند. «ثابت»: دراودان از موجودی اولیه؛ «متحرک»: از بالاترین موجودی ثبت‌شده. فقط معامله‌های بسته‌ی ثبت‌شده دیده می‌شوند.'))));
        }),
        h('div', { className: 'ah-add' },
            h('input', { value: newName, onChange: e => setNewName(e.target.value), placeholder: 'نام حساب جدید' }),
            h('button', { type: 'button', onClick: onAdd }, '+ افزودن حساب')),
        h('div', { className: 'ah-sub' },
            h('div', null, h('b', null, '💳 اشتراک'), h('small', null, subText)),
            h('button', { type: 'button', onClick: onOpenSub }, info && info.kind === 'none' ? 'تمدید' : 'مدیریت')));
}

/* ===== خروجی‌ها: کارت عملکرد (تصویر / PDF) و CSV ===== */
function dlBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
}
function pdfFromJpeg(jpeg, W, H, pw, ph) {
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    push('%PDF-1.4\n');
    const obj = (n, body) => { offs[n] = len; push(n + ' 0 obj\n'); push(body); push('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offs[4] = len;
    push('4 0 obj\n');
    push(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    let x = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
}
function rangeOf(kind, from, to) {
    const today = toLocalISODate(new Date());
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toLocalISODate(d); };
    if (kind === '7') return [ago(6), today];
    if (kind === '30') return [ago(29), today];
    if (kind === '90') return [ago(89), today];
    if (kind === 'month') return [today.slice(0, 8) + '01', today];
    if (kind === 'custom') return [from || '0000-00-00', to || '9999-99-99'];
    return ['0000-00-00', '9999-99-99'];
}
const faDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('fa-IR'); } catch (e) { return d; } };
const EXP_I18N = {
    fa: {
        cols: ['تاریخ', 'ساعت', 'حساب', 'نماد', 'جهت', 'سشن', 'تایم‌فریم', 'استراتژی', 'قیمت ورود', 'حد ضرر', 'تارگت', 'قیمت خروج', 'حجم (لات)', 'نتیجه', 'سود/زیان خالص ($)', 'کمیسیون ($)', 'سواپ ($)', 'ریسک (٪)', 'ریسک به ریوارد', 'طبق پلن بودم؟', 'نمره‌ی قوانین', 'قوانین شکسته‌شده', 'اشتباهات', 'احساس', 'یادداشت'],
        win: 'برد', loss: 'باخت', be: 'سربه‌سر', yes: 'بله', no: 'خیر', buy: 'خرید', sell: 'فروش',
        rules: { risk: 'ریسک بیشتر از پلن', trades: 'معامله‌ی بیشتر از سقف روزانه', streak: 'ادامه بعد از ضررهای پشت‌سرهم' },
    },
    en: {
        cols: ['Date', 'Time', 'Account', 'Symbol', 'Direction', 'Session', 'Timeframe', 'Strategy', 'Entry', 'Stop loss', 'Target', 'Exit', 'Volume (lots)', 'Result', 'Net P/L ($)', 'Commission ($)', 'Swap ($)', 'Risk (%)', 'Risk:Reward', 'Followed plan?', 'Rule score', 'Broken rules', 'Mistakes', 'Emotion', 'Notes'],
        win: 'Win', loss: 'Loss', be: 'Break-even', yes: 'Yes', no: 'No', buy: 'Buy', sell: 'Sell',
        rules: { risk: 'Risk above plan', trades: 'Too many trades in a day', streak: 'Kept trading after a losing streak' },
    },
};
const exportLang = () => (typeof APP_LANG === 'string' && EXP_I18N[APP_LANG]) ? APP_LANG : 'fa';
function jalaliISO(d) {
    try {
        const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(d + 'T12:00:00'));
        const g = (t) => (parts.find(p => p.type === t) || {}).value || '';
        return `${g('year')}/${g('month')}/${g('day')}`;
    } catch (e) { return d; }
}
function buildCsv(list, accounts, lang) {
    const T = EXP_I18N[lang] || EXP_I18N.fa, nm = {};
    accounts.forEach(a => { nm[a.id] = a.name; });
    const dir = (v) => v === 'خرید' ? T.buy : v === 'فروش' ? T.sell : (v || '');
    const cols = [
        t => lang === 'fa' ? jalaliISO(t.date) : t.date, t => t.time, t => nm[t.accountId || 'default'], t => t.symbol, t => dir(t.direction), t => t.session, t => t.timeframe, t => t.strategy,
        t => t.entryPrice, t => t.stopLoss, t => t.target, t => t.exitPrice, t => t.volume, t => T[resultOf(t)] || '', t => t.pnl, t => t.commission, t => t.swap,
        t => t.riskPercent, t => t.rr == null || t.rr === '' ? '' : Number(t.rr).toFixed(2), t => t.followedPlan === 'yes' ? T.yes : t.followedPlan === 'no' ? T.no : '',
        t => t.ruleScore, t => Array.isArray(t.ruleBreaks) ? t.ruleBreaks.map(k => T.rules[k] || k).join(' | ') : '',
        t => Array.isArray(t.mistakes) ? t.mistakes.join(' | ') : '', t => t.emotion, t => t.notes,
    ];
    const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '\ufeff' + [T.cols.map(esc).join(',')].concat(list.map(t => cols.map(f => esc(f(t))).join(','))).join('\r\n');
}
function buildReport(trades, accounts, scope, kind, from, to) {
    const [a, b] = rangeOf(kind, from, to);
    const accs = scope === 'all' ? accounts : accounts.filter(x => x.id === scope);
    const ids = new Set(accs.map(x => x.id));
    const list = trades.filter(t => ids.has(t.accountId || 'default') && t.date >= a && t.date <= b).sort(byDayTime);
    const st = computeStats(list);
    const init = accs.reduce((s, x) => s + (Number(x.balance) || 0), 0);
    let cur = 0, worst = 0, run = 0;
    const curve = [0];
    list.forEach(t => {
        run += Number(t.pnl) || 0; curve.push(run);
        const r = resultOf(t);
        if (r === 'loss') { cur++; worst = Math.max(worst, cur); } else if (r === 'win') cur = 0;
    });
    const known = list.filter(t => t.followedPlan === 'yes' || t.followedPlan === 'no');
    const scored = list.filter(t => typeof t.ruleScore === 'number');
    const plan = known.length ? known.filter(t => t.followedPlan === 'yes').length / known.length * 100 : scored.length ? scored.reduce((s, t) => s + t.ruleScore, 0) / scored.length : null;
    const best = (key) => { const g = groupBy(list.filter(t => t[key]), key); return g.length ? g.slice().sort((x, y) => y.netPnl - x.netPnl)[0] : null; };
    const dates = list.map(t => t.date);
    const label = kind === 'all' ? (dates.length ? `${faDate(dates[0])} تا ${faDate(dates[dates.length - 1])}` : 'کل دوران') : `${faDate(a)} تا ${faDate(b)}`;
    const name = scope === 'all' ? 'همه‌ی حساب‌ها' : (accs[0] ? accs[0].name : '');
    return { list, st, init, curve, worst, plan, label, name, bestSym: best('symbol'), bestSes: best('session'), ret: init > 0 ? st.netPnl / init * 100 : 0, rr: st.avgLoss > 0 ? st.avgWin / st.avgLoss : null };
}
function drawReport(cv, R, C, hide) {
    const W = 1080, H = 1600, ctx = cv.getContext('2d');
    cv.width = W; cv.height = H;
    const FONT = getComputedStyle(document.body).fontFamily || 'Tahoma, sans-serif', MONO = "'IBM Plex Mono', monospace";
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const txt = (s, x, y, size, weight, color, o = {}) => { ctx.direction = o.dir || 'rtl'; ctx.textAlign = o.align || 'right'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${o.mono ? MONO : FONT}`; ctx.fillText(String(s), x, y); ctx.globalAlpha = 1; };
    const fitTxt = (s, x, y, size, weight, color, maxW, o = {}) => { let sz = size; ctx.font = `${weight} ${sz}px ${o.mono ? MONO : FONT}`; while (sz > 20 && ctx.measureText(String(s)).width > maxW) { sz -= 2; ctx.font = `${weight} ${sz}px ${o.mono ? MONO : FONT}`; } txt(s, x, y, sz, weight, color, o); };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * .75, 0, 20, W * .75, 0, 760);
    g.addColorStop(0, C.accent + '40'); g.addColorStop(1, C.accent + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const lg = ctx.createLinearGradient(70, 70, 134.6, 166.9); lg.addColorStop(0, '#3A6EFF'); lg.addColorStop(.5, '#8A5CF6'); lg.addColorStop(1, '#FFAA28');
    rr(70, 70, 84, 84, 19); ctx.fillStyle = lg; ctx.fill();
    [[91.9, 117.5, 10.5, 16.3, '#0E1220'], [106.7, 106.2, 10.5, 27.6, '#0E1220'], [121.6, 92.7, 10.5, 41.1, '#FFFFFF']].forEach(([x, y, w, h, c]) => { rr(x, y, w, h, 3.5); ctx.fillStyle = c; ctx.fill(); });
    ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 48px Poppins, Inter, sans-serif`;
    ctx.fillStyle = C.text; ctx.fillText('Trad', 176, 112);
    const trw = ctx.measureText('Trad').width; ctx.fillStyle = '#FFAA28'; ctx.fillText('yar', 176 + trw, 112);
    txt('TRADING JOURNAL', 178, 146, 20, 500, C.text, { dir: 'ltr', align: 'left', mono: true, alpha: .55 });
    txt('گزارش عملکرد', 1010, 112, 44, 800, C.text);
    txt(`${R.name} · ${R.label}`, 1010, 156, 26, 500, C.text, { alpha: .65 });
    rr(70, 220, 940, 290, 36); ctx.fillStyle = C.bgCard || C.bg; ctx.fill(); ctx.strokeStyle = C.text + '1f'; ctx.lineWidth = 2; ctx.stroke();
    const net = R.st.netPnl, col = net >= 0 ? C.positive : C.negative, sg = net >= 0 ? '+' : '';
    if (!hide) {
        const bal = `${fmt(R.init + net)}$`;
        ctx.font = `600 24px ${MONO}`;
        const bw = ctx.measureText(bal).width;
        txt(bal, 102, 268, 24, 600, C.text, { dir: 'ltr', align: 'left', mono: true, alpha: .8 });
        txt('بالانس', 102 + bw + 12, 268, 22, 500, C.text, { dir: 'rtl', align: 'left', alpha: .55 });
    }
    txt(hide ? 'بازده کل' : 'سود/زیان خالص', 540, 300, 30, 600, C.text, { align: 'center', alpha: .65 });
    txt(hide ? `${sg}${fmt(R.ret, 1)}٪` : `${sg}${fmt(net)}$`, 540, 414, 124, 800, col, { dir: 'ltr', align: 'center', mono: true });
    txt(hide ? `${fmt(R.st.total)} معامله` : `${fmt(R.st.total)} معامله · بازده ${sg}${fmt(R.ret, 1)}٪`, 540, 478, 28, 500, C.text, { align: 'center', alpha: .6 });
    const pf = R.st.profitFactor === Infinity ? '∞' : fmt(R.st.profitFactor, 2);
    const bestSub = (x) => x ? (hide ? `وین‌ریت ${fmt(x.winRate)}٪` : `${x.netPnl >= 0 ? '+' : ''}${fmt(x.netPnl)}$`) : '';
    const cells = [
        ['وین‌ریت', `${fmt(R.st.winRate)}٪`], ['پروفیت فکتور', pf],
        ['ریسک به ریوارد', R.rr == null ? '—' : `1:${fmt(R.rr, 2)}`], ['تعداد معاملات', fmt(R.st.total)],
        ['بهترین نماد', R.bestSym ? R.bestSym.name : '—', bestSub(R.bestSym)], ['بهترین سشن', R.bestSes ? R.bestSes.name : '—', bestSub(R.bestSes)],
        ['حداکثر دراودان', hide ? `${fmt(R.init > 0 ? R.st.maxDD / R.init * 100 : 0, 1)}٪` : `${fmt(R.st.maxDD)}$`], ['بدترین باخت پیاپی', fmt(R.worst)],
        ['پایبندی به پلن', R.plan == null ? '—' : `${fmt(R.plan)}٪`], ['برد / باخت', `${fmt(R.st.wins)} / ${fmt(R.st.losses)}`],
    ];
    cells.forEach(([label, val, sub], i) => {
        const row = Math.floor(i / 2), colI = i % 2, x = colI === 0 ? 540 : 70, y = 545 + row * 148;
        rr(x, y, 470, 128, 26); ctx.fillStyle = C.text + '0d'; ctx.fill();
        txt(label, x + 446, y + 46, 26, 600, C.text, { alpha: .65 });
        if (sub) txt(sub, x + 24, y + 46, 22, 600, sub.startsWith('-') ? C.negative : C.text, { dir: 'ltr', align: 'left', mono: true, alpha: .8 });
        const latin = /^[\x00-\x7F]*$/.test(String(val));
        fitTxt(val, x + 446, y + 104, 46, 800, C.text, 410, { dir: latin ? 'ltr' : 'rtl', align: 'right', mono: latin });
    });
    const cx = 70, cy = 545 + 5 * 148 + 4, cw = 940, ch = 230, pts = R.curve;
    rr(cx, cy, cw, ch, 26); ctx.fillStyle = C.text + '0a'; ctx.fill();
    if (pts.length > 1) {
        const mn = Math.min(0, ...pts), mx = Math.max(0, ...pts), sp = (mx - mn) || 1;
        const X = (i) => cx + 28 + (cw - 56) * i / (pts.length - 1), Y = (v) => cy + ch - 24 - (ch - 48) * (v - mn) / sp;
        ctx.beginPath(); pts.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
        ctx.lineTo(X(pts.length - 1), cy + ch - 14); ctx.lineTo(X(0), cy + ch - 14); ctx.closePath();
        const fg = ctx.createLinearGradient(0, cy, 0, cy + ch); fg.addColorStop(0, col + '55'); fg.addColorStop(1, col + '00'); ctx.fillStyle = fg; ctx.fill();
        ctx.beginPath(); pts.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
    }
    else txt('منحنی رشد با ثبت معامله‌ها اینجا ساخته می‌شود', 540, cy + 122, 24, 500, C.text, { align: 'center', alpha: .5 });
    txt(`تهیه‌شده با Tradyar · ${new Date().toLocaleDateString('fa-IR')}`, 540, H - 36, 22, 500, C.text, { align: 'center', alpha: .45 });
}
function ExportHub({ C, accounts, trades, activeAccountId, onToast }) {
    const h = React.createElement;
    const [scope, setScope] = useState(activeAccountId), [kind, setKind] = useState('all');
    const [from, setFrom] = useState(''), [to, setTo] = useState(''), [hide, setHide] = useState(false);
    const cv = useRef(null);
    const R = useMemo(() => buildReport(trades, accounts, scope, kind, from, to), [trades, accounts, scope, kind, from, to]);
    useEffect(() => {
        let dead = false;
        const go = () => { if (!dead && cv.current) drawReport(cv.current, R, C, hide); };
        if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('700 48px Poppins'), document.fonts.ready]).then(go, go); else go();
        return () => { dead = true; };
    }, [R, C, hide]);
    const fname = (ext) => `tradyar-${kind === 'all' ? 'all' : kind}-${toLocalISODate(new Date())}.${ext}`;
    const toBlob = (type, q) => new Promise(res => cv.current.toBlob(res, type, q));
    const savePng = async () => { const b = await toBlob('image/png'); if (b) { dlBlob(b, fname('png')); onToast('تصویر کارت ذخیره شد ✅', 'good'); } };
    const savePdf = async () => {
        const b = await toBlob('image/jpeg', 0.93);
        if (!b) return;
        const W = cv.current.width, H = cv.current.height;
        dlBlob(pdfFromJpeg(new Uint8Array(await b.arrayBuffer()), W, H, W / 2, H / 2), fname('pdf'));
        onToast('فایل PDF ذخیره شد ✅', 'good');
    };
    const canShare = typeof navigator !== 'undefined' && navigator.share && navigator.canShare;
    const share = async () => {
        const b = await toBlob('image/png');
        if (!b) return;
        const f = new File([b], fname('png'), { type: 'image/png' });
        try { if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'گزارش عملکرد' }); else dlBlob(b, fname('png')); }
        catch (e) { }
    };
    const saveCsv = () => {
        if (!R.list.length) return onToast('معامله‌ای در این بازه نیست', 'bad');
        dlBlob(new Blob([buildCsv(R.list, accounts, exportLang())], { type: 'text/csv;charset=utf-8' }), fname('csv'));
        onToast(`CSV با ${fmt(R.list.length)} معامله ذخیره شد ✅`, 'good');
    };
    const chips = [['all', 'همه'], ['7', '۷ روز'], ['30', '۳۰ روز'], ['90', '۹۰ روز'], ['month', 'این ماه'], ['custom', 'دلخواه']];
    const empty = R.list.length === 0;
    return h('div', { className: 'mm-body ex' },
        h('label', { className: 'ex-f' }, 'حساب',
            h('select', { value: scope, onChange: e => setScope(e.target.value) }, h('option', { value: 'all' }, 'همه‌ی حساب‌ها'), accounts.map(a => h('option', { key: a.id, value: a.id }, a.name)))),
        h('div', { className: 'ex-f' }, 'بازه‌ی زمانی',
            h('div', { className: 'ex-chips' }, chips.map(([k, l]) => h('button', { key: k, type: 'button', className: kind === k ? 'on' : '', onClick: () => setKind(k) }, l)))),
        kind === 'custom' && h('div', { className: 'ex-dates' },
            h('label', { className: 'ex-f' }, 'از', h('input', { type: 'date', value: from, onChange: e => setFrom(e.target.value) })),
            h('label', { className: 'ex-f' }, 'تا', h('input', { type: 'date', value: to, onChange: e => setTo(e.target.value) }))),
        h('label', { className: 'ex-check' }, h('input', { type: 'checkbox', checked: hide, onChange: e => setHide(e.target.checked) }), 'فقط درصد نشان بده (بدون مبلغ دلاری و بالانس)'),
        h('canvas', { ref: cv, className: 'ex-cv' }),
        h('div', { className: 'ah-hint' }, empty ? 'در این حساب و بازه معامله‌ای نیست؛ حساب یا بازه را عوض کن.' : `${fmt(R.list.length)} معامله در این بازه · کارت بالا همان چیزی است که ذخیره می‌شود.`),
        h('div', { className: 'ex-btns' },
            h('button', { type: 'button', disabled: empty, onClick: savePng }, '🖼 تصویر کارت'),
            h('button', { type: 'button', disabled: empty, onClick: savePdf }, '📄 PDF'),
            canShare && h('button', { type: 'button', disabled: empty, onClick: share }, '📤 اشتراک‌گذاری'),
            h('button', { type: 'button', disabled: empty, onClick: saveCsv }, '📊 CSV تاریخچه')),
        h('div', { className: 'ah-hint' }, 'CSV یک فایل جداست و خودکار وارد Google Sheets نمی‌شود: در Google Sheets از «File ← Import ← Upload» همین فایل را انتخاب کن. بک‌آپ کامل (برای انتقال یا بازیابی) از «دریافت بک‌آپ» در منو است.'));
}
/* ===== برند Tradyar: آیکون، اسپلش ===== */
function TradyarMark({ size = 40, id = 'tm' }) {
    const h = React.createElement, gid = 'tmg-' + id;
    return h('svg', { width: size, height: size, viewBox: '0 0 1024 1024', 'aria-hidden': 'true', style: { display: 'block', flexShrink: 0 } },
        h('defs', null, h('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 787, y2: 1181 },
            h('stop', { offset: 0, stopColor: '#3A6EFF' }), h('stop', { offset: .5, stopColor: '#8A5CF6' }), h('stop', { offset: 1, stopColor: '#FFAA28' }))),
        h('rect', { width: 1024, height: 1024, rx: 230, fill: `url(#${gid})` }),
        h('rect', { className: 'tm-b tm-b1', x: 267, y: 579, width: 128, height: 199, rx: 43, fill: '#0E1220' }),
        h('rect', { className: 'tm-b tm-b2', x: 448, y: 441, width: 128, height: 337, rx: 43, fill: '#0E1220' }),
        h('rect', { className: 'tm-b tm-b3', x: 629, y: 277, width: 128, height: 501, rx: 43, fill: '#FFFFFF' }));
}
function Splash({ ready, onDone }) {
    const h = React.createElement;
    const rootR = useRef(null), iconR = useRef(null), wordR = useRef(null);
    const [minDone, setMinDone] = useState(false);
    const ran = useRef(false), done = useRef(false);
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => { if (done.current) return; done.current = true; onDone(); };
    // فقط transform و opacity انیمیشن می‌شوند (بدون فیلتر و سایه‌ی سنگین) تا روی گوشی‌های ضعیف هم نرم باشد
    useEffect(() => {
        const i = iconR.current, w = wordR.current;
        if (!reduce && i && w && i.animate && w.animate) {
            const soft = 'cubic-bezier(.22,1,.36,1)';
            i.animate([{ transform: 'translateY(10px) scale(.88)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 750, easing: soft, fill: 'both' });
            i.querySelectorAll('.tm-b').forEach((bar, k) => {
                bar.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 560, delay: 280 + k * 130, easing: soft, fill: 'both' });
            });
            w.animate([{ transform: 'translateX(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 420, easing: soft, fill: 'both' });
        }
        const t1 = setTimeout(() => setMinDone(true), reduce ? 150 : 1500);
        const t2 = setTimeout(finish, 7000); // شبکه‌ی خیلی کند: اسپلش گیر نکند
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);
    useEffect(() => {
        if (!(ready && minDone) || ran.current) return;
        ran.current = true;
        const i = iconR.current, w = wordR.current, r = rootR.current;
        if (reduce || !i || !w || !r || !i.animate) { finish(); return; }
        const run = async () => {
            const ir = i.getBoundingClientRect(), wr = w.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            const dx = vw / 2 - (ir.left + ir.width / 2);
            const wx = vw / 2 - wr.left;
            const S = Math.min(12, Math.max(vw, vh) / ir.width * 1.1);   // حدود ۱۰ برابر (قبلاً ~۲۰ برابر)
            const glide = 'cubic-bezier(.65,0,.25,1)';
            const T = (el, kf, o) => el.animate(kf, Object.assign({ fill: 'forwards' }, o));
            // ۱) نوشته جمع می‌شود و آیکون نرم به مرکز می‌آید
            T(w, [{ transform: 'translateX(0) scaleX(1)', opacity: 1 }, { transform: `translateX(${wx}px) scaleX(.1)`, opacity: 0 }], { duration: 720, easing: glide });
            await T(i, [{ transform: 'translateX(0) scale(1)' }, { transform: `translateX(${dx}px) scale(1)` }], { duration: 720, easing: glide }).finished;
            // ۲) پس‌کشیدن کوتاه، مثل گرفتن نفس قبل از پرش
            await T(i, [{ transform: `translateX(${dx}px) scale(1)` }, { transform: `translateX(${dx}px) scale(.93)` }], { duration: 230, easing: 'cubic-bezier(.33,0,.2,1)' }).finished;
            // ۳) زوم نرم و محو شدن؛ همزمان ژورنال بالا می‌آید
            const zoom = T(i, [
                { transform: `translateX(${dx}px) scale(.93)`, opacity: 1 },
                { transform: `translateX(${dx}px) scale(${S})`, opacity: 1, offset: .72 },
                { transform: `translateX(${dx}px) scale(${S * 1.06})`, opacity: 0 }
            ], { duration: 800, easing: 'cubic-bezier(.55,0,.3,1)' });
            T(r, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }], { duration: 800, easing: 'ease-in' });
            const page = document.getElementById('app-page');
            if (page && page.animate) page.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 850, delay: 320, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
            await zoom.finished;
            finish();
        };
        run().catch(finish);
    }, [ready, minDone]);
    return h('div', { className: 'sp-root', ref: rootR, onClick: () => setMinDone(true) },
        h('div', { className: 'sp-stage' },
            h('div', { className: 'sp-icon', ref: iconR }, h(TradyarMark, { size: 92, id: 'sp' })),
            h('div', { className: 'sp-word', ref: wordR }, h('b', null, 'Trad', h('i', null, 'yar')), h('small', null, 'TRADING JOURNAL'))));
}

function BootScreen() {
    const h = React.createElement;
    return h('div', { className: 'bt-root' },
        h('div', { className: 'bt-top' }, h('b', null, 'Trad', h('i', null, 'yar')), h('small', null, 'TRADING JOURNAL')),
        h('div', { className: 'bt-mid' },
            h('div', { className: 'bt-icon' }, h(TradyarMark, { size: 104, id: 'bt' })),
            h('div', { className: 'bt-txt' }, 'در حال بارگذاری…')));
}
function SupportLinks() {
    const h = React.createElement;
    if (!SUPPORT_WA && !SUPPORT_IG) return null;
    return h('div', { className: 'sb-contacts' },
                SUPPORT_WA && h('a', { className: 'sb-contact wa', href: 'https://wa.me/' + SUPPORT_WA, target: '_blank', rel: 'noopener' },
                    h('span', { className: 'sb-ico' }, h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' },
                        h('path', { d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' }),
                        h('path', { transform: 'translate(6.4 6.3) scale(.45)', strokeWidth: 3.6, d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' }))),
                    h('span', { className: 'sb-ct' }, h('b', null, 'واتساپ'), h('small', null, 'فقط پیام'))),
                SUPPORT_IG && h('a', { className: 'sb-contact ig', href: 'https://instagram.com/' + SUPPORT_IG, target: '_blank', rel: 'noopener' },
                    h('span', { className: 'sb-ico' }, h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2 },
                        h('rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 5 }),
                        h('circle', { cx: 12, cy: 12, r: 4 }),
                        h('circle', { cx: 17.3, cy: 6.7, r: 1.1, fill: '#fff', stroke: 'none' }))),
                    h('span', { className: 'sb-ct' }, h('b', null, 'اینستاگرام'), h('small', null, '@' + SUPPORT_IG))));
}

function SubBody({ sub, onPaid, onLegal }) {
    const h = React.createElement;
    const [tx, setTx] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [copied, setCopied] = useState(false);
    const info = sub ? subInfo(sub) : null;
    const total = info && info.kind === 'paid' ? 30 : 7;
    const pct = info ? Math.min(100, Math.round(info.left / total * 100)) : 0;
    const title = !info ? 'در حال بررسی…' : info.kind === 'paid' ? 'اشتراک فعال' : info.kind === 'trial' ? 'دوره‌ی رایگان' : 'اشتراک تمام شده';
    const copy = () => { try { navigator.clipboard.writeText(WALLET_ADDR).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); } catch (e) { } };
    const verify = async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true); setMsg(null);
        try {
            if (!sb) throw new Error('اتصال به سرور برقرار نشد؛ صفحه را دوباره باز کن');
            if (!/^0x[0-9a-fA-F]{64}$/.test(tx.trim())) throw new Error('کد تراکنش درست نیست؛ باید با 0x شروع شود و ۶۶ کاراکتر باشد (کل کد را کپی کن)');
            const { data, error } = await sb.functions.invoke('smooth-endpoint', { body: { txid: tx.trim() } });
            if (error) {
                let real = '';
                try { if (error.context && typeof error.context.json === 'function') { const j = await error.context.json(); real = (j && (j.msg || j.error || j.message)) || ''; } }
                catch (e2) { }
                throw new Error(real || 'ارتباط با سرور برقرار نشد (' + String(error.message || error.name || '').slice(0, 70) + ')');
            }
            if (!data || !data.ok) throw new Error((data && data.msg) || 'تأیید نشد');
            setMsg({ ok: true, t: 'پرداخت تأیید شد ✅ اشتراک تا ' + new Date(data.paid_until).toLocaleDateString('fa-IR') + ' فعال است' });
            setTx('');
            try { Cloud.retry(); } catch (e3) { }
            if (onPaid) onPaid();
        }
        catch (x) { setMsg({ ok: false, t: x.message }); }
        setBusy(false);
    };
    return h('div', { className: 'mm-body' },
        h('div', { className: 'sb-hero' },
            h('small', null, title),
            h('b', null, info && info.kind !== 'none' ? info.fa(info.left) + ' روز مانده' : '—'),
            h('small', null, info && info.kind !== 'none' ? 'تا ' + info.date : 'برای ادامه، اشتراک تهیه کن'),
            h('div', { className: 'sb-bar' }, h('i', { style: { width: pct + '%' } }))),
        h('div', { className: 'sb-price' }, h('span', null, 'اشتراک ماهانه · USDT (شبکه BEP-20)'), h('b', null, '۵ دلار')),
        h('div', { className: 'sb-step' }, h('span', null, '1'), h('div', null, 'از کیف پول یا صرافی، ', h('b', null, 'دقیقاً روی شبکه BEP-20 (BNB Smart Chain)'), ' حداقل ۵ تتر (USDT) به این آدرس بفرست:',
            h('div', { className: 'sb-wallet' }, WALLET_ADDR),
            h('button', { type: 'button', className: 'sb-copy', onClick: copy }, copied ? '✓ کپی شد' : 'کپی آدرس'))),
        h('div', { className: 'sb-step' }, h('span', null, '2'), h('div', null, 'بعد از واریز، کد تراکنش (TXID) را از کیف پول یا صرافی کپی کن و ', h('b', null, 'تا ۲ ساعت بعد از واریز'), ' در مرحله‌ی بعد بچسبان.')),
        msg && h('div', { className: 'sb-msg ' + (msg.ok ? 'ok' : 'bad') }, msg.t),
        h('form', { className: 'sb-step', onSubmit: verify, style: { flexWrap: 'wrap' } }, h('span', null, '3'),
            h('div', { style: { flex: 1, minWidth: 0 } }, 'کد تراکنش را اینجا بچسبان:',
                h('input', { value: tx, onChange: e => { setTx(e.target.value); setMsg(null); }, placeholder: '0x…', dir: 'ltr', style: { width: '100%', marginTop: 6, textAlign: 'left' }, autoComplete: 'off', spellCheck: 'false' }),
                h('button', { className: 'mm-btn', style: { marginTop: 8, width: '100%' }, disabled: busy || tx.trim().length < 60 }, busy ? 'در حال بررسی شبکه…' : 'تأیید پرداخت'))),
        h('div', { className: 'sb-warn' }, '⚠️ فقط شبکه‌ی BEP-20. ارسال از شبکه‌ی دیگر (مثل TRC-20 یا ERC-20) قابل بازگشت نیست. کارمزد انتقال را جدا حساب کن تا مبلغ دریافتی حداقل ۵ تتر باشد. تأیید شبکه ۱ تا ۲ دقیقه طول می‌کشد.'),
        (SUPPORT_WA || SUPPORT_IG) && h('div', { className: 'sb-support' },
            h('div', { className: 'sb-support-t' }, 'واریز کردی ولی تأیید نشد؟'),
            h('div', { className: 'sb-support-s' }, 'اگر تأیید خودکار انجام نشد یا بیشتر از ۲ ساعت گذشته، کد تراکنش را برای پشتیبانی بفرست؛ بعد از بررسی، اشتراکت دستی فعال می‌شود.'),
            h(SupportLinks, null)),
        onLegal && h('div', { style: { textAlign: 'center' } }, h('button', { type: 'button', className: 'lg-link', onClick: onLegal }, 'قوانین و سیاست بازپرداخت')));
}
function ChangePass({ user, onDone }) {
    const [o, setO] = useState(''), [p, setP] = useState(''), [p2, setP2] = useState(''), [err, setErr] = useState('');
    const go = async (e) => { e.preventDefault(); if (p !== p2)
        return setErr('رمز جدید و تکرار آن یکسان نیست'); try {
        await Auth.changePassword(user.email, o, p);
        onDone();
    }
    catch (x) {
        setErr(x.message);
    } };
    return (React.createElement("form", { className: "mm-body", onSubmit: go },
        React.createElement("label", { className: "mm-f" },
            "\u0631\u0645\u0632 \u0641\u0639\u0644\u06CC",
            React.createElement("input", { type: "password", value: o, onChange: e => { setO(e.target.value); setErr(''); }, autoComplete: "current-password" })),
        React.createElement("label", { className: "mm-f" },
            "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F",
            React.createElement("input", { type: "password", value: p, onChange: e => { setP(e.target.value); setErr(''); }, autoComplete: "new-password" })),
        React.createElement("label", { className: "mm-f" },
            "\u062A\u06A9\u0631\u0627\u0631 \u0631\u0645\u0632 \u062C\u062F\u06CC\u062F",
            React.createElement("input", { type: "password", value: p2, onChange: e => { setP2(e.target.value); setErr(''); }, autoComplete: "new-password" })),
        err && React.createElement("div", { className: "au-err" }, err),
        React.createElement("button", { className: "mm-btn" }, "\u0630\u062E\u06CC\u0631\u0647\u200C\u06CC \u0631\u0645\u0632 \u062C\u062F\u06CC\u062F")));
}
const LEGAL_DATE = 'آخرین به‌روزرسانی: آبان ۱۴۰۵';
const LEGAL_TERMS = [
    ['۱. درباره‌ی Tradyar', ['Tradyar یک ژورنال معاملاتی آنلاین است که به تو کمک می‌کند معاملاتت را ثبت، تحلیل و مرور کنی. استفاده از سایت یعنی این قوانین را خوانده‌ای و می‌پذیری.']],
    ['۲. این سایت مشاوره‌ی مالی نیست', ['Tradyar سیگنال، توصیه‌ی سرمایه‌گذاری یا مشاوره‌ی مالی نمی‌دهد و کارگزار هم نیست. آمار، نمره‌ها و گزارش‌ها فقط بر پایه‌ی اطلاعاتی است که خودت وارد می‌کنی. هر تصمیم معاملاتی و هر سود یا زیانی که از آن می‌آید فقط با خودت است. بازارهای مالی ریسک بالا دارند و ممکن است همه‌ی سرمایه‌ات را از دست بدهی.']],
    ['۳. حساب کاربری', ['برای استفاده باید با ایمیل خودت حساب بسازی و ایمیل را با کد ۶ رقمی تأیید کنی. نگه‌داری رمز عبور با خودت است و هر کاری که با حسابت انجام شود به عهده‌ی توست. اگر فکر می‌کنی کسی به حسابت دسترسی پیدا کرده، رمزت را عوض کن و به پشتیبانی خبر بده.']],
    ['۴. اشتراک و پرداخت', [
        'هفت روز اول بعد از ساخت حساب رایگان است. بعد از آن، اشتراک ۳۰ روزه ۵ دلار است و با USDT روی شبکه‌ی BEP-20 پرداخت می‌شود.',
        'بعد از واریز، کد تراکنش (TXID) را در بخش «اشتراک و پرداخت» وارد می‌کنی تا بررسی و اشتراکت فعال شود. ارسال از شبکه‌ی دیگر یا به آدرس اشتباه قابل پیگیری و بازگشت نیست.',
        'وقتی اشتراک تمام شود، اطلاعاتت پاک نمی‌شود و همچنان می‌توانی ببینی و دریافتشان کنی؛ فقط ثبت یا ویرایش معامله‌ی جدید تا تمدید قفل است.']],
    ['۵. سیاست بازپرداخت', [
        'چون هفت روز اول رایگان است و می‌توانی قبل از پرداخت همه‌ی امکانات را امتحان کنی، پرداخت‌ها در حالت عادی بازگشت ندارند.',
        'فقط در این دو حالت مبلغ برمی‌گردد:',
        ['یک پرداخت بیشتر از یک‌بار از تو کسر شده باشد.', 'پرداخت تأیید شده باشد ولی اشتراک به دلیل مشکل فنی فعال نشود و رفع نشود.'],
        'در این حالت‌ها کد تراکنش را برای پشتیبانی بفرست. اول تلاش می‌کنیم مشکل را حل کنیم و اگر نشد، مبلغ به کیف پول خودت برمی‌گردد. کارمزد شبکه ممکن است از مبلغ برگشتی کم شود.']],
    ['۶. استفاده‌ی درست', ['حق نداری حساب را به دیگران بفروشی یا اشتراک یک حساب را بین چند نفر تقسیم کنی، به سامانه نفوذ یا فشار بیاوری، یا از سایت برای کار غیرقانونی استفاده کنی. در صورت تخلف ممکن است دسترسی حساب محدود یا بسته شود.']],
    ['۷. داده‌ها و پشتیبان‌گیری', ['اطلاعات ژورنالت روی حساب ابری ذخیره می‌شود و با همان ایمیل از هر دستگاه در دسترس است. با این حال هیچ سرویسی صددرصد بی‌خطا نیست. پیشنهاد می‌کنیم گاهی از منوی سایت «دریافت بک‌آپ» را بزنی و یک نسخه پیش خودت نگه داری.']],
    ['۸. در دسترس بودن و مسئولیت', ['تلاش می‌کنیم سایت پایدار باشد، اما قول قطع‌نشدن یا بی‌خطا بودن کامل را نمی‌دهیم. سایت «همان‌طور که هست» ارائه می‌شود و مسئولیتی در برابر زیان معاملاتی یا خسارت ناشی از قطعی، خطا یا از دست رفتن داده نداریم، مگر آنچه قانون اجازه نمی‌دهد از آن سلب مسئولیت شود.']],
    ['۹. تغییر قوانین', ['ممکن است این قوانین را به‌روز کنیم. نسخه‌ی جدید همین‌جا منتشر می‌شود و ادامه‌ی استفاده از سایت یعنی آن را پذیرفته‌ای.']],
    ['۱۰. ارتباط با ما', ['برای پشتیبانی، پیگیری پرداخت یا هر سؤالی، از راه واتساپ یا اینستاگرام که پایین صفحه‌ی «اشتراک و پرداخت» آمده با ما در تماس باش.']]
];
const LEGAL_PRIVACY = [
    ['۱. چه اطلاعاتی نگه می‌داریم', [
        'فقط چیزهایی که برای کار کردن ژورنال لازم است:',
        ['ایمیل و نام کاربری', 'رمز عبور (به‌صورت رمزنگاری‌شده؛ ما متن رمزت را نمی‌بینیم)', 'اطلاعات ژورنالت: حساب‌ها، معاملات، یادداشت‌ها و تنظیمات ظاهر', 'وضعیت اشتراک و کد تراکنش‌هایی که برای پرداخت وارد می‌کنی']]],
    ['۲. چرا و کجا نگه می‌داریم', ['این اطلاعات فقط برای ورود به حساب، نمایش ژورنال، فعال‌سازی اشتراک و پشتیبانی استفاده می‌شود. داده‌ها روی سرویس ابری Supabase ذخیره می‌شوند و دسترسی هر کاربر به ردیف‌های خودش محدود است. مدیر سایت برای فعال‌سازی اشتراک و پیگیری پشتیبانی به اطلاعات اشتراک و پرداخت دسترسی دارد.']],
    ['۳. فروش و اشتراک‌گذاری', ['اطلاعاتت را نمی‌فروشیم و برای تبلیغ در اختیار کسی نمی‌گذاریم. سایت ابزار تبلیغاتی یا ردیابی رفتار ندارد.']],
    ['۴. سرویس‌های بیرونی', [
        'برای کارکرد سایت از چند سرویس بیرونی استفاده می‌شود:',
        ['Supabase برای ورود و ذخیره‌ی داده', 'سرویس ایمیل برای فرستادن کد تأیید و بازیابی رمز', 'Google Fonts و CDN‌های cdnjs و jsDelivr برای بارگذاری فونت و کتابخانه‌ها؛ این سرویس‌ها هنگام باز شدن صفحه آدرس IP تو را می‌بینند'],
        'پرداخت‌ها روی بلاک‌چین انجام می‌شود و کد تراکنش و آدرس‌ها ذاتاً عمومی‌اند.']],
    ['۵. ذخیره روی مرورگر', ['برای ماندن در حساب و یادآوری ظاهر و تنظیمات، مقدارهایی روی مرورگر خودت ذخیره می‌شود. با خروج از حساب یا پاک کردن اطلاعات مرورگر این مقدارها حذف می‌شوند، ولی داده‌ی ژورنالت روی حساب ابری می‌ماند.']],
    ['۶. کنترل تو روی اطلاعات', ['هر زمان می‌توانی از منو بک‌آپ کامل داده‌هایت را بگیری، معاملات یک حساب را پاک کنی یا رمزت را عوض کنی. اگر خواستی حسابت و همه‌ی اطلاعاتش کامل حذف شود، از راه پشتیبانی درخواست بده و بعد از تأیید هویت انجام می‌شود.']],
    ['۷. امنیت', ['از ارتباط رمزنگاری‌شده (HTTPS) و قفل دسترسی در پایگاه داده استفاده می‌کنیم. با این حال امنیت صددرصد وجود ندارد؛ رمز قوی و یکتا انتخاب کن و آن را با کسی در میان نگذار.']],
    ['۸. تغییرات', ['اگر این سیاست عوض شود، نسخه‌ی جدید همین‌جا منتشر می‌شود.']]
];
function LegalBody({ initial }) {
    const h = React.createElement;
    const [tab, setTab] = useState(initial === 'privacy' ? 'privacy' : 'terms');
    const data = tab === 'terms' ? LEGAL_TERMS : LEGAL_PRIVACY;
    return h('div', { className: 'mm-body lg-legal' },
        h('div', { className: 'lg-tabs', role: 'tablist' },
            h('button', { type: 'button', role: 'tab', className: tab === 'terms' ? 'on' : '', onClick: () => setTab('terms') }, 'قوانین استفاده'),
            h('button', { type: 'button', role: 'tab', className: tab === 'privacy' ? 'on' : '', onClick: () => setTab('privacy') }, 'حریم خصوصی')),
        h('div', { className: 'lg-date' }, LEGAL_DATE),
        data.map(([title, parts], k) => h('div', { className: 'lg-sec', key: tab + k },
            h('h4', null, title),
            parts.map((x, j) => Array.isArray(x)
                ? h('ul', { key: j }, x.map((li, q) => h('li', { key: q }, li)))
                : h('p', { key: j }, x)))));
}
function HelpBody() {
    return (React.createElement("div", { className: "mm-body mm-help" },
        React.createElement("p", null,
            React.createElement("b", null, "صفحه‌ها:"),
            " در هر صفحه، نوار بالا بخش‌ها را جدا می‌کند؛ با لمس هر بخش همان را می‌بینی."),
        React.createElement("p", null,
            React.createElement("b", null, "ثبت معامله:"),
            " دکمه‌ی + پایین صفحه یا همین منو."),
        React.createElement("p", null,
            React.createElement("b", null, "ذخیره‌ی داده:"),
            " معاملات و تنظیماتت روی حساب ابری ذخیره می‌شود و با همان ایمیل از هر دستگاهی در دسترس است؛ با پاک شدن اطلاعات مرورگر چیزی از دست نمی‌رود. «دریافت بک‌آپ» فقط یک نسخه‌ی اضافه روی دستگاه خودت است و گاهی گرفتنش خوب است."),
        React.createElement("p", null,
            React.createElement("b", null, "چند حساب:"),
            " هر کاربر داده‌های جدای خودش را دارد و کسی به اطلاعات تو دسترسی ندارد.")));
}

const SUBS = { 0: ['خلاصه و هزینه‌ها', 'R و ریسک', 'منحنی و رفتار'], 1: ['سشن و نماد', 'استراتژی‌ها', 'ریسک به ریوارد'], 3: ['هفته‌ها', 'روزهای هفته', 'میانگین روزانه'], 4: ['ماتریس', 'تاریخچه'] };
function TradingJournal({ user, onLogout }) {
    const [theme, setTheme] = useState(DEFAULT_THEME);
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [page, setPage] = useState(0);
    const [activeNav, setActiveNav] = useState(0);
    const [subs, setSubs] = useState({ 0: 0, 1: 0, 3: 0, 4: 0 });
    const sub = subs[page] || 0;
    const [modal, setModal] = useState(null);
    const [subx, setSubx] = useState(null);
    const loadSub = async () => {
        try {
            if (!sb) return;
            const p = await sb.from('profiles').select('trial_ends_at').eq('id', user.id).maybeSingle();
            const c = await sb.from('payment_claims').select('paid_until').eq('user_id', user.id).eq('status', 'verified').order('paid_until', { ascending: false }).limit(1);
            if (p.error || c.error)
                throw new Error('sub-load');
            setSubx({ trialEnds: p.data ? p.data.trial_ends_at : null, paidUntil: c.data && c.data[0] ? c.data[0].paid_until : null });
        }
        catch (e) { if ((loadSub.tries = (loadSub.tries || 0) + 1) <= 4) setTimeout(loadSub, 2500 * loadSub.tries); }
    };
    useEffect(() => { loadSub(); }, []);
    const locked = !!subx && subInfo(subx).kind === 'none';
    const lockedNew = () => {
        if (!locked)
            return false;
        setModal('sub');
        setTimeout(() => showToast('اشتراکت تمام شده؛ برای ثبت معامله‌ی جدید تمدید کن', 'bad'), 50);
        return true;
    };
    const [showDrawer, setShowDrawer] = useState(false);
    React.useEffect(() => { const h = e => { if (e.key === 'Escape')
        setShowDrawer(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);
    const [showControls, setShowControls] = useState(false);
    const NAV_ITEMS = [
        { id: 0, label: 'نمای کلی', icon: LayoutDashboard },
        { id: 1, label: 'سشن و نماد', icon: Layers },
        { id: 3, label: 'هفته‌ها و روزها', icon: CalendarDays },
        { id: 4, label: 'ماتریس و تاریخچه', icon: FileText },
    ];
    const exportCSV = () => {
        const rows = trades.filter(x => (x.accountId || 'default') === activeAccountId);
        if (!rows.length)
            return showToast('معامله‌ای برای خروجی نیست', 'bad');
        const keys = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
        const esc = v => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const csv = '\ufeff' + [keys.join(',')].concat(rows.map(r => keys.map(k => esc(r[k])).join(','))).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = 'fx-journal-trades.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const clearTrades = () => {
        if (!window.confirm('همه‌ی معاملات این حساب پاک می‌شود. ادامه می‌دهی؟'))
            return;
        if (!window.confirm('این کار برگشت‌پذیر نیست. اگر بک‌آپ نگرفته‌ای اول بک‌آپ بگیر. مطمئنی؟'))
            return;
        persistTrades(trades.filter(x => (x.accountId || 'default') !== activeAccountId));
        showToast('معاملات این حساب پاک شد', 'good');
    };
    const handleNavClick = (id) => {
        const apply = () => { setPage(id); setActiveNav(id); };
        if (document.startViewTransition && typeof ReactDOM !== 'undefined' && ReactDOM.flushSync && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            try { document.startViewTransition(() => { ReactDOM.flushSync(apply); }); return; } catch (e) { }
        }
        apply();
    };
    const closeFormSoft = () => {
        const el = document.querySelector('.modal-backdrop');
        const done = () => { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); };
        if (el && !el.classList.contains('closing')) { el.classList.add('closing'); setTimeout(done, 230); } else { done(); }
    };
    const [historySearch, setHistorySearch] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [toast, setToast] = useState(null);
    const showToast = (msg, tone = 'good') => {
        const id = Date.now();
        setToast({ msg, tone, id });
        const dur = Math.min(7000, Math.max(2300, 1400 + String(msg).length * 60));
        setTimeout(() => setToast(t => (t && t.id === id ? Object.assign({}, t, { leaving: true }) : t)), dur);
        setTimeout(() => setToast(t => (t && t.id === id ? null : t)), dur + 320);
    };
    const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
    const [activeAccountId, setActiveAccountId] = useState('default');
    const [newAccountName, setNewAccountName] = useState('');
    const [showAccountManager, setShowAccountManager] = useState(false);
    const [showSheets, setShowSheets] = useState(false);
    const [sheetsUrl, setSheetsUrl] = useState('');
    const [sheetsBusy, setSheetsBusy] = useState(false);
    const [balance, setBalance] = useState(1000);
    const [balanceText, setBalanceText] = useState('1000');
    const [userName, setUserName] = useState('');
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [strategies, setStrategies] = useState(DEFAULT_STRATEGIES);
    const [newStrategy, setNewStrategy] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [showAlerts, setShowAlerts] = useState(true);
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);
    const C = theme;
    useEffect(() => {
        (async () => {
            try {
                const a = await storage.get('journal-accounts');
                if (a && a.value)
                    setAccounts(JSON.parse(a.value));
                const aa = await storage.get('journal-active-account');
                if (aa && aa.value)
                    setActiveAccountId(aa.value);
                try { const cc = await storage.get('journal-contracts'); if (cc && cc.value) Object.assign(CONTRACT_OVERRIDES, JSON.parse(cc.value)); } catch (e) { }
                const su = await storage.get('journal-sheets-url');
                if (su && su.value)
                    setSheetsUrl(su.value);
            }
            catch (e) { }
            try {
                const res = await storage.get('journal-trades');
                if (res && res.value) {
                    const parsed = JSON.parse(res.value).map(t => ({ ...t, accountId: t.accountId || 'default', day: weekdayFaFromDate(t.date) || t.day }));
                    setTrades(parsed);
                }
                else {
                    setTrades([]);
                }
            }
            catch (e) {
                setTrades([]);
            }
            try {
                const t = await storage.get('journal-theme');
                if (t && t.value)
                    setTheme(JSON.parse(t.value));
            }
            catch (e) { }
            try {
                const b = await storage.get('journal-balance');
                if (b && b.value) {
                    const val = JSON.parse(b.value);
                    setBalance(val);
                    setBalanceText(String(val));
                }
            }
            catch (e) { }
            try {
                const s = await storage.get('journal-strategies');
                if (s && s.value)
                    setStrategies(JSON.parse(s.value));
                else
                    await storage.set('journal-strategies', JSON.stringify(DEFAULT_STRATEGIES));
            }
            catch (e) { }
            try {
                const savedName = await storage.get('journal-username');
                setUserName(savedName && savedName.value ? savedName.value : user.name);
            }
            catch (e) {
                setUserName(user.name);
            }
            try {
                const alerts = await storage.get('journal-alerts');
                if (alerts && alerts.value)
                    setShowAlerts(JSON.parse(alerts.value));
            }
            catch (e) { }
            setLoading(false);
        })();
    }, []);
    useEffect(() => {
        const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target))
            setShowMenu(false); };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setShowMenu(false);
                setShowControls(false);
                setShowForm(false);
                setShowAccountManager(false);
                setShowSheets(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, []);
    const persistTrades = async (next) => {
        setTrades(next);
        try {
            await storage.set('journal-trades', JSON.stringify(next));
        }
        catch (e) { }
    };
    const persistAccounts = async (next) => { setAccounts(next); try {
        await storage.set('journal-accounts', JSON.stringify(next));
    }
    catch (e) { } };
    const switchAccount = async (id) => {
        setActiveAccountId(id);
        try {
            await storage.set('journal-active-account', id);
        }
        catch (e) { }
        const a = accounts.find(x => x.id === id);
        if (a) {
            setBalance(Number(a.balance || 0));
            setBalanceText(String(a.balance || 0));
        }
    };
    const addAccount = async () => {
        const name = newAccountName.trim();
        if (!name)
            return;
        const id = 'acc_' + Date.now();
        const next = [...accounts, { id, name, balance: 1000, currency: 'USD' }];
        await persistAccounts(next);
        setNewAccountName('');
        await switchAccount(id);
        showToast('حساب جدید ساخته شد ✅', 'good');
    };
    const deleteAccount = async (id) => {
        if (accounts.length <= 1) {
            showToast('حداقل یک حساب باید باقی بماند', 'bad');
            return;
        }
        const next = accounts.filter(a => a.id !== id);
        await persistAccounts(next);
        const kept = trades.filter(t => (t.accountId || 'default') !== id);
        await persistTrades(kept);
        if (id === activeAccountId) {
            const nextActive = next[0];
            setActiveAccountId(nextActive.id);
            setBalance(Number(nextActive.balance || 0));
            setBalanceText(String(nextActive.balance || 0));
            try {
                await storage.set('journal-active-account', nextActive.id);
            }
            catch (e) { }
        }
        showToast('حساب حذف شد', 'neutral');
    };
    const updateAccount = async (id, patch) => {
        const next = accounts.map(a => a.id === id ? { ...a, ...patch } : a);
        await persistAccounts(next);
        if (id === activeAccountId && patch.balance != null) {
            setBalance(Number(patch.balance) || 0);
            setBalanceText(String(patch.balance));
        }
    };
    const updateActiveAccountBalance = async (value) => {
        const v = Number(value);
        if (!Number.isFinite(v))
            return;
        const next = accounts.map(a => a.id === activeAccountId ? { ...a, balance: v } : a);
        await persistAccounts(next);
        setBalance(v);
        setBalanceText(String(v));
    };
    const saveSheetsUrl = async () => { try {
        await storage.set('journal-sheets-url', sheetsUrl.trim());
        showToast('آدرس Google Sheets ذخیره شد ✅', 'good');
    }
    catch (e) { } };
    const pushToGoogleSheets = async () => {
        if (!sheetsUrl.trim()) {
            setShowSheets(true);
            showToast('ابتدا Web App URL گوگل شیت را وارد کن', 'bad');
            return;
        }
        setSheetsBusy(true);
        try {
            const payload = { account: activeAccount, exportedAt: new Date().toISOString(), trades: activeTrades.map(t => ({ ...t, pips: calcPips(t), r: calcTradeR(t, activeBalance) })) };
            await fetch(sheetsUrl.trim(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
            showToast('درخواست ارسال شد — شیت را چک کن (تأیید خودکار ندارد)', 'good');
        }
        catch (e) {
            showToast('اتصال Google Sheets ناموفق بود', 'bad');
        }
        finally {
            setSheetsBusy(false);
        }
    };
    const updateTheme = async (patch) => {
        const next = { ...theme, ...patch };
        setTheme(next);
        try {
            await storage.set('journal-theme', JSON.stringify(next));
        }
        catch (e) { }
    };
    const resetTheme = () => updateTheme(DEFAULT_THEME);
    const updateBalance = async (val) => {
        const numeric = Number(val);
        if (!Number.isFinite(numeric) || numeric < 0)
            return;
        setBalance(numeric);
        setBalanceText(String(numeric));
        const nextAccounts = accounts.map(a => a.id === activeAccountId ? { ...a, balance: numeric } : a);
        setAccounts(nextAccounts);
        try {
            await storage.set('journal-accounts', JSON.stringify(nextAccounts));
            await storage.set('journal-balance', JSON.stringify(numeric));
        }
        catch (e) { }
    };
    const onBalanceTextChange = (raw) => {
        setBalanceText(raw);
        const parsed = parseFloat(raw);
        if (!isNaN(parsed))
            updateBalance(parsed);
    };
    const onBalanceBlur = () => {
        if (isNaN(parseFloat(balanceText)))
            setBalanceText(String(balance));
    };
    const saveName = async () => {
        const name = nameInput.trim();
        if (!name)
            return;
        setUserName(name);
        try {
            await storage.set('journal-username', name);
        }
        catch (e) { }
        setShowNamePrompt(false);
    };
    const persistStrategies = async (next) => {
        setStrategies(next);
        try {
            await storage.set('journal-strategies', JSON.stringify(next));
        }
        catch (e) { }
    };
    const addStrategyOption = () => {
        const name = newStrategy.trim();
        if (!name || strategies.includes(name))
            return;
        persistStrategies([...strategies, name]);
        setForm({ ...form, strategy: name });
        setNewStrategy('');
    };
    const removeStrategyOption = (name) => {
        persistStrategies(strategies.filter(s => s !== name));
        if (form.strategy === name)
            setForm({ ...form, strategy: '' });
    };
    const setExitFrom = (source) => {
        const val = source === 'stop' ? form.stopLoss : form.target;
        if (val !== '')
            setForm({ ...form, exitPrice: val });
    };
    const calcPnlFromPrices = () => {
        const entry = parseFloat(form.entryPrice);
        const exit = parseFloat(form.exitPrice);
        const vol = parseFloat(form.volume);
        if (!Number.isFinite(entry) || !Number.isFinite(exit) || !Number.isFinite(vol))
            return false;
        const symbol = form.symbol === 'Custom' ? form.customSymbol.trim().toUpperCase() : form.symbol;
        const spec = pnlSpec(symbol, exit, form.convRate, form.contractSize);
        if (!spec) { showToast('ارزش هر ۱ واحد حرکت این نماد را در بخش قیمت‌ها بنویس، یا سود را دستی وارد کن', 'neutral'); return false; }
        if (!spec.toUsd) { showToast('برای محاسبه، نرخ ' + spec.need + ' را در فرم وارد کن', 'neutral'); return false; }
        const mult = spec.size * spec.toUsd;
        const sign = form.direction === 'خرید' ? 1 : -1;
        const grossPnl = (exit - entry) * sign * vol * mult;
        const commission = parseFloat(form.commission) || 0;
        const swap = parseFloat(form.swap) || 0;
        const pnl = grossPnl + commission + swap;
        const nextResult = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be';
        setForm(prev => ({ ...prev, pnl: pnl.toFixed(2), result: nextResult, pnlManual: false }));
        return true;
    };
    useEffect(() => {
        if (form.pnlManual)
            return;
        const entry = parseFloat(form.entryPrice);
        const exit = parseFloat(form.exitPrice);
        const vol = parseFloat(form.volume);
        if (!Number.isFinite(entry) || !Number.isFinite(exit) || !Number.isFinite(vol))
            return;
        const symbol = form.symbol === 'Custom' ? form.customSymbol.trim().toUpperCase() : form.symbol;
        const spec = pnlSpec(symbol, exit, form.convRate, form.contractSize);
        if (!spec || !spec.toUsd)
            return;
        const mult = spec.size * spec.toUsd;
        const sign = form.direction === 'خرید' ? 1 : -1;
        const grossPnl = (exit - entry) * sign * vol * mult;
        const commission = parseFloat(form.commission) || 0;
        const swap = parseFloat(form.swap) || 0;
        const pnl = grossPnl + commission + swap;
        const pnlText = pnl.toFixed(2);
        const nextResult = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be';
        if (form.pnl !== pnlText || form.result !== nextResult) {
            setForm(prev => ({ ...prev, pnl: pnlText, result: nextResult }));
        }
    }, [form.entryPrice, form.exitPrice, form.volume, form.direction, form.symbol, form.customSymbol, form.commission, form.swap, form.pnlManual, form.convRate, form.contractSize]);
    const addTrade = async () => {
        const symbol = form.symbol === 'Custom' ? form.customSymbol.trim().toUpperCase() : form.symbol;
        const pnl = parseFloat(form.pnl);
        if (!symbol || !Number.isFinite(pnl)) {
            showToast('نماد و سود/زیان نهایی را وارد کن', 'bad');
            return;
        }
        if (!form.date) {
            showToast('تاریخ معامله را وارد کن', 'bad');
            return;
        }
        const expectedResult = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'be';
        if (form.result !== expectedResult) {
            showToast('نتیجه معامله با سود/زیان واردشده سازگار نیست', 'bad');
            return;
        }
        const rr = calcRR(form.entryPrice, form.stopLoss, form.target);
        const oldTrade = editingId ? trades.find(t => t.id === editingId) : null;
        const ev = editingId ? null : evalRules(activeTrades, { date: form.date, riskPercent: form.riskPercent }, activeRules);
        const newTrade = {
            id: Date.now(),
            accountId: activeAccountId,
            date: form.date, symbol, session: form.session, timeframe: form.timeframe || '', day: weekdayFaFromDate(form.date), time: form.time,
            direction: form.direction, entryPrice: form.entryPrice, stopLoss: form.stopLoss, target: form.target,
            exitPrice: form.exitPrice, volume: form.volume, convRate: form.convRate || '', contractSize: form.contractSize || '', strategy: form.strategy, result: form.result,
            emotion: form.emotion, pnl, rr,
            commission: parseFloat(form.commission) || 0,
            swap: parseFloat(form.swap) || 0,
            riskPercent: parseFloat(form.riskPercent) || 1,
            notes: form.notes || '', quality: form.quality || 0, followedPlan: form.followedPlan || '', mistakes: Array.isArray(form.mistakes) ? form.mistakes : [],
            ruleBreaks: ev ? ev.breaks : (oldTrade ? oldTrade.ruleBreaks : undefined), ruleScore: ev ? ev.score : (oldTrade ? oldTrade.ruleScore : undefined),
        };
        { const cs = parseFloat(form.contractSize); if (!fxPair(symbol) && cs > 0 && CONTRACT_OVERRIDES[symbol] !== cs) { CONTRACT_OVERRIDES[symbol] = cs; try { storage.set('journal-contracts', JSON.stringify(CONTRACT_OVERRIDES)); } catch (e) { } } }
        if (ev && ev.breaks.length && !newTrade.mistakes.includes('قانون شکسته'))
            newTrade.mistakes = [...newTrade.mistakes, 'قانون شکسته'];
        let next;
        if (editingId) {
            next = trades.map(t => t.id === editingId ? { ...newTrade, id: editingId } : t);
            showToast('معامله ویرایش شد ✅', 'good');
            setEditingId(null);
        }
        else {
            next = [...trades, newTrade];
            showToast((pnl >= 0 ? `معامله ثبت شد — سود ${fmt(pnl)}$ ✅` : `معامله ثبت شد — زیان ${fmt(Math.abs(pnl))}$`) + (ev && ev.breaks.length ? ` · ⚠️ قانون شکسته (نمره ${ev.score})` : ''), pnl >= 0 && !(ev && ev.breaks.length) ? 'good' : 'bad');
        }
        await persistTrades(next);
        setForm(EMPTY_FORM);
        setShowForm(false);
    };
    const deleteTrade = async (id) => { await persistTrades(trades.filter(t => t.id !== id)); showToast('معامله حذف شد', 'neutral'); };
    const editTrade = (trade) => {
        setForm({
            date: trade.date, symbol: SYMBOL_PRESETS.includes(trade.symbol) ? trade.symbol : 'Custom', customSymbol: SYMBOL_PRESETS.includes(trade.symbol) ? '' : trade.symbol, session: trade.session, timeframe: trade.timeframe || '',
            time: trade.time || '', direction: trade.direction,
            entryPrice: trade.entryPrice || '', stopLoss: trade.stopLoss || '', target: trade.target || '',
            exitPrice: trade.exitPrice || '', volume: trade.volume || '', convRate: trade.convRate || '', contractSize: trade.contractSize || '', strategy: trade.strategy || '',
            result: trade.result || 'win', emotion: trade.emotion || '', pnl: String(trade.pnl), pnlManual: true,
            commission: String(trade.commission || ''), swap: String(trade.swap || ''), riskPercent: String(trade.riskPercent || '1'),
            notes: trade.notes || '', quality: trade.quality || 0, followedPlan: trade.followedPlan || '', mistakes: trade.mistakes || [],
        });
        setEditingId(trade.id);
        setShowForm(true);
    };
    const exportData = async () => {
        const data = { trades, balance, userName, strategies, theme, accounts, activeAccountId, exportedAt: new Date().toISOString() };
        const text = JSON.stringify(data, null, 2);
        const fname = `journal-backup-${toLocalISODate(new Date())}.json`;
        try {
            const file = new File([text], fname, { type: 'application/json' });
            const inFrame = window.self !== window.top;
            if (inFrame && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Tradyar backup' });
                showToast('بک‌آپ آماده شد ✅', 'good');
                return;
            }
        }
        catch (err) { if (err && err.name === 'AbortError') return; }
        try {
            const blob = new Blob([text], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fname;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
            showToast('فایل بک‌آپ دانلود شد ✅', 'good');
        }
        catch (err) {
            try { await navigator.clipboard.writeText(text); showToast('دانلود ممکن نشد؛ متن بک‌آپ کپی شد', 'good'); }
            catch (e2) { showToast('ذخیره بک‌آپ ناموفق بود', 'bad'); }
        }
    };
    const importData = (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                const bad = (m) => { throw new Error(m); };
                if (!data || typeof data !== 'object' || Array.isArray(data)) bad('format');
                const okAcc = (a) => a && typeof a === 'object' && a.id != null && typeof a.name === 'string';
                const okTr = (t) => t && typeof t === 'object' && /^\d{4}-\d{2}-\d{2}/.test(String(t.date || '')) && Number.isFinite(Number(t.pnl));
                if (data.accounts !== undefined && !(Array.isArray(data.accounts) && data.accounts.every(okAcc))) bad('accounts');
                if (data.trades !== undefined && !(Array.isArray(data.trades) && data.trades.every(okTr))) bad('trades');
                if (data.accounts === undefined && data.trades === undefined) bad('empty');
                const nA = Array.isArray(data.accounts) ? data.accounts.length : 0, nT = Array.isArray(data.trades) ? data.trades.length : 0;
                if (!window.confirm('این فایل شامل ' + nA + ' حساب و ' + nT + ' معامله است. اطلاعات فعلی با آن جایگزین می‌شود. ادامه می‌دهی؟'))
                    return;
                const importedAccounts = Array.isArray(data.accounts) && data.accounts.length ? data.accounts : null;
                if (importedAccounts) {
                    setAccounts(importedAccounts);
                    storage.set('journal-accounts', JSON.stringify(importedAccounts));
                }
                const importedActiveId = data.activeAccountId && (!importedAccounts || importedAccounts.some(a => a.id === data.activeAccountId))
                    ? data.activeAccountId
                    : (importedAccounts ? importedAccounts[0].id : null);
                if (importedActiveId) {
                    setActiveAccountId(importedActiveId);
                    storage.set('journal-active-account', importedActiveId);
                    const importedActive = importedAccounts === null || importedAccounts === void 0 ? void 0 : importedAccounts.find(a => a.id === importedActiveId);
                    if (importedActive) {
                        setBalance(Number(importedActive.balance || 0));
                        setBalanceText(String(importedActive.balance || 0));
                    }
                }
                if (Array.isArray(data.trades)) {
                    persistTrades(data.trades.map(t => ({ ...t, accountId: t.accountId || 'default', day: weekdayFaFromDate(t.date) || t.day })));
                }
                if (data.balance !== undefined && data.balance !== null && Number.isFinite(Number(data.balance))) {
                    setBalance(Number(data.balance));
                    setBalanceText(String(data.balance));
                }
                if (data.userName) {
                    setUserName(data.userName);
                    storage.set('journal-username', data.userName);
                }
                if (data.strategies) {
                    setStrategies(data.strategies);
                    storage.set('journal-strategies', JSON.stringify(data.strategies));
                }
                if (data.theme) {
                    setTheme(data.theme);
                    storage.set('journal-theme', JSON.stringify(data.theme));
                }
                showToast('داده‌ها با موفقیت بازیابی شدند ✅', 'good');
            }
            catch (err) {
                showToast('فایل بک‌آپ معتبر نیست؛ هیچ چیز تغییر نکرد', 'bad');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    const activeTrades = useMemo(() => trades.filter(t => (t.accountId || 'default') === activeAccountId), [trades, activeAccountId]);
    const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || DEFAULT_ACCOUNTS[0];
    const activeBalance = Number((activeAccount === null || activeAccount === void 0 ? void 0 : activeAccount.balance) || balance || 0);
    const activeRules = useMemo(() => ruleOf(activeAccount), [activeAccount]);
    const propSt = useMemo(() => propStatus(activeAccount, activeTrades, activeRules), [activeAccount, activeTrades, activeRules]);
    const formEval = useMemo(() => showForm && !editingId ? evalRules(activeTrades, { date: form.date, riskPercent: form.riskPercent }, activeRules) : null, [showForm, editingId, activeTrades, form.date, form.riskPercent, activeRules]);
    const stats = useMemo(() => computeStats(activeTrades), [activeTrades]);
    const netPnlAnimated = useCountUp(stats.netPnl, 700);
    const bySession = useMemo(() => groupBy(activeTrades, 'session'), [activeTrades]);
    const byTimeframe = useMemo(() => groupBy(activeTrades.filter(t => t.timeframe), 'timeframe').sort((a, b) => TIMEFRAMES.indexOf(a.name) - TIMEFRAMES.indexOf(b.name)), [activeTrades]);
    const bySymbol = useMemo(() => groupBy(activeTrades, 'symbol'), [activeTrades]);
    const byStrategy = useMemo(() => {
        const normalized = activeTrades.map(t => ({ ...t, strategy: (t.strategy || '').trim() || 'بدون استراتژی' }));
        return groupBy(normalized, 'strategy');
    }, [activeTrades]);
    const byRR = useMemo(() => {
        const withRR = activeTrades.filter(t => typeof t.rr === 'number');
        const map = {};
        RR_BUCKETS.forEach(b => { map[b] = []; });
        withRR.forEach(t => { map[rrBucketOf(t.rr)].push(t); });
        return RR_BUCKETS.map(b => {
            const list = map[b];
            const wins = list.filter(t => (t.result ? t.result === 'win' : t.pnl > 0)).length;
            const winRate = list.length ? (wins / list.length) * 100 : 0;
            const netPnl = list.reduce((s, t) => s + t.pnl, 0);
            return { name: b, total: list.length, wins, winRate, netPnl };
        }).filter(b => b.total > 0);
    }, [activeTrades]);
    const orderedActiveTrades = useMemo(() => [...activeTrades].sort((a, b) => {
        const da = `${a.date || ''} ${a.time || '23:59'}`;
        const db = `${b.date || ''} ${b.time || '23:59'}`;
        return da.localeCompare(db) || Number(a.id || 0) - Number(b.id || 0);
    }), [activeTrades]);
    const equityCurve = useMemo(() => {
        let running = 0;
        const points = [{ name: 'شروع', equity: 0 }];
        orderedActiveTrades.forEach((t, i) => {
            running += Number(t.pnl) || 0;
            points.push({ name: `#${i + 1}`, equity: Math.round(running * 100) / 100 });
        });
        return points;
    }, [orderedActiveTrades]);
    const calendarEquityCurve = useMemo(() => {
        if (!activeTrades.length)
            return [];
        const dates = [...new Set(activeTrades.map(t => t.date))].sort();
        const firstDate = dates[0], lastDate = dates[dates.length - 1];
        const pnlByDate = {};
        activeTrades.forEach(t => { pnlByDate[t.date] = (pnlByDate[t.date] || 0) + t.pnl; });
        const points = [{ name: 'شروع', equity: 0 }];
        let running = 0;
        let cur = new Date(firstDate + 'T00:00:00');
        const last = new Date(lastDate + 'T00:00:00');
        while (cur <= last) {
            const dow = cur.getDay();
            if (dow !== 0 && dow !== 6) {
                const key = toLocalISODate(cur);
                if (pnlByDate[key] !== undefined)
                    running += pnlByDate[key];
                points.push({ name: `${weekdayFaFromDate(key)} ${fmtDateShort(cur)}`, equity: Math.round(running * 100) / 100 });
            }
            cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
        }
        return points;
    }, [activeTrades]);
    const calendarEquityPeak = calendarEquityCurve.length ? Math.max(0, ...calendarEquityCurve.map(e => e.equity)) : 0;
    const calendarEquityLow = calendarEquityCurve.length ? Math.min(0, ...calendarEquityCurve.map(e => e.equity)) : 0;
    const calendarEquityCurrent = calendarEquityCurve.length ? calendarEquityCurve[calendarEquityCurve.length - 1].equity : 0;
    const calendarEquityCurrentAnimated = useCountUp(calendarEquityCurrent, 700);
    const equityPeak = equityCurve.length ? Math.max(0, ...equityCurve.map(e => e.equity)) : 0;
    const equityLow = equityCurve.length ? Math.min(0, ...equityCurve.map(e => e.equity)) : 0;
    const equityCurrent = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : 0;
    const equityCurrentAnimated = useCountUp(equityCurrent, 700);
    const matrix = useMemo(() => {
        const symbols = [...new Set(activeTrades.map(t => t.symbol))];
        const cells = {};
        activeTrades.forEach(t => {
            const key = `${t.symbol}|${t.session}`;
            if (!cells[key])
                cells[key] = { pnl: 0, count: 0 };
            cells[key].pnl += t.pnl;
            cells[key].count += 1;
        });
        let bestKey = null, bestVal = -Infinity, worstKey = null, worstVal = Infinity;
        Object.entries(cells).forEach(([k, v]) => {
            if (v.pnl > bestVal) {
                bestVal = v.pnl;
                bestKey = k;
            }
            if (v.pnl < worstVal) {
                worstVal = v.pnl;
                worstKey = k;
            }
        });
        const maxAbs = Math.max(1, ...Object.values(cells).map(v => Math.abs(v.pnl)));
        return { symbols, cells, bestKey, worstKey, maxAbs };
    }, [activeTrades]);
    const bestSession = bySession[0];
    const bestSymbol = bySymbol[0];
    const worstSession = bySession.length ? bySession[bySession.length - 1] : null;
    const worstSymbol = bySymbol.length ? bySymbol[bySymbol.length - 1] : null;
    const bestStrategy = byStrategy[0];
    const worstStrategy = byStrategy.length ? byStrategy[byStrategy.length - 1] : null;
    const byDayOrdered = useMemo(() => {
        const grouped = groupBy(activeTrades, 'day');
        const map = {};
        grouped.forEach(g => { map[g.name] = g; });
        return DAYS.map(d => map[d] || { name: d, total: 0, netPnl: 0, winRate: 0, wins: 0, losses: 0 });
    }, [activeTrades]);
    const dayAvgStats = useMemo(() => {
        const dateMap = {};
        activeTrades.forEach(t => {
            if (!t.day)
                return;
            if (!dateMap[t.date])
                dateMap[t.date] = { day: t.day, pnl: 0 };
            dateMap[t.date].pnl += t.pnl;
        });
        return DAYS.map(day => {
            const occurrencesArr = Object.values(dateMap).filter(v => v.day === day);
            const occurrences = occurrencesArr.length;
            const totalPnl = occurrencesArr.reduce((s, v) => s + v.pnl, 0);
            const totalPercent = activeBalance > 0 ? (totalPnl / activeBalance) * 100 : 0;
            const avgPercent = occurrences ? totalPercent / occurrences : 0;
            const avgPnl = occurrences ? totalPnl / occurrences : 0;
            return { name: day, occurrences, totalPnl, totalPercent, avgPercent, avgPnl };
        });
    }, [activeTrades, activeBalance]);
    const worstDay = dayAvgStats.filter(d => d.occurrences > 0).sort((a, b) => a.avgPercent - b.avgPercent)[0] || null;
    const bestDay = dayAvgStats.filter(d => d.occurrences > 0).sort((a, b) => b.avgPercent - a.avgPercent)[0] || null;
    const weeklyStats = useMemo(() => {
        if (!activeTrades.length)
            return [];
        const byWeek = {};
        activeTrades.forEach(t => {
            const w = weekInfoFromDate(t.date);
            if (!w)
                return;
            if (!byWeek[w.key])
                byWeek[w.key] = { key: w.key, start: w.start, end: w.end, pnl: 0, count: 0, wins: 0 };
            byWeek[w.key].pnl += t.pnl;
            byWeek[w.key].count += 1;
            if (t.pnl > 0)
                byWeek[w.key].wins += 1;
        });
        return Object.values(byWeek).sort((a, b) => a.key.localeCompare(b.key)).map((w, i) => ({
            name: `هفته ${i + 1}`,
            range: `${fmtDateShort(w.start)} تا ${fmtDateShort(w.end)}`,
            netPnl: Math.round(w.pnl * 100) / 100,
            pips: Math.round(activeTrades.filter(t => { const wi = weekInfoFromDate(t.date); return wi && wi.key === w.key; }).reduce((s, t) => s + calcPips(t), 0) * 10) / 10,
            r: Math.round(activeTrades.filter(t => { const wi = weekInfoFromDate(t.date); return wi && wi.key === w.key; }).reduce((s, t) => s + calcTradeR(t, activeBalance), 0) * 100) / 100,
            percent: activeBalance > 0 ? (w.pnl / activeBalance) * 100 : 0,
            count: w.count,
            winRate: w.count ? (w.wins / w.count) * 100 : 0,
        }));
    }, [activeTrades, activeBalance]);
    const currentWeekInfo = useMemo(() => weekInfoFromDate(toLocalISODate(new Date())), []);
    const currentWeekTrades = useMemo(() => {
        if (!currentWeekInfo)
            return [];
        return activeTrades.filter(t => { const w = weekInfoFromDate(t.date); return w && w.key === currentWeekInfo.key; });
    }, [activeTrades, currentWeekInfo]);
    const currentWeekStats = useMemo(() => computeStats(currentWeekTrades), [currentWeekTrades]);
    const currentWeekPercent = activeBalance > 0 ? (currentWeekStats.netPnl / activeBalance) * 100 : 0;
    const emotionStats = useMemo(() => {
        const map = {};
        activeTrades.forEach(t => {
            if (!t.emotion)
                return;
            if (!map[t.emotion])
                map[t.emotion] = { count: 0, pnl: 0, wins: 0 };
            map[t.emotion].count += 1;
            map[t.emotion].pnl += t.pnl;
            if (t.pnl > 0)
                map[t.emotion].wins += 1;
        });
        return Object.entries(map).map(([name, data]) => ({
            name, count: data.count, pnl: data.pnl, winRate: data.count ? (data.wins / data.count) * 100 : 0,
        })).sort((a, b) => b.pnl - a.pnl);
    }, [activeTrades]);
    const hourlyStats = useMemo(() => {
        const map = {};
        activeTrades.forEach(t => {
            if (!t.time)
                return;
            const hour = t.time.split(':')[0];
            if (!map[hour])
                map[hour] = { count: 0, pnl: 0 };
            map[hour].count += 1;
            map[hour].pnl += t.pnl;
        });
        return Object.entries(map).map(([hour, data]) => ({ hour: `${hour}:00`, count: data.count, pnl: data.pnl, })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
    }, [activeTrades]);
    const insights = useMemo(() => {
        const list = [];
        if (activeTrades.length < 5)
            return list;
        if (matrix.worstKey) {
            const [sym, sess] = matrix.worstKey.split('|');
            const cell = matrix.cells[matrix.worstKey];
            if (cell.pnl < 0)
                list.push({ tone: 'bad', text: `طبق معاملاتت، بهتره روی ${sym} در سشن ${sess} ترید نکنی — اونجا در مجموع ${fmt(cell.pnl)}$ ضرر دادی.` });
        }
        if (matrix.bestKey && matrix.bestKey !== matrix.worstKey) {
            const [sym, sess] = matrix.bestKey.split('|');
            const cell = matrix.cells[matrix.bestKey];
            if (cell.pnl > 0)
                list.push({ tone: 'good', text: `در مقابل، بهترین ترکیبت ${sym} در سشن ${sess} هست — ${fmt(cell.pnl)}$ سود از اونجا اومده.` });
        }
        if (worstDay && worstDay.avgPercent < 0) {
            list.push({ tone: 'bad', text: `روزهای ${worstDay.name} برات ضعیف بودن — به‌طور میانگین ${fmt(Math.abs(worstDay.avgPercent), 2)}٪ ضرر در هر ${worstDay.name}. شاید بهتره اون روز کمتر یا محتاط‌تر معامله کنی.` });
        }
        if (bestDay && bestDay.avgPercent > 0 && bestDay.name !== (worstDay && worstDay.name)) {
            list.push({ tone: 'good', text: `${bestDay.name}‌ها بهترین روزهات هستن — میانگین ${fmt(bestDay.avgPercent, 2)}٪ سود در هر ${bestDay.name}.` });
        }
        if (worstStrategy && byStrategy.length > 1 && worstStrategy.netPnl < 0) {
            list.push({ tone: 'bad', text: `استراتژی «${worstStrategy.name}» ضعیف‌ترین عملکرد رو داشته (وین‌ریت ${fmt(worstStrategy.winRate, 0)}٪، ${fmt(worstStrategy.netPnl)}$) — ارزش بازبینی داره.` });
        }
        if (bestStrategy && byStrategy.length > 1 && bestStrategy.netPnl > 0 && bestStrategy.name !== (worstStrategy && worstStrategy.name)) {
            list.push({ tone: 'good', text: `استراتژی «${bestStrategy.name}» بهترین نتیجه رو داده — وین‌ریت ${fmt(bestStrategy.winRate, 0)}٪ و ${fmt(bestStrategy.netPnl)}$ سود.` });
        }
        return list;
    }, [activeTrades, matrix, worstDay, bestDay, worstStrategy, bestStrategy, byStrategy]);
    const riskUnit = activeBalance > 0 ? 1 : 0; // فقط نشانه‌ی «موجودی داریم»؛ R هر معامله از ریسک واقعی خودش حساب می‌شود
    const rStats = useMemo(() => computeRStats(activeTrades, activeBalance), [activeTrades, activeBalance]);
    const totalPips = useMemo(() => activeTrades.reduce((sum, t) => sum + calcPips(t), 0), [activeTrades]);
    const rAdvanced = useMemo(() => {
        let cumulative = 0, peak = 0, maxDrawdown = 0;
        const rows = orderedActiveTrades.map((t, i) => { const r = calcTradeR(t, activeBalance); cumulative += r; peak = Math.max(peak, cumulative); maxDrawdown = Math.max(maxDrawdown, peak - cumulative); return { name: `#${i + 1}`, r: Math.round(r * 100) / 100, cumulativeR: Math.round(cumulative * 100) / 100, drawdownR: Math.round((peak - cumulative) * 100) / 100 }; });
        const rs = rows.map(x => x.r);
        const wins = rs.filter(x => x > 0), losses = rs.filter(x => x < 0).map(Math.abs);
        const expectancy = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
        const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
        const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
        return { rows, cumulativeR: cumulative, maxDrawdownR: maxDrawdown, expectancy, avgWin, avgLoss, payoff: avgLoss ? avgWin / avgLoss : 0 };
    }, [orderedActiveTrades, activeBalance]);
    const RESULT_META = {
        win: { label: 'برد', color: C.positive },
        loss: { label: 'باخت', color: C.negative },
        be: { label: 'سر به سر', color: C.accent },
    };
    const filteredTrades = useMemo(() => {
        const normQ = (x) => String(x == null ? '' : x).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s\u200c_\-\/.]/g, '');
        const q = normQ(historySearch);
        return [...activeTrades].reverse().filter(t => {
            const matchesQuery = !q || [t.symbol, t.strategy, t.session, t.timeframe, t.notes].some(x => normQ(x).includes(q));
            const matchesFilter = historyFilter === 'all' || resultOf(t) === historyFilter;
            let matchesDate = true;
            if (dateRange.from)
                matchesDate = matchesDate && t.date >= dateRange.from;
            if (dateRange.to)
                matchesDate = matchesDate && t.date <= dateRange.to;
            return matchesQuery && matchesFilter && matchesDate;
        });
    }, [activeTrades, historySearch, historyFilter, dateRange]);
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length)
            return null;
        return (React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 } },
            React.createElement("div", { style: { color: '#c7ccd6', marginBottom: 4 } }, label),
            payload.map((p, i) => (React.createElement("div", { key: i, style: { color: p.value >= 0 ? C.positive : C.negative } },
                p.name ? `${p.name}: ` : '',
                fmt(p.value),
                "$")))));
    };
    const StatCard = ({ label, value, sub, tone }) => {
        const color = tone === 'good' ? C.positive : tone === 'bad' ? C.negative : C.accent;
        const glow = tone === 'good' ? C.positive : tone === 'bad' ? C.negative : C.accent;
        const ref = useRef(null);
        const onMove = (e) => {
            const el = ref.current;
            if (!el)
                return;
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            el.style.transform = `perspective(600px) rotateX(${-py * 8}deg) rotateY(${px * 8}deg) translateY(-3px)`;
        };
        const onLeave = () => { if (ref.current)
            ref.current.style.transform = 'perspective(600px) rotateX(0) rotateY(0) translateY(0)'; };
        return (React.createElement("div", { ref: ref, className: "stat-card glass-effect", onMouseMove: onMove, onMouseLeave: onLeave, style: { borderRadius: 14, padding: '12px 14px', boxShadow: `0 8px 20px ${glow}0f` } },
            React.createElement("div", { style: { fontSize: 12.5, letterSpacing: '0.07em', color: `${C.text}66`, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" } }, label),
            React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 21, fontWeight: 500, color, marginTop: 6 } }, value),
            sub && React.createElement("div", { style: { fontSize: 13, color: `${C.text}77`, marginTop: 6 } }, sub)));
    };
    const DualRateCard = ({ label, rightValue, rightSub, leftValue, leftSub, sub }) => (React.createElement("div", { className: "stat-card glass-effect", style: { borderRadius: 14, padding: '12px 14px', boxShadow: `0 8px 20px ${C.accent}0f` } },
        React.createElement("div", { style: { fontSize: 12.5, letterSpacing: '0.07em', color: `${C.text}66`, textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" } }, label),
        React.createElement("div", { style: { display: 'flex', marginTop: 10 } },
            React.createElement("div", { style: { flex: 1, textAlign: 'center' } },
                React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 500, color: C.accent } }, rightValue),
                React.createElement("div", { style: { fontSize: 11.5, color: `${C.text}66`, marginTop: 4 } }, rightSub)),
            React.createElement("div", { style: { width: 1, background: `${C.text}18`, margin: '2px 12px' } }),
            React.createElement("div", { style: { flex: 1, textAlign: 'center' } },
                React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 500, color: C.accent } }, leftValue),
                React.createElement("div", { style: { fontSize: 11.5, color: `${C.text}66`, marginTop: 4 } }, leftSub))),
        sub && React.createElement("div", { style: { fontSize: 13, color: `${C.text}77`, marginTop: 6 } }, sub)));
    const sectionLabel = (txt) => (React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, letterSpacing: '0.08em', color: `${C.text}77`, textTransform: 'uppercase', marginBottom: 10, marginTop: 2 } }, txt));
    if (loading) {
        const sk = (h, w, x = {}) => React.createElement("div", { className: "sk", style: Object.assign({ height: h, width: w || '100%' }, x) });
        return (React.createElement("div", { dir: "rtl", style: { minHeight: '100vh', background: DEFAULT_THEME.bg, padding: '76px 20px 40px' } },
            React.createElement("div", { style: { maxWidth: 1180, margin: '0 auto' } },
                React.createElement("div", { style: { display: 'flex', gap: 14, alignItems: 'center', marginBottom: 36 } }, sk(38, 38, { borderRadius: 11 }),
                    React.createElement("div", { style: { flex: 1, display: 'grid', gap: 10 } }, sk(12, 120), sk(24, 220))),
                React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 } },
                    [0, 1, 2, 3].map(i => React.createElement("div", { key: i, className: "sk-card" }, sk(11, '50%'), sk(24, '70%', { marginTop: 12 }), sk(10, '40%', { marginTop: 10 })))),
                React.createElement("div", { className: "sk-card" }, sk(12, '30%'), sk(200, '100%', { marginTop: 18 })))));
    }
    if (showNamePrompt) {
        return (React.createElement("div", { dir: "rtl", style: {
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                fontFamily: "'Vazirmatn', 'Inter', sans-serif", color: DEFAULT_THEME.text,
                background: `radial-gradient(ellipse 900px 500px at 15% -5%, ${DEFAULT_THEME.accent}22, transparent 60%), ${DEFAULT_THEME.bg}`,
            } },
            React.createElement("div", { className: "modal-panel", style: { background: DEFAULT_THEME.bgCard, border: `1px solid ${DEFAULT_THEME.text}18`, borderRadius: 18, padding: 34, width: '100%', maxWidth: 420, textAlign: 'center' } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'center', marginBottom: 18 } },
                    React.createElement(Logo, { accent: DEFAULT_THEME.accent, size: 46 })),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 700, marginBottom: 8 } }, "\u0628\u0647 \u0698\u0648\u0631\u0646\u0627\u0644 \u0645\u0639\u0627\u0645\u0644\u0627\u062A\u06CC \u062E\u0648\u0634 \u0627\u0648\u0645\u062F\u06CC"),
                React.createElement("div", { style: { fontSize: 14, color: `${DEFAULT_THEME.text}88`, marginBottom: 24, lineHeight: 1.8 } }, "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646\u06A9\u0647 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0645\u062E\u0635\u0648\u0635 \u062E\u0648\u062F\u062A \u0628\u0627\u0634\u0647\u060C \u0627\u0648\u0644 \u0627\u0633\u0645\u062A \u0631\u0648 \u0648\u0627\u0631\u062F \u06A9\u0646. \u0627\u06CC\u0646 \u0641\u0642\u0637 \u0647\u0645\u06CC\u0646 \u06CC\u06A9 \u0628\u0627\u0631 \u067E\u0631\u0633\u06CC\u062F\u0647 \u0645\u06CC\u200C\u0634\u0647."),
                React.createElement("input", { autoFocus: true, placeholder: "\u0645\u062B\u0644\u0627\u064B \u0639\u0644\u06CC \u0631\u0636\u0627\u06CC\u06CC", value: nameInput, onChange: e => setNameInput(e.target.value), onKeyDown: e => e.key === 'Enter' && saveName(), style: { width: '100%', background: DEFAULT_THEME.bg, border: `1px solid ${DEFAULT_THEME.text}22`, borderRadius: 10, padding: '13px 16px', color: DEFAULT_THEME.text, fontSize: 15, textAlign: 'center', marginBottom: 18 } }),
                React.createElement("button", { onClick: saveName, disabled: !nameInput.trim(), style: { width: '100%', background: DEFAULT_THEME.accent, color: DEFAULT_THEME.bg, border: 'none', borderRadius: 10, padding: '13px', fontWeight: 700, fontSize: 14, cursor: nameInput.trim() ? 'pointer' : 'not-allowed', opacity: nameInput.trim() ? 1 : 0.5 } }, "\u0634\u0631\u0648\u0639 \u06A9\u0646"))));
    }
    return (React.createElement("div", { dir: "rtl", className: "app-shell ui-" + (C.ui || 'clay') + (lumOf(C.bg) > 0.6 ? ' is-light' : ''), style: {
            minHeight: '100vh', color: C.text,
            '--card-color': C.bgCard, '--accent-color': C.accent, '--fx-bg': C.bg, '--fx-text': C.text, '--fx-pos': C.positive, '--fx-neg': C.negative, '--nav-color': C.navColor, fontFamily: "'Vazirmatn', 'Inter', sans-serif", transition: 'background .3s, color .3s',
            background: `
        radial-gradient(ellipse 900px 500px at 15% -5%, ${C.accent}22, transparent 60%),
        radial-gradient(ellipse 700px 500px at 100% 20%, ${C.positive}14, transparent 55%),
        radial-gradient(ellipse 800px 600px at 50% 110%, ${C.accent}12, transparent 60%),
        ${C.bg}`,
            backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%',
        } },
        React.createElement("button", { className: "hamburger no-print", "aria-label": "\u0645\u0646\u0648\u06CC \u0627\u0635\u0644\u06CC", "aria-expanded": showDrawer, onClick: () => setShowDrawer(v => !v) },
            React.createElement("span", null),
            React.createElement("span", null),
            React.createElement("span", null)),
        React.createElement("div", { className: `drawer-backdrop no-print ${showDrawer ? 'open' : ''}`, onClick: () => setShowDrawer(false) }),
        React.createElement("aside", { className: `drawer no-print ${showDrawer ? 'open' : ''}`, "aria-hidden": !showDrawer },
            React.createElement("div", { className: "drawer-head" },
                React.createElement(Logo, { accent: C.accent, size: 38 }),
                React.createElement("div", null,
                    React.createElement("div", { className: "drawer-title" }, "\u0698\u0648\u0631\u0646\u0627\u0644 \u0645\u0639\u0627\u0645\u0644\u0627\u062A\u06CC"),
                    React.createElement("div", { className: "drawer-sub" }, userName || 'معامله‌گر'))),
            React.createElement("div", { className: "drawer-field" },
                React.createElement("label", null, "\u062D\u0633\u0627\u0628 \u0641\u0639\u0627\u0644"),
                React.createElement("select", { value: activeAccountId, onChange: e => switchAccount(e.target.value) }, accounts.map(a => React.createElement("option", { key: a.id, value: a.id }, a.name)))),
            React.createElement("button", { className: "drawer-item", style: { '--i': 0 }, onClick: () => { setShowDrawer(false); setModal('accounts'); } }, React.createElement("span", { style: { fontSize: 17 } }, "🗂"), React.createElement("span", null, "حساب‌ها و قوانین پلن")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 0 }, onClick: () => { setShowDrawer(false); setModal('exports'); } }, React.createElement("span", { style: { fontSize: 17 } }, "📤"), React.createElement("span", null, "خروجی‌ها و کارت عملکرد")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 0 }, onClick: () => { setShowDrawer(false); setModal('profile'); } }, React.createElement(ProfileAvatar, { size: 26, accent: C.accent, name: userName }), React.createElement("span", null, "پروفایل من")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 1 }, onClick: () => { setShowDrawer(false); setModal('appearance'); } }, React.createElement(Palette, { size: 19 }), React.createElement("span", null, "ظاهر، طرح و رنگ‌ها")),
            React.createElement("div", { className: "drawer-group" }, "\u0645\u0639\u0627\u0645\u0644\u0627\u062A"),
            React.createElement("button", { className: "drawer-item", style: { '--i': 4 }, onClick: () => { setShowDrawer(false); if (lockedNew()) return; setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); } },
                React.createElement("svg", { width: "19", height: "19", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" },
                    React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
                React.createElement("span", null, "\u062B\u0628\u062A \u0645\u0639\u0627\u0645\u0644\u0647 \u062C\u062F\u06CC\u062F")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 5 }, onClick: () => { setShowDrawer(false); setTimeout(() => window.print(), 450); } },
                React.createElement(FileText, { size: 19 }),
                React.createElement("span", null, "\u0686\u0627\u067E \u06CC\u0627 \u0630\u062E\u06CC\u0631\u0647\u200C\u06CC \u06AF\u0632\u0627\u0631\u0634")),
            React.createElement("div", { className: "drawer-group" }, "\u062D\u0633\u0627\u0628\u200C\u0647\u0627 \u0648 \u062F\u0627\u062F\u0647"),
            React.createElement("button", { className: "drawer-item", style: { '--i': 6 }, onClick: () => { setShowDrawer(false); setShowControls(true); setShowAccountManager(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
                React.createElement(Layers, { size: 19 }),
                React.createElement("span", null, "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062D\u0633\u0627\u0628\u200C\u0647\u0627")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 8 }, onClick: () => { setShowDrawer(false); exportData(); } },
                React.createElement(Download, { size: 19 }),
                React.createElement("span", null, "\u062F\u0631\u06CC\u0627\u0641\u062A \u0628\u06A9\u200C\u0622\u067E")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 9 }, onClick: () => { var _a; setShowDrawer(false); (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); } },
                React.createElement(Upload, { size: 19 }),
                React.createElement("span", null, "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0627\u0632 \u0628\u06A9\u200C\u0622\u067E")),
            React.createElement("div", { className: "drawer-group" }, "\u0627\u0628\u0632\u0627\u0631\u0647\u0627"),
            React.createElement("button", { className: "drawer-item", style: { '--i': 10 }, onClick: () => { setShowDrawer(false); setModal('calc'); } },
                React.createElement(Target, { size: 19 }),
                React.createElement("span", null, "\u0645\u0627\u0634\u06CC\u0646\u200C\u062D\u0633\u0627\u0628 \u062D\u062C\u0645 \u0645\u0639\u0627\u0645\u0644\u0647")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 12 }, onClick: () => { setShowDrawer(false); setModal('help'); } },
                React.createElement(AlertTriangle, { size: 19 }),
                React.createElement("span", null, "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 12 }, onClick: () => { setShowDrawer(false); setModal('legal'); } },
                React.createElement(FileText, { size: 19 }),
                React.createElement("span", null, "قوانین و حریم خصوصی")),
            React.createElement("a", { className: "drawer-item", href: "blog.html", target: "_blank", rel: "noopener", style: { '--i': 13, textDecoration: 'none', color: 'inherit' } },
                React.createElement(FileText, { size: 19 }),
                React.createElement("span", null, "وبلاگ و آموزش")),
            React.createElement("div", { className: "drawer-group" }, "\u0634\u062E\u0635\u06CC\u200C\u0633\u0627\u0632\u06CC"),
            React.createElement("div", { className: "drawer-group" },
                "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC (",
                userName || user.name,
                ")"),
            React.createElement("button", { className: "drawer-item", style: { '--i': 13 }, onClick: () => { setShowDrawer(false); setModal('sub'); } },
                React.createElement("span", { style: { fontSize: 17 } }, "💳"),
                React.createElement("span", null, "اشتراک و پرداخت")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 14 }, onClick: () => { setShowDrawer(false); setModal('pass'); } },
                React.createElement(LockIcon, { size: 19 }),
                React.createElement("span", null, "\u062A\u063A\u06CC\u06CC\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 15 }, onClick: () => { setShowDrawer(false); clearTrades(); } },
                React.createElement(RotateCcw, { size: 19 }),
                React.createElement("span", null, "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628")),
            React.createElement("button", { className: "drawer-item", style: { '--i': 16 }, onClick: () => { setShowDrawer(false); onLogout(); } },
                React.createElement(X, { size: 19 }),
                React.createElement("span", null, "\u062E\u0631\u0648\u062C \u0627\u0632 \u062D\u0633\u0627\u0628"))),
        modal === 'profile' && React.createElement(ProfileModal, { C: C, user: user, userName: userName, setUserName: setUserName, stats: stats, trades: activeTrades, balance: activeBalance, onClose: () => setModal(null), onAppearance: () => setModal('appearance'), onPass: () => setModal('pass'), sub: subx, onSub: () => setModal('sub'), onBackup: exportData, onLogout: onLogout }),
        modal === 'appearance' && React.createElement(Modal, { title: "ظاهر، طرح و رنگ‌ها", onClose: () => setModal(null) }, React.createElement(PersonalizationPanel, { theme: C, updateTheme: updateTheme, resetTheme: resetTheme })),
        modal === 'calc' && React.createElement(Modal, { title: "\u0645\u0627\u0634\u06CC\u0646\u200C\u062D\u0633\u0627\u0628 \u062D\u062C\u0645 \u0645\u0639\u0627\u0645\u0644\u0647", onClose: () => setModal(null) },
            React.createElement(RiskCalc, { balance: balance })),
        modal === 'pass' && React.createElement(Modal, { title: "\u062A\u063A\u06CC\u06CC\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631", onClose: () => setModal(null) },
            React.createElement(ChangePass, { user: user, onDone: () => { setModal(null); showToast('رمز عبور تغییر کرد', 'good'); } })),
        locked && modal !== 'sub' && React.createElement("button", { type: 'button', className: 'no-print', onClick: () => setModal('sub'), style: { position: 'fixed', left: 12, right: 12, bottom: 96, zIndex: 60, border: 0, borderRadius: 14, padding: '11px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: C.accent, color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.28)' } }, 'اشتراکت تمام شده؛ برای ثبت معامله‌ی جدید، تمدید کن ←'),
        modal === 'exports' && React.createElement(Modal, { title: "خروجی‌ها و کارت عملکرد", onClose: () => setModal(null) },
            React.createElement(ExportHub, { C: C, accounts: accounts, trades: trades, activeAccountId: activeAccountId, onToast: showToast })),
        modal === 'accounts' && React.createElement(Modal, { title: "حساب‌ها و قوانین پلن", onClose: () => setModal(null) },
            React.createElement(AccountsHub, { C: C, accounts: accounts, trades: trades, activeAccountId: activeAccountId, onSwitch: switchAccount, onUpdate: updateAccount, onDelete: deleteAccount, onAdd: addAccount, newName: newAccountName, setNewName: setNewAccountName, subx: subx, onOpenSub: () => setModal('sub') })),
        modal === 'sub' && React.createElement(Modal, { title: "اشتراک و پرداخت", onClose: () => setModal(null) },
            React.createElement(SubBody, { onLegal: () => setModal('legal'), sub: subx, onPaid: () => { loadSub(); showToast('اشتراک فعال شد ✅', 'good'); } })),
        modal === 'legal' && React.createElement(Modal, { title: "قوانین و حریم خصوصی", onClose: () => setModal(null) },
            React.createElement(LegalBody, null)),
        modal === 'help' && React.createElement(Modal, { title: "\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647", onClose: () => setModal(null) },
            React.createElement(HelpBody, null)),
        React.createElement("div", { style: { maxWidth: 1180, margin: '0 auto', padding: '14px 14px 0' } },
            React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, overflow: 'hidden', marginRight: showControls ? 0 : 60, marginTop: showControls ? 56 : 0, transition: 'margin .3s ease' } },
                React.createElement("button", { onClick: () => setShowControls(v => !v), style: {
                        width: '100%', background: 'transparent', border: 'none', color: C.text,
                        padding: '0 14px', minHeight: 44, cursor: 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, fontWeight: 700
                    } },
                    React.createElement("span", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                        React.createElement("span", { className: "icon-float" }, "\u2699\uFE0F"),
                        " \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u062D\u0633\u0627\u0628\u200C\u0647\u0627"),
                    React.createElement("span", { style: { transform: showControls ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' } }, "\u25BC")),
                showControls && (React.createElement("div", { className: "dropdown-open", style: { padding: '0 18px 18px', borderTop: `1px solid ${C.text}18` } },
                    React.createElement("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', paddingTop: 14, marginBottom: 14 } },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                            React.createElement("span", { style: { fontSize: 13, color: `${C.text}77` } }, "\u062D\u0633\u0627\u0628 \u0641\u0639\u0627\u0644:"),
                            React.createElement("select", { value: activeAccountId, onChange: e => switchAccount(e.target.value), style: { background: C.bg, border: `1px solid ${C.accent}44`, color: C.text, borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit' } }, accounts.map(a => React.createElement("option", { key: a.id, value: a.id }, a.name)))),
                        React.createElement("button", { onClick: () => setShowAccountManager(v => !v), className: "ripple-btn", style: { background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}35`, borderRadius: 8, padding: '8px 11px', cursor: 'pointer' } },
                            React.createElement("span", { className: "icon-spin" }, "\u2699\uFE0F"),
                            " \u0645\u062F\u06CC\u0631\u06CC\u062A \u062D\u0633\u0627\u0628\u200C\u0647\u0627")),
                    showAccountManager && (React.createElement("div", { className: "dropdown-open", style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 } },
                        React.createElement("input", { value: newAccountName, onChange: e => setNewAccountName(e.target.value), placeholder: "\u0646\u0627\u0645 \u062D\u0633\u0627\u0628 \u062C\u062F\u06CC\u062F", style: { background: C.bg, border: `1px solid ${C.text}20`, color: C.text, borderRadius: 8, padding: '8px 10px' } }),
                        React.createElement("button", { onClick: addAccount, className: "ripple-btn", style: { background: C.accent, color: C.bg, border: 0, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' } },
                            React.createElement("span", { className: "icon-bounce" }, "+"),
                            " \u0627\u0641\u0632\u0648\u062F\u0646 \u062D\u0633\u0627\u0628"),
                        React.createElement("button", { onClick: () => updateActiveAccountBalance(prompt('موجودی اولیه/فعلی حساب', String(activeBalance))), className: "ripple-btn", style: { background: `${C.text}10`, color: C.text, border: `1px solid ${C.text}20`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' } },
                            React.createElement("span", { className: "icon-float" }, "\uD83D\uDCB0"),
                            " \u0645\u0648\u062C\u0648\u062F\u06CC: ",
                            fmt(activeBalance, 2),
                            "$"),
                        accounts.length > 1 && React.createElement("button", { onClick: () => deleteAccount(activeAccountId), className: "ripple-btn", style: { background: `${C.negative}14`, color: C.negative, border: `1px solid ${C.negative}30`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' } },
                            React.createElement("span", { className: "icon-pulse" }, "\uD83D\uDDD1\uFE0F"),
                            " \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0641\u0639\u0627\u0644"))),
                    React.createElement("div", { style: { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.text}14` } },
                        React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: C.accent } },
                            React.createElement("span", { className: "icon-pulse" }, "\uD83D\uDCC8"),
                            " PIPS ",
                            React.createElement("b", null,
                                totalPips >= 0 ? '+' : '',
                                fmt(totalPips, 1)),
                            " \u00B7 R ",
                            React.createElement("b", null,
                                rAdvanced.cumulativeR >= 0 ? '+' : '',
                                fmt(rAdvanced.cumulativeR, 2),
                                "R"))))))),
        toast && (React.createElement("div", { className: "toast-anim" + (toast.leaving ? " leaving" : ""), style: {
                position: 'fixed', top: 20, left: 0, right: 0, margin: '0 auto', width: 'fit-content', zIndex: 500,
                background: C.bgCard, border: `1px solid ${toast.tone === 'good' ? C.positive : toast.tone === 'bad' ? C.negative : C.text}55`,
                color: C.text, padding: '13px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                boxShadow: '0 12px 30px rgba(0,0,0,0.4)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', gap: 8, maxWidth: '90vw',
            } },
            React.createElement("span", null, toast.tone === 'good' ? '✅' : toast.tone === 'bad' ? '⚠️' : 'ℹ️'),
            React.createElement("span", null, toast.msg))),
        React.createElement("div", { style: { maxWidth: 1180, margin: '0 auto', padding: '14px 16px 150px' } },
            React.createElement("div", { className: "hero-in", style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 16 } },
                    React.createElement(Logo, { accent: C.accent }),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, letterSpacing: '0.09em', color: C.accent, textTransform: 'uppercase', marginBottom: 10 } },
                            React.createElement("span", { className: "icon-glow" }, "\u2726"),
                            " ",
                            React.createElement("b", { style: { textTransform: 'none', letterSpacing: '.01em', fontSize: 15, fontWeight: 800, color: C.text } }, "Trad", React.createElement("i", { style: { fontStyle: 'normal', color: C.accent } }, "yar"))),
                        React.createElement("h1", { style: { fontSize: 30, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                            React.createElement("span", { className: "animate-float" }, "\uD83D\uDCCA"),
                            " \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0639\u0645\u0644\u06A9\u0631\u062F",
                            React.createElement("span", { className: "dashboard-user-badge desktop-user-badge", style: { fontSize: 13.5, fontWeight: 600, color: C.text } },
                                "\u2014 ",
                                userName || 'معامله‌گر',
                                " ",
                                React.createElement(SyncBadge, { C: C, onLocked: () => setModal('sub') }))))),
                React.createElement("div", { className: "mobile-user-badge", "aria-label": "\u0648\u0636\u0639\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631" },
                    React.createElement("span", { className: "mobile-user-name" },
                        "\u2014 ",
                        userName || 'معامله‌گر'),
                    React.createElement("span", { className: "mobile-user-online" },
                        React.createElement(SyncBadge, { C: C, onLocked: () => setModal('sub') }))),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement("button", { onClick: exportData, className: "icon-badge no-print", style: { background: C.bgCard, border: `1px solid ${C.text}14`, borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } },
                        React.createElement("span", { className: "icon-float" },
                            React.createElement(Download, { size: 16, color: C.text }))),
                    React.createElement("button", { onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "icon-badge no-print", style: { background: C.bgCard, border: `1px solid ${C.text}14`, borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } },
                        React.createElement("span", { className: "icon-bounce" },
                            React.createElement(Upload, { size: 16, color: C.text }))),
                    React.createElement("input", { ref: fileInputRef, type: "file", accept: "*/*", onChange: importData, style: { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' } }),
                    React.createElement("button", { type: "button", onClick: () => setModal('profile'), className: "no-print", "aria-label": "پروفایل", style: { background: 'none', border: 0, padding: 0, cursor: 'pointer', borderRadius: '50%' } }, React.createElement(ProfileAvatar, { accent: C.accent, name: userName })),
                    React.createElement("div", { style: { position: 'relative' }, ref: menuRef },
                        React.createElement("button", { onClick: (e) => { setShowMenu(v => !v); createRipple(e, `${C.accent}55`); }, className: "icon-badge ripple-btn", style: { background: C.bgCard, border: `1px solid ${C.text}14`, borderRadius: 10, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' } },
                            React.createElement("span", { className: "icon-spin" },
                                React.createElement(MoreVertical, { size: 18, color: C.text }))),
                        showMenu && (React.createElement("div", { style: { position: 'absolute', left: 0, top: 50, width: 340, background: C.bgCard, border: `1px solid ${C.text}18`, borderRadius: 14, padding: 22, zIndex: 200, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' } },
                            React.createElement("div", { style: { fontSize: 13, color: `${C.text}88`, marginBottom: 8 } }, "نام کاربری"),
                            React.createElement("div", { style: { display: 'flex', gap: 8, marginBottom: 20 } },
                                React.createElement("input", { value: userName, onChange: e => setUserName(e.target.value), onBlur: () => { const n = userName.trim(); if (n)
                                        storage.set('journal-username', n); }, style: { flex: 1, background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14 } })),
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 } },
                                React.createElement("span", { className: "icon-pulse" },
                                    React.createElement(AlertTriangle, { size: 15, color: C.accent })),
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, "\u0647\u0634\u062F\u0627\u0631\u0647\u0627")),
                            React.createElement("label", { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: `${C.text}aa`, marginBottom: 18 } },
                                React.createElement("input", { type: "checkbox", checked: showAlerts, onChange: e => { setShowAlerts(e.target.checked); storage.set('journal-alerts', JSON.stringify(e.target.checked)); } }),
                                "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0647\u0634\u062F\u0627\u0631 \u0628\u0631\u0627\u06CC \u0628\u0627\u062E\u062A\u200C\u0647\u0627\u06CC \u0645\u062A\u0648\u0627\u0644\u06CC \u0648 \u0636\u0631\u0631\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF"),
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 } },
                                React.createElement("span", { className: "icon-glow" },
                                    React.createElement(Palette, { size: 15, color: C.accent })),
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, "\u0634\u062E\u0635\u06CC\u200C\u0633\u0627\u0632\u06CC \u0638\u0627\u0647\u0631"),
                                React.createElement("span", { style: { fontSize: 11.5, color: `${C.text}33`, marginRight: 'auto' } }, "\u0630\u062E\u06CC\u0631\u0647 \u062E\u0648\u062F\u06A9\u0627\u0631")),
                            React.createElement(PersonalizationPanel, { theme: C, updateTheme: updateTheme, resetTheme: resetTheme }),
                            (SUPPORT_WA || SUPPORT_IG) && React.createElement("div", { style: { borderTop: `1px solid ${C.text}14`, marginTop: 16, paddingTop: 16 } },
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 4 } }, "پشتیبانی و ارتباط با ما"),
                                React.createElement("div", { style: { fontSize: 11.5, color: `${C.text}77`, lineHeight: 1.8, marginBottom: 10 } }, "سؤال، پیشنهاد یا مشکل پرداخت داری؟ از اینجا پیام بده."),
                                React.createElement(SupportLinks, null)),
                            React.createElement("div", { style: { borderTop: `1px solid ${C.text}14`, marginTop: 16, paddingTop: 16 } },
                                React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}55`, textAlign: 'center' } },
                                    React.createElement("span", { className: "icon-breathe" }, trades.length),
                                    " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 ",
                                    React.createElement("span", { className: "icon-pulse", style: { color: C.positive } }, stats.wins),
                                    " \u0628\u0631\u062F \u00B7 ",
                                    React.createElement("span", { className: "icon-pulse", style: { color: C.negative } }, stats.losses),
                                    " \u0628\u0627\u062E\u062A"))))))),
            activeTrades.length === 0 && React.createElement("div", { className: "glass-effect no-print", style: { borderRadius: 16, padding: '18px 18px 16px', marginBottom: 16, border: `1px solid ${C.accent}44`, display: 'flex', flexDirection: 'column', gap: 10 } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800 } }, "ژورنالت هنوز خالی است"),
                React.createElement("div", { style: { fontSize: 13, color: `${C.text}99`, lineHeight: 1.9 } }, "اولین معامله‌ات را ثبت کن؛ با همان یک معامله سود و زیان، R و آمار شروع می‌شود. ثبتش کمتر از یک دقیقه طول می‌کشد."),
                React.createElement("button", { type: "button", onClick: (e) => { if (lockedNew()) return; setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); createRipple(e, 'rgba(255,255,255,0.4)'); }, style: { alignSelf: 'flex-start', background: C.accent, color: C.bg, border: 0, borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' } }, "ثبت اولین معامله")),
            page === 0 && (React.createElement("div", { key: page, className: "page-fade" },
                React.createElement("div", { className: "subnav no-print", role: "tablist" }, SUBS[page].map((lb, i) => React.createElement("button", { key: i, role: "tab", "aria-selected": sub === i, className: sub === i ? 'act' : '', onClick: () => { setSubs(p => ({ ...p, [page]: i })); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, lb))),
                sub === 0 && (React.createElement(React.Fragment, null,
                    sectionLabel('💰 موجودی اولیه حساب'),
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2px 12px', flexWrap: 'wrap' } },
                        React.createElement("span", { style: { fontSize: 12.5, color: `${C.text}99` } }, "\u0645\u0639\u0627\u0645\u0644\u0647 \u0645\u06CC\u200C\u06A9\u0646\u0645 \u0628\u0627 \u0645\u0648\u062C\u0648\u062F\u06CC \u0627\u0648\u0644\u06CC\u0647:"),
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                            React.createElement("span", { className: "icon-float", style: { fontFamily: "'IBM Plex Mono', monospace", color: C.accent, fontSize: 16 } }, "$"),
                            React.createElement("input", { type: "text", inputMode: "decimal", value: balanceText, onChange: e => onBalanceTextChange(e.target.value), onBlur: onBalanceBlur, style: { width: 92, background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 8, padding: '5px 10px', color: C.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 } })),
                        React.createElement("span", { style: { fontSize: 10.5, flexBasis: '100%', color: `${C.text}55` } }, "\u062F\u0631\u0635\u062F\u0647\u0627\u06CC \u0633\u0648\u062F \u0648 \u0632\u06CC\u0627\u0646 \u0628\u0631 \u0647\u0645\u06CC\u0646 \u0627\u0633\u0627\u0633 \u0645\u062D\u0627\u0633\u0628\u0647 \u0645\u06CC\u200C\u0634\u0646")),
                    propSt && React.createElement(PropAlert, { C: C, st: propSt, rules: activeRules }),
                    React.createElement(KpiBoard, { C: C, stats: stats, rStats: rStats, equityCurve: equityCurve, trades: activeTrades, netPnlAnimated: netPnlAnimated, balance: activeBalance }))),

                sub === 1 && (React.createElement(React.Fragment, null,
                    sectionLabel('📊 تحلیل بر اساس R (هر R = ۱٪ از موجودی)'),
                    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 } },
                        React.createElement(StatCard, { label: "\uD83D\uDCCA \u0645\u062C\u0645\u0648\u0639 R", value: `${rStats.totalR >= 0 ? '+' : ''}${fmt(rStats.totalR, 2)}R`, tone: rStats.totalR >= 0 ? 'good' : 'bad', sub: riskUnit ? 'بر اساس ریسک ثبت‌شده‌ی هر معامله' : 'موجودی را وارد کن' }),
                        React.createElement(StatCard, { label: "\uD83D\uDCC8 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 R \u0628\u0631\u062F\u0647\u0627", value: `+${fmt(rStats.avgWinR, 2)}R`, tone: "good" }),
                        React.createElement(StatCard, { label: "\uD83D\uDCC9 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 R \u0628\u0627\u062E\u062A\u200C\u0647\u0627", value: `-${fmt(rStats.avgLossR, 2)}R`, tone: "bad" }),
                        React.createElement(StatCard, { label: "\u2696\uFE0F \u0631\u06CC\u0633\u06A9 \u0628\u0647 \u0631\u06CC\u0648\u0627\u0631\u062F \u06A9\u0644\u06CC", value: rStats.rr === Infinity ? '∞' : `۱ : ${fmt(rStats.rr, 2)}`, sub: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 R \u0628\u0631\u062F \u00F7 \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 R \u0628\u0627\u062E\u062A" })),
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '18px 18px', marginBottom: 20 } },
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 } },
                            React.createElement("div", { style: { fontSize: 14, fontWeight: 700 } }, "\uD83D\uDCC8 R \u067E\u06CC\u0634\u0631\u0641\u062A\u0647"),
                            React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: `${C.text}66` } },
                                React.createElement("span", { className: "icon-float" }, "\uD83D\uDCCA"),
                                " Expectancy ",
                                fmt(rAdvanced.expectancy, 2),
                                "R \u00B7 Payoff ",
                                fmt(rAdvanced.payoff, 2),
                                " \u00B7 Max DD ",
                                fmt(rAdvanced.maxDrawdownR, 2),
                                "R")),
                        React.createElement("div", { style: { fontSize: 13, color: `${C.text}66`, marginBottom: 22 } }, "\u062E\u0637 \u0646\u0627\u0631\u0646\u062C\u06CC = R \u062A\u062C\u0645\u0639\u06CC\u061B \u0645\u06CC\u0644\u0647\u200C\u0647\u0627 = R \u0647\u0631 \u0645\u0639\u0627\u0645\u0644\u0647. \u0628\u0631\u0627\u06CC \u0628\u0631\u0631\u0633\u06CC \u06A9\u06CC\u0641\u06CC\u062A \u0631\u06CC\u0633\u06A9\u060C \u0646\u0647 \u0641\u0642\u0637 \u062F\u0644\u0627\u0631."),
                        rAdvanced.rows.length ? React.createElement(ResponsiveContainer, { width: "100%", height: 260 },
                            React.createElement(ComposedChart, { data: rAdvanced.rows, margin: { top: 10, right: 10, left: -10, bottom: 0 } },
                                React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}45`, tick: { fontSize: 10.5 } }),
                                React.createElement(YAxis, { stroke: `${C.text}45`, tick: { fontSize: 10.5 } }),
                                React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}35`, strokeDasharray: "4 4" }),
                                React.createElement(Tooltip, { content: ({ active, payload, label }) => active && (payload === null || payload === void 0 ? void 0 : payload.length) ? React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '9px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 } },
                                        React.createElement("div", null, label),
                                        payload.map((x, i) => React.createElement("div", { key: i, style: { color: x.dataKey === 'r' ? (x.value >= 0 ? C.positive : C.negative) : C.accent } },
                                            x.dataKey === 'r' ? 'R معامله' : 'R تجمعی',
                                            ": ",
                                            fmt(x.value, 2),
                                            "R"))) : null }),
                                React.createElement(Bar, { dataKey: "r", radius: [4, 4, 0, 0] }, rAdvanced.rows.map((x, i) => React.createElement(Cell, { key: i, fill: x.r >= 0 ? C.positive : C.negative }))),
                                React.createElement(Line, { type: "monotone", dataKey: "cumulativeR", stroke: C.accent, strokeWidth: 2.5, dot: false, isAnimationActive: true, animationDuration: 900 }))) : React.createElement("div", { style: { padding: 25, color: `${C.text}55` } }, "\u0628\u0631\u0627\u06CC \u0646\u0645\u0648\u062F\u0627\u0631 R \u0645\u0639\u0627\u0645\u0644\u0647 \u062B\u0628\u062A \u06A9\u0646.")))),
                sub === 0 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '18px 18px', marginBottom: 20 } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 700, marginBottom: 20 } }, "\uD83D\uDCCC \u0633\u0648\u062F \u0648 \u0633\u0648\u062F \u06A9\u0644\u06CC \u0628\u0647 \u067E\u06CC\u067E"),
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 } },
                            React.createElement(StatCard, { label: "\uD83D\uDCCA \u067E\u06CC\u067E \u062E\u0627\u0644\u0635", value: `${totalPips >= 0 ? '+' : ''}${fmt(totalPips, 1)} pip`, tone: totalPips >= 0 ? 'good' : 'bad' }),
                            React.createElement(StatCard, { label: "\uD83D\uDCB0 \u0633\u0648\u062F \u062F\u0644\u0627\u0631\u06CC \u062E\u0627\u0644\u0635", value: `${stats.netPnl >= 0 ? '+' : ''}${fmt(stats.netPnl, 2)}$`, tone: stats.netPnl >= 0 ? 'good' : 'bad' }),
                            React.createElement(StatCard, { label: "\uD83D\uDCCB \u062A\u0639\u062F\u0627\u062F \u0645\u0639\u0627\u0645\u0644\u0627\u062A", value: stats.total }))),
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '16px 18px', marginBottom: 20 } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 8 } }, "\uD83D\uDCCA \u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0639\u0627\u0645\u0644\u0627\u062A\u06CC (\u06A9\u0627\u0631\u0645\u0632\u062F + \u0633\u0648\u0622\u067E)"),
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 } },
                            React.createElement("div", null,
                                React.createElement("span", { style: { color: `${C.text}66` } }, "\u0645\u062C\u0645\u0648\u0639 \u06A9\u0627\u0631\u0645\u0632\u062F:"),
                                " ",
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: C.negative } },
                                    fmt(stats.totalCommission),
                                    "$")),
                            React.createElement("div", null,
                                React.createElement("span", { style: { color: `${C.text}66` } }, "\u0645\u062C\u0645\u0648\u0639 \u0633\u0648\u0622\u067E:"),
                                " ",
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: stats.totalSwap >= 0 ? C.positive : C.negative } },
                                    stats.totalSwap >= 0 ? '+' : '',
                                    fmt(stats.totalSwap),
                                    "$")),
                            React.createElement("div", null,
                                React.createElement("span", { style: { color: `${C.text}66` } }, "\u0645\u062C\u0645\u0648\u0639 \u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627:"),
                                " ",
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: C.negative } },
                                    fmt(stats.totalCommission + stats.totalSwap),
                                    "$")),
                            React.createElement("div", null,
                                React.createElement("span", { style: { color: `${C.text}66` } }, "\u062A\u0623\u062B\u06CC\u0631 \u0631\u0648\u06CC \u0633\u0648\u062F \u062E\u0627\u0644\u0635:"),
                                " ",
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: C.negative } },
                                    fmt(((stats.totalCommission + stats.totalSwap) / Math.max(1, Math.abs(stats.netPnl))) * 100, 1),
                                    "%")))))),
                sub === 2 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "ss-grid", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
                        React.createElement("div", null,
                            sectionLabel('📈 منحنی سرمایه (بر اساس شماره معامله)'),
                            React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '16px 14px 6px' } },
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 26, marginBottom: 6, flexWrap: 'wrap' } },
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.positive, marginTop: 2 } },
                                            fmt(equityPeak),
                                            "$")),
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u0641\u0639\u0644\u06CC"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.accent, marginTop: 2 } },
                                            equityCurrentAnimated >= 0 ? '+' : '',
                                            fmt(equityCurrentAnimated),
                                            "$")),
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u06A9\u0645\u062A\u0631\u06CC\u0646"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.negative, marginTop: 2 } },
                                            fmt(equityLow),
                                            "$"))),
                                React.createElement(ResponsiveContainer, { width: "100%", height: 280 },
                                    React.createElement(AreaChart, { data: equityCurve, margin: { top: 10, right: 14, left: -6, bottom: 0 } },
                                        React.createElement("defs", null,
                                            React.createElement("linearGradient", { id: "equityFill", x1: "0", y1: "0", x2: "0", y2: "1" },
                                                React.createElement("stop", { offset: "0%", stopColor: C.accent, stopOpacity: 0.38 }),
                                                React.createElement("stop", { offset: "100%", stopColor: C.accent, stopOpacity: 0 })),
                                            React.createElement("filter", { id: "equityGlow", x: "-40%", y: "-40%", width: "180%", height: "180%" },
                                                React.createElement("feGaussianBlur", { stdDeviation: "4", result: "blur" }),
                                                React.createElement("feMerge", null,
                                                    React.createElement("feMergeNode", { in: "blur" }),
                                                    React.createElement("feMergeNode", { in: "SourceGraphic" })))),
                                        React.createElement(CartesianGrid, { stroke: `${C.text}0a`, vertical: false }),
                                        React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}45`, tick: { fontSize: 11.5, fontFamily: 'IBM Plex Mono' }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                        React.createElement(YAxis, { stroke: `${C.text}45`, tick: { fontSize: 11.5, fontFamily: 'IBM Plex Mono' }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                        React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}35`, strokeDasharray: "4 4" }),
                                        React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null), cursor: { stroke: `${C.text}30`, strokeWidth: 1, strokeDasharray: '3 3' } }),
                                        React.createElement(Area, { type: "monotone", dataKey: "equity", stroke: C.accent, strokeWidth: 2.6, fill: "url(#equityFill)", style: { filter: 'url(#equityGlow)' }, dot: false, activeDot: { r: 5.5, fill: C.accent, stroke: C.bgCard, strokeWidth: 2.5 }, isAnimationActive: true, animationDuration: 900, animationEasing: "ease-out" }))))),
                        React.createElement("div", null,
                            sectionLabel('📅 منحنی سرمایه (بر اساس روز تقویمی)'),
                            React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '16px 14px 6px' } },
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: 26, marginBottom: 6, flexWrap: 'wrap' } },
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.positive, marginTop: 2 } },
                                            fmt(calendarEquityPeak),
                                            "$")),
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u0641\u0639\u0644\u06CC"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.accent, marginTop: 2 } },
                                            calendarEquityCurrentAnimated >= 0 ? '+' : '',
                                            fmt(calendarEquityCurrentAnimated),
                                            "$")),
                                    React.createElement("div", { style: { textAlign: 'left' } },
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' } }, "\u06A9\u0645\u062A\u0631\u06CC\u0646"),
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, color: C.negative, marginTop: 2 } },
                                            fmt(calendarEquityLow),
                                            "$"))),
                                calendarEquityCurve.length === 0 ? React.createElement("div", { style: { fontSize: 14, color: `${C.text}66`, padding: '30px 4px' } }, "\u0647\u0646\u0648\u0632 \u0645\u0639\u0627\u0645\u0644\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647.") : (React.createElement(ResponsiveContainer, { width: "100%", height: 280 },
                                    React.createElement(AreaChart, { data: calendarEquityCurve, margin: { top: 10, right: 14, left: -6, bottom: 0 } },
                                        React.createElement("defs", null,
                                            React.createElement("linearGradient", { id: "calEquityFill", x1: "0", y1: "0", x2: "0", y2: "1" },
                                                React.createElement("stop", { offset: "0%", stopColor: C.positive, stopOpacity: 0.35 }),
                                                React.createElement("stop", { offset: "100%", stopColor: C.positive, stopOpacity: 0 }))),
                                        React.createElement(CartesianGrid, { stroke: `${C.text}0a`, vertical: false }),
                                        React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}45`, tick: { fontSize: 10.5, fontFamily: 'IBM Plex Mono' }, axisLine: { stroke: `${C.text}18` }, tickLine: false, interval: "preserveStartEnd" }),
                                        React.createElement(YAxis, { stroke: `${C.text}45`, tick: { fontSize: 11.5, fontFamily: 'IBM Plex Mono' }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                        React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}35`, strokeDasharray: "4 4" }),
                                        React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null), cursor: { stroke: `${C.text}30`, strokeWidth: 1, strokeDasharray: '3 3' } }),
                                        React.createElement(Area, { type: "monotone", dataKey: "equity", stroke: C.positive, strokeWidth: 2.6, fill: "url(#calEquityFill)", dot: false, activeDot: { r: 5.5, fill: C.positive, stroke: C.bgCard, strokeWidth: 2.5 }, isAnimationActive: true, animationDuration: 900, animationEasing: "ease-out" })))),
                                React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}55`, marginTop: 4, textAlign: 'center' } }, "\u0631\u0648\u0632\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0645\u0639\u0627\u0645\u0644\u0647 \u0628\u0647 \u0635\u0648\u0631\u062A \u062E\u0637 \u0635\u0627\u0641 \u0646\u0634\u0648\u0646 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0646 \u2014 \u0634\u0646\u0628\u0647 \u0648 \u06CC\u06A9\u0634\u0646\u0628\u0647 \u0627\u0635\u0644\u0627\u064B \u062F\u0631 \u0646\u0645\u0648\u062F\u0627\u0631 \u0646\u06CC\u0633\u062A\u0646")))),
                    React.createElement("div", { className: "ss-grid", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 40 } },
                        emotionStats.length > 0 && (React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                            sectionLabel('😊 تحلیل احساسات'),
                            React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 28, marginTop: -10 } }, "\u0639\u0645\u0644\u06A9\u0631\u062F \u0647\u0631 \u062D\u0627\u0644\u062A \u0627\u062D\u0633\u0627\u0633\u06CC \u2014 \u06A9\u062F\u0648\u0645 \u062D\u0633 \u0628\u0631\u0627\u062A \u0633\u0648\u062F\u0622\u0648\u0631\u062A\u0631 \u0628\u0648\u062F\u0647\u061F"),
                            React.createElement(ResponsiveContainer, { width: "100%", height: 160 },
                                React.createElement(BarChart, { data: emotionStats, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                    React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                    React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 10.5 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                    React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 10.5 }, axisLine: false, tickLine: false }),
                                    React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                    React.createElement(Bar, { dataKey: "pnl", radius: [5, 5, 0, 0] }, emotionStats.map((e, i) => React.createElement(Cell, { key: i, fill: e.pnl >= 0 ? C.positive : C.negative }))))),
                            React.createElement("div", { style: { marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 } }, emotionStats.map(e => React.createElement("span", { key: e.name, style: { fontSize: 12.5, background: `${C.text}10`, padding: '4px 10px', borderRadius: 6 } },
                                React.createElement("span", { className: "icon-float" }, e.name),
                                " ",
                                e.count,
                                " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 ",
                                e.pnl >= 0 ? '+' : '',
                                fmt(e.pnl),
                                "$"))))),
                        hourlyStats.length > 0 && (React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                            sectionLabel('🕐 عملکرد ساعتی'),
                            React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 28, marginTop: -10 } }, "\u0633\u0648\u062F/\u0632\u06CC\u0627\u0646 \u062F\u0631 \u0647\u0631 \u0633\u0627\u0639\u062A \u0627\u0632 \u0631\u0648\u0632"),
                            React.createElement(ResponsiveContainer, { width: "100%", height: 160 },
                                React.createElement(BarChart, { data: hourlyStats, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                    React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                    React.createElement(XAxis, { dataKey: "hour", stroke: `${C.text}55`, tick: { fontSize: 8 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                    React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 10.5 }, axisLine: false, tickLine: false }),
                                    React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                    React.createElement(Bar, { dataKey: "pnl", radius: [5, 5, 0, 0] }, hourlyStats.map((e, i) => React.createElement(Cell, { key: i, fill: e.pnl >= 0 ? C.positive : C.negative })))))))),
                    sectionLabel('💡 پیشنهادهای هوشمند بر اساس معاملات تو'),
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '36px 32px', marginTop: 32 } }, insights.length === 0 ? React.createElement("div", { style: { fontSize: 14, color: `${C.text}66` } }, "\u0628\u0631\u0627\u06CC \u0627\u0631\u0627\u0626\u0647 \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u062F\u0642\u06CC\u0642\u060C \u062D\u062F\u0627\u0642\u0644 \u0628\u0647 \u06F5 \u0645\u0639\u0627\u0645\u0644\u0647 \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u06CC\u0645 \u2014 \u06A9\u0645\u06CC \u0628\u06CC\u0634\u062A\u0631 \u0645\u0639\u0627\u0645\u0644\u0647 \u062B\u0628\u062A \u06A9\u0646.") : (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 18 } }, insights.map((ins, i) => (React.createElement("div", { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: 18, padding: '14px 16px', background: `${ins.tone === 'good' ? C.positive : C.negative}0f`, border: `1px solid ${ins.tone === 'good' ? C.positive : C.negative}33`, borderRadius: 10 } },
                        React.createElement("span", { style: { fontSize: 16, lineHeight: '20px' } }, ins.tone === 'good' ? '💡' : '⚠️'),
                        React.createElement("span", { style: { fontSize: 14, lineHeight: 1.8, color: C.text } }, ins.text))))))))))),
            page === 1 && (React.createElement("div", { key: page, className: "page-fade" },
                React.createElement("div", { className: "subnav no-print", role: "tablist" }, SUBS[page].map((lb, i) => React.createElement("button", { key: i, role: "tab", "aria-selected": sub === i, className: sub === i ? 'act' : '', onClick: () => { setSubs(p => ({ ...p, [page]: i })); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, lb))),
                sub === 0 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "ss-grid", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '0 2px' } },
                        React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 } },
                                React.createElement("div", { className: "icon-badge", style: { width: 30, height: 30, borderRadius: 9, background: `linear-gradient(150deg, ${C.accent}30, ${C.accent}08)`, border: `1px solid ${C.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 1px 1px rgba(255,255,255,0.15)` } },
                                    React.createElement("span", { className: "icon-float" },
                                        React.createElement(Target, { size: 15, color: C.accent }))),
                                sectionLabel('🎯 عملکرد بر اساس سشن')),
                            bestSession && React.createElement("div", { style: { fontSize: 13.5, color: C.positive, marginBottom: 28 } },
                                "\u2726 \u0628\u0647\u062A\u0631\u06CC\u0646 \u0633\u0634\u0646: ",
                                React.createElement("strong", null, bestSession.name),
                                " (",
                                bestSession.netPnl >= 0 ? '+' : '',
                                fmt(bestSession.netPnl),
                                "$)"),
                            React.createElement(ResponsiveContainer, { width: "100%", height: 160 },
                                React.createElement(BarChart, { data: bySession, margin: { top: 5, right: 5, left: -20, bottom: 0 } },
                                    React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                    React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                    React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: false, tickLine: false }),
                                    React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                    React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, bySession.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                            React.createElement("div", { style: { marginTop: 22 } }, bySession.map(s => (React.createElement("div", { key: s.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                    React.createElement("span", { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.name),
                                    React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: s.netPnl >= 0 ? C.positive : C.negative, flexShrink: 0 } },
                                        s.netPnl >= 0 ? '+' : '',
                                        fmt(s.netPnl),
                                        "$")),
                                React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } },
                                    s.total,
                                    " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 \u0628\u0631\u062F ",
                                    fmt(s.winRate, 0),
                                    "%")))))),
                        React.createElement(DisciplineCard, { C: C, trades: activeTrades, rules: activeRules }),
                        React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '26px 24px', marginBottom: 20 } },
                            sectionLabel('⏱ عملکرد بر اساس تایم‌فریم'),
                            byTimeframe.length === 0
                                ? React.createElement("div", { style: { fontSize: 13, color: `${C.text}77`, lineHeight: 1.9, marginTop: 10 } }, 'هنوز معامله‌ای با تایم‌فریم نداری. هنگام ثبت معامله، تایم‌فریم ورود را انتخاب کن تا اینجا وین‌ریت و سود هر تایم‌فریم را ببینی.')
                                : React.createElement(React.Fragment, null,
                                    React.createElement(ResponsiveContainer, { width: "100%", height: 150 },
                                        React.createElement(BarChart, { data: byTimeframe, margin: { top: 5, right: 5, left: -20, bottom: 0 } },
                                            React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                            React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                            React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: false, tickLine: false }),
                                            React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                            React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, byTimeframe.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                                    React.createElement("div", { style: { marginTop: 14 } }, byTimeframe.map(tf => React.createElement("div", { key: tf.name, style: { padding: '10px 2px', borderBottom: `1px solid ${C.text}12`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' } },
                                        React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 } }, tf.name),
                                        React.createElement("span", { style: { fontSize: 12.5, color: `${C.text}77` } }, `${tf.total} معامله · وین‌ریت ${fmt(tf.winRate, 0)}%`),
                                        React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: tf.netPnl >= 0 ? C.positive : C.negative } }, `${tf.netPnl >= 0 ? '+' : ''}${fmt(tf.netPnl)}$`)))))),
                        React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 } },
                                React.createElement("div", { className: "icon-badge", style: { width: 30, height: 30, borderRadius: 9, background: `linear-gradient(150deg, ${C.accent}30, ${C.accent}08)`, border: `1px solid ${C.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 1px 1px rgba(255,255,255,0.15)` } },
                                    React.createElement("span", { className: "icon-spin" },
                                        React.createElement(Award, { size: 15, color: C.accent }))),
                                sectionLabel('🏆 عملکرد بر اساس نماد')),
                            bestSymbol && React.createElement("div", { style: { fontSize: 13.5, color: C.positive, marginBottom: 28 } },
                                "\u2726 \u0628\u0647\u062A\u0631\u06CC\u0646 \u0646\u0645\u0627\u062F: ",
                                React.createElement("strong", null, bestSymbol.name),
                                " (",
                                bestSymbol.netPnl >= 0 ? '+' : '',
                                fmt(bestSymbol.netPnl),
                                "$)"),
                            React.createElement(ResponsiveContainer, { width: "100%", height: 160 },
                                React.createElement(BarChart, { data: bySymbol, margin: { top: 5, right: 5, left: -20, bottom: 0 } },
                                    React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                    React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                    React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: false, tickLine: false }),
                                    React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                    React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, bySymbol.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                            React.createElement("div", { style: { marginTop: 22 } }, bySymbol.map(s => (React.createElement("div", { key: s.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                    React.createElement("span", { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.name),
                                    React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: s.netPnl >= 0 ? C.positive : C.negative, flexShrink: 0 } },
                                        s.netPnl >= 0 ? '+' : '',
                                        fmt(s.netPnl),
                                        "$")),
                                React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } },
                                    s.total,
                                    " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 \u0628\u0631\u062F ",
                                    fmt(s.winRate, 0),
                                    "%"))))))))),
                sub === 1 && (React.createElement(React.Fragment, null, byStrategy.length > 0 && (React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginTop: 32 } },
                    sectionLabel('📊 آنالیز استراتژی‌ها'),
                    bestStrategy && React.createElement("div", { style: { fontSize: 13.5, color: C.positive, marginBottom: 28, marginTop: -10 } },
                        "\u2726 \u0628\u0647\u062A\u0631\u06CC\u0646 \u0627\u0633\u062A\u0631\u0627\u062A\u0698\u06CC: ",
                        React.createElement("strong", null, bestStrategy.name),
                        " (",
                        bestStrategy.netPnl >= 0 ? '+' : '',
                        fmt(bestStrategy.netPnl),
                        "$)"),
                    React.createElement(ResponsiveContainer, { width: "100%", height: 170 },
                        React.createElement(BarChart, { data: byStrategy, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                            React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                            React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                            React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: false, tickLine: false }),
                            React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                            React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, byStrategy.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                    React.createElement("div", { style: { marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 } }, byStrategy.map(s => (React.createElement("div", { key: s.name, className: "glass-soft", style: { borderRadius: 10, padding: '14px 16px' } },
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
                            React.createElement("span", { style: { fontWeight: 700, fontSize: 13.5 } }, s.name),
                            React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: s.netPnl >= 0 ? C.positive : C.negative } },
                                s.netPnl >= 0 ? '+' : '',
                                fmt(s.netPnl),
                                "$")),
                        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12.5, color: `${C.text}88`, fontFamily: "'IBM Plex Mono', monospace" } },
                            React.createElement("span", null,
                                s.total,
                                " \u0645\u0639\u0627\u0645\u0644\u0647"),
                            React.createElement("span", null,
                                "\u0628\u0631\u062F ",
                                fmt(s.winRate, 0),
                                "%"),
                            React.createElement("span", null,
                                "\u067E\u0631\u0648\u0641\u06CC\u062A \u0641\u06A9\u062A\u0648\u0631 ",
                                s.profitFactor === Infinity ? '∞' : fmt(s.profitFactor, 2)),
                            React.createElement("span", null,
                                "R:R ",
                                s.avgLoss > 0 ? `۱:${fmt(s.avgWin / s.avgLoss, 2)}` : (s.avgWin > 0 ? '∞' : '—'))))))))))),
                sub === 2 && (React.createElement(React.Fragment, null, byRR.length > 0 && (React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginTop: 32 } },
                    sectionLabel('⚖️ کدام ریسک به ریوارد بیشتر به هدف سود می‌رسه؟'),
                    React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0645\u0639\u0627\u0645\u0644\u0627\u062A\u062A \u0628\u0631 \u0627\u0633\u0627\u0633 \u0646\u0633\u0628\u062A \u0631\u06CC\u0633\u06A9 \u0628\u0647 \u0631\u06CC\u0648\u0627\u0631\u062F \u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0634\u062F\u0646 \u2014 \u0646\u0634\u0648\u0646 \u0645\u06CC\u200C\u062F\u0647 \u06A9\u062F\u0648\u0645 \u0646\u0633\u0628\u062A\u200C\u0647\u0627 \u0628\u0631\u0627\u062A \u0628\u06CC\u0634\u062A\u0631 \u062C\u0648\u0627\u0628 \u062F\u0627\u062F\u0646"),
                    React.createElement(ResponsiveContainer, { width: "100%", height: 180 },
                        React.createElement(BarChart, { data: byRR, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                            React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                            React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                            React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11 }, axisLine: false, tickLine: false, unit: "%", domain: [0, 100] }),
                            React.createElement(Tooltip, { content: ({ active, payload, label }) => {
                                    if (!active || !payload || !payload.length)
                                        return null;
                                    const d = payload[0].payload;
                                    return React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 } },
                                        React.createElement("div", { style: { color: '#c7ccd6', marginBottom: 4 } },
                                            label,
                                            " \u00B7 ",
                                            d.total,
                                            " \u0645\u0639\u0627\u0645\u0644\u0647"),
                                        React.createElement("div", { style: { color: C.accent } },
                                            "\u0648\u06CC\u0646\u200C\u0631\u06CC\u062A: ",
                                            fmt(d.winRate, 0),
                                            "%"),
                                        React.createElement("div", { style: { color: d.netPnl >= 0 ? C.positive : C.negative } },
                                            "\u0633\u0648\u062F/\u0632\u06CC\u0627\u0646: ",
                                            d.netPnl >= 0 ? '+' : '',
                                            fmt(d.netPnl),
                                            "$"));
                                } }),
                            React.createElement(Bar, { dataKey: "winRate", radius: [5, 5, 0, 0] }, byRR.map((e, i) => React.createElement(Cell, { key: i, fill: C.accent, fillOpacity: 0.4 + 0.6 * (e.winRate / 100) }))))),
                    React.createElement("div", { style: { marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 } }, byRR.map(b => (React.createElement("div", { key: b.name, className: "glass-soft", style: { borderRadius: 10, padding: '14px 16px' } },
                        React.createElement("div", { style: { fontWeight: 700, fontSize: 14, marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace" } }, b.name),
                        React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12.5, color: `${C.text}88`, fontFamily: "'IBM Plex Mono', monospace" } },
                            React.createElement("span", null,
                                b.total,
                                " \u0645\u0639\u0627\u0645\u0644\u0647"),
                            React.createElement("span", { style: { color: C.accent } },
                                "\u0648\u06CC\u0646\u200C\u0631\u06CC\u062A ",
                                fmt(b.winRate, 0),
                                "%"),
                            React.createElement("span", { style: { color: b.netPnl >= 0 ? C.positive : C.negative } },
                                b.netPnl >= 0 ? '+' : '',
                                fmt(b.netPnl),
                                "$")))))))))))),
            page === 3 && (React.createElement("div", { key: page, className: "page-fade" },
                React.createElement("div", { className: "subnav no-print", role: "tablist" }, SUBS[page].map((lb, i) => React.createElement("button", { key: i, role: "tab", "aria-selected": sub === i, className: sub === i ? 'act' : '', onClick: () => { setSubs(p => ({ ...p, [page]: i })); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, lb))),
                sub === 0 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginBottom: 44 } },
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 4 } },
                            sectionLabel('📅 آنالیز هفته جاری'),
                            React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: `${C.text}66` } }, currentWeekInfo ? `${fmtDateShort(currentWeekInfo.start)} تا ${fmtDateShort(currentWeekInfo.end)}` : '')),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -6 } }, "\u0641\u0642\u0637 \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0647\u0645\u06CC\u0646 \u0647\u0641\u062A\u0647 \u2014 \u0628\u0627 \u0634\u0631\u0648\u0639 \u0647\u0641\u062A\u0647 \u0628\u0639\u062F \u062E\u0648\u062F\u0634 \u0635\u0641\u0631 \u0645\u06CC\u200C\u0634\u0647 \u0648 \u0627\u0632 \u0646\u0648 \u062D\u0633\u0627\u0628 \u0645\u06CC\u200C\u0634\u0647"),
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 } },
                            React.createElement(StatCard, { label: "\uD83D\uDCB0 \u0633\u0648\u062F/\u0632\u06CC\u0627\u0646 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647", value: `${currentWeekStats.netPnl >= 0 ? '+' : ''}${fmt(currentWeekStats.netPnl)}$`, sub: balance > 0 ? `${currentWeekPercent >= 0 ? '+' : ''}${fmt(currentWeekPercent, 2)}% از موجودی` : undefined, tone: currentWeekStats.netPnl >= 0 ? 'good' : 'bad' }),
                            React.createElement(StatCard, { label: "\uD83D\uDCCB \u062A\u0639\u062F\u0627\u062F \u0645\u0639\u0627\u0645\u0644\u0627\u062A", value: currentWeekStats.total }),
                            React.createElement(DualRateCard, { label: "\uD83C\uDFAF \u0646\u0631\u062E \u0628\u0631\u062F", rightValue: `${fmt(currentWeekStats.winRate, 0)}%`, rightSub: "\u0627\u0632 \u06A9\u0644 \u0645\u0639\u0627\u0645\u0644\u0627\u062A", leftValue: `${fmt(currentWeekStats.winRateExclBE, 0)}%`, leftSub: "\u0628\u062F\u0648\u0646 \u0633\u0631\u0628\u0647\u200C\u0633\u0631", sub: `${currentWeekStats.wins} برد / ${currentWeekStats.losses} باخت / ${currentWeekStats.bes} سر به سر` }),
                            React.createElement(StatCard, { label: "\uD83C\uDFAF \u0627\u06A9\u0633\u067E\u06A9\u062A\u0646\u0633\u06CC", value: `${currentWeekStats.expectancy >= 0 ? '+' : ''}${fmt(currentWeekStats.expectancy, 1)}$`, sub: "\u0628\u0647 \u0627\u0632\u0627\u06CC \u0647\u0631 \u0645\u0639\u0627\u0645\u0644\u0647" })),
                        currentWeekStats.total === 0 && React.createElement("div", { style: { marginTop: 18, fontSize: 12.5, color: `${C.text}55` } }, "\u0647\u0646\u0648\u0632 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u0645\u0639\u0627\u0645\u0644\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647.")),
                    weeklyStats.length > 0 && (React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginBottom: 44 } },
                        sectionLabel('📈 روند سود/زیان هفتگی (از اولین هفته تا امروز)'),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0647\u0631 \u0633\u062A\u0648\u0646 \u06CC\u0639\u0646\u06CC \u06CC\u06A9 \u0647\u0641\u062A\u0647 \u062A\u0642\u0648\u06CC\u0645\u06CC \u2014 \u0627\u0632 \u0634\u0646\u0628\u0647 \u062A\u0627 \u062C\u0645\u0639\u0647 \u2014 \u0628\u0627 \u0645\u062C\u0645\u0648\u0639 \u062F\u0644\u0627\u0631\u06CC \u0648 \u062F\u0631\u0635\u062F\u06CC \u0647\u0645\u0648\u0646 \u0647\u0641\u062A\u0647"),
                        React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                            React.createElement(BarChart, { data: weeklyStats, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 12 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: false, tickLine: false }),
                                React.createElement(Tooltip, { content: ({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length)
                                            return null;
                                        const d = payload[0].payload;
                                        return React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 } },
                                            React.createElement("div", { style: { color: '#c7ccd6', marginBottom: 4 } },
                                                label,
                                                " \u00B7 ",
                                                d.range),
                                            React.createElement("div", { style: { color: d.netPnl >= 0 ? C.positive : C.negative } },
                                                d.netPnl >= 0 ? '+' : '',
                                                fmt(d.netPnl),
                                                "$ \u00B7 ",
                                                d.pips >= 0 ? '+' : '',
                                                fmt(d.pips, 1),
                                                " pip \u00B7 ",
                                                d.r >= 0 ? '+' : '',
                                                fmt(d.r, 2),
                                                "R (",
                                                d.percent >= 0 ? '+' : '',
                                                fmt(d.percent, 2),
                                                "%)"),
                                            React.createElement("div", { style: { color: '#9aa1af' } },
                                                d.count,
                                                " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 \u0628\u0631\u062F ",
                                                fmt(d.winRate, 0),
                                                "%"));
                                    } }),
                                React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}40` }),
                                React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, weeklyStats.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                        React.createElement("div", { style: { marginTop: 22 } }, weeklyStats.map(w => (React.createElement("div", { key: w.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                React.createElement("span", null,
                                    w.name,
                                    " ",
                                    React.createElement("span", { style: { color: `${C.text}55`, fontSize: 12.5 } },
                                        "(",
                                        w.range,
                                        ")")),
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: w.netPnl >= 0 ? C.positive : C.negative } },
                                    w.pips >= 0 ? '+' : '',
                                    fmt(w.pips, 1),
                                    " pip \u00B7 ",
                                    w.r >= 0 ? '+' : '',
                                    fmt(w.r, 2),
                                    "R \u00B7 ",
                                    w.netPnl >= 0 ? '+' : '',
                                    fmt(w.netPnl),
                                    "$ \u00B7 ",
                                    w.percent >= 0 ? '+' : '',
                                    fmt(w.percent, 2),
                                    "%")),
                            React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } },
                                w.count,
                                " \u0645\u0639\u0627\u0645\u0644\u0647 \u00B7 \u0628\u0631\u062F ",
                                fmt(w.winRate, 0),
                                "%"))))))))),
                sub === 1 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginBottom: 44 } },
                        sectionLabel('📊 عملکرد بر اساس روز هفته (مجموع)'),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0645\u062C\u0645\u0648\u0639 \u0633\u0648\u062F/\u0632\u06CC\u0627\u0646 \u0647\u0631 \u0631\u0648\u0632 \u0647\u0641\u062A\u0647\u060C \u062C\u0645\u0639 \u0647\u0645\u0647 \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0647\u0645\u0627\u0646 \u0631\u0648\u0632"),
                        React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                            React.createElement(BarChart, { data: byDayOrdered, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 12 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: false, tickLine: false }),
                                React.createElement(Tooltip, { content: React.createElement(CustomTooltip, null) }),
                                React.createElement(Bar, { dataKey: "netPnl", radius: [5, 5, 0, 0] }, byDayOrdered.map((e, i) => React.createElement(Cell, { key: i, fill: e.netPnl >= 0 ? C.positive : C.negative }))))),
                        React.createElement("div", { style: { marginTop: 22 } }, byDayOrdered.map(d => (React.createElement("div", { key: d.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                React.createElement("span", null, d.name),
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: d.netPnl >= 0 ? C.positive : C.negative } },
                                    d.netPnl >= 0 ? '+' : '',
                                    fmt(d.netPnl),
                                    "$")),
                            React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } },
                                d.total,
                                " \u0645\u0639\u0627\u0645\u0644\u0647",
                                d.total ? ` · برد ${fmt(d.winRate, 0)}%` : '')))))),
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginBottom: 44 } },
                        sectionLabel('📊 مجموع کل سود/زیان هر روز هفته (بر اساس تعداد جلسات)'),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0645\u062B\u0644\u0627\u064B: \u062F\u0631 \u06F4 \u062F\u0648\u0634\u0646\u0628\u0647\u200C\u0627\u06CC \u06A9\u0647 \u0645\u0639\u0627\u0645\u0644\u0647 \u06A9\u0631\u062F\u06CC\u060C \u062F\u0631 \u0645\u062C\u0645\u0648\u0639 \u0686\u0642\u062F\u0631 \u0633\u0648\u062F \u06CC\u0627 \u0632\u06CC\u0627\u0646 \u06A9\u0631\u062F\u06CC"),
                        React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                            React.createElement(BarChart, { data: dayAvgStats, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 12 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: false, tickLine: false }),
                                React.createElement(Tooltip, { content: ({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length)
                                            return null;
                                        const d = payload[0].payload;
                                        return React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 } },
                                            React.createElement("div", { style: { color: '#c7ccd6', marginBottom: 4 } },
                                                label,
                                                " \u00B7 ",
                                                d.occurrences,
                                                " \u062C\u0644\u0633\u0647"),
                                            React.createElement("div", { style: { color: d.totalPnl >= 0 ? C.positive : C.negative } },
                                                "\u0645\u062C\u0645\u0648\u0639: ",
                                                d.totalPnl >= 0 ? '+' : '',
                                                fmt(d.totalPnl),
                                                "$"));
                                    } }),
                                React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}40` }),
                                React.createElement(Bar, { dataKey: "totalPnl", radius: [5, 5, 0, 0] }, dayAvgStats.map((e, i) => React.createElement(Cell, { key: i, fill: e.totalPnl >= 0 ? C.positive : C.negative }))))),
                        React.createElement("div", { style: { marginTop: 22 } }, dayAvgStats.map(d => (React.createElement("div", { key: d.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                React.createElement("span", null, d.name),
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: d.totalPnl >= 0 ? C.positive : C.negative } },
                                    d.totalPnl >= 0 ? '+' : '',
                                    fmt(d.totalPnl),
                                    "$")),
                            React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } }, d.occurrences ? `در ${d.occurrences} ${d.name}` : 'بدون معامله')))))))),
                sub === 2 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                        sectionLabel('📊 میانگین عملکرد روزانه بر اساس روز هفته'),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0645\u062B\u0644\u0627\u064B \u0627\u06AF\u0631 \u062F\u0631 \u06F3 \u062F\u0648\u0634\u0646\u0628\u0647\u200C\u06CC \u0645\u062E\u062A\u0644\u0641 \u062F\u0631 \u0645\u062C\u0645\u0648\u0639 \u06F3\u066A \u0627\u0632 \u0645\u0648\u062C\u0648\u062F\u06CC \u0636\u0631\u0631 \u06A9\u0631\u062F\u06CC\u060C \u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0647\u0631 \u062F\u0648\u0634\u0646\u0628\u0647 \u06F1\u066A \u0636\u0631\u0631 \u0627\u0633\u062A"),
                        React.createElement(ResponsiveContainer, { width: "100%", height: 200 },
                            React.createElement(BarChart, { data: dayAvgStats, margin: { top: 5, right: 5, left: -10, bottom: 0 } },
                                React.createElement(CartesianGrid, { stroke: `${C.text}0c`, vertical: false }),
                                React.createElement(XAxis, { dataKey: "name", stroke: `${C.text}55`, tick: { fontSize: 12 }, axisLine: { stroke: `${C.text}18` }, tickLine: false }),
                                React.createElement(YAxis, { stroke: `${C.text}55`, tick: { fontSize: 11.5 }, axisLine: false, tickLine: false, unit: "%" }),
                                React.createElement(Tooltip, { content: ({ active, payload, label }) => {
                                        if (!active || !payload || !payload.length)
                                            return null;
                                        const d = payload[0].payload;
                                        return React.createElement("div", { style: { background: C.bgAlt, border: '1px solid #ffffff22', borderRadius: 8, padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 } },
                                            React.createElement("div", { style: { color: '#c7ccd6', marginBottom: 4 } },
                                                label,
                                                " \u00B7 ",
                                                d.occurrences,
                                                " \u062A\u06A9\u0631\u0627\u0631"),
                                            React.createElement("div", { style: { color: d.avgPercent >= 0 ? C.positive : C.negative } },
                                                "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646: ",
                                                d.avgPercent >= 0 ? '+' : '',
                                                fmt(d.avgPercent, 2),
                                                "%"),
                                            React.createElement("div", { style: { color: '#9aa1af' } },
                                                "\u0645\u062C\u0645\u0648\u0639: ",
                                                d.totalPercent >= 0 ? '+' : '',
                                                fmt(d.totalPercent, 2),
                                                "%"));
                                    } }),
                                React.createElement(ReferenceLine, { y: 0, stroke: `${C.text}40` }),
                                React.createElement(Bar, { dataKey: "avgPercent", radius: [5, 5, 0, 0] }, dayAvgStats.map((e, i) => React.createElement(Cell, { key: i, fill: e.avgPercent >= 0 ? C.positive : C.negative }))))),
                        React.createElement("div", { style: { marginTop: 22 } }, dayAvgStats.map(d => (React.createElement("div", { key: d.name, style: { padding: '12px 2px', borderBottom: `1px solid ${C.text}12` } },
                            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 14 } },
                                React.createElement("span", null, d.name),
                                React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", color: d.avgPercent >= 0 ? C.positive : C.negative } },
                                    d.avgPercent >= 0 ? '+' : '',
                                    fmt(d.avgPercent, 2),
                                    "% / \u0631\u0648\u0632")),
                            React.createElement("div", { style: { fontSize: 12.5, color: `${C.text}66`, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" } },
                                d.occurrences,
                                " ",
                                d.name,
                                " \u00B7 \u0645\u062C\u0645\u0648\u0639 ",
                                d.totalPercent >= 0 ? '+' : '',
                                fmt(d.totalPercent, 2),
                                "%")))))))))),
            page === 4 && (React.createElement("div", { key: page, className: "page-fade" },
                React.createElement("div", { className: "subnav no-print", role: "tablist" }, SUBS[page].map((lb, i) => React.createElement("button", { key: i, role: "tab", "aria-selected": sub === i, className: sub === i ? 'act' : '', onClick: () => { setSubs(p => ({ ...p, [page]: i })); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, lb))),
                sub === 0 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px', marginBottom: 20, overflowX: 'auto' } },
                        sectionLabel('📊 ماتریس نماد × سشن'),
                        React.createElement("div", { style: { fontSize: 14, color: `${C.text}88`, marginBottom: 30, marginTop: -10 } }, "\u0633\u0648\u062F/\u0632\u06CC\u0627\u0646 \u062E\u0627\u0644\u0635 \u0647\u0631 \u0646\u0645\u0627\u062F \u062F\u0631 \u0647\u0631 \u0633\u0634\u0646 \u2014 \u0631\u0648\u0634\u0646\u200C\u062A\u0631\u06CC\u0646 \u0633\u0644\u0648\u0644\u060C \u0628\u0647\u062A\u0631\u06CC\u0646 \u062A\u0631\u06A9\u06CC\u0628 \u062A\u0648\u0633\u062A"),
                        React.createElement("table", { style: { borderCollapse: 'collapse', width: '100%', minWidth: 580 } },
                            React.createElement("thead", null,
                                React.createElement("tr", null,
                                    React.createElement("th", { style: { textAlign: 'right', padding: '10px 12px', fontSize: 12.5, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace" } }, "\u0646\u0645\u0627\u062F"),
                                    SESSIONS.map(s => React.createElement("th", { key: s, style: { textAlign: 'center', padding: '10px 12px', fontSize: 12.5, color: `${C.text}55`, fontFamily: "'IBM Plex Mono', monospace" } }, s)))),
                            React.createElement("tbody", null, matrix.symbols.map(sym => (React.createElement("tr", { key: sym },
                                React.createElement("td", { style: { padding: '12px', fontSize: 13.5, fontWeight: 600, borderTop: `1px solid ${C.text}12` } }, sym),
                                SESSIONS.map(sess => {
                                    const key = `${sym}|${sess}`;
                                    const cell = matrix.cells[key];
                                    const isBest = key === matrix.bestKey;
                                    const opacity = cell ? 0.16 + 0.55 * (Math.abs(cell.pnl) / matrix.maxAbs) : 0;
                                    const posRgb = hexToRgb(C.positive), negRgb = hexToRgb(C.negative);
                                    const bg = cell ? (cell.pnl >= 0 ? `rgba(${posRgb},${opacity})` : `rgba(${negRgb},${opacity})`) : 'transparent';
                                    return (React.createElement("td", { key: sess, style: { padding: '12px', textAlign: 'center', borderTop: `1px solid ${C.text}12`, background: bg, borderRadius: 6 } }, cell ? React.createElement("div", null,
                                        React.createElement("div", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: isBest ? 700 : 500, color: cell.pnl >= 0 ? C.positive : C.negative } },
                                            cell.pnl >= 0 ? '+' : '',
                                            fmt(cell.pnl),
                                            "$ ",
                                            isBest && '★'),
                                        React.createElement("div", { style: { fontSize: 12, color: `${C.text}55`, marginTop: 3 } },
                                            cell.count,
                                            " \u0645\u0639\u0627\u0645\u0644\u0647")) : React.createElement("span", { style: { color: `${C.text}30`, fontSize: 13 } }, "\u2014")));
                                })))))),
                        matrix.bestKey && React.createElement("div", { style: { marginTop: 22, fontSize: 13.5, color: C.accent } },
                            "\u2605 \u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0628\u0647\u0631\u0647\u200C\u0648\u0631\u06CC: ",
                            React.createElement("strong", null, matrix.bestKey.split('|')[0]),
                            " \u062F\u0631 \u0633\u0634\u0646 ",
                            React.createElement("strong", null, matrix.bestKey.split('|')[1]))))),
                sub === 1 && (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "glass-effect", style: { borderRadius: 14, padding: '38px 32px' } },
                        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 18 } },
                            sectionLabel(`📋 تاریخچه معاملات (${trades.length})`),
                            React.createElement("div", { style: { display: 'flex', gap: 8 } },
                                React.createElement("button", { onClick: () => window.print(), className: "no-print", style: { background: `${C.text}20`, color: C.text, border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' } }, "\uD83D\uDDA8 \u0686\u0627\u067E"),
                                React.createElement("button", { onClick: (e) => { if (lockedNew()) return; setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); createRipple(e, 'rgba(255,255,255,0.4)'); }, className: "ripple-btn", style: { display: 'flex', alignItems: 'center', gap: 7, background: C.accent, color: C.bg, border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', position: 'relative', overflow: 'hidden' } },
                                    React.createElement("span", { className: "icon-bounce" },
                                        React.createElement(Plus, { size: 15 })),
                                    " \u062B\u0628\u062A \u0645\u0639\u0627\u0645\u0644\u0647"))),
                        React.createElement("div", { style: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, marginBottom: 24 } },
                            React.createElement("input", { placeholder: "\u062C\u0633\u062A\u062C\u0648 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0646\u0645\u0627\u062F\u060C \u0627\u0633\u062A\u0631\u0627\u062A\u0698\u06CC \u06CC\u0627 \u0633\u0634\u0646...", value: historySearch, onChange: e => setHistorySearch(e.target.value), style: { flex: 1, minWidth: 160, background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 8, padding: '9px 14px', color: C.text, fontSize: 14 } }),
                            React.createElement("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, [{ k: 'all', l: 'همه' }, { k: 'win', l: 'برد' }, { k: 'loss', l: 'باخت' }, { k: 'be', l: 'سربه‌سر' }].map(f => (React.createElement("button", { key: f.k, onClick: () => setHistoryFilter(f.k), style: { padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${historyFilter === f.k ? C.accent : C.text + '18'}`, background: historyFilter === f.k ? `${C.accent}22` : 'transparent', color: historyFilter === f.k ? C.accent : `${C.text}88` } }, f.l))))),
                        React.createElement("div", { style: { display: 'flex', gap: 18, marginBottom: 24, flexWrap: 'wrap' } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                                React.createElement("span", { style: { fontSize: 12.5, color: `${C.text}66` } }, "\u0627\u0632:"),
                                React.createElement("input", { type: "date", value: dateRange.from, onChange: e => setDateRange({ ...dateRange, from: e.target.value }), style: { background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 13 } })),
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                                React.createElement("span", { style: { fontSize: 12.5, color: `${C.text}66` } }, "\u062A\u0627:"),
                                React.createElement("input", { type: "date", value: dateRange.to, onChange: e => setDateRange({ ...dateRange, to: e.target.value }), style: { background: C.bg, border: `1px solid ${C.text}18`, borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 13 } })),
                            (dateRange.from || dateRange.to) && React.createElement("button", { onClick: () => setDateRange({ from: '', to: '' }), style: { background: 'none', border: 'none', color: C.negative, fontSize: 13, cursor: 'pointer' } }, "\u2715 \u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646")),
                        React.createElement("div", { style: { maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 } },
                            filteredTrades.length === 0 && React.createElement("div", { style: { padding: '30px 4px', textAlign: 'center', color: `${C.text}55`, fontSize: 14 } }, "\u0645\u0639\u0627\u0645\u0644\u0647\u200C\u0627\u06CC \u0628\u0627 \u0627\u06CC\u0646 \u0641\u06CC\u0644\u062A\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F"),
                            filteredTrades.map((t, idx) => {
                                const rm = RESULT_META[resultOf(t)];
                                const lossPercent = balance > 0 && t.pnl < 0 ? (Math.abs(t.pnl) / balance) * 100 : 0;
                                const isBigLoss = lossPercent > 2;
                                return (React.createElement("div", { key: t.id, className: "trade-item glass-soft", style: { animationDelay: `${Math.min(idx, 12) * 35}ms`, borderRadius: 10, padding: '12px 14px' } },
                                    React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 6 } },
                                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                                            React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700 } }, t.symbol),
                                            React.createElement("span", { style: { fontSize: 12, color: `${C.text}88`, border: `1px solid ${C.text}22`, borderRadius: 10, padding: '1px 8px' } }, t.direction),
                                            React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: rm.color, border: `1px solid ${rm.color}55`, background: `${rm.color}18`, borderRadius: 10, padding: '1px 8px' } }, rm.label),
                                            typeof t.rr === 'number' && React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: C.accent, border: `1px solid ${C.accent}55`, background: `${C.accent}18`, borderRadius: 10, padding: '1px 8px', fontFamily: "'IBM Plex Mono', monospace" } },
                                                "R:R \u06F1:",
                                                fmt(t.rr, 1)),
                                            isBigLoss && React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: C.negative, border: `1px solid ${C.negative}66`, background: `${C.negative}22`, borderRadius: 10, padding: '1px 8px' } },
                                                "\u26A0 \u0636\u0631\u0631 \u0628\u06CC\u0634 \u0627\u0632 \u06F2\u066A (",
                                                fmt(lossPercent, 1),
                                                "\u066A)"),
                                            (t.commission !== undefined && t.commission !== 0) && React.createElement("span", { style: { fontSize: 11.5, color: `${C.text}55`, border: `1px solid ${C.text}22`, borderRadius: 10, padding: '1px 6px' } },
                                                "\u06A9\u0627\u0631\u0645\u0632\u062F: ",
                                                fmt(t.commission),
                                                "$"),
                                            (t.swap !== undefined && t.swap !== 0) && React.createElement("span", { style: { fontSize: 11.5, color: `${C.text}55`, border: `1px solid ${C.text}22`, borderRadius: 10, padding: '1px 6px' } },
                                                "\u0633\u0648\u0622\u067E: ",
                                                t.swap >= 0 ? '+' : '',
                                                fmt(t.swap),
                                                "$")),
                                        React.createElement("div", { style: { display: 'flex', gap: 4, flexShrink: 0 } },
                                            React.createElement("button", { onClick: () => editTrade(t), style: { background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 } },
                                                React.createElement(Edit, { size: 13, color: C.accent })),
                                            React.createElement("button", { onClick: () => deleteTrade(t.id), style: { background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 } },
                                                React.createElement(Trash2, { size: 13, color: C.negative })))),
                                    React.createElement("div", { style: { fontSize: 12, color: `${C.text}66`, marginBottom: (t.entryPrice || t.exitPrice) ? 4 : 8, fontFamily: "'IBM Plex Mono', monospace" } },
                                        t.date,
                                        t.day ? ` · ${t.day}` : '',
                                        t.time ? ` · ${t.time}` : '',
                                        " \u00B7 ",
                                        t.session,
                                        t.timeframe ? ` · ${t.timeframe}` : '',
                                        t.strategy ? ` · ` : '',
                                        t.strategy && React.createElement("span", { style: { color: C.accent } }, t.strategy)),
                                    (t.entryPrice || t.exitPrice || t.stopLoss || t.target) && React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 8, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace", color: `${C.text}77` } },
                                        t.entryPrice && React.createElement("span", null,
                                            "\u0648\u0631\u0648\u062F ",
                                            React.createElement("b", { style: { color: C.text } }, t.entryPrice)),
                                        t.exitPrice && React.createElement("span", null,
                                            "\u062E\u0631\u0648\u062C ",
                                            React.createElement("b", { style: { color: C.text } }, t.exitPrice)),
                                        t.stopLoss && React.createElement("span", null,
                                            "\u0627\u0633\u062A\u0627\u067E ",
                                            React.createElement("b", { style: { color: C.negative } }, t.stopLoss)),
                                        t.target && React.createElement("span", null,
                                            "\u062A\u0627\u0631\u06AF\u062A ",
                                            React.createElement("b", { style: { color: C.positive } }, t.target)),
                                        t.volume && React.createElement("span", null,
                                            "\u062D\u062C\u0645 ",
                                            React.createElement("b", { style: { color: C.text } }, t.volume)),
                                        t.riskPercent && React.createElement("span", null,
                                            "\u0631\u06CC\u0633\u06A9 ",
                                            React.createElement("b", { style: { color: C.accent } },
                                                t.riskPercent,
                                                "%"))),
                                    React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${C.text}0f` } },
                                        React.createElement("span", { style: { fontSize: 12.5, color: `${C.text}66`, fontStyle: t.emotion ? 'italic' : 'normal' } }, t.emotion || ''),
                                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                                            riskUnit > 0 && React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: `${C.text}66` } },
                                                t.pnl >= 0 ? '+' : '',
                                                fmt(calcTradeR(t, activeBalance), 2),
                                                "R"),
                                            t.pnl >= 0 ? React.createElement("span", { className: "icon-float" },
                                                React.createElement(TrendingUp, { size: 13, color: C.positive })) : React.createElement("span", { className: "icon-pulse" },
                                                React.createElement(TrendingDown, { size: 13, color: C.negative })),
                                            React.createElement("span", { style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 700, color: t.pnl >= 0 ? C.positive : C.negative } },
                                                t.pnl >= 0 ? '+' : '',
                                                fmt(t.pnl),
                                                "$")))));
                            })))))))),
        React.createElement("div", { className: "floating-nav-wrapper no-print" },
            React.createElement("div", { className: "floating-nav" },
                React.createElement("div", { className: `slider-indicator pos-${activeNav === 0 ? 1 : activeNav === 1 ? 2 : activeNav === 3 ? 4 : 5}` }),
                React.createElement("button", { className: `nav-btn-item ${activeNav === 0 ? 'active' : ''}`, onClick: () => handleNavClick(0) },
                    React.createElement(LayoutDashboard, { size: 20 }),
                    React.createElement("span", null, "\u0646\u0645\u0627\u06CC \u06A9\u0644\u06CC")),
                React.createElement("button", { className: `nav-btn-item ${activeNav === 1 ? 'active' : ''}`, onClick: () => handleNavClick(1) },
                    React.createElement(Layers, { size: 20 }),
                    React.createElement("span", null, "\u0633\u0634\u0646 \u0648 \u0646\u0645\u0627\u062F")),
                React.createElement("button", { className: "nav-add-btn attention-spin", onClick: (e) => { if (lockedNew()) return; setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); createRipple(e, 'rgba(255,255,255,0.4)'); } },
                    React.createElement("svg", { viewBox: "0 0 24 24" },
                        React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                        React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" }))),
                React.createElement("button", { className: `nav-btn-item ${activeNav === 3 ? 'active' : ''}`, onClick: () => handleNavClick(3) },
                    React.createElement(CalendarDays, { size: 20 }),
                    React.createElement("span", null,
                        "\u0647\u0641\u062A\u0647\u200C\u0647\u0627",
                        React.createElement("br", null),
                        "\u0648 \u0631\u0648\u0632\u0647\u0627")),
                React.createElement("button", { className: `nav-btn-item ${activeNav === 4 ? 'active' : ''}`, onClick: () => handleNavClick(4) },
                    React.createElement(FileText, { size: 20 }),
                    React.createElement("span", null,
                        "\u0645\u0627\u062A\u0631\u06CC\u0633",
                        React.createElement("br", null),
                        "\u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647")))),
        showForm && (React.createElement("div", { className: "modal-backdrop", onMouseDown: (e) => { if (e.target === e.currentTarget) { closeFormSoft(); } }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 } },
            React.createElement("div", { className: "modal-panel trade-form fx-tf glass-effect", style: { background: C.bgCard, width: '100%', maxHeight: '92vh' } }, React.createElement(FormGuard, { onClose: closeFormSoft }, React.createElement(TradeFormBody, { C: C, form: form, setForm: setForm, editingId: editingId, strategies: strategies, newStrategy: newStrategy, setNewStrategy: setNewStrategy, addStrategyOption: addStrategyOption, removeStrategyOption: removeStrategyOption, setExitFrom: setExitFrom, calcPnlFromPrices: calcPnlFromPrices, addTrade: addTrade, closeFormSoft: closeFormSoft, balance: activeBalance, ruleEval: formEval, rules: activeRules, propSt: propSt })))))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Root, null));

  
