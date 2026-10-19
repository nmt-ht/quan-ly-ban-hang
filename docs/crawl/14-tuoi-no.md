# Tuổi nợ — `/cong-no/tuoi-no`

Trạng thái: **xong (cấu trúc)**. Trang đang rỗng cho phải trả nhà cung cấp. Chưa mở được bảng phải thu với dữ liệu, vì bảng phải thu chỉ có khoản trả trước (không có nợ quá hạn).

---

## 1. Màn hình

### Tiêu đề & mô tả
- Tiêu đề: "Tuổi nợ"
- Mô tả: "Công nợ phải trả chia theo số ngày quá hạn" (khi chọn phải trả) — đổi theo lựa chọn bên dưới.

### Hành động đầu trang
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Sổ công nợ | Mở sổ chi tiết công nợ (đích cụ thể chưa xác minh) |

### Bộ lọc
- **Loại công nợ** (dropdown, 2 lựa chọn):
  1. **Phải trả nhà cung cấp** (mặc định)
  2. **Phải thu khách hàng**
- Ô tìm: "Tìm nhà cung cấp…" (đổi thành "Tìm khách hàng…" khi chọn phải thu — chưa xác minh).

### Thẻ phân bổ theo số ngày quá hạn
Sáu thẻ, cùng một thứ tự:
1. **Chưa đến hạn**
2. **Quá hạn 1–30**
3. **31–60 ngày**
4. **61–90 ngày**
5. **Trên 90 ngày**
6. **Tổng còn nợ**

Thẻ quá hạn hiển thị số màu đỏ nhạt; "Chưa đến hạn" và "Tổng còn nợ" màu đen. Mẫu: tất cả 0 ₫.

### Trạng thái rỗng (phải trả, hiện tại)
- Tiêu đề: "Không có khoản nợ nào đang mở"
- Mô tả: "Mọi khoản phải trả đã được đối trừ hết."

---

## 2. Quy tắc nghiệp vụ (từ giao diện và báo cáo)

1. **Chỉ tính khoản TĂNG NỢ còn chưa trả hết.** Tiền trả trước không trừ vào tuổi nợ vì chưa gán được vào khoản cụ thể.
2. **Khoản chưa khai hạn thanh toán** xếp vào cột "Chưa đến hạn".
3. **Số ngày quá hạn** tính từ hạn thanh toán của khoản đó: hạn = ngày nhập kho (phải trả) hoặc ngày khách nhận hàng (phải thu) + số ngày được nợ.
4. **Trang tuổi nợ là báo cáo hiện trạng**, không lọc theo khoảng ngày (ghi trên báo cáo Tuổi nợ phải thu).
5. Trên màn hình Công nợ phải trả, nút **Báo cáo tuổi nợ** dẫn tới trang này.

---

## 3. Liên kết với báo cáo

- Báo cáo **Tuổi nợ phải thu** (`/bao-cao?name=tuoi-no`) cùng logic với bảng phải thu ở đây. Báo cáo này có bộ lọc "Cách nhóm" với lựa chọn "Phải thu khách hàng".
- Báo cáo phía phải trả: chưa thấy trong menu báo cáo (xem `07-cong-no-phai-tra.md`).

---

## 4. Lỗi / nghi ngờ

- **Thiếu báo cáo tuổi nợ phải trả trong menu Báo cáo**: trang Tuổi nợ này có lựa chọn phải trả, nhưng menu báo cáo chỉ có tuổi nợ phải thu. Cần thống nhất khi làm lại.
- Chưa thử lựa chọn "Phải thu khách hàng" trên trang này, nên chưa xác minh nhãn và ô tìm đổi thế nào.

---

## 5. Chưa xác minh / cần dữ liệu

- Bảng phải thu khi có khoản nợ quá hạn (cột, số khoản, khách).
- Cách đổi tiêu đề / nhãn khi chọn phải thu.
- Nút "Sổ công nợ" dẫn đến đâu (sổ tổng hợp hay sổ chi tiết theo đối tác).
- Số ngày quá hạn cho khoản thuộc ranh giới (đúng 30, 60, 90 ngày).
