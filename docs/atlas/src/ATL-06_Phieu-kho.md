---
title: Phiếu kho
Mã tài liệu: ATL-06
Phân hệ: Nghiệp vụ
Đường dẫn: /kho/phieu, /kho/phieu/lap/(in|out|transfer|adjust), /kho/phieu/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Sổ chứng từ của kho: ghi mọi lần hàng vào, ra, chuyển giữa các kho hoặc điều chỉnh sau kiểm kê. Phiếu có thể do thủ kho lập tay, hoặc do hệ thống tự sinh từ đơn nhập (nhận hàng, trả lại hàng mua), lệnh sản xuất, giao hàng, trả hàng bán và chuyến giao hàng.

## Đối tượng sử dụng

- Thủ kho: lập phiếu nhập / xuất / chuyển / kiểm kê, in phiếu, huỷ phiếu lập tay.
- Quản lý, Kế toán: xem phiếu và giá trị nhập.

## Quyền liên quan

stock.import (phiếu nhập), stock.import_price (ghi đơn giá trên phiếu nhập), stock.export (phiếu xuất), stock.transfer (chuyển kho), stock.adjust và stock.stocktake (kiểm kê), stock.cancel (huỷ phiếu), stock.overdraw (xuất vượt tồn khi công ty tắt "Cho xuất quá số tồn").

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Phiếu kho → Lập phiếu → Chọn loại (Nhập / Xuất / Chuyển / Kiểm kê) → Chọn kho, thêm dòng hàng → Lưu phiếu
[next]
[flow] Tồn kho cập nhật
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thủ kho | Bấm Lập phiếu ở danh sách và chọn một trong bốn loại. | Mở form /kho/phieu/lap/in | out | transfer | adjust. |
| 2 | Thủ kho | Chọn ngày, kho (kho nhận nếu chuyển), lý do, ghi chú. | Ngày phiếu không được sau hôm nay và không thuộc kỳ đã khoá sổ. Banner ghi chú riêng từng loại (ví dụ phiếu xuất không có tiền, không sinh công nợ). |
| 3 | Thủ kho | Thêm dòng: chọn hàng (ô chọn có tìm, xếp theo mã), ĐVT (chính hoặc quy đổi), số lượng; phiếu nhập thêm đơn giá nhập (nếu có quyền); kiểm kê nhập số thực đếm. | Dòng hiện tồn tại kho, thành tiền (nhập), chênh lệch (kiểm kê). Xuất/chuyển vượt tồn báo "Vượt tồn". |
| 4 | Thủ kho | Lưu phiếu. | Cấp số phiếu, cập nhật tồn, mở màn hình xem kèm thông báo. |
| 5 | Thủ kho | In phiếu hoặc Lập phiếu mới cùng loại. | Bản in có chữ ký người lập, người giao/nhận, thủ kho, kế toán trưởng. |
| 6 | Thủ kho | Huỷ phiếu nếu lập nhầm (chỉ phiếu lập tay). | Tồn trả về như trước khi lập; phiếu giữ lại đánh dấu Đã huỷ kèm lý do. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Phân trang trên máy chủ (lúc đăng nhập chỉ nạp 90 ngày gần nhất; phiếu cũ đọc khi cần). Tìm không dấu theo mã, lý do, hàng trong phiếu; lọc Loại phiếu (có chấm màu), Kho, Kỳ, Người lập, "Hiện phiếu đã huỷ"; chip bộ lọc; số phiếu theo loại và giá trị nhập tính trên máy chủ; xuất Excel (mỗi dòng hàng một dòng, lấy mọi phiếu khớp lọc). |
| Cột danh sách | Số phiếu · Ngày · Loại · Kho (chuyển kho hiện "A → B") · Chứng từ gốc (có link) · Lý do · Số dòng · Tổng SL (kiểm kê có dấu +/− và màu) · Giá trị nhập · Người lập. |
| Menu Lập phiếu | Bốn lựa chọn: Phiếu nhập kho, xuất kho, chuyển kho, kiểm kê. |
| Form lập / xem phiếu | Đầu phiếu + tổng kết bên phải; lưới hàng; thanh nút cố định ở chân (gợi ý "Thêm ít nhất một dòng hàng" khi chưa hợp lệ). |
| Bản in | Mẫu phiếu theo loại, có tiêu đề, ngày, kho, lý do, bảng hàng, các chỗ ký; in khổ A4, A5 hoặc giấy nhiệt K80. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Hiệu lực | Phiếu đã ghi tồn. | Huỷ (nếu lập tay); In. |
| Đã huỷ | Tồn đã đảo lại; phiếu giữ để đối chiếu. | Không còn thao tác. |

# 5. Quy tắc nghiệp vụ

