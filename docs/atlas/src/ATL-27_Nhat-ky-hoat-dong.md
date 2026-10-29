---
title: Nhật ký hoạt động
Mã tài liệu: ATL-27
Phân hệ: Thiết lập
Đường dẫn: /thiet-lap/nhat-ky, tab Nhật ký trên trang chi tiết
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Trả lời câu hỏi "ai đã làm gì, với chứng từ nào, lúc nào". Mọi thao tác ghi trên hệ thống — lập, sửa, huỷ, giao, nhận, đăng nhập… — để lại một dòng nhật ký ghi trong cùng giao dịch với thao tác đó. Nhật ký chỉ được thêm, không ai sửa hay xoá được.

## Đối tượng sử dụng

- CEO / Quản lý: tra cứu toàn bộ nhật ký.
- Mọi người dùng: xem tab Nhật ký của bản ghi họ được mở.

## Quyền liên quan

audit.view (trang Nhật ký hoạt động: mặc định CEO và Quản lý). Tab Nhật ký của một bản ghi chỉ cần quyền xem bản ghi đó.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Người dùng thao tác → Máy chủ ghi dòng nhật ký trong cùng giao dịch → Tra cứu ở trang Nhật ký → Xem chi tiết trước / sau
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Hệ thống | Mỗi thao tác ghi thành công. | Một dòng: người thực hiện, thời điểm (đến giây), thao tác, đối tượng và mã chứng từ, câu tóm tắt tiếng Việt, các trường đổi (trước → sau, có nhãn), chứng từ liên quan, địa chỉ IP, mã yêu cầu. |
| 2 | Quản lý | Mở Thiết lập › Nhật ký hoạt động; lọc theo khoảng ngày, người thực hiện, đối tượng, thao tác, hoặc gõ tìm. | Danh sách mới nhất trước, tải thêm khi cuộn. |
| 3 | Quản lý | Bấm một dòng. | Chi tiết: bảng Trường · Trước · Sau, chứng từ kèm (bấm để mở), địa chỉ IP, mã yêu cầu. |
| 4 | Người dùng | Mở tab Nhật ký trên trang chi tiết của một chứng từ / danh mục. | Mọi thao tác trên bản ghi đó, kể cả thao tác từ chứng từ liên quan có nhắc tới mã của nó (chỉ hiện với người được mở chứng từ liên quan). |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Trang Nhật ký hoạt động | Dòng mô tả "Ai đã làm gì, với chứng từ nào, lúc nào. Nhật ký chỉ được thêm, không ai sửa hay xoá được."; bộ lọc kỳ, Người thực hiện, Mọi đối tượng, Mọi thao tác, ô tìm, Xoá bộ lọc. Cột: Thời điểm, Người thực hiện, Thao tác, Đối tượng, Nội dung. |
| Chi tiết dòng | Các trường đã thay đổi (Trường · Trước · Sau), Chứng từ kèm, Địa chỉ IP, Mã yêu cầu; dòng không ghi trường nào thì báo "Dòng này không ghi lại trường nào thay đổi." |
| Tab Nhật ký | Trên trang chi tiết hàng hoá, khách hàng, NCC, đơn bán, báo giá, đơn nhập, lệnh sản xuất, chuyến, phiếu kho, phiếu thu chi, người dùng…: cùng dạng dòng nhưng chỉ của bản ghi đó. |

# 4. Quy tắc nghiệp vụ

1. **Chỉ thêm:** bảng nhật ký có trigger ở cơ sở dữ liệu từ chối mọi lệnh sửa, xoá, xoá sạch — kể cả từ người quản trị cơ sở dữ liệu qua ứng dụng.
1. **Cùng giao dịch:** dòng nhật ký ghi trong cùng giao dịch với thao tác; thao tác lỗi thì không có dòng nhật ký, có dòng nhật ký thì thao tác chắc chắn đã lưu.
1. **Đăng nhập** (thành công và thất bại, kèm lý do thật như tài khoản bị khoá) cũng được ghi.
1. **Lưới an toàn:** lệnh ghi nào thành công mà không ghi nhật ký thì máy chủ tự ghi một dòng "api.unaudited" và cảnh báo; bộ kiểm thử báo đỏ nếu có lệnh ghi như vậy.
1. Mỗi phản hồi của máy chủ có mã yêu cầu (X-Request-Id); cùng mã đó nằm trong nhật ký và log lỗi để truy vết.
1. Nhập Excel ghi một dòng tổng cho cả lần nhập, rồi mỗi bản ghi một dòng như sửa trên form; chạy thử (xem trước) không ghi gì.
1. Thao tác của chủ nền tảng trên một doanh nghiệp (cấp lại mật khẩu…) ghi vào nhật ký của doanh nghiệp đó với người thực hiện "Quản trị nền tảng" (ATL-34).

# 5. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| createdAt | Thời điểm | Đến giây. |
| userId, userName | Mã, chuỗi | Người thực hiện. |
| action | Chuỗi | Mã thao tác (ví dụ sales_order.deliver, cash_voucher.cancel, auth.login). |
| entityType, entityId, entityCode | Chuỗi | Đối tượng và mã chứng từ. |
| summary | Chuỗi | Câu tóm tắt tiếng Việt. |
| changes[] | Danh sách | Trường (nhãn), giá trị trước, giá trị sau. |
| relatedCodes[] | Danh sách | Mã chứng từ liên quan. |
| ip, requestId | Chuỗi | Địa chỉ IP, mã yêu cầu. |

# 6. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Mọi chức năng có thao tác ghi | Nguồn của các dòng nhật ký; trang chi tiết có tab Nhật ký. |
| Đăng nhập (ATL-01) | Ghi mọi lần đăng nhập. |
| Chức vụ & phân quyền (ATL-23) | Quyền Xem nhật ký hoạt động. |

# 7. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Không có dòng nào khớp lọc | "Không có dòng nhật ký nào" kèm nút Xoá bộ lọc. |
| Dòng nhắc tới chứng từ người xem không có quyền mở | Không hiện trong tab Nhật ký của họ. |

# 8. Ghi chú & giới hạn hiện tại

- Khi chuyển sang nhật ký, việc lập và huỷ của các chứng từ đã có trước đó được chuyển thành các dòng lịch sử đầu tiên.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc qua API.
