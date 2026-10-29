---
title: Chuyến giao hàng
Mã tài liệu: ATL-13
Phân hệ: Bán hàng
Đường dẫn: /giao-hang, /giao-hang/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Gom nhiều đơn hàng lên một xe, xuất kho một lượt, chốt số khách thực nhận từng đơn, nhập lại hàng không giao được khi xe về kho, và ghi chi phí chuyến. Giao diện kiểu chứng từ MISA.

## Đối tượng sử dụng

- Điều vận: tạo chuyến, gom đơn, chi phí.
- Thủ kho: xuất kho, nhập trả về.
- Nhân viên giao hàng: chốt giao nhận.

## Quyền liên quan

trip.view / create / update (điều phối) / ship (xuất kho) / deliver (chốt giao) / return (nhập lại hàng trả về) / cancel; vehicle.manage_cost (chi phí chuyến). Chốt giao chỉ do tài xế ghi trên chuyến (trùng tên người dùng) hoặc người có quyền điều phối chuyến.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Đang gom đơn → Đã xuất kho → Xe đã về kho → Hoàn tất
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Điều vận | Tạo chuyến: chọn xe trong danh mục (hoặc xe thuê ngoài: gõ biển số), tài xế (gợi ý từ danh sách), điện thoại, ngày chuyến, ghi chú. | Chuyến ở trạng thái Đang gom đơn; số CH…. |
| 2 | Điều vận | Gom đơn ("Xếp đơn lên chuyến"): chọn các đơn đang Chờ giao hàng hoặc Giao một phần. | Đơn xếp được phải còn hàng phải giao, chưa kết thúc và không nằm trên chuyến đang chạy khác. |
| 3 | Điều vận / Thủ kho | Bấm Xuất kho (cần ≥ 1 đơn), chọn ngày xuất (mặc định hôm nay). | Xếp toàn bộ phần còn phải giao lên xe; một phiếu xuất kho cho mỗi kho (lý do "Xuất kho giao hàng — chuyến CH…"), giá vốn chốt trên phiếu; các đơn chuyển Đang giao. |
| 4 | Nhân viên giao hàng | Chốt giao từng đơn: chọn ngày khách nhận, nhập số khách thực nhận mỗi dòng (≤ số đã xếp). | Ghi một đợt giao của đơn: một khoản công nợ phải thu theo số thực nhận, hạn = ngày nhận + số ngày được nợ; đơn "Thu tiền ngay" tự lập phiếu thu theo ngày nhận. Bỏ chốt được trước khi xe về kho (xoá đợt đó, huỷ phiếu thu của đợt, đơn về Đang giao). |
| 5 | Thủ kho | Bấm Xe về kho khi mọi đơn đã chốt, chọn ngày về. | Hàng khách không nhận nhập lại đúng kho đã xuất, đúng giá vốn đã xuất (phiếu "Nhập trả về"); chuyển Xe đã về kho. |
| 6 | Điều vận | Bấm Hoàn tất chuyến. | Chuyển Hoàn tất. |
| 7 | Điều vận | Nhập chi phí ở tab Chi phí: tiền dầu, cầu đường bến bãi, chi phí khác, ghi chú. | Sửa được ở mọi trạng thái trừ Đã huỷ; tổng chi phí dùng cho báo cáo Chi phí xe. |
| 8 | Điều vận | Huỷ chuyến khi chưa xuất kho, nhập lý do. | Chuyến Đã huỷ; các đơn được giải phóng. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo mã chuyến, tài xế, biển số, mã đơn; lọc Trạng thái, Tài xế, Xe, Kỳ; xuất Excel. Cột: Mã chuyến, Ngày, Tài xế, Biển số, Trạng thái, Đơn, Giá trị, Khách nhận, Chi phí. |
| Màn hình chứng từ | Đầu chuyến (số chứng từ, ngày chuyến, xe / biển số, tài xế, ghi chú, người tạo, giờ xuất kho, giờ về kho), thanh bước Gom đơn → Xuất kho & chốt giao → Xe về kho → Hoàn tất; ô chọn ngày cho xuất kho, chốt giao và xe về kho; các tab: Đơn · Hàng · Phiếu · Chi phí · Nhật ký; nút In phiếu soạn hàng (A4 / A5) và Phiếu giao hàng. |
| Hộp thoại thông tin chuyến | Sửa xe, tài xế, điện thoại, ghi chú (khi Đang gom đơn hoặc Đã xuất kho). |
| Hộp thoại chốt giao | Số thực nhận từng dòng của đơn. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Đang gom đơn | Xếp đơn, chưa xuất kho. | Xuất kho (cần ≥ 1 đơn); Huỷ |
| Đã xuất kho | Hàng đã lên xe. | Chốt giao / Bỏ chốt; Xe về kho (khi mọi đơn đã chốt) |
| Xe đã về kho | Đã nhập lại hàng không giao được. | Hoàn tất |
| Hoàn tất | Chuyến đóng. | — |
| Đã huỷ | Chỉ khi chưa xuất kho. | — |

