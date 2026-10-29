---
title: Báo giá
Mã tài liệu: ATL-28
Phân hệ: Bán hàng
Đường dẫn: /bao-gia, /bao-gia/them-moi, /bao-gia/:id, /bao-gia/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Gửi khách bảng báo giá có cùng dòng hàng, đơn giá theo bảng giá của khách, khuyến mãi, chiết khấu và thuế như đơn bán — nhưng **không trừ kho, không ghi công nợ, không xét hạn mức**. Khách đồng ý thì bấm "Lập đơn hàng": đơn bán mới được điền sẵn và giữ nguyên đơn giá đã báo.

## Đối tượng sử dụng

- Sale: lập, sửa, gửi báo giá, lập đơn từ báo giá.
- Quản lý: xem, duyệt giá.
- Kế toán: chỉ xem.

## Quyền liên quan

quote.view / create / update / cancel (CEO, Quản lý, Sale; Kế toán chỉ xem). Người bán không có order.view_all chỉ thấy báo giá mình lập hoặc đứng tên. Lập đơn từ báo giá cần order.create.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Lập báo giá → In / gửi khách → Khách đồng ý → Lập đơn hàng (giữ giá báo)
[next]
[flow] Báo giá chuyển "Đã lập đơn"
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Sale | Lập báo giá: chọn khách, người nhận, điện thoại, địa chỉ giao, ngày báo giá, hiệu lực đến, người báo giá, diễn giải. | Hiện "Loại khách · bảng giá" của khách. |
| 2 | Sale | Thêm dòng hàng: hàng, ĐVT, số lượng, đơn giá, % chiết khấu, thuế GTGT, kích thước thành phẩm; chiết khấu cả báo giá. | Đơn giá tự áp theo bảng giá / loại khách (sửa tay được nếu có quyền); khuyến mãi tự điền chiết khấu và dòng tặng như đơn bán. |
| 3 | Sale | Lưu. | Cấp số BG…; trạng thái Mới ("Đang chờ khách"). |
| 4 | Sale | In báo giá gửi khách. | Bản in có "Kính gửi", hiệu lực đến, bảng hàng, tổng và bằng chữ. |
| 5 | Sale | Khách đồng ý: bấm "Lập đơn hàng". | Mở /don-hang/them-moi?quoteId=… điền sẵn khách, dòng hàng, giá, chiết khấu; lưu đơn thì báo giá chuyển "Đã lập đơn" và nối với đơn. |
| 6 | Sale | Khách không mua: Huỷ báo giá. | Báo giá Huỷ; không lập đơn từ báo giá này được nữa (không hoàn tác). |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo mã, khách, mặt hàng; lọc trạng thái, người báo giá, kỳ; thẻ tổng gồm số đang chờ khách và **Tỷ lệ chốt** = đã lập đơn ÷ (đã lập đơn + huỷ + hết hạn); xuất Excel. |
| Màn hình chứng từ | Đầu phiếu (khách, người nhận, điện thoại, địa chỉ giao, số chứng từ, ngày, hiệu lực đến, người báo giá, "Loại khách · bảng giá", diễn giải), lưới hàng (nhãn KM, dòng "Tặng"), chiết khấu cả báo giá, tổng kết; dòng Tham chiếu tới đơn đã lập; tab Nhật ký; nút Sửa, In (A4 / A5 / K80), Lập đơn hàng, Huỷ báo giá. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Mới (Đang chờ khách) | Đã gửi, chờ khách trả lời. | Sửa; Lập đơn hàng; Huỷ |
| Hết hạn | Suy ra khi đã qua ngày hiệu lực mà chưa lập đơn (không lưu). | Vẫn lập đơn / huỷ được |
| Đã lập đơn | Đã thành đơn bán. | — (mở đơn qua Tham chiếu) |
| Huỷ | Khách không mua. | — |

# 5. Quy tắc nghiệp vụ

1. Báo giá **không trừ kho, không ghi công nợ, không xét hạn mức công nợ**.
1. Đơn giá, chiết khấu, thuế, khuyến mãi, giá tối thiểu tính cùng quy tắc với đơn bán (ATL-12); số lượng gõ theo đúng ĐVT của dòng.
1. **Lập đơn từ báo giá:** đơn phải cùng khách; giữ đơn giá báo kể cả khi bảng giá đổi sau và kể cả với người không có quyền sửa đơn giá; giữ mức chiết khấu của báo giá. Máy chủ khoá báo giá khi lập đơn để một báo giá chỉ thành một đơn.
1. Hiệu lực đến không được trước ngày báo giá.
1. Không xoá báo giá — chỉ huỷ.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | BG + 7 số | Số báo giá. |
| customerId, recipientName, recipientPhone, deliveryAddress | Khác | Khách và người nhận. |
| quoteDate, validUntil, salesRep | Ngày, ngày, người | Ngày báo giá, hiệu lực đến, người báo giá. |
| lines[] | Danh sách | Như dòng đơn bán (hàng, ĐVT, số lượng, đơn giá, chiết khấu, tặng, thuế, kích thước). |
| discountAmount, promotionId | Số, mã | Chiết khấu cả báo giá; khuyến mãi theo đơn. |
| status, orderId | enum, mã | MOI / DA_CHOT (đã lập đơn) / HUY; đơn đã lập. |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Lập đơn từ báo giá; đơn hiện "Báo giá" ở Tham chiếu. |
| Khách hàng (ATL-11) | Loại khách, bảng giá. |
| Bảng giá (ATL-29), Khuyến mãi (ATL-30) | Nguồn đơn giá và chiết khấu. |
| Phiếu in (ATL-26) | Bản in báo giá. |
| Màu hiển thị (ATL-24) | Nhóm màu "Trạng thái báo giá". |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Hiệu lực đến trước ngày báo giá | "Ngày hiệu lực trước ngày báo giá." |
| Lập đơn cho khách khác khách của báo giá | Máy chủ từ chối. |
| Báo giá đã lập đơn / đã huỷ | Không còn nút Lập đơn hàng. |
| Mở báo giá không thuộc quyền xem | "Không tìm thấy báo giá" — báo giá có thể không thuộc quyền xem của bạn hoặc đường dẫn không đúng. |

# 9. Bản in

- Phiếu in **Báo giá** (A4 / A5 / K80) theo khuôn in chung (ATL-26): "Kính gửi" khách, người nhận, địa chỉ, hiệu lực đến; bảng: STT, mã hàng, tên hàng, ĐVT, số lượng, đơn giá, chiết khấu, thuế, thành tiền; tổng tiền hàng, chiết khấu, thuế GTGT, tổng thanh toán, "Bằng chữ"; ký Người báo giá.

# 10. Ghi chú & giới hạn hiện tại

- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
