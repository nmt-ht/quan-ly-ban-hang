---
title: Đơn hàng bán
Mã tài liệu: ATL-12
Phân hệ: Bán hàng
Đường dẫn: /don-hang, /don-hang/them-moi, /don-hang/:id, /don-hang/:id/sua
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Chứng từ trung tâm của bán hàng, giao diện kiểu chứng từ MISA: chọn khách, thêm dòng hàng với đơn giá theo bảng giá của khách, khuyến mãi tự áp, chiết khấu theo dòng và cả đơn, thuế GTGT theo dòng; bán trong nước hoặc xuất khẩu (thu bằng ngoại tệ). Từ đơn có thể Lập lệnh sản xuất, Giao hàng tại kho, xếp lên Chuyến giao hàng, nhận hàng khách trả lại và xem trước hoá đơn GTGT. Lập đơn **chưa** trừ kho và **chưa** ghi công nợ.

## Đối tượng sử dụng

- Sale: lập, sửa, huỷ đơn của mình; lập đơn từ báo giá.
- Quản lý: duyệt, lập lệnh sản xuất, cho bán dưới giá tối thiểu / chiết khấu ngoài khuyến mãi.
- Thủ kho / Nhân viên giao hàng: xem đơn để soạn và giao.
- Kế toán: công nợ, nhận hàng trả lại, hoá đơn.

## Quyền liên quan

