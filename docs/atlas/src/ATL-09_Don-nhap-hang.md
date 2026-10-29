---
title: Đơn nhập hàng
Mã tài liệu: ATL-09
Phân hệ: Mua hàng
Đường dẫn: /mua-hang, /mua-hang/them, /mua-hang/:id, /mua-hang/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Lập và theo dõi đơn mua vật tư từ nhà cung cấp. Đơn không đụng tới tồn kho hay công nợ cho tới khi **Nhận hàng**; mỗi lần nhận hàng hệ thống sinh phiếu nhập kho và ghi một khoản công nợ phải trả. Hàng nhận sai hoặc lỗi thì **Trả lại hàng mua** (TLM…): xuất kho theo giá mua và giảm công nợ phải trả.

## Đối tượng sử dụng

- Thu mua: lập, gửi NCC, hoàn tất, huỷ.
- Thủ kho: nhận hàng.
- Kế toán / Quản lý: trả lại hàng mua, xem công nợ.

## Quyền liên quan

purchase.view / create / update / approve (gửi NCC) / receive (nhận hàng) / cancel / return (trả lại hàng mua: CEO, Quản lý, Kế toán). Giá nhập chỉ hiện với chức vụ mua hàng, duyệt, định giá hoặc xem công nợ — Thủ kho, Sale, giao hàng, xưởng thấy số lượng nhưng không thấy giá.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Nháp → Đã gửi NCC → Nhận một phần / Đã nhận đủ → Hoàn tất
[next]
[flow] Trả lại hàng mua (nếu cần)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thu mua | Lập đơn: chọn NCC, thêm dòng (hàng, ĐVT, số lượng, đơn giá, thuế 0/5/8/10%); hoặc mở từ "Gợi ý đơn nhập" ở Tồn kho (dòng điền sẵn). | Trạng thái Nháp; còn sửa được. Thành tiền chưa gồm thuế; tổng thanh toán gồm thuế. Tỷ lệ quy đổi lấy từ ĐVT của mặt hàng. |
| 2 | Thu mua | Gửi NCC. | Chuyển Đã gửi NCC; không sửa nội dung nữa; hàng tính vào cột "Sắp về" ở Tồn kho. |
| 3 | Thủ kho | Nhận hàng: chọn ngày nhận (mặc định hôm nay), nhập số thực nhận từng dòng và kho nhập. | Một phiếu nhập kho cho mỗi kho, theo giá mua; tồn + theo ĐVT chính; giá vốn bình quân cập nhật; một khoản công nợ phải trả cho lần nhận này = giá trị nhận (gồm thuế), hạn = ngày nhận + số ngày được nợ. |
| 4 | Thủ kho | Nhận tiếp phần còn lại (nếu nhận một phần). | Trạng thái tự tính lại: Nhận một phần → Đã nhận đủ. |
| 5 | Thu mua | Hoàn tất đơn. | Đóng đơn (cũng chốt ngắn được khi nhận một phần). |
| 6 | Thu mua | Huỷ đơn (khi Nháp hoặc Đã gửi NCC và chưa nhận hàng). | Đơn Đã huỷ. |
| 7 | Kế toán | Trả lại hàng mua: chọn ngày trả, lý do, kho, số trả từng dòng (≤ số đã nhận chưa trả; nút "Trả tất cả còn lại"). | Phiếu TLM… và phiếu xuất kho theo giá mua; công nợ phải trả giảm giá trị trả (gồm thuế) vào ngày trả. Số đã nhận trên đơn giữ nguyên. Tiền NCC hoàn lại thì lập phiếu thu. |
| 8 | Kế toán | Huỷ phiếu trả lại (nếu lập nhầm). | Đảo phiếu xuất kho; công nợ mở lại; phiếu trả giữ lại, đánh dấu huỷ. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo mã đơn, NCC hoặc hàng trong đơn; lọc Trạng thái, Nhà cung cấp, Người lập, Giá trị đơn, Kỳ; xuất Excel. Cột: Mã đơn, Ngày đặt, NCC, Mặt hàng, Giá trị đơn, Đã nhận (giá trị · %), Người lập, Trạng thái. |
| Danh sách (bổ sung) | Phân trang trên máy chủ: lúc đăng nhập nạp 90 ngày gần nhất (đơn còn mở nạp bất kể ngày); số đơn theo trạng thái tính trên máy chủ; xuất Excel lấy mọi đơn khớp lọc. |
| Phiếu đơn nhập (màn hình chứng từ) | Đầu phiếu (NCC kèm mã số thuế, điện thoại, địa chỉ; Ngày đặt hàng; Người lập; Diễn giải), các tab Hàng hoá · Phiếu nhập kho · Hàng trả (khi có) · Nhật ký, tổng kết, thanh nút theo trạng thái: Sửa, Gửi NCC, Nhận hàng, Trả lại hàng mua, Hoàn tất, Huỷ đơn, In (A4 / A5). |
| Hộp thoại Nhận hàng | Ngày nhận; mỗi dòng: Đặt · Đã nhận · Còn lại · Nhận lần này · Kho nhập; nút "Nhận đủ tất cả", "Xoá số nhận"; ghi chú đợt nhận (ví dụ "Đợt 1, xe biển …"); "Xác nhận nhận hàng". |
| Hộp thoại Trả lại hàng mua | Ngày trả, lý do trả (bắt buộc), kho; mỗi dòng: Đã nhận · Đã trả · Còn trả được · Trả lần này; giá trị trả và mức giảm công nợ; nút "Trả tất cả còn lại". |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Nháp | Đơn mới. | Sửa; Gửi NCC; Huỷ |
| Đã gửi NCC | Đã gửi nhà cung cấp. | Nhận hàng; Huỷ (nếu chưa nhận) |
| Nhận một phần | Đã nhận một phần số lượng. | Nhận tiếp; Hoàn tất (chốt ngắn) |
| Đã nhận đủ | Nhận đủ mọi dòng. | Hoàn tất |
| Hoàn tất | Đơn đóng. | — |
| Đã huỷ | Đơn bị huỷ trước khi nhận hàng. | — |

