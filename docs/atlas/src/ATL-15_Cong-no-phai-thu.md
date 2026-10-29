---
title: Công nợ phải thu
Mã tài liệu: ATL-15
Phân hệ: Bán hàng
Đường dẫn: /cong-no/khach-hang
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Theo dõi số tiền khách còn nợ, hạn thanh toán, khoản quá hạn, tiền khách trả trước, sổ chi tiết từng khách; lập phiếu thu, in biên bản đối chiếu và thông báo công nợ có mã VietQR.

## Đối tượng sử dụng

- Kế toán: theo dõi, lập phiếu thu.
- Sale / Quản lý: xem công nợ khách của mình.

## Quyền liên quan

debt.view; voucher.create_receipt để lập phiếu thu; debt.settle để đối trừ chọn tay; debt.remind để ghi nhắc nợ (ATL-31).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Giao hàng (công nợ phát sinh) → Theo dõi số dư & hạn → Lập phiếu thu → Đối trừ
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Hệ thống | Khách nhận hàng (giao tại kho hoặc chốt giao ở chuyến). | Mỗi đợt nhận là một khoản phát sinh = giá trị khách thực nhận của đợt; hạn = ngày nhận + số ngày được nợ của khách. Phiếu trả hàng ghi phát sinh giảm vào ngày trả. |
| 2 | Kế toán | Mở màn công nợ, xem danh sách khách hàng theo số dư. | Cột: Mã KH, Tên khách hàng, Loại, Điện thoại, Được nợ, Số khoản, Hạn gần nhất, Trả trước, Quá hạn, Số dư. Có dải "Cơ cấu nợ theo tuổi nợ", nút "Chỉ quá hạn", "Chỉ đối tác còn nợ" (mặc định bật), sắp xếp (Số dư lớn nhất, Quá hạn nhiều nhất, Hạn gần nhất, Tên A → Z). |
| 3 | Kế toán | Mở sổ chi tiết của một đối tác. | Tóm tắt: Số dư, Hạn gần nhất, Khoản còn mở, Trong đó quá hạn, Trả trước chưa dùng; bảng sổ liên kết về đơn hàng (/don-hang/:id); có bộ lọc kỳ và in Biên bản đối chiếu. |
| 4 | Kế toán | Lập phiếu thu cho khách (nút ở đầu trang hoặc ở từng dòng). | Mở form Phiếu thu (/thu-chi/lap/thu); lưu xong quay lại màn công nợ kèm thông báo. |
| 5 | Kế toán | Trong sổ chi tiết bấm "Thông báo công nợ", chọn tài khoản nhận tiền (QR). | In thông báo gửi khách: các chứng từ còn nợ, hạn, quá hạn, số cần thanh toán, bằng chữ và mã VietQR (số tiền + nội dung "KH… TT CONG NO"). |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách công nợ | Tìm khách hàng; xuất Excel; dải tuổi nợ; dòng tổng. |
| Sổ chi tiết | Cùng route với ?partnerId=, dùng chung màn với phải trả. Có tóm tắt, bộ lọc kỳ, nút "Chỉ chứng từ còn mở", in "Biên bản đối chiếu công nợ" và "Thông báo công nợ"; nút Nhắc nợ mở hộp nhắc nợ (ATL-31). |

# 4. Quy tắc nghiệp vụ

1. **Phải thu theo giá trị khách THỰC NHẬN**, không theo số đặt; **mỗi đợt khách nhận một khoản** (DH0000012, DH0000012·2…), hạn = ngày nhận của đợt + số ngày được nợ của khách. Đơn giao trước khi có bảng đợt vẫn là một khoản như cũ.
1. **Trả hàng bán** (TH…) là phát sinh giảm của đơn vào ngày trả.
1. **Số dư tính trên toàn bộ lịch sử**, không phụ thuộc khoảng ngày.
1. Phiếu thu: phần Chọn tay trừ đúng chứng từ (chọn theo mã đơn thì trả các đợt của đơn, đợt đến hạn sớm trước); phần còn lại và mọi phiếu Tự động trừ khoản đến hạn sớm nhất (FIFO). Phiếu "Thu tiền ngay" trừ thẳng vào đợt của nó.
1. Tiền thu dư không gán được là **Trả trước** (số dư âm, hiện màu).
1. Phiếu hoàn tiền cho khách (chiều ngược lại) tính như một khoản nợ.
1. Phiếu đã huỷ không tính; công nợ tự mở lại.
1. Đối tác tất toán (số dư 0) không hiện.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| DebtRow / DebtEntry | Như công nợ phải trả | partnerId, balance, overdue, prepaid, aging, entries; entry gồm ref, date, dueDate, amount, loại. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12), Chuyến giao hàng (ATL-13) | Nguồn phát sinh công nợ. |
| Phiếu thu chi (ATL-16) | Phiếu thu đối trừ. |
| Tuổi nợ (ATL-19) | Phân loại độ trễ. |
| Nhắc nợ (ATL-31) | Danh sách khách cần nhắc, tin soạn sẵn, lịch sử nhắc. |
| Tài khoản tiền (ATL-17) | Mã ngân hàng (BIN) của tài khoản dùng để tạo mã VietQR. |
| Khách hàng (ATL-11) | Số ngày được nợ. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Khách không còn nợ | Không hiện trong danh sách. |

# 8. Bản in

- Phiếu in: **Biên bản đối chiếu công nợ**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Từ sổ chi tiết của một khách hàng: Bên A / Bên B, kỳ đối chiếu, bảng phát sinh, số dư đầu / cuối kỳ; ký đại diện hai bên (đóng dấu).
- **Thông báo công nợ:** "Kính gửi" khách, bảng chứng từ còn nợ (ngày, chứng từ, hạn, quá hạn, còn nợ), tiền trả trước chưa trừ, số tiền cần thanh toán và bằng chữ, mã VietQR của tài khoản nhận tiền. Chưa có tài khoản ngân hàng khai mã BIN thì nhắc "Khai ở Tài khoản tiền".

# 9. Ghi chú & giới hạn hiện tại

- Tổng phải thu khớp tổng giá trị thực nhận trừ tổng phiếu thu đã đối trừ.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
