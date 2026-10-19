# Nhà cung cấp — `/nha-cung-cap`

Trạng thái: **xong (cấu trúc)**. Production có 1 nhà cung cấp mẫu (NCC0000001). Chưa có đơn nhập nên các số liệu liên quan là 0.

---

## 1. Danh sách — `/nha-cung-cap`

### Tiêu đề & đếm
- Tiêu đề: "Nhà cung cấp"; phụ đề: "N nhà cung cấp".

### Hành động
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Thêm nhà cung cấp | Mở `/nha-cung-cap/them-moi` |
| `…` (mỗi dòng) | Menu: **Xem chi tiết** · **Sửa** · **Lập phiếu chi** |

### Bộ lọc & sắp xếp
- Ô tìm: "Tìm theo tên, mã, điện thoại, mã số thuế, địa chỉ…".
- Trạng thái: **Tất cả trạng thái** · **Còn hợp tác** · **Ngừng hợp tác**.
- Sắp xếp: **Tên A → Z** (mặc định) · Tên Z → A · Mã tăng dần · Mới thêm nhất.
- Phân trang: 20 dòng/trang, nút Đầu / Trước / Sau / Cuối, hiển thị "Hiện a–b trong n nhà cung cấp".

### Cột bảng (đã thấy)
MÃ / TÊN · LIÊN HỆ · MÃ SỐ THUẾ · ĐỊA CHỈ · ĐƯỢC NỢ · MẶT HÀNG · ĐƠN NHẬP · TRẠNG THÁI

- MÃ / TÊN: mã (NCC + 7 chữ số) và tên hiển thị bên dưới mã.
- ĐƯỢC NỢ: hiển thị "—" khi không có cấu hình; cần dữ liệu để xác nhận định dạng.
- MẶT HÀNG: số mặt hàng trong danh mục của NCC.
- ĐƠN NHẬP: số đơn nhập đã lập.
- TRẠNG THÁI: badge xanh "Còn hợp tác" (hoặc "Ngừng hợp tác").

Dữ liệu mẫu: NCC0000001 · tên "212121" · MST — · Địa chỉ — · Được nợ — · 0 mặt hàng · 0 đơn · Còn hợp tác.

### Trạng thái rỗng
Chưa thấy (đang có 1 bản ghi). Nếu lọc không có kết quả, cần thử để đọc thông điệp.

---

## 2. Form thêm mới — `/nha-cung-cap/them-moi`

Tiêu đề: "Thêm nhà cung cấp" · Phần: "Thông tin chung"

| Nhãn | Kiểu | Bắt buộc | Mặc định | Placeholder / gợi ý |
|---|---|---|---|---|
| Tên nhà cung cấp | text | **có** (\*) | — | "VD: Công ty TNHH Nhôm Kính Đông Á" |
| Điện thoại | text | — | — | "0912345678" |
| Email | email | — | — | "lienhe@congty.vn" |
| Mã số thuế | text | — | — | "0301234567" |
| Số ngày được nợ | số | — | 0 | Gợi ý: "Hạn thanh toán tự tính = ngày nhập kho + số ngày này." |
| Địa chỉ | text | — | — | "Số nhà, ngõ, đường, phường/xã, tỉnh/TP" |
| Ghi chú | text | — | — | — |
| Còn hợp tác | checkbox | — | **đã tick** | — |

Chân form: gợi ý "Điền thông tin rồi bấm Lưu" · nút **Huỷ** · nút **Tạo nhà cung cấp**.

Ghi chú:
- Các giá trị "0912345678", "lienhe@congty.vn", "0301234567" là **placeholder**, không phải dữ liệu mặc định. Cùng bộ giá trị với thông tin công ty — dễ nhầm, nên ghi chú cho người làm lại.
- Chưa thử lưu, nên chưa biết thông báo lỗi khi thiếu tên.

---

## 3. Form sửa — `/nha-cung-cap/<id>/sua`

