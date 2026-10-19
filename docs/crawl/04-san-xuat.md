# Lệnh sản xuất — `/san-xuat`

Trạng thái: **xong (cấu trúc)**. Production không có lệnh nào nên chưa đọc được bảng kết quả, chi tiết lệnh, hay các bước chuyển trạng thái thực tế.

---

## 1. Mục đích

Quản lý lệnh sản xuất thành phẩm. Lệnh được lập từ đơn bán hàng có thành phẩm. Khi lập, lệnh chụp lại bản sao định mức (BOM) tại thời điểm đó. Vật tư được xuất kho khi bắt đầu sản xuất.

Nguyên văn trên trang khi rỗng:
> "Lệnh sản xuất lập từ ĐƠN HÀNG — mở đơn có thành phẩm rồi bấm Lập lệnh sản xuất. Lệnh chụp bản sao định mức lúc tạo và xuất vật tư khi bắt đầu."

## 2. Tiêu đề & đếm

- Tiêu đề: "Lệnh sản xuất"
- Phụ đề: "N lệnh"

## 3. Hành động

| Nút | Vị trí | Hành vi |
|---|---|---|
| Xuất Excel | đầu trang, bên phải | Chưa thử (cần xin phép tải file) |
| Đơn chờ sản xuất | đầu trang, bên phải | Mở **Đơn hàng bán** với bộ lọc `status=PENDING` (nhãn "Chờ sản xuất") |
| Xem đơn chờ sản xuất | trạng thái rỗng | Cùng đích với nút trên |

Quan trọng: **không có nút "Lập lệnh sản xuất" ở trang này**. Lệnh được lập từ màn hình đơn bán hàng (theo gợi ý trong mô tả). Cần crawl ở module Đơn hàng bán để xác nhận nút đó và điều kiện hiển thị.

## 4. Bộ lọc

- **Ô tìm**: "Tìm mã lệnh, thành phẩm..." — tìm theo mã lệnh hoặc thành phẩm.
- **Trạng thái** (dropdown, chọn 1 hoặc nhiều — chưa rõ):
  1. Nháp
  2. Đang sản xuất
  3. Hoàn thành
  4. Đã huỷ
- **Chọn kỳ** (dropdown preset) và ô **dd/mm/yyyy → dd/mm/yyyy** (khoảng tuỳ chọn).

Danh sách preset Chọn kỳ (dùng chung, đã thấy trên trang này):
- Ngày: Hôm nay · Hôm qua · 7 ngày qua · 30 ngày qua
- Tuần: Tuần này · Tuần trước
- Tháng: Tháng này · Tháng trước
- Quý: Quý này · Quý trước
- Năm: Năm nay · Năm trước
- Toàn bộ (bỏ lọc ngày)

Mặc định khi mở trang là chưa lọc ngày (ô ngày để trống).

## 5. Trạng thái rỗng (nguyên văn)

- Tiêu đề: "Chưa có lệnh sản xuất nào"
- Mô tả: xem mục 1.

## 6. Cột bảng

Chưa thấy vì bảng rỗng. Cần dữ liệu để đọc.

## 7. Trạng thái lệnh & liên kết với đơn bán

Các trạng thái lệnh sản xuất (theo bộ lọc): **Nháp → Đang sản xuất → Hoàn thành**, và **Đã huỷ** ở nhánh huỷ. Chuyển đổi giữa các trạng thái chưa xác minh được.

Liên kết với trạng thái đơn bán hàng (đã thấy trong bộ lọc của Đơn hàng bán):
- Đơn bán có trạng thái **Chờ sản xuất** khi có thành phẩm cần làm.
- Đơn bán có trạng thái **Đang sản xuất** khi đang làm.
- Sau đó: Chờ giao hàng → Đang giao → Hoàn thành / Giao một phần / Trả toàn bộ, hoặc Đã huỷ.

Ghi chú: trạng thái lệnh (Nháp/Đang sản xuất/Hoàn thành/Đã huỷ) khác với trạng thái đơn (Chờ sản xuất/Đang sản xuất/...). Cần xác minh cách hai bộ trạng thái này đồng bộ với nhau.

## 8. Quy tắc nghiệp vụ (từ giao diện)

1. Lệnh lập từ đơn hàng có thành phẩm.
2. Lệnh **chụp bản sao định mức lúc tạo**. Thay đổi định mức sau đó không ảnh hưởng lệnh đã tạo.
3. **Vật tư được xuất kho khi bắt đầu** sản xuất, không phải lúc lập lệnh.
4. Báo cáo Sản xuất chỉ tính lệnh đã **HOÀN THÀNH**; giá thành chia cho số thực nhập kho, nên hàng hỏng làm tăng giá thành đơn vị (xem `02-bao-cao.md`).

## 9. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị trong module này.
- Cần xác minh: có nút "Lập lệnh sản xuất" ở đơn bán hàng không và điều kiện hiện nút.
- Cần xác minh: dropdown Trạng thái là chọn đơn hay chọn nhiều (checkbox).

## 10. Mâu thuẫn với bản thiết kế hiện tại (cần sửa khi rebuild)

Bản Angular/Prisma đã làm trước đó dùng enum `CHO_DUYET / DANG_SAN_XUAT / HOAN_TAT / HUY` cho lệnh sản xuất. Giao diện thật dùng **Nháp / Đang sản xuất / Hoàn thành / Đã huỷ**. Cần cập nhật `ProductionOrderStatus` cho khớp (`NHAP`, `DANG_SAN_XUAT`, `HOAN_TAT`, `HUY`).

## 11. Chưa xác minh / cần dữ liệu

- Bảng danh sách: cột, định dạng, sắp xếp, phân trang.
- Trang chi tiết lệnh: các tab, bảng vật tư (BOM snapshot), tiến độ.
- Form lập lệnh (nếu có) và điều kiện lập.
- Các bước chuyển trạng thái, người thực hiện, nút hành động theo trạng thái.
- Hành vi huỷ lệnh đã xuất vật tư hay chưa.
- Phiếu xuất kho vật tư sinh ra khi bắt đầu lệnh (liên kết với module Phiếu kho).
