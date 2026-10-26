// Dựng file Excel kết quả kiểm thử từ các file JSON do bộ test sinh ra.
//
//   node tools/qa/build-report.mjs <thư mục json> <file .xlsx>
//
// Thư mục json chứa:
//   qa-matrix.json  backend/test/permission-matrix.e2e-spec.ts với QA_REPORT=… (kịch bản + ma trận API + quyền)
//   e2e.json        vitest --reporter=json của toàn bộ e2e backend
//   unit-be.json    vitest --reporter=json của unit test backend
//   unit-fe.json    (tuỳ chọn) kết quả unit test frontend dạng vitest json
//   ui.json         (tuỳ chọn) tools/qa/ui-pages.mjs: kiểm tra trang giao diện theo chức vụ [{ role, page, label, expected, ... }]
// Bước của các test e2e có sẵn được đọc thẳng từ mã nguồn test (các lệnh gọi API và các expect trong khối it).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(ROOT, 'frontend/package.json'));
const ExcelJS = require('exceljs');

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Cách dùng: node tools/qa/build-report.mjs <thư mục json> <file .xlsx>');
  process.exit(2);
}
const read = (name) => (existsSync(join(dir, name)) ? JSON.parse(readFileSync(join(dir, name), 'utf8')) : null);
const qa = read('qa-matrix.json');
const e2e = read('e2e.json');
const unitBe = read('unit-be.json');
const unitFe = read('unit-fe.json');
const ui = read('ui.json');

const cases = qa?.cases ?? [];
const scenarios = cases.filter((c) => c.group === 'Kịch bản theo chức vụ');
const matrix = cases.filter((c) => c.group === 'Ma trận phân quyền API');

// ---------------------------------------------------------------- e2e có sẵn: bước lấy từ mã nguồn

// Every '/api/…' literal in the test, in order; the method is the .get/.post/… right before it, else GET (helpers such as manager('/api/x')).
const API_CALL = /(?:\.(get|post|put|patch|delete)\(\s*)?[`'"](\/api\/[^`'"\s]*)[`'"]/g;
function stepsFromSource(file, title) {
  const path = join(ROOT, 'backend', file);
  if (!existsSync(path)) return { steps: [], expects: [] };
  const src = readFileSync(path, 'utf8');
  const start = src.indexOf(`it('${title.replace(/'/g, "\\'")}'`) >= 0 ? src.indexOf(`it('${title.replace(/'/g, "\\'")}'`) : src.indexOf(title);
  if (start < 0) return { steps: [], expects: [] };
  const next = src.indexOf('\n  it(', start + 5);
  const body = src.slice(start, next > 0 ? next : undefined);
  const steps = [];
  for (const m of body.matchAll(API_CALL)) {
    const s = `${(m[1] ?? 'get').toUpperCase()} ${m[2].replace(/\$\{[^}]+\}/g, ':id')}`;
    if (steps.at(-1) !== s) steps.push(s);
  }
  const expects = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('expect(') || /\.expect\(\d{3}\)/.test(l))
    .map((l) => (l.startsWith('expect(') ? l.slice(0, 160) : `Trả HTTP ${/\.expect\((\d{3})\)/.exec(l)[1]} — ${l.replace(/^(const \w+ = )?await\s+/, '').slice(0, 120)}`));
  return { steps, expects };
}

const e2eRows = [];
for (const file of e2e?.testResults ?? []) {
  const rel = `test/${basename(file.name)}`;
  for (const t of file.assertionResults ?? []) {
    const suite = t.ancestorTitles?.[0] ?? '';
    const { steps, expects } = stepsFromSource(rel, t.title);
    e2eRows.push({
      file: rel, suite, title: t.title, status: t.status, ms: t.duration ?? 0,
      steps: steps.length ? steps : ['(xem mã nguồn test)'],
      expected: expects.slice(0, 12).join('\n') + (expects.length > 12 ? `\n… và ${expects.length - 12} kiểm tra khác` : ''),
      failure: (t.failureMessages ?? []).join('\n').slice(0, 500),
    });
  }
}
const unitRows = [];
for (const [side, json] of [['Backend', unitBe], ['Frontend', unitFe]]) {
  for (const file of json?.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      unitRows.push({ side, file: file.name.replace(/^.*?(backend|frontend)[\\/]/, '$1/').replace(/\\/g, '/'), suite: t.ancestorTitles?.join(' › ') ?? '', title: t.title, status: t.status, ms: t.duration ?? 0 });
    }
  }
}

