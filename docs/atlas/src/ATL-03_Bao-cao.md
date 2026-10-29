---
title: Báo cáo
Mã tài liệu: ATL-03
Phân hệ: Báo cáo
Đường dẫn: /bao-cao  ·  /bao-cao?name=<slug>
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Trung tâm báo cáo gồm 21 báo cáo chia 8 nhóm. /bao-cao là trang tổng hợp: ô tìm báo cáo, hàng "Hay dùng" (Doanh thu, Lãi gộp, Tồn kho hiện tại, Tuổi nợ, Sổ quỹ), "Xem gần đây" và lưới các nhóm — mỗi nhóm một thẻ mang màu phân hệ, mỗi báo cáo là một dòng bấm được (biểu tượng, tên, mô tả một dòng). Mở một báo cáo thì hiện khung gọn **bốn tầng**: tiêu đề + câu mô tả → hàng tab các báo cáo cùng nhóm → một hàng công cụ (cách nhóm, kỳ, tìm, Xuất Excel) → KPI, biểu đồ, bảng; phần "Cách tính số liệu" gập lại ở cuối. **Cả 21 báo cáo đã chạy.**

## Đối tượng sử dụng

- CEO / Quản lý: toàn bộ.
- Kế toán: báo cáo tài chính, công nợ, thu chi.

## Quyền liên quan

