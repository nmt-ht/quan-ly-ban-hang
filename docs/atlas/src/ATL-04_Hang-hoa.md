---
title: Hàng hoá & định mức
Mã tài liệu: ATL-04
Phân hệ: Nghiệp vụ
Đường dẫn: /hang-hoa, /hang-hoa/them, /hang-hoa/:id, /hang-hoa/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh mục mọi thứ doanh nghiệp mua, sản xuất và bán: vật tư, thành phẩm, dịch vụ; kèm giá theo loại khách, giá bán tối thiểu, đơn vị quy đổi, ảnh, tồn tối thiểu, thuế và định mức (BOM) của thành phẩm. Trang chi tiết mở theo mã hàng (/hang-hoa/SP0000001).

## Đối tượng sử dụng

- Quản lý / Sale: thêm, sửa hàng hoá, đặt giá.
- Thủ kho, Kế toán: xem hàng hoá, tồn kho và giá.

## Quyền liên quan

product.view / create / update / delete (ngừng kinh doanh) / import / export / manage_image; product.update_price (sửa giá bán và giá tối thiểu); product.view_cost_price (xem giá vốn); bom.view; bom.manage.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm hàng hoá → Chọn tính chất → Điền giá, ĐVT quy đổi, kho, tồn tối thiểu → Nhập định mức bằng Excel (thành phẩm)
[next]
[flow] Dùng trong đơn nhập/đơn bán/phiếu kho
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Bấm Thêm hàng hoá, chọn tính chất: Vật tư hàng hoá / Thành phẩm / Dịch vụ. | Form hiện đúng trường cho tính chất đó; tính chất quyết định tiền tố mã (VT / SP / DV) và không đổi được sau khi tạo. |
| 2 | Quản lý | Điền thông tin chung: tên, nhóm hàng, ĐVT chính, mã đối chiếu, nguồn gốc, thuế GTGT, bảo hành, kho ngầm định và tồn tối thiểu (vật tư), diễn giải khi mua / khi bán, mô tả. | Mã hệ thống tự cấp: VT / SP / DV + số. |
| 3 | Quản lý | Điền giá bán lẻ / sỉ / dropship và Giá bán tối thiểu (giá sàn, ĐVT chính, chưa thuế; 0 = không giới hạn); thêm Đơn vị quy đổi nếu có (không áp dụng cho thành phẩm). | Giá theo ĐVT quy đổi suy ra từ giá ĐVT chính hoặc đặt riêng. Form cảnh báo khi giá lẻ / sỉ / dropship hoặc giá ĐVT quy đổi thấp hơn giá tối thiểu. |
| 4 | Quản lý | Thêm ảnh (ảnh đầu là Ảnh chính). | Ảnh chính hiện trên bảng danh sách và thẻ lưới. |
| 5 | Quản lý | Tick "Được phép bán" và "Đang kinh doanh" theo nhu cầu. | Bỏ tick Đang kinh doanh = ngừng kinh doanh (không xoá, lịch sử giữ nguyên). |
| 6 | Quản lý | Với thành phẩm: bấm "Nhập định mức" ở danh sách, tải mẫu (điền sẵn định mức hiện có) rồi nhập lại bằng Excel. | Định mức hiện ở tab Định mức của thành phẩm và tab "Dùng trong định mức của" ở vật tư; lệnh sản xuất chụp bản sao khi lập. Thành phẩm có dòng định mức lỗi bị bỏ qua cả thành phẩm. |
| 7 | Quản lý | Nhập hàng loạt hàng hoá từ Excel ("Nhập hàng hoá"). | Máy chủ chạy thử từng dòng và trả kết quả xem trước (thêm mới / cập nhật / không đổi / lỗi kèm lý do) mà chưa lưu gì; xác nhận thì lưu các dòng hợp lệ, dòng lỗi bị bỏ qua. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Chuyển Lưới / Bảng; lọc theo Tính chất, Nhóm hàng, Kho tính tồn, Trạng thái kinh doanh; sắp xếp; tìm theo mã hệ thống, mã đối chiếu hoặc tên; nút Xuất Excel, Nhập hàng hoá, Nhập định mức, Thêm hàng hoá. |
| Form thêm/sửa | Các khối: Thông tin chung · Giá bán · Đơn vị quy đổi · Hình ảnh · Ghi chú. |
| Chi tiết | Mở theo mã (/hang-hoa/SP0000001; đường dẫn cũ theo id tự chuyển sang mã). Các tab (giữ trong ?tab=): Thông tin chung · Đơn vị quy đổi (trừ thành phẩm) · Giá bán · Tồn kho (trừ dịch vụ; tồn và tối thiểu theo kho) · Định mức (thành phẩm) · Ảnh · Lịch sử nhập xuất (trừ dịch vụ; có liên kết "Xem thẻ kho" mở báo cáo Thẻ kho của mặt hàng) · Nhật ký (ai đã sửa gì, kể cả đổi giá bán — ATL-27). |
| Hộp thoại nhập Excel | Chọn file, xem trước, báo dòng lỗi, xác nhận nhập. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Đang kinh doanh | Chọn được trong đơn, phiếu kho. | Bỏ tick "Đang kinh doanh" ở form sửa |
| Ngừng kinh doanh | Không chọn cho chứng từ mới; lịch sử giữ. | Tick lại "Đang kinh doanh" ở form sửa |