order.view; order.view_all (xem đơn của mọi người bán — không có thì người bán chỉ thấy và chỉ thao tác đơn mình bán hoặc mình lập); order.create / update / cancel; order.update_price (sửa đơn giá khác bảng giá); order.discount (chiết khấu ngoài khuyến mãi); order.below_min_price (bán dưới giá tối thiểu); order.return (nhận hàng trả lại); debt.adjust (cho qua hạn mức công nợ).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Báo giá (tuỳ chọn) → Lập đơn → Lập lệnh sản xuất (thành phẩm) → Chờ giao hàng
[next]
[flow] Giao tại kho hoặc theo chuyến → Mỗi đợt khách nhận = 1 khoản công nợ → Thu tiền → Trả hàng (nếu có)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Sale | Thêm mới (hoặc "Lập đơn hàng" từ báo giá — ATL-28): chọn khách (điện thoại, địa chỉ giao điền sẵn), người nhận, nguồn đơn, ngày đặt, ngày cần giao, nhân viên bán, loại bán hàng (trong nước / xuất khẩu), thẻ, diễn giải. | Đơn nháp trên form; chưa có số đơn. Hiện "Loại khách · bảng giá" và hạn thanh toán của khách. |
| 2 | Sale | Thêm dòng hàng: hàng (ô chọn xếp theo mã), ĐVT (chính hoặc quy đổi), số lượng, đơn giá, % chiết khấu dòng, thuế GTGT, kho xuất. | Đơn giá theo bảng giá riêng của khách, nếu không theo loại khách và ĐVT; khuyến mãi đang chạy tự điền chiết khấu và dòng hàng tặng (công tắc "Áp khuyến mãi"); mỗi dòng hiện tồn tại kho xuất và "Thiếu …" khi đặt vượt tồn. |
| 3 | Sale | Nhập chiết khấu cả đơn (số tiền), hoặc để khuyến mãi theo đơn tự điền. | Chia về từng dòng theo tỷ lệ giá trị sau chiết khấu dòng; thuế tính trên phần còn lại. |
| 4 | Sale | Đơn xuất khẩu thu bằng ngoại tệ: chọn loại tiền, nhập tỷ giá, nhập đơn giá nguyên tệ. | Đơn giá VND tự quy đổi theo tỷ giá; công nợ và doanh thu ghi bằng VND quy đổi. |
| 5 | Sale | Chọn "Chưa thu tiền" hoặc "Thu tiền ngay" + tài khoản nhận tiền (thanh Thu tiền đầu chứng từ). | Đơn nhớ lựa chọn; chỉ đổi được khi đơn còn sửa được. |
| 6 | Sale | Lưu đơn. | Cấp số DH…; máy chủ kiểm giá tối thiểu, chiết khấu, hạn mức công nợ; trạng thái tự suy ra: Chờ sản xuất nếu có thành phẩm chưa có lệnh, ngược lại Chờ giao hàng. |
| 7 | Sale / Quản lý | Với dòng thành phẩm bấm Lập lệnh sản xuất. | Sinh lệnh Nháp; trạng thái đơn đổi theo tiến độ lệnh (ATL-07). |
| 8 | Thủ kho / Giao hàng | Giao hàng tại kho: chọn ngày khách nhận, số giao lần này từng dòng, kho xuất. Hoặc xếp đơn lên Chuyến giao hàng (ATL-13). | Mỗi lần giao là một **đợt**: phiếu xuất kho (chốt giá vốn), một khoản công nợ phải thu có hạn riêng, doanh thu ghi vào ngày nhận; có "Thu tiền ngay" thì tự lập phiếu thu của đợt. |
| 9 | Sale | Kết thúc đơn khi khách không lấy phần còn lại. | Đơn giữ Giao một phần, không giao thêm; công nợ giữ đúng số khách đã nhận. |
| 10 | Kế toán | Nhận hàng trả lại: ngày trả, lý do, kho, số trả từng dòng (≤ đã nhận − đã trả). | Phiếu TH…; hàng nhập lại kho ("Nhập trả về"); công nợ phải thu và doanh thu giảm vào ngày trả. Huỷ phiếu trả được; tiền đã thu thừa thì hoàn bằng phiếu chi. |
| 11 | Kế toán | Xem trước hoá đơn GTGT: chọn đợt giao; mỗi phiếu trả hàng có bản xem trước hoá đơn điều chỉnh giảm. | Bản xem trước theo mẫu hoá đơn (chưa phát hành, chưa có số, mã cơ quan thuế, chữ ký số); in A4. |
| 12 | Sale | Huỷ đơn (chưa giao, không Đang giao và không nằm trên chuyến chưa về kho), nhập lý do. | Đơn Đã huỷ; lệnh sản xuất chưa hoàn tất của đơn cũng huỷ. |
| 13 | Người dùng | Dùng nút ‹ › ở thanh dưới. | Sang đơn liền trước / liền sau; hiện vị trí "23/26". |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Phân trang trên máy chủ (lúc đăng nhập chỉ nạp đơn còn mở + 90 ngày gần nhất; đơn cũ đọc khi cần). Tìm không dấu theo mã đơn, khách, người nhận, mặt hàng; lọc Trạng thái (kể cả ?status=PENDING / SHIPPING), Nhân viên bán, Người lập, Khách, Thẻ, Giá trị đơn, Kỳ, nút "Trễ hẹn giao" (?late=1); sắp xếp; xuất Excel mọi đơn khớp lọc. Cột: Mã đơn, Ngày đặt, Khách hàng, Mặt hàng, Giá trị đơn, Khách đã nhận, Cần giao, Trạng thái, Nhân viên bán, Thẻ. |
| Đầu chứng từ | Khách, người nhận, điện thoại, địa chỉ giao, nguồn đơn, ngày đặt, ngày cần giao, nhân viên bán, loại bán hàng (+ loại tiền, tỷ giá khi xuất khẩu), số chứng từ, hạn thanh toán, "Loại khách · bảng giá", thẻ, diễn giải; thanh Thu tiền; dòng Tham chiếu. |
| Lưới hàng | Hàng, ĐVT, số lượng, đơn giá (nguyên tệ khi thu ngoại tệ), chiết khấu (nhãn KM khi do khuyến mãi; dòng "Tặng"), thuế, thành tiền, kho xuất, kích thước thành phẩm (Dài × Rộng cm); dưới tên hàng: tồn tại kho xuất theo ĐVT của dòng, "Thiếu …" và tồn ở kho khác. Thanh cảnh báo phía trên đếm số dòng đặt vượt tồn (đơn vẫn lưu được). |
| Tab | Hàng hoá · Lệnh sản xuất · Phiếu xuất kho · Hàng trả · Công nợ · Giá vốn · Nhật ký. |
| Tab Giá vốn | Từng dòng: giá vốn / ĐVT, giá vốn thành tiền, doanh thu thuần, lãi gộp, tỷ suất. Hàng đã giao dùng **giá vốn đã chốt** trên phiếu xuất (như báo cáo Lãi gộp); hàng chưa giao dùng giá vốn bình quân hiện tại. Chỉ hiện với người được xem giá vốn. |
| Hộp thoại Giao hàng | Ngày khách nhận; mỗi dòng: Đặt · Đã giao · Còn lại · Giao lần này · Kho xuất · Tồn tại kho; "Giao đủ tất cả", "Xoá số giao"; ghi chú đợt; giá trị ghi công nợ và hạn thanh toán; "Xác nhận giao hàng". |
| Hộp thoại Nhận hàng trả lại | Ngày trả, lý do, kho; mỗi dòng: Khách đã nhận · Đã trả · Còn trả được · Trả lần này; "Trả tất cả còn lại"; giá trị giảm công nợ. |
| Xem trước hoá đơn | Hoá đơn GTGT song ngữ dựng từ đơn và thông tin công ty, mỗi đợt giao một hoá đơn (ngày lập = ngày giao của đợt, tiền khớp công nợ của đợt); tổng hợp theo thuế suất; đơn ngoại tệ ghi đơn giá, số tiền nguyên tệ, tỷ giá và tổng quy đổi VND; hàng xuất khẩu thuế 0%; mỗi phiếu trả hàng có hoá đơn điều chỉnh giảm (số âm, lý do, đơn gốc). Nhãn "BẢN XEM TRƯỚC". |
| Thanh nút | Theo trạng thái: Sửa, In (A4 / A5 / K80), Lập lệnh sản xuất, Giao hàng, Nhận hàng trả lại, Xem trước hoá đơn, Lập phiếu thu, Kết thúc đơn, Huỷ đơn; ‹ › chuyển đơn. |
| Tham chiếu | Báo giá gốc, chuyến giao, phiếu xuất kho, lệnh sản xuất và phiếu thu của đơn (chứng từ chưa huỷ); bấm để mở. |

