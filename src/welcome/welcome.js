// QuickLinker 首次安裝教學頁
// 設定鍵（language / themeMode / scanMode / excludeCurrentSite …）與選項頁共用同一組 chrome.storage.sync。
'use strict';

const TOTAL = 6;
// 減少動態：系統偏好或使用者在頁面上按「暫停動畫」，任一為真都停止所有自動動畫並顯示靜態結果
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = false;
try { motionPaused = localStorage.getItem('ql_welcome_motion') === 'off'; } catch (e) { /* 讀不到就用預設 */ }
const reduceMotion = () => motionQuery.matches || motionPaused;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ───────── 儲存（沒有 chrome.storage 時退回記憶體，方便單獨預覽） ───────── */
const hasSync = !!globalThis.chrome?.storage?.sync;
const memory = {};
const getSync = async (defaults) => (hasSync ? chrome.storage.sync.get(defaults) : { ...defaults, ...memory });
const setSync = async (values) => {
    if (hasSync) return chrome.storage.sync.set(values);
    Object.assign(memory, values);
};

const prefs = {
    language: 'auto', themeMode: 'auto', scanMode: 'bestMatch',
    excludeCurrentSite: true, closeOriginalTab: false, showFloatingButton: true, enableCache: true
};

/* ───────── 多語系 ───────── */
function detectLang() {
    const locale = navigator.language || 'en';
    if (locale === 'zh-TW' || locale === 'zh-HK') return 'zh-TW';
    if (locale.startsWith('zh')) return 'zh-CN';
    if (locale.startsWith('ja')) return 'ja';
    if (locale.startsWith('ko')) return 'ko';
    return 'en';
}
const resolveLang = (pref) => (pref === 'auto' ? detectLang() : pref);
let lang = 'en';

function raw(key) {
    return (WELCOME_I18N[lang] && WELCOME_I18N[lang][key]) ?? WELCOME_I18N.en[key] ?? key;
}
function t(key, vars = {}) {
    return raw(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

/* ───────── 計時器 ───────── */
function makeTimeline() {
    const ids = [];
    return {
        after(ms, fn) { ids.push(setTimeout(fn, ms)); },
        clear() { ids.forEach(clearTimeout); ids.length = 0; }
    };
}
const rand = (min, max) => min + Math.random() * (max - min);

/* ───────── 示範用站台（對應 DEFAULT_SITE_LIST，以字母圓點代替站台圖示，免連網） ───────── */
const SITES = [
    { n: 'MissAV', l: 'M' }, { n: 'JABLE', l: 'J' }, { n: 'JavDB', l: 'D' }, { n: 'FC2 MissAV', l: 'F' },
    { n: 'javtrailers', l: 'T' }, { n: 'search JavDB', l: 'S' }, { n: 'searchFC2', l: 'C' }
];

/* ───────── 假游標 ───────── */
function relCenter(el, container, fx = 0.5, fy = 0.5) {
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - c.left + r.width * fx, y: r.top - c.top + r.height * fy };
}
const moveCursor = (cursor, x, y) => { cursor.style.transform = `translate(${x}px, ${y}px)`; };
function clickCursor(cursor) {
    cursor.classList.remove('click');
    void cursor.offsetWidth;
    cursor.classList.add('click');
}
function showToast(toast, text, ms = 1800) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), ms);
}

