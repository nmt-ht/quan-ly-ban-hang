// Excel export / import for Hàng hoá and Định mức.
// The production app's import templates were never observed (docs/crawl/17-hang-hoa.md §5),
// so the column layout below mirrors the product form; export and import share it so an
// exported file can be edited and re-imported.
import { BomLine, Product, ProductCategory, ProductType, StockLevel, Warehouse } from '../../core/models/domain.models';
import { PRODUCT_TYPE_LABEL } from '../../shared/status-labels';
import { foldVi } from '../../shared/format.util';
import { SheetColumn, SheetRow, SheetSpec, headerKey, readSheet } from '../../shared/excel.util';
import { MEASURE_UNIT, inferMeasureMode, tracksStock } from './product-type-rules';

// ---------- shared parsing helpers ----------

type Cell = string | number | boolean | Date | null | undefined;

const text = (v: Cell): string => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

// Accepts real numbers and Vietnamese-formatted text ("1.250.000", "0,45").
function num(v: Cell): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s|₫|đ/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function bool(v: Cell, fallback: boolean): boolean | null {
  if (v === null || v === undefined || text(v) === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = foldVi(text(v));
  if (['co', 'x', '1', 'true', 'yes', 'dung'].includes(s)) return true;
  if (['khong', '0', 'false', 'no', 'sai'].includes(s)) return false;
  return null;
}

export interface ImportIssue {
  row: number;
  message: string;
}

// ---------- Hàng hoá ----------

const P = {
  code: 'Mã hệ thống',
  crossRef: 'Mã đối chiếu',
  name: 'Tên hàng hoá',
  type: 'Tính chất',
  unit: 'Đơn vị tính chính',
  category: 'Nhóm hàng',
  warehouse: 'Kho ngầm định',
  minStock: 'Tồn tối thiểu',
  vat: 'Thuế suất GTGT (%)',
  warranty: 'Bảo hành (tháng)',
  origin: 'Nguồn gốc',
  retail: 'Giá lẻ',
  wholesale: 'Giá sỉ',
  dropship: 'Giá dropship',
  purchaseNote: 'Diễn giải khi mua',
  saleNote: 'Diễn giải khi bán',
  description: 'Mô tả',
  sellable: 'Được phép bán',
  active: 'Đang kinh doanh',
  stock: 'Tồn kho (chỉ xem)',
} as const;

const MONEY = '#,##0';

const PRODUCT_COLUMNS: SheetColumn[] = [
  { header: P.code, width: 14 },
  { header: P.crossRef, width: 22 },
  { header: P.name, width: 40, required: true },
  { header: P.type, width: 18, required: true },
  { header: P.unit, width: 12, required: true },
  { header: P.category, width: 18 },
  { header: P.warehouse, width: 22 },
  { header: P.minStock, width: 12 },
  { header: P.vat, width: 12 },
  { header: P.warranty, width: 12 },
  { header: P.origin, width: 14 },
  { header: P.retail, width: 14, numFmt: MONEY },
  { header: P.wholesale, width: 14, numFmt: MONEY },
  { header: P.dropship, width: 14, numFmt: MONEY },
  { header: P.purchaseNote, width: 30 },
  { header: P.saleNote, width: 30 },
  { header: P.description, width: 30 },
  { header: P.sellable, width: 12 },
  { header: P.active, width: 14 },
];

export interface ProductLookups {
  products: Product[];
  categories: ProductCategory[];
  warehouses: Warehouse[];
  stockLevels: StockLevel[];
}

export function productExportSheet(rows: Product[], lk: ProductLookups): SheetSpec {
  const cat = new Map(lk.categories.map((c) => [c.id, c.name]));
  const wh = new Map(lk.warehouses.map((w) => [w.id, w.name]));
  const stock = new Map<string, number>();
  for (const s of lk.stockLevels) stock.set(s.productId, (stock.get(s.productId) ?? 0) + s.quantity);
  return {
    name: 'Hàng hoá',
    columns: [...PRODUCT_COLUMNS, { header: P.stock, width: 14 }],
    rows: rows.map((p) => [
      p.code, p.crossRefCode ?? '', p.name, PRODUCT_TYPE_LABEL[p.type], p.baseUnit,
      p.categoryId ? (cat.get(p.categoryId) ?? '') : '', p.defaultWarehouseId ? (wh.get(p.defaultWarehouseId) ?? '') : '',
      p.minStock, p.vatRate, p.warrantyMonths, p.origin ?? '',
      p.retailPrice, p.wholesalePrice, p.dropshipPrice,
      p.purchaseNote ?? '', p.saleNote ?? '', p.description ?? '',
      p.isSellable ? 'Có' : 'Không', p.isActive ? 'Có' : 'Không',
      p.type === 'DICH_VU' ? '' : (stock.get(p.id) ?? 0),
    ]),
  };
}

export function productTemplateSheet(lk: ProductLookups): SheetSpec {
  return {
    name: 'Hàng hoá',
    columns: PRODUCT_COLUMNS,
    rows: [],
    notes: {
      title: 'Nhập hàng hoá từ Excel — hướng dẫn',
      lines: [
        'Mỗi dòng là một mặt hàng. Cột có dấu * là bắt buộc.',
        'Khớp mặt hàng có sẵn: theo "Mã hệ thống" trước, nếu trống thì theo "Mã đối chiếu". Khớp được thì CẬP NHẬT, không khớp thì THÊM MỚI.',
        'Để trống "Mã hệ thống" khi thêm mới — hệ thống tự cấp mã VT/SP/DV theo Tính chất.',
        'Không đổi được Tính chất của mặt hàng đã có (tiền tố mã đã cố định).',
        'Thành phẩm: Đơn vị tính chính chỉ là m2 (bán theo mét vuông) hoặc m (bán theo mét dài).',
        'Kho ngầm định và Tồn tối thiểu chỉ áp dụng cho Vật tư hàng hoá; với Thành phẩm và Dịch vụ hai cột này bị bỏ qua.',
        `Tính chất: ${Object.values(PRODUCT_TYPE_LABEL).join(' · ')}.`,
        `Nhóm hàng (ghi đúng tên): ${lk.categories.map((c) => c.name).join(' · ')}.`,
        `Kho ngầm định (ghi đúng tên): ${lk.warehouses.map((w) => w.name).join(' · ')}.`,
        'Số: ghi số thường (1250000) hoặc kiểu Việt Nam (1.250.000 · 0,45).',
        '"Được phép bán", "Đang kinh doanh": Có / Không. Để trống = Có.',
        'Dòng lỗi sẽ bị bỏ qua; các dòng hợp lệ vẫn được nhập. Danh sách lỗi hiện trước khi xác nhận.',
        'File "Xuất Excel" dùng cùng cột này — có thể sửa file xuất ra rồi nhập lại. Cột "Tồn kho (chỉ xem)" bị bỏ qua khi nhập.',
      ],
    },
  };
}

export interface ProductImportPlan {
  creates: Product[];
  updates: Product[];
  issues: ImportIssue[];
  totalRows: number;
  /** Excel row of each parsed product (by its id; new rows carry a temporary id), for the server's row-by-row check. */
  rowOf: Map<string, number>;
}

function nextCodeFactory(existing: Product[]) {
  const max: Record<string, number> = {};
  for (const p of existing) {
    const m = /^([A-Z]+)(\d+)$/.exec(p.code);
    if (m) max[m[1]] = Math.max(max[m[1]] ?? 0, Number(m[2]));
  }
  return (type: ProductType) => {
    const prefix = type === 'VAT_TU' ? 'VT' : type === 'THANH_PHAM' ? 'SP' : 'DV';
    max[prefix] = (max[prefix] ?? 0) + 1;
    return prefix + String(max[prefix]).padStart(7, '0');
  };
}

export async function planProductImport(file: File, lk: ProductLookups): Promise<ProductImportPlan> {
  const { headers, rows } = await readSheet(file, 'Hàng hoá');
  const issues: ImportIssue[] = [];
  const required = [P.name, P.type, P.unit].map(headerKey);
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    const names = [P.name, P.type, P.unit].filter((h) => missing.includes(headerKey(h)));
    return { creates: [], updates: [], totalRows: rows.length, rowOf: new Map(), issues: [{ row: 1, message: `Thiếu cột bắt buộc: ${names.join(', ')}. Hãy dùng file mẫu.` }] };
  }

  const byCode = new Map(lk.products.map((p) => [foldVi(p.code), p]));
  const byCross = new Map(lk.products.filter((p) => p.crossRefCode).map((p) => [foldVi(p.crossRefCode!), p]));
  const typeByLabel = new Map(Object.entries(PRODUCT_TYPE_LABEL).map(([k, v]) => [foldVi(v), k as ProductType]));
  for (const k of Object.keys(PRODUCT_TYPE_LABEL)) typeByLabel.set(foldVi(k), k as ProductType);
  const catByName = new Map(lk.categories.map((c) => [foldVi(c.name), c.id]));
  const whByName = new Map(lk.warehouses.map((w) => [foldVi(w.name), w.id]));
  const nextCode = nextCodeFactory(lk.products);
  const now = new Date().toISOString();

  const creates: Product[] = [];
  const updates: Product[] = [];
  const rowOf = new Map<string, number>();
  const seen = new Set<string>();

  for (const r of rows) {
    const get = (h: string) => r.cells.get(headerKey(h));
    const errs: string[] = [];

    const code = text(get(P.code));
    const crossRef = text(get(P.crossRef));
    const existing = (code && byCode.get(foldVi(code))) || (!code && crossRef ? byCross.get(foldVi(crossRef)) : undefined);
    if (code && !existing) errs.push(`không có mặt hàng mã "${code}" (để trống mã nếu muốn thêm mới)`);

    const name = text(get(P.name));
    if (!name) errs.push('thiếu Tên hàng hoá');
    const typeText = text(get(P.type));
    const type = typeByLabel.get(foldVi(typeText));
    if (!typeText) errs.push('thiếu Tính chất');
    else if (!type) errs.push(`Tính chất "${typeText}" không hợp lệ`);
    if (existing && type && existing.type !== type) errs.push(`không đổi được Tính chất của ${existing.code}`);
    const unit = text(get(P.unit));
    if (!unit) errs.push('thiếu Đơn vị tính chính');
    // Thành phẩm is sold per m² or per metre; a legacy row may keep the unit it already has.
    const measureMode = type === 'THANH_PHAM' && unit ? inferMeasureMode(unit) : null;
    const keepsLegacyUnit = !!existing && existing.baseUnit === unit;
    if (type === 'THANH_PHAM' && unit && !measureMode && !keepsLegacyUnit) {
      errs.push('Thành phẩm chỉ dùng đơn vị m2 (mét vuông) hoặc m (mét dài)');
    }

    const catText = text(get(P.category));
    const categoryId = catText ? catByName.get(foldVi(catText)) : undefined;
    if (catText && !categoryId) errs.push(`không có nhóm hàng "${catText}"`);
    const whText = text(get(P.warehouse));
    const warehouseId = whText ? whByName.get(foldVi(whText)) : undefined;
    if (whText && !warehouseId) errs.push(`không có kho "${whText}"`);

    const numbers: Record<string, number> = {};
    for (const h of [P.minStock, P.vat, P.warranty, P.retail, P.wholesale, P.dropship]) {
      const n = num(get(h));
      if (Number.isNaN(n)) errs.push(`"${h}" không phải số`);
      else if (n !== null && n < 0) errs.push(`"${h}" không được âm`);
      numbers[h] = n !== null && !Number.isNaN(n) ? n : NaN;
    }
    const pick = (h: string, fallback: number) => (Number.isNaN(numbers[h]) ? fallback : numbers[h]);

    const sellable = bool(get(P.sellable), existing?.isSellable ?? true);
    const active = bool(get(P.active), existing?.isActive ?? true);
    if (sellable === null) errs.push('"Được phép bán" phải là Có / Không');
    if (active === null) errs.push('"Đang kinh doanh" phải là Có / Không');

    const key = existing?.id ?? `new:${foldVi(crossRef || name)}`;
    if (seen.has(key)) errs.push('trùng với một dòng phía trên');
    seen.add(key);

    if (errs.length) {
      issues.push({ row: r.rowNumber, message: errs.join('; ') });
      continue;
    }

    const stock = tracksStock(type!);
    const fields = {
      name,
      baseUnit: measureMode ? MEASURE_UNIT[measureMode] : unit,
      measureMode: measureMode ?? (type === 'THANH_PHAM' ? existing?.measureMode : undefined),
      crossRefCode: crossRef || undefined,
      categoryId,
      defaultWarehouseId: stock ? warehouseId : undefined,
      minStock: stock ? pick(P.minStock, existing?.minStock ?? 0) : 0,
      vatRate: pick(P.vat, existing?.vatRate ?? 0),
      warrantyMonths: pick(P.warranty, existing?.warrantyMonths ?? 0),
      origin: text(get(P.origin)) || undefined,
      retailPrice: pick(P.retail, existing?.retailPrice ?? 0),
      wholesalePrice: pick(P.wholesale, existing?.wholesalePrice ?? 0),
      dropshipPrice: pick(P.dropship, existing?.dropshipPrice ?? 0),
      purchaseNote: text(get(P.purchaseNote)) || undefined,
      saleNote: text(get(P.saleNote)) || undefined,
      description: text(get(P.description)) || undefined,
      isSellable: sellable!,
      isActive: active!,
      updatedAt: now,
    };

    if (existing) {
      updates.push({ ...existing, ...fields });
      rowOf.set(existing.id, r.rowNumber);
    } else {
      const id = crypto.randomUUID();
      rowOf.set(id, r.rowNumber);
      creates.push({
        ...fields,
        id,
        code: nextCode(type!),
        type: type!,
        unitConversions: [],
        createdAt: now,
      });
    }
  }

  return { creates, updates, issues, totalRows: rows.length, rowOf };
}

