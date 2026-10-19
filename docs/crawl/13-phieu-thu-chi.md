# Phiếu thu chi — `/thu-chi`

Trạng thái: **xong (cấu trúc)**. Có 1 phiếu thu mẫu (PT0000001). Đã đọc đủ 2 form lập phiếu, màn Tài khoản tiền và Loại thu chi. Chưa lập phiếu thật để tránh ghi dữ liệu.

---

## 1. Danh sách — `/thu-chi`

### Tiêu đề & đếm
- Tiêu đề: "Phiếu thu chi"; phụ đề: "N phiếu".

### Hành động đầu trang
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Tài khoản tiền | Mở `/thu-chi/tai-khoan` |
| Loại thu chi | Mở `/thu-chi/loai` |
| Phiếu thu | Mở form `/thu-chi/lap/thu` |
| Phiếu chi | Mở form `/thu-chi/lap/chi` |

### Thẻ tổng hợp "Số dư các đầu tài khoản"
- Dòng tiêu đề: "số dư hiện tại, không theo bộ lọc" · tổng (mẫu 10.000.000 ₫) · nút **Quản lý** (→ Tài khoản tiền) · biểu tượng sắp xếp.
- Từng tài khoản: **Quỹ tiền mặt** (0 ₫) và **Tài khoản ngân hàng** (10.000.000 ₫).

Bốn thẻ tóm tắt theo kỳ đang lọc:
- **Tổng thu** — 10.000.000 ₫, kèm dòng phân tích "Tiền mặt 0 ₫ · CK 10.000.000 ₫" (CK = chuyển khoản).
- **Tổng chi** — 0 ₫, "Tiền mặt 0 ₫ · CK 0 ₫".
- **Thu − Chi trong kỳ** — 10.000.000 ₫.
- **Tồn quỹ** — 10.000.000 ₫, ghi chú "Toàn bộ lịch sử".

### Bộ lọc
- Ô tìm: "Tìm số phiếu, đối tượng, diễn giải…".
- **Thu và chi** (Phiếu thu / Phiếu chi / Thu và chi).
- **Loại thu chi** (dropdown theo danh mục ở mục 4).
- **Hình thức** (Tiền mặt / Chuyển khoản).
- **Tài khoản** (dropdown tài khoản tiền).
- **Chọn kỳ** (preset dùng chung) + ô ngày dd/mm/yyyy → dd/mm/yyyy.
- **Người lập** (dropdown).
- **Số tiền** (khoảng).
- Nút bật: **Hiện phiếu đã huỷ** (mặc định ẩn).

### Cột bảng
SỐ PHIẾU · NGÀY · LOẠI · ĐỐI TƯỢNG · TÀI KHOẢN · SỐ TIỀN · ĐÃ ĐỐI TRỪ · DIỄN GIẢI · (menu thao tác)

Dòng mẫu: PT0000001 · 05/09/2026 · Phiếu thu / Thu tiền khách hàng · KH0000002 Tú Aloha · Tài khoản ngân hàng (Chuyển khoản) · +10.000.000 ₫ · đã đối trừ 0 ₫ (ghi "trả trước 10.000.000 ₫") · diễn giải —.

Số tiền thu có dấu **+**, số tiền chi sẽ có dấu **−** (quy ước hiển thị chưa thấy phiếu chi).

### Trạng thái rỗng
Chưa thấy (có 1 phiếu).

---

## 2. Form Lập phiếu thu — `/thu-chi/lap/thu`

Tiêu đề: "Lập phiếu thu"

