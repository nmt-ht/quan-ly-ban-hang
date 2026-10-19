# Tiến độ crawl

Cập nhật: 2026-10-03. Chế độ: chỉ đọc, không lưu, không tải file.

| # | Module | File | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 1 | Tổng quan | `01-tong-quan.md` | xong (cấu trúc & liên kết) | số liệu toàn 0; chưa đọc biểu đồ |
| 2 | Báo cáo | `02-bao-cao.md` | xong (21/21 báo cáo) | lỗi Thẻ kho hiển thị sai; chưa có số liệu |
| 3 | Hàng hoá | `17-hang-hoa.md` | xong (cấu trúc) | form thêm đầy đủ; nhập Excel và nhập định mức làm treo tab, chưa mở được |
| 4 | Tồn kho | `03-ton-kho.md` | xong (cấu trúc) | bộ lọc, sắp xếp, trạng thái rỗng |
| 5 | Phiếu kho | `03-ton-kho.md` | xong (cấu trúc) | 4 form lập phiếu; bộ lọc có "Nhập trả về" không có trong menu |
| 6 | Lệnh sản xuất | `04-san-xuat.md` | xong (cấu trúc) | trạng thái thật khác model hiện tại |
| 7 | Nhà cung cấp | `05-nha-cung-cap.md` | xong (cấu trúc + chi tiết) | ID kiểu cuid; chưa thử lưu |
| 8 | Đơn nhập hàng | `06-don-nhap-hang.md` | xong (cấu trúc) | 6 trạng thái; enum hiện tại sai |
| 9 | Công nợ phải trả | `07-cong-no-phai-tra.md` | xong (cấu trúc) | rỗng; chưa thấy báo cáo phía NCC |
| 10 | Khách hàng | `08-khach-hang.md` | xong (cấu trúc + chi tiết) | mâu thuẫn địa chỉ giao hàng |
| 11 | Đơn hàng bán | `09-don-hang-ban.md` | xong (cấu trúc) | 8 trạng thái; chưa có đơn để đọc chi tiết |
| 12 | Chuyến giao hàng | `10-chuyen-giao-hang.md` | xong (cấu trúc + chi tiết chuyến) | tài xế không đồng nhất; tab treo một lần |
| 13 | Danh mục xe | `11-danh-muc-xe.md` | xong (cấu trúc) | chưa mở form sửa |
| 14 | Công nợ phải thu | `12-cong-no-phai-thu.md` | xong (cấu trúc + sổ chi tiết) | dấu số tiền không nhất quán |
| 15 | Phiếu thu chi | `13-phieu-thu-chi.md` | xong (cấu trúc) | 2 form, loại thu chi, tài khoản tiền |
| 16 | Tuổi nợ | `14-tuoi-no.md` | xong (cấu trúc) | rỗng; chưa thử lựa chọn phải thu |
| 17 | Thiết lập | `15-thiet-lap.md` | xong (cấu trúc) | không thấy nút thêm/sửa/xoá chức vụ |
| 18 | Toàn cục | `16-toan-cuc.md` | xong (cấu trúc) | menu, layout, định dạng, lỗi ghi nhận |

Tổng hợp & điểm cần làm rõ: `00-tong-hop.md`.

## Còn thiếu (cần dữ liệu thử hoặc bạn thao tác)

Các phần này không thể hoàn thành khi production không có dữ liệu:

- Bảng kết quả và cột của Tồn kho, Phiếu kho, Đơn nhập, Đơn bán, Lệnh SX, Công nợ phải trả, Tuổi nợ phải thu.
- Trang chi tiết đơn bán, đơn nhập, lệnh SX, phiếu kho, phiếu in (phiếu soạn hàng, phiếu giao hàng, biên bản đối chiếu).
- Luồng chuyển trạng thái thật: đơn bán (Chờ sản xuất → … → Hoàn thành), chuyến (Gom đơn → Xuất kho → Về kho → Hoàn tất), lệnh SX, đơn nhập.
- Công thức và nội dung số liệu của các báo cáo.

Phương án để hoàn thiện (chờ bạn chọn, theo `00-strategy.md` mục 2): A) dữ liệu thử trên bản sao; B) bạn thao tác một luồng mẫu, mình quan sát.

## Cập nhật 2026-10-19

Đăng nhập bằng phiên Chrome của người dùng, chỉ đọc. Kiểm tra lại: Đơn hàng bán, Đơn nhập, Lệnh SX, Phiếu kho, Tồn kho, Hàng hoá đều vẫn 0 bản ghi; Chuyến giao hàng vẫn 6 chuyến (đều 0/0, 0 ₫); Danh mục xe vẫn 2 xe. Production chưa có dữ liệu mới nên các mục "Còn thiếu" bên trên không đổi. Đã bổ sung form Sửa xe vào `11-danh-muc-xe.md`. Dữ liệu giả cho bản dựng lại: xem `docs/demo-data.md`.
