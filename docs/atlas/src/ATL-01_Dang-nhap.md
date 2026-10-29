---
title: Đăng nhập & phiên làm việc
Mã tài liệu: ATL-01
Phân hệ: Hệ thống
Đường dẫn: /login, /doi-mat-khau
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Cho người dùng đăng nhập vào hệ thống, giữ phiên làm việc và đổi mật khẩu. Mọi màn hình khác yêu cầu đã đăng nhập; chưa đăng nhập sẽ được chuyển về /login. Khi máy chủ chạy chế độ nhiều doanh nghiệp (ATL-34), màn đăng nhập hỏi thêm mã doanh nghiệp.

## Đối tượng sử dụng

- Người dùng có tài khoản đang hoạt động trong danh sách Người dùng (ATL-22).

## Quyền liên quan

Không cần quyền riêng — quyền sau đăng nhập phụ thuộc Chức vụ của tài khoản (ATL-23).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở hệ thống → (Mã doanh nghiệp) + email + mật khẩu → Máy chủ xác thực → Đổi mật khẩu nếu bị buộc
[next]
[flow] Vào Tổng quan
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Người dùng | Mở địa chỉ hệ thống. | Màn khởi động (theo chủ đề sáng / tối và thương hiệu đã nhớ) hiện trong lúc tải; chưa có phiên → chuyển tới /login. |
| 2 | Người dùng | Nhập mã doanh nghiệp (chỉ khi bật nhiều doanh nghiệp; đường dẫn …/login?dn=<mã> điền sẵn), email và mật khẩu, bấm Đăng nhập. | Trình duyệt nhớ mã doanh nghiệp cho lần sau; máy chủ kiểm tra tài khoản. |
| 3 | Hệ thống | Xác thực thành công. | Lưu phiên, nạp danh mục (màn tải có tiến độ từng bước), chuyển tới /tong-quan hoặc trang đang mở trước đó. |
| 4 | Hệ thống | Tài khoản đang bị buộc đổi mật khẩu (mật khẩu do quản trị cấp). | Chuyển tới /doi-mat-khau; chưa đổi thì máy chủ chặn mọi thao tác khác. |
| 5 | Người dùng | Đổi mật khẩu: mật khẩu hiện tại, mật khẩu mới, nhập lại. | Lưu mật khẩu mới; vào hệ thống bình thường. Có thể tự mở trang này từ menu tài khoản bất kỳ lúc nào. |
| 6 | Người dùng | Bấm Đăng xuất (menu tài khoản). | Xoá phiên, quay về /login. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Form đăng nhập | Logo / tên doanh nghiệp đã biết; ô Mã doanh nghiệp (khi bật nhiều doanh nghiệp, gợi ý "Trình duyệt này sẽ nhớ mã cho lần sau"), Email, Mật khẩu; nút Đăng nhập; dòng báo "Phiên đăng nhập đã hết hạn" hoặc "Doanh nghiệp đang tạm ngưng sử dụng" khi bị đưa về. |
| Đổi mật khẩu | Mật khẩu hiện tại, Mật khẩu mới (gợi ý "Từ 8 ký tự, có cả chữ và số"), Nhập lại; khi bị buộc đổi có dòng "Mật khẩu hiện tại do quản trị viên cấp…" và không có nút Quay lại; luôn có Đăng xuất. |
| Menu tài khoản | Góc trên phải: tên, email, chức vụ; Giao diện (Sáng / Tối / Theo hệ thống) và Mật độ hiển thị (Gọn / Vừa / Rộng) là hai hàng ô chọn; Đổi mật khẩu; Đăng xuất. Hai lựa chọn giao diện và mật độ lưu theo trình duyệt. |
| Khung layout | Thanh menu trái chia nhóm, mỗi nhóm một màu phân hệ: Nghiệp vụ (cam), Mua hàng (tím), Bán hàng (xanh dương), Dòng tiền (xanh ngọc), Thiết lập (xám xanh); bấm tên nhóm để gập / mở (được nhớ). Nút Thu gọn còn biểu tượng. Menu chỉ hiện mục chức vụ được mở. Góc trên hiện logo công ty và số phiên bản (ví dụ v1.0.0). Thanh tải mảnh ở thanh trên khi chuyển trang quá 120 ms. |
| Tìm hoặc tạo nhanh | Ô ở thanh trên (Ctrl K, hoặc "/"): xem ATL-25. |