# 5. Quy tắc nghiệp vụ

1. **Đơn không đụng tới kho và công nợ**; chỉ Nhận hàng mới tạo phiếu nhập kho và công nợ phải trả.
1. Chỉ đơn **Nháp** sửa được; chỉ Nháp mới Gửi NCC.
1. Nhận hàng được khi **Đã gửi NCC** hoặc **Nhận một phần**.
1. Hoàn tất được khi **Đã nhận đủ** hoặc **Nhận một phần** (chốt ngắn).
1. **Huỷ** chỉ khi Nháp hoặc Đã gửi NCC **và** giá trị đã nhận = 0 (hàng vào rồi thì không huỷ).
1. Số tiền dòng chưa gồm thuế; thuế dòng = thành tiền × thuế suất; **tổng thanh toán và giá trị đã nhận gồm thuế**.
1. Số lượng nhập theo ĐVT quy đổi được quy về ĐVT chính khi ghi tồn bằng tỷ lệ quy đổi của dòng.
1. **Công nợ theo từng lần nhận:** mỗi lần nhận hàng là một khoản (DN0000009, DN0000009·2…), hạn = ngày nhận của lần đó + số ngày được nợ của NCC; công nợ phải trả tính theo hàng ĐÃ NHẬN.
1. **Nhận hàng:** chỉ nhận tối đa số còn phải nhận của dòng (vượt thì báo lỗi, không tự cắt); ngày nhận không sau hôm nay, không trước ngày đặt đơn, không thuộc kỳ khoá sổ; ngày nhận của đơn là lần nhận muộn nhất.
1. **Trả lại hàng mua:** tối đa số đã nhận chưa trả; phiếu xuất theo **giá mua** (không theo bình quân) — giá vốn bình quân tính lại như thể hàng đó chưa từng nhập; giá trị trả = số lượng × đơn giá × (1 + thuế) giảm công nợ phải trả vào ngày trả; giá trị trả ẩn với chức vụ không xem giá nhập.
1. Sửa đơn gửi kèm thời điểm đã tải; người khác vừa lưu trước thì báo "vừa được người khác lưu" để tải lại.
1. Trạng thái sau mỗi lần nhận tự suy ra từ số đã nhận so với số đặt (Nhận một phần / Đã nhận đủ).
1. Báo cáo Nhập hàng tính trên phiếu nhập kho có NCC, đúng thời điểm hàng về, không tính lúc đặt đơn.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | DN + 7 số | Mã đơn. |
| supplierId, orderDate | Mã, ngày | NCC và ngày đặt. |
| lines[] | Danh sách | productId, unit/unitName, ratioToBase, quantity, unitPrice, vatRate, receivedQuantity. |
| totalValue, receivedValue | Số (₫) | Tổng thanh toán và giá trị đã nhận (= công nợ phải trả), đều gồm thuế. |
| status | enum | NHAP, DA_GUI_NCC, NHAN_MOT_PHAN, DA_NHAN_DU, HOAN_TAT, HUY. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Lập / gửi đơn | Không đổi tồn và công nợ; hàng hiện ở cột "Sắp về". |
| Nhận hàng | Tồn kho +; công nợ phải trả + (giá trị hàng nhận, gồm thuế); phiếu nhập kho theo từng kho. |
| Huỷ đơn | Không tác động (chỉ khi chưa nhận hàng). |
| Trả lại hàng mua | Tồn kho − (theo giá mua); công nợ phải trả − giá trị trả (gồm thuế). |
| Huỷ phiếu trả lại | Đảo lại tồn kho và công nợ. |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Nhà cung cấp (ATL-08) | Chọn NCC, lấy giá từ danh mục NCC. |
| Phiếu kho (ATL-06) | Phiếu nhập sinh khi nhận hàng. |
| Công nợ phải trả (ATL-10) | Khoản phát sinh liên kết về đơn. |
| Tồn kho (ATL-05) | Cột Sắp về. |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Nhận quá số còn phải nhận | Máy chủ từ chối, báo số còn lại của dòng. |
| Ngày nhận sau hôm nay / trước ngày đặt / trong kỳ khoá sổ | Từ chối, báo mốc ngày được phép. |
| Trả lại khi đơn chưa nhận gì hoặc đã trả hết | Hộp thoại báo "Đơn chưa nhận hàng nào, hoặc đã trả hết." |
| Huỷ đơn đã nhận hàng | Không cho huỷ. |

# 10. Bản in

- Phiếu in: **Đơn nhập hàng** (khổ A4 hoặc A5), dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Khối thông tin: nhà cung cấp (kèm mã), mã số thuế, điện thoại, địa chỉ, trạng thái, ghi chú; bảng: STT, mã hàng, tên hàng, ĐVT, số lượng, đơn giá, thành tiền, thuế, tiền thuế; tổng tiền hàng, thuế GTGT, tổng thanh toán và "Bằng chữ"; ký: Người lập đơn, Thủ kho, Nhà cung cấp, Giám đốc.

# 11. Ghi chú & giới hạn hiện tại

- Chưa có luồng thanh toán trên đơn: tiền trả NCC đi qua Phiếu chi và đối trừ công nợ.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
