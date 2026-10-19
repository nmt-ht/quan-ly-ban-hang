# Đơn nhập hàng — `/mua-hang`

Trạng thái: **xong (cấu trúc)**. Chưa có đơn nào trong production nên chưa đọc được bảng kết quả hay luồng nhận hàng thật.

---

## 1. Danh sách — `/mua-hang`

### Tiêu đề & đếm
- Tiêu đề: "Đơn nhập hàng"; phụ đề: "N đơn".

### Hành động
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Lập đơn nhập | Mở `/mua-hang/them-moi` |

### Bộ lọc
- Ô tìm: "Tìm mã đơn, nhà cung cấp hoặc hàng hoá trong đơn…".
- **Trạng thái** (dropdown chọn nhiều — checkbox):
  1. Nháp
  2. Đã gửi NCC
  3. Nhận một phần
  4. Đã nhận đủ
  5. Hoàn tất
  6. Huỷ *(nhãn đọc được là "Huỷ")*
- **Tất cả nhà cung cấp** (dropdown; hiện 1 NCC: NCC0000001).
- **Chọn kỳ** (preset dùng chung: Hôm nay · Hôm qua · 7/30 ngày qua · Tuần/Tháng/Quý/Năm này và trước · Toàn bộ) + ô **dd/mm/yyyy → dd/mm/yyyy**.
- **Người lập** (dropdown).
- **Giá trị đơn** (khoảng "Từ – Đến", đơn vị ₫).

### Trạng thái rỗng (nguyên văn)
- "Chưa có đơn nhập hàng nào"
- "Lập đơn nhập để đặt hàng nhà cung cấp và theo dõi hàng về từng đợt."

### Cột bảng
Chưa thấy vì bảng rỗng.

---

## 2. Form lập đơn — `/mua-hang/them-moi`

Tiêu đề: "Lập đơn nhập hàng"

### Thông tin chung
| Nhãn | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| Nhà cung cấp | dropdown | **có** (\*) | Placeholder "— Chọn nhà cung cấp —"; liệt kê NCC còn hợp tác (đã thấy: 212121 = NCC0000001) |
| Ngày đặt hàng | ngày | **có** (\*) | Mặc định hôm nay (dd/mm/yyyy) |
| Ghi chú | text | — | Placeholder "VD: Hàng về kế hai đợt" |

**Thông báo quan trọng ngay dưới phần thông tin chung:**
> "Đơn nhập không làm thay đổi tồn kho. Tồn tăng và công nợ phải trả phát sinh khi nhận hàng — lúc đó hệ thống mới lập phiếu nhập kho."

### Hàng đặt mua
- Tiêu đề khối: "Hàng đặt mua" · phụ đề "0 dòng hợp lệ".
- Nút **Thêm dòng**.
- Mỗi dòng:
  - **Hàng hoá \*** — dropdown tìm/chọn (rỗng vì chưa có mặt hàng).
  - **Số lượng đặt \*** — mặc định 0.
  - **Đơn vị** — tự điền, chỉ đọc.
  - **Đơn giá mua** — mặc định 0.
  - **Thành tiền** — tính tự động, chỉ đọc.
  - Nút xoá dòng (thùng rác).
- Tổng: **Tổng tiền đơn** — mặc định "0 ₫".
- Gợi ý khi chưa đủ điều kiện: "Chọn nhà cung cấp".

### Chân form
- **Huỷ** · **Tạo đơn nhập** (xám cho tới khi đủ điều kiện).

Chưa thử lưu nên chưa biết thông báo lỗi.

---

## 3. Quy tắc nghiệp vụ (từ giao diện)

1. **Đơn nhập không tác động tồn kho.** Tồn tăng khi nhận hàng, khi đó hệ thống lập **phiếu nhập kho**.
2. **Công nợ phải trả chỉ phát sinh khi nhận hàng**, không phải khi đặt đơn (đồng nhất với báo cáo Nhập hàng và trang Công nợ phải trả).
3. Vòng đời đơn: Nháp → Đã gửi NCC → Nhận một phần / Đã nhận đủ → Hoàn tất; có nhánh Huỷ. Điều kiện chuyển trạng thái chưa xác minh.
4. Đơn có thể đặt theo **đơn vị khác đơn vị chính** của hàng; đơn giá trên dòng theo đơn vị đó (báo cáo Giá mua biến động quy về ĐVT chính để so sánh).
5. Chọn nhà cung cấp trước khi thêm dòng hàng — danh sách hàng gợi ý theo danh mục hàng của NCC (xem module Nhà cung cấp).

---

## 4. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị.
- Cần xác minh: dropdown "Hàng hoá" có chỉ hiện hàng trong danh mục của NCC đã chọn hay toàn bộ hàng hoá (module Nhà cung cấp ghi "gợi ý sẵn", chưa rõ là lọc hay chỉ ưu tiên).

---

## 5. Chưa xác minh / cần dữ liệu

- Trang chi tiết đơn nhập và các hành động theo trạng thái (gửi NCC, nhận hàng, huỷ).
- Luồng "Xác nhận nhận hàng" → sinh phiếu nhập kho và công nợ (quyền `purchase.receive`).
- Nhận một phần: cách theo dõi số còn lại.
- Cột bảng và hành động dòng.
- Thông báo lỗi khi lưu thiếu NCC / hàng / số lượng.

---

## 6. Mâu thuẫn với bản thiết kế hiện tại (cần sửa khi rebuild)

Bản Prisma hiện có enum `NHAP / CHO_DUYET / DA_DUYET / DA_NHAN / HUY`. Giao diện thật có **Nháp / Đã gửi NCC / Nhận một phần / Đã nhận đủ / Hoàn tất / Huỷ**. Cần thay bằng enum mới, và thêm trường theo dõi số lượng đã nhận từng phần.
