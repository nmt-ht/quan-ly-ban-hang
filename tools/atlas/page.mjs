// Dựng một trang HTML duy nhất để đọc toàn bộ tài liệu Atlas (dùng cho trang Artifact).
// Chạy: node tools/atlas/page.mjs [đường-dẫn-ra]   (mặc định dist/atlas.html)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSources } from './build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, '../../dist/atlas.html'));

const docs = loadSources().map((d) => ({
  id: d.meta['Mã tài liệu'].toLowerCase(),
  code: d.meta['Mã tài liệu'],
  title: d.meta.title,
  module: d.meta['Phân hệ'],
  route: d.meta['Đường dẫn'],
  version: d.meta['Phiên bản'],
  blocks: d.blocks,
}));

const json = JSON.stringify(docs).replace(/</g, '\\u003c');
const version = docs[0]?.version ?? '';

const html = `<title>Ninh Trang Atlas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Bố cục: thanh mục lục cố định bên trái (nhóm theo phân hệ như menu của phần mềm), một tài liệu mỗi lần ở giữa. */
:root {
  --bg: #f6f7f4;
  --surface: #ffffff;
  --sunk: #eef0ea;
  --line: #dde1d6;
  --fg: #1c2119;
  --muted: #5c6556;
  --moss: #46622f;
  --moss-soft: #e6eedc;
  --flow: #e9f0f8;
  --flow-line: #c3d3e6;
  --m-sell: #2563c9;
  --m-stock: #c2620a;
  --m-buy: #7a4fc2;
  --m-cash: #0d8a7b;
  --m-set: #4f6876;
  --m-core: #46622f;
  --new: #b4570f;
  --font-body: "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Consolas, monospace;
  --side: 300px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #151813; --surface: #1c2019; --sunk: #232820; --line: #333a2e; --fg: #e6e9e1; --muted: #a0a898;
    --moss: #a9c98a; --moss-soft: #2a3423; --flow: #1f2a36; --flow-line: #34485e;
    --m-sell: #7ea9f2; --m-stock: #f0a35c; --m-buy: #b79af0; --m-cash: #5fcfbf; --m-set: #9db3c0; --m-core: #a9c98a; --new: #f0a35c;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #151813; --surface: #1c2019; --sunk: #232820; --line: #333a2e; --fg: #e6e9e1; --muted: #a0a898;
  --moss: #a9c98a; --moss-soft: #2a3423; --flow: #1f2a36; --flow-line: #34485e;
  --m-sell: #7ea9f2; --m-stock: #f0a35c; --m-buy: #b79af0; --m-cash: #5fcfbf; --m-set: #9db3c0; --m-core: #a9c98a; --new: #f0a35c;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 15px; line-height: 1.6; }
a { color: var(--moss); }
a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--moss); outline-offset: 2px; border-radius: 4px; }
code, .mono { font-family: var(--font-mono); font-size: .86em; }
code { background: var(--sunk); border-radius: 4px; padding: .05em .35em; overflow-wrap: anywhere; }

.app { display: grid; grid-template-columns: var(--side) minmax(0, 1fr); min-height: 100vh; }
.side { position: sticky; top: env(safe-area-inset-top, 0px); height: 100vh; overflow-y: auto; border-right: 1px solid var(--line); background: var(--surface);
  padding-block: 20px 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: 16px; display: flex; flex-direction: column; gap: 16px; }
.brand { display: flex; gap: 10px; align-items: center; }
.brand-mark { width: 36px; height: 36px; border-radius: 8px; background: var(--moss); color: var(--surface); display: grid; place-items: center; font-weight: 800; letter-spacing: .02em; flex: none; }
.brand b { display: block; font-size: 15px; line-height: 1.2; }
.brand span { color: var(--muted); font-size: 12.5px; }
.search { position: relative; }
.search input { width: 100%; font: inherit; font-size: 14px; padding: 8px 34px 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg); }
.search kbd { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-family: var(--font-mono); font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
.groups { display: flex; flex-direction: column; gap: 14px; }
.group h2 { margin: 0 0 4px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .08em; color: var(--gc, var(--muted)); font-weight: 700; display: flex; align-items: center; gap: 6px; }
.group h2::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--gc, var(--muted)); }
.group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.nav-link { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; gap: 6px; align-items: baseline; text-decoration: none; color: var(--fg); padding: 5px 8px; border-radius: 6px; font-size: 14px; line-height: 1.35; }
.nav-link .mono { color: var(--muted); font-size: 11.5px; }
.nav-link:hover { background: var(--sunk); }
.nav-link[aria-current="page"] { background: var(--moss-soft); color: var(--fg); font-weight: 600; }
.nav-link[aria-current="page"] .mono { color: var(--moss); }
.badge-new { font-size: 10.5px; font-weight: 700; color: var(--new); border: 1px solid currentColor; border-radius: 999px; padding: 0 6px; letter-spacing: .02em; }
.results { display: flex; flex-direction: column; gap: 6px; }
.result { display: block; text-decoration: none; color: var(--fg); padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.result:hover { border-color: var(--moss); }
.result b { font-size: 14px; }
.result small { display: block; color: var(--muted); font-size: 12.5px; line-height: 1.45; margin-top: 2px; }
mark { background: color-mix(in srgb, var(--m-stock) 28%, transparent); color: inherit; border-radius: 2px; padding: 0 1px; }
.empty-search { color: var(--muted); font-size: 13.5px; }

.main { min-width: 0; padding-block: 28px 64px; padding-left: 40px; padding-right: max(40px, env(safe-area-inset-right, 0px)); }
.doc { max-width: 980px; margin: 0 auto; }
.crumbs { font-size: 12.5px; color: var(--muted); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.crumbs .chip { color: var(--mc); background: color-mix(in srgb, var(--mc) 12%, transparent); border-radius: 999px; padding: 1px 10px; font-weight: 600; }
.doc h1 { font-size: clamp(26px, 3.2vw, 36px); line-height: 1.15; margin: 8px 0 14px; letter-spacing: -.01em; text-wrap: balance; font-weight: 800; }
.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin-bottom: 8px; }
.meta div { background: var(--surface); padding: 8px 12px; min-width: 0; }
.meta dt { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); }
.meta dd { margin: 0; font-size: 13.5px; overflow-wrap: anywhere; }
.toc { display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0 4px; }
.toc a { font-size: 12.5px; text-decoration: none; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; background: var(--surface); }
.toc a:hover { color: var(--fg); border-color: var(--moss); }
.doc h2 { font-size: 21px; margin: 36px 0 10px; padding-top: 8px; border-top: 1px solid var(--line); text-wrap: balance; scroll-margin-top: 16px; }
.doc h3 { font-size: 16.5px; margin: 22px 0 6px; color: var(--moss); }
.doc p { margin: 0 0 10px; max-width: 72ch; }
.doc ul, .doc ol { margin: 0 0 12px; padding-left: 22px; max-width: 80ch; }
.doc li { margin-bottom: 5px; }
.doc li::marker { color: var(--muted); }
.note { border-left: 3px solid var(--moss); background: var(--moss-soft); padding: 8px 12px; border-radius: 0 8px 8px 0; font-size: 13.5px; color: var(--fg); max-width: 80ch; margin: 4px 0 14px; }
.flow { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; margin: 10px 0 4px; }
.flow .step { background: var(--flow); border: 1px solid var(--flow-line); border-radius: 8px; padding: 7px 12px; font-weight: 600; font-size: 13.5px; display: flex; align-items: center; line-height: 1.35; }
.flow .arrow { color: var(--muted); display: flex; align-items: center; font-size: 16px; }
.flow-next { color: var(--muted); font-size: 12px; margin: 0 0 0 4px; }
.table-wrap { overflow-x: auto; margin: 12px 0 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; line-height: 1.5; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid var(--line); }
th { background: var(--sunk); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 700; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td:first-child { font-weight: 600; }
td.num { font-variant-numeric: tabular-nums; color: var(--muted); width: 1%; white-space: nowrap; font-weight: 500; }
.ref { font-family: var(--font-mono); font-size: .84em; font-weight: 600; text-decoration: none; background: var(--moss-soft); border-radius: 4px; padding: 0 4px; white-space: nowrap; }
.pager { display: flex; justify-content: space-between; gap: 12px; margin-top: 44px; flex-wrap: wrap; }
.pager a { flex: 1 1 220px; text-decoration: none; color: var(--fg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--surface); min-width: 0; }
.pager a:hover { border-color: var(--moss); }
.pager small { display: block; color: var(--muted); font-size: 12px; }
.pager .next { text-align: right; }
.menu-toggle { display: none; }

@media (max-width: 900px) {
  .app { grid-template-columns: minmax(0, 1fr); }
  .side { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  .groups[data-collapsed="true"] { display: none; }
  .menu-toggle { display: inline-flex; align-self: flex-start; font: inherit; font-size: 13.5px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
  .main { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
}
@media (prefers-reduced-motion: no-preference) { .nav-link, .result, .pager a, .toc a { transition: background-color .12s, border-color .12s; } }
</style>

<div class="app">
  <aside class="side" aria-label="Mục lục tài liệu">
    <div class="brand"><div class="brand-mark">NT</div><div><b>Ninh Trang Atlas</b><span>Tài liệu chức năng · bản ${version.split(' — ')[0]} · ${docs.length} tài liệu</span></div></div>
    <div class="search"><input id="q" type="search" placeholder="Tìm trong tài liệu…" aria-label="Tìm trong tài liệu" autocomplete="off"><kbd>/</kbd></div>
    <button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="groups">Mục lục</button>
    <div class="results" id="results" hidden></div>
    <nav class="groups" id="groups" data-collapsed="true"></nav>
  </aside>
  <main class="main"><article class="doc" id="doc" aria-live="polite"></article></main>
</div>

<script type="application/json" id="atlas-data">${json}</script>
<script>
(() => {
  const DOCS = JSON.parse(document.getElementById('atlas-data').textContent);
  const NEW = new Set(['atl-27', 'atl-28', 'atl-29', 'atl-30', 'atl-31', 'atl-32', 'atl-33', 'atl-34']);
  // Nhóm theo phân hệ, đúng thứ tự và màu của menu trong phần mềm.
  const GROUPS = [
    { name: 'Bắt đầu', color: 'var(--m-core)', ids: ['atl-00', 'atl-01', 'atl-02', 'atl-03'] },
    { name: 'Nghiệp vụ (kho, sản xuất)', color: 'var(--m-stock)', ids: ['atl-04', 'atl-05', 'atl-06', 'atl-07'] },
    { name: 'Mua hàng', color: 'var(--m-buy)', ids: ['atl-08', 'atl-09', 'atl-10'] },
    { name: 'Bán hàng', color: 'var(--m-sell)', ids: ['atl-11', 'atl-28', 'atl-29', 'atl-30', 'atl-12', 'atl-13', 'atl-14', 'atl-15', 'atl-31'] },
    { name: 'Dòng tiền', color: 'var(--m-cash)', ids: ['atl-16', 'atl-17', 'atl-18', 'atl-19'] },
    { name: 'Thiết lập', color: 'var(--m-set)', ids: ['atl-20', 'atl-32', 'atl-33', 'atl-21', 'atl-22', 'atl-23', 'atl-24', 'atl-27'] },
    { name: 'Hệ thống', color: 'var(--m-core)', ids: ['atl-25', 'atl-26', 'atl-34'] },
  ];
  const byId = new Map(DOCS.map((d) => [d.id, d]));
  const colorOf = (id) => (GROUPS.find((g) => g.ids.includes(id)) || GROUPS[0]).color;
  const order = GROUPS.flatMap((g) => g.ids).filter((id) => byId.has(id));
  for (const d of DOCS) if (!order.includes(d.id)) order.push(d.id);

  const fold = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inline(s) {
    let h = esc(s).replace(/&lt;br&gt;/g, '<br>');
    h = h.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[\\s(«"])(\\/[a-z][a-z0-9\\-\\/:.?=&;<>]*[a-z0-9>])/g, (m, pre, p) => pre + '<code>' + p + '</code>');
    h = h.replace(/\\bATL-(\\d{2})\\b/g, (m, n) => byId.has('atl-' + n) ? '<a class="ref" href="#atl-' + n + '" title="' + esc(byId.get('atl-' + n).title) + '">' + m + '</a>' : m);
    return h;
  }
  const slug = (s) => 's-' + fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function renderDoc(d) {
    const parts = [];
    const mc = colorOf(d.id);
    parts.push('<div class="crumbs"><span class="chip" style="--mc:' + mc + '">' + esc(d.module) + '</span><span class="mono">' + esc(d.code) + '</span>' + (NEW.has(d.id) ? '<span class="badge-new">Mới</span>' : '') + '</div>');
    parts.push('<h1>' + esc(d.title) + '</h1>');
    parts.push('<dl class="meta"><div><dt>Mã tài liệu</dt><dd class="mono">' + esc(d.code) + '</dd></div><div><dt>Phân hệ</dt><dd>' + esc(d.module) + '</dd></div><div><dt>Đường dẫn</dt><dd>' + inline(d.route) + '</dd></div><div><dt>Phiên bản</dt><dd>' + esc(d.version) + '</dd></div></dl>');
    const h1s = d.blocks.filter((b) => b.t === 'h1');
    parts.push('<nav class="toc" aria-label="Các mục">' + h1s.map((b) => '<a href="#' + d.id + '" data-jump="' + slug(b.text) + '">' + esc(b.text) + '</a>').join('') + '</nav>');
    for (const b of d.blocks) {
      if (b.t === 'h1') parts.push('<h2 id="' + slug(b.text) + '">' + esc(b.text) + '</h2>');
      else if (b.t === 'h2') parts.push('<h3>' + esc(b.text) + '</h3>');
      else if (b.t === 'p') parts.push('<p>' + inline(b.text) + '</p>');
      else if (b.t === 'note') parts.push('<p class="note">' + inline(b.text) + '</p>');
      else if (b.t === 'ul') parts.push('<ul>' + b.items.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul>');
      else if (b.t === 'ol') parts.push('<ol>' + b.items.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ol>');
      else if (b.t === 'next') parts.push('<p class="flow-next">↓ tiếp theo</p>');
      else if (b.t === 'flow') parts.push('<div class="flow" role="list">' + b.items.map((x, i) => (i ? '<span class="arrow" aria-hidden="true">→</span>' : '') + '<span class="step" role="listitem">' + inline(x) + '</span>').join('') + '</div>');
      else if (b.t === 'table') {
        const rows = b.rows;
        const head = b.header ? rows[0] : null;
        const body = b.header ? rows.slice(1) : rows;
        const numCol = head && /^(Bước|STT)$/.test(head[0]);
        parts.push('<div class="table-wrap"><table>' + (head ? '<thead><tr>' + head.map((c) => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead>' : '') + '<tbody>' + body.map((r) => '<tr>' + r.map((c, i) => '<td' + (numCol && i === 0 ? ' class="num"' : '') + '>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      }
    }
    const k = order.indexOf(d.id);
    const prev = byId.get(order[k - 1]);
    const next = byId.get(order[k + 1]);
    parts.push('<nav class="pager" aria-label="Tài liệu trước và sau">' + (prev ? '<a href="#' + prev.id + '"><small>← Trước · ' + prev.code + '</small>' + esc(prev.title) + '</a>' : '<span></span>') + (next ? '<a class="next" href="#' + next.id + '"><small>Sau · ' + next.code + ' →</small>' + esc(next.title) + '</a>' : '') + '</nav>');
    return parts.join('');
  }

  const groupsEl = document.getElementById('groups');
  groupsEl.innerHTML = GROUPS.map((g) => '<section class="group" style="--gc:' + g.color + '"><h2>' + esc(g.name) + '</h2><ul>' + g.ids.filter((id) => byId.has(id)).map((id) => {
    const d = byId.get(id);
    return '<li><a class="nav-link" href="#' + id + '" data-id="' + id + '"><span class="mono">' + d.code + '</span><span>' + esc(d.title) + '</span>' + (NEW.has(id) ? '<span class="badge-new">Mới</span>' : '') + '</a></li>';
  }).join('') + '</ul></section>').join('');

  const docEl = document.getElementById('doc');
  function show() {
    const id = (location.hash || '').slice(1).toLowerCase();
    const d = byId.get(id) || byId.get('atl-00');
    docEl.innerHTML = renderDoc(d);
    for (const a of groupsEl.querySelectorAll('.nav-link')) {
      if (a.dataset.id === d.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    document.title = d.code + ' · ' + d.title + ' — Ninh Trang Atlas';
    if (byId.has(id)) window.scrollTo(0, 0);
    if (window.matchMedia('(max-width: 900px)').matches) setMenu(false);
  }
  docEl.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (!j) return;
    e.preventDefault();
    document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  window.addEventListener('hashchange', show);

  const toggle = document.getElementById('menu-toggle');
  function setMenu(open) { groupsEl.dataset.collapsed = String(!open); toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Ẩn mục lục' : 'Mục lục (' + DOCS.length + ' tài liệu)'; }
  toggle.addEventListener('click', () => setMenu(groupsEl.dataset.collapsed === 'true'));
  setMenu(false);

  // Tìm không dấu trong toàn bộ nội dung; tài liệu khớp ở tên đứng trước.
  const index = DOCS.map((d) => {
    const text = d.blocks.map((b) => b.text || (b.items || []).join(' ') || (b.rows || []).flat().join(' ')).join(' \\n ').replace(/\\*\\*/g, '').replace(/<br>/g, ' ');
    return { d, title: fold(d.code + ' ' + d.title), text, ftext: fold(text) };
  });
  const q = document.getElementById('q');
  const resultsEl = document.getElementById('results');
  function snippet(it, words) {
    const i = it.ftext.indexOf(words[0]);
    if (i < 0) return '';
    // fold() giữ nguyên độ dài chuỗi nên vị trí trong bản không dấu dùng được cho bản gốc
    const a = Math.max(0, i - 50), b = Math.min(it.text.length, i + 110);
    const raw = (a ? '…' : '') + it.text.slice(a, b);
    const start = i - a + (a ? 1 : 0), end = start + words[0].length;
    return esc(raw.slice(0, start)) + '<mark>' + esc(raw.slice(start, end)) + '</mark>' + esc(raw.slice(end)) + (b < it.text.length ? '…' : '');
  }
  function search() {
    const words = fold(q.value.trim()).split(/\\s+/).filter(Boolean);
    if (!words.length) { resultsEl.hidden = true; resultsEl.innerHTML = ''; groupsEl.hidden = false; return; }
    const hits = index.filter((it) => words.every((w) => it.title.includes(w) || it.ftext.includes(w)))
      .map((it) => ({ it, score: words.filter((w) => it.title.includes(w)).length * 100 + words.reduce((n, w) => n + it.ftext.split(w).length - 1, 0) }))
      .sort((a, b) => b.score - a.score);
    groupsEl.hidden = true;
    resultsEl.hidden = false;
    resultsEl.innerHTML = hits.length
      ? hits.map(({ it }) => '<a class="result" href="#' + it.d.id + '"><b><span class="mono">' + it.d.code + '</span> ' + esc(it.d.title) + '</b><small>' + snippet(it, words) + '</small></a>').join('')
      : '<p class="empty-search">Không có tài liệu nào khớp. Thử gõ một phần tên chức năng, mã chứng từ (DH, PNK…) hoặc đường dẫn.</p>';
  }
  q.addEventListener('input', search);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { q.value = ''; search(); }
    if (e.key === 'Enter') { const first = resultsEl.querySelector('a'); if (first) { location.hash = first.getAttribute('href'); } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { e.preventDefault(); q.focus(); }
  });

  show();
})();
</script>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, Math.round(html.length / 1024) + ' KB');
