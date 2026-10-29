---
title: Phiếu in (khuôn in chung)
Mã tài liệu: ATL-26
Phân hệ: Hệ thống
Đường dẫn: Nút In ở các màn hình chứng từ và báo cáo
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Một khuôn in duy nhất cho toàn hệ thống để mọi phiếu in gọn gàng, chuyên nghiệp và giống nhau: cùng tiêu đề công ty, cùng cách trình bày bảng, tổng tiền, khối chữ ký và chân trang. In được trên ba loại giấy: A4, A5 và cuộn giấy nhiệt K80. Màn hình chỉ cung cấp nội dung; không tự định kiểu giấy.

## Đối tượng sử dụng

- Mọi người dùng bấm nút In.

## Quyền liên quan

Theo quyền của chức năng chứa phiếu (xem ATL-23).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở chứng từ / báo cáo → Bấm In (hoặc mũi tên chọn A4 · A5 · K80) → Trình duyệt hiện bản in → In hoặc lưu PDF
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Người dùng | Bấm In trên phiếu kho, phiếu thu chi, đơn bán, báo giá, đơn nhập, chuyến giao hàng, công nợ, tuổi nợ hoặc xem trước hoá đơn. Nút In in ngay trên giấy dùng lần trước cho loại phiếu đó; mũi tên bên cạnh mở lựa chọn giấy. | Hệ thống ẩn menu, thanh trên và các nút; chỉ in phần phiếu. Giấy đã chọn được nhớ theo loại phiếu trong trình duyệt. |
| 2 | Hệ thống | Dựng phiếu theo khuôn: tiêu đề công ty, số phiếu, tiêu đề, thông tin, bảng, khối ký, chân trang. | Giấy luôn nền trắng chữ đen, kể cả khi màn hình đang ở giao diện tối. |
| 3 | Người dùng | Chọn máy in hoặc "Lưu thành PDF". | Số trang hiện ở chân trang dạng "Trang x / y". |

# 3. Quy tắc nghiệp vụ

1. Khổ A4 dọc, lề 14 / 12 / 16 / 16 mm; bảng nhiều cột (tuổi nợ) dùng A4 ngang. A5 dùng cùng bố cục thu nhỏ; K80 (cuộn nhiệt 80 mm) xếp một cột, bỏ bớt cột phụ.
1. **Giấy theo loại phiếu:** đơn hàng bán, báo giá, phiếu giao hàng, phiếu thu / chi, phiếu kho: A4 · A5 · K80; đơn nhập hàng, phiếu soạn hàng: A4 · A5; báo cáo, biên bản đối chiếu, thông báo công nợ, hoá đơn xem trước: A4.
1. Thông tin công ty và logo lấy từ Thiết lập › Thông tin công ty (ATL-20); đổi ở đó thì mọi phiếu đổi theo.
1. Phiếu đã huỷ luôn in dấu "ĐÃ HUỶ" cạnh số phiếu.
1. Muốn thêm phiếu in mới chỉ cần dùng khuôn chung, không viết lại kiểu in.

# 4. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Thông tin công ty (ATL-20) | Nguồn của tiêu đề và logo. |
| Các chức năng có nút In | Phiếu kho, thu chi, đơn bán, đơn nhập, chuyến giao hàng, công nợ, tuổi nợ. |

# 5. Cấu trúc một phiếu

| Khối | Nội dung |
|---|---|
| Tiêu đề công ty | Logo (nếu có), tên công ty in hoa, các dòng có nhãn: Địa chỉ, Mã số thuế, Điện thoại, Email, Website (mục nào trống thì bỏ). Bên phải: "Số: …" và dấu "ĐÃ HUỶ" nếu có. Dưới cùng là đường kẻ đậm. |
| Tiêu đề phiếu | Căn giữa, in hoa, cỡ lớn; dưới là "Ngày … tháng … năm …" hoặc dòng phụ (kỳ đối chiếu, "Tính đến ngày …"). |
| Khối thông tin | Khung hai cột nhãn – giá trị (kho, lý do, khách hàng, địa chỉ…) hoặc dạng điền thông tin có dòng chấm (phiếu thu / chi). |
| Bảng | Cột STT đầu tiên, tiêu đề tô nền nhạt, số căn phải, dòng tổng cộng tô nền; tiêu đề lặp lại khi bảng sang trang mới, dòng không bị cắt đôi giữa hai trang. |
| Tổng tiền | Tiền hàng, chiết khấu, thuế GTGT, Tổng thanh toán (dòng kẻ đôi) và "Bằng chữ". |
| Khối chữ ký | 2–5 cột theo loại phiếu, kèm "(Ký, họ tên)"; tên người lập in dưới chỗ ký. |
| Chân trang | "In lúc dd/mm/yyyy hh:mm · tên người in" và tên công ty; số trang "Trang x / y". |

# 6. Các phiếu đang dùng khuôn này

| Phiếu | Màn hình | Ghi chú |
|---|---|---|
| Phiếu nhập / xuất / chuyển kho, kiểm kê | Phiếu kho (ATL-06) | 4 loại, khối ký riêng từng loại. |
| Phiếu thu, Phiếu chi | Phiếu thu chi (ATL-16) | Dạng điền thông tin, 5 chữ ký. |
| Đơn hàng bán | Đơn hàng bán (ATL-12) | Có chiết khấu, thuế, bằng chữ. |
| Báo giá | Báo giá (ATL-28) | "Kính gửi" khách, hiệu lực đến, chiết khấu, thuế, bằng chữ. |
| Hoá đơn GTGT (xem trước), hoá đơn điều chỉnh giảm | Đơn hàng bán (ATL-12) | Mỗi đợt giao một hoá đơn; nhãn "BẢN XEM TRƯỚC". |
| Đơn nhập hàng | Đơn nhập hàng (ATL-09) | Có thuế, bằng chữ. |
| Phiếu soạn hàng, Phiếu giao hàng | Chuyến giao hàng (ATL-13) | Mỗi đơn một phiếu giao, một trang. |
| Biên bản đối chiếu công nợ | Công nợ phải thu / phải trả (ATL-15, ATL-10) | Bên A / Bên B, ký đóng dấu. |
| Thông báo công nợ | Công nợ phải thu (ATL-15), Nhắc nợ (ATL-31) | Chứng từ còn nợ, số cần thanh toán, mã VietQR. |
| Báo cáo tuổi nợ | Tuổi nợ (ATL-19) | Khổ A4 ngang. |

# 7. Ghi chú & giới hạn hiện tại

- Mọi phiếu in đều là một khuôn chung; thêm phiếu mới chỉ cần khai nội dung và loại giấy được phép.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
