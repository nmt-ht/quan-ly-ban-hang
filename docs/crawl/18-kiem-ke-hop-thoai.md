# Kiểm kê form và hộp thoại

> Cập nhật: các mục "Chỉ thấy nút" cho Sửa xe, Sửa thẻ, Đổi mật khẩu, Sửa khách, Lập phiếu thu/chi từ menu, Gắn thẻ, Thêm khách nhanh đã được mở và đọc trong `19-hop-thoai-bo-sung.md`. Bảng dưới giữ nguyên trạng thái lúc kiểm kê đầu tiên.

Mục đích: liệt kê mọi form, hộp thoại và hành động mở ra được trong app, để thấy cái nào đã đọc, cái nào chưa.

Quy ước: **Đã đọc** = đã mở và ghi trường/nội dung. **Chỉ thấy nút** = nhìn thấy nhưng không mở. **Chưa thử** = chưa bấm. **Treo** = bấm làm treo tab trình duyệt.

## Hộp thoại (modal)

| Màn | Hộp thoại / hành động | Trạng thái | Ghi chú |
|---|---|---|---|
| Chuyến giao hàng | Tạo chuyến giao hàng | Đã đọc | Lần đầu làm treo tab; mở lại được bằng ref |
| Danh mục xe | Thêm xe | Đã đọc | Có danh sách loại xe; dropdown tình trạng chỉ thấy "Đang dùng" |
| Danh mục xe | Sửa xe | Chỉ thấy nút | Chưa mở |
| Thẻ đánh dấu | Thêm thẻ | Đã đọc | Có 12 màu |
| Thẻ đánh dấu | Sửa / Xoá thẻ | Chỉ thấy nút | Không bấm |
| Người dùng | Thêm người dùng | Đã đọc | Có gợi ý mật khẩu và checkbox hoạt động |
| Người dùng | Đặt lại mật khẩu (chìa khoá) | Chỉ thấy nút | Chưa mở |
| Người dùng | Sửa người dùng (bút chì) | Chỉ thấy nút | Chưa mở |
| Phiếu thu chi › Tài khoản tiền | Thêm tài khoản tiền | Đã đọc | Có form ngân hàng; không chép giá trị mẫu |
| Tài khoản tiền | Sửa / Ngừng dùng tài khoản | Chỉ thấy nút | Chưa mở |
| Hàng hoá | Nhập hàng hoá (Excel) | Treo | Hai lần làm treo tab, nghi là hộp chọn file hệ điều hành |
| Hàng hoá | Nhập định mức | Chưa thử | Chưa bấm |
| Header | Menu người dùng › Đổi mật khẩu | Chỉ thấy nút | Chưa mở |
| Header | Menu người dùng › Đăng xuất | Chỉ thấy nút | Không bấm |

## Form (trang riêng)

| Màn | Form | Trạng thái |
|---|---|---|
| Hàng hoá | Thêm hàng hoá | Đã đọc |
| Hàng hoá | Sửa hàng hoá | Chưa mở (không có mặt hàng) |
| Khách hàng | Thêm khách hàng | Đã đọc |
| Khách hàng | Sửa khách hàng | Chưa mở |
| Khách hàng | Lập phiếu thu (từ menu dòng / sổ chi tiết) | Chỉ thấy nút |
| Khách hàng | Thêm khách nhanh (biểu tượng cạnh dropdown trên đơn bán) | Chưa thử |
| Khách hàng | Ngừng theo dõi | Chỉ thấy nút, không bấm |
| Nhà cung cấp | Thêm nhà cung cấp | Đã đọc |
| Nhà cung cấp | Sửa nhà cung cấp | Đã đọc |
| Nhà cung cấp | Thêm mặt hàng vào danh mục NCC | Đã đọc (trong tab) |
| Nhà cung cấp | Lập phiếu chi (từ menu dòng) | Chỉ thấy nút |
| Nhà cung cấp | Ngừng hợp tác | Chỉ thấy nút, không bấm |
| Đơn nhập hàng | Lập đơn nhập | Đã đọc |
| Đơn hàng bán | Lập đơn hàng | Đã đọc |
| Đơn hàng bán | Gắn thẻ (trong form) | Chưa thử |
| Phiếu kho | Phiếu nhập / xuất / chuyển / kiểm kê | Đã đọc (4) |
| Phiếu thu chi | Phiếu thu | Đã đọc |
| Phiếu thu chi | Phiếu chi | Đã đọc |
| Thiết lập | Chức vụ & phân quyền (ma trận quyền) | Đã đọc |
| Thiết lập | Thông tin công ty | Đã đọc (không lưu) |
| Thiết lập | Thêm chức vụ | Không có nút |
| Lệnh sản xuất | Lập lệnh sản xuất | Không có nút ở màn này (chỉ có lối tắt sang đơn bán) |

## Trang in và xem trước

| Màn | Nội dung | Trạng thái |
|---|---|---|
| Chuyến giao hàng | Phiếu soạn hàng | Chỉ thấy nút |
| Chuyến giao hàng | Phiếu giao hàng | Chỉ thấy nút |
| Công nợ phải thu | Biên bản đối chiếu | Chỉ thấy nút |
| Thông tin công ty | Xem trước tiêu đề phiếu in | Đã đọc |

## Dropdown và bộ lọc

Đa số bộ lọc đã mở và ghi lựa chọn (tồn kho, phiếu kho, lệnh SX, đơn nhập, khách hàng, đơn bán, chuyến, công nợ, tuổi nợ, thu chi, báo cáo). Còn lại:
- Chọn kỳ trên một số màn: đã thấy danh sách preset, chưa thử từng lựa chọn.
- Giá trị đơn (đơn nhập, đơn bán): đã thấy khung Từ–Đến, chưa thử nhập.
- Một số dropdown bấm không mở ra (tồn kho sắp xếp và chọn kỳ lúc đầu), đã thử lại được.

## Kết luận

Đã đọc đầy đủ các form tạo mới chính và các hộp thoại tạo chuyến, xe, thẻ, người dùng, tài khoản tiền. Chưa mở: các form sửa, đổi mật khẩu, đặt lại mật khẩu, lập phiếu từ menu dòng, nhập Excel, nhập định mức, các phiếu in, và mọi hành động trên dữ liệu thật vì production trống. Các mục này cần staging (phương án A) để hoàn thiện.
