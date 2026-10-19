# Thiết lập — `/thiet-lap/*`

Trạng thái: **xong (cấu trúc)**. Gồm 4 màn: Thông tin công ty, Thẻ đánh dấu, Người dùng, Chức vụ & phân quyền.

---

## 1. Thông tin công ty — `/thiet-lap/cong-ty`

Mô tả: "Hiện ở đầu mọi phiếu in: phiếu giao hàng, phiếu kho, phiếu thu chi, biên bản đối chiếu."

Khối **Thông tin pháp lý**:
| Nhãn | Bắt buộc | Ghi chú |
|---|---|---|
| Tên công ty | **có** (\*) | Mẫu: "Công ty Ninh Trang" |
| Địa chỉ | — | Placeholder "Số nhà, đường, phường/xã, tỉnh/TP" (chưa có giá trị) |
| Mã số thuế | — | — |
| Điện thoại | — | — |
| Email | — | — |
| Website | — | — |

Khối **Xem trước tiêu đề phiếu in**: tên công ty viết hoa · số phiếu mẫu PX0000123 · ngày mẫu 31/08/2026 · đường kẻ.

Chưa xác minh cách lưu (có nút Lưu hay tự lưu khi rời ô). Chưa thử đổi thông tin vì sẽ ghi dữ liệu thật.

---

## 2. Thẻ đánh dấu — `/thiet-lap/the`

Mô tả: "Một danh mục dùng chung cho đơn hàng và khách hàng." · nút **Thêm thẻ**.

Bảng: **THẺ · THỨ TỰ · ĐƠN HÀNG · KHÁCH HÀNG · TRẠNG THÁI** (+ sửa, xoá từng dòng).
- Thẻ hiển thị dạng nhãn màu. Mẫu: "234234" · 0 · 0 · 0 · Đang dùng.

Hộp thoại **Thêm thẻ**:
| Nhãn | Kiểu | Ghi chú |
|---|---|---|
| Tên thẻ | text | **Bắt buộc** (\*) · placeholder "VD: Khách VIP, Giao gấp, Nợ xấu" |
| Màu | 12 ô màu chọn sẵn | Xám · Đỏ · Cam · Hồ phách · Xanh chanh · Xanh ngọc · Xanh mòng két · Xanh lơ · **Xanh dương (mặc định)** · Chàm · Tím · Hồng |
| Thứ tự hiển thị | số | mặc định 0 |
| Đang dùng | checkbox | tick sẵn |

Gợi ý trong hộp thoại: màu chọn trong bảng có sẵn để thẻ đọc được ở cả giao diện sáng và tối (đọc từ ảnh chụp, chưa đọc nguyên văn).

Nút: **Huỷ** · **Lưu** (xám tới khi có tên thẻ).

Quy tắc: thẻ dùng chung cho **đơn bán** (gắn khi lập đơn) và **khách hàng** (gắn khi tạo khách). Bộ lọc Thẻ ở danh sách khách và đơn bán đọc từ danh mục này.

---

## 3. Người dùng — `/thiet-lap/nguoi-dung`

Mô tả trang: "N tài khoản" · nút **Thêm người dùng**. Ô tìm: "Tìm theo tên hoặc email…".

Bảng: **HỌ TÊN / EMAIL · CHỨC VỤ · ĐĂNG NHẬP GẦN NHẤT · TRẠNG THÁI · THAO TÁC**
- Dòng mẫu: Quản trị hệ thống (bạn) · admin@ninhtrang.local · CEO · đăng nhập gần nhất 03/10/2026 11:35 · "1 phiên đang mở" · Đang hoạt động.
- Thao tác: biểu tượng chìa khoá (**đặt lại mật khẩu**) và bút chì (**sửa**).

Hộp thoại **Thêm người dùng**:
| Nhãn | Bắt buộc | Ghi chú |
|---|---|---|
| Họ tên | **có** (\*) | Placeholder "VD: Nguyễn Văn A" |
| Email đăng nhập | **có** (\*) | Placeholder dạng "ten@ninhtrang.local" |
| Mật khẩu | **có** (\*) | Gợi ý: "Từ 8 ký tự, có cả chữ và số. Nhắn riêng cho nhân viên và bảo họ đổi lại." |
| Chức vụ | **có** (\*) | Dropdown 7 chức vụ. Gợi ý: "Chức vụ quyết định toàn bộ quyền hạn của tài khoản." |
| Đang hoạt động | checkbox | Tick sẵn. Nhãn: "(bỏ tick là không đăng nhập được nữa)" |

Nút: **Huỷ** · **Thêm người dùng**. Đóng bằng Escape (không lưu).

Quy tắc:
1. **Chức vụ quyết định toàn bộ quyền** của tài khoản (xem mục 4).
2. Mật khẩu tối thiểu 8 ký tự, có chữ và số; mật khẩu do người quản trị đặt, nhân viên được yêu cầu đổi khi nhận.
3. Bỏ tick "Đang hoạt động" là **khoá đăng nhập**, không xoá tài khoản.
4. Tài khoản đang đăng nhập có nhãn "(bạn)".

