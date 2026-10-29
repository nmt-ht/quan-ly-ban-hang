---
title: Người dùng
Mã tài liệu: ATL-22
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/nguoi-dung, /thiet-lap/nguoi-dung/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Quản lý tài khoản đăng nhập của nhân viên: tạo tài khoản, gán chức vụ, đặt lại mật khẩu, khoá/mở khoá, theo dõi lần đăng nhập gần nhất.

## Đối tượng sử dụng

- CEO / Quản trị: quản lý tài khoản.

## Quyền liên quan

user.view / create / update / delete / reset_password.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm người dùng → Gán chức vụ → Cấp mật khẩu → Khoá / đặt lại mật khẩu khi cần
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản trị | Bấm "Thêm người dùng": họ tên, email đăng nhập, điện thoại, chức vụ, ghi chú, mật khẩu. | Mật khẩu ≥ 8 ký tự, có cả chữ và số; nút gợi ý sinh mật khẩu tạm ngẫu nhiên (không ký tự dễ nhầm). |
| 2 | Quản trị | Sửa thông tin, đổi chức vụ. | Số người dùng của chức vụ cập nhật. |
| 3 | Quản trị | Bấm "Đặt lại mật khẩu": nhập hoặc sinh mật khẩu mới; tuỳ chọn "Bắt đổi mật khẩu ở lần đăng nhập tới". | Mọi phiên của người dùng bị đăng xuất; người dùng hiện nhãn "Chờ đổi mật khẩu" cho tới khi tự đổi ở màn /doi-mat-khau (ATL-01). |
| 4 | Quản trị | Bấm "Khoá tài khoản", nhập lý do (ví dụ Nghỉ việc). | Không xoá tài khoản (chứng từ vẫn đứng tên); đăng xuất mọi phiên. "Mở khoá" để dùng lại. |
| 5 | Quản trị | Mở chi tiết người dùng. | Xem email, chức vụ, số quyền, điện thoại, đăng nhập gần nhất, ngày tạo, phiên đang mở, thời điểm khoá, ghi chú và danh sách người cùng chức vụ. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo tên hoặc email; lọc Chức vụ (ô chọn có tìm), Trạng thái, nút "Lâu không đăng nhập" (quá 30 ngày; tài khoản mới tính từ ngày tạo) và "Đang có phiên mở". Cột: Họ tên, Email, Chức vụ, Điện thoại, Đăng nhập gần nhất, Phiên mở, Trạng thái (kèm "Chờ đổi mật khẩu"). |
| Hộp thoại thêm/sửa | Thông tin và chức vụ; mật khẩu khi thêm mới. |
| Hộp thoại mật khẩu | Mật khẩu mới, sinh lại mật khẩu tạm, cờ bắt đổi mật khẩu. |
| Chi tiết người dùng | Hồ sơ, thông tin đăng nhập, phiên đang mở và nút "Đăng xuất mọi phiên", khoá / mở khoá, đặt lại mật khẩu, sửa; tab Nhật ký. Quyền gắn theo chức vụ — muốn đổi quyền của riêng một người thì đổi chức vụ. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Hoạt động | Đăng nhập được. | Khoá |
| Bị khoá | Không đăng nhập; chứng từ vẫn đứng tên. | Mở khoá |

# 5. Quy tắc nghiệp vụ

1. **Mật khẩu:** từ 8 ký tự, có cả chữ và số.
1. **Tài khoản CEO cuối cùng** (hoạt động, giữ chức vụ hệ thống) phải luôn còn hoạt động và giữ chức vụ — không khoá/đổi chức vụ được.
1. **Khoá** thay cho xoá: đăng xuất mọi phiên, giữ tên trên chứng từ.
1. **Đặt lại mật khẩu** đăng xuất mọi phiên; có thể bắt đổi ở lần đăng nhập tới — khi đó máy chủ chặn mọi thao tác của người đó cho tới khi đổi xong. Tài khoản mới do quản trị tạo cũng phải đổi mật khẩu ở lần đăng nhập đầu.
1. Người giữ **chức vụ đã ngừng dùng** không đăng nhập được (ATL-23).
1. Số người dùng của mỗi chức vụ tính theo tài khoản (kể cả bị khoá).
1. Nhân viên được gán làm tài xế xe lấy tên từ tài khoản.
1. Không tự khoá tài khoản của chính mình.
1. Email đăng nhập là duy nhất ("Email đã được dùng").
1. Mật khẩu chỉ gửi một lần và được lưu dạng băm (bcrypt) ở máy chủ; giao diện không giữ mật khẩu.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name, email, phone | Chuỗi | Họ tên, email đăng nhập, điện thoại. |
| roleId | Mã | Chức vụ. |
| status, lockedAt, lockedReason | Khác | Trạng thái và thông tin khoá. |
| lastLoginAt, createdAt, passwordUpdatedAt, mustChangePassword | Thời điểm, cờ | Mốc đăng nhập, mật khẩu, cờ bắt đổi. |
| note | Chuỗi | Ghi chú. |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Chức vụ & phân quyền (ATL-23) | Chức vụ quyết định quyền. |
| Danh mục xe (ATL-14) | Gán tài xế. |
| Mọi chứng từ | Hiện tên người lập / người bán. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Khoá hoặc đổi chức vụ CEO cuối cùng | Chặn, báo cần giữ ít nhất một CEO hoạt động. |
| Mật khẩu yếu | Báo lỗi theo quy tắc. |
| Trùng email | Báo lỗi tại trường email. |

# 9. Ghi chú & giới hạn hiện tại

- Khoá tài khoản, đặt lại mật khẩu và "Đăng xuất mọi phiên" thu hồi ngay các phiên đang mở của người đó.
- Ở chế độ nhiều doanh nghiệp, chủ nền tảng có thể cấp lại mật khẩu cho tài khoản quản trị của doanh nghiệp (ATL-34); thao tác ghi vào Nhật ký với người thực hiện "Quản trị nền tảng".
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
