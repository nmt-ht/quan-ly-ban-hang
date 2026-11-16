// Hoá đơn bán ra phát hành ngoài phần mềm (cổng MISA…) — dạng server trả về (khoá null bị bỏ nên trường có thể vắng).

/** Một đợt giao (hoặc cả đơn) chưa có hoá đơn. `ref` đi kèm file xuất và quay về cùng số hoá đơn. */
export interface OutstandingItem {
  ref: string;
  orderId: string;
  orderCode: string;
  deliveryId: string | null;
  date: string;
  customerName: string;
  taxCode: string;
  amount: number;
}

export interface OutstandingView {
  from: string;
  to: string;
  items: OutstandingItem[];
  truncated: boolean;
}

export interface InvoiceLineView {
  no: number;
  /** 1 hàng hoá · 2 khuyến mại · 3 chiết khấu · 4 ghi chú */
  nature: 1 | 2 | 3 | 4;
  name: string;
  unit: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  vat?: string;
}

export interface BuyerView {
  companyName: string;
  name: string;
  taxCode: string;
  idNumber: string;
  address: string;
  email: string;
  phone: string;
}

export interface ExportDatum {
  orderId: string;
  deliveryId?: string;
  ref?: string;
  orderCode?: string;
  error?: string;
  invoice?: {
    issueDate: string;
    buyer: BuyerView;
    lines: InvoiceLineView[];
    taxable: number;
    vatAmount: number;
    total: number;
  };
}

export interface RecordedInvoice {
  id: string;
  kind: string;
  status: 'PENDING' | 'ISSUED' | 'FAILED' | 'REPLACED' | 'VOID';
  provider: string;
  templateCode: string;
  series: string;
  number?: string;
  issueDate: string;
  taxable: number;
  vat: number;
  total: number;
  reason?: string;
  orderId: string;
  orderCode: string;
  customerName: string;
}

export interface RecordInvoiceInput {
  orderId: string;
  deliveryId?: string;
  templateCode: '1' | '2';
  series: string;
  number: string;
  issueDate: string;
}

export interface RecordImportRow {
  ref: string;
  number: string;
  issueDate: string;
  series?: string;
  templateCode?: '1' | '2';
}

export interface RecordImportResult {
  dryRun: boolean;
  results: { index: number; ref: string; status: 'OK' | 'SKIPPED' | 'ERROR'; message?: string; orderCode?: string }[];
  summary: { ok: number; skipped: number; errors: number };
}
