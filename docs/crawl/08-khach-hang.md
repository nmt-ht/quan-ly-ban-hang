# Khách hàng — `/khach-hang`

Trạng thái: **xong (cấu trúc + trang chi tiết)**. Có 3 khách hàng trong production (thêm 1 khách so với lần crawl trước). Chưa có đơn bán nên mục lịch sử mua là 0.

---

## 1. Danh sách — `/khach-hang`

### Tiêu đề & đếm
- Tiêu đề: "Khách hàng"; phụ đề: "N khách hàng".

### Hành động
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Thêm khách hàng | Mở `/khach-hang/them-moi` |
| `…` (mỗi dòng) | Menu: **Xem chi tiết** · **Sửa** · **Lập phiếu thu** |

### Bộ lọc & sắp xếp
- Ô tìm: "Tìm theo tên, mã, điện thoại, mã số thuế…".
- **Loại khách**: Sỉ · Lẻ · Dropship.
- **Thẻ**: danh sách thẻ đánh dấu (đã thấy "234234").
- **Trạng thái**: Tất cả trạng thái · Đang theo dõi · Ngừng theo dõi.
- **Sắp xếp**: Tên A → Z (mặc định) — các lựa chọn khác chưa mở.
- Phân trang: 20 dòng/trang.

### Cột bảng
MÃ / TÊN · LOẠI · THẺ · LIÊN HỆ · MÃ SỐ THUẾ · ĐƯỢC NỢ · ĐƠN HÀNG · TRẠNG THÁI

- MÃ / TÊN: mã KH + 7 chữ số; tên hiển thị bên dưới mã.
- LOẠI: badge "Lẻ" hoặc "Sỉ" (màu xanh nhạt).
- ĐƯỢC NỢ: số ngày được nợ (ví dụ "5 ngày"), hoặc "—" khi 0.
- TRẠNG THÁI: "Đang theo dõi".

### Dữ liệu mẫu (production)
| Mã | Tên | Loại | Điện thoại | Được nợ |
|---|---|---|---|---|
| KH0000001 | 1212 | Lẻ | — | — |
| KH0000002 | Tú Aloha | Sỉ | 0973724247 | — |
| KH0000003 | Xưởng Tranh Thờ Thiện Tâm | Sỉ | 0964245087 | 5 ngày |

---

## 2. Form thêm mới — `/khach-hang/them-moi`

Tiêu đề: "Thêm khách hàng"

### Thông tin chung
| Nhãn | Kiểu | Bắt buộc | Mặc định | Placeholder / gợi ý |
|---|---|---|---|---|
| Tên khách hàng | text | **có** (\*) | — | "VD: Nguyễn Văn A" |
| Tên công ty | text | — | — | "VD: Công ty TNHH Xây dựng B" · gợi ý: "Có tên công ty thì chứng từ hiện tên công ty." |
| Loại khách hàng | dropdown | — | **Lẻ** | Lẻ · Sỉ · Dropship · gợi ý: "Quyết định mức giá tự áp khi lên đơn bán." |
| Số ngày được nợ | số | — | 0 | gợi ý: "Hạn thanh toán tự tính = ngày khách nhận hàng + số ngày này." |
| Điện thoại | text | — | — | "0912345678" |
| Email | email | — | — | "khach@mail.com" |

### Giấy tờ
| Nhãn | Ghi chú |
|---|---|
| CCCD | text |
| MST cá nhân | text |
| MST công ty | text |
| Ghi chú | textarea |

### Khác
- **Thẻ đánh dấu** — nút "Gắn thẻ" (chọn từ danh mục thẻ).
- Checkbox **Đang theo dõi** — tick sẵn.
- Khối **Địa chỉ giao hàng**: "Địa chỉ giao hàng chưa khai báo được ở đợt này — danh mục Phường/Xã chưa nạp dữ liệu." (xem trang chi tiết bên dưới — chức năng này đã có ở trang chi tiết, nhưng form thêm vẫn báo chưa khai báo được).

Chân form: **Huỷ** · **Tạo khách hàng**.

---

## 3. Trang chi tiết — `/khach-hang/<id>`

