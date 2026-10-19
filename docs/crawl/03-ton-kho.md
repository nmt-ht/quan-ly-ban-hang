# Tồn kho & Phiếu kho

Trạng thái: **xong (cấu trúc)**. Production không có dữ liệu tồn hay phiếu nên chưa đọc được bảng kết quả, dòng chi tiết, hay luồng trạng thái thực tế.

---

## 1. Tồn kho — `/kho/ton-kho`

### Mục đích
Xem tồn hiện tại theo mặt hàng và kho. Tồn phát sinh từ phiếu nhập và phiếu kiểm kê.

### Tiêu đề & đếm
- Tiêu đề: "Tồn kho"
- Phụ đề: "N mặt hàng · đang ẩn mặt hàng tồn 0" (đếm mặt hàng có tồn và số mặt hàng đang bị ẩn vì tồn 0)

### Hành động
- **Xuất Excel** (chưa thử — cần xin phép)

### Bộ lọc & sắp xếp
- Ô tìm kiếm: nhập mã, mã đối chiếu hoặc tên.
- **Tất cả kho** (dropdown): Tất cả kho · Kho Ninh Trang · Kho phụ kiện · Kho thành phẩm · Kho vật tư hàng hoá.
- Nút bật/tắt nhanh: **Đang tồn âm** · **Dưới tồn tối thiểu** · **Hiện cả tồn 0**.
- Sắp xếp (dropdown): **Tên A → Z** (mặc định) · Mã tăng dần · Tồn nhiều → ít · Tồn ít → nhiều.

### Trạng thái rỗng (nguyên văn)
- "Chưa có tồn kho"
- "Tồn kho phát sinh từ phiếu nhập, phiếu kiểm kê. Lập phiếu để bắt đầu."

### Cột bảng
Chưa thấy vì bảng rỗng. Cần dữ liệu để đọc.

### Quy tắc (từ giao diện và báo cáo liên quan)
- Tồn luôn quy về ĐVT chính (xem báo cáo Nhập xuất tồn).
- Hiện "đang ẩn mặt hàng tồn 0" — mặc định ẩn các mặt hàng tồn bằng 0; có nút "Hiện cả tồn 0" để bật.

---

## 2. Phiếu kho — `/kho/phieu`

### Mục đích
Danh sách và lập chứng từ kho: nhập, xuất, chuyển, kiểm kê.

### Tiêu đề & đếm
- Tiêu đề: "Phiếu kho"; phụ đề: "N phiếu".

### Hành động trên trang danh sách
- **Xuất Excel** (chưa thử).
- **Lập phiếu** (dropdown) — 4 lựa chọn:
  1. Phiếu nhập kho → `/kho/phieu/lap/in`
  2. Phiếu xuất kho → `/kho/phieu/lap/out`
  3. Phiếu chuyển kho → `/kho/phieu/lap/transfer`
  4. Phiếu kiểm kê → `/kho/phieu/lap/adjust`

### Bộ lọc
- Ô tìm: mã phiếu, lý do, hoặc hàng hoá trong phiếu.
- **Loại phiếu** (chọn nhiều — checkbox): Nhập kho · Xuất kho · Chuyển kho · Kiểm kê · **Nhập trả về**.
- **Tất cả kho**: Tất cả kho · Kho Ninh Trang · Kho phụ kiện · Kho thành phẩm · Kho vật tư hàng hoá.
- **Chọn kỳ**: dropdown preset (chưa mở các lựa chọn).
- **Từ ngày / Đến ngày**: ô dd/mm/yyyy.
- **Người lập**: dropdown người tạo phiếu.

### Trạng thái rỗng (nguyên văn)
- "Chưa có phiếu kho nào"
- "Lập phiếu nhập, xuất, chuyển kho hoặc kiểm kê để bắt đầu."

### Lưu ý
- **"Nhập trả về"** có trong bộ lọc loại phiếu nhưng không có trong menu Lập phiếu. Khả năng cao phiếu này sinh ra khi nhận hàng trả về từ chuyến giao (quyền `trip.return`). Cần xác minh ở module Chuyến giao hàng.

---

## 3. Form lập phiếu

Chung cho cả 4 loại:
- Ngày chứng từ \* — mặc định là ngày hôm nay (dd/mm/yyyy).
- Lý do — text, tuỳ chọn.
- **Khối hàng hoá** — lặp được, có nút **Thêm dòng** và nút xoá từng dòng.
  - Hàng hoá \* — dropdown tìm/chọn hàng hoá.
  - Đơn vị — tự điền theo hàng, chỉ đọc.
  - Ghi chú — text ở dòng (chỉ có ở Xuất, Chuyển, Kiểm kê).
- Ghi chú phiếu — text tuỳ chọn, cuối form.
- Nút chân trang: **Huỷ** · **Lưu phiếu** (xám, chưa bật khi chưa đủ điều kiện).
- Dòng trạng thái chân form: "Thêm ít nhất một dòng hàng" — là điều kiện để lưu.
- Dòng phụ đề khối hàng: "0 dòng hợp lệ · chọn kho để thấy tồn hiện tại" — **hiển thị tồn hiện tại sau khi chọn kho**.