// ---------- Định mức ----------

const B = {
  finished: 'Mã thành phẩm',
  finishedName: 'Tên thành phẩm (tham khảo)',
  component: 'Mã vật tư',
  componentName: 'Tên vật tư (tham khảo)',
  qty: 'Số lượng / 1 đơn vị thành phẩm',
  unit: 'ĐVT vật tư (tham khảo)',
} as const;

const BOM_COLUMNS: SheetColumn[] = [
  { header: B.finished, width: 16, required: true },
  { header: B.finishedName, width: 36 },
  { header: B.component, width: 16, required: true },
  { header: B.componentName, width: 36 },
  { header: B.qty, width: 18, required: true, numFmt: '0.####' },
  { header: B.unit, width: 14 },
];

// The template is pre-filled with the current định mức so it can be edited in place.
export function bomTemplateSheet(products: Product[], bomLines: BomLine[]): SheetSpec {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = bomLines
    .map((l) => ({ l, f: byId.get(l.finishedProductId), c: byId.get(l.componentId) }))
    .filter((x) => x.f && x.c)
    .sort((a, b) => a.f!.code.localeCompare(b.f!.code) || a.c!.code.localeCompare(b.c!.code))
    .map(({ l, f, c }) => [f!.code, f!.name, c!.code, c!.name, l.quantityPerUnit, c!.baseUnit]);
  return {
    name: 'Định mức',
    columns: BOM_COLUMNS,
    rows,
    notes: {
      title: 'Nhập định mức (BOM) từ Excel — hướng dẫn',
      lines: [
        'Mỗi dòng: 1 thành phẩm dùng bao nhiêu vật tư cho 1 đơn vị thành phẩm. Cột có dấu * là bắt buộc.',
        'File mẫu đã điền sẵn định mức hiện có — sửa trực tiếp rồi nhập lại.',
        'Mã thành phẩm / mã vật tư: ghi Mã hệ thống (SP…, VT…) hoặc Mã đối chiếu.',
        'Thành phẩm có trong file sẽ được THAY TOÀN BỘ định mức bằng các dòng trong file. Thành phẩm không có trong file giữ nguyên.',
        'Thành phẩm phải có Tính chất "Thành phẩm"; vật tư không được là Dịch vụ hoặc chính thành phẩm đó.',
        'Số lượng > 0, ghi số thường (0.45) hoặc kiểu Việt Nam (0,45).',
        'Các cột "(tham khảo)" chỉ để đọc, bị bỏ qua khi nhập.',
        'Lệnh sản xuất đã tạo giữ bản chụp định mức cũ — nhập định mức mới không làm đổi lệnh đã có.',
      ],
    },
  };
}