# 4. Trạng thái & chuyển trạng thái

Trạng thái tự suy ra từ những gì đã xảy ra: giao hàng trước, rồi sản xuất. Đang giao và Trả toàn bộ đến từ Chuyến giao hàng và được giữ cho tới khi có lần giao tiếp theo.

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Chờ sản xuất | Có dòng thành phẩm chưa có lệnh hoặc lệnh chưa chạy. | Lập lệnh; Sửa; Huỷ |
| Đang sản xuất | Có lệnh đang chạy, hoặc mới hoàn tất một phần. | Chờ giao hàng khi mọi lệnh hoàn tất; Huỷ |
| Chờ giao hàng | Không cần sản xuất hoặc mọi lệnh đã xong; chưa giao gì. | Giao hàng; xếp chuyến; Sửa; Huỷ |
| Đang giao | Đã xuất kho trên chuyến, chờ chốt giao. | Chốt giao ở chuyến |
| Hoàn thành | Đã giao đủ. | Nhận hàng trả lại |
| Giao một phần | Mới giao một phần. | Giao tiếp; Kết thúc đơn; Nhận hàng trả lại |
| Trả toàn bộ | Khách không nhận gì. | — |
| Đã huỷ | Đơn bị huỷ. | — |

# 5. Quy tắc nghiệp vụ