---

## 4. Chức vụ & phân quyền — `/thiet-lap/chuc-vu`

Tiêu đề: "Chức vụ & phân quyền" · "7 chức vụ".

Bảng chức vụ: **CHỨC VỤ · MÔ TẢ · NGƯỜI DÙNG · SỐ QUYỀN · TRẠNG THÁI**
| Chức vụ | Người dùng | Số quyền | Ghi chú |
|---|---|---|---|
| CEO (nhãn **Hệ thống**) | 1 | 98 | Toàn quyền, không gỡ được quyền |
| Quản lý | 0 | 89 | Duyệt đơn, duyệt lệnh SX, xem toàn bộ báo cáo, xem giá vốn |
| Kế toán | 0 | 47 | Thu chi, công nợ, đối trừ, báo cáo tài chính, xem giá vốn |
| Sale | 0 | 16 | Chăm khách, chốt đơn; **không** xem giá vốn |
| Thủ kho | 0 | 19 | Phiếu kho, kiểm kê, chuyển kho; **không** thấy giá nhập và giá vốn |
| Nhân viên giao hàng | 0 | 6 | Xem đơn được giao, chốt giao nhận, nhập số khách thực nhận |
| Nhân viên xưởng | 0 | 5 | Cập nhật tiến độ lệnh SX được giao |

Phần **Phân quyền — <chức vụ>**:
- Chọn một chức vụ trong bảng để xem quyền của chức vụ đó.
- Dropdown **Sao chép quyền từ chức vụ…** để copy bộ quyền từ chức vụ khác.
- Ô tìm: "Tìm quyền theo tên hoặc mã…".
- Các thẻ lọc theo nhóm: Tất cả · Thiết lập · Danh mục · Hàng hoá · Khách hàng · Nhà cung cấp · Quản lý kho · Mua hàng · Đơn hàng · Giao hàng · Sản xuất · Công nợ · Thu chi · Báo cáo.
- Mỗi nhóm có hộp chọn tổng (ví dụ "Người dùng (5/5)") và từng quyền có hộp chọn + mã kỹ thuật (ví dụ `user.view`).
- Chức vụ **CEO** bị khoá: ghi "Chức vụ hệ thống, không sửa được quyền". Các chức vụ khác tick/bỏ tick được.

Danh mục quyền (nhóm → số quyền): Người dùng 5 · Chức vụ 5 · Công ty 2 · Nhóm hàng 4 · Kho 4 · Thẻ 2 · Hàng hoá 7 · Giá 2 · Định mức 2 · Khách hàng 4 · Nhà cung cấp 5 · Tồn kho 2 · Phiếu kho 6 · Kiểm kê 1 · Đơn nhập hàng 6 · Đơn bán hàng 6 · Xe 4 · Chuyến giao hàng 7 · Lệnh sản xuất 6 · Công nợ 3 · Phiếu thu chi 6 · Tổng quan 1 · Báo cáo 8 (tổng 98 quyền).

Quan sát bổ sung:
- Chưa thấy nút **Thêm chức vụ**, **Sửa** hay **Xoá** chức vụ trên giao diện, dù danh mục quyền có quyền `position.create`, `position.update`, `position.delete`. Cần xác minh xem có ẩn theo quyền hay chưa được làm.

---

## 5. Quy tắc nghiệp vụ tổng hợp (từ giao diện)

1. **Phân quyền theo chức vụ**, không theo từng người dùng: mỗi người dùng có đúng một chức vụ.
2. **Quyền xem giá vốn** tách riêng khỏi quyền xem hàng hoá. Sale và Thủ kho không thấy giá vốn, nên báo cáo lãi gộp và bán dưới giá vốn không hiện với họ.
3. **Thông tin công ty** hiện ở đầu mọi phiếu in (giao hàng, kho, thu chi, biên bản đối chiếu).
4. **Thẻ** là danh mục dùng chung cho đơn bán và khách hàng.
5. **Khoá tài khoản** bằng cách bỏ tick "Đang hoạt động", không xoá.

---

## 6. Lỗi / nghi ngờ

- Không có nút thêm / sửa / xoá chức vụ trên giao diện (mục 4) — có thể là tính năng chưa hoàn thiện.
- Nhân viên được yêu cầu đổi mật khẩu khi đăng nhập lần đầu, nhưng chưa thấy cơ chế ép đổi trong giao diện (chưa thử với tài khoản mới).

---

## 7. Chưa xác minh / cần dữ liệu

- Hành vi thực tế khi lưu thông tin công ty (có thông báo không).
- Form sửa người dùng và luồng đặt lại mật khẩu.
- Quyền của Quản lý / Kế toán (đã mở được bảng, chưa đọc chi tiết từng quyền).
- Luồng "Sao chép quyền từ chức vụ".
- Thông báo lỗi khi trùng email.