# 5. Quy tắc nghiệp vụ

1. **Vật tư hàng hoá:** theo dõi tồn theo từng kho, có Kho ngầm định và Tồn tối thiểu; có thể có đơn vị quy đổi.
1. **Thành phẩm:** cắt theo đơn, chỉ có một đơn vị — m² (kiểu Mét vuông: dài × rộng) hoặc m (kiểu Mét dài); không có đơn vị quy đổi; có định mức. Form không có Kho ngầm định / Tồn tối thiểu, nhưng tồn vẫn biến động: lệnh sản xuất hoàn tất nhập vào Kho thành phẩm, giao hàng xuất ra.
1. **Dịch vụ:** không có tồn, không xuất nhập kho.
1. **Đơn vị quy đổi:** ví dụ "1 bó = 12 cái", "10 lạng = 1 kg", "1 hộp = 1 cái, giá +5.000 ₫"; tồn luôn quy về ĐVT chính; giá ĐVT quy đổi suy ra từ giá ĐVT chính nếu không đặt riêng.
1. **Ba mức giá:** lẻ, sỉ, dropship; đơn hàng bán lấy giá theo loại khách, trừ khi khách được gán **bảng giá riêng** (ATL-29) có mặt hàng đó. Khuyến mãi (ATL-30) tự áp trên đơn và báo giá.
1. **Giá bán tối thiểu:** đơn giá thực thu của một dòng (sau chiết khấu dòng và phần chiết khấu cả đơn) trên đơn bán / báo giá không được thấp hơn giá tối thiểu × tỷ lệ quy đổi, trừ người có quyền "Bán dưới giá tối thiểu" hoặc dòng chứng từ đã có với giá đó.
1. **Tồn tối thiểu** > 0 đưa mặt hàng vào danh sách "dưới tồn tối thiểu" khi tồn thấp hơn.
1. **Giá vốn bình quân gia quyền di động** (tính chung mọi kho): mỗi phiếu nhập kéo bình quân theo giá nhập của nó; mọi phiếu xuất, chuyển, kiểm kê đi theo bình quân lúc đó và **chốt giá vốn trên dòng phiếu**. Thành phẩm nhập kho theo chi phí vật tư đã xuất ÷ số làm được; hàng trả về nhập lại đúng giá đã xuất; dịch vụ = 0. Giá vốn chỉ hiện với chức vụ có quyền Xem giá vốn.
1. Excel xuất và nhập dùng chung bố cục cột nên có thể xuất ra, sửa, rồi nhập lại; số kiểu Việt ("1.250.000", "0,45") đọc được.
1. **Mã hàng** cấp tự động theo tính chất (VT / SP / DV + số) và không đổi được sau khi tạo.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | Chuỗi | VT/SP/DV + dãy số, duy nhất. |
| name, type | Chuỗi / enum | Tên và tính chất (VAT_TU, THANH_PHAM, DICH_VU). |
| baseUnit, measureMode | Chuỗi / enum | ĐVT chính; thành phẩm cố định m² hoặc m theo kiểu đo. |
| categoryId, defaultWarehouseId | Mã | Nhóm hàng và kho ngầm định khi xuất/nhập. |
| minStock, vatRate, warrantyMonths | Số | Tồn tối thiểu; thuế GTGT mặc định (0/5/8/10); bảo hành tháng. |
| retailPrice, wholesalePrice, dropshipPrice | Số (₫) | Giá bán ba loại khách theo ĐVT chính. |
| unitConversions[] | Danh sách | Tên đơn vị, tỷ lệ so với ĐVT chính, giá riêng. |
| images[] | Danh sách | Ảnh (ảnh đầu là Ảnh chính). |
| isSellable, isActive | Cờ | Được phép bán; đang kinh doanh (hai ô tick ở cuối form). |
| Định mức (BomLine) | Danh sách | finishedProductId, componentId, quantityPerUnit. |
| crossRefCode, origin | Chuỗi | Mã đối chiếu (mã của hệ thống khác / NCC) và nguồn gốc xuất xứ. |
| purchaseNote, saleNote, description | Chuỗi | Diễn giải khi mua, diễn giải khi bán, mô tả. |
| minPrice | Số (₫) | Giá bán tối thiểu theo ĐVT chính, chưa thuế; 0 = không giới hạn. |
| avgCost | Số (₫) | Giá vốn bình quân hiện tại (máy chủ giữ, chỉ gửi cho người được xem giá vốn). |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Tồn kho (ATL-05) | Tồn tính theo hàng và kho; tồn tối thiểu cảnh báo. |
| Phiếu kho (ATL-06) | Chọn hàng, quy đổi ĐVT, tính tồn. |
| Lệnh sản xuất (ATL-07) | Định mức của thành phẩm được chụp vào lệnh. |
| Đơn nhập / Đơn bán (ATL-09, ATL-12) | Chọn hàng, giá, thuế, ĐVT quy đổi. |
| Nhà cung cấp (ATL-08) | Danh mục hàng theo NCC (mã theo NCC, giá mua). |
| Bảng giá (ATL-29), Khuyến mãi (ATL-30) | Giá riêng theo khách và chương trình giảm giá theo mặt hàng. |
| Nhóm hàng (ATL-33) | Phân nhóm mặt hàng để lọc và báo cáo. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng mã hoặc thiếu trường bắt buộc | Form báo lỗi tại trường, không lưu. |
| Dòng Excel sai định dạng | Liệt kê dòng lỗi, vẫn nhập các dòng hợp lệ (trừ định mức lỗi bỏ cả thành phẩm). |
| Giá bán thấp hơn giá tối thiểu | Form cảnh báo tại ô giá; đơn bán / báo giá dưới giá sàn bị chặn với người không có quyền. |
| Mở đường dẫn cũ /hang-hoa/<id> | Tự chuyển sang /hang-hoa/<mã>. |

# 9. Ghi chú & giới hạn hiện tại

- Bố cục cột Excel theo form; xuất và nhập dùng chung bố cục. Mỗi lần nhập thật ghi một dòng nhật ký tổng, từng mặt hàng ghi như sửa trên form.
- Ảnh hàng hoá đang lưu trong cơ sở dữ liệu (data URL); chưa chuyển sang lưu trữ đối tượng.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