/* ───────── 浮動按鈕元件（第 1、2 步共用） ───────── */
function createFloating(mock, { interactive = false, onOpenSite } = {}) {
    const host = $('.fl-host', mock);
    host.innerHTML = '';
    const fl = document.createElement('div');
    fl.className = 'fl';
    fl.innerHTML = '<div class="fl-subs"></div><button type="button" class="fl-main" aria-label="QuickLinker" aria-expanded="false">+</button>';
    host.appendChild(fl);
    const main = $('.fl-main', fl);
    const subs = $('.fl-subs', fl);
    const tl = makeTimeline();
    let moved = false;

    function open() {
        const r = fl.getBoundingClientRect();
        const m = mock.getBoundingClientRect();
        fl.classList.toggle('down', r.top - m.top < (m.height - 32) / 2);
        fl.classList.add('open');
        main.setAttribute('aria-expanded', 'true');
    }
    function close() {
        fl.classList.remove('open');
        main.setAttribute('aria-expanded', 'false');
    }

    // 逐一長出站台（黃色探測中）→ 依序確認：可用變綠，不可用消失；全部完成後呼叫 onDone
    function probe(sites, okSet, onDone) {
        tl.clear();
        subs.innerHTML = '';
        const nodes = sites.map((s, i) => {
            const b = document.createElement('a');
            b.className = 'fl-sub';
            b.textContent = s.l;
            b.title = s.n;
            b.style.animationDelay = `${i * 80}ms, 0s`;
            b.dataset.site = s.n;
            subs.appendChild(b);
            return b;
        });
        let t0 = sites.length * 80 + 500;
        const order = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
        order.forEach((i) => {
            t0 += reduceMotion() ? 0 : rand(380, 900);
            tl.after(t0, () => {
                if (okSet.has(i)) nodes[i].classList.add('ok');
                else {
                    nodes[i].classList.add('gone');
                    setTimeout(() => nodes[i].remove(), 480);
                }
            });
        });
        tl.after(t0 + 600, () => onDone && onDone(nodes.filter((_, i) => okSet.has(i))));
    }

    if (interactive) {
        main.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            main.setPointerCapture(e.pointerId);
            const box = host.getBoundingClientRect();
            const r = fl.getBoundingClientRect();
            const shiftX = e.clientX - r.left;
            const shiftY = e.clientY - r.top;
            const sx = e.clientX;
            const sy = e.clientY;
            moved = false;
            const move = (ev) => {
                if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
                moved = true;
                fl.classList.add('dragging');
                const x = Math.max(0, Math.min(ev.clientX - box.left - shiftX, box.width - r.width));
                const y = Math.max(0, Math.min(ev.clientY - box.top - shiftY, box.height - r.height));
                fl.style.right = 'auto';
                fl.style.bottom = 'auto';
                fl.style.left = `${x}px`;
                fl.style.top = `${y}px`;
                const top = y < (box.height - r.height) / 2;
                fl.classList.toggle('down', top);
            };
            const up = () => {
                fl.classList.remove('dragging');
                main.removeEventListener('pointermove', move);
                main.removeEventListener('pointerup', up);
                main.removeEventListener('pointercancel', up);
            };
            main.addEventListener('pointermove', move);
            main.addEventListener('pointerup', up);
            main.addEventListener('pointercancel', up);
        });
        main.addEventListener('click', () => {
            if (moved) { moved = false; return; }
            api.onToggle && api.onToggle(!fl.classList.contains('open'));
        });

        // 拖曳的鍵盤替代：按鈕取得焦點後，方向鍵移動（Shift 加大步距）
        main.addEventListener('keydown', (e) => {
            const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (!dir) return;
            e.preventDefault();
            e.stopPropagation(); // 避免觸發全域的「左右鍵換頁」
            const step = e.shiftKey ? 48 : 12;
            const box = host.getBoundingClientRect();
            const r = fl.getBoundingClientRect();
            // 以上次寫入的樣式值為準，只有第一次才量測（每次重量會累積子像素舍入誤差）
            const x0 = fl.style.left ? parseFloat(fl.style.left) : r.left - box.left;
            const y0 = fl.style.top ? parseFloat(fl.style.top) : r.top - box.top;
            const x = Math.max(0, Math.min(x0 + dir[0] * step, box.width - r.width));
            const y = Math.max(0, Math.min(y0 + dir[1] * step, box.height - r.height));
            fl.style.right = 'auto';
            fl.style.bottom = 'auto';
            fl.style.left = `${x}px`;
            fl.style.top = `${y}px`;
            fl.classList.toggle('down', y < (box.height - r.height) / 2);
        });
    }

    subs.addEventListener('click', (e) => {
        const sub = e.target.closest('.fl-sub');
        if (!sub || !sub.classList.contains('ok')) return;
        sub.classList.add('pressed');
        setTimeout(() => sub.classList.remove('pressed'), 160);
        onOpenSite && onOpenSite(sub.dataset.site);
    });

    // 靜態最終狀態：只放確認可用的站台（減少動態或暫停動畫時使用）
    function showFinal(sites, okSet) {
        subs.innerHTML = '';
        sites.forEach((site, i) => {
            if (!okSet.has(i)) return;
            const b = document.createElement('a');
            b.className = 'fl-sub ok';
            b.style.animation = 'none';
            b.textContent = site.l;
            b.title = site.n;
            b.dataset.site = site.n;
            subs.appendChild(b);
        });
    }

    const api = { el: fl, main, subs, open, close, probe, showFinal, stop: () => tl.clear(), onToggle: null,
        isOpen: () => fl.classList.contains('open'),
        popIn() { main.classList.remove('pop'); void main.offsetWidth; main.classList.add('pop'); } };
    return api;
}