export interface BomImportPlan {
  // finishedProductId -> its new full định mức
  replacements: Map<string, BomLine[]>;
  lineCount: number;
  issues: ImportIssue[];
  totalRows: number;
}

export async function planBomImport(file: File, products: Product[]): Promise<BomImportPlan> {
  const { headers, rows } = await readSheet(file, 'Định mức');
  const issues: ImportIssue[] = [];
  const replacements = new Map<string, BomLine[]>();
  const req = [B.finished, B.component, B.qty];
  const missing = req.filter((h) => !headers.includes(headerKey(h)));
  if (missing.length) {
    return { replacements, lineCount: 0, totalRows: rows.length, issues: [{ row: 1, message: `Thiếu cột bắt buộc: ${missing.join(', ')}. Hãy dùng file mẫu.` }] };
  }

  const byKey = new Map<string, Product>();
  for (const p of products) {
    byKey.set(foldVi(p.code), p);
    if (p.crossRefCode && !byKey.has(foldVi(p.crossRefCode))) byKey.set(foldVi(p.crossRefCode), p);
  }
  const badFinished = new Set<string>();

  for (const r of rows as SheetRow[]) {
    const get = (h: string) => r.cells.get(headerKey(h));
    const errs: string[] = [];
    const fText = text(get(B.finished));
    const cText = text(get(B.component));
    const f = fText ? byKey.get(foldVi(fText)) : undefined;
    const c = cText ? byKey.get(foldVi(cText)) : undefined;
    if (!fText) errs.push('thiếu Mã thành phẩm');
    else if (!f) errs.push(`không có mặt hàng "${fText}"`);
    else if (f.type !== 'THANH_PHAM') errs.push(`${f.code} không phải Thành phẩm`);
    if (!cText) errs.push('thiếu Mã vật tư');
    else if (!c) errs.push(`không có mặt hàng "${cText}"`);
    else if (c.type === 'DICH_VU') errs.push(`${c.code} là Dịch vụ, không dùng làm vật tư`);
    if (f && c && f.id === c.id) errs.push('vật tư trùng chính thành phẩm');
    const q = num(get(B.qty));
    if (q === null) errs.push('thiếu Số lượng');
    else if (Number.isNaN(q) || q <= 0) errs.push('Số lượng phải là số > 0');
    if (f && c && replacements.get(f.id)?.some((l) => l.componentId === c.id)) errs.push(`${c.code} lặp lại trong định mức của ${f.code}`);

    if (errs.length) {
      issues.push({ row: r.rowNumber, message: errs.join('; ') });
      if (f) badFinished.add(f.id);
      continue;
    }
    const lines = replacements.get(f!.id) ?? [];
    lines.push({ finishedProductId: f!.id, componentId: c!.id, quantityPerUnit: q! });
    replacements.set(f!.id, lines);
  }

  // A thành phẩm with any bad row is skipped whole — a partial định mức would be wrong.
  for (const id of badFinished) {
    if (replacements.delete(id)) {
      const code = products.find((p) => p.id === id)?.code ?? id;
      issues.push({ row: 0, message: `Bỏ qua toàn bộ định mức của ${code} vì có dòng lỗi.` });
    }
  }
  const lineCount = [...replacements.values()].reduce((n, ls) => n + ls.length, 0);
  return { replacements, lineCount, issues, totalRows: rows.length };
}