// ---------------------------------------------------------------- Excel

const wb = new ExcelJS.Workbook();
wb.creator = 'Ninh Trang ERP — kiểm thử tự động';
wb.created = new Date();

const C = { head: 'FF1F4E3D', headText: 'FFFFFFFF', pass: 'FFE3F4E8', passText: 'FF1B6B3A', fail: 'FFFDE2E1', failText: 'FFB42318', band: 'FFF5F5F0', note: 'FFFFF4D6' };
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: 'FFD9D9D2' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function table(ws, columns, rows, { resultKey } = {}) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: C.headText } };
  head.fill = fill(C.head);
  head.alignment = { vertical: 'middle', wrapText: true };
  head.height = 30;
  for (const r of rows) {
    const row = ws.addRow(r);
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => (cell.border = border));
    if (resultKey) {
      const cell = row.getCell(resultKey);
      const ok = cell.value === 'Đạt';
      cell.fill = fill(ok ? C.pass : C.fail);
      cell.font = { bold: true, color: { argb: ok ? C.passText : C.failText } };
    }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

const result = (s) => (s === 'passed' || s === 'Đạt' ? 'Đạt' : s === 'skipped' || s === 'pending' ? 'Bỏ qua' : 'Không đạt');
const count = (list, key = 'result') => ({ total: list.length, pass: list.filter((x) => result(x[key]) === 'Đạt').length });

