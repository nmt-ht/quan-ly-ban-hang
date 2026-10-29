---
title: Chức vụ & phân quyền
Mã tài liệu: ATL-23
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/chuc-vu
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Định nghĩa các chức vụ và quyền của từng chức vụ. Chọn một chức vụ ở cột trái để xem ai đang giữ và tick những việc chức vụ đó được làm, theo từng nhóm chức năng. Giao diện chỉ hiện tên quyền dễ hiểu, không hiện mã kỹ thuật.

## Đối tượng sử dụng

- CEO / Quản trị: thêm, sửa, ngừng dùng chức vụ và chỉnh quyền.

## Quyền liên quan

position.view, position.create, position.update, position.delete (ngừng dùng), position.assign_permission.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Chọn chức vụ → Tick quyền theo nhóm → Lưu phân quyền → Gán chức vụ cho người dùng (ATL-22)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản trị | Bấm "Thêm chức vụ": tên, mô tả, và (tuỳ chọn) "Bắt đầu từ quyền của" một chức vụ có sẵn. | Chức vụ mới xuất hiện ở cột trái và được chọn sẵn; có thể sao chép quyền để chỉnh lại cho nhanh. |
| 2 | Quản trị | Chọn một chức vụ rồi chọn khu vực (tab). Với mỗi nhóm chức năng bấm Không / Chỉ xem / Đầy đủ; cần chi tiết hơn thì mở nhóm (mũi tên) và tick từng quyền. Có thể "Chọn tất cả", "Bỏ tất cả", "Lấy quyền từ chức vụ…" hoặc tìm quyền theo tên. | Thay đổi nằm ở bản nháp; thanh dưới hiện "Có thay đổi chưa lưu: thêm N, bỏ M quyền". |
| 3 | Quản trị | Bấm "Lưu phân quyền" (hoặc "Huỷ thay đổi"). | Số quyền ở danh sách cập nhật; thông báo "Đã lưu phân quyền cho …". |
| 4 | Quản trị | Đổi sang chức vụ khác khi còn thay đổi chưa lưu. | Hiện hộp xác nhận "Bỏ thay đổi chưa lưu?" — Ở lại hoặc Bỏ thay đổi. |
| 5 | Quản trị | Sửa tên / mô tả, hoặc bấm "Ngừng dùng" / "Dùng lại". | Chức vụ ngừng dùng không còn hiện khi thêm người dùng mới; người đang giữ bị đăng xuất và không đăng nhập được cho tới khi chức vụ được dùng lại (thông báo nói rõ số người bị ảnh hưởng). |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Cột chức vụ | Mỗi chức vụ là một thẻ: ảnh chữ cái viết tắt, tên, nhãn Hệ thống / Ngừng dùng, "N người · x/113 quyền" và thanh phủ quyền; màn hình dưới 1100 px chuyển thành dải cuộn ngang phía trên. |
| Tóm tắt chức vụ | Tên, mô tả, nút Sửa và Ngừng dùng; ba chỉ số: Người dùng (chữ cái viết tắt của người đang giữ, bấm mở hồ sơ, tối đa 5 kèm "+N"), Quyền đã cấp (x/113 kèm thanh), Nhóm chức năng (n/25 có ít nhất một quyền). |
| Phân quyền theo khu vực | 7 tab: Bán hàng (khách hàng, đơn bán, báo giá, chuyến, xe), Mua hàng (NCC, đơn nhập), Hàng hoá & kho (hàng hoá, giá, định mức, nhóm hàng, kho, tồn kho, phiếu kho, kiểm kê), Sản xuất, Tiền & công nợ, Báo cáo (tổng quan, báo cáo), Hệ thống (người dùng, chức vụ, công ty, thẻ, nhật ký) — mỗi tab kèm x/y. Mỗi nhóm một dòng: tên, số x/y, nhãn mức (Không có quyền / Chỉ xem / Đầy đủ / Tuỳ chỉnh), nút Không · Chỉ xem · Đầy đủ; mở nhóm để tick từng quyền. Tìm quyền sẽ hiện các nhóm khớp ở mọi tab. |
| Hộp thoại chức vụ | Tên (bắt buộc, tối đa 60 ký tự, không trùng), Mô tả, và khi thêm mới: "Bắt đầu từ quyền của". |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Chức vụ hệ thống (CEO) | Luôn toàn quyền (113/113); ma trận bị khoá, không sửa, không ngừng dùng. | Chỉ xem |
| Đang dùng | Chọn được khi thêm / sửa người dùng. | Sửa; Ngừng dùng; chỉnh quyền |
| Ngừng dùng | Không hiện ở lựa chọn chức vụ mới; người đang giữ không đăng nhập được, phiên đang mở bị từ chối ở mọi API. | Dùng lại |

