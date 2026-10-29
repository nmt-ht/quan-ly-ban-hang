// Dựng tài liệu Atlas từ nguồn Markdown: docs/atlas/src/*.md → docs/atlas/*.docx
// Chạy: node tools/atlas/build.mjs            (mọi tài liệu)
//       node tools/atlas/build.mjs ATL-12     (chỉ tài liệu có mã bắt đầu như vậy)
//
// Cú pháp nguồn (xem docs/atlas/src/README.md):
//   frontmatter `---` (title + các dòng của bảng thông tin đầu tài liệu)
//   `# ` mục lớn, `## ` mục nhỏ, đoạn văn, `- ` gạch đầu dòng, `1. ` danh sách số,
//   `> ` ghi chú in nghiêng, `[flow] A → B → C` hộp quy trình, `[next]` mũi tên "tiếp theo",
//   bảng Markdown (`|---|` sau dòng đầu = có hàng tiêu đề; `[table-noheader]` = không có),
//   **đậm** trong dòng, `<br>` xuống dòng trong ô bảng.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const srcDir = path.join(root, 'docs/atlas/src');
const outDir = path.join(root, 'docs/atlas');
const tplDir = path.join(here, 'template');

// ---------- đọc nguồn ----------

export function parseSource(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const meta = {};
  let i = 0;
  if (lines[0] === '---') {
    for (i = 1; lines[i] !== '---'; i++) {
      const k = lines[i].indexOf(':');
      meta[lines[i].slice(0, k).trim()] = lines[i].slice(k + 1).trim();
    }
    i++;
  }
  const blocks = [];
  const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  let noHeader = false;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('# ')) { blocks.push({ t: 'h1', text: l.slice(2) }); i++; continue; }
    if (l.startsWith('## ')) { blocks.push({ t: 'h2', text: l.slice(3) }); i++; continue; }
    if (l.startsWith('[flow] ')) { blocks.push({ t: 'flow', items: l.slice(7).split(' → ').map((s) => s.trim()) }); i++; continue; }
    if (l.trim() === '[next]') { blocks.push({ t: 'next' }); i++; continue; }
    if (l.trim() === '[table-noheader]') { noHeader = true; i++; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++; }
      const header = !noHeader && rows.length > 1 && /^\|[\s|:-]+\|$/.test(rows[1].trim());
      const body = rows.filter((_, k) => !(header && k === 1)).map(splitRow);
      blocks.push({ t: 'table', header, rows: body });
      noHeader = false;
      continue;
    }
    if (l.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
      blocks.push({ t: 'ul', items });
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
      blocks.push({ t: 'ol', items });
      continue;
    }
    if (l.startsWith('> ')) { blocks.push({ t: 'note', text: l.slice(2) }); i++; continue; }
    blocks.push({ t: 'p', text: l });
    i++;
  }
  return { meta, blocks };
}

// ---------- docx ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = '<w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>';

function run(text, { b = false, i = false, sz = 21, color } = {}) {
  return `<w:r><w:rPr>${FONT}${b ? '<w:b/><w:bCs/>' : ''}${i ? '<w:i/><w:iCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

// **đậm** → các run
function runs(text, opt = {}) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map((part) => (part.startsWith('**') ? run(part.slice(2, -2), { ...opt, b: true }) : run(part, opt))).join('');
}

const para = (pPr, body) => `<w:p><w:pPr>${pPr}</w:pPr>${body}</w:p>`;
const border = (c, v = 'single', sz = 4) => ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="${v}" w:color="${c}" w:sz="${sz}"/>`).join('');
const MAR = '<w:tcMar><w:top w:type="dxa" w:w="60"/><w:left w:type="dxa" w:w="100"/><w:bottom w:type="dxa" w:w="60"/><w:right w:type="dxa" w:w="100"/></w:tcMar>';

function cell(w, content, { fill, vAlign = 'top', noBorder = false } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="${w}"/><w:tcBorders>${noBorder ? border('FFFFFF', 'none', 0) : border('A6A6A6')}</w:tcBorders>${fill ? `<w:shd w:fill="${fill}" w:color="auto" w:val="clear"/>` : ''}${MAR}<w:vAlign w:val="${vAlign}"/></w:tcPr>${content}</w:tc>`;
}
const cellParas = (text, opt, jc) => text.split('<br>').map((t) => para(`<w:spacing w:after="20" w:line="270"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}`, runs(t, opt))).join('');

function table(widths, rowsXml) {
  const total = widths.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="${total}"/><w:tblBorders>${border('auto')}<w:insideH w:val="single" w:color="auto" w:sz="4"/><w:insideV w:val="single" w:color="auto" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rowsXml}</w:tbl>`;
}