Theo nhóm báo cáo: report.sales (Bán hàng), report.view_profit (Lợi nhuận), report.stock (Kho), report.purchase (Mua hàng), report.production (Sản xuất), report.delivery (Giao hàng), debt.view (Công nợ), report.cashflow (Dòng tiền). Giá trị tồn và giá vốn trong báo cáo Kho cần thêm stock.view_value hoặc product.view_cost_price. Trang tổng hợp chỉ hiện báo cáo chức vụ được xem (nhóm rỗng ẩn); máy chủ cũng chặn khi mở thẳng địa chỉ.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở trang Báo cáo, tìm hoặc chọn báo cáo → Chọn cách nhóm → Chọn kỳ → Xem KPI, biểu đồ, bảng
[next]
[flow] Sắp xếp / tìm trong bảng → Xuất Excel
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Người dùng | Mở Báo cáo từ menu trái (hoặc từ Tổng quan bấm vào ô tương ứng). | Menu → trang tổng hợp. Các dòng và thẻ ở Tổng quan → mở thẳng đúng báo cáo (?name=); Khách ngừng mua mở sẵn kỳ 60 ngày qua để khớp con số trên Tổng quan. Tên báo cáo không hợp lệ thì về trang tổng hợp. |
| 2 | Người dùng | Bấm một thẻ "Hay dùng" / "Xem gần đây", hoặc gõ vào ô "Tìm báo cáo…" (phím "/" để vào ô tìm), hoặc bấm một dòng báo cáo. Đang ở một báo cáo thì bấm tab để sang báo cáo khác cùng nhóm. | Tìm không phân biệt dấu trên tên và mô tả, phần khớp được tô; báo cáo khớp ở tên đứng trước; Enter mở kết quả đầu, Esc xoá ô tìm. |
| 3 | Người dùng | Chọn cách nhóm (ví dụ Theo khách hàng / mặt hàng / nhân viên / nhóm hàng / đơn hàng, tuỳ báo cáo). Thẻ kho thay ô này bằng ô chọn mặt hàng. | Bảng và biểu đồ gộp lại theo cách nhóm. |
| 4 | Người dùng | Chọn kỳ, hoặc nhập khoảng ngày. Mặc định "Tháng này" (Giá mua biến động: "Năm nay"), ngày cuối không vượt quá hôm nay. | Tính lại KPI; báo cáo Doanh thu còn so với kỳ trước cùng độ dài. Báo cáo hiện trạng (Tồn kho, Dưới tồn tối thiểu, Hàng không phát sinh lâu ngày) không có ô kỳ — tính tại thời điểm xem. Dòng "Số liệu từ … đến …" dưới hàng công cụ nói đúng khoảng đang tính. |
| 5 | Người dùng | Bấm tiêu đề cột để sắp xếp (giảm dần → tăng dần → bỏ sắp xếp); gõ vào ô tìm để lọc dòng; bấm tên khách / hàng / đơn để mở trang chi tiết. | Dòng TỔNG CỘNG cộng lại đúng theo các dòng đang hiện khi có tìm kiếm. |
| 6 | Người dùng | Bấm "Hiện thêm 100 dòng" khi danh sách dài. | Bảng hiện 100 dòng mỗi lần; phần đếm "x / y dòng" ở chân bảng. |
| 7 | Người dùng | Xuất Excel. | Tải file theo đúng bảng đang xem (kể cả tìm kiếm và dòng tổng); số được định dạng số, không phải chữ. Doanh thu xuất thêm sheet Sổ chi tiết bán hàng. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Trang tổng hợp | Ô tìm báo cáo có biểu tượng; hàng "Hay dùng" (5 báo cáo dạng thẻ) và "Xem gần đây" (4 báo cáo mở gần nhất, nhớ trong trình duyệt); lưới nhóm đều 1/2/3/4 cột theo bề rộng (4 cột từ màn 1600 px), mỗi nhóm một thẻ màu phân hệ; mỗi báo cáo là một dòng: biểu tượng, tên, mô tả một dòng (đầy đủ ở tooltip), mũi tên. |
| Khung báo cáo | Đường dẫn Báo cáo › Nhóm; tên báo cáo và một câu nói báo cáo trả lời điều gì; dưới đó là **hàng tab các báo cáo cùng nhóm** (cuộn ngang trên điện thoại, tab đang mở tự cuộn vào giữa). Không có danh sách báo cáo thứ hai bên trái — menu trái của hệ thống đã là menu chính. |
| Hàng công cụ | Một hàng: cách nhóm (hoặc ô chọn mặt hàng ở Thẻ kho), chọn kỳ + hai ô ngày, ô tìm trong báo cáo, nút Xuất Excel ở cuối hàng; bên dưới là dòng "Số liệu từ … đến …". |
| Dải KPI | 3–4 ô số liệu tổng (màu xanh/đỏ theo tốt/xấu), có dòng phụ giải thích; dưới 480 px xếp một cột. |
| Biểu đồ | Top 10 dạng thanh ngang của cột chính (lãi âm / lỗ hiện thanh đỏ). Doanh thu theo thời gian: cột theo ngày/tuần/tháng. |
| Bảng | Tiêu đề cố định, sắp xếp được; số căn phải, không xuống dòng; cột tiền âm màu đỏ, dương màu xanh khi cột là lãi/chênh lệch; cột giá mua đảo màu (tăng đỏ, giảm xanh); dòng TỔNG CỘNG ở chân; cuộn ngang trong khung trên điện thoại. |
| Cách tính số liệu | Mục gập ở cuối báo cáo, bấm để mở: định nghĩa số liệu, giả định và giới hạn của báo cáo đó. |
| Báo cáo liên kết (Số dư công nợ, Tuổi nợ) | Không lặp lại bảng: hiện mô tả và nút dẫn tới trang Công nợ phải thu / phải trả hoặc Tuổi nợ đã có. |

# 4. Quy tắc nghiệp vụ

