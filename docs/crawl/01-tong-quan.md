# Tổng quan (dashboard) — `/tong-quan`

Trạng thái: **xong (cấu trúc & liên kết)**. Tất cả số liệu đang là 0 (production không có đơn trong kỳ), nên chưa đọc được biểu đồ và danh sách mặt hàng bán chạy.

---

## 1. Thanh điều khiển

- Tiêu đề: "Tổng quan"; phụ đề: ngày hiện tại (dd/mm/yyyy).
- **Từ ngày / Đến ngày** — ô ngày; mặc định cả hai là hôm nay.
- **Chọn kỳ** — dropdown preset, mặc định **Hôm nay**. Các lựa chọn: Ngày (Hôm nay · Hôm qua · 7 ngày qua · 30 ngày qua) · Tuần (Tuần này · Tuần trước) · Tháng (Tháng này · Tháng trước) · Quý (Quý này · …) · Năm · Toàn bộ.

Toàn bộ số liệu bên dưới theo khoảng ngày đã chọn, **trừ** các mục ghi rõ "không theo khoảng ngày": Tồn quỹ và Công nợ.

---

## 2. Bốn thẻ chỉ số chính

| Thẻ | Nội dung | Phụ đề | Mẫu |
|---|---|---|---|
| Doanh thu | tổng doanh thu kỳ | Kỳ trước: ₫ | 0 ₫ |
| Số đơn đã giao | số đơn đã giao | Kỳ trước: đơn | 0 |
| Giá trị đơn trung bình | doanh thu / số đơn | — | 0 ₫ |
| Lãi gộp | lãi gộp kỳ | Tỷ suất: % | 0 ₫ · 0% |

Lưu ý: "Doanh thu" và "Số đơn đã giao" có so sánh với kỳ trước. Cách tính kỳ trước (cùng độ dài, ngay trước kỳ) chưa xác minh.

---

## 3. Khối "Cần chú ý ngay"

Bốn thẻ có liên kết tới danh sách đã lọc:

| Thẻ | Đích (URL) | Ghi chú |
|---|---|---|
| Đơn chờ xác nhận | `/don-hang?status=PENDING` | **Mâu thuẫn**: trên trang Đơn hàng bán, `PENDING` hiển thị là "Chờ sản xuất", không phải "chờ xác nhận" |
| Đơn đang giao | `/don-hang?status=SHIPPING` | Trạng thái "Đang giao" trên đơn bán |
| Hàng dưới tồn tối thiểu | `/kho/ton-kho?belowMin=true` | Mở tồn kho với bộ lọc "Dưới tồn tối thiểu" |
| Công nợ quá hạn | `/cong-no/tuoi-no` | Mở Tuổi nợ (mặc định phải trả nhà cung cấp) |

Mục **Công nợ quá hạn** mở Tuổi nợ ở lựa chọn mặc định là **phải trả**, không phải phải thu — cần xem lại vì thẻ này là số tiền khách nợ hay nợ NCC.

---

## 4. Khối "Rò rỉ tiền"

Mô tả: "Những khoản báo cáo doanh thu không hiện ra. Bấm vào để mở báo cáo chi tiết."

| Thẻ | Đích (URL) | Ghi chú |
|---|---|---|
| Bán dưới giá vốn | `/bao-cao?name=ban-duoi-gia-von` | Chi tiết: `02-bao-cao.md` |
| Chiết khấu đã cấp — x% | `/bao-cao?name=chiet-khau` | Tiêu đề có tỷ lệ % trên doanh thu |
| Khách ngừng mua | `/bao-cao?name=khach-ngung-mua` | Số lượng khách |

Thẻ "Chiết khấu đã cấp" hiển thị tỷ lệ phần trăm ngay trong nhãn (ví dụ "— 0%"), nên nhãn thay đổi theo dữ liệu.

---

## 5. Khối "Doanh thu theo ngày" và "Mặt hàng bán chạy"

- **Doanh thu theo ngày** — biểu đồ theo ngày trong kỳ. Rỗng: "Chưa có doanh thu trong kỳ này".
- **Mặt hàng bán chạy** — danh sách mặt hàng đứng đầu theo doanh thu. Rỗng: "Chưa có dữ liệu bán hàng trong kỳ".

Chưa thấy biểu đồ thật vì không có dữ liệu. Cần xác minh loại biểu đồ, số mục hiển thị, và có tương tác khi bấm vào cột/đoạn không.

---

## 6. Khối "Công nợ"

- **Phải thu khách hàng** — số dư (âm nếu khách trả trước vượt nợ). Mẫu: −10.000.000 ₫. Liên kết tới Công nợ phải thu (`/cong-no/khach-hang`).
- **Phải trả nhà cung cấp** — mẫu: 0 ₫. Liên kết tới Công nợ phải trả (`/cong-no/nha-cung-cap`).

Số dư tính trên toàn bộ lịch sử, không theo khoảng ngày (ghi trên báo cáo Số dư công nợ).

---

## 7. Khối "Dòng tiền"

- **Thu trong kỳ** · **Chi trong kỳ** — theo khoảng ngày đã chọn.
- **Tồn quỹ hiện tại** — mẫu 10.000.000 ₫. Ghi chú: "Tồn quỹ tính trên toàn bộ lịch sử, không theo khoảng ngày đang xem."
- Liên kết: **Xem phiếu thu chi** (`/thu-chi`).

---

## 8. Quy tắc nghiệp vụ (từ giao diện)

1. **Tồn quỹ và công nợ là số toàn bộ lịch sử**, còn thu/chi, doanh thu, lãi gộp theo kỳ đang chọn.
2. **Doanh thu, lãi gộp** tính theo đơn đã giao/khách đã thực nhận (xem `02-bao-cao.md`).
3. Các thẻ "Cần chú ý" và "Rò rỉ tiền" đều là **lối tắt** tới báo cáo hoặc danh sách đã lọc.

---

## 9. Lỗi / nghi ngờ

1. **Nhãn "Đơn chờ xác nhận" không khớp** với trạng thái `PENDING` (trang Đơn hàng bán gọi là "Chờ sản xuất"). Hoặc nhãn thẻ sai, hoặc trạng thái đặt sai tên. Cần làm rõ trước khi rebuild.
2. **"Công nợ quá hạn" mở tuổi nợ phải trả** theo mặc định, trong khi tên thẻ không nói rõ là phải trả hay phải thu.
3. Thẻ "Chiết khấu đã cấp" có tỷ lệ trong nhãn — nên tách tỷ lệ ra khỏi tiêu đề khi làm lại.

---

## 10. Chưa xác minh / cần dữ liệu

- Biểu đồ "Doanh thu theo ngày": loại biểu đồ, cách tính, hành vi khi bấm.
- Danh sách "Mặt hàng bán chạy": số mục, tiêu chí xếp hạng.
- Cách tính "kỳ trước" để so sánh.
- Các preset chọn kỳ đầy đủ và cách chuyển từ preset sang ô ngày tuỳ chọn.
