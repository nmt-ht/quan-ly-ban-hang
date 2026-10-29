---
title: Nhóm hàng
Mã tài liệu: ATL-33
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/nhom-hang
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Chia danh mục hàng hoá theo cách của doanh nghiệp — ví dụ Khung tranh, Kính - Mica, Phụ kiện — để lọc hàng hoá, tồn kho nhanh, nhóm số liệu trong báo cáo và áp khuyến mãi theo nhóm.

## Đối tượng sử dụng

- CEO / Quản lý: thêm, đổi tên, xoá nhóm.

## Quyền liên quan

category.view / create / update / delete.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm nhóm → Gán nhóm cho hàng hoá (ATL-04) → Lọc / báo cáo theo nhóm → Xoá nhóm (chuyển mặt hàng trước)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Quản lý | Bấm "Thêm nhóm", nhập tên nhóm, Lưu. | Nhóm chọn được ở form hàng hoá. |
| 2 | Quản lý | Mở một nhóm để xem mặt hàng thuộc nhóm (mã, tên, tính chất). | "Nhóm chưa có mặt hàng nào." khi rỗng. |
| 3 | Quản lý | Đổi tên nhóm. | Hàng hoá và báo cáo đổi theo. |
| 4 | Quản lý | Xoá nhóm: nếu nhóm còn mặt hàng thì chọn nhóm để chuyển sang, hoặc "— Không thuộc nhóm nào —". | Mặt hàng chuyển nhóm rồi nhóm bị xoá. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách nhóm | Tên nhóm, số mặt hàng theo tính chất (Vật tư / Thành phẩm / Dịch vụ), thao tác Sửa / Xoá; nhóm ảo "Chưa phân nhóm" gom hàng chưa có nhóm. |
| Hộp xoá nhóm | Ô "Chọn nhóm…" để chuyển các mặt hàng đang thuộc nhóm; nút Không xoá / Xoá. |

# 4. Quy tắc nghiệp vụ

1. Nhóm còn mặt hàng chỉ xoá được khi đã chọn nơi chuyển các mặt hàng (nhóm khác hoặc không nhóm) — xoá trong cùng một giao dịch.
1. Nhóm hàng dùng ở: lọc Hàng hoá và Tồn kho, cách nhóm "Theo nhóm hàng" của báo cáo Doanh thu / Lãi gộp, Cơ cấu tồn kho ở Tổng quan, phạm vi khuyến mãi (ATL-30).

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| name | Chuỗi | Tên nhóm. |
| Product.categoryId | Mã | Nhóm của mặt hàng; trống = chưa phân nhóm. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Hàng hoá (ATL-04) | Gán nhóm cho mặt hàng. |
| Tồn kho (ATL-05), Báo cáo (ATL-03), Tổng quan (ATL-02) | Lọc và nhóm số liệu. |
| Khuyến mãi (ATL-30) | Áp khuyến mãi theo nhóm hàng. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Xoá nhóm còn mặt hàng mà chưa chọn nơi chuyển | Báo "Nhóm … đang có N mặt hàng — chọn nhóm chuyển các mặt hàng sang trước khi xoá." |
| Chọn nhóm chuyển không hợp lệ | "Nhóm hàng chuyển sang không hợp lệ". |

# 8. Ghi chú & giới hạn hiện tại

- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