const PAGE_W = 9638;
function columnWidths(rows) {
  const n = rows[0].length;
  const len = (s) => s.replace(/\*\*/g, '').length;
  const weights = Array.from({ length: n }, (_, c) => {
    const ls = rows.map((r) => len(r[c] ?? ''));
    const avg = ls.reduce((a, b) => a + b, 0) / ls.length;
    return Math.max(5, Math.min(Math.max(...ls), 14 + avg * 1.4));
  });
  // Cột hẹp vẫn phải đủ chỗ cho từ dài nhất và tiêu đề trong tối đa hai dòng.
  const minW = Array.from({ length: n }, (_, c) => {
    const words = rows.flatMap((r) => (r[c] ?? '').replace(/\*\*|<br>/g, ' ').split(/\s+/));
    const chars = Math.max(...words.map((x) => Math.min(x.length, 18)), Math.ceil(len(rows[0][c] ?? '') / 2));
    return chars * 110 + 220;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let w = weights.map((x, c) => Math.max(minW[c], Math.round((x / sum) * PAGE_W)));
  const over = w.reduce((a, b) => a + b, 0) - PAGE_W;
  if (over > 0) {
    const room = w.map((x, c) => x - minW[c]);
    const total = room.reduce((a, b) => a + b, 0) || 1;
    w = w.map((x, c) => Math.round(x - (over * room[c]) / total));
  }
  w[n - 1] += PAGE_W - w.reduce((a, b) => a + b, 0);
  return w;
}

function docxBody(doc) {
  const { meta, blocks } = doc;
  const out = [];
  let numId = 2; // 1 = gạch đầu dòng, từ 2 = mỗi danh sách số một bộ đếm
  const numbered = [];
  out.push(para('<w:spacing w:after="40"/>', run('TÀI LIỆU ATLAS — CHỨC NĂNG', { b: true, sz: 18, color: '7F7F7F' })));
  out.push(para('<w:spacing w:after="120"/>', run(meta.title, { b: true, sz: 40, color: '1F3864' })));
  const metaRows = Object.entries(meta).filter(([k]) => k !== 'title');
  out.push(table([2400, 7238], metaRows.map(([k, v]) => `<w:tr>${cell(2400, cellParas(k, { b: true, sz: 19 }), { fill: 'F2F2F2' })}${cell(7238, cellParas(v, { sz: 19 }))}</w:tr>`).join('')));
  for (const b of blocks) {
    switch (b.t) {
      case 'h1':
        out.push(para('<w:pStyle w:val="Heading1"/><w:keepNext/><w:spacing w:after="120" w:before="320"/>', run(b.text, { b: true, sz: 28, color: '1F3864' })));
        break;
      case 'h2':
        out.push(para('<w:pStyle w:val="Heading2"/><w:keepNext/><w:spacing w:after="80" w:before="200"/>', run(b.text, { b: true, sz: 24, color: '2F5496' })));
        break;
      case 'p':
        out.push(para('<w:spacing w:after="100" w:before="0" w:line="300"/>', runs(b.text)));
        break;
      case 'note':
        out.push(para('<w:spacing w:after="100" w:before="0" w:line="300"/>', runs(b.text, { i: true, sz: 19 })));
        break;
      case 'ul':
        for (const it of b.items) out.push(para('<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60" w:line="290"/>', runs(it)));
        break;
      case 'ol': {
        const id = numId++;
        numbered.push(id);
        for (const it of b.items) out.push(para(`<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr><w:spacing w:after="70" w:line="290"/>`, runs(it)));
        break;
      }
      case 'next':
        out.push(para('<w:spacing w:after="40" w:before="40" w:line="300"/><w:jc w:val="center"/>', run('↓ tiếp theo', { sz: 17, color: '7F7F7F' })));
        break;
      case 'flow': {
        const n = b.items.length;
        const arrow = 412;
        const box = Math.floor((PAGE_W - arrow * (n - 1)) / n);
        const widths = [];
        const cells = [];
        b.items.forEach((it, k) => {
          if (k) { widths.push(arrow); cells.push(cell(arrow, cellParas('→', { b: true, sz: 26 }, 'center'), { vAlign: 'center', noBorder: true })); }
          widths.push(box);
          cells.push(cell(box, cellParas(it, { b: true, sz: 18 }, 'center'), { fill: 'DEEAF6', vAlign: 'center' }));
        });
        out.push(table(widths, `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join('')}</w:tr>`));
        // khoảng cách để Word không dính hộp quy trình vào bảng ngay sau
        out.push(para('<w:spacing w:after="0" w:line="120" w:lineRule="exact"/>', ''));
        break;
      }
      case 'table': {
        const widths = columnWidths(b.rows);
        const xml = b.rows.map((r, k) => {
          const head = b.header && k === 0;
          return `<w:tr><w:trPr><w:cantSplit/>${head ? '<w:tblHeader/>' : ''}</w:trPr>${widths.map((w, c) => cell(w, cellParas(r[c] ?? '', { b: head, sz: 19 }), head ? { fill: 'D9E2F3' } : {})).join('')}</w:tr>`;
        }).join('');
        out.push(table(widths, xml));
        out.push(para('<w:spacing w:after="60"/>', ''));
        break;
      }
    }
  }
  return { xml: out.join(''), numbered };
}

const W_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const SMALL = { sz: 17, color: '7F7F7F' };

function headerXml(code, title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W_NS}><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:color="A6A6A6" w:sz="6" w:space="2"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr>${run('Ninh Trang ERP — Tài liệu Atlas', SMALL)}${run(`\t${code} · ${title}`, SMALL).replace('<w:t xml:space="preserve">\t', '<w:tab/><w:t xml:space="preserve">')}</w:p></w:hdr>`;
}

function footerXml() {
  const r = (inner) => `<w:r><w:rPr>${FONT}<w:color w:val="7F7F7F"/><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr>${inner}</w:r>`;
  const field = (name) => r('<w:fldChar w:fldCharType="begin"/>') + r(`<w:instrText xml:space="preserve">${name}</w:instrText>`) + r('<w:fldChar w:fldCharType="separate"/>') + r('<w:t>1</w:t>') + r('<w:fldChar w:fldCharType="end"/>');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${W_NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Trang ', SMALL)}${field('PAGE')}${run(' / ', SMALL)}${field('NUMPAGES')}</w:p></w:ftr>`;
}

function numberingXml(numbered) {
  const lvl = (fmt, text, left, hanging) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="${hanging}"/></w:pPr></w:lvl>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W_NS}>`
    + `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${lvl('bullet', '•', 540, 270)}</w:abstractNum>`
    + `<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/>${lvl('decimal', '%1.', 540, 360)}</w:abstractNum>`
    + '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>'
    + numbered.map((id) => `<w:num w:numId="${id}"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`).join('')
    + '</w:numbering>';
}

function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:footerReference w:type="default" r:id="rId7"/><w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/><w:pgMar w:top="1300" w:right="1134" w:bottom="1200" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/><w:pgNumType/><w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>`;
}