| Nhãn | Kiểu | Bắt buộc | Mặc định / gợi ý |
|---|---|---|---|
| Loại thu | dropdown | **có** (\*) | **Thu tiền khách hàng** · gợi ý: "Gắn với khách hàng và làm giảm công nợ." · các lựa chọn khác: Thu khác |
| Ngày phiếu | ngày | — | Hôm nay |
| Khách hàng | dropdown tìm | **có** (\*) | "Chọn khách hàng" — ô số tiền báo "Chọn khách hàng trước" cho đến khi chọn |
| Số tiền | số | **có** (\*) | Phụ thuộc khách hàng đã chọn |
| Tài khoản nhận tiền | dropdown | **có** (\*) | Mặc định "Quỹ tiền mặt · Tiền mặt", hiển thị số dư hiện tại (0 ₫) |
| Diễn giải | text | — | Placeholder: "VD: Khách thanh toán đợt 1" |

Khối bên phải **Công nợ phải thu**: "Chọn khách hàng để xem công nợ hiện tại." — sau khi chọn khách, hiện số dư nợ của khách.

Bên dưới: **Số dư các đầu tài khoản** (tổng và từng tài khoản). Chân form: gợi ý "Nhập số tiền để tạo phiếu" · **Huỷ** · **Tạo phiếu thu** (xám tới khi đủ điều kiện).

---

## 3. Form Lập phiếu chi — `/thu-chi/lap/chi`

Tiêu đề: "Lập phiếu chi"

| Nhãn | Kiểu | Bắt buộc | Mặc định / gợi ý |
|---|---|---|---|
| Loại chi | dropdown | **có** (\*) | **Chi trả nhà cung cấp** · gợi ý: "Gắn với nhà cung cấp và làm giảm công nợ." · khác: Chi khác |
| Ngày phiếu | ngày | — | Hôm nay |
| Nhà cung cấp | dropdown tìm | **có** (\*) | "Chọn nhà cung cấp" · ô số tiền báo "Chọn nhà cung cấp trước" |
| Số tiền | số | **có** (\*) | — |
| Tài khoản chi tiền | dropdown | **có** (\*) | Mặc định "Quỹ tiền mặt · Tiền mặt", hiển thị số dư |
| Diễn giải | text | — | Placeholder: "VD: trả tiền hàng tháng 9" |

Khối bên phải **Công nợ phải trả**: "Chọn nhà cung cấp để xem công nợ hiện tại."

Chân form: "Nhập số tiền để tạo phiếu" · **Huỷ** · **Tạo phiếu chi**.

---

## 4. Loại thu chi — `/thu-chi/loai`

Mô tả trang: "Quyết định phiếu gắn với khách hàng, nhà cung cấp hay không gắn đối tác nào." · nút **Thêm loại**.

**Phiếu thu (2 loại):**
| Mã | Tên | Gắn đối tác | Ghi chú |
|---|---|---|---|
| THU_KH | Thu tiền khách hàng | Khách hàng | **Mặc định** · chọn khách · giảm công nợ phải thu · đã dùng 1 phiếu |
| THU_KHAC | Thu khác | Không gắn | chỉ ghi sổ quỹ |

**Phiếu chi (2 loại):**
| Mã | Tên | Gắn đối tác | Ghi chú |
|---|---|---|---|
| CHI_NCC | Chi trả nhà cung cấp | Nhà cung cấp | **Mặc định** · chọn NCC · giảm công nợ phải trả |
| CHI_KHAC | Chi khác | Không gắn | chỉ ghi sổ quỹ |

Mỗi loại có **Sửa** và **Ngừng dùng** (không xoá).

---

## 5. Tài khoản tiền — `/thu-chi/tai-khoan`

Mô tả: "Quỹ tiền mặt và các số tài khoản nhận tiền. Mỗi phiếu thu chi gắn đúng một tài khoản, số dư tính riêng từng cái." · nút **Thêm tài khoản**.

- **Tổng số dư các tài khoản đang dùng**: 10.000.000 ₫.
- Nhóm **Tiền mặt** (1 tài khoản): Quỹ tiền mặt — mặc định · "Tiền mặt tại quỹ" · đầu kỳ 0 ₫ · số dư 0 ₫.
- Nhóm **Ngân hàng** (1 tài khoản): Tài khoản ngân hàng — mặc định · "Chưa khai số tài khoản" · đầu kỳ 0 ₫ · 1 phiếu · số dư 10.000.000 ₫.
- Mỗi tài khoản: **Sửa** · **Ngừng dùng**.