/* ───────── 第 1 步：情境動畫（偵測 → 探測 → 點擊） ───────── */
const scene = (() => {
    const mock = $('#sceneMock');
    const code = $('#sceneCode');
    const toast = $('#sceneToast');
    const cursor = $('.cursor', mock);
    const phases = $$('#scenePhases li');
    const tl = makeTimeline();
    let fl = null;

    function reset() {
        tl.clear();
        if (fl) fl.stop();
        code.classList.remove('hl');
        toast.classList.remove('show');
        cursor.classList.remove('on', 'click');
        phases.forEach((p) => p.classList.remove('on'));
        $('.fl-host', mock).innerHTML = '';
        fl = null;
    }

    function play() {
        reset();
        const sites = SITES.slice(0, 5);
        const ok = new Set([0, 1, 2]);
        if (reduceMotion()) {
            phases.forEach((p) => p.classList.add('on'));
            code.classList.add('hl');
            fl = createFloating(mock);
            fl.showFinal(sites, ok);
            fl.open();
            return;
        }
        tl.after(500, () => {
            code.classList.add('hl');
            phases[0].classList.add('on');
            showToast(toast, t('scene_found', { code: 'IPZZ-914' }), 1400);
        });
        tl.after(1900, () => {
            fl = createFloating(mock);
            fl.popIn();
            phases[1].classList.add('on');
        });
        tl.after(2700, () => {
            cursor.style.transition = 'none';
            moveCursor(cursor, 80, 230);
            void cursor.offsetWidth;
            cursor.style.transition = '';
            cursor.classList.add('on');
            const p = relCenter(fl.main, mock, 0.6, 0.6);
            tl.after(80, () => moveCursor(cursor, p.x, p.y));
        });
        tl.after(3900, () => {
            clickCursor(cursor);
            fl.open();
            fl.probe(sites, ok, (oks) => {
                phases[2].classList.add('on');
                const first = oks[0];
                if (!first) return;
                const p = relCenter(first, mock, 0.6, 0.6);
                moveCursor(cursor, p.x, p.y);
                tl.after(1000, () => {
                    clickCursor(cursor);
                    first.classList.add('pressed');
                    showToast(toast, t('scene_open', { site: first.dataset.site }), 1800);
                });
                tl.after(4200, play);
            });
        });
    }

    $('#sceneReplay').addEventListener('click', play);
    return { play, stop: reset };
})();