# 5. Quy tắc nghiệp vụ

1. **Quyền theo nhóm có quyền "Xem":** tick bất kỳ quyền nào trong nhóm thì "Xem" của nhóm tự được tick; bỏ "Xem" thì cả nhóm bị bỏ.
1. **CEO** là chức vụ hệ thống: có mọi quyền, không sửa, không ngừng dùng; hệ thống cần ít nhất một tài khoản CEO hoạt động (ATL-22).
1. **Không xoá chức vụ** — chỉ Ngừng dùng, để người dùng và lịch sử không mất ý nghĩa.
1. Tên chức vụ không trùng (không phân biệt hoa thường và dấu).
1. Số người dùng của mỗi chức vụ tính từ danh sách người dùng (kể cả tài khoản bị khoá).
1. **Bộ quyền mặc định** theo mô tả: CEO 113 · Quản lý 104 (mọi quyền trừ quản trị người dùng, chức vụ và sửa thông tin công ty) · Kế toán 52 · Sale 20 · Thủ kho 19 · Nhân viên giao hàng 6 · Nhân viên xưởng 5 quyền.
1. **Quyền nhạy cảm mặc định chỉ CEO và Quản lý:** Bán dưới giá tối thiểu, Chiết khấu ngoài khuyến mãi, Chi vượt tồn quỹ, Xuất vượt tồn kho, Quản lý bảng giá, Quản lý khuyến mãi, Xem nhật ký hoạt động. Kế toán có thêm Khoá sổ, Trả lại hàng mua, Nhận hàng trả lại, Nhắc nợ.
1. Quyền mới thêm vào hệ thống được cấp cho các chức vụ có sẵn bằng một bước cập nhật dữ liệu đi kèm bản phát hành.
1. Giao diện không hiện mã quyền kỹ thuật; chỉ hiện tên quyền.
1. **Mức theo nhóm:** Không = bỏ hết quyền của nhóm; Chỉ xem = chỉ quyền Xem (nhóm không có quyền Xem thì không có mức này); Đầy đủ = mọi quyền của nhóm; Tuỳ chỉnh = tick lẻ, hiện khi không khớp ba mức trên.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name, description | Chuỗi | Tên và mô tả chức vụ. |
| isSystem, isActive | Cờ | Chức vụ hệ thống; đang dùng. |
| permissions[] | Danh sách mã quyền | Quyền đã cấp (113 quyền trong 25 nhóm). |
| userCount, permissionCount, totalPermissionCount | Số | Số người giữ, số quyền đã cấp, tổng số quyền. |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Người dùng (ATL-22) | Gán chức vụ cho người dùng; danh sách người giữ hiển thị ở đây. |
| Mọi chức năng | Quyền được định nghĩa cho từng nhóm chức năng. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng tên chức vụ | Báo "Đã có chức vụ …"; không lưu. |
| Để trống tên | Nút Thêm / Lưu không bật. |
| Sửa chức vụ hệ thống | Không có nút Sửa / Ngừng dùng; ô tick bị khoá. |

# 9. Chức vụ có sẵn

| Chức vụ | Vai trò |
|---|---|
| CEO | Toàn quyền hệ thống. Chức vụ hệ thống — không xoá, không gỡ quyền. |
| Quản lý | Duyệt đơn, duyệt lệnh sản xuất, xem toàn bộ báo cáo. Xem được giá vốn. |
| Kế toán | Phiếu thu/chi, công nợ, đối trừ, báo cáo tài chính. Xem được giá vốn. |
| Sale | Chăm sóc khách, chốt đơn — người đứng tên Người bán. KHÔNG xem được giá vốn. |
| Thủ kho | Phiếu nhập/xuất kho, kiểm kê, chuyển kho. KHÔNG thấy giá nhập và giá vốn. |
| Nhân viên giao hàng | Xem đơn được giao, chốt giao nhận, nhập số lượng khách thực nhận. |
| Nhân viên xưởng | Cập nhật tiến độ lệnh sản xuất được giao. |

