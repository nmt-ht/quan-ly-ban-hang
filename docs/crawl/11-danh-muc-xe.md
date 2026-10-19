# Danh mục xe — `/xe`

Trạng thái: **xong (cấu trúc)**. Có 2 xe của công ty trong production, cả hai đang được gán vào chuyến.

---

## 1. Danh sách — `/xe`

### Tiêu đề & đếm
- Tiêu đề: "Danh mục xe"; phụ đề: "N xe".

### Hành động
| Nút | Hành vi |
|---|---|
| Thêm xe | Mở hộp thoại **Thêm xe** (mục 2) |
| Sửa (mỗi dòng) | Mở form sửa xe — chưa mở để tránh thay đổi dữ liệu |

### Bộ lọc
- Ô tìm: "Tìm theo biển số, mã xe, tên gọi".
- Không có bộ lọc trạng thái hay loại xe trên thanh lọc.

### Cột bảng
XE · LOẠI · TẢI TRỌNG · TÀI XẾ THƯỜNG CHẠY · TÌNH TRẠNG

- **XE**: biển số (tên lớn), mã xe và tên gọi (dòng nhỏ). Ví dụ "123123 · XE0000001 · minh".
- **TÌNH TRẠNG**: badge "Đang dùng", kèm dòng "đang ở chuyến CHxxxxxxx" khi xe đang trong chuyến.
- TẢI TRỌNG và TÀI XẾ THƯỜNG CHẠY hiện "—" với xe mẫu (chưa khai).

### Dữ liệu mẫu (production)
| Biển số | Mã | Loại | Tài xế thường chạy | Tình trạng |
|---|---|---|---|---|
| 123123 | XE0000001 | Xe tải | — (tên gọi là "minh") | Đang dùng · đang ở chuyến CH0000002 |
| 12A-12345 | XE0000002 | Xe tải | — | Đang dùng · đang ở chuyến CH0000004 |

### Trạng thái rỗng
Chưa thấy (có 2 xe).

---

## 2. Hộp thoại "Thêm xe"

Gợi ý đầu hộp thoại: **"Chỉ khai xe của công ty. Xe thuê ngoài không cần khai — lập chuyến vẫn gõ thẳng biển số được."**

| Nhãn | Kiểu | Bắt buộc | Mặc định / gợi ý |
|---|---|---|---|
| Biển số | text | **có** (\*) | Placeholder "51C-123.45" |
| Tên gọi | text | — | Placeholder "Xe tải nhỏ" |
| Loại xe | dropdown | — | **Xe tải** · Xe van / bán tải · Xe ba gác · Xe máy · Khác |
| Tải trọng (kg) | số | — | Placeholder "1500" |
| Tình trạng | dropdown | — | **Đang dùng** (các lựa chọn khác chưa mở được) |
| Hạn đăng kiểm | ngày | — | dd/mm/yyyy |
| Hạn bảo hiểm | ngày | — | dd/mm/yyyy |
| Tài xế thường chạy xe này | khối phụ | — | Gợi ý: "Lập chuyến chọn xe thì tự điền sẵn, vẫn sửa tay được." |
| Nhân viên trong hệ thống | dropdown | — | Mặc định "— Không gắn —" |
| Hoặc tên tài xế | text | — | Placeholder "Người lái thuê ngoài" |
| Điện thoại | text | — | Placeholder "0912345678" |
| Ghi chú | textarea | — | — |

Nút: **Huỷ** · **Thêm xe**.

Ghi chú:
- Có hai cách gắn tài xế thường chạy: chọn **nhân viên trong hệ thống**, hoặc **gõ tên** người lái ngoài. Hai cách này loại trừ nhau hay không cần xác minh.
- Khi lập chuyến chọn xe, tài xế được tự điền từ trường này và vẫn sửa được (xem module Chuyến giao hàng).

---

## 3. Quy tắc nghiệp vụ (từ giao diện)

1. **Chỉ khai xe của công ty.** Xe thuê ngoài không khai trong danh mục; khi lập chuyến gõ thẳng biển số.
2. **Tài xế thường chạy** được điền tự động khi lập chuyến chọn xe đó.
3. Một xe chỉ có thể **đang ở một chuyến** tại một thời điểm — trang danh sách hiển thị chuyến hiện tại của xe. Chưa thử được có chặn lập chuyến thứ hai không.
4. **Hạn đăng kiểm và hạn bảo hiểm** được lưu cho từng xe (chưa thấy cảnh báo sắp hết hạn trên giao diện).
5. Xe có tình trạng (Đang dùng và các trạng thái khác chưa xác minh).
6. Chi phí chuyến của xe được nhập ở chuyến (module Chuyến giao hàng) và tổng hợp ở báo cáo Chi phí xe.

---

## 4. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị.
- Cần xác minh: có cảnh báo khi hạn đăng kiểm / bảo hiểm sắp hết không.
- Cần xác minh: "Tài xế thường chạy" trong danh sách hiển thị "—" với xe đã có tên minh trong chuyến. Dữ liệu tài xế gắn xe và tài xế trên chuyến có đồng nhất không.

---

## 5. Chưa xác minh / cần dữ liệu

- Form Sửa xe (các trường có thể sửa, xoá hay ngừng dùng xe).
- Các lựa chọn Tình trạng khác "Đang dùng" (ví dụ bảo trì, ngừng).
- Thông báo lỗi khi trùng biển số hoặc thiếu biển số.
- Lịch sử chuyến của xe và chi phí tích luỹ.
- Ô tìm kiếm khi có nhiều xe.

## Bổ sung 2026-10-19: form "Sửa xe" (đã mở, không lưu)

Tiêu đề "Sửa xe <biển số>". Ghi chú đầu form: chỉ khai xe của công ty; xe thuê ngoài không cần khai, lập chuyến vẫn gõ thẳng biển số.

| Trường | Loại | Ghi chú |
|---|---|---|
| Biển số | text, bắt buộc | |
| Tên gọi | text | trên danh sách hiện cạnh mã xe (vd. "XE0000001 · minh") |
| Loại xe | select | giá trị thấy: Xe tải |
| Tải trọng (kg) | number | placeholder 1500 |
| Tình trạng | select | giá trị thấy: Đang dùng |
| Hạn đăng kiểm | date dd/mm/yyyy | |
| Hạn bảo hiểm | date dd/mm/yyyy | |
| Tài xế thường chạy: Nhân viên trong hệ thống | select | "— Không gắn —"; chọn thì tự điền khi lập chuyến, vẫn sửa tay được |
| Hoặc tên tài xế | text | "Người lái thuê ngoài" |
| Điện thoại | text | placeholder 0912345678 |
| Ghi chú | textarea | |

Nút: Huỷ, Lưu. Model hiện tại thiếu: hạn đăng kiểm, hạn bảo hiểm, điện thoại tài xế, ghi chú, liên kết nhân viên. Danh sách xe cũng có ô tìm theo biển số, mã xe, tên gọi.