1. **Phiếu nhập (PNK):** cộng tồn kho đã chọn; ghi đơn giá nhập theo ĐVT chính và kéo giá vốn bình quân theo giá đó (không ghi giá thì dùng giá vốn bình quân hiện tại). Người không có quyền nhập đơn giá thì giá bị bỏ.
1. **Phiếu xuất (PXK):** trừ tồn; không có tiền, không sinh công nợ — chỉ ghi nhận hàng rời kho. Mỗi dòng xuất **chốt giá vốn** bình quân tại thời điểm xuất (dùng cho lãi gộp).
1. **Phiếu chuyển (PCK):** trừ kho xuất, cộng kho nhận; kho nhận phải khác kho xuất.
1. **Phiếu kiểm kê (PKK):** nhập số thực đếm được (không phải chênh lệch); hệ thống lưu số sổ sách và chênh lệch = thực đếm − sổ sách; thừa (+) cộng thêm, thiếu (−) trừ bớt.
1. Số lượng nhập theo ĐVT quy đổi được quy về ĐVT chính khi ghi tồn; phiếu lưu cả ĐVT và số theo ĐVT đó.
1. Một mặt hàng không xuất hiện hai dòng trong một phiếu — phải gộp lại.
1. **Xuất vượt tồn:** khi công ty bật "Cho xuất quá số tồn" (mặc định) thì chỉ cảnh báo, vẫn lưu được (tồn có thể âm); khi tắt thì mọi phiếu làm tồn âm — kể cả giao hàng, xuất chuyến, vật tư sản xuất, huỷ phiếu nhập — bị từ chối, trừ người có quyền "Xuất vượt tồn kho".
1. **Ngày phiếu** không sau hôm nay (giờ Việt Nam). Chứng từ có ngày thuộc kỳ đã khoá sổ (ATL-20) không lập và không huỷ được.
1. **Loại hiển thị "Nhập trả về":** phiếu nhập sinh khi xe về kho với hàng khách không nhận, hoặc khi nhận hàng khách trả lại (phiếu trả hàng TH…); hàng vào lại đúng giá vốn đã xuất.
1. **Phiếu xuất trả nhà cung cấp:** sinh từ "Trả lại hàng mua" (TLM…, ATL-09), xuất theo giá mua; giá vốn bình quân tính lại như thể hàng đó chưa từng nhập.
1. **Huỷ phiếu:** chỉ khi phiếu chưa huỷ và lập tay. Phiếu sinh từ đơn nhập, lệnh sản xuất, đơn bán/giao hàng, chuyến giao hàng, phiếu trả hàng phải xử lý ở chứng từ gốc. Huỷ khoá phiếu trong lúc đảo tồn để hai người không cùng huỷ.
1. Không xoá phiếu; số phiếu cấp tăng dần theo tiền tố từng loại.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | PNK / PXK / PCK / PKK + 7 số | Cấp khi lưu. |
| type, date | enum, ngày | NHAP, XUAT, CHUYEN, KIEM_KE. |
| warehouseId, targetWarehouseId | Mã kho | Kho chính; kho nhận khi chuyển. |
| reason, note | Chuỗi | Lý do (có thể chứa mã chứng từ gốc) và ghi chú. |
| purchaseOrderId / salesOrderId / productionOrderId | Mã | Chứng từ gốc nếu phiếu tự sinh. |
| lines[] | Danh sách | productId, quantity (ĐVT chính), unitName, unitQuantity, unitPrice, unitCost (giá vốn đã chốt, không gửi ra giao diện), bookQuantity, delta, note. |
| createdBy, createdAt | Email, thời điểm | Người lập. |
| isCancelled, cancelReason, cancelledAt | Cờ, chuỗi, thời điểm | Thông tin huỷ. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Lưu phiếu nhập | Tồn kho nhận +. |
| Lưu phiếu xuất | Tồn −. |
| Lưu phiếu chuyển | Tồn − kho xuất, + kho nhận. |
| Lưu phiếu kiểm kê | Tồn điều chỉnh theo chênh lệch (có thể + hoặc −). |
| Huỷ phiếu | Đảo ngược đúng các thay đổi tồn đã ghi. |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Tồn kho (ATL-05) | Hiển thị kết quả của mọi phiếu. |
| Đơn nhập hàng (ATL-09) | Nhận hàng sinh phiếu nhập; có Chứng từ gốc. |
| Lệnh sản xuất (ATL-07) | Bắt đầu sinh phiếu xuất vật tư; Hoàn tất sinh phiếu nhập thành phẩm. |
| Đơn hàng bán / Chuyến giao hàng (ATL-12, ATL-13) | Giao hàng sinh phiếu xuất; xe về kho và trả hàng bán sinh phiếu nhập trả về. |
| Kho (ATL-32) | Tab phiếu kho của từng kho. |
| Thông tin công ty (ATL-20) | Khoá sổ và "Cho xuất quá số tồn". |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Chuyển kho cùng kho xuất và kho nhận | Báo "Kho nhận phải khác kho xuất"; không lưu. |
| Trùng mặt hàng trong phiếu | Báo gộp lại một dòng. |
| Huỷ phiếu có chứng từ gốc | Không có nút Huỷ; gợi ý huỷ ở chứng từ gốc. |
| Không tìm thấy phiếu | Hiện trang "Không tìm thấy phiếu kho" kèm nút về danh sách. |
| Ngày phiếu sau hôm nay hoặc trong kỳ đã khoá sổ | Máy chủ từ chối, báo rõ lý do. |
| Xuất vượt tồn khi công ty không cho xuất quá số tồn | Từ chối, báo mặt hàng và số tồn hiện có. |

# 10. Bản in

- Phiếu in: **Phiếu nhập / xuất / chuyển kho / kiểm kê**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Khối thông tin: kho (kho nhận khi chuyển), người lập, lý do, chứng từ gốc, ghi chú; bảng hàng có cột đơn giá và thành tiền với phiếu nhập; khối ký theo loại phiếu (nhập: Người lập, Người giao hàng, Thủ kho, Kế toán trưởng; xuất: Người nhận hàng; chuyển: Thủ kho xuất, Thủ kho nhận; kiểm kê: Người kiểm kê, Thủ kho, Kế toán trưởng).
- Phiếu đã huỷ in dấu "ĐÃ HUỶ".

# 11. Ghi chú & giới hạn hiện tại

- Phiếu lưu rồi không sửa; muốn sửa thì huỷ và lập lại để giữ dấu vết.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
