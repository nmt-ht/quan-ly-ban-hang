// Sổ sách TT133, thuế GTGT và hoá đơn mua không qua kho — dạng server trả về (ApiService bỏ các khoá null, nên trường có thể vắng).

export interface AccountBookRow {
  date: string;
  entryId: string;
  code: string; // số bút toán
  description?: string;
  counterAccounts: string; // TK đối ứng, "331, 133"
  partner?: string;
  debit: number;
  credit: number;
  balance: number; // luỹ kế theo chiều số dư thường của TK; âm = dư bên đối diện
}

/** Sổ chi tiết một tài khoản (111 = Sổ quỹ tiền mặt, 112 = Sổ tiền gửi, 131/331 theo đối tượng = Sổ chi tiết công nợ). */
export interface AccountBookView {
  account: { code: string; name: string; normalSide: 'NO' | 'CO' };
  from: string;
  to: string;
  partnerId?: string;
  openingNo: number;
  openingCo: number;
  rows: AccountBookRow[];
  totalDebit: number;
  totalCredit: number;
  closingNo: number;
  closingCo: number;
  truncated: boolean;
  note?: string;
}

export interface PartnerSummaryRow {
  partnerId?: string; // vắng = dòng "chưa phân đối tượng"
  code: string;
  name: string;
  openingNo: number;
  openingCo: number;
  debit: number;
  credit: number;
  closingNo: number;
  closingCo: number;
}

/** Tổng hợp công nợ 131 / 331 theo đối tượng. */
export interface PartnerSummaryView {
  account: { code: string; name: string };
  from: string;
  to: string;
  rows: PartnerSummaryRow[];
  totals: { openingNo: number; openingCo: number; debit: number; credit: number; closingNo: number; closingCo: number };
}

/** Giá trị chưa thuế và thuế GTGT theo một thuế suất; rate -1 = không rõ thuế suất (chứng từ cũ). */
export interface TaxBucket {
  rate: number;
  taxable: number;
  vat: number;
}

export interface VatOutputRow {
  id: string;
  kind: string; // ORIGINAL | ADJUST | REPLACE
  templateCode: string;
  series: string;
  number?: string;
  date: string;
  buyerName: string;
  buyerTaxCode: string;
  orderCode: string;
  taxable: number;
  vat: number;
  total: number;
  buckets: TaxBucket[];
}

export interface VatOutputsView {
  from: string;
  to: string;
  rows: VatOutputRow[];
  buckets: TaxBucket[];
  totals: { taxable: number; vat: number; total: number };
}

export interface VatInputRow {
  kind: 'HOA_DON' | 'TRA_HANG';
  series?: string;
  number: string;
  date: string;
  supplierName: string;
  supplierTaxCode: string;
  refs: string; // đơn nhập / hoá đơn mua mà hoá đơn này phủ
  taxable: number;
  vat: number;
  buckets: TaxBucket[];
}

export interface VatUninvoicedRow {
  source: 'NHAN_HANG' | 'HOA_DON_MUA';
  ref: string;
  date: string;
  supplierName: string;
  taxable: number;
  vat: number;
  known: boolean; // false = chứng từ cũ, không có số liệu thuế
}

export interface VatInputsView {
  from: string;
  to: string;
  rows: VatInputRow[];
  buckets: TaxBucket[];
  totals: { taxable: number; vat: number };
  uninvoiced: VatUninvoicedRow[];
  uninvoicedVat: number;
}

export interface VatSummaryView {
  from: string;
  to: string;
  output: { buckets: TaxBucket[]; taxable: number; vat: number; invoices: number };
  input: { buckets: TaxBucket[]; taxable: number; vat: number; invoices: number; uninvoicedVat: number; uninvoicedCount: number };
  carryForward: number; // thuế còn được khấu trừ đầu kỳ (số dư 133 − 3331 cuối ngày trước kỳ, nếu dương)
  payable: number; // thuế phải nộp trong kỳ
  carryOver: number; // thuế còn được khấu trừ chuyển kỳ sau
  reconciliation: {
    outputVatLedger: number; outputVatInvoiced: number; outputDifference: number;
    inputVatLedger: number; inputVatListed: number; inputDifference: number;
  };
}

export interface PurchaseBillLineView {
  id: string;
  accountCode: string;
  description: string;
  amount: number; // chưa thuế
  vatRate: number;
}

/** Hoá đơn mua hàng / dịch vụ không qua kho (HM…). */
export interface PurchaseBillView {
  id: string;
  code: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  date: string;
  description?: string;
  invoiceSeries?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  taxable: number;
  vat: number;
  total: number;
  isCancelled: boolean;
  cancelReason?: string;
  /** Chi phí mua hàng: đơn nhập nhận phần phân bổ, cách chia và kết quả chia cho từng mặt hàng. */
  purchaseOrderId?: string;
  purchaseOrderCode?: string;
  allocationBasis?: AllocationBasis;
  allocations?: { productId: string; amount: number; toStock: number; toCogs: number }[];
  lines: PurchaseBillLineView[];
}

export type AllocationBasis = 'GIA_TRI' | 'SO_LUONG';

export interface PurchaseBillInput {
  supplierId: string;
  date: string;
  description?: string;
  invoiceSeries?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  purchaseOrderId?: string;
  allocationBasis?: AllocationBasis;
  lines: { accountCode: string; description: string; amount: number; vatRate: number }[];
}
