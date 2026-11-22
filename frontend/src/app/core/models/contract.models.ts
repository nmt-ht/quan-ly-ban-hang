// Hợp đồng bán (HDB…) / mua (HDM…): thoả thuận khung với khách hàng hoặc nhà cung cấp. Đơn bán / đơn mua gắn vào để theo dõi
// giá trị đã thực hiện so với giá trị hợp đồng. Không ghi sổ, không động tới kho.

export type ContractKind = 'BAN' | 'MUA';
export type ContractStatus = 'DANG_THUC_HIEN' | 'DA_THANH_LY' | 'HUY';

/** An order linked to the contract, as the detail page lists it (a seller sees only their own). */
export interface ContractOrderRef {
  id: string;
  code: string;
  date: string;
  status: string;
  total: number;
  received: number;
}

export interface Contract {
  id: string;
  code: string;
  kind: ContractKind;
  /** Số hợp đồng ghi trên bản hai bên ký. */
  contractNo: string | null;
  title: string;
  customerId: string | null;
  supplierId: string | null;
  partnerId: string | null;
  partnerCode: string;
  partnerName: string;
  signedDate: string;
  startDate: string | null;
  endDate: string | null;
  /** Giá trị hợp đồng (gồm thuế); 0 = không ấn định. */
  value: number;
  paymentTerms: string | null;
  description: string | null;
  status: ContractStatus;
  closedDate: string | null;
  closeNote: string | null;
  owner: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Đơn không huỷ gắn vào hợp đồng, giá trị của chúng (gồm thuế) và phần khách / nhà cung cấp đã giao nhận. */
  orderCount: number;
  orderValue: number;
  receivedValue: number;
  /** % giá trị đơn trên giá trị hợp đồng; null khi hợp đồng không ấn định giá trị. */
  percent: number | null;
  remaining: number | null;
  over: boolean;
  /** Only on the detail response. */
  orders?: ContractOrderRef[];
}

export interface ContractDraft {
  kind: ContractKind;
  contractNo?: string;
  title: string;
  customerId?: string;
  supplierId?: string;
  signedDate: string;
  startDate?: string;
  endDate?: string;
  value: number;
  paymentTerms?: string;
  description?: string;
  owner?: string;
}
