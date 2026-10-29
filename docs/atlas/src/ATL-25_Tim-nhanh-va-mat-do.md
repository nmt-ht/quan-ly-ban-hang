---
title: Tìm hoặc tạo nhanh & mật độ hiển thị
Mã tài liệu: ATL-25
Phân hệ: Hệ thống
Đường dẫn: Thanh trên cùng (Ctrl K) và menu tài khoản
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Hai tiện ích dùng ở mọi màn hình: (1) ô "Tìm hoặc tạo nhanh" để nhảy tới bất kỳ trang hay chứng từ nào, hoặc mở form tạo mới mà không phải đi qua menu; (2) lựa chọn mật độ hiển thị Gọn / Vừa / Rộng để chữ và ô bấm vừa mắt từng người.

## Đối tượng sử dụng

- Mọi người dùng đã đăng nhập.

## Quyền liên quan

Không có quyền riêng.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Nhấn Ctrl K (hoặc "/") → Gõ mã, tên, số điện thoại, biển số… → Chọn kết quả (↑ ↓ Enter) → Mở đúng chứng từ / trang
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Người dùng | Bấm ô "Tìm hoặc tạo nhanh…" ở thanh trên, hoặc nhấn Ctrl K / Cmd K, hoặc "/" khi không gõ trong ô nhập. | Mở hộp tìm kiếm, con trỏ nằm sẵn ở ô gõ. |
| 2 | Người dùng | Để trống: chọn mục trong "Tạo mới" (đơn hàng bán, đơn nhập hàng, phiếu thu, phiếu chi, phiếu nhập kho, phiếu xuất kho, khách hàng, hàng hoá, nhà cung cấp) hoặc "Đi tới" một trang. | Mở form hoặc trang tương ứng. |
| 3 | Người dùng | Gõ để tìm: mã chứng từ, tên khách / hàng / NCC, số điện thoại, biển số xe… | Kết quả gom theo nhóm (tối đa 5 mỗi nhóm), mã khớp đầu tiên. |
| 4 | Người dùng | Dùng ↑ ↓ chọn, Enter mở, Esc đóng. | Mở trang chi tiết của kết quả. |
| 5 | Người dùng | Mở menu tài khoản → "Mật độ hiển thị" → Gọn / Vừa / Rộng. | Cỡ chữ, chiều cao ô nhập và dòng bảng đổi ngay ở mọi màn hình; lưu theo trình duyệt. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Ô tìm trên thanh trên | Dạng một ô nhập có phím tắt "Ctrl K"; trên điện thoại thu thành nút biểu tượng kính lúp. |
| Hộp "Tìm hoặc tạo nhanh" | Ô gõ lớn, danh sách kết quả có biểu tượng, mã, tên và ghi chú ngắn (trạng thái, số điện thoại…); chân hộp gợi ý phím tắt. |
| Mật độ hiển thị | Ba ô chọn trong menu tài khoản: Gọn (nhiều dòng), Vừa (chữ và ô lớn hơn một bậc), Rộng (chữ lớn, dễ đọc, dễ bấm); gợi ý về mật độ hiện một lần. |
| Ô chọn có tìm kiếm | Dùng chung ở mọi form để chọn khách hàng, NCC, đối tượng thu chi, người dùng, mặt hàng, ngân hàng: gõ mã, tên hoặc số điện thoại (không dấu); danh sách xếp tăng dần theo mã (chứng từ có mã) hoặc A → Z (tên). |

# 4. Quy tắc nghiệp vụ

1. Tìm kiếm **không phân biệt dấu** và hoa thường; mọi từ gõ vào đều phải khớp.
1. Phạm vi tìm: đơn hàng bán, khách hàng, hàng hoá, nhà cung cấp, đơn nhập hàng, phiếu kho, lệnh sản xuất, chuyến giao hàng, xe, phiếu thu chi và mọi trang trong menu (kể cả Báo giá, Bảng giá, Khuyến mãi, Nhắc nợ). Chứng từ chỉ tìm trong phần đã nạp lúc đăng nhập (đơn còn mở + 90 ngày gần nhất); chứng từ cũ hơn mở từ danh sách của màn hình đó.
1. Kết quả khớp đúng mã xếp trước, rồi khớp đầu mã / tên, rồi khớp ở giữa.
1. Mật độ: Gọn = ô cao 36 px, chữ 13 px; Vừa = 40 px, 14 px; Rộng = 44 px, 15 px.
1. Hộp tìm kiếm dùng cho bàn phím và trình đọc màn hình (combobox + danh sách); Esc luôn đóng.

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Mọi chức năng | Là lối tắt tới các màn hình và form tạo mới. |
| Đăng nhập & phiên (ATL-01) | Menu tài khoản chứa lựa chọn mật độ và giao diện sáng / tối. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Không có kết quả | Hiện gợi ý "Thử mã đơn, tên khách, số điện thoại hoặc biển số xe." |
| Trình duyệt chặn lưu trữ | Mật độ chỉ giữ trong phiên hiện tại. |

# 7. Ghi chú & giới hạn hiện tại

- Kết quả tìm và các lối tạo nhanh chỉ gồm những gì chức vụ được phép mở.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