### Form "Thêm tài khoản"
| Nhãn | Kiểu | Ghi chú |
|---|---|---|
| Mã tài khoản | text | Gợi ý dạng "TM, TCB-9999" |
| Tính chất | nút chọn | **Tiền mặt** / **Ngân hàng** |
| Tên tài khoản | text | Bắt buộc (\*) |
| Ngân hàng | text | Hiện khi chọn Ngân hàng |
| Số tài khoản | text | Bắt buộc (\*) khi là ngân hàng |
| Chủ tài khoản | text | — |
| Chi nhánh | text | — |
| Số dư đầu kỳ | số | Gợi ý: số dư trước khi dùng phần mềm; không nhập thì số dư bắt đầu từ 0 |
| Thứ tự hiển thị | số | mặc định 0 |
| Ghi chú | textarea | — |
| Chọn sẵn khi lập phiếu | checkbox | — |
| Đang sử dụng | checkbox | tick sẵn |

Nút: **Huỷ** · **Lưu** (xám tới khi đủ điều kiện).

**Lưu ý bảo mật:** các ô mẫu trong form có chứa giá trị giống dữ liệu thật (số tài khoản và tên chủ tài khoản ngân hàng). Các giá trị đó **không được chép vào tài liệu này**, và khi làm lại không nên dùng giá trị mẫu thật làm placeholder.

---

## 6. Quy tắc nghiệp vụ (từ giao diện)

1. **Mỗi phiếu gắn đúng một tài khoản tiền.** Số dư tính riêng từng tài khoản; tồn quỹ là tổng toàn bộ.
2. **Phiếu thu loại Thu tiền khách hàng** làm giảm công nợ phải thu; **Chi trả nhà cung cấp** làm giảm công nợ phải trả.
3. **Thu khác / Chi khác** không gắn đối tác, chỉ ghi sổ quỹ.
4. **Phiếu đã huỷ không tính** vào báo cáo và số dư; có bộ lọc để xem phiếu đã huỷ.
5. Phiếu thu/chi thể hiện **hình thức** Tiền mặt hoặc Chuyển khoản; tiền mặt và chuyển khoản được cộng riêng ở thẻ tổng.
6. Số dư đầu kỳ của tài khoản là số dư trước khi dùng phần mềm; sau đó không nhập số dư đầu nữa.
7. Tiền thu chi từ chi phí chuyến giao hàng **không tự sinh phiếu chi** — phải lập phiếu chi riêng (module Chuyến giao hàng).
8. Báo cáo Thu chi và Sổ quỹ lấy từ đây (xem `02-bao-cao.md`).

---

## 7. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị.
- Cần xác minh: có cho phép xoá tài khoản đã có phiếu hay chỉ "Ngừng dùng".
- Cần xác minh: số dư tài khoản ngân hàng 10.000.000 ₫ có phải là phiếu thu trả trước của khách KH0000002 (đúng là vậy theo dữ liệu mẫu).
- Form lập phiếu chỉ cho chọn 1 loại mặc định trong mỗi nhóm (thu: 2 lựa chọn, chi: 2 lựa chọn). Chưa mở dropdown "Loại thu chi" của bộ lọc để so sánh.

---

## 8. Chưa xác minh / cần dữ liệu

- Quy ước dấu và định dạng số trong bảng khi có phiếu chi.
- Huỷ phiếu: điều kiện, lý do bắt buộc, ảnh hưởng đến công nợ.
- Phiếu in và biên lai.
- Thông báo lỗi khi lưu thiếu đối tác / số tiền / tài khoản.
- Kết quả bộ lọc "Hình thức" và "Tài khoản" khi có nhiều phiếu.