/* ───────── 第 2 步：自己玩浮動按鈕 ───────── */
const tryDemo = (() => {
    const mock = $('#tryMock');
    const hint = $('#tryHint');
    const summary = $('#trySummary');
    let fl = null;
    let state = null;
    const toast = document.createElement('div');
    toast.className = 'toast';
    mock.appendChild(toast);

    function renderSummary() {
        summary.textContent = state ? t('s2_summary', state) : t('s2_drag');
    }

    function runProbe() {
        const ok = new Set();
        const count = 3 + Math.floor(Math.random() * 2);
        while (ok.size < count) ok.add(Math.floor(Math.random() * SITES.length));
        state = null;
        summary.textContent = '…';
        fl.probe(SITES, ok, () => {
            state = { total: SITES.length, ok: ok.size };
            renderSummary();
        });
    }

    function setup() {
        if (fl) fl.stop();
        hint.classList.remove('off');
        state = null;
        fl = createFloating(mock, { interactive: true, onOpenSite: (site) => showToast(toast, t('scene_open', { site })) });
        let probed = false;
        fl.onToggle = (willOpen) => {
            hint.classList.add('off');
            if (!willOpen) return fl.close();
            fl.open();
            if (!probed) { probed = true; runProbe(); }
        };
        summary.textContent = t('s2_drag');
    }

    $('#tryReplay').addEventListener('click', () => {
        setup();
        fl.onToggle(true);
    });
    return { setup, renderSummary, stop: () => fl && fl.stop() };
})();

