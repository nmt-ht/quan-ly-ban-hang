# Chiến lược crawl chi tiết — Ninh Trang (production)

Nguồn: `https://ninhtrang-frontend-production.up.railway.app` (đã đăng nhập bởi chủ tài khoản)

## 1. Nguyên tắc an toàn

Chỉ đọc. Trong suốt quá trình crawl:

- **Không** bấm Lưu / Tạo / Xác nhận / Huỷ / Xoá / Duyệt / Chốt trên dữ liệu thật.
- **Không** tải file (Xuất Excel, in PDF) — cần xin phép riêng từng lần.
- **Không** nhập thông tin cá nhân hay gửi form. Các form "Thêm mới" chỉ mở ra để đọc các trường, sau đó bấm Huỷ.
- Mọi thao tác ghi (tạo phiếu, đổi trạng thái) chỉ làm được khi có dữ liệu thử nghiệm và bạn đồng ý từng bước.

## 2. Hạn chế đã biết: production đang gần như rỗng

Qua lần crawl đầu, phần lớn module có 0 bản ghi (0 mặt hàng, 0 đơn nhập, 0 đơn bán, 0 lệnh sản xuất, 0 phiếu kho). Hệ quả:

- Có thể đọc được: cấu trúc màn hình, cột danh sách, bộ lọc, các trường form, gợi ý (helper text), trạng thái rỗng, định nghĩa báo cáo.
- **Không** đọc được trực tiếp: luồng trạng thái thực tế (chờ duyệt → đang giao → hoàn tất…), dữ liệu mẫu, cách hiển thị chi tiết đơn, phiếu in, tính toán thực tế của báo cáo.

Để lấy được phần này cần một trong các cách sau (bạn chọn):

- **A.** Bạn nhập vài dữ liệu thử vào một bản sao / môi trường staging, mình crawl bản đó.
- **B.** Bạn tự thao tác một luồng mẫu (ví dụ: tạo 1 khách → 1 đơn bán → 1 chuyến giao), mình quan sát và ghi lại từng màn hình, không tự bấm lưu.
- **C.** Chỉ crawl phần cấu trúc (phương án mặc định), các phần cần dữ liệu đánh dấu `CHƯA XÁC MINH` để làm sau.

## 3. Phạm vi theo module

Mỗi module được ghi thành một file riêng trong `docs/crawl/`. Thứ tự ưu tiên theo mức độ quan trọng với nghiệp vụ bán hàng.

| # | Module | Route chính | Ước lượng | Ghi chú |
|---|---|---|---|---|
| 1 | Tổng quan (dashboard) | `/tong-quan` | 0.5 ngày | Mọi ô số liệu, bộ lọc ngày (preset), link đích |
| 2 | Báo cáo | `/bao-cao?name=…` | 1.5 ngày | 21 báo cáo: bộ lọc, nhóm theo, cột, định nghĩa |
| 3 | Hàng hoá | `/hang-hoa` | 1 ngày | Danh sách (lưới/bảng), bộ lọc, form thêm/sửa, nhập Excel, định mức |
| 4 | Tồn kho | `/kho/ton-kho` | 0.5 ngày | Bộ lọc, thẻ kho (drill-down) |
| 5 | Phiếu kho | `/kho/phieu` | 1 ngày | 4 loại phiếu: nhập / xuất / chuyển / kiểm kê |
| 6 | Lệnh sản xuất | `/san-xuat` | 0.5 ngày | Lập từ đơn, trạng thái, chi tiết |
| 7 | Nhà cung cấp | `/nha-cung-cap` | 0.5 ngày | Form, trang chi tiết, tab |
| 8 | Đơn nhập hàng | `/mua-hang` | 1 ngày | Form lập đơn, nhận hàng, huỷ |
| 9 | Công nợ phải trả | `/cong-no/nha-cung-cap` | 0.5 ngày | Sổ công nợ, đối trừ |
| 10 | Khách hàng | `/khach-hang` | 0.5 ngày | Form đầy đủ, trang chi tiết |
| 11 | Đơn hàng bán | `/don-hang` | 2 ngày | Module lớn nhất: form, trạng thái, chi tiết, in, lệnh SX |
| 12 | Chuyến giao hàng | `/giao-hang` | 1 ngày | Tạo chuyến, gom đơn, xuất kho, chốt giao, trả hàng |
| 13 | Danh mục xe | `/xe` | 0.25 ngày | Form, chi phí chuyến |
| 14 | Công nợ phải thu | `/cong-no/khach-hang` | 0.5 ngày | Sổ công nợ từng khách |
| 15 | Phiếu thu chi | `/thu-chi` | 1 ngày | Phiếu thu/chi, tài khoản tiền, loại thu chi |
| 16 | Tuổi nợ | `/cong-no/tuoi-no` | 0.25 ngày | Bucket, bộ lọc |
| 17 | Thiết lập | `/thiet-lap/*` | 1 ngày | Công ty (đã có), thẻ, người dùng, chức vụ/phân quyền (đã có) |
| 18 | Toàn cục | — | 0.5 ngày | Header, menu người dùng, dark mode, trạng thái rỗng, định dạng số/ngày |

