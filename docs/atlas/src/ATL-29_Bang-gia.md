---
title: Bảng giá riêng
Mã tài liệu: ATL-29
Phân hệ: Bán hàng
Đường dẫn: /bang-gia
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Đặt giá riêng cho một nhóm khách (đại lý, công trình, khách thân thiết…) khác với ba mức giá lẻ / sỉ / dropship của hàng hoá. Bảng giá được gán cho khách ở form Khách hàng; đơn bán và báo giá của khách đó tự lấy giá trong bảng.

## Đối tượng sử dụng

- CEO / Quản lý: lập và sửa bảng giá.
- Sale: xem giá áp trên đơn.

## Quyền liên quan

Đọc: mọi người đã đăng nhập (để áp giá trên đơn). Lập / sửa / ngừng dùng: pricelist.manage (mặc định CEO, Quản lý).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm bảng giá → Thêm mặt hàng + ĐVT + giá → Gán bảng giá cho khách (ATL-11) → Đơn / báo giá tự lấy giá
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Bấm "Thêm bảng giá": tên (không trùng), ghi chú, Đang dùng. | Bảng giá xuất hiện ở danh sách và trong ô Bảng giá của form khách hàng. |
| 2 | Quản lý | Thêm dòng: mặt hàng, ĐVT, giá trong bảng; có thể "Điền nhanh: giá lẻ − x%" và "Áp cho mọi dòng". | Bảng hiện giá lẻ, giá sỉ để so sánh. |
| 3 | Quản lý | Lưu. | Đơn và báo giá đã lưu giữ nguyên giá cũ; chứng từ mới dùng giá mới. |
| 4 | Sale | Ở form khách hàng chọn bảng giá cho khách. | Mặt hàng có trong bảng dùng giá của bảng; mặt hàng khác vẫn theo loại khách. |
| 5 | Quản lý | Bỏ "Đang dùng" khi không áp nữa. | Khách đang gán bảng này về giá theo loại khách. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách bảng giá | Tên, số giá, số khách đang dùng, trạng thái, thao tác; trạng thái rỗng "Chưa có bảng giá riêng — mọi khách đang lấy giá theo loại khách". |
| Form bảng giá | Tên, ghi chú, Đang dùng; lưới Hàng hoá · ĐVT · Giá lẻ · Giá sỉ · Giá trong bảng; công cụ điền nhanh; có cảnh báo khi rời trang còn thay đổi chưa lưu. |

# 4. Quy tắc nghiệp vụ

1. **Thứ tự lấy giá trên dòng đơn / báo giá:** giá bảng đúng ĐVT của dòng → giá ĐVT chính của bảng × tỷ lệ quy đổi → giá lẻ / sỉ / dropship theo loại khách. Bảng ngừng dùng thì bỏ qua.
1. Mỗi mặt hàng + ĐVT chỉ một giá trong một bảng.
1. Giá đã chốt vào dòng đơn / báo giá khi lưu; đổi bảng giá sau đó không làm đổi chứng từ cũ.
1. Người không có quyền sửa đơn giá phải giữ giá theo bảng của khách — máy chủ kiểm tra lại.
1. Giá trong bảng vẫn chịu giá bán tối thiểu của mặt hàng (ATL-04).
1. Không xoá bảng giá — ngừng dùng thay vì xoá.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name, note, isActive | Chuỗi, cờ | Tên (duy nhất), ghi chú, đang dùng. |
| items[] | Danh sách | productId, unitName, price (₫, chưa thuế). |
| Customer.priceListId | Mã | Bảng giá gán cho khách. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Khách hàng (ATL-11) | Gán bảng giá cho khách. |
| Đơn hàng bán (ATL-12), Báo giá (ATL-28) | Nguồn đơn giá. |
| Khuyến mãi (ATL-30) | Khuyến mãi có thể áp cho "khách dùng bảng giá" cụ thể. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng tên bảng giá | "Đã có bảng giá tên này." |
| Rời trang khi còn thay đổi chưa lưu | Hỏi xác nhận trước khi rời. |

# 8. Ghi chú & giới hạn hiện tại

- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
