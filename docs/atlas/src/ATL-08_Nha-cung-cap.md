---
title: Nhà cung cấp
Mã tài liệu: ATL-08
Phân hệ: Mua hàng
Đường dẫn: /nha-cung-cap, /nha-cung-cap/them, /nha-cung-cap/:id, /nha-cung-cap/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh bạ nhà cung cấp: thông tin liên hệ, mã số thuế, số ngày được nợ, danh mục mặt hàng NCC bán (mã theo NCC, giá mua), lịch sử đơn nhập và công nợ phải trả.

## Đối tượng sử dụng

- Thu mua / Quản lý: thêm sửa NCC.
- Kế toán: xem công nợ.

## Quyền liên quan

supplier.view / create / update / delete (ngừng hợp tác) / manage_product (danh mục hàng của NCC). Giá mua theo NCC chỉ hiện với chức vụ mua hàng, định giá hoặc xem công nợ.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm nhà cung cấp → Khai báo danh mục hàng của NCC → Lập Đơn nhập hàng → Theo dõi công nợ phải trả
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thu mua | Thêm NCC: tên, điện thoại, email, mã số thuế, số ngày được nợ, địa chỉ, ghi chú. | Mã NCC tự cấp (NCC + số); cảnh báo nếu trùng mã số thuế hoặc tên (không phân biệt dấu) với NCC khác. |
| 2 | Thu mua | Trong chi tiết NCC, thêm mặt hàng NCC cung cấp: mã theo NCC, giá mua. | Thêm lại mặt hàng đã có sẽ cập nhật mã và giá. |
| 3 | Thu mua | Lập đơn nhập từ chi tiết NCC. | NCC được chọn sẵn trên đơn mới (?ncc=). |
| 4 | Kế toán | Xem công nợ phải trả của NCC; lập phiếu chi. | Liên kết sang Công nợ phải trả / Phiếu thu chi. |
| 5 | Quản lý | Ngừng hợp tác khi không mua nữa. | Đổi trạng thái, không xoá; đơn và công nợ giữ nguyên. |
| 6 | Thu mua | Nhập Excel nhiều nhà cung cấp cùng lúc ("Nhập Excel" ở danh sách). | Máy chủ chạy thử và hiện xem trước từng dòng (thêm mới / cập nhật / không đổi / lỗi); dòng có mã thì cập nhật (ô trống giữ nguyên), không mã thì thêm mới; trùng điện thoại / mã số thuế với NCC đã có bị chặn. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo tên, mã, điện thoại, mã số thuế, địa chỉ; lọc Trạng thái, Điều kiện thanh toán, nút "Còn công nợ"; sắp xếp; xuất Excel, Nhập Excel. Cột: Mã NCC, Tên, Liên hệ, MST, Địa chỉ, Được nợ, Mặt hàng, Đơn nhập, Còn phải trả, Trạng thái. |
| Form thêm/sửa | Mã nhà cung cấp (tự cấp), Tên (bắt buộc), Điện thoại, Email, Mã số thuế, Số ngày được nợ, Địa chỉ, Ghi chú. |
| Chi tiết | Tab Thông tin chung · Danh mục hàng (mã hàng theo NCC, giá mua, giá trên đơn gần nhất) · Đơn nhập · Công nợ (khoản còn phải trả, lịch sử thanh toán) · Nhật ký. Đơn nhập và thanh toán đọc từ máy chủ trên toàn bộ lịch sử. Nút: Danh sách, Lập đơn nhập (chọn sẵn NCC), Lập phiếu chi, Sửa, Ngừng hợp tác / Hợp tác lại. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Còn hợp tác | Chọn được khi lập đơn nhập. | Ngừng hợp tác |
| Ngừng hợp tác | Không chọn cho đơn mới; lịch sử giữ. | Hợp tác lại |

# 5. Quy tắc nghiệp vụ

1. Số ngày được nợ quyết định hạn thanh toán: **hạn = ngày nhận hàng của từng lần nhận + số ngày được nợ**; mỗi lần nhận là một khoản công nợ riêng.
1. Danh mục hàng theo NCC, số đơn nhập và công nợ đều **suy ra từ dữ liệu**, không lưu trên NCC.
1. Không xoá NCC: Ngừng hợp tác là đổi trạng thái.
1. Cảnh báo trùng mã số thuế / tên khi thêm hoặc sửa. Mã số thuế 10 chữ số (chi nhánh 10 số + "-" + 3 số); điện thoại 8–15 chữ số; số ngày được nợ 0–365.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, name | NCC + 7 số, chuỗi | Mã và tên NCC. |
| contactPhone, email, address, taxCode | Chuỗi | Điện thoại, email, địa chỉ, mã số thuế. |
| creditDays | Số ngày | Số ngày được nợ. |
| isActive | Cờ | Còn hợp tác. |
| note, createdAt | Chuỗi, ngày | Ghi chú, ngày tạo. |
| SupplierProduct | Danh sách | productId, mã theo NCC, giá mua. |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn nhập hàng (ATL-09) | Đơn gắn NCC. |
| Công nợ phải trả (ATL-10) | Số dư và tuổi nợ theo NCC. |
| Hàng hoá (ATL-04) | Mặt hàng mà NCC cung cấp. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng mã số thuế / tên | Cảnh báo, người dùng quyết định lưu hay sửa. |
| Không tìm thấy NCC | Trang trống kèm nút về danh sách. |

# 9. Ghi chú & giới hạn hiện tại

- Công nợ phải trả của NCC chỉ phát sinh khi nhận hàng.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