// 1. Tổng quan
{
  const ws = wb.addWorksheet('Tổng quan');
  ws.columns = [{ width: 44 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  ws.addRow(['Báo cáo kiểm thử — Ninh Trang ERP']).font = { bold: true, size: 16 };
  ws.addRow([`Ngày chạy: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`]);
  ws.addRow(['Môi trường: máy local, PostgreSQL 18, database kiểm thử riêng nt_qa_matrix (migrate + seed + dữ liệu demo), build production frontend']);
  ws.addRow([]);
  const head = ws.addRow(['Nhóm kiểm thử', 'Số test case', 'Đạt', 'Không đạt', 'Tỷ lệ đạt']);
  head.font = { bold: true, color: { argb: C.headText } };
  head.fill = fill(C.head);
  const groups = [
    ['Kịch bản theo chức vụ', count(scenarios)],
    ['Ma trận phân quyền API (route × chức vụ)', count(matrix)],
    ...(ui ? [['Trang giao diện theo chức vụ', count(ui)]] : []),
    ['E2E nghiệp vụ có sẵn (backend)', count(e2eRows, 'status')],
    ['Unit test (backend + frontend)', count(unitRows, 'status')],
  ];
  let all = 0;
  let allPass = 0;
  for (const [name, c] of groups) {
    const row = ws.addRow([name, c.total, c.pass, c.total - c.pass, c.total ? c.pass / c.total : 0]);
    row.getCell(5).numFmt = '0.0%';
    row.getCell(4).font = { bold: c.total - c.pass > 0, color: { argb: c.total - c.pass > 0 ? C.failText : 'FF000000' } };
    all += c.total;
    allPass += c.pass;
  }
  const tot = ws.addRow(['Tổng cộng', all, allPass, all - allPass, all ? allPass / all : 0]);
  tot.font = { bold: true };
  tot.getCell(5).numFmt = '0.0%';

  ws.addRow([]);
  const h2 = ws.addRow(['Ma trận API theo chức vụ', 'Số case', 'Được phép', 'Bị chặn (403)', 'Không đạt']);
  h2.font = { bold: true, color: { argb: C.headText } };
  h2.fill = fill(C.head);
  const roles = [...new Set(matrix.map((c) => c.role))];
  for (const role of roles) {
    const list = matrix.filter((c) => c.role === role);
    const blocked = list.filter((c) => /^HTTP 403/.test(c.actual)).length;
    const unauth = list.filter((c) => /^HTTP 401/.test(c.actual)).length;
    ws.addRow([role, list.length, list.length - blocked - unauth, blocked + unauth, list.filter((c) => c.result !== 'Đạt').length]);
  }

  ws.addRow([]);
  ws.addRow(['Phát hiện cần xem xét']).font = { bold: true, size: 13 };
  const findings = [...scenarios.filter((c) => c.result !== 'Đạt' || c.note), ...(ui ?? []).filter((c) => c.result !== 'Đạt')];
  for (const f of findings) {
    const row = ws.addRow([`${f.id} — ${f.title ?? `${f.role}: ${f.label} (${f.page})`}`, f.result]);
    row.getCell(1).alignment = { wrapText: true };
    ws.mergeCells(row.number, 2, row.number, 5);
    row.getCell(2).value = `${f.result}: ${f.actual}${f.note ? `\n${f.note}` : ''}`;
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.height = 60;
    row.getCell(2).fill = fill(f.result === 'Đạt' ? C.note : C.fail);
  }
  if (!findings.length) ws.addRow(['Không có']);
}

// 2. Kịch bản theo chức vụ
{
  const ws = wb.addWorksheet('Kịch bản theo chức vụ');
  table(ws, [
    { header: 'Mã TC', key: 'id', width: 9 }, { header: 'Phân hệ', key: 'module', width: 18 }, { header: 'Test case', key: 'title', width: 38 },
    { header: 'Chức vụ', key: 'role', width: 18 }, { header: 'Các bước thực hiện', key: 'steps', width: 60 }, { header: 'Kết quả mong đợi', key: 'expected', width: 44 },
    { header: 'Kết quả thực tế', key: 'actual', width: 50 }, { header: 'Kết quả', key: 'result', width: 11 }, { header: 'Ghi chú', key: 'note', width: 40 },
  ], scenarios.map((c) => ({ ...c, steps: c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), note: c.note ?? '' })), { resultKey: 'result' });
}

// 3. Ma trận quyền theo chức vụ (quyền mặc định sau khi seed)
if (qa?.catalog) {
  const ws = wb.addWorksheet('Quyền theo chức vụ');
  const roles = qa.roles;
  ws.columns = [{ header: 'Nhóm', key: 'module', width: 14 }, { header: 'Mã quyền', key: 'code', width: 26 }, { header: 'Tên quyền', key: 'label', width: 34 },
    ...roles.map((r) => ({ header: r.name, key: r.id, width: 11 }))];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: C.headText } };
  head.fill = fill(C.head);
  head.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  head.height = 34;
  for (const p of [...qa.catalog].sort((a, b) => a.module.localeCompare(b.module) || a.code.localeCompare(b.code))) {
    const row = ws.addRow({ module: p.module, code: p.code, label: p.label, ...Object.fromEntries(roles.map((r) => [r.id, r.permissions.includes(p.code) ? '✓' : ''])) });
    row.eachCell((cell, col) => {
      cell.border = border;
      if (col > 3) {
        cell.alignment = { horizontal: 'center' };
        if (cell.value === '✓') {
          cell.fill = fill(C.pass);
          cell.font = { bold: true, color: { argb: C.passText } };
        }
      }
    });
  }
  const total = ws.addRow({ module: 'Tổng', label: 'Số quyền', ...Object.fromEntries(roles.map((r) => [r.id, r.permissions.length])) });
  total.font = { bold: true };
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 + roles.length } };
}

// 4. API theo chức vụ (bảng chéo mã HTTP)
{
  const ws = wb.addWorksheet('API × chức vụ');
  const roles = [...new Set(matrix.map((c) => c.role))];
  const apis = [...new Set(matrix.map((c) => c.title))];
  ws.columns = [{ header: 'Phân hệ', key: 'module', width: 18 }, { header: 'API', key: 'api', width: 52 }, { header: 'Quyền yêu cầu', key: 'perm', width: 40 },
    ...roles.map((r, i) => ({ header: r, key: `r${i}`, width: 12 }))];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: C.headText } };
  head.fill = fill(C.head);
  head.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  head.height = 44;
  const byKey = new Map(matrix.map((c) => [`${c.title}|${c.role}`, c]));
  for (const api of apis) {
    const first = byKey.get(`${api}|${roles[0]}`);
    const perm = /Quyền của API: (.*)$/.exec(first?.expected ?? '')?.[1] ?? '';
    const row = ws.addRow({ module: first?.module, api, perm, ...Object.fromEntries(roles.map((r, i) => [`r${i}`, (byKey.get(`${api}|${r}`)?.actual ?? '').slice(5, 8)])) });
    row.eachCell((cell, col) => {
      cell.border = border;
      if (col > 3) {
        const c = byKey.get(`${api}|${roles[col - 4]}`);
        const code = String(cell.value);
        cell.alignment = { horizontal: 'center' };
        if (c?.result !== 'Đạt') cell.fill = fill(C.fail);
        else if (code === '401' || code === '403') cell.fill = fill(C.band);
        else cell.fill = fill(C.pass);
      }
    });
  }
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 + roles.length } };
  const note = ws.addRow([]);
  ws.addRow(['Chú thích: xanh = được phép (2xx/4xx do dữ liệu thử rỗng), xám = bị chặn đúng (401/403), đỏ = sai so với quyền']);
  note.height = 6;
}

