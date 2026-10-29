---
title: Tồn kho
Mã tài liệu: ATL-05
Phân hệ: Nghiệp vụ
Đường dẫn: /kho/ton-kho
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Xem tồn hiện tại của từng mặt hàng (quy về ĐVT chính) theo từng kho, kèm số đã đặt, sắp về và có thể bán; phát hiện hàng dưới mức tối thiểu và gợi ý lập đơn nhập theo từng nhà cung cấp.

## Đối tượng sử dụng

- Thủ kho, Quản lý, Sale, Kế toán (xem).

## Quyền liên quan

stock.view; cột Giá trị tồn cần stock.view_value hoặc product.view_cost_price; lập đơn nhập từ gợi ý cần purchase.create.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở Tồn kho → Chọn kho / lọc → Đọc tồn, đã đặt, sắp về, có thể bán → Mở hàng hoá hoặc lập phiếu kho
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thủ kho | Mở Tồn kho; mặc định "Tất cả kho". | Mỗi kho có tồn là một cột, thêm Tổng, Khách đã đặt, Sắp về, Có thể bán, Tối thiểu, Giá trị tồn, Tình trạng. |
| 2 | Thủ kho | Chọn một kho cụ thể ("Kho tính tồn"). | Chỉ hiện mặt hàng có theo dõi ở kho đó, với tồn và mức tối thiểu của riêng kho; Khách đã đặt / Sắp về chỉ tính ở chế độ Tất cả kho. |
| 3 | Quản lý | Dùng các nút lọc: "Dưới tồn tối thiểu", "Đang tồn âm", "Hiện cả tồn 0"; sắp xếp; tìm theo mã hoặc tên. | Hàng tồn 0 mặc định ẩn, trừ hàng hết nhưng có tồn tối thiểu (cần nhập). |
| 4 | Quản lý | Từ Tổng quan bấm "Hàng dưới tồn tối thiểu". | Mở sẵn bộ lọc ?belowMin=true. |
| 5 | Thu mua | Bấm "Gợi ý đơn nhập" (hiện khi có vật tư dưới tối thiểu mà đơn nhập đang về chưa đủ bù). | Hộp thoại gom vật tư theo nhà cung cấp: số đặt thêm = tối thiểu − tồn − đơn nhập đang về (kể cả Nháp), làm tròn lên; chọn dòng rồi "Lập đơn nhập" mở đơn nhập mới điền sẵn (chưa lưu gì cho tới khi bấm Lập đơn). /kho/ton-kho?belowMin=true&reorder=1 mở thẳng hộp thoại. |
| 6 | Thủ kho | Cần điều chỉnh tồn thì mở Phiếu kho. | Chuyển sang /kho/phieu. |

# 3. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Đủ hàng | Tồn ≥ mức tối thiểu (hoặc không đặt tối thiểu). | Không cần xử lý. |
| Dưới tối thiểu | Có tồn nhưng thấp hơn mức tối thiểu. | Lập đơn nhập hàng. |
| Hết hàng | Tồn 0 và có đặt mức tối thiểu — cần nhập thêm. | Lập đơn nhập hàng. |
| Tồn âm | Tồn nhỏ hơn 0 (đã xuất vượt tồn). | Nhập bù hoặc kiểm kê. |
| Tồn 0 | Tồn 0, không đặt mức tối thiểu. | Ẩn mặc định, bật "Hiện cả tồn 0" để xem. |

# 4. Quy tắc nghiệp vụ

1. Mọi hàng hoá trừ Dịch vụ đều hiện ở đây (Vật tư và Thành phẩm); Dịch vụ không có tồn.
1. **Khách đã đặt** = phần chưa xuất kho của các đơn hàng bán còn hiệu lực (không tính đơn Đang giao, Hoàn thành, Trả toàn bộ, Đã huỷ hoặc đã Kết thúc đơn). **Sắp về** = phần chưa nhận của đơn nhập Đã gửi NCC hoặc Nhận một phần. **Có thể bán** = tồn − khách đã đặt.
1. Mọi số quy về ĐVT chính; tồn âm giữ nguyên.
1. **Giá trị tồn** = tồn dương × giá vốn bình quân gia quyền di động (ATL-04); tồn âm không làm giá trị âm. Chỉ hiện với người được xem giá trị tồn.
1. **Nhà cung cấp gợi ý** cho mỗi vật tư: NCC có giá thấp nhất trong danh mục hàng của NCC, nếu không có thì NCC lần mua gần nhất.
1. Tồn có âm hay không tuỳ thiết lập "Cho xuất quá số tồn" (ATL-20): mặc định cho phép; tắt thì mọi chứng từ làm tồn âm bị từ chối, trừ người có quyền "Xuất vượt tồn kho".
1. Tồn chỉ đổi qua chứng từ: nhận hàng, xuất vật tư, nhập thành phẩm, giao hàng, nhập trả về, phiếu kho lập tay.
1. Mức tối thiểu có thể đặt riêng cho từng kho; chế độ Tất cả kho dùng tối thiểu của hàng hoá và tổng tồn các kho.
1. Nút "Dưới tồn tối thiểu" gồm cả hàng Hết hàng và Tồn âm.

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Phiếu kho (ATL-06) | Mọi biến động tồn đến từ phiếu kho. |
| Đơn nhập hàng (ATL-09) | Cột Sắp về lấy từ đơn đã gửi NCC chưa nhận. |
| Hàng hoá (ATL-04) | Mở chi tiết hàng; tồn tối thiểu cấu hình ở hàng hoá. |
| Kho (ATL-32) | Danh mục kho; trang kho có liên kết "Xem tồn kho" của riêng kho đó. |
| Tổng quan (ATL-02) | Dưới tồn tối thiểu, Tồn kho an toàn, Cơ cấu tồn kho mở trang này. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Kho không có hàng theo dõi | Bảng rỗng kèm gợi ý lập phiếu kho hoặc đơn nhập. |
| Không có vật tư nào dưới tối thiểu | Hộp gợi ý báo "Không có vật tư nào dưới tồn tối thiểu."; dòng đã có đơn đang về đủ bù ghi "đơn đang về đã đủ bù". |

# 7. Ghi chú & giới hạn hiện tại

- Giá trị tồn tính theo giá vốn bình quân hiện tại; báo cáo Tồn kho hiện tại (ATL-03) dùng cùng cách tính.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