# 5. Quy tắc nghiệp vụ

1. Một đơn không nằm trên hai chuyến đang chạy (Đang gom đơn / Đã xuất kho) cùng lúc.
1. **Xuất kho một lượt** xếp toàn bộ phần còn phải giao; sinh một phiếu xuất cho mỗi kho.
1. Số chốt giao mỗi dòng không vượt số đã xếp lên xe và số còn phải giao — vượt thì bị từ chối, không tự cắt bớt.
1. **Công nợ phải thu ghi theo số thực nhận** lúc chốt, mỗi lần chốt một đợt / một khoản; hạn thanh toán = ngày nhận + số ngày được nợ.
1. **Ngày chứng từ:** ngày xuất kho không sau hôm nay và không trước ngày đặt của các đơn; ngày chốt giao không trước ngày xuất kho chuyến; ngày xe về kho không trước ngày xuất kho và ngày chốt giao muộn nhất; không ngày nào thuộc kỳ đã khoá sổ.
1. **Xe về kho** chỉ khi mọi đơn đã chốt; hàng không nhận nhập lại đúng kho đã xuất bằng phiếu Nhập trả về.
1. Chuyến có đơn đã huỷ hoặc đã kết thúc không xuất kho được; không chốt giao đơn đã huỷ. Đơn trên chuyến chưa về kho không huỷ, không kết thúc được ở màn đơn.
1. Bỏ chốt giao tự huỷ phiếu thu "Thu tiền ngay" của đợt đó, không được làm quỹ âm (trừ quyền Chi vượt tồn quỹ); không bỏ chốt được khi đơn còn phiếu trả hàng.
1. **Huỷ chuyến** chỉ khi Đang gom đơn.
1. **Chi phí xe** (xăng, cầu đường, khác) sửa được ở mọi trạng thái trừ Đã huỷ; do người điều vận ghi, KHÔNG phải sổ quỹ — tiền thật ra khỏi quỹ nằm ở phiếu chi; chuyến huỷ không tính; xe thuê ngoài gộp theo biển số ghi trên chuyến.
1. Đơn sau khi chốt: nếu khách nhận toàn bộ → Hoàn thành; một phần → Giao một phần; không nhận gì → Trả toàn bộ.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, status | CH + 7 số, enum | GOM_DON, DA_XUAT_KHO, XE_VE_KHO, HOAN_TAT, HUY. |
| vehicleId, driverName, driverPhone, note | Khác | Xe, tài xế, điện thoại, ghi chú. |
| orderIds[], loads[] | Danh sách | Các đơn gom; số lượng từng dòng đã xếp lên xe. |
| confirmations[] | Danh sách | Đơn đã chốt và số khách thực nhận. |
| costs | Đối tượng | fuel, toll, other (₫). |
| shippedAt, returnedAt, completedAt, createdBy | Thời điểm | Các mốc và người lập. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Xuất kho một lượt | Tồn − theo từng kho; đơn → Đang giao. |
| Chốt giao | Công nợ phải thu + theo số thực nhận (một khoản mỗi đợt); Thu tiền ngay thì quỹ + bằng phiếu thu tự lập. |
| Bỏ chốt giao | Xoá đợt giao; công nợ và phiếu thu tự lập của đợt bị huỷ. |
| Xe về kho | Tồn + hàng không giao được (Nhập trả về). |
| Nhập chi phí | Không đổi quỹ — chỉ dùng cho báo cáo chi phí xe. |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Đơn được gom; trạng thái đơn đổi theo chuyến. |
| Danh mục xe (ATL-14) | Xe và tài xế mặc định. |
| Phiếu kho (ATL-06) | Phiếu xuất và nhập trả về, Chứng từ gốc là chuyến. |
| Công nợ phải thu (ATL-15) | Khoản phát sinh khi chốt giao. |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Xuất kho khi chưa có đơn | Không cho (cần ≥ 1 đơn). |
| Xe về kho khi còn đơn chưa chốt | Không cho; cần chốt hết. |
| Huỷ chuyến đã xuất kho | Không cho huỷ. |
| Chốt giao bởi người không phải tài xế của chuyến | Từ chối, trừ người có quyền điều phối chuyến. |
| Chốt vượt số trên xe / số còn phải giao | Từ chối, báo số được phép. |

# 10. Bản in

- Phiếu in: **Phiếu soạn hàng và Phiếu giao hàng**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Phiếu soạn hàng (A4 / A5): một bảng theo từng kho (ô "Đã soạn", mã, tên, ĐVT, số lượng, của đơn nào); ký: Thủ kho, Tài xế.
- Phiếu giao hàng: mỗi đơn một phiếu và một trang riêng (khách, người nhận, địa chỉ; số lượng giao, cột "Khách nhận" để trống; giá trị đơn trên chuyến); ký: Người giao (ghi tên tài xế), Khách ký nhận.

# 11. Ghi chú & giới hạn hiện tại

- Phiếu kho cũ và mới đều ghi mã chuyến trong lý do để tra cứu theo chuyến.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
