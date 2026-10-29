---
title: Nhắc nợ & thông báo công nợ
Mã tài liệu: ATL-31
Phân hệ: Bán hàng
Đường dẫn: /cong-no/nhac-no
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Giúp thu tiền đúng hạn: danh sách khách còn nợ cần nhắc (quá hạn lâu nhất lên đầu), tin nhắn soạn sẵn kèm mã VietQR để gửi qua Zalo, SMS, email hoặc gọi điện, ghi lại mỗi lần nhắc và lời hẹn trả của khách.

## Đối tượng sử dụng

- Kế toán: nhắc nợ hằng ngày.
- Quản lý: theo dõi lần nhắc, khách lỡ hẹn.
- Sale: xem lịch sử nhắc của khách mình.

## Quyền liên quan

debt.view (xem); debt.remind (ghi nhận lần nhắc: CEO, Quản lý, Kế toán).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở Nhắc nợ → Chọn khách cần nhắc → Gửi tin soạn sẵn (Zalo / SMS / email / gọi) → Ghi nhận đã nhắc + hẹn trả
[next]
[flow] Theo dõi lỡ hẹn → Lập phiếu thu khi khách trả
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Mở Nhắc nợ; lọc Quá hạn / Đến hạn trong 7 ngày / Tất cả còn nợ. | Danh sách khách: còn nợ, quá hạn, quá hạn lâu nhất, hạn gần nhất, lần nhắc gần nhất, hẹn trả. |
| 2 | Kế toán | Bấm "Nhắc nợ" ở một khách. | Hộp nhắc nợ: tin nhắn soạn sẵn (sửa được trước khi gửi) có số nợ, chứng từ quá hạn, tài khoản nhận tiền và mã VietQR (số tiền + nội dung chuyển khoản). |
| 3 | Kế toán | Chọn kênh: Sao chép, Mở Zalo, Gọi, SMS, Gửi email. | Mở ứng dụng tương ứng với số điện thoại / email của khách; Zalo: dán tin (Ctrl V) vào cuộc trò chuyện, chụp mã QR gửi kèm nếu cần. |
| 4 | Kế toán | Bấm "Ghi nhận đã nhắc": kênh, ghi chú, ngày khách hẹn trả và số tiền hẹn trả (tuỳ chọn). | Lưu một lần nhắc với số nợ tại lúc nhắc; hiện ở "Các lần nhắc gần đây". |
| 5 | Kế toán | Theo dõi khách "Lỡ hẹn trả" (đã qua ngày hẹn mà còn nợ). | Nhắc lại hoặc lập phiếu thu khi khách trả. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách Nhắc nợ | Mô tả "Khách còn nợ cần nhắc — quá hạn lâu nhất lên đầu"; bộ lọc Quá hạn / Đến hạn trong 7 ngày / Tất cả còn nợ; cột Khách hàng, Điện thoại, Còn nợ, Quá hạn, Lâu nhất, Lần nhắc gần nhất (hoặc "Chưa nhắc"), Hẹn trả / Lỡ hẹn trả; nút Nhắc nợ. |
| Hộp nhắc nợ | Tóm tắt nợ; Tài khoản nhận tiền (QR); mã VietQR; Tin nhắn; các nút kênh; khối ghi nhận (Kênh, Ghi chú, Khách hẹn trả ngày, Số tiền hẹn trả); Các lần nhắc gần đây. |
| Thông báo công nợ (bản in) | Từ sổ chi tiết công nợ phải thu (ATL-15): chứng từ còn nợ, số cần thanh toán, bằng chữ và mã VietQR. |

# 4. Quy tắc nghiệp vụ

1. Danh sách gồm khách đang còn nợ: quá hạn, hoặc đến hạn trong 7 ngày tới (theo bộ lọc); quá hạn lâu nhất xếp trên.
1. Số nợ lúc nhắc lấy từ công nợ phải thu của máy chủ (cùng cách tính với ATL-15) và lưu lại cùng lần nhắc.
1. Ngày hẹn trả không được là ngày đã qua.
1. **VietQR** tạo ngay trên trình duyệt theo chuẩn NAPAS từ mã BIN của tài khoản ngân hàng (ATL-17) + số tài khoản + số tiền + nội dung "KH… TT CONG NO"; không gọi dịch vụ ngoài. Chưa có tài khoản ngân hàng khai mã BIN thì nhắc "Khai ở Tài khoản tiền".
1. Kênh ghi nhận: Zalo, SMS, Gọi điện, Email, Gặp trực tiếp, Khác. Khách chưa có điện thoại / email thì chỉ ghi nhận được (gọi hoặc gặp trực tiếp rồi ghi).
1. Lần nhắc chỉ thêm, không sửa / xoá.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| customerId | Mã | Khách được nhắc. |
| channel | enum | ZALO, SMS, GOI_DIEN, EMAIL, GAP_TRUC_TIEP, KHAC. |
| balance, overdue | Số (₫) | Số còn nợ và phần quá hạn tại lúc nhắc. |
| note, promisedDate, promisedAmount | Chuỗi, ngày, số | Ghi chú, ngày và số tiền khách hẹn trả. |
| createdBy, createdAt | Người, thời điểm | Người nhắc. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Công nợ phải thu (ATL-15), Tuổi nợ (ATL-19) | Nguồn số nợ, quá hạn; nút Nhắc nợ trong sổ chi tiết. |
| Tài khoản tiền (ATL-17) | Tài khoản nhận tiền và mã BIN cho VietQR. |
| Phiếu thu chi (ATL-16) | Lập phiếu thu khi khách trả. |
| Khách hàng (ATL-11) | Điện thoại, email để gửi tin. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Ngày hẹn trả đã qua | "Ngày hẹn trả đã qua." |
| Khách không có điện thoại / email | "Khách chưa có điện thoại / email — gọi hoặc gặp trực tiếp rồi ghi nhận." |
| Chưa khai mã ngân hàng | Không hiện QR; gợi ý khai ở Tài khoản tiền. |

# 8. Ghi chú & giới hạn hiện tại

- Chưa gửi tự động (SMS brandname, Zalo OA): cần chọn nhà cung cấp và tài khoản API. Hiện người dùng gửi tay bằng tin soạn sẵn.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