Tiêu đề: "Chi tiết nhà cung cấp" › "Sửa NCC0000001". Cùng các trường như form thêm, khác:
- Các trường có giá trị thật (Mã số thuế, Điện thoại… đều trống trong dữ liệu mẫu, nên chỉ hiện placeholder).
- Số ngày được nợ hiện giá trị **0**.
- Checkbox **Còn hợp tác** tick sẵn theo trạng thái hiện tại.
- Mã NCC không sửa được ở form (chưa xác minh).

---

## 4. Trang chi tiết — `/nha-cung-cap/<id>`

Đầu trang:
- Tên lớn (dòng "212121") · mã NCC · badge trạng thái "Còn hợp tác".
- Nút **Ngừng hợp tác** (chuyển trạng thái, **không xoá**) và nút **Sửa**.
  - Không bấm trong crawl vì là thay đổi trạng thái.

Hai tab:
1. **Thông tin chung** — các trường: Mã nhà cung cấp · Điện thoại · Email · Mã số thuế · Số ngày được nợ · Số đơn nhập đã lập · Địa chỉ · Ghi chú · Ngày tạo.
   - Giá trị mẫu: "Trả ngay" (số ngày nợ = 0), 0 đơn, ngày tạo 05/09/2026.
2. **Danh mục hàng (0)** — thêm mặt hàng do NCC cung cấp:
   - Form: **Hàng hoá** (chọn) · **Mã hàng theo NCC** · **Giá mua** · nút thêm.
   - Gợi ý: "Một mặt hàng có thể do nhiều nhà cung cấp cung cấp với giá khác nhau. Thêm lại mặt hàng đã có sẽ cập nhật giá."
   - Trạng thái rỗng: "Danh mục hàng còn trống" — "Thêm mặt hàng để khi lập đơn nhập, hệ thống gợi ý sẵn hàng của nhà cung cấp này."

Khối **Công nợ phải trả**: "Công nợ phát sinh khi nhập kho từ nhà cung cấp này." — nút **Xem sổ công nợ** (→ module Công nợ phải trả).

---

## 5. Quy tắc nghiệp vụ (từ giao diện)

1. Mỗi mặt hàng có thể có **nhiều nhà cung cấp, mỗi NCC một giá mua** — danh mục hàng của NCC là nơi lưu giá đó.
2. **Đơn nhập hàng gợi ý sẵn hàng** theo danh mục của NCC.
3. **Thêm lại mặt hàng đã có sẽ cập nhật giá** (không tạo bản ghi trùng).
4. Hạn thanh toán công nợ = **ngày nhập kho + số ngày được nợ**, không tính từ ngày đặt đơn.
5. Công nợ phải trả phát sinh **khi nhập kho**, không phải khi lập đơn.
6. "Ngừng hợp tác" là **chuyển trạng thái**, không xoá dữ liệu.
7. Nhà cung cấp mới mặc định "Còn hợp tác".

---

## 6. Dữ liệu, mã và kỹ thuật (quan sát được)

- Mã nhà cung cấp: NCC + 7 chữ số, tự tăng.
- **ID trong URL có dạng chuỗi cuid** (`cmto0qzap002nnz1w08wnzk79`), không phải UUID. Cần lưu ý khi thiết kế bảng (schema hiện tại đang dùng `uuid()`).
- URL: `/them-moi` và `/sua` cho form; `/<id>` cho chi tiết.

---

## 7. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị trong module này.
- Cần xác minh: bộ lọc Trạng thái có áp dụng khi kết hợp với ô tìm không.
- Cần xác minh: có cảnh báo trùng mã số thuế hay tên không.

---

## 8. Chưa xác minh / cần dữ liệu

- Thông báo lỗi khi lưu thiếu trường bắt buộc (chưa thử lưu).
- Bảng danh mục hàng khi đã có mặt hàng (cột: mã NCC, giá mua, đơn vị).
- Hành vi "Lập phiếu chi" từ menu dòng (thuộc module Phiếu thu chi).
- Hành vi "Ngừng hợp tác" và "Còn hợp tác" khi có đơn đang mở.
- Trường ĐƯỢC NỢ có ý nghĩa gì khi số ngày nợ là 0.
