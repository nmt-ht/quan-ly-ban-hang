# Hàng hoá — `/hang-hoa`

Trạng thái: **xong (cấu trúc)**. Production chưa có mặt hàng nào. Form thêm mới đã đọc đầy đủ ở phiên đầu. Các hành động nhập Excel và nhập định mức chưa mở được (xem mục 5).

---

## 1. Danh mục — `/hang-hoa`

### Tiêu đề & đếm
- Tiêu đề: "Danh mục hàng hoá"; phụ đề: "N mặt hàng".

### Hành động đầu trang
| Nút | Hành vi |
|---|---|
| Xuất Excel | Chưa thử (cần xin phép tải file) |
| Lưới / Bảng | Chuyển kiểu hiển thị: thẻ lưới hoặc bảng |
| Nhập hàng hoá | Nhập danh mục từ file Excel — **không mở được trong crawl** (xem mục 5) |
| Nhập định mức | Nhập định mức (BOM) — **chưa mở được** |
| Thêm hàng hoá | Mở `/hang-hoa/them-moi` |

### Bộ lọc
- Ô tìm: "Tìm theo mã hệ thống, mã đối chiếu hoặc tên…".
- **Tính chất** (dropdown): Vật tư hàng hoá · Thành phẩm · Dịch vụ.
- **Nhóm hàng** (dropdown): danh mục nhóm (HH, Khung tranh, Kính - Mica - Hậu, Nẹp trang trí, Nhôm, NVL, Phụ kiện, TP).
- **Tất cả trạng thái** (dropdown): theo trạng thái kinh doanh.
- **Tồn tất cả kho** (dropdown): Tất cả kho · Kho Ninh Trang · Kho phụ kiện · Kho thành phẩm · Kho vật tư hàng hoá.
- Nút bật nhanh: **Tồn âm** · **Dưới tồn tối thiểu**.
- **Sắp xếp**: Tên A → Z (mặc định).

### Trạng thái rỗng (nguyên văn)
- Tiêu đề: "Chưa có mặt hàng nào"
- Mô tả: "Thêm mặt hàng đầu tiên hoặc nhập danh mục từ file Excel."
- Nút: **Thêm hàng hoá**.

### Cột
Chưa thấy vì danh sách rỗng. Trên form và các màn khác, mặt hàng hiện: mã (VT/SP/DV + số), tên, ĐVT, tồn tối thiểu, giá lẻ/sỉ/dropship.

---

## 2. Form thêm mới — `/hang-hoa/them-moi`

Tiêu đề: "Thêm hàng hoá" · đường dẫn: Danh mục hàng hoá / Thêm mới.

### Thông tin chung
| Nhãn | Kiểu | Bắt buộc | Mặc định / gợi ý |
|---|---|---|---|
| Tên hàng hoá | text | **có** (\*) | "VD: Khung nhôm 20*30 vàng" |
| Tính chất | dropdown | **có** (\*) | **Vật tư hàng hoá** · Thành phẩm · Dịch vụ (không có tồn kho). Gợi ý: "Quyết định tiền tố mã: VT / SP / DV." |
| Đơn vị tính chính | text | **có** (\*) | "VD: Cái, m, kg, TẤM" |
| Mã đối chiếu | text | — | "VD: 0625 vàng khung nhôm 20*30". Gợi ý: mã cũ bên MISA hoặc cách gọi quen thuộc, dùng để khớp khi nhập Excel. |
| Nhóm hàng | dropdown | — | **— Không thuộc nhóm nào —** và 8 nhóm |
| Kho ngầm định | dropdown | — | **— Không đặt —** và 4 kho |
| Tồn tối thiểu | số | — | 0. Gợi ý: dưới ngưỡng này sẽ vào danh sách cảnh báo. |
| Thuế suất GTGT (%) | số | — | 0 |
| Bảo hành (tháng) | số | — | 0 |
| Nguồn gốc | text | — | "VD: Việt Nam" |

### Giá bán
Gợi ý: "Giá theo đơn vị tính chính. Mức giá tự áp theo loại khách khi lên đơn, vẫn sửa tay được; giá được chốt vào dòng đơn hàng."
| Nhãn | Kiểu | Mặc định |
|---|---|---|
| Giá lẻ | số | 0 |
| Giá sỉ | số | 0 |
| Giá dropship | số | 0 |

### Đơn vị quy đổi
- Gợi ý: "Không giới hạn số đơn vị. Tồn kho luôn quy về đơn vị tính chính; mỗi đơn vị có giá bán riêng, tự tính sẵn theo tỷ lệ khi khai."
- Nút **Thêm đơn vị**. Trạng thái rỗng: "Chưa có đơn vị quy đổi. Mặt hàng chỉ dùng đơn vị tính chính."
- Mỗi đơn vị quy đổi: tên đơn vị, tỷ lệ so với đơn vị chính, giá bán riêng (tự tính theo tỷ lệ).

### Ghi chú
| Nhãn | Ghi chú |
|---|---|
| Diễn giải khi mua | text — hiện trên đơn nhập |
| Diễn giải khi bán | text — hiện trên đơn bán |
| Mô tả | textarea |
| Được phép bán | checkbox |
| Đang kinh doanh | checkbox |

Chân form: gợi ý "Điền thông tin rồi bấm Lưu" · **Huỷ** · **Thêm hàng hoá**.

---

## 3. Quy tắc nghiệp vụ (từ giao diện)

1. **Tiền tố mã theo tính chất**: VT (vật tư), SP (thành phẩm), DV (dịch vụ).
2. **Tồn kho luôn quy về đơn vị tính chính**; mỗi đơn vị quy đổi có giá bán riêng.
3. **Giá tự áp theo loại khách** khi lên đơn; sửa tay được; giá được **chốt vào dòng đơn** khi lưu.
4. **Dịch vụ không có tồn kho**.
5. **Mã đối chiếu** dùng để khớp khi nhập lại từ Excel (MISA).
6. **Tồn tối thiểu** kích hoạt cảnh báo; mặt hàng không còn kinh doanh không nằm trong báo cáo dưới tồn tối thiểu (xem `02-bao-cao.md`).
7. **Giá vốn** là quyền riêng (`product.view_cost_price`), không hiện cho Sale và Thủ kho (xem `15-thiet-lap.md`).
8. Mặt hàng có **nhiều nhà cung cấp**, mỗi NCC một giá mua (xem `05-nha-cung-cap.md`).

---

## 4. Lỗi / nghi ngờ

- Không phát hiện lỗi hiển thị.
- Cần xác minh: mã VT/SP/DV có thể đổi khi đổi tính chất sau khi tạo hay không.
- Cần xác minh: mặt hàng "ngừng kinh doanh" khi có tồn còn tồn tại thế nào.

---

## 5. Chưa xác minh / cần thao tác khác

- **Nhập hàng hoá từ Excel** và **Nhập định mức**: bấm nút làm treo tab trình duyệt trong hai lần thử. Nguyên nhân có khả năng cao là hộp chọn file của hệ điều hành mở ra và chặn trình duyệt. Không thử lại để tránh treo thêm. Cần bạn xác nhận hai màn này (mẫu file, cột, quy tắc khớp) bằng cách tự mở và chụp lại.
- Lưới và bảng: chỉ thấy khi có mặt hàng.
- Chi tiết mặt hàng: chưa có mặt hàng để mở.
- Form sửa mặt hàng và luồng ngừng kinh doanh.
- Định mức (BOM): cấu trúc khai báo, thành phần, tỷ lệ hao hụt — chưa thấy.