Đầu trang:
- Tên lớn, badge loại (Sỉ), mã KH, nút sao chép mã.
- Nút: **Lập phiếu thu** · **Sửa** · **Ngừng theo dõi** (chuyển trạng thái, không xoá — không bấm khi crawl).

### Khối "Thông tin"
- Nhãn **"Tên cá nhân"** (giá trị tên khách) · **Tên công ty** · Điện thoại · Email · CCCD · MST cá nhân · MST công ty · Số ngày được nợ · Ngày tạo · Số đơn hàng.
- Mẫu: Xưởng Tranh Thờ Thiện Tâm · Điện thoại 0964245087 · Số ngày nợ 5 ngày · Ngày tạo 01/10/2026 · 0 đơn.

### Khối "Địa chỉ giao hàng"
- Nút **Thêm địa chỉ**.
- Trạng thái rỗng: "Chưa có địa chỉ giao hàng" — "Thêm điểm giao để lên đơn không phải gõ lại địa chỉ mỗi lần."
- Nhiều địa chỉ giao hàng cho một khách. Khác với form thêm (địa chỉ chưa khai báo được) — cần xác minh phần Phường/Xã đã nạp dữ liệu chưa.

### Khối "Lịch sử mua hàng"
- Các chỉ số: **Đã mua** (₫) · **Số đơn đã nhận** · **Trung bình mỗi đơn** · **Mua lần cuối**.
- Trạng thái rỗng: "Chưa mua" — "Khách chưa có đơn nào" — "Lịch sử sẽ hiện ở đây sau khi khách đặt đơn đầu tiên."

### Khối "Công nợ phải thu"
- Nút **Sổ chi tiết** (mở sổ công nợ của khách).
- Các chỉ số: **Số dư** (₫) · **Khoản còn nợ** · **Trả trước** (₫).
- Trạng thái: "Không còn công nợ" khi số dư bằng 0.

---

## 4. Dropdown chọn khách trên form đơn bán (xem chi tiết ở module Đơn hàng bán)

Mỗi dòng gợi ý: **mã · tên · điện thoại · badge số ngày nợ** (ví dụ "trả ngay", "5 ngày"). Có ô tìm trong dropdown, nhãn gần đúng: "Tìm tên, mã hoặc số điện thoại…" (đọc từ ảnh chụp, chưa đọc nguyên văn).

---

## 5. Quy tắc nghiệp vụ

1. **Loại khách quyết định mức giá tự áp** khi lên đơn bán (Lẻ / Sỉ / Dropship).
2. **Hạn thanh toán = ngày khách NHẬN hàng + số ngày được nợ**, không phải ngày đặt hàng (đồng nhất với nhà cung cấp, nhưng dùng mốc khác: ngày nhập kho bên NCC, ngày nhận hàng bên khách).
3. **Ngừng theo dõi** là chuyển trạng thái, không xoá. Khách ngừng theo dõi không xuất hiện trong báo cáo Khách ngừng mua (xem `02-bao-cao.md`).
4. Có thể có **nhiều địa chỉ giao hàng** cho một khách; mục đích là không phải gõ lại mỗi lần lên đơn.
5. Khối công nợ trên trang khách hiển thị số dư, khoản còn nợ và trả trước — trả trước chưa gán vào khoản nợ thì không trừ vào công nợ (xem báo cáo Tuổi nợ).

---

## 6. Lỗi / nghi ngờ

- **Mâu thuẫn về địa chỉ giao hàng**: form thêm báo "chưa khai báo được — danh mục Phường/Xã chưa nạp dữ liệu", nhưng trang chi tiết có nút "Thêm địa chỉ". Cần kiểm tra lại xem có địa chỉ nào thêm được hay không.
- Nhãn "Tên cá nhân" ở trang chi tiết khác với "Tên khách hàng" ở form — nên thống nhất khi làm lại.

---

## 7. Chưa xác minh / cần dữ liệu

- Thông báo lỗi khi lưu thiếu tên.
- Form "Sửa" của khách (có khác form thêm không).
- Sổ chi tiết công nợ của khách (các khoản, thanh toán).
- Lịch sử mua hàng khi có đơn.
- Hành vi trùng số điện thoại / mã số thuế.
- Dropdown sắp xếp đầy đủ.
