---
title: Thẻ đánh dấu
Mã tài liệu: ATL-21
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/the
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Quản lý các thẻ màu dùng để gắn lên đơn hàng bán và khách hàng (ví dụ "Khách VIP", "Gấp") để lọc và nhận biết nhanh.

## Đối tượng sử dụng

- Quản lý / Sale.

## Quyền liên quan

tag.view / tag.manage.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Tạo thẻ & chọn màu → Gắn thẻ vào đơn / khách → Lọc theo thẻ → Ngừng dùng hoặc xoá
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Thêm thẻ: tên, màu (12 màu có tên), thứ tự. | Mặc định màu Xanh dương. |
| 2 | Sale | Gắn thẻ khi lập đơn hoặc sửa khách. | Thẻ hiện dưới dạng chip màu trong danh sách. |
| 3 | Quản lý | Xem số đơn và số khách đang gắn mỗi thẻ. | Số đếm suy ra từ dữ liệu trên toàn bộ lịch sử (máy chủ đếm), không lưu. |
| 4 | Quản lý | Xoá thẻ chưa dùng; thẻ đang dùng thì Ngừng dùng. | Giữ lịch sử gắn thẻ. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách thẻ | Tên, màu, số đơn, số khách, thứ tự, trạng thái, hành động sửa / ngừng dùng / xoá. |
| Chip thẻ | Hiển thị ở cột Thẻ của danh sách đơn hàng và khách hàng. |

# 4. Quy tắc nghiệp vụ

1. Thẻ **dùng chung** cho đơn hàng bán và khách hàng.
1. Số đơn / số khách gắn thẻ là **số suy ra**, không lưu trên thẻ.
1. **Xoá chỉ khi chưa gắn vào đơn / khách nào**; thẻ đang dùng thì Ngừng dùng để giữ lịch sử.
1. Thẻ ngừng dùng không chọn được cho chứng từ mới.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name, color | Chuỗi, mã màu | Tên và màu thẻ. |
| sortOrder, isActive | Số, cờ | Thứ tự và trạng thái. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Gắn và lọc theo thẻ. |
| Khách hàng (ATL-11) | Gắn và lọc theo thẻ. |
| Màu hiển thị (ATL-24) | 12 màu có tên dùng chung với các tag trạng thái. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Xoá thẻ đang dùng | Báo không xoá được, gợi ý Ngừng dùng. |

# 8. Ghi chú & giới hạn hiện tại

- Quyền Quản lý thẻ gộp thêm/sửa/xoá.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