# 10. Các nhóm quyền

| Nhóm | Quyền chính |
|---|---|
| Người dùng | Xem, Thêm, Sửa, Xoá, Đặt lại mật khẩu |
| Chức vụ | Xem, Thêm, Sửa, Xoá (ngừng dùng), Phân quyền cho chức vụ |
| Công ty | Xem, Sửa thông tin công ty, Khoá sổ / bỏ khoá sổ kỳ kế toán |
| Nhóm hàng, Kho | Xem, Thêm, Sửa, Xoá |
| Thẻ | Xem, Quản lý thẻ |
| Hàng hoá | Xem, Thêm, Sửa, Ngừng kinh doanh, Nhập Excel, Xuất danh mục, Quản lý ảnh |
| Giá | Sửa giá bán, Xem giá vốn, Quản lý bảng giá, Quản lý khuyến mãi |
| Định mức | Xem, Khai báo định mức |
| Khách hàng | Xem, Thêm, Sửa, Ngừng theo dõi |
| Nhà cung cấp | Xem, Thêm, Sửa, Ngừng hợp tác, Quản lý danh mục hàng của NCC |
| Tồn kho | Xem tồn kho, Xem giá trị tồn kho |
| Phiếu kho | Lập phiếu nhập, Nhập đơn giá trên phiếu nhập, Lập phiếu xuất, Chuyển kho, Điều chỉnh tồn, Huỷ phiếu kho, Xuất vượt tồn kho |
| Kiểm kê | Kiểm kê kho |
| Đơn nhập hàng | Xem, Tạo, Sửa, Duyệt (gửi NCC), Xác nhận nhận hàng, Huỷ, Trả lại hàng mua |
| Đơn bán hàng | Xem, Xem đơn của mọi người bán, Tạo, Sửa, Huỷ, Sửa đơn giá, Chiết khấu ngoài khuyến mãi, Bán dưới giá tối thiểu, Nhận hàng trả lại |
| Báo giá | Xem, Lập, Sửa, Huỷ |
| Xe | Xem, Thêm, Sửa, Nhập chi phí chuyến xe |
| Chuyến giao hàng | Xem, Tạo, Sửa, Xuất kho cho chuyến, Chốt giao hàng, Nhập lại kho hàng trả về, Huỷ |
| Lệnh sản xuất | Xem, Tạo, Duyệt, Cập nhật tiến độ, Nghiệm thu nhập kho, Huỷ |
| Công nợ | Xem, Đối trừ, Điều chỉnh công nợ, Nhắc nợ khách hàng |
| Phiếu thu chi | Xem, Lập phiếu thu, Lập phiếu chi, Huỷ, Quản lý loại thu chi, Quản lý tài khoản tiền, Chi vượt tồn quỹ |
| Tổng quan | Xem trang tổng quan |
| Báo cáo | Bán hàng, Kho, Mua hàng, Công nợ, Dòng tiền, Sản xuất, Giao hàng, Xem lợi nhuận / lãi gộp |
| Nhật ký hoạt động | Xem nhật ký hoạt động — mặc định CEO và Quản lý |

# 11. Ghi chú & giới hạn hiện tại

- Quyền được áp ở cả giao diện (ẩn trang, mục menu, nút tạo mới mà chức vụ không có quyền) và máy chủ (mọi API kiểm tra quyền; thiếu quyền trả lỗi 403). Đổi quyền có hiệu lực ở máy chủ từ yêu cầu kế tiếp của người giữ chức vụ. Giá vốn, giá trị tồn và giá nhập chỉ được máy chủ gửi cho chức vụ có quyền xem. Mọi thay đổi chức vụ và quyền được ghi vào Nhật ký hoạt động (ATL-27).
- Bộ kiểm thử phân quyền gọi mọi API với cả 7 chức vụ, chức vụ không quyền, chưa đăng nhập và tài khoản đang bị buộc đổi mật khẩu.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
