---
title: Tổng quan
Mã tài liệu: ATL-02
Phân hệ: Tổng quan
Đường dẫn: /tong-quan
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Bảng điều khiển cho chủ doanh nghiệp, sắp xếp để nhìn vào là biết ngay vấn đề nằm ở đâu: đầu trang là dải doanh thu của kỳ (con số, so với kỳ trước, đường 12 tháng) đặt cạnh cột "Cần xử lý"; kế đó là thẻ từng mảng theo màu phân hệ (bán hàng, kho & mua hàng, lợi nhuận, dòng tiền, công nợ) với trạng thái Ổn / Cần theo dõi / Có vấn đề; cuối trang là các biểu đồ. Mỗi dòng, mỗi con số bấm vào được màn hình chi tiết.

## Đối tượng sử dụng

- CEO / Quản lý: xem toàn bộ.
- Kế toán: xem công nợ, dòng tiền, lợi nhuận.
- Sale: xem doanh thu và tình hình đơn hàng.

## Quyền liên quan

report.dashboard (xem trang); lãi gộp và hàng bán dưới giá vốn cần report.view_profit; công nợ cần debt.view; giá trị tồn kho cần stock.view_value hoặc product.view_cost_price.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Chọn kỳ → Đọc doanh thu & "Cần xử lý" → Xem thẻ từng mảng → Xem biểu đồ 12 tháng
[next]
[flow] Bấm vào dòng / số → mở đúng màn hình để xử lý
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Chọn kỳ bằng bốn nút Tháng này / Quý này / Năm nay / Tất cả, hoặc bộ chọn kỳ bên cạnh cho khoảng khác. | Mọi số liệu tính lại cho kỳ (tối đa tới hôm nay); công nợ và tồn quỹ luôn là toàn bộ lịch sử. Dòng phụ dưới tiêu đề ghi "từ … đến …". |
| 2 | Quản lý | Đọc dải doanh thu đầu trang. | Doanh thu kỳ, % so với kỳ trước cùng độ dài, vài chỉ số phụ (đơn, công nợ); đường doanh thu 12 tháng gần nhất với điểm cao nhất; hai nút nhanh Lập đơn hàng, Lập phiếu thu. |
| 3 | Quản lý | Đọc cột "Cần xử lý" bên cạnh. | "N việc, việc gấp ở trên"; đếm "N nghiêm trọng · N cần theo dõi"; 10 việc mỗi trang, có nút trang trước / sau. Không có vấn đề thì hiện thông báo màu xanh. |
| 4 | Quản lý | Xem "Tình hình từng mảng". | Mỗi thẻ mang màu phân hệ: con số của kỳ, % so kỳ trước, đường nhỏ 12 tháng (sparkline), nhãn trạng thái, các dòng chi tiết bấm được và liên kết "Xem …". |
| 5 | Quản lý | Xem các biểu đồ cuối trang. | Doanh thu, nhập hàng và lãi gộp 12 tháng; Mặt hàng bán chạy (top 10, 5 mỗi trang); Doanh thu theo ngày / tháng của kỳ; Cơ cấu tồn kho theo nhóm. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Chọn kỳ | Bốn nút kỳ thường dùng + bộ lọc kỳ đầy đủ (hôm nay, hôm qua, 7/30 ngày qua, tuần, tháng, quý, năm, tuỳ chọn khoảng ngày). |
| Dải doanh thu (hero) | Nền màu rêu: doanh thu kỳ, so sánh có màu (▲/▼), các chỉ số phụ, nút Lập đơn hàng / Lập phiếu thu, đường doanh thu 12 tháng có điểm rê chuột và bảng ẩn cho trình đọc màn hình; chưa có số thì "Chưa có doanh thu trong 12 tháng gần nhất". |
| Cần xử lý | Mỗi dòng: mức độ (Nghiêm trọng / Theo dõi), tiêu đề (ví dụ "Khách nợ quá hạn 14.696.000 ₫"), một câu giải thích, mảng, nút "Xem …"; phân trang 10 dòng. |
| Bán hàng & giao hàng | Số đơn của kỳ (+ % và sparkline); "đơn đang xử lý"; dòng Chờ sản xuất, Đang giao, Trễ hẹn giao, Khách ngừng mua > 60 ngày. |
| Kho & mua hàng | Giá trị nhập hàng của kỳ (+ % và sparkline); số mặt hàng dưới tồn tối thiểu; vòng "Tồn kho an toàn" (% mặt hàng đủ tối thiểu); dòng Cần nhập thêm, Đơn nhập chờ nhận hàng. |
| Lợi nhuận | Lãi gộp (+ tỷ suất so kỳ trước, sparkline); tỷ suất lãi gộp; chiết khấu trên giá trị hàng; dòng Bán dưới giá vốn, Chiết khấu đã cấp. |
| Dòng tiền | Tiền thu về của kỳ (+ sparkline); tồn quỹ hiện tại; Thu − Chi; số dư từng tài khoản. |
| Công nợ | "Khách còn nợ mình" và "Mình còn nợ nhà cung cấp" cạnh nhau, mỗi bên có Quá hạn và Đến hạn trong 7 ngày. |
| Biểu đồ | Cột doanh thu / nhập hàng / lãi gộp 12 tháng (chú giải, rê chuột xem tháng); Mặt hàng bán chạy (tên, số lượng, tỷ trọng, phân trang); Doanh thu theo ngày (kỳ dài hơn 62 ngày gom theo tháng); Cơ cấu tồn kho theo nhóm hàng. |