1. **Doanh thu = số khách thực nhận**, đúng bằng số đã vào công nợ phải thu, ghi vào ngày giao. Đơn huỷ và đơn chưa giao không tính.
1. Chiết khấu của đơn phân bổ về từng dòng theo tỷ lệ giá trị. Doanh thu thuần = tiền hàng − chiết khấu; tổng thanh toán = doanh thu thuần + thuế GTGT.
1. Các báo cáo cùng nguồn phải khớp nhau: Doanh thu, Chiết khấu và Lãi gộp toàn bộ lịch sử cùng dựa trên các dòng doanh thu của đơn đã giao; Sổ quỹ khớp Thu chi.
1. Kỳ mặc định là Tháng này (Giá mua biến động: Năm nay — giá cần nhiều lần nhập mới so được); ngày cuối luôn không vượt quá hôm nay; "Toàn bộ" = từ đầu đến hôm nay.
1. **Giá vốn** là bình quân gia quyền di động, **chốt trên từng dòng phiếu xuất** lúc giao: nhập hàng giá khác về sau không làm đổi lãi của đơn đã giao; hàng trả lại tính ngược đúng giá đã xuất. Đơn giao trước khi có giá chốt (dữ liệu cũ) dùng giá vốn bình quân hiện tại.
1. Khi tìm kiếm trong bảng, dòng TỔNG CỘNG tính lại theo các dòng đang hiện; Xuất Excel xuất đúng các dòng đang hiện.
1. Đơn vị thời gian của Doanh thu tự động: tới 31 ngày theo ngày; tới 120 ngày theo tuần (tuần bắt đầu thứ Hai); dài hơn theo tháng. Kỳ so sánh bị ẩn khi chọn "Toàn bộ".
1. Địa chỉ báo cáo dùng slug của hệ thống tham chiếu (?name=slug), không dùng tên hiển thị.
1. Thẻ kho mở thẳng được một mặt hàng bằng ?name=the-kho&sp=<mã nội bộ của mặt hàng>; trang Hàng hoá có liên kết "Xem thẻ kho".

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Dòng chi tiết dẫn tới từng đơn; nguồn số liệu là số thực nhận. |
| Tổng quan (ATL-02) | Các dòng "Cần xử lý" và thẻ Lợi nhuận mở thẳng báo cáo liên quan. |
| Công nợ (ATL-10, ATL-15, ATL-19) | Số dư công nợ và Tuổi nợ dẫn sang các trang Công nợ phải trả / phải thu / Tuổi nợ. |
| Hàng hoá (ATL-04) | Tab Lịch sử của mặt hàng có liên kết mở Thẻ kho của chính mặt hàng đó. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Kỳ không có số liệu | Hiện "Không có số liệu" kèm gợi ý riêng của báo cáo (ví dụ "Chưa có hàng giao trong kỳ này"). |

| Thẻ kho chưa chọn mặt hàng | Hiện "Chọn một mặt hàng" thay cho bảng số liệu. |
| Tìm báo cáo không ra | Trang tổng hợp gợi ý cách gõ (không cần dấu, gõ một phần tên) và hiện các báo cáo hay dùng. |
| Tìm trong bảng không ra dòng | Dòng "Không có dòng nào khớp…" trong bảng. |
| Tên báo cáo trên địa chỉ không đúng | Về trang tổng hợp. |

# 7. Danh mục 21 báo cáo

| Nhóm | Báo cáo | Slug (?name=) | Tình trạng |
|---|---|---|---|
| Bán hàng | Doanh thu | ban-hang | Chạy · Hay dùng |
| Bán hàng | Chiết khấu đã cấp | chiet-khau | Chạy |
| Bán hàng | Khách ngừng mua | khach-ngung-mua | Chạy |
| Lợi nhuận | Lãi gộp | loi-nhuan | Chạy · Hay dùng |
| Lợi nhuận | Hàng bán dưới giá vốn | ban-duoi-gia-von | Chạy |
| Kho | Nhập xuất tồn | nhap-xuat-ton | Chạy |
| Kho | Hàng không phát sinh lâu ngày | hang-nam-im | Chạy |
| Kho | Tồn kho hiện tại | ton-kho | Chạy · Hay dùng |
| Kho | Hàng dưới tồn tối thiểu | duoi-ton-toi-thieu | Chạy |
| Kho | Thẻ kho | the-kho | Chạy |
| Kho | Vòng quay tồn kho | vong-quay-ton-kho | Chạy |
| Mua hàng | Nhập hàng | mua-hang | Chạy |
| Mua hàng | Giá mua biến động | gia-mua | Chạy |
| Sản xuất | Sản xuất | san-xuat | Chạy |
| Giao hàng | Giao hàng | giao-hang | Chạy |
| Giao hàng | Chi phí xe | chi-phi-xe | Chạy |
| Giao hàng | Hiệu quả theo tài xế | tai-xe | Chạy |
| Công nợ | Số dư công nợ | cong-no | Liên kết tới Công nợ phải thu / phải trả |
| Công nợ | Tuổi nợ | tuoi-no | Liên kết tới Tuổi nợ · Hay dùng |
| Dòng tiền | Sổ quỹ | so-quy | Chạy · Hay dùng |
| Dòng tiền | Thu chi | thu-chi | Chạy |

