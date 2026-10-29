---
title: Lệnh sản xuất
Mã tài liệu: ATL-07
Phân hệ: Nghiệp vụ
Đường dẫn: /san-xuat, /san-xuat/:id
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Theo dõi việc sản xuất thành phẩm cho đơn hàng bán. Lệnh chụp lại định mức (BOM) lúc lập, xuất vật tư khi bắt đầu và nhập thành phẩm khi hoàn tất. Lệnh không lập từ trang này mà từ đơn hàng bán có dòng thành phẩm.

## Đối tượng sử dụng

- Quản lý / Sale: lập lệnh từ đơn.
- Nhân viên xưởng, Quản lý: bắt đầu, hoàn tất, huỷ.

## Quyền liên quan

production.view / create / approve / update_progress (bắt đầu) / complete (nghiệm thu) / cancel. Nhân viên xưởng xem được đơn gốc ở dạng chỉ đọc mà không cần quyền xem đơn bán.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

[flow] Đơn bán có thành phẩm → Lập lệnh (Nháp) → Bắt đầu: xuất vật tư → Hoàn tất: nhập thành phẩm
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Sale | Mở đơn hàng bán → Lập lệnh sản xuất. | Mỗi dòng thành phẩm chưa có lệnh sinh một lệnh Nháp; lưu người lập và bản chụp định mức. |
| 2 | Xưởng | Mở lệnh, kiểm định mức và tồn vật tư. | Bảng định mức hiện cần dùng, tồn hiện tại, thiếu; cảnh báo nếu thiếu. |
| 3 | Xưởng | Bắt đầu sản xuất, chọn ngày bắt đầu (mặc định hôm nay). | Chuyển Đang sản xuất; xuất vật tư (một phiếu xuất cho mỗi kho vật tư), giá vốn vật tư chốt trên phiếu. |
| 4 | Xưởng | Hoàn tất (nghiệm thu): nhập số thực làm được, chọn ngày hoàn tất. | Chuyển Hoàn tất; phiếu nhập Kho thành phẩm đúng số thực (không có phiếu nếu số = 0), giá nhập = chi phí vật tư đã xuất ÷ số làm được. Khi mọi lệnh của đơn đã hoàn tất, đơn bán chuyển Chờ giao hàng. |
| 5 | Quản lý | Huỷ lệnh (Nháp hoặc Đang sản xuất), nhập lý do. | Chuyển Đã huỷ; cảnh báo vật tư đã xuất không tự nhập lại. |

# 3. Màn hình & thành phần

| Màn hình / thành phần | Mô tả |
|---|---|
| Danh sách | Tìm theo mã lệnh, thành phẩm, đơn bán, khách; lọc Trạng thái (nhiều lựa chọn), Kỳ, "Trễ hạn giao"; tổng: Nháp, Đang sản xuất, Trễ hạn giao; nút Xuất Excel và "Đơn chờ sản xuất" (mở Đơn hàng bán ?status=PENDING). |
| Cột danh sách | Mã lệnh · Ngày lập · Thành phẩm · Số lượng (hiện "thực N" nếu hoàn tất lệch) · Đơn bán · Khách hàng · Cần giao (đỏ + "trễ") · Bắt đầu · Hoàn tất · Trạng thái · nút nhanh Bắt đầu / Hoàn tất…. |
| Chi tiết lệnh | Thông tin; khối Đơn gốc chỉ đọc (mã đơn, khách, ngày cần giao, quy cách các dòng thành phẩm — không có giá); chi phí vật tư và giá thành / đơn vị (theo giá đã chốt khi đã xuất vật tư); bảng Định mức vật tư (bản chụp); bảng Phiếu kho của lệnh; ô chọn ngày khi bắt đầu / hoàn tất; ô nhập số thực khi hoàn tất; ô lý do huỷ. |

# 4. Trạng thái & chuyển trạng thái

| Trạng thái | Ý nghĩa | Chuyển được sang / cho phép |
|---|---|---|
| Nháp | Mới lập, chưa đụng tới kho. | Bắt đầu sản xuất; Huỷ |
| Đang sản xuất | Vật tư đã xuất. | Hoàn tất; Huỷ |
| Hoàn tất | Thành phẩm đã nhập kho. | Không chuyển tiếp |
| Đã huỷ | Không còn ảnh hưởng đơn bán. | Không chuyển tiếp |

# 5. Quy tắc nghiệp vụ