1. **Thành tiền = SL × đơn giá**; trừ chiết khấu dòng; chiết khấu cả đơn chia theo tỷ lệ giá trị từng dòng sau chiết khấu dòng; **thuế GTGT tính trên phần còn lại của từng dòng**. Dòng cuối nhận phần dư làm tròn để tổng khớp.
1. **Đơn giá:** bảng giá riêng của khách đúng ĐVT → giá ĐVT chính của bảng × tỷ lệ → giá lẻ / sỉ / dropship theo loại khách. Người không có quyền sửa đơn giá phải giữ giá đó (máy chủ kiểm). Đơn giá chốt vào dòng khi lưu, không đổi khi bảng giá đổi sau. Tỷ lệ quy đổi luôn lấy từ ĐVT của mặt hàng.
1. **Khuyến mãi** (ATL-30) áp theo ngày chứng từ; dòng hàng tặng có chiết khấu 100% (thành tiền 0) nhưng vẫn xuất kho khi giao. Người không có quyền "Chiết khấu ngoài khuyến mãi" chỉ được chiết khấu dòng, chiết khấu cả đơn và hàng tặng trong mức khuyến mãi đang chạy (hoặc giữ mức của chứng từ đã có — đơn sửa lại, đơn lập từ báo giá); form khoá ô chiết khấu với họ.
1. **Giá tối thiểu:** đơn giá thực thu của dòng (sau chiết khấu dòng và phần chiết khấu cả đơn) không thấp hơn giá bán tối thiểu × tỷ lệ quy đổi; form cảnh báo trước khi lưu; người có quyền "Bán dưới giá tối thiểu" hoặc dòng chứng từ đã có với giá đó được qua.
1. **Hạn mức công nợ:** đơn làm tổng nợ của khách vượt hạn mức bị chặn; người có quyền Điều chỉnh công nợ được "Vẫn lưu đơn (vượt hạn mức)". Báo giá không xét hạn mức.
1. **Lập từ báo giá:** cùng khách, giữ đơn giá báo (kể cả với người không có quyền sửa đơn giá); báo giá chuyển "Đã lập đơn" và nối với đơn.
1. **Xuất khẩu:** đơn có loại bán hàng Xuất khẩu; thu ngoại tệ (USD, EUR, JPY, CNY, KRW, AUD, GBP, SGD, THB) thì nhập đơn giá nguyên tệ, máy chủ quy đổi đơn giá VND theo tỷ giá của đơn.
1. **Kho xuất:** thành phẩm từ Kho thành phẩm; dịch vụ không xuất kho; hàng hoá luôn xuất từ một kho (kho chọn khi giao, không thì kho trên dòng). Đặt vượt tồn chỉ cảnh báo (cộng các dòng cùng hàng cùng kho, kể cả hàng tặng).
1. **Sửa đơn** chỉ khi chưa sản xuất và chưa giao. Sửa đơn còn lệnh Nháp thì cập nhật lệnh theo dòng thành phẩm. Người khác vừa lưu trước thì báo để tải lại.
1. **Huỷ / kết thúc đơn:** huỷ chỉ khi chưa giao gì; kết thúc chỉ khi Giao một phần. Đơn đang nằm trên chuyến chưa về kho (gom đơn / đã xuất kho) không huỷ, không kết thúc được.
1. **Giao hàng theo đợt:** mỗi lần khách nhận (giao tại kho hoặc chốt giao trên chuyến) là một đợt ghi số nhận từng dòng; mỗi đợt một khoản công nợ (DH0000012, DH0000012·2…) với **hạn = ngày nhận + số ngày được nợ của khách**. Doanh thu và công nợ = giá trị khách THỰC NHẬN (đã phân bổ chiết khấu, gồm thuế).
1. **Giao không vượt số còn lại:** số giao lớn hơn số còn phải giao bị từ chối (không tự cắt bớt). Hàng đang trên xe chỉ giao qua chốt giao của chuyến.
1. **Ngày giao** không sau hôm nay, không trước ngày đặt đơn, không thuộc kỳ khoá sổ (giờ Việt Nam).
1. **Thu tiền ngay:** mỗi đợt khách nhận, hệ thống tự lập một phiếu thu đúng phần vừa nhận vào tài khoản đã chọn, trỏ tới đơn và đợt đó; công nợ của đợt về 0. Bỏ chốt giao huỷ đúng phiếu của đợt đó, và không được làm quỹ âm (trừ quyền Chi vượt tồn quỹ). Tài khoản đã ngừng dùng thì không tự lập phiếu.
1. **Trả hàng:** chỉ trả phần khách đã nhận chưa trả; giá trị trả = phần trả của thành tiền dòng (sau chiết khấu, gồm thuế); hàng vào lại kho đúng giá vốn đã xuất; trả hàng khoá dòng đơn khi lưu. Còn phiếu trả hàng chưa huỷ thì không bỏ chốt giao được.
1. **Giá vốn** chốt trên phiếu xuất lúc giao (bình quân gia quyền di động); lãi gộp của đơn không đổi khi giá nhập sau này thay đổi.
1. Người bán không có quyền xem mọi đơn chỉ thấy và chỉ sửa, huỷ, kết thúc, giao, trả hàng, lập lệnh sản xuất trên đơn mình bán hoặc mình lập; Thủ kho và giao hàng thấy mọi đơn để soạn và giao.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | DH + 7 số | Số đơn. |
| customerId, recipientName, recipientPhone, deliveryAddress | Khác | Khách, người nhận, địa chỉ giao. |
| orderDate, neededByDate, source, tagIds, salesRep | Khác | Ngày đặt, ngày cần giao, nguồn, thẻ, người bán. |
| saleType, currency, exchangeRate | enum, chuỗi, số | TRONG_NUOC / XUAT_KHAU; loại tiền và tỷ giá khi thu ngoại tệ. |
| quotationId, promotionId | Mã | Báo giá gốc; khuyến mãi theo đơn. |
| lines[] | Danh sách | productId, unitName, ratioToBase, quantity, unitPrice, unitPriceFx (nguyên tệ), discountRate/Amount, isGift, promotionId, vatRate, warehouseId, receivedQuantity, kích thước. |
| discountAmount, totalGoods, vatAmount, totalOrder | Số (₫) | Chiết khấu cả đơn, tiền hàng, thuế, tổng thanh toán (suy ra từ dòng). |
| deliveries[] | Danh sách | Mỗi đợt giao: ngày, chuyến (nếu có), số nhận từng dòng — nguồn của công nợ và hoá đơn theo đợt. |
| returns[] | Danh sách | Phiếu trả hàng TH…: ngày, lý do, kho, số trả từng dòng, giá trị, đã huỷ. |
| status, closedDate, cancelReason | Khác | Trạng thái, ngày kết thúc, lý do huỷ. |
| payNowAccountId | Mã tài khoản | Tài khoản nhận tiền khi "Thu tiền ngay"; trống = chưa thu tiền. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Lưu đơn | Chưa đổi kho hay công nợ; hàng chiếm vào cột "Khách đã đặt" ở Tồn kho. |
| Giao hàng tại kho | Phiếu xuất kho (chốt giá vốn); công nợ phải thu + một khoản theo số thực nhận; doanh thu vào ngày nhận. |
| Xuất chuyến / chốt giao | Xuất kho khi xuất chuyến; công nợ + khi chốt giao (ATL-13). |
| Giao hàng khi đã chọn Thu tiền ngay | Thêm phiếu thu tự lập cho đợt: quỹ +, công nợ của đợt về 0. |
| Nhận hàng trả lại | Phiếu nhập trả về (tồn +); công nợ phải thu − và doanh thu − vào ngày trả. |
| Huỷ phiếu trả | Đảo phiếu kho; công nợ và doanh thu trở lại. |
| Huỷ đơn | Huỷ lệnh sản xuất chưa xong của đơn (vật tư đã xuất không hoàn lại). |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Khách hàng (ATL-11) | Loại khách, bảng giá, hạn mức, địa chỉ, số ngày được nợ. |
| Báo giá (ATL-28) | Lập đơn từ báo giá, giữ giá báo. |
| Bảng giá (ATL-29), Khuyến mãi (ATL-30) | Nguồn đơn giá và chiết khấu tự áp. |
| Lệnh sản xuất (ATL-07) | Lập từ đơn; trạng thái đơn theo lệnh. |
| Chuyến giao hàng (ATL-13) | Xếp đơn lên xe, chốt giao. |
| Công nợ phải thu (ATL-15), Nhắc nợ (ATL-31) | Khoản phát sinh theo đợt dẫn về /don-hang/:id. |
| Phiếu kho (ATL-06) | Phiếu xuất khi giao; phiếu nhập trả về khi khách trả hàng. |
| Phiếu thu chi (ATL-16) | Phiếu thu tự lập khi Thu tiền ngay; phiếu chi hoàn tiền khách. |
| Thẻ đánh dấu (ATL-21), Báo cáo (ATL-03) | Gắn thẻ; nguồn số liệu doanh thu, lãi gộp, chiết khấu. |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Sửa đơn đã sản xuất / đã giao | Báo không sửa được; gợi ý huỷ lập lại (nếu chưa giao). |
| Giao vượt số còn phải giao | Máy chủ từ chối, báo số còn lại của dòng. |
| Đơn giá dưới giá tối thiểu | Form cảnh báo; máy chủ từ chối với người không có quyền. |
| Chiết khấu vượt khuyến mãi khi không có quyền | Ô chiết khấu bị khoá; máy chủ tính lại và từ chối phần vượt. |
| Vượt hạn mức công nợ | Chặn lưu; người có quyền thấy "Vẫn lưu đơn (vượt hạn mức)". |
| Đặt vượt tồn tại kho xuất | Cảnh báo "Thiếu …" trên dòng và thanh cảnh báo; vẫn lưu được. |
| Huỷ / kết thúc đơn đang nằm trên chuyến chưa về kho | Không cho; xử lý ở chuyến trước. |
| Bỏ chốt giao khi còn phiếu trả hàng | Không cho; huỷ phiếu trả hàng trước. |
| Đơn xuất khẩu thu ngoại tệ thiếu tỷ giá | Không lưu được, báo tại ô tỷ giá. |
| Thu tiền ngay mà tài khoản đã ngừng dùng | Không tự lập phiếu thu; đơn vẫn giao và ghi công nợ bình thường. |
| /don-hang/them | Tự chuyển sang /don-hang/them-moi. |

