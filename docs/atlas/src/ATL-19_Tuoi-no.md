---
title: Tuổi nợ
Mã tài liệu: ATL-19
Phân hệ: Dòng tiền
Đường dẫn: /cong-no/tuoi-no
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Phân loại các khoản nợ còn lại theo độ trễ so với hạn thanh toán để biết khoản nào cần đòi gấp hoặc phải trả sớm — cho cả phải thu khách hàng và phải trả nhà cung cấp.

## Đối tượng sử dụng

- Kế toán, Quản lý.

## Quyền liên quan

debt.view.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Chọn loại công nợ → Chọn cách xem → Lọc nhóm tuổi nợ → Mở sổ / lập phiếu
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Chọn Phải thu khách hàng hoặc Phải trả nhà cung cấp (hoặc đi từ Tổng quan: ?loai=phai-thu). | Bảng và dải tuổi nợ đổi theo. |
| 2 | Kế toán | Chọn cách xem: Theo đối tác hoặc Theo chứng từ. | Theo đối tác: mỗi khách / NCC một dòng; theo chứng từ: từng khoản nợ. |
| 3 | Kế toán | Bấm một nhóm tuổi nợ để lọc. | Chỉ hiện các khoản/đối tác trong nhóm; có chip bỏ lọc. |
| 4 | Kế toán | Mở sổ công nợ, nhắc nợ hoặc lập phiếu thu/chi từ dòng. | Liên kết sang màn hình công nợ / Nhắc nợ (ATL-31) / phiếu. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Chọn loại công nợ | Hai nút: Phải trả nhà cung cấp / Phải thu khách hàng. |
| Dải tuổi nợ | Chưa đến hạn · Quá hạn 1–30 ngày · 31–60 ngày · 61–90 ngày · Trên 90 ngày; mỗi nhóm hiện số tiền và tỷ trọng. |
| Bảng | Theo đối tác hoặc Theo chứng từ (hai tab có số đếm); nút "Chỉ quá hạn"; sắp xếp Tên A → Z, Quá hạn lâu nhất, Quá hạn nhiều nhất, Tổng nợ lớn nhất; xuất Excel; tính đến hôm nay. |

# 4. Quy tắc nghiệp vụ

1. Chỉ tính **khoản TĂNG NỢ còn chưa trả hết** (sau đối trừ).
1. Tiền **trả trước không trừ** vào tuổi nợ vì chưa gán được vào khoản cụ thể.
1. Khoản **chưa khai hạn thanh toán** xếp vào Chưa đến hạn.
1. Phân nhóm theo số ngày quá hạn tính từ hạn thanh toán tới hôm nay.
1. Tuổi nợ tính trên toàn bộ lịch sử, không phụ thuộc kỳ. Mỗi đợt giao / lần nhận hàng là một khoản riêng với hạn riêng, nên một đơn có thể nằm ở nhiều nhóm tuổi nợ.
1. "Hôm nay" tính theo giờ Việt Nam.

# 5. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Công nợ phải thu / phải trả (ATL-15, ATL-10) | Nguồn dữ liệu và nơi đối trừ. |
| Tổng quan (ATL-02) | Ô khách nợ quá hạn, phải trả đến hạn. |
| Phiếu thu chi (ATL-16) | Lập phiếu để xử lý khoản quá hạn. |
| Nhắc nợ (ATL-31) | Danh sách khách quá hạn / đến hạn cần nhắc. |

# 6. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Không có khoản nợ | Trạng thái rỗng. |

# 7. Bản in

- Phiếu in: **Báo cáo tuổi nợ (khổ A4 ngang)**, dựng bằng khuôn in chung (ATL-26): tiêu đề công ty (logo + tên + địa chỉ, mã số thuế, điện thoại, email, website có nhãn) và số phiếu, tiêu đề, khối thông tin, bảng, khối ký, chân trang "In lúc … · người in".
- Bảng theo đối tác với năm nhóm tuổi nợ và tổng còn nợ, dòng tổng cộng; tiêu đề phụ ghi ngày tính, nhóm đang lọc, "chỉ khoản quá hạn"; ký: Người lập biểu, Kế toán trưởng.

# 8. Ghi chú & giới hạn hiện tại

- Dải tuổi nợ cũng xuất hiện trên hai danh sách công nợ và trong file Excel công nợ.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
