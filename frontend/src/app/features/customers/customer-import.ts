import { Customer, PriceList, Tag } from '../../core/models/domain.models';
import { ExcelImportConfig } from '../../shared/import/excel-import-dialog.component';
import { CUSTOMER_TYPE_SHORT } from '../../shared/status-labels';

const MONEY = '#,##0';

/** Nhập khách hàng từ Excel (Pha 1.9): keys match the server's CUSTOMER_IMPORT_LABELS. */
export function customerImportConfig(data: { customers: () => Customer[]; tags: () => Tag[]; priceLists: () => PriceList[] }): ExcelImportConfig {
  return {
    title: 'Nhập khách hàng từ Excel',
    noun: 'khách hàng',
    sheetName: 'Khách hàng',
    endpoint: '/customers/import',
    columns: [
      { key: 'code', header: 'Mã KH', width: 13 },
      { key: 'name', header: 'Tên khách hàng', width: 26, required: true },
      { key: 'companyName', header: 'Tên công ty', width: 30 },
      { key: 'type', header: 'Loại khách', width: 11 },
      { key: 'priceList', header: 'Bảng giá', width: 18 },
      { key: 'creditDays', header: 'Số ngày được nợ', width: 14 },
      { key: 'creditLimit', header: 'Hạn mức công nợ', width: 16, numFmt: MONEY },
      { key: 'phone', header: 'Điện thoại', width: 14 },
      { key: 'email', header: 'Email', width: 26 },
      { key: 'idNumber', header: 'CCCD', width: 14 },
      { key: 'personalTaxCode', header: 'MST cá nhân', width: 14 },
      { key: 'companyTaxCode', header: 'MST công ty', width: 14 },
      { key: 'address', header: 'Địa chỉ giao mặc định', width: 40 },
      { key: 'recipientName', header: 'Người nhận', width: 20 },
      { key: 'tags', header: 'Thẻ', width: 20 },
      { key: 'note', header: 'Ghi chú', width: 30 },
      { key: 'isActive', header: 'Đang theo dõi', width: 13 },
    ],
    notes: [
      'Mỗi dòng là một khách hàng. Cột có dấu * là bắt buộc.',
      'Có "Mã KH" (KH…) → CẬP NHẬT khách đó. Để trống "Mã KH" → THÊM MỚI, mã tự cấp.',
      'Khi cập nhật, ô trống hoặc cột không có trong file thì GIỮ NGUYÊN giá trị cũ — có thể chỉ để vài cột (VD: Mã KH + Số ngày được nợ). Muốn xoá một thông tin thì sửa ở form khách hàng.',
      'Khách mới trùng điện thoại với khách đã có bị báo lỗi (để nhập lại cùng file không nhân đôi danh bạ) — ghi Mã KH để cập nhật khách đó.',
      `Loại khách: ${Object.values(CUSTOMER_TYPE_SHORT).join(' / ')}. Để trống = Lẻ.`,
      `Bảng giá (ghi đúng tên, để trống = theo loại khách): ${data.priceLists().map((l) => l.name).join(' · ') || 'chưa có bảng giá nào'}.`,
      `Thẻ (ghi đúng tên, nhiều thẻ cách nhau bằng dấu phẩy): ${data.tags().filter((t) => t.isActive).map((t) => t.name).join(' · ')}.`,
      'Địa chỉ giao mặc định: thêm làm địa chỉ mặc định (hoặc chọn địa chỉ đã có cùng nội dung); các địa chỉ khác của khách giữ nguyên.',
      'Số: ghi số thường (5000000) hoặc kiểu Việt Nam (5.000.000). Hạn mức 0 = không giới hạn.',
      '"Đang theo dõi": Có / Không. Để trống = Có.',
      'Sau khi chọn file, hệ thống kiểm tra từng dòng và hiện kết quả — CHƯA LƯU gì cho tới khi bấm Nhập. Dòng lỗi bị bỏ qua.',
    ],
    currentRows: () => {
      const tagName = new Map(data.tags().map((t) => [t.id, t.name]));
      const listName = new Map(data.priceLists().map((l) => [l.id, l.name]));
      return [...data.customers()].sort((a, b) => a.code.localeCompare(b.code)).map((c) => {
        const a = c.addresses?.find((x) => x.isDefault);
        return [
          c.code, c.name, c.companyName ?? '', CUSTOMER_TYPE_SHORT[c.type], c.priceListId ? (listName.get(c.priceListId) ?? '') : '',
          c.creditDays, c.creditLimit ?? 0, c.phone ?? '', c.email ?? '', c.idNumber ?? '', c.personalTaxCode ?? '', c.companyTaxCode ?? '',
          a?.address ?? '', a?.recipientName ?? '', c.tagIds.map((t) => tagName.get(t) ?? '').filter(Boolean).join(', '), c.note ?? '',
          c.isActive ? 'Có' : 'Không',
        ];
      });
    },
  };
}
