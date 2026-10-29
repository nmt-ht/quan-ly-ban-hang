---
title: Loại thu chi
Mã tài liệu: ATL-18
Phân hệ: Dòng tiền
Đường dẫn: /thu-chi/loai
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh mục phân loại phiếu thu / phiếu chi; loại quyết định phiếu có gắn đối tác (khách hàng, nhà cung cấp) và có đối trừ công nợ hay không.

## Đối tượng sử dụng

- Kế toán / Quản lý.

## Quyền liên quan

voucher.view (xem); voucher.manage_category (thêm, sửa, đặt mặc định, ngừng dùng).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm loại → Chọn chiều Thu / Chi & đối tác → Dùng khi lập phiếu
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Bấm "Thêm loại": tên, chiều (Thu / Chi), đối tác (Khách hàng / Nhà cung cấp / Không gắn). | Loại xuất hiện ở form phiếu cùng chiều. |
| 2 | Kế toán | Tick "Mặc định khi lập phiếu" cho một loại mỗi chiều. | Loại đó được chọn sẵn và có nhãn "Mặc định". |
| 3 | Kế toán | Sửa tên hoặc bấm "Ngừng dùng" loại tự tạo. | Đổi tên: phiếu cũ đổi theo. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách loại | Tên, chiều, đối tác, mặc định, hệ thống / tự tạo, trạng thái; mô tả tác động: gắn khách/NCC thì làm giảm công nợ, không gắn thì chỉ ghi sổ quỹ. |

# 4. Quy tắc nghiệp vụ

1. **Bốn loại hệ thống có sẵn** (không xoá): Thu tiền khách hàng (gắn khách), Thu khác, Chi trả nhà cung cấp (gắn NCC), Chi khác.
1. Loại gắn khách hàng hoặc NCC **làm giảm công nợ**; loại Không gắn chỉ ghi sổ quỹ.
1. Mỗi chiều có một loại mặc định.
1. Phiếu lưu tên loại: đổi tên thì phiếu cũ đổi theo để thống kê không tách đôi.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, name | Chuỗi | Mã (THU_KH, THU_KHAC, CHI_NCC, CHI_KHAC…) và tên. |
| kind | THU / CHI | Chiều. |
| partnerType | enum | KHACH_HANG, NHA_CUNG_CAP, KHAC. |
| isDefault, isActive, isSystem | Cờ | Mặc định, còn dùng, loại hệ thống. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Phiếu thu chi (ATL-16) | Chọn loại khi lập phiếu; báo cáo Thu chi gom theo loại. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Sửa loại hệ thống | Giới hạn: không xoá, giữ chiều và đối tác. |

# 8. Ghi chú & giới hạn hiện tại

- Báo cáo Thu chi có cách nhóm "Theo loại thu chi". Số phiếu của mỗi loại tính trên toàn bộ lịch sử ở máy chủ.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
