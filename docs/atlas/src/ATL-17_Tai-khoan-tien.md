---
title: Tài khoản tiền
Mã tài liệu: ATL-17
Phân hệ: Dòng tiền
Đường dẫn: /thu-chi/tai-khoan
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh mục nơi giữ tiền: quỹ tiền mặt và các tài khoản ngân hàng. Mỗi phiếu thu chi chọn một tài khoản; số dư tính tự động. Tài khoản ngân hàng khai mã BIN để in mã VietQR trên thông báo công nợ và tin nhắc nợ.

## Đối tượng sử dụng

- Kế toán / Quản lý.

## Quyền liên quan

voucher.view (xem); voucher.manage_account (thêm, sửa, đặt mặc định, ngừng dùng).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm tài khoản → Đặt số dư đầu kỳ → Đặt mặc định → Dùng khi lập phiếu
[next]
[flow] Ngừng dùng khi đóng
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Bấm "Thêm tài khoản": tên, mã (TM, TCB-9999…), tính chất Tiền mặt / Chuyển khoản; với ngân hàng: chọn ngân hàng cho mã VietQR (điền mã BIN 6 số), tên ngân hàng in trên chứng từ, số tài khoản, chủ tài khoản, chi nhánh. | Tài khoản xuất hiện ở form phiếu thu chi; có ô "Xem thử mã VietQR" để quét bằng app ngân hàng kiểm tra đúng tài khoản. |
| 2 | Kế toán | Nhập số dư đầu kỳ (số dư trước khi dùng phần mềm) và thứ tự hiển thị. | Số dư hiện tại = đầu kỳ + thu − chi. |
| 3 | Kế toán | Tick "Chọn sẵn khi lập phiếu". | Tài khoản đó thành mặc định (hiện nhãn "Mặc định"); chỉ một tài khoản mặc định. |
| 4 | Kế toán | Bấm "Ngừng dùng" khi đóng tài khoản (nút bút chì để sửa). | Không xoá; phiếu cũ giữ nguyên, tài khoản không chọn được cho phiếu mới. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách tài khoản | Thẻ/bảng: tên, loại, mã, đầu kỳ, số dư hiện tại, số phiếu (tính trên toàn bộ lịch sử), nhãn VietQR khi đã khai BIN, trạng thái, nút sửa / đặt mặc định / ngừng dùng; tổng số dư các tài khoản đang dùng. |
| Hộp thoại thêm/sửa | Các trường tài khoản. |

# 4. Quy tắc nghiệp vụ

1. Số dư = số dư đầu kỳ + thu − chi của phiếu **chưa huỷ**.
1. Chỉ một tài khoản mặc định.
1. Ngừng dùng thay vì xoá.
1. Phiếu đã huỷ không ảnh hưởng số dư.
1. Số dư không lưu sẵn mà tính khi đọc; phiếu chi không được làm số dư âm (ATL-16).
1. **VietQR** tạo ngay trên trình duyệt theo chuẩn NAPAS (không gọi dịch vụ ngoài) từ mã BIN + số tài khoản + số tiền + nội dung chuyển khoản.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name, code, type | Chuỗi, enum | TIEN_MAT hoặc NGAN_HANG. |
| bankName, accountNumber, accountHolder, branch | Chuỗi | Thông tin ngân hàng. |
| bankBin | 6 chữ số | Mã BIN NAPAS của ngân hàng, dùng tạo mã VietQR. |
| openingBalance, balance | Số (₫) | Đầu kỳ; hiện tại (suy ra). |
| sortOrder, note, isDefault, isActive | Khác | Thứ tự, ghi chú, mặc định, còn dùng. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Phiếu thu chi (ATL-16) | Chọn tài khoản khi lập phiếu; số dư cập nhật theo phiếu. |
| Công nợ phải thu (ATL-15), Nhắc nợ (ATL-31) | Mã VietQR trên thông báo công nợ và tin nhắc nợ. |
| Đơn hàng bán (ATL-12) | Tài khoản nhận tiền của "Thu tiền ngay". |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Ngừng dùng tài khoản mặc định | Phải đặt tài khoản khác làm mặc định. |

# 8. Ghi chú & giới hạn hiện tại

- Báo cáo Sổ quỹ gộp tồn quỹ đầu/cuối kỳ của mọi tài khoản; xem số dư từng tài khoản ở màn hình này.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
