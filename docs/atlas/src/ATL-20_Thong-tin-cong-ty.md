---
title: Thông tin công ty
Mã tài liệu: ATL-20
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/cong-ty
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Khai báo thông tin pháp nhân của công ty — in ở đầu mọi phiếu in (kèm logo) — và hai thiết lập nghiệp vụ dùng chung: **Khoá sổ kỳ kế toán** và **Cho xuất quá số tồn**. Trang có form, ô xem trước phiếu in cập nhật tức thì khi gõ, và nút Lưu rõ ràng.

## Đối tượng sử dụng

- CEO / Quản lý: thông tin công ty, xuất quá số tồn.
- Kế toán: khoá sổ / bỏ khoá sổ.

## Quyền liên quan

company.view / company.update (thông tin, logo, "Cho xuất quá số tồn"); period.lock (khoá sổ / bỏ khoá sổ: CEO, Quản lý, Kế toán).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Mở Thông tin công ty → Sửa thông tin / tải logo → Xem trước phiếu in → Lưu thay đổi
[next]
[flow] Mọi bản in dùng thông tin mới
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Sửa tên công ty, địa chỉ, mã số thuế, điện thoại, email, website. | Ô xem trước bên phải đổi ngay; thanh dưới hiện "Có thay đổi chưa lưu". |
| 2 | Quản lý | Tải logo (PNG, JPG hoặc WebP, tối đa 2 MB) hoặc Đổi / Xoá logo. | Ảnh được thu nhỏ còn tối đa 400 px; PNG giữ nền trong suốt. |
| 3 | Quản lý | Bấm "Lưu thay đổi" (hoặc "Huỷ thay đổi" để về bản đã lưu). | Thông báo "Đã lưu thông tin công ty. Các bản in sẽ dùng thông tin mới." |
| 4 | Kế toán | Thẻ "Khoá sổ kỳ kế toán": chọn "Khoá sổ đến ngày" rồi bấm Khoá sổ; hoặc Bỏ khoá sổ. | Mọi chứng từ có ngày từ ngày đó trở về trước không lập thêm và không huỷ được. |
| 5 | Quản lý | Thẻ "Xuất kho": bật / tắt "Cho xuất quá số tồn". | Bật (mặc định): xuất vượt tồn chỉ cảnh báo. Tắt: mọi chứng từ làm tồn âm bị từ chối, trừ người có quyền Xuất vượt tồn kho. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Logo | Khung xem trước logo (hoặc "Chưa có logo"), nút Tải logo lên / Đổi logo, Xoá logo; thông báo lỗi nếu file sai định dạng hoặc quá 2 MB. |
| Thông tin pháp lý | Tên công ty (bắt buộc), Địa chỉ, Mã số thuế, Điện thoại, Email, Website; thông báo lỗi ngay dưới từng ô. |
| Xem trước tiêu đề phiếu in | Một phiếu mẫu (PHIẾU XUẤT KHO, số và ngày chỉ minh hoạ) gồm: logo + tên công ty, các dòng có nhãn Địa chỉ / Mã số thuế / Điện thoại / Email / Website, tiêu đề, bảng hàng mẫu và các ô chữ ký — đúng bố cục sẽ in thật. |
| Khoá sổ kỳ kế toán | Ngày khoá hiện tại, ô "Khoá sổ đến ngày", nút Khoá sổ / Bỏ khoá sổ (không bị thanh Lưu che, thẳng hàng với ô ngày). |
| Xuất kho | Công tắc "Cho xuất quá số tồn" kèm giải thích tác động. |
| Thanh hành động | Trạng thái: "Đã lưu — chưa có thay đổi" / "Có thay đổi chưa lưu" / "Còn thông tin chưa hợp lệ"; nút Huỷ thay đổi, Lưu thay đổi (chỉ bật khi có thay đổi). |

# 4. Quy tắc nghiệp vụ

1. Chỉ **tên công ty** bắt buộc (tối đa 200 ký tự).
1. Mã số thuế: 10 chữ số (chi nhánh: 10 số + "-" + 3 số). Điện thoại: 8–15 ký tự gồm chữ số và + ( ) . -. Email đúng định dạng. Website dạng congty.vn (có thể kèm https://).
1. Xem trước dùng **cùng một component tiêu đề công ty** với mọi bản in nên hai nơi luôn giống nhau.
1. Chỉ in những mục đã điền; mỗi mục in kèm nhãn (Địa chỉ, Mã số thuế, Điện thoại, Email, Website).
1. Thông tin được lưu ở máy chủ, dùng chung cho mọi người dùng của công ty; lưu khi bấm Lưu thay đổi, không tự lưu khi gõ. Logo tải lên hiện cả ở góc trên menu trái (tự cắt phần lề trắng thừa), màn khởi động / đăng nhập và trên phiếu in.
1. **Khoá sổ:** chứng từ có ngày ≤ ngày khoá không lập / huỷ được — mọi phiếu kho, giao hàng, nhận hàng, trả hàng bán / mua, phiếu thu chi, thu tiền ngay, chốt giao, sản xuất. Số liệu kỳ đã báo cáo giữ nguyên. Khoá / bỏ khoá ghi vào Nhật ký.
1. **Cho xuất quá số tồn** (mặc định bật) áp cho mọi chứng từ làm giảm tồn: giao hàng, xuất chuyến, vật tư sản xuất, phiếu kho lập tay, huỷ phiếu nhập.

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name | Chuỗi | Tên công ty (bắt buộc). |
| address, taxCode, phone, email, website | Chuỗi | Thông tin liên hệ và thuế (tuỳ chọn). |
| logo | Data URL ảnh | Logo đã thu nhỏ (tuỳ chọn). |
| lockDate | Ngày | Khoá sổ đến ngày; trống = chưa khoá. |
| allowNegativeStock | Cờ | Cho xuất quá số tồn (mặc định bật). |
| displayColors | Bộ màu | Màu hiển thị đã đổi (ATL-24). |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Phiếu in (ATL-26) | Mọi phiếu in lấy logo và thông tin công ty từ đây. |
| Phiếu kho, Phiếu thu chi, Đơn hàng bán, Báo giá, Đơn nhập hàng, Chuyến giao hàng, Công nợ, Tuổi nợ, Hoá đơn xem trước | Các bản in dùng tiêu đề công ty. |
| Mọi chứng từ có ngày | Bị chặn khi ngày thuộc kỳ đã khoá sổ. |
| Phiếu kho (ATL-06), Tồn kho (ATL-05) | Áp "Cho xuất quá số tồn". |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Để trống tên công ty | Báo "Nhập tên công ty", nút Lưu đưa tới ô lỗi đầu tiên. |
| Chọn file không phải PNG/JPG/WebP | Báo "Chỉ nhận ảnh PNG, JPG hoặc WebP."; logo cũ giữ nguyên. |
| Ảnh lớn hơn 2 MB | Báo "Ảnh lớn hơn 2 MB — chọn ảnh nhỏ hơn." |
| Lập / huỷ chứng từ trong kỳ đã khoá sổ | Máy chủ từ chối, báo ngày khoá sổ. |

# 8. Ghi chú & giới hạn hiện tại

- Phiếu mẫu trong ô xem trước chỉ để minh hoạ bố cục; số phiếu "PXK0000123" và ngày không phải dữ liệu thật.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