/* ───────── 第 3 步：Token 實驗室（規則同 README） ───────── */
const lab = (() => {
    const codeIn = $('#labCode');
    const tplIn = $('#labTpl');
    const out = $('#labOut');

    function normalizeCode(value) {
        const code = String(value || '').normalize('NFKC').trim().toUpperCase()
            .replace(/[\s_]+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        return code;
    }
    function transforms(code) {
        const nodash = code.replace(/[^A-Za-z0-9]/g, '');
        const m = code.match(/^([A-Za-z]+)-?(\d+)$/);
        const dmm = m ? m[1].toLowerCase() + m[2].padStart(5, '0') : nodash.toLowerCase();
        return { raw: code, lower: code.toLowerCase(), upper: code.toUpperCase(), nodash, dmm };
    }

    function render() {
        const code = normalizeCode(codeIn.value);
        const vals = transforms(code);
        $$('.val').forEach((el) => { el.textContent = code ? vals[el.dataset.val] : '-'; el.title = el.textContent; });
        const tpl = tplIn.value;
        const used = new Set();
        out.textContent = '';
        const re = /\{(lower|upper|nodash|dmm)?\}/g;
        let last = 0;
        let m;
        while ((m = re.exec(tpl))) {
            out.append(document.createTextNode(tpl.slice(last, m.index)));
            const key = m[1] || 'raw';
            used.add(m[0]);
            const mark = document.createElement('mark');
            mark.textContent = code ? encodeURIComponent(vals[key]) : m[0];
            out.append(mark);
            last = m.index + m[0].length;
        }
        out.append(document.createTextNode(tpl.slice(last)));
        $$('.tok-row').forEach((row) => row.classList.toggle('used', used.has(row.dataset.token)));
        $$('#labExamples .chip-btn').forEach((b) => b.classList.toggle('on', b.dataset.code === normalizeCode(codeIn.value)));
    }

    codeIn.addEventListener('input', render);
    tplIn.addEventListener('input', render);
    $('#labExamples').addEventListener('click', (e) => {
        const b = e.target.closest('.chip-btn');
        if (!b) return;
        codeIn.value = b.dataset.code;
        render();
    });
    $('.lab-tab').addEventListener('click', (e) => {
        const row = e.target.closest('.tok-row');
        if (!row) return;
        const start = tplIn.selectionStart ?? tplIn.value.length;
        const end = tplIn.selectionEnd ?? start;
        tplIn.value = tplIn.value.slice(0, start) + row.dataset.token + tplIn.value.slice(end);
        const pos = start + row.dataset.token.length;
        tplIn.focus();
        tplIn.setSelectionRange(pos, pos);
        render();
    });
    return { render };
})();

/* ───────── 第 4 步：右鍵選單示範 ───────── */
const ctxDemo = (() => {
    const mock = $('#ctxMock');
    const sample = $('#ctxSample');
    const menu = $('#ctxMenu');
    const toast = $('#ctxToast');
    const hint = $('.hint-chip', mock);
    const cursor = $('.cursor', mock);
    const tl = makeTimeline();
    const CODE = 'IPZZ-914';

    function renderSample() {
        const parts = raw('s4_text').split('{code}');
        sample.textContent = '';
        sample.append(document.createTextNode(parts[0] || ''));
        const span = document.createElement('span');
        span.className = 'c';
        span.textContent = CODE;
        sample.append(span, document.createTextNode(parts[1] || ''));
    }

    function item(label, cls = '') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ctx-item ${cls}`.trim();
        b.setAttribute('role', 'menuitem');
        const s = document.createElement('span');
        s.textContent = label;
        b.append(s);
        return b;
    }

    function build(q) {
        menu.textContent = '';
        const short = q.length > 18 ? `${q.slice(0, 18)}…` : q;
        menu.append(item(t('s4_copy')));
        const sep1 = document.createElement('div'); sep1.className = 'ctx-sep'; menu.append(sep1);
        menu.append(item(t('s4_google', { q: short })));
        const ql = item(t('s4_ql', { q: short }), 'ql');
        const arrow = document.createElement('span'); arrow.textContent = '▸'; ql.append(arrow);
        const sub = document.createElement('div');
        sub.className = 'ctx-sub';
        sub.setAttribute('role', 'menu');
        SITES.forEach((s) => {
            const si = item(s.n);
            si.dataset.site = s.n;
            sub.append(si);
        });
        ql.append(sub);
        menu.append(ql);
        return { ql, sub };
    }

    function openAt(x, y, q) {
        const { ql, sub } = build(q);
        menu.hidden = false;
        const w = menu.offsetWidth, h = menu.offsetHeight;
        const nx = Math.max(6, Math.min(x, mock.clientWidth - w - 6));
        const ny = Math.max(38, Math.min(y, mock.clientHeight - h - 6));
        menu.style.left = `${nx}px`;
        menu.style.top = `${ny}px`;
        sub.classList.toggle('flip', nx + w + 200 > mock.clientWidth);
        ql.addEventListener('mouseenter', () => openSub(ql));
        return { ql, sub, nx, ny };
    }
    // 子選單放不下時往上移，確保 7 個站台都在示範視窗內
    function fitSub(sub) {
        sub.style.top = '-7px';
        const m = mock.getBoundingClientRect();
        const r = sub.getBoundingClientRect();
        const over = r.bottom - (m.bottom - 16);
        if (over > 0) sub.style.top = `${-7 - Math.min(over, r.top - (m.top + 40) + 7)}px`;
    }
    function openSub(ql) {
        ql.classList.add('open');
        fitSub($('.ctx-sub', ql));
    }
    function closeMenu() { menu.hidden = true; }

    mock.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.page')) return;
        e.preventDefault();
        const q = window.getSelection().toString().trim();
        if (!q) {
            hint.classList.remove('shake');
            void hint.offsetWidth;
            hint.classList.add('shake');
            return;
        }
        const r = mock.getBoundingClientRect();
        openAt(e.clientX - r.left, e.clientY - r.top, q);
    });

    menu.addEventListener('click', (e) => {
        const it = e.target.closest('.ctx-item');
        if (!it) return;
        if (it.classList.contains('ql')) { if (it.classList.contains('open')) it.classList.remove('open'); else openSub(it); return; }
        const site = it.dataset.site;
        closeMenu();
        if (site) showToast(toast, t('s4_opened', { site }));
    });
    document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('#ctxMenu')) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    function auto() {
        tl.clear();
        closeMenu();
        window.getSelection().removeAllRanges();
        cursor.style.transition = 'none';
        moveCursor(cursor, 60, 240);
        void cursor.offsetWidth;
        cursor.style.transition = '';
        cursor.classList.add('on');
        const codeEl = $('.c', sample);
        const p = relCenter(codeEl, mock, 0.2, 0.5);
        tl.after(100, () => moveCursor(cursor, p.x, p.y));
        tl.after(1200, () => {
            const range = document.createRange();
            range.selectNodeContents(codeEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        });
        let pos;
        tl.after(1900, () => {
            const end = relCenter(codeEl, mock, 0.6, 1);
            moveCursor(cursor, end.x, end.y);
        });
        tl.after(2900, () => {
            clickCursor(cursor);
            const c = relCenter(codeEl, mock, 0.6, 1);
            pos = openAt(c.x, c.y + 6, CODE);
        });
        tl.after(3700, () => {
            const q = $('.ctx-item.ql', menu);
            const qp = relCenter(q, mock, 0.4, 0.5);
            moveCursor(cursor, qp.x, qp.y);
        });
        tl.after(4500, () => pos && openSub(pos.ql));
        tl.after(5100, () => {
            const first = $('.ctx-sub .ctx-item', menu);
            if (!first) return;
            const fp = relCenter(first, mock, 0.4, 0.5);
            moveCursor(cursor, fp.x, fp.y);
        });
        tl.after(6300, () => {
            clickCursor(cursor);
            closeMenu();
            showToast(toast, t('s4_opened', { site: SITES[0].n }));
        });
        tl.after(7800, () => cursor.classList.remove('on'));
    }

    $('#ctxAuto').addEventListener('click', auto);
    return { renderSample, stop: () => { tl.clear(); closeMenu(); cursor.classList.remove('on'); } };
})();

/* ───────── 第 5 步：偏好設定（真的寫入 storage）＋掃描模式賽跑動畫 ───────── */
const prefsUi = (() => {
    const cards = $$('.scan-card');
    const savedTag = $('#savedTag');
    const tl = makeTimeline();
    let savedTimer;

    // 每張卡片 5 條跑道
    cards.forEach((card) => {
        const race = $('.race', card);
        for (let i = 0; i < 5; i++) {
            const lane = document.createElement('div');
            lane.className = 'lane';
            lane.innerHTML = '<i></i>';
            race.append(lane);
        }
        const cap = document.createElement('div');
        cap.className = 'race-cap';
        race.append(cap);
    });

    function flashSaved() {
        savedTag.classList.add('show');
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => savedTag.classList.remove('show'), 1400);
    }

    function raceCard(card) {
        const lanes = $$('.lane', card);
        const cap = $('.race-cap', card);
        const mode = card.dataset.scan;
        // 重置：先關掉 transition 再移除 class，進度條立刻回到 0（不能留內聯 width，否則會蓋掉 .run 的 100%）
        lanes.forEach((l) => {
            const i = $('i', l);
            i.style.transition = 'none';
            l.className = 'lane';
            void i.offsetWidth;
            i.style.transition = '';
        });
        cap.textContent = '';
        const run = (lane, ms) => { lane.style.setProperty('--t', `${ms}ms`); lane.classList.add('run'); };
        if (mode === 'bestMatch') {
            const plan = [false, false, true];
            let t0 = 200;
            plan.forEach((ok, i) => {
                tl.after(t0, () => run(lanes[i], 520));
                if (ok) tl.after(t0 + 540, () => lanes[i].classList.add('ok'));
                t0 += 560;
            });
            tl.after(t0, () => {
                lanes[3].classList.add('skip'); lanes[4].classList.add('skip');
                cap.textContent = `✓ 1 ${raw('scan_found')} · ${raw('scan_skipped')} 2`;
            });
        } else {
            const plan = [{ ok: false, ms: 700 }, { ok: true, ms: 1100 }, { ok: true, ms: 600 }, { ok: false, ms: 1400 }, { ok: true, ms: 900 }];
            plan.forEach((p, i) => {
                tl.after(200, () => run(lanes[i], p.ms));
                if (p.ok) tl.after(200 + p.ms + 20, () => lanes[i].classList.add('ok'));
            });
            tl.after(200 + 1500, () => { cap.textContent = `✓ 3 ${raw('scan_found')}`; });
        }
    }

    // 靜態最終結果（與動畫跑完時的畫面一致）
    function finalRace(card) {
        const lanes = $$('.lane', card);
        const cap = $('.race-cap', card);
        lanes.forEach((l) => { l.className = 'lane run'; $('i', l).style.transition = 'none'; });
        if (card.dataset.scan === 'bestMatch') {
            lanes[2].classList.add('ok');
            lanes[3].classList.add('skip');
            lanes[4].classList.add('skip');
            cap.textContent = `✓ 1 ${raw('scan_found')} · ${raw('scan_skipped')} 2`;
        } else {
            [1, 2, 4].forEach((i) => lanes[i].classList.add('ok'));
            cap.textContent = `✓ 3 ${raw('scan_found')}`;
        }
    }

    function playRaces() {
        tl.clear();
        if (reduceMotion()) {
            cards.forEach(finalRace);
            return;
        }
        cards.forEach(raceCard);
        tl.after(7000, playRaces);
    }

    function applyScanChecked() {
        cards.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.scan === prefs.scanMode)));
    }

    cards.forEach((card) => card.addEventListener('click', async () => {
        prefs.scanMode = card.dataset.scan;
        applyScanChecked();
        await setSync({ scanMode: prefs.scanMode });
        flashSaved();
        tl.clear();
        raceCard(card);
        const other = cards.find((c) => c !== card);
        tl.after(300, () => raceCard(other));
        tl.after(7500, playRaces);
    }));

    $$('[data-pref]').forEach((box) => box.addEventListener('change', async () => {
        prefs[box.dataset.pref] = box.checked;
        await setSync({ [box.dataset.pref]: box.checked });
        flashSaved();
    }));
    $('#raceReplay').addEventListener('click', playRaces);

    function sync() {
        applyScanChecked();
        $$('[data-pref]').forEach((box) => { box.checked = !!prefs[box.dataset.pref]; });
    }
    return { sync, playRaces, stop: () => tl.clear(), renderCaps: () => {} };
})();

/* ───────── 語言與主題 ───────── */
function applyTheme(mode) {
    if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    $$('[data-theme-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeMode === mode)));
}

function applyMotion() {
    document.documentElement.dataset.motion = motionPaused ? 'off' : 'on';
    const btn = $('#motionBtn');
    const key = motionPaused ? 'motion_play' : 'motion_pause';
    btn.querySelector('span').textContent = raw(key);
    btn.querySelector('.ic-pause').hidden = motionPaused;
    btn.querySelector('.ic-play').hidden = !motionPaused;
}

function applyLang() {
    lang = resolveLang(prefs.language);
    document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : lang === 'zh-CN' ? 'zh-Hans' : lang;
    document.title = t('meta_title');
    $$('[data-i18n]').forEach((el) => { el.textContent = raw(el.dataset.i18n); });
    $$('[data-i18n-title]').forEach((el) => { el.title = raw(el.dataset.i18nTitle); });
    $$('.step').forEach((s) => {
        $('.eyebrow', s).textContent = t('step_of', { n: s.dataset.step, total: TOTAL });
    });
    $('#langSel').value = prefs.language;
    ctxDemo.renderSample();
    tryDemo.renderSummary();
    applyMotion();
}

/* ───────── 鏈條式步驟列 ───────── */
const stepper = $('#stepper');
for (let n = 1; n <= TOTAL; n++) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="node-btn" data-go="${n}">${n}</button><span class="node-lbl" data-i18n="lbl_${n}"></span>`;
    stepper.append(li);
}

/* ───────── 換頁 ───────── */
const steps = $$('.step');
let current = 0;
const CONFETTI = ['#667eea', '#9b6bd6', '#38bdf8', '#28a745', '#ffc107', '#fd7e14', '#f472b6'];

function burst(x, y, count = 36) {
    if (reduceMotion()) return;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('i');
        dot.className = 'chip';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        dot.style.background = CONFETTI[i % CONFETTI.length];
        dot.style.setProperty('--dx', `${(Math.random() - 0.5) * 560}px`);
        dot.style.setProperty('--dy', `${-140 - Math.random() * 280 + Math.random() * 300}px`);
        dot.style.animationDelay = `${Math.random() * 90}ms`;
        document.body.appendChild(dot);
        dot.addEventListener('animationend', () => dot.remove());
    }
}

function leaveAll() {
    scene.stop();
    tryDemo.stop();
    ctxDemo.stop();
    prefsUi.stop();
}

function enter(n) {
    leaveAll();
    if (n === 1) scene.play();
    else if (n === 2) tryDemo.setup();
    else if (n === 3) lab.render();
    else if (n === 5) prefsUi.playRaces();
    else if (n === 6) {
        setTimeout(() => {
            const r = $('.step[data-step="6"] .checklist').getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + 20);
        }, 300);
    }
}

