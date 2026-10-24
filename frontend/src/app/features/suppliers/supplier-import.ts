import { Supplier } from '../../core/models/domain.models';
import { ExcelImportConfig } from '../../shared/import/excel-import-dialog.component';

/** Nhập nhà cung cấp từ Excel (Pha 1.9): keys match the server's SUPPLIER_IMPORT_LABELS. */
export function supplierImportConfig(suppliers: () => Supplier[]): ExcelImportConfig {
  return {
    title: 'Nhập nhà cung cấp từ Excel',
    noun: 'nhà cung cấp',
    sheetName: 'Nhà cung cấp',
    endpoint: '/suppliers/import',
    columns: [
      { key: 'code', header: 'Mã NCC', width: 13 },
      { key: 'name', header: 'Tên nhà cung cấp', width: 30, required: true },
      { key: 'contactPhone', header: 'Điện thoại', width: 14 },
      { key: 'email', header: 'Email', width: 26 },
      { key: 'taxCode', header: 'Mã số thuế', width: 14 },
      { key: 'address', header: 'Địa chỉ', width: 40 },
      { key: 'creditDays', header: 'Số ngày được nợ', width: 14 },
      { key: 'note', header: 'Ghi chú', width: 30 },
      { key: 'isActive', header: 'Còn hợp tác', width: 12 },
    ],
    notes: [
      'Mỗi dòng là một nhà cung cấp. Cột có dấu * là bắt buộc.',
      'Có "Mã NCC" → CẬP NHẬT nhà cung cấp đó. Để trống → THÊM MỚI, mã tự cấp.',
      'Khi cập nhật, ô trống hoặc cột không có trong file thì GIỮ NGUYÊN giá trị cũ. Muốn xoá một thông tin thì sửa ở form nhà cung cấp.',
      'NCC mới trùng mã số thuế hoặc điện thoại với NCC đã có bị báo lỗi — ghi Mã NCC để cập nhật NCC đó.',
      'Số ngày được nợ: số nguyên, 0 = trả ngay. "Còn hợp tác": Có / Không, để trống = Có.',
      'Sau khi chọn file, hệ thống kiểm tra từng dòng và hiện kết quả — CHƯA LƯU gì cho tới khi bấm Nhập. Dòng lỗi bị bỏ qua.',
    ],
    currentRows: () => [...suppliers()].sort((a, b) => a.code.localeCompare(b.code)).map((s) => [
      s.code, s.name, s.contactPhone ?? '', s.email ?? '', s.taxCode ?? '', s.address ?? '', s.creditDays ?? 0, s.note ?? '',
      s.isActive ? 'Có' : 'Không',
    ]),
  };
}
