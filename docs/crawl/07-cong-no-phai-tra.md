# Công nợ phải trả — `/cong-no/nha-cung-cap`

Trạng thái: **xong (cấu trúc)**. Hiện không có công nợ nào (0 nhà cung cấp), nên chưa đọc được bảng và sổ công nợ chi tiết.

---

## 1. Màn hình

### Tiêu đề & đếm
- Tiêu đề: "Công nợ phải trả"; phụ đề: "N nhà cung cấp".

### Hành động đầu trang
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Báo cáo tuổi nợ | Mở module **Tuổi nợ** (`/cong-no/tuoi-no`) |

### Bộ lọc
- Ô tìm: "Tìm nhà cung cấp…".
- Nút bật/tắt **Chỉ đối tác còn nợ** — nút hiển thị ở trạng thái bật sẵn (nền đen). Khi bật, chỉ hiện NCC có số dư khác 0. Chưa thử tắt để xác minh.

### Thẻ tổng hợp (đầu trang)
- **Tổng phải trả (trang này)** — tổng số dư các NCC đang hiện trên trang. Mẫu: 0 ₫.
- **Trong đó quá hạn** — phần đã quá hạn thanh toán. Mẫu: 0 ₫.

### Trạng thái rỗng (nguyên văn)
- Tiêu đề: "Không có công nợ phải trả"
- Mô tả: "Công nợ phải trả phát sinh khi nhập kho hàng từ nhà cung cấp."

### Cột bảng
Chưa thấy vì bảng rỗng. Dự kiến tương tự Công nợ phải thu: MÃ/TÊN · ĐƯỢC NỢ · SỐ KHOẢN · TRẢ TRƯỚC · QUÁ HẠN · SỐ DƯ — **cần xác minh**.

---

## 2. Quy tắc nghiệp vụ (từ giao diện và các module liên quan)

1. **Phát sinh khi nhập kho** từ nhà cung cấp, không phải khi đặt đơn (ghi trên trang và trên form đơn nhập).
2. Hạn thanh toán = **ngày nhập kho + số ngày được nợ** của NCC (module Nhà cung cấp).
3. **Tổng phải trả** trên trang tính theo các NCC đang hiện (trang này), còn số dư tổng thể lấy từ báo cáo Số dư công nợ tính trên toàn bộ lịch sử.
4. Tiền trả trước chưa gán vào khoản nợ thì không trừ vào tuổi nợ (xem báo cáo Tuổi nợ).

---

## 3. Liên kết

- Từ trang chi tiết NCC: nút **Xem sổ công nợ** — đích chưa mở được vì chưa có NCC nào có công nợ. Cần xác minh đích là trang này hay sổ chi tiết riêng.
- Từ menu dòng NCC: **Lập phiếu chi** — tạo phiếu chi trả NCC (module Phiếu thu chi).
- Đối chiếu với báo cáo: Số dư công nợ (`/bao-cao?name=cong-no`) và Tuổi nợ (`/bao-cao?name=tuoi-no`) — báo cáo phía khách hàng; chưa thấy báo cáo tương đương phía NCC trong menu báo cáo. Cần xác minh.

---

## 4. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị.
- Cần xác minh: nút "Chỉ đối tác còn nợ" bật sẵn có phải là mặc định không.
- Cần xác minh: báo cáo Công nợ và Tuổi nợ trong menu Báo cáo có ngầm hiểu là phải thu (khách hàng); không có lựa chọn phải trả nhà cung cấp rõ ràng trong menu. Ở Tuổi nợ có tuỳ chọn "Phải trả nhà cung cấp" trong trang tuổi nợ (module 16).

---

## 5. Chưa xác minh / cần dữ liệu

- Bảng danh sách công nợ NCC và cột thực tế.
- Sổ công nợ chi tiết từng NCC (các khoản phát sinh, thanh toán, đối trừ).
- Luồng đối trừ công nợ (quyền `debt.settle`) và điều chỉnh (`debt.adjust`).
- Cách hiển thị "quá hạn" và đếm số khoản.
- Thông báo khi chưa có dữ liệu sổ chi tiết.