# 8. Định nghĩa các báo cáo

- **Doanh thu:** số khách thực nhận, ghi vào ngày giao; phiếu trả hàng ghi doanh thu âm vào ngày trả; so với kỳ trước cùng độ dài.
- **Chiết khấu đã cấp:** chiết khấu dòng + chiết khấu đơn đã phân bổ về từng dòng; nhóm theo khách, mặt hàng, nhân viên hoặc đơn; kèm tỷ lệ trên tiền hàng.
- **Khách ngừng mua:** khách từng nhận hàng trước ngày bắt đầu kỳ nhưng trong kỳ không nhận hàng lần nào (đơn chưa giao không tính); khách đã ngừng theo dõi không hiện; xếp theo doanh thu cũ giảm dần; "số ngày chưa mua" tính tới cuối kỳ.
- **Lãi gộp:** doanh thu thuần (chưa thuế, đã trừ chiết khấu) trừ giá vốn hàng bán **đã chốt trên phiếu xuất**; dịch vụ giá vốn 0; cột "Dòng giá vốn 0" đếm dòng chưa có giá vốn — lãi gộp của những dòng đó bị thổi lên. Nhóm theo mặt hàng, khách hàng hoặc nhóm hàng.
- **Hàng bán dưới giá vốn:** giá bán thực (doanh thu thuần của dòng ÷ số thực nhận, đã trừ chiết khấu dòng và phần chiết khấu cả đơn) so với giá vốn đã chốt; chỉ dòng có giá vốn > 0; xếp theo mức lỗ giảm dần.
- **Nhập xuất tồn:** tồn đầu, nhập, xuất, tồn cuối theo ĐVT chính; tồn đầu và cuối suy ra từ tồn hiện tại và các chứng từ phát sinh sau; chuyển kho không làm đổi tổng; kiểm kê cộng phần chênh.
- **Tồn kho hiện tại / Dưới tồn tối thiểu:** báo cáo hiện trạng, không có ô ngày; nhóm theo mặt hàng hoặc kho; giá trị tồn = tồn dương × giá vốn bình quân (tồn âm không làm giá trị âm); hàng đã lên xe đã trừ khỏi tồn kho. Dưới tồn tối thiểu kèm tiền cần bù = số thiếu × giá vốn bình quân, xếp theo tiền cần bù.
- **Nhập hàng:** tính trên phiếu nhập kho lập từ đơn nhập, đúng thời điểm hàng về; giá trị = số lượng × đơn giá trên phiếu (chưa thuế GTGT), phiếu chưa ghi giá lấy giá của đơn nhập; phiếu huỷ không tính.
- **Sản xuất:** chỉ lệnh đã Hoàn tất, theo ngày hoàn tất; chi phí vật tư = giá vốn đã chốt trên phiếu xuất vật tư của lệnh (lệnh cũ chưa có giá chốt thì ước tính theo định mức × giá vốn hiện tại); giá thành chia cho số thực nhập kho nên hàng hỏng làm tăng giá thành; hao hụt % = (số lệnh − thực nhập) ÷ số lệnh.
- **Chi phí xe:** theo chi phí ghi trên chuyến giao (không phải sổ quỹ), bỏ chuyến huỷ; nhóm theo xe hoặc tài xế.
- **Số dư công nợ / Tuổi nợ:** toàn bộ lịch sử, không phụ thuộc kỳ; đối tác đã tất toán không hiện (xem trang Công nợ).
- **Sổ quỹ:** từng tài khoản tiền: tồn đầu kỳ, thu, chi, tồn cuối kỳ; **Thu chi:** thu, chi, ròng (thu − chi) theo nhóm thu chi, tài khoản hoặc đối tác; phiếu huỷ không tính.
- **Hàng không phát sinh lâu ngày:** mặt hàng còn tồn dương (không gồm dịch vụ) mà từ chứng từ kho gần nhất (nhập, xuất hoặc kiểm kê) đến hôm nay đã qua ít nhất 60 / 90 / 180 / 365 ngày (chọn ở ô cách nhóm); chuyển kho không tính là phát sinh; mặt hàng chưa từng có chứng từ đứng đầu; giá trị tồn = tồn × giá vốn bình quân. Báo cáo hiện trạng, không có ô kỳ.
- **Thẻ kho:** sổ nhập xuất của một mặt hàng theo từng chứng từ trong kỳ, cộng mọi kho, quy về ĐVT chính: tồn đầu kỳ, từng dòng Nhập / Xuất, tồn sau mỗi chứng từ, tồn cuối kỳ. Chuyển kho không đổi tổng nên không hiện; kiểm kê thừa ghi Nhập, thiếu ghi Xuất; phiếu huỷ không tính.
- **Vòng quay tồn kho:** xuất trong kỳ (giao khách và xuất vật tư cho sản xuất), xuất / ngày, số ngày tồn = tồn cuối kỳ ÷ xuất / ngày, vòng quay = xuất ÷ tồn bình quân đầu – cuối kỳ; mặt hàng không xuất hiện "—"; mặt hàng quay chậm nhất lên đầu; KPI số ngày tồn toàn kho tính theo giá trị (giá vốn bình quân).
- **Giá mua biến động:** đơn giá mua chưa thuế GTGT, quy về ĐVT chính, của từng dòng phiếu nhập kho lập từ đơn nhập (phiếu chưa ghi giá lấy giá của đơn nhập). Theo mặt hàng: giá lần đầu, gần nhất, thấp nhất, cao nhất, bình quân theo số lượng, thay đổi (gần nhất so lần đầu) và biên độ = (cao − thấp) ÷ thấp; hoặc xem từng lần nhập. Tăng giá tô đỏ, giảm tô xanh.
- **Giao hàng:** chỉ đơn đã chốt giao trên chuyến, theo ngày của chuyến, chuyến huỷ không tính; giao đủ / giao một phần / khách không nhận; tỷ lệ giao thành công = giá trị khách nhận ÷ giá trị xuất của các đơn đã chốt; đơn chưa chốt hiện ở cột "Chưa chốt". Nhóm theo chuyến hoặc khách hàng.
- **Hiệu quả theo tài xế:** cùng nguồn với Giao hàng, gộp theo tên tài xế trên chuyến: tỷ lệ lấy đủ = số đơn khách nhận đủ ÷ số đơn đã chốt; hàng mang về = giá trị xuất − giá trị khách nhận, xếp từ nhiều đến ít.

# 9. Ghi chú & giới hạn hiện tại

- Cấu trúc code: mỗi báo cáo là một khai báo ở giao diện (tên, nhóm, mô tả, cách nhóm, ghi chú) và một hàm tính cùng slug ở máy chủ (backend/src/modules/reports/defs); một khung dùng chung vẽ hàng công cụ, KPI, biểu đồ, bảng, sắp xếp, tìm kiếm, phân trang và Xuất Excel. Thêm báo cáo mới chỉ cần thêm hai khai báo đó.
- Quyền theo nhóm báo cáo được áp ở giao diện và máy chủ; giá vốn và giá trị tồn chỉ gửi cho chức vụ có quyền xem (product.view_cost_price / stock.view_value); giá nhập chỉ gửi cho chức vụ mua hàng, định giá hoặc xem công nợ.
- Ngày "hôm nay" và ngày ghi nhận của chứng từ tính theo giờ Việt Nam.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