function coreXml(code, title, when) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(`${code} — ${title}`)}</dc:title><dc:creator>Ninh Trang ERP</dc:creator><cp:lastModifiedBy>Ninh Trang ERP</cp:lastModifiedBy><cp:revision>1</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified></cp:coreProperties>`;
}

// ---------- zip (stored + deflate, không cần thư viện) ----------

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  // ngày cố định để file dựng lại giống hệt khi nguồn không đổi
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const [name, content] of files) {
    const data = Buffer.from(content);
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cenSize = central.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

export function buildDocx(doc) {
  const code = doc.meta['Mã tài liệu'];
  const title = doc.meta.title;
  const { xml, numbered } = docxBody(doc);
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(doc.meta['Phiên bản'] ?? '');
  const when = m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00Z` : '2026-01-01T00:00:00Z';
  const tpl = (p) => fs.readFileSync(path.join(tplDir, p));
  return zip([
    ['[Content_Types].xml', tpl('[Content_Types].xml')],
    ['_rels/.rels', tpl('_rels/.rels')],
    ['docProps/core.xml', coreXml(code, title, when)],
    ['docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>'],
    ['docProps/custom.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>'],
    ['word/_rels/document.xml.rels', tpl('word/_rels/document.xml.rels')],
    ['word/document.xml', documentXml(xml)],
    ['word/styles.xml', tpl('word/styles.xml')],
    ['word/numbering.xml', numberingXml(numbered)],
    ['word/settings.xml', tpl('word/settings.xml')],
    ['word/fontTable.xml', tpl('word/fontTable.xml')],
    ['word/footnotes.xml', tpl('word/footnotes.xml')],
    ['word/endnotes.xml', tpl('word/endnotes.xml')],
    ['word/theme/theme1.xml', tpl('word/theme/theme1.xml')],
    ['word/header1.xml', headerXml(code, title)],
    ['word/footer1.xml', footerXml()],
  ]);
}

export function loadSources() {
  return fs.readdirSync(srcDir).filter((f) => /^ATL-\d+.*\.md$/.test(f)).sort()
    .map((f) => ({ file: f.replace(/\.md$/, ''), ...parseSource(fs.readFileSync(path.join(srcDir, f), 'utf8')) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  for (const doc of loadSources()) {
    if (only && !doc.file.startsWith(only)) continue;
    fs.writeFileSync(path.join(outDir, `${doc.file}.docx`), buildDocx(doc));
    console.log(`${doc.file}.docx`);
  }
}