function show(n, { push = true } = {}) {
    n = Math.max(1, Math.min(n, TOTAL));
    if (n === current) return;
    const dir = n > current ? 'fwd' : 'back';
    current = n;
    steps.forEach((s) => {
        const active = Number(s.dataset.step) === n;
        s.classList.toggle('active', active);
        s.classList.remove('fwd', 'back');
        if (active) s.classList.add(dir);
    });
    $$('#stepper li').forEach((li, i) => {
        li.classList.toggle('done', i + 1 < n);
        li.classList.toggle('current', i + 1 === n);
        const b = $('.node-btn', li);
        if (i + 1 === n) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
    });
    // pushState：瀏覽器「上一頁」可回到前一步；popstate 觸發的換頁與首次載入不再新增歷史
    if (push) history.pushState({ n }, '', `#step-${n}`);
    else history.replaceState({ n }, '', `#step-${n}`);
    window.scrollTo(0, 0);
    const h = $(`.step[data-step="${n}"] h1`);
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
    enter(n);
}

/* ───────── 事件 ───────── */
document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) return show(Number(go.dataset.go));

    const nav = e.target.closest('[data-nav]');
    if (nav) {
        const kind = nav.dataset.nav;
        if (kind === 'next' || kind === 'skip') show(current + 1);
        else if (kind === 'prev') show(current - 1);
        else if (kind === 'finish') {
            const r = nav.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 2, 48);
            setTimeout(() => window.close(), reduceMotion() ? 0 : 650);
        }
        return;
    }

    const themeBtn = e.target.closest('[data-theme-mode]');
    if (themeBtn) {
        prefs.themeMode = themeBtn.dataset.themeMode;
        applyTheme(prefs.themeMode);
        setSync({ themeMode: prefs.themeMode });
        return;
    }

    if (e.target.closest('#motionBtn')) {
        motionPaused = !motionPaused;
        try { localStorage.setItem('ql_welcome_motion', motionPaused ? 'off' : 'on'); } catch (err) { /* 無法儲存就只在本次生效 */ }
        applyMotion();
        leaveAll();
        enter(current);
        return;
    }

    if (e.target.closest('#openOptions')) {
        if (globalThis.chrome?.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
    }
});

$('#langSel').addEventListener('change', (e) => {
    prefs.language = e.target.value;
    setSync({ language: prefs.language });
    applyLang();
});

document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight') show(current + 1);
    else if (e.key === 'ArrowLeft') show(current - 1);
});

// 瀏覽器「上一頁／下一頁」：切到對應步驟，不重複寫入歷史
window.addEventListener('popstate', () => {
    const m = location.hash.match(/step-(\d)/);
    if (m && Number(m[1]) !== current) show(Number(m[1]), { push: false });
});

/* ───────── 啟動 ───────── */
(async function init() {
    Object.assign(prefs, await getSync(prefs));
    applyTheme(prefs.themeMode);
    applyLang();
    prefsUi.sync();
    lab.render();
    console.log('[QuickLinker] 教學頁已載入，語言:', lang, '主題:', prefs.themeMode);
    const initial = location.hash.match(/step-(\d)/);
    show(initial ? Number(initial[1]) : 1, { push: false });
})();
