# Toàn cục — giao diện chung, đăng nhập, định dạng

Trạng thái: **xong (cấu trúc)**.

---

## 1. Đăng nhập — `/dang-nhap`

- Tiêu đề: "Ninh Trang" · phụ đề: "Đăng nhập để tiếp tục".
- Trường: **Email \*** · **Mật khẩu \*** · nút **Đăng nhập**.
- Khi chưa đăng nhập, mọi đường dẫn nội bộ đều chuyển về `/dang-nhap`. Sau khi phiên hết hạn, trang cũng quay về đây.
- Đăng nhập thành công: chuyển về **Tổng quan**.

Lưu ý: khi thử đường dẫn sai hoặc phiên hết hạn, giao diện đã quan sát được chuyển hướng về `/dang-nhap`, không có thông báo "phiên hết hạn" riêng. Cần xác minh.

---

## 2. Khung giao diện (layout)

### Thanh bên trái
- Logo chữ "Ninh Trang" (biểu tượng).
- Menu nhóm theo mảng, nhãn nhóm viết hoa, nhỏ, màu xám:
  - (không nhãn): Tổng quan · Báo cáo
  - **NGHIỆP VỤ**: Hàng hoá · Tồn kho · Phiếu kho · Lệnh sản xuất
  - **MUA HÀNG**: Nhà cung cấp · Đơn nhập hàng · Công nợ phải trả
  - **BÁN HÀNG**: Khách hàng · Đơn hàng bán · Chuyến giao hàng · Danh mục xe · Công nợ phải thu
  - **DÒNG TIỀN**: Phiếu thu chi · Tuổi nợ
  - **THIẾT LẬP**: Thông tin công ty · Thẻ đánh dấu · Người dùng · Chức vụ & phân quyền
- Mục đang mở được tô nền đen (màu chữ trắng).
- Mỗi mảng có mũi tên gập/mở. Trạng thái gập được nhớ khi chuyển trang.
- Nút **Thu gọn** ở chân thanh bên: thu thanh bên về biểu tượng.

Mỗi mục trong menu có biểu tượng nhỏ bên trái (ví dụ hộp cho Hàng hoá, biểu đồ cho Báo cáo).

### Thanh trên cùng
- Bên trái: không có nội dung (trống).
- Bên phải:
  - Nút chuyển **giao diện tối / sáng** (biểu tượng mặt trăng khi ở chế độ sáng).
  - Tên người dùng đăng nhập "Quản trị hệ thống" (mở menu).

Menu người dùng (khi bấm tên):
- Tên, email, dòng "Chức vụ: CEO".
- **Đổi mật khẩu**.
- **Đăng xuất**.

### Vùng nội dung
- Tiêu đề trang (h1) + phụ đề mô tả nhỏ bên dưới.
- Nhóm nút hành động bên phải tiêu đề (Xuất Excel, Thêm...).
- Thanh lọc ngay dưới tiêu đề, các ô lọc nằm ngang và xuống dòng khi hẹp.
- Thông tin rỗng: biểu tượng xám + tiêu đề + gợi ý + nút hành động khi có.

---

## 3. Giao diện sáng / tối

- Nút chuyển ở thanh trên cùng.
- Các màu nền, chữ và viền đổi theo chế độ. Nhãn trạng thái giữ màu nhận diện (xanh, đỏ, vàng).
- Chưa thử để so sánh chi tiết màu từng chế độ.

---

## 4. Định dạng chung

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Ngày | dd/mm/yyyy | 03/10/2026 |
| Ngày giờ | dd/mm/yyyy hh:mm | 03/10/2026 11:35 |
| Tiền | số có dấu chấm nghìn, đuôi " ₫" | 10.000.000 ₫ |
| Tiền âm | dấu trừ đầu | −10.000.000 ₫ |
| Số lượng | số nguyên hoặc thập phân | 0 |
| Mã chứng từ | tiền tố + 7 chữ số | PT0000001 · KH0000002 · NCC0000001 · CH0000006 · XE0000001 |
| Mã mặt hàng | tiền tố theo tính chất + 7 chữ số | VT / SP / DV |
| Biển số | tự do, gồm chữ và số | 12A-12345 · 51C-123.45 |
| Điện thoại | số thường | 0912345678 |

Tiền tố mã chứng từ thấy được: PT (phiếu thu), KH, NCC, CH (chuyến), XE. Tiền tố PX chỉ xuất hiện trong bản xem trước tiêu đề phiếu in (mẫu), chưa thấy phiếu kho thật.

---

## 5. Phân trang & bảng

- Mặc định **20 dòng/trang**; có nút Đầu · Trước · Sau · Cuối và "Hiện a–b trong n bản ghi".
- Bảng có thể cuộn ngang khi nhiều cột.
- Mỗi dòng có menu `…` (Xem chi tiết / Sửa / hành động riêng như Lập phiếu thu, Lập phiếu chi).

---

## 6. Hành vi chung khi thao tác

- **Lần bấm đầu tiên sau khi tải trang thường không mở menu/dropdown**; cần bấm lại. Nhiều dropdown cần thêm một lần bấm để mở.
- Nhấn Escape đóng dropdown và hộp thoại (không lưu).
- Hộp thoại có nút Đóng (×) và nút Huỷ.
- Nút Lưu/Tạo xám cho tới khi đủ điều kiện bắt buộc.

---

## 7. Phím tắt và thông báo

- Chưa thấy phím tắt trong giao diện.
- Có khu vực thông báo (region "Notifications") ở cuối trang — dùng cho thông báo toast; chưa thấy nội dung cụ thể.

---

## 8. Lỗi & sự cố ghi nhận trong crawl

1. **Báo cáo Thẻ kho hiển thị sai tiêu đề và ghi chú** (xem `02-bao-cao.md`).
2. **Tab trình duyệt bị treo** khi bấm Tạo chuyến lần đầu (xem `10-chuyen-giao-hang.md`). Mở tab mới thì bình thường.
3. **Đăng nhập lại** bị đòi giữa chừng khi phiên hết hạn (đã thấy trong lần crawl trước).
4. **Trang không tồn tại** hiển thị "Không tìm thấy trang" — "Đường dẫn bạn truy cập không tồn tại." (trang trống, không có khung thanh bên).
5. **Thanh bên và thanh trên không hiện** trên trang lỗi 404 — cần lưu ý khi làm trang lỗi.

---

## 9. Chưa xác minh / cần dữ liệu

- Hành vi khi mạng chậm hoặc mất kết nối (trạng thái tải, thông báo lỗi).
- Giao diện trên điện thoại (chưa thử kích thước màn nhỏ).
- Mục "Đổi mật khẩu" (chưa mở để tránh thay đổi dữ liệu).
- Thông báo toast khi lưu thành công.