# 10. Bản in

- Phiếu in: **Đơn hàng bán** (A4, A5 hoặc giấy nhiệt K80, giấy được nhớ theo loại phiếu), dựng bằng khuôn in chung (ATL-26): tiêu đề công ty và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Khối thông tin: khách hàng, người nhận, điện thoại, địa chỉ giao, ngày cần giao, nguồn đơn, diễn giải; bảng: STT, mã hàng, tên hàng (kèm kích thước thành phẩm), ĐVT, số lượng, đơn giá, chiết khấu, thuế, thành tiền; tổng: tiền hàng, chiết khấu dòng, chiết khấu cả đơn, thuế GTGT, tổng thanh toán và "Bằng chữ"; ký: Người lập đơn, Nhân viên bán hàng, Thủ kho, Khách hàng.
- **Xem trước hoá đơn GTGT** / hoá đơn điều chỉnh giảm: in A4, ghi rõ "BẢN XEM TRƯỚC".

# 11. Ghi chú & giới hạn hiện tại

- Trạng thái đơn không sửa tay: luôn suy ra từ giao hàng và sản xuất.
- Hoá đơn điện tử chưa phát hành được (chỉ xem trước): cần chọn nhà cung cấp hoá đơn điện tử và tài khoản API. Chưa có hệ thống tài khoản kế toán như MISA.
- Còn tính trên phần đơn đã nạp (90 ngày + đơn còn mở): tìm nhanh Ctrl K và nút đơn trước / sau.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có tab **Nhật ký**: mọi thao tác trên đơn — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
