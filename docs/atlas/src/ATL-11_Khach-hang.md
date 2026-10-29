---
title: Khách hàng
Mã tài liệu: ATL-11
Phân hệ: Bán hàng
Đường dẫn: /khach-hang, /khach-hang/them-moi, /khach-hang/:id, /khach-hang/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh bạ khách hàng: loại khách (lẻ / sỉ / dropship) quyết định mức giá, bảng giá riêng (nếu gán) ưu tiên hơn, số ngày được nợ quyết định hạn thu tiền, hạn mức công nợ chặn bán vượt nợ, nhiều địa chỉ giao hàng, thẻ đánh dấu; chi tiết khách tổng hợp đơn hàng, doanh số và công nợ.

## Đối tượng sử dụng

- Sale: thêm, sửa khách, chăm sóc.
- Kế toán: xem công nợ.
- Quản lý: xem toàn bộ.

## Quyền liên quan

customer.view / create / update / delete (ngừng theo dõi). Đổi hạn mức công nợ cần thêm debt.adjust.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm khách hàng → Chọn loại khách & số ngày được nợ → Khai báo địa chỉ giao → Lập đơn hàng bán
[next]
[flow] Theo dõi doanh số & công nợ
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Sale | Thêm khách: tên, tên công ty, loại khách, bảng giá (tuỳ chọn), số ngày được nợ, hạn mức công nợ, điện thoại, email, CCCD, mã số thuế cá nhân / công ty, ghi chú, thẻ đánh dấu. | Mã KH cấp tự động; cảnh báo nếu trùng điện thoại, mã số thuế hoặc tên với khách khác. |
| 2 | Sale | Thêm nhiều địa chỉ giao; đánh dấu địa chỉ mặc định. | Luôn có đúng một địa chỉ mặc định khi có địa chỉ. |
| 3 | Sale | Gắn thẻ đánh dấu (ví dụ khách quen, VIP). | Thẻ dùng chung với đơn hàng bán. |
| 4 | Sale | Lập đơn hàng bán từ chi tiết khách. | Loại khách chọn bảng giá; địa chỉ mặc định điền sẵn. |
| 5 | Sale / Quản lý | Ngừng theo dõi khi khách không còn giao dịch. | Đổi trạng thái, không xoá; đơn và công nợ giữ nguyên. |
| 6 | Sale | Nhập Excel nhiều khách cùng lúc ("Nhập Excel" ở danh sách). | Máy chủ chạy thử, hiện xem trước từng dòng (thêm mới / cập nhật / không đổi / lỗi); có mã thì cập nhật (ô trống giữ nguyên), không mã thì thêm mới; trùng điện thoại / MST với khách đã có bị chặn. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo tên, mã, điện thoại, mã số thuế; lọc Loại khách, Thẻ, Trạng thái, nút "Còn công nợ"; sắp xếp; xuất Excel, Nhập Excel. Số đơn và doanh số tính trên toàn bộ lịch sử ở máy chủ. Cột: Mã KH, Tên, Loại, Thẻ, Liên hệ, MST, Được nợ, Đơn hàng, Đã mua, Còn phải thu, Trạng thái. |
| Form thêm/sửa | Khối: Thông tin chung (mã tự cấp, tên bắt buộc, tên công ty, loại khách, Bảng giá — "— Theo loại khách —" hoặc một bảng giá riêng, số ngày được nợ, Hạn mức công nợ (₫), điện thoại, email, thẻ đánh dấu) · Giấy tờ (CCCD, MST cá nhân, MST công ty) · Ghi chú · Địa chỉ giao hàng (tên điểm giao, người nhận, điện thoại, địa chỉ). |
| Chi tiết khách | Tab Thông tin chung · Địa chỉ giao hàng · Đơn hàng (lịch sử mua: số đơn, doanh số khách đã nhận, trung bình mỗi đơn, mua lần cuối) · Sổ công nợ (sổ chi tiết & biên bản đối chiếu) · Nhật ký. Nút: Danh sách, Lập đơn hàng, Lập phiếu thu, Sửa, Ngừng theo dõi / Theo dõi lại. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Đang theo dõi | Chọn được khi lập đơn. | Ngừng theo dõi |
| Ngừng theo dõi | Không hiện ở lựa chọn đơn mới; lịch sử giữ. | Theo dõi lại |

