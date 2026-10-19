# Đơn hàng bán — `/don-hang`

Trạng thái: **xong (cấu trúc)**. Module lớn nhất. Production chưa có đơn bán nào, nên **chưa đọc được** bảng kết quả, trang chi tiết đơn, phiếu in, và các bước chuyển trạng thái thật. Các phần đó đánh dấu "chưa xác minh" và cần phương án A hoặc B.

---

## 1. Danh sách — `/don-hang`

### Tiêu đề & đếm
- Tiêu đề: "Đơn hàng bán"; phụ đề: "N đơn".

### Hành động
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Lập đơn hàng | Mở `/don-hang/them-moi` |

### Bộ lọc (thanh trên cùng)
1. Ô tìm: "Tìm mã đơn, khách hàng, người nhận, mặt hàng…".
2. **Trạng thái** (dropdown chọn nhiều, có ô tìm "Tìm…") — 8 trạng thái:
   - Chờ sản xuất
   - Đang sản xuất
   - Chờ giao hàng
   - Đang giao
   - Hoàn thành
   - Giao một phần
   - Trả toàn bộ
   - Đã huỷ
3. **Thẻ** (dropdown thẻ đánh dấu).
4. **Chọn kỳ** (preset dùng chung: Hôm nay · Hôm qua · 7/30 ngày qua · Tuần/Tháng/Quý/Năm này và trước · Toàn bộ) + ô **dd/mm/yyyy → dd/mm/yyyy**.
5. **Nhân viên bán** (dropdown — người chốt đơn).
6. **Người lập** (dropdown — người tạo đơn).
7. **Giá trị đơn** (khoảng Từ – Đến, đơn vị ₫).
8. **Sắp xếp**: Mới nhất (mặc định) · Cũ nhất · Giá trị cao nhất · Mã tăng dần.

Đường dẫn có tham số: từ Trang chủ, nút "Cần chú ý ngay" dẫn tới `/don-hang?status=PENDING` và `/don-hang?status=SHIPPING`. Từ Lệnh sản xuất, nút "Đơn chờ sản xuất" dẫn tới `/don-hang?status=PENDING`.

### Trạng thái rỗng (nguyên văn)
- "Chưa có đơn hàng nào"
- "Lập đơn để bắt đầu bán hàng. Công nợ phải thu chỉ ghi khi khách thực nhận hàng."

Khi bộ lọc không có kết quả: "Không tìm thấy đơn nào" — "Thử bỏ bớt bộ lọc hoặc mở rộng khoảng ngày." — nút **Xoá tất cả bộ lọc**. Các bộ lọc đang áp dụng hiện thành chip (ví dụ "Chờ sản xuất ×") có nút "Xoá tất cả bộ lọc".

### Cột bảng
Chưa thấy vì bảng rỗng — cần dữ liệu.

---

## 2. Form lập đơn — `/don-hang/them-moi`

Tiêu đề: "Lập đơn hàng".

### Thông tin chung (bên trái)
| Nhãn | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| Khách hàng | dropdown tìm | **có** (\*) | Mỗi dòng gợi ý: mã · tên · điện thoại · badge số ngày nợ (ví dụ "trả ngay", "5 ngày"). Nút bên phải: thêm khách mới (icon người). |
| Người nhận | text | — | Placeholder: "Để trống thì lấy tên khách" |
| Điện thoại (người nhận) | text | — | Placeholder: "Điện thoại — 0912345678" |
| Diễn giải | text | — | Placeholder: "Ghi chú chung cho cả đơn" |
| Nguồn đơn | text | — | Placeholder: "VD: Zalo, Facebook, khách quen" |
| Thẻ đánh dấu | nút "Gắn thẻ" | — | Chọn thẻ từ danh mục |

### Chứng từ (bên phải)
| Nhãn | Ghi chú |
|---|---|
| Ngày đặt | Mặc định hôm nay (dd/mm/yyyy) |
| Ngày cần giao | Tuỳ chọn |
| Số chứng từ | Hiển thị "Cấp khi lưu" — số tự cấp khi lưu |

### Dòng hàng
- Gợi ý ở góc khối: "Chọn khách hàng trước — đơn giá phụ thuộc loại khách (sỉ / lẻ / dropship)."
- Bảng dòng: **TÊN HÀNG · ĐVT · SỐ LƯỢNG · ĐƠN GIÁ · THÀNH TIỀN · GHI CHÚ** và nút xoá dòng.
  - TÊN HÀNG: dropdown "Chọn hàng hoá".
  - ĐVT: tự điền, chỉ đọc.
  - SỐ LƯỢNG: gõ theo đúng ĐVT của dòng.
  - ĐƠN GIÁ: tự áp theo loại khách; **sửa tay được**; giá được chốt vào dòng khi lưu.
  - THÀNH TIỀN: tự tính.
