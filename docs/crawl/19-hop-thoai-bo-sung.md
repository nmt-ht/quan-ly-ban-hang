# Hộp thoại và form bổ sung (phiên mở rộng)

Bổ sung cho `18-kiem-ke-hop-thoai.md`. Quy tắc: chỉ mở và đọc, huỷ bằng Huỷ hoặc Escape. Không lưu, không xoá, không sửa, không tải file.

## Đã mở và đọc

### Thiết lập
- **Sửa thẻ** (bút chì trên dòng thẻ): tên thẻ, 12 màu, thứ tự hiển thị, checkbox Đang dùng. Nút Huỷ, Lưu.
- **Sửa xe** (nút Sửa trên dòng xe): cùng trường với Thêm xe, đã điền sẵn: biển số, tên gọi, loại xe, tải trọng, tình trạng, hạn đăng kiểm/bảo hiểm (trống), tài xế thường chạy (Nhân viên trong hệ thống, hoặc tên tài xế thuê ngoài), điện thoại, ghi chú. Nút Huỷ, Lưu.
  - Đính chính: trong tài liệu `11-danh-muc-xe.md` và `10-chuyen-giao-hang.md`, cụm "minh" ở cột XE là **tên gọi** của xe, không phải tài xế thường chạy (trường tài xế thường chạy đang trống).
- **Đổi mật khẩu** (menu người dùng › Đổi mật khẩu): trường Mật khẩu hiện tại, Mật khẩu mới (gợi ý độ dài và ký tự), Nhập lại mật khẩu mới. Thông báo: sau khi đổi, bạn sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập lại. Nút Huỷ, Đổi mật khẩu.

### Người dùng
- **Sửa** và **Đặt lại mật khẩu** (biểu tượng bút chì và chìa khoá trên dòng của chính mình): **không mở được** — không có hộp thoại xuất hiện. Có thể app khoá hai thao tác này với tài khoản đang đăng nhập. Chưa kiểm tra được với tài khoản khác vì production chỉ có một người dùng.

### Khách hàng
- **Sửa khách** (`/khach-hang/<id>/sua`): cùng trường với Thêm khách, điền sẵn: loại Sỉ, số ngày nợ 5, điện thoại, các ô giấy tờ, thẻ, đang theo dõi tick. Gợi ý địa chỉ giao hàng vẫn ghi "chưa khai báo được — danh mục Phường/Xã chưa nạp dữ liệu".
- **Lập phiếu thu** (từ trang chi tiết khách, tự chọn khách): có thêm khối **Đối trừ công nợ** với hai chế độ **Tự động (cũ nhất trước)** và **Chọn tay**. Gợi ý: "Mặc định trừ vào khoản nợ cũ nhất trước. Chọn tay khi khách trả cho đúng một chứng từ cụ thể." Khi khách không còn nợ: "Khách hàng này không còn khoản nợ nào. Toàn bộ số tiền sẽ ghi nhận là trả trước." Hiển thị tổng đối trừ và trả trước.
- **Thêm địa chỉ** (trên trang chi tiết khách): bấm không mở được gì. Có thể do cùng nguyên nhân dữ liệu Phường/Xã chưa nạp.

### Nhà cung cấp
- **Lập phiếu chi** (từ menu dòng): mở `/thu-chi/lap/chi?supplierId=<id>` với NCC đã chọn sẵn. Khối đối trừ giống phiếu thu, nhưng câu hướng dẫn nói về nhà cung cấp: "Mặc định trừ vào khoản nợ cũ nhất trước. Chọn tay khi mình trả cho đúng một chứng từ cụ thể." Khi không còn nợ: "Nhà cung cấp này không còn khoản nợ nào. Toàn bộ số tiền sẽ ghi nhận là trả trước."

### Đơn hàng bán
- **Gắn thẻ** (trường Thẻ đánh dấu trên form lập đơn): mở danh sách thẻ, liệt kê thẻ đang dùng (hiện có "234234"), chọn bằng checkbox. Chưa chọn thẻ để tránh thay đổi form.
- **Thêm khách hàng mới** (biểu tượng người cạnh ô Khách hàng): bấm không mở được gì.

## Vẫn chưa mở được

| Hành động | Lý do |
|---|---|
| Nhập hàng hoá (Excel) | Bấm làm treo tab trình duyệt nhiều lần; nghi là hộp chọn file hệ điều hành. Không thử lại. |
| Nhập định mức | Chưa bấm được vì lần thử cùng tab bị treo. |
| Sửa tài khoản tiền | Bấm xong thì tab không chụp được màn hình (treo). Không thử lại. |
| Thẻ: Xoá | Có nút, không bấm để tránh xoá dữ liệu thật. |
| Xe về kho (chuyến), Lưu chi phí chuyến | Là hành động ghi trạng thái/dữ liệu, không bấm. |
| Phiếu soạn hàng, phiếu giao hàng, biên bản đối chiếu | Mở ra là bản in, có thể kích hoạt hộp in của trình duyệt. Không thử. |
| Ngừng theo dõi (khách), Ngừng hợp tác (NCC), Ngừng dùng (tài khoản, loại thu chi) | Là thay đổi trạng thái. Không bấm. |
| Lập lệnh sản xuất | Không tìm được nút trong app (chỉ có lối tắt). |

## Kết luận về độ đầy đủ

Mọi form tạo mới, form sửa, và hộp thoại có thể mở an toàn đã được đọc. Các mục còn lại ở bảng trên không mở được an toàn hoặc cần dữ liệu thật (đa số là hành động thay đổi trạng thái). Muốn hoàn thiện đúng nghĩa đầy đủ, cần staging (phương án A).