# 4. Quy tắc nghiệp vụ

1. **Doanh thu** ghi nhận khi khách thực nhận hàng, đúng bằng số đã vào công nợ phải thu, vào ngày giao; trả hàng làm giảm doanh thu vào ngày trả; đơn huỷ và đơn chưa giao không tính.
1. **Kỳ trước** là khoảng liền trước, cùng độ dài kỳ đang xem; không có số kỳ trước thì không hiện %. Sparkline luôn là 12 tháng gần nhất, không phụ thuộc kỳ.
1. **Lãi gộp** = doanh thu thuần − giá vốn hàng bán; giá vốn là bình quân gia quyền di động **đã chốt trên phiếu xuất** lúc giao (ATL-03).
1. **Phần trăm** hiển thị dạng "▲ +12,5%" / "▼ −60,8%" (dấu phẩy thập phân, dấu trừ thật).
1. **Nghiêm trọng:** đơn trễ hẹn giao; khách nợ quá hạn; nợ nhà cung cấp quá hạn; có dòng bán dưới giá vốn; lãi gộp âm; tài khoản quỹ âm.
1. **Cần theo dõi:** phải trả NCC đến hạn trong 7 ngày (khi chưa có khoản quá hạn); tỷ suất lãi gộp giảm hơn 5 điểm so kỳ trước; chiết khấu từ 10% giá trị hàng; doanh thu giảm từ 20% so kỳ trước; có khách ngừng mua; hàng dưới tồn tối thiểu; chi vượt thu trong kỳ.
1. Việc chỉ là tiến độ bình thường (đơn chờ sản xuất, đang giao, đơn nhập chờ nhận) **không** là vấn đề; chúng nằm trong thẻ từng mảng.
1. Trạng thái mỗi thẻ lấy theo vấn đề nặng nhất của mảng trong "Cần xử lý"; không có vấn đề thì "Ổn".
1. **Đơn trễ hẹn giao:** ngày cần giao đã qua, chưa kết thúc, chưa Hoàn thành / Huỷ / Trả toàn bộ và còn dòng chưa giao hết.
1. **Hàng dưới tồn tối thiểu:** hàng đang kinh doanh, không phải dịch vụ, tồn tối thiểu > 0 và tổng tồn các kho nhỏ hơn mức đó. **Tồn kho an toàn** = tỷ lệ mặt hàng có tồn tối thiểu mà đủ mức.
1. **Khách ngừng mua:** khách đang theo dõi, từng nhận hàng nhưng lần nhận cuối cách hôm nay hơn 60 ngày.
1. Ngày "hôm nay" tính theo giờ Việt Nam.

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Chờ sản xuất, Đang giao, Trễ hẹn mở danh sách đã lọc (?status=PENDING / SHIPPING, ?late=1); nút Lập đơn hàng. |
| Tồn kho (ATL-05) | Dưới tồn tối thiểu, Tồn kho an toàn, Cơ cấu tồn kho mở /kho/ton-kho (?belowMin=true). |
| Tuổi nợ (ATL-19) | Quá hạn / đến hạn mở Tuổi nợ (phải thu ?loai=phai-thu hoặc phải trả). |
| Báo cáo (ATL-03) | Doanh thu, Lãi gộp, Bán dưới giá vốn, Chiết khấu, Khách ngừng mua (sẵn kỳ 60 ngày) mở đúng báo cáo. |
| Công nợ (ATL-15, ATL-10) | Tổng phải thu / phải trả mở sổ công nợ. |
| Phiếu thu chi (ATL-16) | Thẻ Dòng tiền, quỹ âm, chi vượt thu; nút Lập phiếu thu. |
| Đơn nhập hàng (ATL-09) | Nhập hàng của kỳ, Đơn nhập chờ nhận hàng. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Không có vấn đề nào | "Chưa phát hiện vấn đề nào trong kỳ đang xem."; mọi thẻ ghi Ổn. |
| Kỳ chưa có doanh thu | Biểu đồ hiện trạng thái rỗng; % so sánh ẩn nếu kỳ trước bằng 0. |
| Không có quyền xem lợi nhuận / công nợ / giá trị tồn | Máy chủ không gửi các số đó; thẻ Lợi nhuận chỉ còn chiết khấu, thẻ Công nợ và Cơ cấu tồn kho không hiện, biểu đồ 12 tháng bỏ cột nhập hàng / lãi gộp. |
| Tải số liệu lỗi | Thông báo lỗi ở đầu trang, có thể chọn lại kỳ để tải lại. |

# 7. Ghi chú & giới hạn hiện tại

- Ngưỡng của "Cần theo dõi" (5 điểm, 10%, 20%, 7 ngày, 60 ngày) là giá trị đặt sẵn trong chương trình; sau này nên cho chỉnh trong Thiết lập.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