# 5. Quy tắc nghiệp vụ

1. **Loại khách** quyết định giá bán: Khách lẻ → Giá lẻ; Khách sỉ → Giá sỉ; Dropship → Giá dropship. Khách gán **bảng giá riêng** (ATL-29): mặt hàng có trong bảng dùng giá của bảng, mặt hàng khác vẫn theo loại khách; bảng ngừng dùng thì về giá theo loại khách.
1. **Hạn mức công nợ** (0 = không giới hạn): đơn bán làm tổng nợ của khách vượt mức bị chặn; người có quyền Điều chỉnh công nợ được cho qua ("Vẫn lưu đơn (vượt hạn mức)"). Máy chủ khoá dòng khách khi kiểm nên hai đơn lưu cùng lúc không cùng lọt.
1. **Số ngày được nợ** (0 = trả khi nhận hàng): hạn thu = ngày khách nhận hàng + số ngày được nợ.
1. Tên hiện trên chứng từ: có tên công ty thì dùng tên công ty.
1. Đơn hàng, doanh số, công nợ của khách đều **suy ra từ dữ liệu**, không lưu trên khách.
1. Không xoá khách: Ngừng theo dõi chỉ đổi trạng thái.
1. Cảnh báo trùng điện thoại / mã số thuế / tên khi lưu.
1. Khách đã ngừng theo dõi không xuất hiện ở báo cáo Khách ngừng mua.
1. Kiểm tra định dạng: CCCD 12 số (hoặc CMND 9 số); MST 10 số (chi nhánh 10 số + "-" + 3 số); điện thoại 8–15 chữ số; số ngày được nợ 0–365.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | KH + 7 số | Mã khách. |
| name, companyName, type | Chuỗi, enum | Tên, tên công ty, LE / SI / DROPSHIP. |
| phone, email, idNumber, personalTaxCode, companyTaxCode | Chuỗi | Điện thoại, email, CCCD, MST cá nhân, MST công ty (có kiểm tra định dạng). |
| creditDays | Số ngày | Số ngày được nợ. |
| creditLimit | Số (₫) | Hạn mức công nợ; 0 = không giới hạn. |
| priceListId | Mã | Bảng giá riêng; trống = giá theo loại khách. |
| addresses[] | Danh sách | Địa chỉ giao, có cờ mặc định. |
| tagIds, isActive, note, createdAt | Khác | Thẻ, trạng thái, ghi chú. |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Đơn gắn khách; giá theo loại khách. |
| Công nợ phải thu (ATL-15) | Số dư và tuổi nợ theo khách. |
| Thẻ đánh dấu (ATL-21) | Gắn thẻ cho khách. |
| Bảng giá (ATL-29), Khuyến mãi (ATL-30) | Bảng giá gán cho khách; khuyến mãi theo loại khách hoặc bảng giá. |
| Báo giá (ATL-28), Nhắc nợ (ATL-31) | Báo giá gửi khách; nhắc nợ và thông báo công nợ. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng thông tin | Cảnh báo, cho phép sửa hoặc vẫn lưu. |
| Đơn mới vượt hạn mức công nợ | Chặn lưu đơn, báo nợ hiện tại và hạn mức; người có quyền Điều chỉnh công nợ thấy nút "Vẫn lưu đơn (vượt hạn mức)". |
| Không tìm thấy khách | Trang trống kèm nút về danh sách. |

# 9. Ghi chú & giới hạn hiện tại

- Đường dẫn /khach-hang/them tự chuyển sang /khach-hang/them-moi.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
