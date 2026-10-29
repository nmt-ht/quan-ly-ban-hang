---
title: Quản trị nền tảng (nhiều doanh nghiệp)
Mã tài liệu: ATL-34
Phân hệ: Hệ thống
Đường dẫn: /quan-tri-nen-tang
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Cho một bản triển khai phục vụ nhiều doanh nghiệp, **mỗi doanh nghiệp một cơ sở dữ liệu riêng**. Chỉ chủ nền tảng vào được trang này để tạo doanh nghiệp, tạm ngưng / mở lại, cấp lại mật khẩu quản trị, cập nhật cấu trúc dữ liệu và xem nhật ký nền tảng. Không bật chế độ này thì hệ thống vẫn là bản một doanh nghiệp.

## Đối tượng sử dụng

- Chủ nền tảng (đơn vị cung cấp phần mềm) — không phải người dùng của doanh nghiệp.

## Quyền liên quan

Không dùng chức vụ / quyền của doanh nghiệp. Đăng nhập bằng email + mật khẩu chủ nền tảng (đặt trên máy chủ) và mã TOTP 6 số. Phiên quản trị nền tảng ký bằng khoá riêng nên không gọi được API của doanh nghiệp, và ngược lại.

# 2. Quy trình (workflow)

[flow] Đăng nhập + mã TOTP → Thêm doanh nghiệp → Gửi mật khẩu tạm + đường dẫn …/login?dn=<mã> → Quản trị đổi mật khẩu lần đầu
[next]
[flow] Tạm ngưng / Mở lại · Cấp lại mật khẩu · Cập nhật cấu trúc
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Chủ nền tảng | Mở /quan-tri-nen-tang, nhập email + mật khẩu. Lần đầu: quét mã QR bằng Google Authenticator / Microsoft Authenticator / 1Password rồi nhập mã 6 số. | Từ đó mỗi lần đăng nhập cần mã 6 số; mã đã dùng không dùng lại được. |
| 2 | Chủ nền tảng | "Thêm doanh nghiệp": tên, mã doanh nghiệp (chữ thường không dấu, số, gạch ngang; không đổi được), email quản trị, mật khẩu ban đầu (để trống = tự tạo); tuỳ chọn nạp dữ liệu mẫu hoặc dùng cơ sở dữ liệu có sẵn (dán chuỗi kết nối). | Tạo database nt_<mã>, dựng cấu trúc, nạp danh mục ban đầu (quyền, chức vụ, loại thu chi, "Kho chính", quỹ tiền mặt và ngân hàng) và tài khoản quản trị chức vụ CEO — khoảng nửa phút. Mật khẩu tạm hiện **một lần** kèm đường dẫn đăng nhập. |
| 3 | Quản trị doanh nghiệp | Đăng nhập lần đầu bằng mã doanh nghiệp + email + mật khẩu tạm. | Bị buộc đổi mật khẩu (ATL-01). |
| 4 | Chủ nền tảng | Tạm ngưng / Mở lại một doanh nghiệp. | Tạm ngưng chặn ngay mọi đăng nhập và thao tác của doanh nghiệp đó; dữ liệu giữ nguyên. |
| 5 | Chủ nền tảng | Cấp lại mật khẩu cho tài khoản quản trị (hoặc email khác) của doanh nghiệp. | Mật khẩu tạm mới (hiện một lần), các phiên cũ kết thúc, ghi vào Nhật ký hoạt động của doanh nghiệp với người thực hiện "Quản trị nền tảng". |
| 6 | Chủ nền tảng | Cập nhật cấu trúc dữ liệu / Chạy lại cho doanh nghiệp lỗi. | Mỗi lần máy chủ khởi động đều chạy cập nhật cấu trúc cho mọi doanh nghiệp; doanh nghiệp lỗi hiện trên trang kèm lỗi gần nhất. |
| 7 | Chủ nền tảng | Xem Nhật ký nền tảng. | Mọi lần đăng nhập (cả thất bại) và mọi thao tác trên doanh nghiệp. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Đăng nhập | Email, mật khẩu, mã xác thực 6 số; lần đầu hiện mã QR đăng ký ứng dụng xác thực. "Chỉ chủ nền tảng. Mọi lần đăng nhập đều được ghi nhật ký." |
| Danh sách doanh nghiệp | Đếm doanh nghiệp đang hoạt động / tạm ngưng / tạo lỗi; cột Doanh nghiệp, Mã, Cơ sở dữ liệu, Quản trị, Trạng thái, Tạo lúc, Lỗi gần nhất, Thao tác (Đổi tên, Tạm ngưng / Mở lại, Cấp lại mật khẩu, Chạy lại); nút Cập nhật cấu trúc dữ liệu. |
| Hộp Thêm doanh nghiệp | Tên, mã, email quản trị, mật khẩu ban đầu, nạp dữ liệu mẫu, dùng cơ sở dữ liệu có sẵn (chuỗi kết nối PostgreSQL, mã hoá khi lưu). |
| Hộp mật khẩu tạm | Hiện mật khẩu và đường dẫn đăng nhập một lần; "Đã gửi, ẩn đi". |
| Nhật ký nền tảng | Thời gian, IP, thao tác, nội dung. |
| Chưa bật chế độ | Trang giải thích các biến môi trường cần đặt: PLATFORM_DATABASE_URL, PLATFORM_SECRET, PLATFORM_OWNER_EMAIL, PLATFORM_OWNER_PASSWORD. |