1. Định mức được **chụp lúc lập lệnh**; sửa định mức sau đó không ảnh hưởng lệnh cũ (lệnh cũ không có bản chụp thì dùng định mức hiện tại).
1. **Vật tư xuất khi bắt đầu**, không phải lúc lập lệnh; số cần = định mức × số lượng lệnh; kho xuất là kho ngầm định của từng vật tư.
1. Thiếu tồn vẫn bắt đầu được khi công ty cho xuất quá số tồn (tồn có thể âm); trang chi tiết cảnh báo số vật tư thiếu. Công ty tắt "Cho xuất quá số tồn" thì bắt đầu bị từ chối, trừ người có quyền Xuất vượt tồn kho.
1. **Ngày bắt đầu / hoàn tất** chọn được: không sau hôm nay; ngày bắt đầu không trước ngày đặt đơn bán gốc, ngày hoàn tất không trước ngày bắt đầu; không thuộc kỳ đã khoá sổ.
1. Hoàn tất nhập **số thực làm được**; ít hơn số lệnh thì phần hỏng tính vào giá thành và đơn bán có thể cần lệnh bổ sung; bằng 0 thì không nhập kho.
1. Giá thành đơn vị = chi phí vật tư ÷ số lượng (khi hoàn tất chia cho số thực nhập). Chi phí vật tư lấy giá vốn đã chốt trên phiếu xuất vật tư; lệnh Nháp hoặc lệnh cũ chưa có giá chốt thì ước tính = định mức × số lượng × giá vốn bình quân hiện tại.
1. **Huỷ lệnh** chỉ khi Nháp hoặc Đang sản xuất; vật tư đã xuất không tự nhập lại.
1. **Trễ hạn giao:** lệnh còn mở mà đơn bán có ngày cần giao đã qua.
1. Sửa đơn bán còn lệnh Nháp: đổi số lượng thì cập nhật lệnh, bỏ dòng thành phẩm thì lệnh bị huỷ ("Dòng hàng đã bỏ khỏi đơn"). Huỷ đơn bán sẽ huỷ các lệnh Nháp / Đang sản xuất của đơn.
1. Báo cáo Sản xuất chỉ tính lệnh Hoàn tất.

# 6. Dữ liệu

| Trường | Kiểu / định dạng | Mô tả |
|---|---|---|
| code | LSX + 7 số | Mã lệnh. |
| sourceOrderId, productId, quantity | Mã, số | Đơn bán gốc, thành phẩm, số lượng theo ĐVT chính. |
| status | enum | NHAP, DANG_SAN_XUAT, HOAN_TAT, HUY. |
| createdDate, startDate, completeDate | Ngày | Mốc thời gian. |
| bomSnapshot[] | Danh sách | componentId, quantityPerUnit tại lúc lập. |
| producedQuantity | Số | Số thực nhập kho khi hoàn tất. |
| cancelReason, note, createdBy | Chuỗi | Lý do huỷ, ghi chú, người lập. |

# 7. Tác động tới kho, công nợ, tiền

| Sự kiện | Tác động |
|---|---|
| Bắt đầu | Phiếu xuất vật tư (− tồn vật tư). |
| Hoàn tất | Phiếu nhập thành phẩm vào Kho thành phẩm (+ số thực). |
| Huỷ khi đang sản xuất | Không hoàn tồn vật tư; cần lập phiếu nhập tay nếu dùng lại được. |

# 8. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| Đơn hàng bán (ATL-12) | Nơi lập lệnh; trạng thái đơn đổi theo lệnh. |
| Hàng hoá & định mức (ATL-04) | Nguồn định mức và giá vốn vật tư. |
| Phiếu kho (ATL-06) | Phiếu xuất vật tư và nhập thành phẩm, có Chứng từ gốc là lệnh. |

# 9. Trường hợp ngoại lệ & thông báo

| Tình huống | Hệ thống xử lý |
|---|---|
| Thành phẩm chưa có định mức | Bắt đầu không xuất vật tư nào; có thông báo. |
| Ngày bắt đầu / hoàn tất không hợp lệ | Máy chủ từ chối, báo mốc ngày được phép. |
| Người không có quyền xem đơn bán mở lệnh | Vẫn thấy khối Đơn gốc chỉ đọc; không mở được trang đơn. |
| Không tìm thấy lệnh | Trang "Không tìm thấy lệnh sản xuất". |

# 10. Ghi chú & giới hạn hiện tại

- Trạng thái lệnh (Nháp/Đang sản xuất/Hoàn tất/Huỷ) khác trạng thái đơn bán (Chờ sản xuất/Đang sản xuất/…); đơn bán tự suy ra từ các lệnh.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
- Trang chi tiết có mục **Nhật ký**: mọi thao tác trên bản ghi này — ai, lúc nào (đến giây), trường nào đổi từ giá trị nào sang giá trị nào, kể cả thao tác từ chứng từ liên quan. Xem ATL-27.
