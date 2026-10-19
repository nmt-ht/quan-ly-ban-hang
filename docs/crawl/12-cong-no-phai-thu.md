# Công nợ phải thu — `/cong-no/khach-hang`

Trạng thái: **xong (cấu trúc + sổ chi tiết)**. Production có 1 khách còn nợ (KH0000002) với một phiếu thu trả trước.

---

## 1. Danh sách — `/cong-no/khach-hang`

### Tiêu đề & đếm
- Tiêu đề: "Công nợ phải thu"; phụ đề: "N khách hàng".

### Hành động đầu trang
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Báo cáo tuổi nợ | Mở Tuổi nợ (`/cong-no/tuoi-no`) |

### Bộ lọc
- Ô tìm: "Tìm khách hàng…".
- Nút bật/tắt **Chỉ đối tác còn nợ** (đang bật sẵn, nền đen).

### Thẻ tổng hợp
- **Tổng phải thu (trang này)** — mẫu: −10.000.000 ₫ (số âm nghĩa là khách đang có trả trước vượt công nợ).
- **Trong đó quá hạn** — mẫu: 0 ₫.

### Cột bảng
MÃ / TÊN · ĐƯỢC NỢ · SỐ KHOẢN · TRẢ TRƯỚC · QUÁ HẠN · SỐ DƯ

Dòng mẫu: KH0000002 · Tú Aloha · **Trả ngay** · 1 khoản · trả trước 10.000.000 ₫ · quá hạn — · số dư −10.000.000 ₫.

Mỗi dòng bấm vào để mở **Sổ chi tiết công nợ** (URL có tham số `partnerId`).

### Trạng thái rỗng
Chưa thấy (có 1 khách). Thông điệp khi không có công nợ chưa xác minh — trang Công nợ phải trả có "Không có công nợ phải trả", có thể tương tự.

---

## 2. Sổ chi tiết công nợ — `/cong-no/khach-hang?partnerId=<id>`

Tiêu đề: "Sổ chi tiết công nợ"; ngay dưới là **Số dư: −10.000.000 ₫** của khách.

Nút đầu trang:
- **Xem khách hàng** — mở trang chi tiết khách.
- **Biên bản đối chiếu** — biên bản in để hai bên đối chiếu (chưa mở).
- **Lập phiếu thu** — mở form phiếu thu với khách đã chọn.

Bảng: **NGÀY · LOẠI · CHỨNG TỪ GỐC · PHÁT SINH · ĐÃ ĐỐI TRỪ · CÒN LẠI · HẠN THANH TOÁN**

Dòng mẫu: 05/09/2026 · Phiếu thu · PT0000001 · phát sinh −10.000.000 ₫ · đã đối trừ — · còn lại 10.000.000 ₫ (ghi chú "chưa dùng") · hạn thanh toán — .

Nhận xét: cột CÒN LẠI của một phiếu thu trả trước hiển thị số dương 10.000.000 ₫ với nhãn "chưa dùng", trong khi cột PHÁT SINH âm. Đây là cách đổi dấu cho khoản tiền khách đã trả. Cần xác minh khi làm lại.

---

## 3. Quy tắc nghiệp vụ (từ giao diện)

1. **Số dư tính trên TOÀN BỘ lịch sử**, không phụ thuộc khoảng ngày — đây là số hai bên cần chốt (ghi trên báo cáo Số dư công nợ).
2. **Đối tác đã tất toán (số dư 0) không hiện** trong danh sách khi bật "Chỉ đối tác còn nợ".
3. **Trả trước** là tiền đã nhận nhưng chưa gán vào khoản nợ nào; trả trước không trừ vào tuổi nợ cho đến khi gán.
4. Phiếu thu với loại "Thu tiền khách hàng" **làm giảm công nợ phải thu** của khách (gợi ý trên form phiếu thu).
5. Công nợ phải thu **chỉ phát sinh khi khách thực nhận hàng** (xem đơn hàng bán).
6. Hạn thanh toán của khoản nợ = ngày khách nhận hàng + số ngày được nợ; trường hợp "Trả ngay" thì không có hạn.

---

## 4. Liên kết

- Từ Khách hàng → Công nợ (khối "Công nợ phải thu" trên trang chi tiết khách).
- Từ Sổ chi tiết → Lập phiếu thu (module Phiếu thu chi).
- Từ Danh sách → Tuổi nợ (module 14).
- Báo cáo tương ứng: Số dư công nợ (`bao-cao?name=cong-no`) và Tuổi nợ (`bao-cao?name=tuoi-no`).

---

## 5. Lỗi / nghi ngờ

- **Dấu số tiền** trong sổ chi tiết: phát sinh âm nhưng còn lại dương cho cùng một phiếu thu (mục 2). Cần thống nhất quy ước dấu khi làm lại.
- **Biểu tượng "Trả ngay"** có nghĩa là số ngày nợ = 0, không phải "đã thanh toán". Nhãn dễ gây hiểu nhầm.

---

## 6. Chưa xác minh / cần dữ liệu

- Sổ chi tiết có nhiều dòng (phát sinh bán hàng, thu, đối trừ) — cách hiển thị và phân trang.
- Hành động đối trừ công nợ (quyền `debt.settle`) và điều chỉnh (`debt.adjust`).
- Nội dung "Biên bản đối chiếu" khi in.
- Cách hiển thị quá hạn trên từng dòng.
- Thông điệp khi không có công nợ.