# 4. Quy tắc nghiệp vụ

1. Đăng nhập thành công, máy chủ cấp mã phiên có hạn **12 giờ**, giữ trong trình duyệt và khôi phục khi tải lại trang. Phiên hết hạn hoặc bị thu hồi thì thao tác kế tiếp đưa về /login; đăng nhập lại quay về đúng trang đang mở.
1. Máy chủ đối chiếu email (không phân biệt hoa thường) và mật khẩu. **Tài khoản bị khoá** hoặc **chức vụ đã ngừng dùng** không đăng nhập được; mã phiên đang dùng của họ bị từ chối ở mọi API.
1. **Giới hạn thử mật khẩu:** mặc định 8 lần / 15 phút cho mỗi email trên một địa chỉ IP và 30 lần / 5 phút cho mỗi IP; vượt thì báo "Thử đăng nhập quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."
1. **Buộc đổi mật khẩu:** tài khoản do quản trị tạo hoặc đặt lại mật khẩu (ATL-22) phải đổi ở lần đăng nhập đầu; đến khi đổi, máy chủ chỉ cho xem phiên và đổi mật khẩu.
1. Mật khẩu mới: từ 8 ký tự, có cả chữ và số, khác mật khẩu hiện tại.
1. Khoá tài khoản, đặt lại mật khẩu, "Đăng xuất mọi phiên" (ATL-22) hoặc ngừng dùng chức vụ (ATL-23) thu hồi ngay các phiên; đổi quyền của chức vụ có hiệu lực từ yêu cầu kế tiếp.
1. **Nhiều doanh nghiệp:** mã phiên mang mã doanh nghiệp và chỉ dùng được cho doanh nghiệp đó; doanh nghiệp bị tạm ngưng thì mọi đăng nhập và thao tác bị chặn ngay.
1. Mỗi lần đăng nhập — thành công hay thất bại — được ghi vào Nhật ký hoạt động kèm địa chỉ IP (ATL-27).

# 5. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Sai email hoặc mật khẩu | "Sai email hoặc mật khẩu". Tài khoản bị khoá nhận cùng thông báo để không lộ email nào có trong hệ thống; lý do thật ghi ở Nhật ký. |
| Thử sai quá nhiều lần | Chặn tạm, báo đợi vài phút. |
| Phiên hết hạn hoặc bị thu hồi | Đưa về /login kèm dòng "Phiên đăng nhập đã hết hạn"; đăng nhập lại thì quay về trang đang mở. |
| Doanh nghiệp bị tạm ngưng | Đưa về /login kèm "Doanh nghiệp đang tạm ngưng sử dụng. Vui lòng liên hệ đơn vị cung cấp phần mềm." |
| Mật khẩu mới trùng mật khẩu cũ / không đủ mạnh | Báo lỗi tại ô, nút Đổi mật khẩu không bật. |
| Truy cập đường dẫn không tồn tại | Chuyển về trang chủ (Tổng quan). |

# 6. Ghi chú & giới hạn hiện tại

- Mật khẩu chỉ gửi khi đăng nhập / đổi mật khẩu và lưu dạng băm (bcrypt) ở máy chủ; trình duyệt không giữ mật khẩu.
- Chủ nền tảng đăng nhập ở trang riêng /quan-tri-nen-tang bằng mật khẩu + mã TOTP (ATL-34); phiên đó không dùng được cho API của doanh nghiệp và ngược lại.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
