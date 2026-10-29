---
title: Công nợ phải trả
Mã tài liệu: ATL-10
Phân hệ: Mua hàng
Đường dẫn: /cong-no/nha-cung-cap
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Theo dõi số tiền doanh nghiệp còn nợ từng nhà cung cấp, hạn thanh toán, khoản quá hạn, tiền trả trước và sổ chi tiết; từ đó lập phiếu chi.

## Đối tượng sử dụng

- Kế toán: theo dõi, lập phiếu chi.
- Quản lý: xem.

## Quyền liên quan

debt.view; lập phiếu chi cần voucher.create_payment; đối trừ chọn tay cần debt.settle.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Nhận hàng (công nợ phát sinh) → Theo dõi số dư & hạn → Lập phiếu chi → Đối trừ công nợ
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Hệ thống | Nhận hàng ở đơn nhập. | Mỗi lần nhận là một khoản phát sinh = giá trị hàng nhận lần đó (gồm thuế); hạn = ngày nhận + số ngày được nợ của NCC. Trả lại hàng mua ghi phát sinh giảm vào ngày trả. |
| 2 | Kế toán | Mở màn công nợ, xem danh sách nhà cung cấp theo số dư. | Cột: Mã NCC, Tên NCC, Được nợ, Số khoản, Hạn gần nhất, Trả trước, Quá hạn, Số dư. Có dải "Cơ cấu nợ theo tuổi nợ", nút "Chỉ quá hạn", "Chỉ đối tác còn nợ" (mặc định bật), sắp xếp (Số dư lớn nhất, Quá hạn nhiều nhất, Hạn gần nhất, Tên A → Z). |
| 3 | Kế toán | Mở sổ chi tiết của một đối tác. | Tóm tắt: Số dư, Hạn gần nhất, Khoản còn mở, Trong đó quá hạn, Trả trước chưa dùng; bảng sổ liên kết về đơn nhập (/mua-hang/:id); có bộ lọc kỳ và in Biên bản đối chiếu. |
| 4 | Kế toán | Lập phiếu chi cho NCC (nút ở đầu trang hoặc ở từng dòng). | Mở form Phiếu chi (/thu-chi/lap/chi); lưu xong quay lại màn công nợ kèm thông báo. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách công nợ | Tìm nhà cung cấp; xuất Excel; dải tuổi nợ; dòng tổng. |
| Sổ chi tiết | Cùng route với ?partnerId=. Cột: Ngày, Chứng từ, Loại, Diễn giải, Phát sinh tăng, Phát sinh giảm, Đã đối trừ, Còn lại, Hạn / tình trạng, Số dư. In "Biên bản đối chiếu công nợ". |

# 4. Quy tắc nghiệp vụ

1. **Phải trả theo hàng ĐÃ NHẬN** của đơn nhập, không phải số đặt; **mỗi lần nhận một khoản** (DN0000009, DN0000009·2…) có hạn riêng. Đơn nhận trước khi có bảng đợt vẫn là một khoản như cũ.
1. **Trả lại hàng mua** (TLM…) là phát sinh giảm của đơn vào ngày trả.
1. **Số dư tính trên toàn bộ lịch sử**, không phụ thuộc khoảng ngày — đây là số hai bên cần chốt.
1. **Đối trừ:** phần "Chọn tay" của từng phiếu trừ đúng chứng từ đã chọn trước (chọn theo mã đơn thì trả các lần nhận của đơn, lần đến hạn sớm trước); phần còn lại (và mọi phiếu "Tự động") trừ vào khoản đến hạn sớm nhất trước, tiền phiếu cũ dùng trước (FIFO).
1. Tiền chi dư không gán được là **Trả trước** (số dư âm).
1. Phiếu hoàn tiền từ đối tác (chiều ngược lại) tính như một khoản nợ — ăn vào số trả trước trước.
1. Phiếu thu chi đã huỷ không tính; công nợ tự mở lại.
1. Đối tác đã tất toán (số dư 0) không hiện.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| DebtRow | Đối tượng | partnerId, balance, overdue, prepaid, creditDays, nextDue, aging, items/entries. |
| DebtEntry | Dòng sổ | ref (mã chứng từ), date, dueDate, amount, loại PHAT_SINH / THANH_TOAN, liên kết chứng từ. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn nhập hàng (ATL-09) | Nguồn khoản phát sinh. |
| Phiếu thu chi (ATL-16) | Phiếu chi đối trừ công nợ. |
| Tuổi nợ (ATL-19) | Phân loại theo độ trễ. |
| Nhà cung cấp (ATL-08) | Số ngày được nợ. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| NCC không còn nợ | Không hiện trong danh sách. |

# 8. Bản in

- Phiếu in: **Biên bản đối chiếu công nợ**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Từ sổ chi tiết của một đối tác: Bên A / Bên B, kỳ đối chiếu, bảng phát sinh có số dư đầu kỳ, cộng phát sinh, số dư cuối kỳ; đoạn xác nhận số liệu; ký đại diện Bên A, Bên B (đóng dấu).

# 9. Ghi chú & giới hạn hiện tại

- Màu số: số dương (nợ) và âm (trả trước) theo quy ước màu tiền của hệ thống.
- Công nợ và số dư tính khi đọc (không lưu cột số dư), đọc lại mỗi khi đơn nhập, phiếu thu chi hoặc NCC thay đổi.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
