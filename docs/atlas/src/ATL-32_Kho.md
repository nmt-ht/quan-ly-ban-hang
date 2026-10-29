---
title: Danh mục kho
Mã tài liệu: ATL-32
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/kho, /thiet-lap/kho/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Khai báo các kho — mỗi kho là một nơi hàng nằm, ví dụ Kho vật tư, Kho thành phẩm. Tồn kho, phiếu nhập / xuất / chuyển / kiểm kê đều tính theo kho. Trang chi tiết kho cho xem nhanh hàng trong kho và các phiếu của kho.

## Đối tượng sử dụng

- CEO / Quản lý: thêm, sửa, ngừng dùng kho.
- Thủ kho: xem hàng và phiếu của kho mình phụ trách.

## Quyền liên quan

warehouse.view / create / update / delete. Giá trị tồn của kho cần stock.view_value hoặc product.view_cost_price.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm kho → Gán thủ kho → Dùng trong phiếu kho, đơn, hàng hoá → Ngừng dùng khi không dùng nữa
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Bấm "Thêm kho": tên kho (mã KHO + số tự cấp), địa chỉ, điện thoại kho, thủ kho, ghi chú. | Kho chọn được ở phiếu kho, đơn nhập (kho nhập), đơn bán (kho xuất), kho ngầm định của hàng hoá. |
| 2 | Quản lý | Mở chi tiết kho. | Thẻ số liệu (mặt hàng còn tồn, giá trị tồn theo giá vốn bình quân, số phiếu); tab Hàng trong kho (mã, tên, ĐVT, tồn, tối thiểu); tab Phiếu kho của kho; danh sách hàng nhận kho này làm kho ngầm định. |
| 3 | Thủ kho | Bấm "Xem tồn kho" / "Xem phiếu kho" / "Lập phiếu nhập". | Mở Tồn kho hoặc Phiếu kho đã lọc theo kho này, hoặc form phiếu nhập chọn sẵn kho. |
| 4 | Quản lý | Ngừng dùng / Dùng lại. | Kho ngừng dùng không chọn được cho chứng từ mới; lịch sử giữ nguyên. |
| 5 | Quản lý | Xoá kho chưa có phát sinh. | Kho đã có tồn, phiếu hoặc dòng chứng từ thì không xoá được — chọn Ngừng dùng. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách kho | Mô tả "Mỗi kho là một nơi hàng nằm…"; cột Mã kho, Tên kho, Địa chỉ, Thủ kho, Mặt hàng còn tồn, Trạng thái, Thao tác (Sửa, Ngừng dùng / Dùng lại, Xoá). |
| Chi tiết kho | Thông tin kho; thẻ số liệu; tab Hàng trong kho và Phiếu kho (đọc từ máy chủ trên toàn bộ lịch sử); nút Xem tồn kho, Xem phiếu kho, Lập phiếu nhập. |

# 4. Quy tắc nghiệp vụ

1. **Thủ kho** phải là người dùng đang hoạt động, có chức vụ được lập phiếu kho hoặc kiểm kê.
1. Không xoá kho đã có tồn, phiếu kho hoặc dòng chứng từ — giữ lại để không mất lịch sử tồn kho; dùng Ngừng dùng.
1. Hàng chuyển giữa các kho bằng phiếu chuyển kho (ATL-06).
1. Doanh nghiệp mới được tạo sẵn một "Kho chính".

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, name | KHO + 7 số, chuỗi | Mã kho, tên kho. |
| address, phone | Chuỗi | Địa chỉ, điện thoại kho. |
| managerId | Mã người dùng | Thủ kho. |
| note, isActive | Chuỗi, cờ | Ghi chú, đang dùng. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Tồn kho (ATL-05), Phiếu kho (ATL-06) | Tồn và phiếu theo kho. |
| Hàng hoá (ATL-04) | Kho ngầm định, tồn tối thiểu theo kho. |
| Đơn nhập (ATL-09), Đơn bán (ATL-12), Lệnh sản xuất (ATL-07) | Kho nhập / xuất. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Xoá kho đã có phát sinh | Báo kho đã có tồn / phiếu — "chọn Ngừng dùng thay vì xoá". |
| Chọn thủ kho không hợp lệ | "Thủ kho phải là người đang hoạt động, có chức vụ được lập phiếu kho hoặc kiểm kê." |
| Mở kho không tồn tại | "Không tìm thấy kho" kèm nút về danh sách. |

# 8. Ghi chú & giới hạn hiện tại

- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