// 5. Ma trận API chi tiết
{
  const ws = wb.addWorksheet('Ma trận API chi tiết');
  table(ws, [
    { header: 'Mã TC', key: 'id', width: 10 }, { header: 'Phân hệ', key: 'module', width: 18 }, { header: 'API', key: 'title', width: 46 },
    { header: 'Chức vụ', key: 'role', width: 20 }, { header: 'Các bước thực hiện', key: 'steps', width: 52 }, { header: 'Kết quả mong đợi', key: 'expected', width: 60 },
    { header: 'Kết quả thực tế', key: 'actual', width: 50 }, { header: 'Kết quả', key: 'result', width: 11 },
  ], matrix.map((c) => ({ ...c, steps: c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') })), { resultKey: 'result' });
}

// 6. Giao diện theo chức vụ
if (ui) {
  const ws = wb.addWorksheet('Giao diện theo chức vụ');
  table(ws, [
    { header: 'Mã TC', key: 'id', width: 9 }, { header: 'Trang', key: 'label', width: 22 }, { header: 'Đường dẫn', key: 'page', width: 24 },
    { header: 'Chức vụ', key: 'role', width: 20 }, { header: 'Các bước thực hiện', key: 'steps', width: 50 }, { header: 'Kết quả mong đợi', key: 'expected', width: 44 },
    { header: 'Kết quả thực tế', key: 'actual', width: 54 }, { header: 'Kết quả', key: 'result', width: 11 },
  ], ui.map((c) => ({ ...c, steps: c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') })), { resultKey: 'result' });
}

// 7. E2E nghiệp vụ có sẵn
{
  const ws = wb.addWorksheet('E2E nghiệp vụ');
  table(ws, [
    { header: 'Mã TC', key: 'id', width: 9 }, { header: 'Bộ test', key: 'suite', width: 30 }, { header: 'Test case', key: 'title', width: 52 },
    { header: 'Các bước (lệnh gọi API theo thứ tự)', key: 'steps', width: 48 }, { header: 'Kiểm tra (kết quả mong đợi)', key: 'expected', width: 70 },
    { header: 'Kết quả', key: 'result', width: 11 }, { header: 'Thời gian (ms)', key: 'ms', width: 12 }, { header: 'File', key: 'file', width: 30 }, { header: 'Lỗi', key: 'failure', width: 40 },
  ], e2eRows.map((r, i) => ({ ...r, id: `E2E-${String(i + 1).padStart(3, '0')}`, steps: r.steps.map((s, j) => `${j + 1}. ${s}`).join('\n'), result: result(r.status), ms: Math.round(r.ms) })), { resultKey: 'result' });
}

// 8. Unit test
{
  const ws = wb.addWorksheet('Unit test');
  table(ws, [
    { header: 'Mã TC', key: 'id', width: 9 }, { header: 'Phía', key: 'side', width: 10 }, { header: 'File', key: 'file', width: 50 }, { header: 'Nhóm', key: 'suite', width: 34 },
    { header: 'Test case', key: 'title', width: 60 }, { header: 'Kết quả', key: 'result', width: 11 }, { header: 'Thời gian (ms)', key: 'ms', width: 12 },
  ], unitRows.map((r, i) => ({ ...r, id: `UT-${String(i + 1).padStart(3, '0')}`, result: result(r.status), ms: Math.round(r.ms) })), { resultKey: 'result' });
}

await wb.xlsx.writeFile(out);
console.log(`Đã ghi ${out}: ${scenarios.length} kịch bản, ${matrix.length} ca ma trận API, ${ui?.length ?? 0} ca giao diện, ${e2eRows.length} e2e, ${unitRows.length} unit.`);
