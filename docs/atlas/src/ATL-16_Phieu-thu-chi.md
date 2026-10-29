---
title: Phiếu thu chi
Mã tài liệu: ATL-16
Phân hệ: Dòng tiền
Đường dẫn: /thu-chi, /thu-chi/lap/(thu|chi), /thu-chi/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Sổ quỹ của doanh nghiệp: ghi tiền vào (phiếu thu) và tiền ra (phiếu chi) theo từng tài khoản tiền; phiếu gắn khách hàng hoặc nhà cung cấp sẽ đối trừ công nợ. Có in phiếu, huỷ phiếu và xem số dư từng tài khoản.

## Đối tượng sử dụng

- Kế toán: lập, in, huỷ phiếu.
- Quản lý: xem, theo dõi dòng tiền.

## Quyền liên quan

voucher.view; voucher.create_receipt (phiếu thu); voucher.create_payment (phiếu chi); voucher.cancel (huỷ); voucher.overdraw (chi / huỷ vượt tồn quỹ: CEO, Quản lý); debt.settle (đối trừ chọn tay).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Chọn Lập phiếu thu / chi → Chọn tài khoản & loại → Chọn đối tác & số tiền → Chọn cách đối trừ
[next]
[flow] Lưu → công nợ & quỹ cập nhật
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Bấm Lập phiếu thu hoặc Lập phiếu chi (từ danh sách, từ công nợ hoặc từ chi tiết khách / NCC). | Mở form /thu-chi/lap/thu hoặc /thu-chi/lap/chi; mang theo đối tác và đường quay lại (?back=) nếu có. |
| 2 | Kế toán | Chọn ngày (không sau hôm nay, không thuộc kỳ khoá sổ), loại thu chi, tài khoản nhận/chi tiền (mặc định tài khoản và loại mặc định), đối tác (ô chọn có tìm theo mã, tên, điện thoại). | Loại gắn đối tác (khách / NCC) thì hiện khối công nợ hiện tại của đối tác. |
| 3 | Kế toán | Nhập số tiền và diễn giải. | Hiện số tiền bằng chữ trên bản in. |
| 4 | Kế toán | Chọn cách đối trừ: Tự động (cũ nhất trước) hoặc Chọn tay (nhập số tiền trừ vào từng chứng từ). | Xem trước phần đối trừ tự động; phần dư là Trả trước; nếu đối tác không còn nợ, cả số tiền là trả trước. |
| 5 | Kế toán | Lưu phiếu. | Cấp số PT… / PC…; phiếu chi bị từ chối nếu tồn quỹ của tài khoản (tại ngày phiếu và hiện tại) không đủ, trừ người có quyền Chi vượt tồn quỹ; số dư tài khoản đổi; công nợ cập nhật; quay lại nơi gọi kèm thông báo. |
| 6 | Kế toán | In phiếu. | Bản in có số tiền bằng chữ và chữ ký. |
| 7 | Kế toán | Huỷ phiếu, nhập lý do. | Phiếu giữ lại (hiện khi bật "Hiện phiếu đã huỷ"); không tính vào số dư quỹ, báo cáo và đối trừ; công nợ tự mở lại. Huỷ phiếu thu làm tiền ra khỏi quỹ nên cũng kiểm tồn quỹ như phiếu chi. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Phân trang trên máy chủ (lúc đăng nhập nạp 90 ngày gần nhất; phiếu cũ đọc khi cần); thẻ tổng của kỳ tính trên máy chủ. Tìm không dấu số phiếu, đối tượng, diễn giải; lọc Thu hoặc chi, Hình thức (tiền mặt / chuyển khoản), Tài khoản, Loại thu chi, Người lập, Số tiền, Kỳ, "Hiện phiếu đã huỷ"; chip bộ lọc; tổng Tổng thu, Tổng chi, Thu − Chi trong kỳ, Tồn quỹ; xuất Excel; nút sang Tài khoản tiền và Loại thu chi. Cột: Số phiếu, Ngày, Loại, Đối tượng, Tài khoản, Số tiền, Đã đối trừ, Diễn giải, Người lập. |
| Số dư tài khoản | Khối số dư từng tài khoản tiền, kèm liên kết "Quản lý" sang Tài khoản tiền. |
| Form lập phiếu | Loại thu / chi, Người nộp / khách hàng (hoặc Người nhận / nhà cung cấp), Tài khoản nhận / chi tiền, Ngày phiếu, Số tiền, Diễn giải; khối công nợ đối tác; ô đối trừ Tự động / Chọn tay với xem trước; thanh nút cố định ở chân. |
| Màn hình xem / in | Chi tiết phiếu, đơn / đợt giao nguồn (phiếu Thu tiền ngay), bảng đã đối trừ vào chứng từ nào, nút In phiếu (A4 / A5 / K80), Huỷ, tab Nhật ký. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Hiệu lực | Tính vào quỹ và đối trừ công nợ. | In; Huỷ |
| Đã huỷ | Không tính; giữ để tra cứu, kèm lý do và thời điểm huỷ. | — |

# 5. Quy tắc nghiệp vụ

