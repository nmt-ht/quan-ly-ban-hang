---
title: Khuyến mãi
Mã tài liệu: ATL-30
Phân hệ: Bán hàng
Đường dẫn: /khuyen-mai
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Khai báo chương trình khuyến mãi — giảm giá mặt hàng, giảm theo tổng đơn, giảm theo bậc số lượng, mua hàng tặng hàng — để đơn hàng bán và báo giá **tự áp** theo ngày chứng từ. Khuyến mãi cũng là "trần" chiết khấu cho người không có quyền chiết khấu ngoài khuyến mãi.

## Đối tượng sử dụng

- CEO / Quản lý: lập, sửa, dừng chương trình.
- Sale: thấy khuyến mãi tự áp trên đơn / báo giá.

## Quyền liên quan

Đọc: mọi người đã đăng nhập. Lập / sửa / dừng: promotion.manage (mặc định CEO, Quản lý). order.discount quyết định ai được chiết khấu vượt mức khuyến mãi.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm khuyến mãi → Chọn kiểu & nội dung → Chọn phạm vi & thời gian → Đơn / báo giá tự áp
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Bấm "Thêm khuyến mãi": tên chương trình, kiểu, từ ngày, đến ngày (bỏ trống = chạy đến khi dừng), ghi chú. | Cấp mã KM…. |
| 2 | Quản lý | Khai nội dung theo kiểu (xem mục 4). | Danh sách hiện cột Nội dung tóm tắt. |
| 3 | Quản lý | Chọn "Áp cho": Mọi khách / Theo loại khách / Khách dùng bảng giá (chọn bảng). | Chỉ đơn của khách thuộc phạm vi được áp. |
| 4 | Sale | Lập đơn / báo giá trong thời gian chạy. | Form tự điền chiết khấu dòng, chiết khấu cả đơn và dòng hàng tặng (trừ chỗ đã gõ tay); nhãn KM trên dòng; công tắc "Áp khuyến mãi" để tắt. |
| 5 | Quản lý | Bấm "Dừng" / "Chạy lại". | Dừng thì chứng từ mới không áp; chứng từ đã lưu giữ nguyên. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Mã, Chương trình, Kiểu, Nội dung, Áp cho, Thời gian, Trạng thái, Thao tác (Sửa, Dừng / Chạy lại); nút "Hiện chương trình đã hết / đã dừng". |
| Form khuyến mãi | Tên, kiểu, cách giảm (theo % hoặc số tiền), mặt hàng / nhóm hàng áp dụng, ngưỡng đơn, bậc số lượng (Thêm bậc), mua mỗi … tặng …, hàng tặng; phạm vi; thời gian. |

# 4. Quy tắc nghiệp vụ

1. **Giảm hàng (GIAM_HANG):** giảm % hoặc số tiền trên mỗi ĐVT chính của mặt hàng / nhóm hàng đã chọn.
1. **Giảm đơn (GIAM_DON):** đơn có tiền hàng (sau chiết khấu dòng, chưa thuế) từ ngưỡng thì giảm % hoặc số tiền cả đơn.
1. **Bậc thang (BAC_THANG):** mua từ X (ĐVT chính) giảm mức của bậc đó; hai bậc không trùng số lượng.
1. **Tặng hàng (TANG_HANG):** mỗi đủ X (ĐVT chính) mặt hàng / nhóm hàng phải mua thì tặng Y mặt hàng tặng; dòng tặng có chiết khấu 100% (thành tiền 0) nhưng vẫn xuất kho khi giao.
1. Giảm theo % tối đa 100%; mức giảm phải > 0; ngày kết thúc không trước ngày bắt đầu; theo loại khách / bảng giá thì phải chọn ít nhất một.
1. Áp theo **ngày chứng từ** (ngày đặt đơn / ngày báo giá), không theo ngày lưu.
1. Máy chủ lưu khuyến mãi đã áp trên dòng / đơn / báo giá và tính lại bằng cùng quy tắc với form. Người không có quyền "Chiết khấu ngoài khuyến mãi" chỉ được chiết khấu trong mức khuyến mãi đang chạy, hoặc giữ mức của chứng từ đã có.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, name | KM + số, chuỗi | Mã và tên chương trình. |
| kind | enum | GIAM_HANG, GIAM_DON, BAC_THANG, TANG_HANG. |
| discountType, discountValue, tiers[] | enum, số, danh sách | PHAN_TRAM / số tiền; mức giảm; bậc số lượng [{ minQuantity, value }]. |
| productIds[], categoryIds[] | Danh sách | Mặt hàng / nhóm hàng áp dụng hoặc phải mua; cả hai trống = mọi mặt hàng. |
| minOrderValue, buyQuantity, giftProductId, giftQuantity | Số, mã | Ngưỡng đơn; mua mỗi; hàng tặng; số tặng. |
| scope, customerTypes[], priceListIds[] | enum, danh sách | TAT_CA / LOAI_KHACH / BANG_GIA. |
| startDate, endDate, isActive | Ngày, cờ | Thời gian chạy, đang chạy / đã dừng. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12), Báo giá (ATL-28) | Tự áp khuyến mãi; khoá ô chiết khấu với người không có quyền. |
| Bảng giá (ATL-29) | Phạm vi "Khách dùng bảng giá". |
| Nhóm hàng (ATL-33) | Áp theo nhóm hàng. |
| Báo cáo Chiết khấu đã cấp (ATL-03) | Đo tổng chiết khấu đã cho. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Thiếu mặt hàng / nhóm hàng phải mua (tặng hàng) | "Chọn mặt hàng hoặc nhóm hàng phải mua." |
| Giảm % > 100 hoặc mức giảm ≤ 0 | Báo lỗi, không lưu. |
| Hai bậc trùng số lượng | "Hai bậc trùng số lượng." |
| Ngày kết thúc trước ngày bắt đầu | "Ngày kết thúc trước ngày bắt đầu." |

# 8. Ghi chú & giới hạn hiện tại

- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
