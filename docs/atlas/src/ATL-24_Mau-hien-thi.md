---
title: Màu hiển thị
Mã tài liệu: ATL-24
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/mau-hien-thi
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Chọn màu cho các nhãn tính chất và trạng thái trên toàn hệ thống để người dùng nhận biết nhanh bằng màu. Trang chia theo nhóm nhãn (13 nhóm); mỗi nhóm có xem trước cả bộ nhãn trên nền sáng và nền tối.

## Đối tượng sử dụng

- Quản trị / Quản lý.

## Quyền liên quan

Xem: mọi người đã đăng nhập (màu áp cho mọi màn hình). Đổi màu: company.update (Sửa thông tin công ty).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Chọn nhóm nhãn → Xem bộ nhãn trên nền sáng / tối → Chọn màu cho từng giá trị → Khôi phục mặc định (nếu cần)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản trị | Chọn một nhóm ở cột trái (ví dụ Trạng thái đơn hàng bán). Mỗi nhóm hiện các chấm màu hiện tại và số mục đã đổi. | Chi tiết nhóm hiện ở bên phải. |
| 2 | Quản trị | Xem khối "Nền sáng" và "Nền tối": toàn bộ nhãn của nhóm hiển thị cạnh nhau. | Đánh giá được độ hài hoà và độ rõ của cả bộ màu. |
| 3 | Quản trị | Với từng giá trị bấm một trong 12 ô màu (có Xám), hoặc bấm "Tuỳ chỉnh sắc độ" và kéo thanh trượt cầu vồng. | Nhãn đổi ngay ở mọi trang; dòng giá trị ghi tên màu và "đã đổi". |
| 4 | Quản trị | Bấm "Khôi phục mặc định" của nhóm hoặc "Khôi phục tất cả mặc định" ở đầu trang. | Bỏ các màu đã đổi. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách nhóm | Thẻ từng nhóm: tên, nhãn "N đã đổi", chuỗi chấm màu của các giá trị; màn hình dưới 1100 px thành dải cuộn ngang. |
| Đầu chi tiết | Tên nhóm, mô tả nơi nhãn xuất hiện, nút Khôi phục mặc định; hai khung xem trước Nền sáng / Nền tối chứa cả bộ nhãn. |
| Danh sách giá trị | Mỗi dòng: nhãn, tên màu hiện tại, 12 ô màu chọn nhanh, "Tuỳ chỉnh sắc độ" mở thanh trượt (mỗi lần một dòng) kèm giá trị độ. |

# 4. Quy tắc nghiệp vụ

1. Màu là **sắc độ (hue)** cho từng giá trị, hoặc Xám; độ sáng và độ đậm cố định theo thiết kế nên luôn đủ tương phản ở cả nền sáng và nền tối.
1. Đổi màu chỉ đổi cách hiển thị, không đổi dữ liệu.
1. Một nhóm dùng cùng một công thức nhãn ở mọi màn hình để nhất quán.
1. Màu được lưu ở máy chủ theo công ty — mọi người dùng thấy cùng một bộ màu; chỉ người có quyền Sửa thông tin công ty được đổi.

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Mọi danh sách có nhãn trạng thái | Chip trạng thái lấy màu từ đây. |
| Thẻ đánh dấu (ATL-21) | Dùng chung bảng màu. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Chọn màu trùng nhau giữa các giá trị | Cho phép; nhận biết bằng nhãn chữ. |

# 7. Các nhóm nhãn

| Nhóm | Áp dụng ở |
|---|---|
| Tính chất hàng hoá (product-type) | Hàng hoá |
| Trạng thái kinh doanh (business-status) | Hàng hoá |
| Loại khách (customer-type) | Khách hàng |
| Trạng thái khách (customer-status) | Khách hàng |
| Trạng thái nhà cung cấp (supplier-status) | Nhà cung cấp |
| Trạng thái đơn hàng bán (sales-order) | Đơn hàng bán |
| Trạng thái báo giá (quotation) | Báo giá |
| Trạng thái đơn nhập (purchase-order) | Đơn nhập hàng |
| Trạng thái lệnh sản xuất (production-order) | Lệnh sản xuất |
| Trạng thái chuyến (delivery-trip) | Chuyến giao hàng |
| Loại phiếu kho (warehouse-voucher) | Phiếu kho |
| Tình trạng xe (vehicle-status) | Danh mục xe |
| Trạng thái người dùng (user-status) | Người dùng |

# 8. Ghi chú & giới hạn hiện tại

- Màu đã đổi được lưu ở máy chủ theo công ty và áp cho mọi người dùng; máy chủ kiểm tra từng khoá màu và giá trị trước khi lưu; chỉ màu đã đổi được lưu, phần còn lại theo mặc định.
- Màu nhãn khác với màu phân hệ của menu (bán hàng xanh dương, kho cam, mua hàng tím, dòng tiền xanh ngọc, thiết lập xám xanh) — màu phân hệ cố định theo thiết kế.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