1. **Phiếu thu** (PT) tăng số dư tài khoản; **phiếu chi** (PC) giảm. Số dư tài khoản = số dư đầu kỳ + thu − chi của phiếu chưa huỷ.
1. **Đối tác:** loại "Thu tiền khách hàng" gắn khách hàng và giảm công nợ phải thu; loại "Chi trả nhà cung cấp" gắn NCC và giảm công nợ phải trả; "Thu khác / Chi khác" không gắn đối tác, chỉ ghi sổ quỹ.
1. **Đối trừ:** phần Chọn tay trừ đúng chứng từ đã chọn trước; phần còn lại trừ khoản đến hạn sớm nhất trước (tiền phiếu cũ dùng trước); dư là Trả trước.
1. Phiếu thu/chi theo **chiều ngược** (đối tác hoàn tiền) tính như một khoản nợ — ăn vào số trả trước trước.
1. Không xoá phiếu — chỉ huỷ; phiếu huỷ không vào báo cáo.
1. Tài khoản ngừng dùng không chọn được khi lập phiếu mới (phiếu cũ giữ nguyên).
1. Đổi tên loại thu chi thì phiếu cũ đổi theo để thống kê không bị tách đôi (phiếu lưu tên loại).
1. Màu số: thu / tăng xanh, chi / giảm đỏ; dấu trừ thật "−".
1. **Không chi vượt tồn quỹ:** phiếu chi, huỷ phiếu thu và bỏ chốt giao tự huỷ phiếu thu bị từ chối khi tồn quỹ của tài khoản (tại ngày phiếu và hiện tại) không đủ; quyền "Chi vượt tồn quỹ" cho qua và Nhật ký ghi lại.
1. **Ngày phiếu** không sau hôm nay (giờ Việt Nam); phiếu có ngày thuộc kỳ đã khoá sổ không lập và không huỷ được.
1. **Phiếu thu tự lập** ("Thu tiền ngay" của đơn bán) trỏ tới đơn và đợt giao; huỷ ở chứng từ gốc bằng bỏ chốt giao.
1. Hoàn tiền khách trả hàng (ATL-12) hoặc NCC hoàn tiền trả lại hàng mua (ATL-09) lập bằng phiếu chi / phiếu thu như thường.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | PT / PC + 7 số | Số phiếu. |
| kind, date | THU / CHI, ngày | Loại phiếu và ngày. |
| category | Chuỗi | Tên loại thu chi. |
| partnerType, partnerId | KHACH_HANG / NHA_CUNG_CAP / KHAC, mã | Đối tác. |
| accountId, amount | Mã, số (₫) | Tài khoản tiền và số tiền. |
| settledAmount, allocations[] | Số, danh sách | Phần đã đối trừ; phần Chọn tay theo mã chứng từ (DN… / DH…). |
| salesOrderId, salesOrderDeliveryId | Mã | Đơn và đợt giao của phiếu "Thu tiền ngay". |
| description, createdBy, createdAt | Khác | Diễn giải, người lập. |
| isCancelled, cancelReason, cancelledAt | Khác | Thông tin huỷ. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Lưu phiếu thu | Quỹ tài khoản +; công nợ phải thu − (hoặc trả trước). |
| Lưu phiếu chi | Quỹ tài khoản −; công nợ phải trả − (hoặc trả trước). |
| Huỷ phiếu | Đảo quỹ; công nợ tự mở lại. |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Công nợ phải thu / phải trả (ATL-15, ATL-10) | Nơi lập phiếu và nơi nhìn kết quả đối trừ. |
| Tài khoản tiền (ATL-17), Loại thu chi (ATL-18) | Danh mục dùng khi lập phiếu. |
| Khách hàng / Nhà cung cấp (ATL-11, ATL-08) | Lập phiếu từ chi tiết đối tác. |
| Tổng quan (ATL-02), Báo cáo (ATL-03) | Dòng tiền, sổ quỹ, thu chi. |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Số tiền ≤ 0 hoặc thiếu tài khoản / đối tác | Form báo lỗi, không lưu. |
| Chọn tay vượt số tiền hoặc vượt nợ của chứng từ | Báo lỗi tại ô đối trừ. |
| Đối tác không còn nợ | Toàn bộ số tiền ghi nhận là trả trước, có thông báo. |
| Chi vượt số dư tài khoản | Từ chối, báo tồn quỹ hiện có; người có quyền Chi vượt tồn quỹ được lưu và Nhật ký ghi lại. |
| Ngày phiếu sau hôm nay hoặc trong kỳ đã khoá sổ | Từ chối, báo lý do. |

# 10. Bản in

- Phiếu in: **Phiếu thu / Phiếu chi**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- In khổ A4, A5 hoặc giấy nhiệt K80. Dạng phiếu điền thông tin có dòng chấm: họ tên người nộp/nhận, đơn vị, địa chỉ, lý do, số tiền (kèm hình thức), viết bằng chữ; ký: Giám đốc (ký, đóng dấu), Kế toán trưởng, Người nộp / nhận tiền, Người lập phiếu, Thủ quỹ.
- Phiếu đã huỷ in dấu "ĐÃ HUỶ".

# 11. Ghi chú & giới hạn hiện tại

- Liên kết tới form có thể kèm ?supplierId= hoặc ?customerId= để chọn sẵn đối tác.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
