---
title: Danh mục xe
Mã tài liệu: ATL-14
Phân hệ: Bán hàng
Đường dẫn: /xe, /xe/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Danh mục phương tiện giao hàng: biển số, loại xe, tình trạng, hạn đăng kiểm và bảo hiểm, tài xế mặc định, và lịch sử chuyến của xe.

## Đối tượng sử dụng

- Điều vận / Quản lý: thêm sửa xe, theo dõi hạn giấy tờ.

## Quyền liên quan

vehicle.view / create / update; vehicle.manage_cost (nhập chi phí chuyến).

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Thêm xe → Khai báo hạn đăng kiểm & bảo hiểm → Gán tài xế mặc định → Dùng khi tạo chuyến
[next]
[flow] Theo dõi cảnh báo hạn
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Điều vận | Thêm xe: biển số, mã xe (XE + số, tự cấp), tên gọi, loại (xe tải, xe van, xe ba gác, xe máy, khác), tải trọng, ghi chú. | Biển số so khớp không phân biệt dấu chấm, gạch, khoảng trắng, hoa thường — không trùng. |
| 2 | Điều vận | Nhập hạn đăng kiểm và hạn bảo hiểm. | Tới hạn thì cảnh báo màu. |
| 3 | Điều vận | Gán tài xế thường chạy (nhân viên hoặc người thuê ngoài) và điện thoại. | Gán nhân viên thì tên tài xế là tên nhân viên; không thì tên gõ tay. |
| 4 | Điều vận | Bấm "Đưa vào bảo trì", "Ngừng dùng" hoặc "Đưa vào dùng". | Không xoá; lịch sử chuyến và chi phí giữ nguyên. |
| 5 | Điều vận | Mở chi tiết xe để xem chuyến đã chạy. | Chuyến đang dùng xe suy ra từ chuyến, không lưu trên xe. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo biển số, mã xe, tên gọi; lọc Loại xe, Tình trạng, nút "Giấy tờ sắp / quá hạn" (bỏ qua xe ngừng dùng, khớp với cảnh báo); bấm "Xem các xe này" ở cảnh báo thì danh sách báo rõ đang lọc và có nút Bỏ lọc; xuất Excel. Cột: Biển số, Mã xe, Tên gọi, Loại, Tải trọng, Tài xế thường chạy, Hạn đăng kiểm, Hạn bảo hiểm (có màu), Số chuyến, Chi phí chuyến, Tình trạng. |
| Hộp thoại thêm/sửa | Các trường xe và tài xế. |
| Chi tiết xe | Thông tin, giấy tờ, lịch sử chuyến và chi phí. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Đang dùng | Chọn được khi tạo chuyến. | Bảo trì; Ngừng dùng |
| Bảo trì | Tạm không dùng. | Đang dùng; Ngừng dùng |
| Ngừng dùng | Không chọn cho chuyến mới. | Đang dùng |

# 5. Quy tắc nghiệp vụ

1. **Hạn đăng kiểm / bảo hiểm:** quá hạn → đỏ; còn ≤ 30 ngày → vàng. Xe ngừng dùng không tính vào cảnh báo giấy tờ.
1. Xe đang dùng cho chuyến Đang gom đơn / Đã xuất kho được suy ra từ chuyến.
1. Bảo trì và Ngừng dùng là đổi tình trạng, không xoá.
1. Biển số duy nhất sau khi chuẩn hoá (bỏ dấu chấm, gạch, khoảng trắng; không phân biệt hoa thường).

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code, plateNumber, name, type | Chuỗi, enum | Mã xe (XE + số); biển số; tên gọi; XE_TAI, XE_VAN, XE_BA_GAC, XE_MAY, KHAC. |
| status | enum | DANG_DUNG, BAO_TRI, NGUNG_DUNG. |
| registrationExpiry, insuranceExpiry | Ngày | Hạn đăng kiểm / bảo hiểm. |
| driverUserId, driverName, driverPhone | Khác | Tài xế mặc định. |
| note | Chuỗi | Ghi chú. |
| capacity | Số | Tải trọng (hiện ở cột Tải trọng). |

# 7. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Chuyến giao hàng (ATL-13) | Chọn xe khi tạo chuyến; chi phí xe theo chuyến. |
| Người dùng (ATL-22) | Gán nhân viên làm tài xế. |

# 8. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Trùng biển số | Báo lỗi tại trường biển số. |
| Xe quá hạn giấy tờ | Hiện cảnh báo màu đỏ, không chặn tạo chuyến. |

# 9. Ghi chú & giới hạn hiện tại

- Xe thuê ngoài không có trong danh mục vẫn ghi được trên chuyến theo biển số gõ tay.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
