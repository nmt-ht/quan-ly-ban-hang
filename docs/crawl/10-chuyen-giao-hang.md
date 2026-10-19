# Chuyến giao hàng — `/giao-hang`

Trạng thái: **xong (cấu trúc + chi tiết chuyến)**. Có 6 chuyến mẫu. Các chuyến chưa có đơn nào, nên bảng đơn và luồng xếp đơn/xuất kho/chốt giao chưa thử được với dữ liệu thật.

---

## 1. Danh sách — `/giao-hang`

### Tiêu đề & đếm
- Tiêu đề: "Chuyến giao hàng"; phụ đề: "N chuyến".

### Hành động
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Tạo chuyến | Mở hộp thoại **Tạo chuyến giao hàng** (xem mục 2) |
| `…` (mỗi dòng) | Menu: **Xem chi tiết** |

### Bộ lọc
- Ô tìm: "Tìm mã chuyến, tài xế, biển số, mã đơn…".
- **Trạng thái** (dropdown chọn nhiều — checkbox): Đang gom đơn · Đã xuất kho · **Xe về kho** · Hoàn tất · Đã huỷ.
  - Nhãn "Xe về kho" đọc từ ảnh chụp; khi làm lại cần xác minh nguyên văn.
- **Chọn kỳ** (preset dùng chung) + ô dd/mm/yyyy → dd/mm/yyyy.
- **Tài xế** (dropdown) — mẫu: "Quản trị hệ thống — CEO". Dropdown liệt kê **tài khoản người dùng** làm tài xế. Xem mục 6.

### Cột bảng
MÃ CHUYẾN · NGÀY · TÀI XẾ · BIỂN SỐ · TRẠNG THÁI · ĐƠN · GIÁ TRỊ · KHÁCH NHẬN

- ĐƠN: dạng "số đã chốt/tổng đơn" (ví dụ 0/0).
- GIÁ TRỊ: tổng giá trị đơn trên chuyến (₫).
- KHÁCH NHẬN: tổng tiền khách thực nhận (₫), hiện "—" khi chưa có.

### Dữ liệu mẫu (production)
| Mã | Ngày | Tài xế | Biển số | Trạng thái |
|---|---|---|---|---|
| CH0000006 | 05/09/2026 | — | — | Đang gom đơn |
| CH0000005 | 05/09/2026 | — | — | Đã xuất kho |
| CH0000004 | 05/09/2026 | — | 12A-12345 | Đang gom đơn |
| CH0000003 | 05/09/2026 | — | — | Đang gom đơn |
| CH0000002 | 04/09/2026 | 21212 | 123123 | Đang gom đơn |
| CH0000001 | 04/09/2026 | minh | 123123 | Hoàn tất |

Tất cả có 0/0 đơn, 0 ₫.

### Trạng thái rỗng
Chưa thấy (có 6 chuyến). Cần thử bộ lọc không có kết quả để đọc thông điệp.

---

## 2. Hộp thoại "Tạo chuyến giao hàng"

Tiêu đề: "Tạo chuyến giao hàng". Gợi ý: "Tạo xong thì xếp các đơn đã xử lý lên chuyến, rồi xuất kho một lượt."

| Nhãn | Kiểu | Bắt buộc | Mặc định / gợi ý |
|---|---|---|---|
| Ngày chuyến | ngày | — | Hôm nay (dd/mm/yyyy) |
| Xe | dropdown có tìm | — | "Xe thuê ngoài — gõ biển số"; liệt kê xe trong danh mục, mỗi xe kèm trạng thái đang đi chuyến nào |
| Biển số | text | — | Placeholder "51C-999.99" — dùng khi chọn xe thuê ngoài |
| Tài xế | text | — | Nhập tự do |
| Điện thoại tài xế | text | — | Placeholder "0912345678" |
| Ghi chú | textarea | — | — |

Nút: **Huỷ** · **Tạo chuyến**.

Các lựa chọn xe đã thấy:
- Xe thuê ngoài — gõ biển số
- 123123 · minh · **đang đi chuyến CH0000002**
- 12A-12345 · **đang ở chuyến CH0000004**

Ghi chú: xe đang đi chuyến vẫn hiện trong danh sách có nhãn trạng thái — **cần thử để biết có chọn được không**.

Không bấm "Tạo chuyến" để tránh tạo bản ghi thật.

---

## 3. Trang chi tiết chuyến — `/giao-hang/<id>`

Đầu trang:
- Mã chuyến (CH0000005) · nhãn trạng thái ("Đã xuất kho") · ngày.
- Nút in: **Phiếu soạn hàng** · **Phiếu giao hàng** · nút hành động theo trạng thái: **Xe về kho**.