Tổng ước tính: khoảng **12–14 ngày làm việc** nếu crawl đủ cả phần cần dữ liệu. Chỉ phần cấu trúc: khoảng **7–8 ngày**.

## 4. Quy trình làm cho từng module

1. **Khảo sát**: mở trang danh sách, ghi lại URL, tiêu đề, số đếm, nút hành động, nhóm bộ lọc.
2. **Bộ lọc & sắp xếp**: mở từng dropdown, ghi các lựa chọn (không chọn quá nhiều lần để tránh làm sai trạng thái).
3. **Form tạo mới**: mở, đọc toàn bộ trường — nhãn, kiểu, bắt buộc (dấu *), giá trị mặc định, danh sách lựa chọn, gợi ý, thông báo lỗi nếu có. Sau đó Huỷ.
4. **Form chỉnh sửa / chi tiết**: nếu có bản ghi thì đọc từng tab; nếu chưa có thì đánh dấu `CHƯA XÁC MINH`.
5. **Trạng thái & chuyển đổi**: ghi tên trạng thái, màu, điều kiện chuyển, nút nào xuất hiện ở trạng thái nào.
6. **Quy tắc nghiệp vụ**: trích các đoạn gợi ý / ghi chú trong giao diện (ví dụ: "Doanh thu ghi nhận khi khách THỰC NHẬN hàng").
7. **Trạng thái rỗng & thông báo**: ghi nguyên văn.
8. **Ghi nhận câu hỏi mở** cho bạn.

## 5. Định dạng đầu ra cho mỗi module

Mỗi file `docs/crawl/NN-<module>.md` có cấu trúc:

```
# <Tên module>
## Mục đích
## Màn hình & route
## Danh sách: cột, bộ lọc, sắp xếp, nút hành động
## Form: bảng trường (nhãn | kiểu | bắt buộc | mặc định | lựa chọn | gợi ý/ràng buộc)
## Chi tiết bản ghi (nếu crawl được)
## Trạng thái & chuyển đổi (nếu xác minh được)
## Quy tắc nghiệp vụ (trích nguyên văn)
## Trạng thái rỗng / thông báo
## Chưa xác minh / cần dữ liệu
```

## 6. Tiến độ & kiểm soát

- `docs/crawl/PROGRESS.md` ghi trạng thái từng module: `chưa làm` / `đang làm` / `xong (cấu trúc)` / `xong (đầy đủ)` / `chờ dữ liệu`.
- Mỗi ngày kết thúc, cập nhật PROGRESS và liệt kê câu hỏi cần bạn trả lời.

## 6b. Quyết định hiện tại

- Phương án **A** (dữ liệu thử trên staging) đã được chọn. Chờ: địa chỉ staging và xác nhận staging tách biệt với production. Mọi thao tác ghi chỉ thực hiện trên staging.

## 7. Cần bạn xác nhận

1. Đồng ý chế độ **chỉ đọc** như trên?
2. Chọn phương án dữ liệu: A / B / C (mục 2).
3. Có muốn mình crawl cả 4 loại phiếu kho, chuyến giao, lệnh sản xuất ở chế độ quan sát khi bạn thao tác không?