- Nút **+ Bấm vào đây để thêm dòng mới**.
- Dòng tổng: "Số dòng = N" và tổng tiền hàng.
- Gợi ý quan trọng ngay dưới bảng:
  > "Mọi dòng gõ ở cột Số lượng, theo đúng ĐVT của dòng. Bảng tự thêm cột khi cần: chọn hàng bán theo đơn vị quy đổi (Bó, Cây) thì hiện Quy đổi / Tổng SL, chọn thành phẩm cắt theo cỡ thì hiện Dài × Rộng."

### Chiết khấu & tổng
- **Chiết khấu (đồng)** — số tiền. Gợi ý: "Khách lấy một phần thì chiết khấu chia theo tỷ lệ giá trị hàng thực nhận."
- Chân trang: **Hàng: N ₫** · **Tổng đơn: N ₫** · nút **Huỷ** · nút **Lập đơn hàng** (xám tới khi đủ điều kiện).

### Cột/ô động (quan sát từ gợi ý, chưa thấy trực tiếp)
- Khi chọn hàng bán theo **đơn vị quy đổi** (Bó, Cây): thêm cột **Quy đổi** và **Tổng SL**.
- Khi chọn **thành phẩm cắt theo cỡ**: thêm cột **Dài × Rộng**.
- Cần thử với một hàng có đơn vị quy đổi để xác nhận. Không có hàng nào trong production nên chưa thử được.

---

## 3. Quy tắc nghiệp vụ (từ giao diện và báo cáo)

1. **Lập đơn không ghi công nợ.** Công nợ phải thu chỉ ghi khi khách THỰC NHẬN hàng (đúng thông điệp trên trang rỗng và báo cáo Doanh thu).
2. **Doanh thu và công nợ đúng bằng số khách thực nhận**. Khi khách lấy một phần, chiết khấu chia theo tỷ lệ giá trị hàng thực nhận.
3. **Giá theo loại khách** (Lẻ / Sỉ / Dropship), có thể sửa tay trên từng dòng. Giá được chốt vào dòng đơn khi lưu, không tự đổi khi giá sản phẩm đổi sau.
4. **Số lượng nhập theo ĐVT của dòng** (đơn vị bán), không phải đơn vị chính. Tồn kho luôn quy về ĐVT chính (xem báo cáo Nhập xuất tồn).
5. **Hàng cắt theo cỡ** (thành phẩm) nhập Dài × Rộng trên dòng.
6. **Hạn thanh toán** = ngày khách nhận + số ngày nợ của khách (module Khách hàng).
7. **Trạng thái đơn** đi qua: Chờ sản xuất → Đang sản xuất (khi có lệnh SX) → Chờ giao hàng → Đang giao → Hoàn thành / Giao một phần / Trả toàn bộ; có nhánh Đã huỷ.
8. **Lập lệnh sản xuất** từ đơn có thành phẩm (mô tả ở module Lệnh sản xuất) — **nút này chưa thấy trên form hay danh sách; cần xác minh trên đơn thật**.
9. **Đơn chờ sản xuất** là đơn ở trạng thái Chờ sản xuất (lối tắt từ module Lệnh sản xuất).
10. Đơn có thể gắn **thẻ đánh dấu** dùng chung với khách hàng.

---

## 4. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị trên danh sách và form.
- Cần xác minh: sau khi khách thực nhận một phần, trạng thái "Giao một phần" và cách tính công nợ tương ứng.
- Cần xác minh: "Nhân viên bán" có tự điền theo người đăng nhập không (form không có ô này, chỉ có bộ lọc).
- Cần xác minh: Số chứng từ có dùng cùng chuỗi với phiếu kho / chuyến giao không.

---

## 5. Chưa xác minh / cần dữ liệu

- Bảng danh sách đơn: các cột, trạng thái hiển thị bằng màu/nhãn, hành động dòng.
- Trang chi tiết đơn: tab, bảng dòng hàng, lịch sử trạng thái, người thực hiện.
- Các hành động theo trạng thái: sửa, huỷ, lập lệnh SX, xuất kho cho chuyến, chốt giao, trả hàng.
- Phiếu in đơn (có nút in?) và mẫu in.
- Ô/cột "Quy đổi", "Tổng SL", "Dài × Rộng" thực tế.
- Thông báo lỗi khi lưu thiếu khách / hàng / số lượng.
- Điều kiện hiện nút "Lập đơn hàng" (đã thấy: xám khi chưa đủ điều kiện).

---

## 6. Mâu thuẫn với bản thiết kế hiện tại (cần sửa khi rebuild)

- Enum trạng thái đơn trong Prisma (`CHO_XAC_NHAN / DANG_GIAO / GIAO_MOT_PHAN / HOAN_TAT / HUY`) không khớp giao diện: thiếu **Chờ sản xuất**, **Đang sản xuất**, **Chờ giao hàng**, **Trả toàn bộ**; cần thêm.
- Bản thiết kế không có trường "Người nhận", "Số điện thoại người nhận" riêng — cần thêm vào model.
- Form chưa có ô "Nhân viên bán" nhưng bộ lọc có — cần quyết định cách gán.