Bốn chỉ số: **Số đơn** · **Chưa chốt giao** · **Giá trị đơn** · **Khách thực nhận**.

Trạng thái rỗng khi chưa có đơn:
- "Chuyến chưa có đơn nào"
- "Xếp các đơn đang ở trạng thái Chờ giao hàng lên chuyến rồi xuất kho một lượt."

### Khối "Chi phí chuyến"
- Ba ô số: **Tiền dầu** · **Cầu đường, bến bãi** · **Chi phí khác** (mặc định 0).
- Ô **Ghi chú chi phí** — placeholder gợi ý: "Đổ 30 lít tại cây xăng Ninh Trang".
- **Tổng** (₫) — tự tính.
- Nút **Lưu chi phí**.
- Cảnh báo quan trọng: **"Đây là số liệu điều vận, không phải phiếu chi. Tiền thật ra khỏi quỹ vẫn phải lập phiếu chi ở màn hình Thu chi."**

### Khối thời gian & người
- **Xuất kho lúc** (05/09/2026 12:37) · **Về kho lúc** ("—" nếu chưa về) · **Người tạo** (Quản trị hệ thống).

---

## 4. Quy tắc nghiệp vụ (từ giao diện và báo cáo)

1. Chuyến có **vòng đời**: Đang gom đơn → Đã xuất kho → Xe về kho → Hoàn tất (có nhánh Đã huỷ).
2. **Xếp đơn lên chuyến** chỉ với đơn đang ở trạng thái **Chờ giao hàng**.
3. **Xuất kho một lượt** cho cả chuyến (quyền `trip.ship`).
4. **Chốt giao** từng đơn với khách (quyền `trip.deliver`); "Chưa chốt giao" là số đơn chưa chốt. Báo cáo Giao hàng chỉ tính đơn đã chốt.
5. **Hàng về kho** (quyền `trip.return`): hàng khách không nhận được nhập lại kho. Báo cáo Hiệu quả tài xế tính "giá trị mang về" theo phần này. Phiếu "Nhập trả về" trong phiếu kho có thể sinh từ đây (xem `03-ton-kho.md`).
6. **Chi phí chuyến** là số liệu điều vận, không ghi sổ quỹ; tiền thật phải lập phiếu chi. Báo cáo Chi phí xe lấy từ đây, chuyến đã huỷ không tính.
7. Xe **thuê ngoài** không cần khai trong danh mục; chỉ cần gõ biển số khi tạo chuyến.
8. Tài xế của chuyến là **tự do nhập** trong hộp thoại tạo chuyến, nhưng bộ lọc Tài xế lại liệt kê tài khoản người dùng. Xem mục 6.

---

## 5. Liên kết với module khác

- Đơn bán ở trạng thái Chờ giao hàng → xếp vào chuyến (module Đơn hàng bán).
- Chuyến "Xe về kho" → phiếu nhập trả về (module Phiếu kho).
- Chi phí chuyến → báo cáo Chi phí xe; tiền thật → phiếu chi (module Phiếu thu chi).
- Xe đang dùng → danh mục xe (module Danh mục xe).

---

## 6. Lỗi / nghi ngờ

- **Tài xế không đồng nhất**: hộp thoại tạo chuyến là ô nhập tự do, trong khi bộ lọc Tài xế và báo cáo hiệu quả tài xế dựa trên một danh sách khác (có tài khoản "Quản trị hệ thống — CEO"). Cần thống nhất khi làm lại: nên chọn từ danh sách người lái, hoặc cho nhập tự do nhưng vẫn gom được tên.
- **Tab bị treo** khi thao tác nút "Tạo chuyến" trong lần crawl này: không có lỗi giao diện rõ ràng được ghi nhận, và khi mở lại tab thì mọi thứ bình thường.
- Cần xác minh: chọn xe đang đi chuyến khác có bị chặn không.

---

## 7. Chưa xác minh / cần dữ liệu

- Bảng đơn trong chuyến: cột, số dòng, hành động xoá đơn khỏi chuyến.
- Quy trình xếp đơn, xuất kho một lượt, chốt giao, nhập hàng về (từng bước, quyền và điều kiện).
- Phiếu soạn hàng và phiếu giao hàng (nội dung in).
- Điều kiện chuyển sang Hoàn tất và Huỷ chuyến.
- Hiển thị khi có đơn: giá trị, khách nhận, chênh lệch.
- Bộ lọc Tài xế khi đã có chuyến gán tài xế tự do.