# 4. Quy tắc nghiệp vụ

1. **Cách ly:** mỗi yêu cầu chạy với cơ sở dữ liệu của doanh nghiệp ghi trong header X-Tenant; mã phiên đăng nhập mang mã doanh nghiệp và bị từ chối nếu dùng cho doanh nghiệp khác. Đường dẫn API được so ở dạng chữ thường để không thể né kiểm tra doanh nghiệp bằng chữ hoa.
1. Lần khởi động đầu ở chế độ này, doanh nghiệp đang dùng DATABASE_URL thành doanh nghiệp đầu tiên (mã mặc định ninhtrang); người dùng chỉ cần nhập thêm mã doanh nghiệp một lần.
1. Mã doanh nghiệp không đổi được; tên đổi được.
1. **Không có nút xoá doanh nghiệp** — xoá cơ sở dữ liệu là việc làm tay trên máy chủ cơ sở dữ liệu.
1. Chuỗi kết nối của từng doanh nghiệp được mã hoá bằng PLATFORM_SECRET; đổi khoá này là mất khả năng đọc các chuỗi đã lưu.
1. Mật khẩu chủ nền tảng từ 12 ký tự, không lưu trong cơ sở dữ liệu nào; mất điện thoại thì đặt PLATFORM_TOTP_RESET=true một lần để đăng ký lại.
1. Nhật ký nền tảng chỉ ghi thêm, không sửa xoá được.
1. Sao lưu hằng ngày gồm cơ sở dữ liệu nền tảng và từng doanh nghiệp đang hoạt động hoặc tạm ngưng; một cơ sở dữ liệu lỗi không chặn các cái khác.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, name | Chuỗi | Mã doanh nghiệp (người dùng nhập khi đăng nhập), tên. |
| databaseName, connection | Chuỗi, chuỗi mã hoá | Cơ sở dữ liệu của doanh nghiệp. |
| status | enum | Đang hoạt động / Tạm ngưng / Tạo lỗi. |
| adminEmail, createdAt, lastError | Khác | Quản trị, thời điểm tạo, lỗi cập nhật cấu trúc gần nhất. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đăng nhập (ATL-01) | Ô Mã doanh nghiệp, ?dn=, thông báo doanh nghiệp tạm ngưng. |
| Người dùng (ATL-22) | Tài khoản quản trị CEO của doanh nghiệp; cấp lại mật khẩu. |
| Nhật ký hoạt động (ATL-27) | Ghi thao tác của chủ nền tảng trên doanh nghiệp. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Máy chủ chưa bật nhiều doanh nghiệp | Trang "Chưa bật chế độ nhiều doanh nghiệp" kèm hướng dẫn biến môi trường. |
| Chưa đặt tài khoản chủ nền tảng | "Chưa có tài khoản chủ nền tảng" — đặt PLATFORM_OWNER_PASSWORD (từ 12 ký tự) rồi khởi động lại. |
| Tạo doanh nghiệp lỗi giữa chừng | Doanh nghiệp ở trạng thái tạo lỗi kèm lỗi; bấm Chạy lại sau khi sửa. |
| Sai mã 6 số hoặc mã đã dùng | Từ chối đăng nhập; ghi nhật ký nền tảng. |

# 8. Ghi chú & giới hạn hiện tại

- Chi tiết triển khai và biến môi trường: README, mục "Nhiều doanh nghiệp".