### 3.1 Phiếu nhập kho — `/kho/phieu/lap/in`
- Tiêu đề: "Lập phiếu nhập kho"
- Trường riêng:
  - **Kho nhập \*** — dropdown kho (bắt buộc).
  - Lý do — placeholder: "VD: Nhập hàng trả lại, nhập thành phẩm từ xưởng".
- Dòng hàng:
  - Hàng hoá \*
  - **Số lượng nhập \*** — mặc định 0.
  - Đơn vị — chỉ đọc.
  - **Đơn giá nhập** — mặc định 0. Trường giá nhập có thể bị ẩn nếu người dùng không có quyền `stock.import_price` (xem phân quyền Thủ kho: "KHÔNG thấy giá nhập") — cần kiểm chứng.
- Không có ô "Đơn giá" ở phiếu nhập trước khi có quyền xem; hiện tại đang hiển thị với tài khoản CEO.

### 3.2 Phiếu xuất kho — `/kho/phieu/lap/out`
- Tiêu đề: "Lập phiếu xuất kho"
- Trường riêng:
  - **Kho xuất \*** — dropdown.
  - Lý do — placeholder: "VD: Xuất huỷ hàng lỗi, xuất dùng nội bộ".
- Ghi chú quan trọng (hiển thị ngay dưới trường Lý do): **"Phiếu xuất kho không có tiền và không sinh công nợ — chỉ ghi nhận hàng rời kho."**
- Dòng hàng:
  - Hàng hoá \*
  - **Số lượng xuất \*** — mặc định 0.
  - Đơn vị — chỉ đọc.
  - Ghi chú — text.
- Không có đơn giá (khác với phiếu nhập).

### 3.3 Phiếu chuyển kho — `/kho/phieu/lap/transfer`
- Tiêu đề: "Lập phiếu chuyển kho"
- Trường riêng:
  - **Kho xuất \*** và **Kho nhận \*** — hai dropdown kho, bắt buộc, phải khác nhau (chưa kiểm chứng ràng buộc này).
  - Lý do — placeholder: "VD: Điều chuyển hàng giữa hai kho".
- Dòng hàng:
  - Hàng hoá \*
  - **Số lượng chuyển \*** — mặc định 0.
  - Đơn vị — chỉ đọc.
  - Ghi chú — text.
- Không có đơn giá.

### 3.4 Phiếu kiểm kê — `/kho/phieu/lap/adjust`
- Tiêu đề: "Lập phiếu kiểm kê"
- Trường riêng:
  - **Kho kiểm kê \*** — dropdown.
  - Lý do — placeholder: "VD: Kiểm kê định kỳ tháng 9, nhập tồn đầu kỳ".
- Ghi chú quan trọng (hiển thị dưới trường Lý do):
  > "Nhập số thực đếm được, không phải chênh lệch. Hệ thống tự đối chiếu với tồn sổ sách tại thời điểm lưu và ghi phần chênh lệch — nên chạy lại phiếu với cùng con số là vô hại."
- Dòng hàng:
  - Hàng hoá \*
  - **Số thực đếm \*** — mặc định 0. (Đây là số đếm thực tế, không phải chênh lệch.)
  - Đơn vị — chỉ đọc.
  - Ghi chú — text.

---

## 4. Quy tắc nghiệp vụ tổng hợp (từ giao diện)

1. **Phiếu nhập và kiểm kê ghi tồn theo kho**; phiếu xuất không sinh công nợ và không có tiền.
2. **Kiểm kê là idempotent**: nhập lại cùng số đếm không làm sai lệch, vì hệ thống tính chênh lệch tại thời điểm lưu so với sổ sách.
3. **Đơn vị tính theo hàng**: mỗi dòng hiển thị ĐVT của mặt hàng; số lượng nhập theo đúng ĐVT dòng (theo ghi chú ở form bán hàng, cần đối chiếu).
4. **Phiếu nhập** có trường đơn giá; phiếu xuất và chuyển thì không.
5. **Chỉ lưu được khi có ít nhất 1 dòng hợp lệ** (nút Lưu phiếu xám khi chưa đủ).

---

## 5. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị trong module này.
- Cần xác minh: "Nhập trả về" không có trong menu lập phiếu — xem mục 2.
- Cần xác minh: ràng buộc kho nhận khác kho xuất trong phiếu chuyển.
- Cần xác minh: cột đơn giá của phiếu nhập có ẩn theo quyền không.

---

## 6. Chưa xác minh / cần dữ liệu

- Bảng kết quả Tồn kho (cột, định dạng số âm, hiển thị "Đang đi đường").
- Bảng danh sách phiếu kho (cột, trạng thái nếu có, hành động dòng: xem, in, huỷ).
- Trang chi tiết phiếu kho và phiếu in.
- Thẻ kho (drill-down từ tồn kho) — xem báo cáo.
- Hành vi "Đang đi đường" khi chuyến giao chưa chốt.
- Dropdown preset "Chọn kỳ" và danh sách "Người lập".
- Thông báo lỗi validation khi lưu (cần thử, không lưu được khi chưa đủ dòng).
