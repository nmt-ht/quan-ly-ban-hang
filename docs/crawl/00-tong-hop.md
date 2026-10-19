# Tổng hợp crawl — Ninh Trang (production)

Phạm vi: 18 module, đã crawl toàn bộ phần **cấu trúc, form, bộ lọc, quy tắc và liên kết**. Chưa thể crawl phần **dữ liệu thật** vì production hiện không có đơn, phiếu, lệnh SX hay mặt hàng.

## 1. Danh mục file

| File | Nội dung |
|---|---|
| `00-strategy.md` | Chiến lược, phạm vi, nguyên tắc chỉ đọc |
| `PROGRESS.md` | Bảng tiến độ 18 module |
| `01-tong-quan.md` | Dashboard: thẻ chỉ số, cần chú ý, rò rỉ tiền, công nợ, dòng tiền |
| `02-bao-cao.md` | 21 báo cáo: bộ lọc, định nghĩa, quy tắc |
| `03-ton-kho.md` | Tồn kho và 4 form phiếu kho |
| `04-san-xuat.md` | Lệnh sản xuất |
| `05-nha-cung-cap.md` | Nhà cung cấp: danh sách, form, chi tiết, danh mục hàng |
| `06-don-nhap-hang.md` | Đơn nhập hàng |
| `07-cong-no-phai-tra.md` | Công nợ phải trả |
| `08-khach-hang.md` | Khách hàng: danh sách, form, chi tiết |
| `09-don-hang-ban.md` | Đơn hàng bán: bộ lọc, form lập đơn |
| `10-chuyen-giao-hang.md` | Chuyến giao hàng: danh sách, tạo chuyến, chi tiết |
| `11-danh-muc-xe.md` | Danh mục xe |
| `12-cong-no-phai-thu.md` | Công nợ phải thu và sổ chi tiết |
| `13-phieu-thu-chi.md` | Phiếu thu chi, tài khoản tiền, loại thu chi |
| `14-tuoi-no.md` | Tuổi nợ |
| `15-thiet-lap.md` | Thông tin công ty, thẻ, người dùng, chức vụ & phân quyền |
| `16-toan-cuc.md` | Layout, đăng nhập, định dạng, lỗi ghi nhận |
| `17-hang-hoa.md` | Hàng hoá: danh mục, form |

## 2. Lỗi và mâu thuẫn cần xử lý

| # | Vị trí | Vấn đề |
|---|---|---|
| 1 | Báo cáo Thẻ kho | Hiển thị tiêu đề và ghi chú của "Giá mua biến động" |
| 2 | Trang chủ, thẻ "Đơn chờ xác nhận" | Trỏ tới trạng thái `PENDING`, mà trang đơn bán gọi là "Chờ sản xuất" |
| 3 | Trang chủ, thẻ "Công nợ quá hạn" | Mở Tuổi nợ mặc định là phải trả, không rõ là phải thu hay phải trả |
| 4 | Khách hàng | Form thêm báo chưa khai báo được địa chỉ; trang chi tiết có "Thêm địa chỉ" |
| 5 | Chuyến giao hàng | Ô tài xế nhập tự do; bộ lọc tài xế dùng danh sách người dùng |
| 6 | Phiếu kho | Bộ lọc "Nhập trả về" không có trong menu lập phiếu |
| 7 | Công nợ phải thu | Dấu số tiền phát sinh và còn lại ngược nhau cho cùng phiếu trả trước |
| 8 | Thiết lập › chức vụ | Quyền thêm/sửa/xoá chức vụ tồn tại nhưng không có nút trên giao diện |
| 9 | Báo cáo | Không có báo cáo công nợ phải trả trong menu (chỉ có phía khách) |
| 10 | Đăng nhập | Phiên hết hạn chuyển về trang đăng nhập không có thông báo riêng |

## 3. Khác biệt với bản thiết kế hiện tại (cần sửa khi làm lại)

- **Lệnh sản xuất**: trạng thái thật là Nháp / Đang sản xuất / Hoàn thành / Đã huỷ.
- **Đơn nhập**: trạng thái thật có 6 mức (Nháp, Đã gửi NCC, Nhận một phần, Đã nhận đủ, Hoàn tất, Huỷ).
- **Đơn bán**: 8 trạng thái, thiếu Chờ sản xuất, Đang sản xuất, Chờ giao hàng, Trả toàn bộ trong thiết kế hiện tại.
- **Đơn bán**: giao diện có "Người nhận" và "Số điện thoại người nhận" riêng.
- **ID**: URL dùng chuỗi kiểu cuid, không phải UUID.
- **Chuyến**: có trạng thái "Xe về kho" và khối chi phí riêng (không phải phiếu chi).

## 4. Không thể hoàn thành khi thiếu dữ liệu

- Bảng kết quả của tồn kho, phiếu kho, đơn nhập, đơn bán, lệnh SX, công nợ, tuổi nợ phải thu.
- Trang chi tiết đơn bán, đơn nhập, lệnh SX, phiếu kho.
- Phiếu in: phiếu soạn hàng, phiếu giao hàng, biên bản đối chiếu.
- Luồng trạng thái thật và các hành động theo trạng thái.
- Công thức và số liệu thật của 21 báo cáo.
- Nhập Excel hàng hoá và nhập định mức (thao tác làm treo tab).

## 5. Đề xuất để hoàn thiện

1. **Chọn phương án dữ liệu** (xem `00-strategy.md` mục 2):
   - **A.** Bạn tạo một bản sao hoặc môi trường staging có dữ liệu thử. Mình crawl bản đó với quyền ghi, theo kịch bản đã định.
   - **B.** Bạn tự thao tác một luồng mẫu (khách → đơn bán → lệnh SX → chuyến → chốt giao → phiếu thu). Mình chỉ quan sát và chụp lại từng màn hình.
2. **Nhập Excel và nhập định mức**: bạn tự mở và cho biết cột file mẫu, hoặc gửi file mẫu từ màn hình.
3. **Kiểm tra 10 lỗi ở mục 2** trên một bản sao, vì một số có thể là lỗi dữ liệu thử chứ không phải lỗi giao diện.
4. Sau khi có dữ liệu, cập nhật các file có mục "Chưa xác minh" và chạy lại phần kiểm chứng công thức báo cáo.
