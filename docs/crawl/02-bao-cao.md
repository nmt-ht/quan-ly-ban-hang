# Báo cáo

Trạng thái: **xong (cấu trúc & định nghĩa)** — đã crawl 21/21 báo cáo. Chưa có số liệu thật (production không có dữ liệu trong kỳ), nên chưa xác minh công thức bằng số liệu.

## Màn hình & route

- Route: `/bao-cao?name=<slug>`. Slug không khớp tên hiển thị ở một số báo cáo — không đoán, bấm từ menu.
- Bố cục: cột trái là menu báo cáo nhóm theo mảng; cột phải là bộ lọc, kết quả và ghi chú định nghĩa ở chân.
- Nút đầu trang: **Xuất Excel** (không tải — cần xin phép).
- Mặc định mở: Doanh thu (`name=ban-hang`).

## Bộ lọc

- **Cách nhóm** — dropdown, chỉ có ở một số báo cáo. Các lựa chọn đã thấy:
  - Doanh thu: "Theo thời gian"
  - Lãi gộp: "Theo mặt hàng"
  - Nhập hàng: "Theo nhà cung cấp"
  - Sản xuất: "Sản lượng & giá thành"
  - Giao hàng: "Tỷ lệ giao thành công"
  - Chi phí xe: "Theo xe"
  - Số dư công nợ / Tuổi nợ: "Phải thu khách hàng" (có thể có "Phải trả nhà cung cấp" — chưa mở)
  - Thu chi: "Theo loại thu chi"
- **Từ ngày / Đến ngày** — ô ngày dd/mm/yyyy. Báo cáo "hiện trạng" (Tồn kho, Dưới tồn tối thiểu, Số dư công nợ, Tuổi nợ) **không có** ô ngày.
- **Preset kỳ** — dropdown mặc định "Tháng này" (các lựa chọn khác chưa mở).
- Bộ lọc riêng theo báo cáo: **Tìm mặt hàng** (nhiều báo cáo), **Mặt hàng \*** (bắt buộc — Thẻ kho, Giá mua biến động), **Không phát sinh quá (ngày)** (Hàng không phát sinh lâu ngày).

## Danh sách 21 báo cáo

| Nhóm | Tên báo cáo (menu) | Tiêu đề trên trang | Slug | Loại | Bộ lọc riêng |
|---|---|---|---|---|---|
| Bán hàng | Doanh thu | Doanh thu theo thời gian | `ban-hang` | kỳ | Cách nhóm |
| Bán hàng | Chiết khấu đã cấp | Chiết khấu đã cấp | `chiet-khau` | kỳ | — |
| Bán hàng | Khách ngừng mua | Khách ngừng mua | `khach-ngung-mua` | kỳ | — |
| Lợi nhuận | Lãi gộp | Lãi gộp theo mặt hàng | `loi-nhuan` | kỳ | Cách nhóm |
| Lợi nhuận | Hàng bán dưới giá vốn | Hàng bán dưới giá vốn | `ban-duoi-gia-von` | kỳ | Tìm mặt hàng |
| Kho | Nhập xuất tồn | Nhập xuất tồn theo kỳ | `nhap-xuat-ton` | kỳ | Tìm mặt hàng |
| Kho | Hàng không phát sinh lâu ngày | Hàng không phát sinh trên 90 ngày | `hang-nam-im` | hiện trạng | Không phát sinh quá (ngày), Tìm mặt hàng |
| Kho | Tồn kho hiện tại | Tồn kho hiện tại | `ton-kho` | hiện trạng | Tìm mặt hàng |
| Kho | Hàng dưới tồn tối thiểu | Hàng dưới tồn tối thiểu | `duoi-ton-toi-thieu` | hiện trạng | Tìm mặt hàng |
| Kho | Thẻ kho | (**hiển thị sai**, xem Lỗi) | `the-kho` | kỳ | Mặt hàng \* |
| Kho | Vòng quay tồn kho | Vòng quay tồn kho | `vong-quay-ton-kho` | kỳ | Tìm mặt hàng |
| Mua hàng | Nhập hàng | Nhập hàng theo nhà cung cấp | `mua-hang` | kỳ | Cách nhóm |
| Mua hàng | Giá mua biến động | Giá mua biến động | `gia-mua` | kỳ | Tìm mặt hàng |
| Sản xuất | Sản xuất | Sản lượng và giá thành thành phẩm | `san-xuat` | kỳ | Cách nhóm |
| Giao hàng | Giao hàng | Tỷ lệ giao hàng thành công | `giao-hang` | kỳ | Cách nhóm |
| Giao hàng | Chi phí xe | Chi phí xe | `chi-phi-xe` | kỳ | Cách nhóm |
| Giao hàng | Hiệu quả theo tài xế | Hiệu quả giao hàng theo tài xế | `tai-xe` | kỳ | — |
| Công nợ | Số dư công nợ | Công nợ phải thu | `cong-no` | hiện trạng | Cách nhóm |
| Công nợ | Tuổi nợ | Tuổi nợ phải thu | `tuoi-no` | hiện trạng | Cách nhóm, Tìm mặt hàng |
| Dòng tiền | Sổ quỹ | Sổ quỹ | `so-quy` | kỳ | — |
| Dòng tiền | Thu chi | Thu chi theo loại thu chi | `thu-chi` | kỳ | Cách nhóm |

Ghi chú về tên: tên trên menu và tiêu đề trên trang khác nhau ở nhiều báo cáo (ví dụ menu "Giao hàng" → tiêu đề "Tỷ lệ giao hàng thành công"; menu "Số dư công nợ" → tiêu đề "Công nợ phải thu").

## Cột bảng (khi có dữ liệu)

- **Số dư công nợ** (`cong-no`): MÃ ĐỐI TÁC · KHÁCH HÀNG · SỐ NGÀY NỢ · SỐ DƯ · QUÁ HẠN · TRẢ TRƯỚC · SỐ PHÁT SINH · PHÁT SINH GẦN NHẤT. Có dòng TỔNG CỘNG ở cuối và đếm "N dòng". (Quan sát được một dòng mẫu: KH0000002 Tú Aloha, số dư −10.000.000 ₫, trả trước 10.000.000 ₫, 1 phát sinh, gần nhất 05/09/2026.)
- **Sổ quỹ**: đầu kỳ, cuối kỳ; gộp mọi đầu tài khoản.
- Các cột của báo cáo khác: chưa thấy vì bảng rỗng — cần dữ liệu để đọc.

## Quy tắc nghiệp vụ (nguyên văn/ tóm tắt từ ghi chú trên giao diện)

Doanh thu & bán hàng
- **Doanh thu**: ghi nhận khi khách THỰC NHẬN hàng, đúng bằng số đã vào công nợ phải thu. Chiết khấu của đơn phân bổ về từng dòng theo tỷ lệ giá trị.
- **Khách ngừng mua**: khách từng nhận hàng TRƯỚC ngày bắt đầu kỳ nhưng trong kỳ không có đơn nào (kể cả đơn mới lập, chưa giao). Khách đã ngừng theo dõi không hiện. Xếp theo doanh thu cũ giảm dần.
- **Chiết khấu đã cấp**: ghi chú chưa được đọc đầy đủ (chỉ thấy chân trang dùng chung với Doanh thu) — cần kiểm tra lại.

Lợi nhuận
- **Hàng bán dưới giá vốn**: doanh thu đã trừ chiết khấu phân bổ về dòng, nên bán đúng giá vốn rồi chiết khấu thêm bị tính là lỗ. Giá vốn là BẢN CHỤP lúc giao hàng, không đổi khi nhập hàng mới. Xếp theo mức lỗ giảm dần.
- **Lãi gộp**: giá vốn theo bản chụp tại thời điểm giao hàng, không phải giá vốn hiện tại. Cột cuối đếm số dòng có giá vốn bằng 0 — lãi gộp của những dòng đó bị thổi lên.

Kho
- **Nhập xuất tồn**: cộng dồn từ chứng từ kho, quy về ĐVT chính. Chuyển kho tính hai đầu (trừ kho xuất, cộng kho nhận). Tồn cuối kỳ = tồn đầu + nhập − xuất.
- **Hàng không phát sinh lâu ngày**: chỉ liệt kê mặt hàng CÒN TỒN mà không có chứng từ kho nào trong 90 ngày gần đây. Hàng tồn âm cũng hiện.
- **Tồn kho hiện tại**: báo cáo hiện trạng, tính tại thời điểm xem, không lọc theo ngày. Hàng đã lên xe chưa chốt giao nằm ở cột "Đang đi đường" — vẫn được cộng vào giá trị tồn. Tồn âm giữ nguyên, không làm tròn về 0.
- **Hàng dưới tồn tối thiểu**: chỉ tính mặt hàng CÒN KINH DOANH và có tồn tối thiểu > 0. Tiền cần bù là ước tính theo giá vốn bình quân hiện tại, không phải giá chào của nhà cung cấp.
- **Thẻ kho**: (chưa đọc được ghi chú đúng do lỗi hiển thị — xem Lỗi).
- **Vòng quay tồn kho**: số ngày tồn = tồn hiện tại / lượng bán bình quân mỗi ngày trong kỳ. Hàng còn tồn mà kỳ này không bán được thì cột để trống, không quy đổi thành 0. Lượng bán tính theo số khách THỰC NHẬN.

Mua hàng
- **Nhập hàng**: tính trên PHIẾU NHẬP KHO có nhà cung cấp — đúng thời điểm hàng về và công nợ phát sinh, không phải lúc đặt đơn. Đơn giá tính theo đơn vị ghi trên dòng phiếu.
- **Giá mua biến động**: đơn giá đã QUY VỀ ĐƠN VỊ CHÍNH để so sánh giữa các lần nhập khác đơn vị. Xếp theo biên độ giá giảm dần. Cột Biến động so giá lần nhập cuối với lần đầu trong kỳ.

Sản xuất
- **Sản xuất (sản lượng & giá thành)**: chỉ tính lệnh đã HOÀN THÀNH. Giá thành chia cho SỐ THỰC NHẬP KHO nên hàng hỏng làm tăng giá thành đơn vị. Chi phí vật tư tính theo giá vốn hiện tại của vật tư.

Giao hàng
- **Giao hàng (tỷ lệ giao thành công)**: chỉ tính đơn ĐÃ CHỐT GIAO. Đơn đang giao chưa chốt không nằm trong báo cáo.
- **Chi phí xe**: chi phí do người điều vận ghi ở từng chuyến, KHÔNG phải sổ quỹ — tiền thật ra khỏi quỹ nằm ở phiếu chi. Chuyến đã huỷ không tính. Xe thuê ngoài gộp theo biển số ghi trên chuyến.
- **Hiệu quả theo tài xế**: "Tỷ lệ lấy đủ" chỉ tính đơn khách lấy TOÀN BỘ. "Giá trị mang về" là phần hàng đã lên xe nhưng khách không nhận, phải nhập lại kho. Tài xế lấy theo chuyến; đơn không thuộc chuyến nào gom vào dòng "(không gắn chuyến)".

Công nợ
- **Số dư công nợ**: số dư tính trên TOÀN BỘ lịch sử, không phụ thuộc khoảng ngày — đây là số hai bên cần chốt với nhau. Đối tác đã tất toán (số dư 0) không hiện. Trả trước là tiền đã nhận/đã trả nhưng chưa gán vào khoản nợ nào.
- **Tuổi nợ**: chỉ tính khoản TĂNG NỢ còn chưa trả hết; tiền trả trước không trừ vào đây vì chưa gán được vào khoản cụ thể. Khoản chưa khai hạn thanh toán xếp vào cột Chưa đến hạn.

Dòng tiền
- **Sổ quỹ**: tồn quỹ đầu kỳ và cuối kỳ gộp mọi đầu tài khoản. Xem số dư từng tài khoản ở màn hình Phiếu thu chi. Phiếu đã huỷ không tính.
- **Thu chi**: phiếu đã huỷ không tính. Cột Ròng = thu − chi; số âm nghĩa là dòng đó chi nhiều hơn thu.

## Trạng thái rỗng (nguyên văn)

- "Không có số liệu trong kỳ này"
- "Thử mở rộng khoảng ngày, hoặc kiểm tra xem đã có chứng từ nào trong kỳ chưa."

## Lỗi / nghi ngờ lỗi

1. **Thẻ kho hiển thị sai tiêu đề và ghi chú**: khi chọn Thẻ kho (`name=the-kho`), tiêu đề và đoạn ghi chú là của "Giá mua biến động". Phần form (Mặt hàng \*, Chọn hàng hoá) đúng là của Thẻ kho. Đã xác nhận bằng ảnh chụp màn hình sau khi chờ ổn định. Cần kiểm tra lại trên trình duyệt khác để loại trừ lỗi hiển thị tạm thời.
2. **Lệch tên menu và tiêu đề**: xem phần "Ghi chú về tên" ở trên.
3. **Slug khó đoán**: `hang-nam-im`, `tai-xe`, `cong-no`, `so-quy`, `gia-mua` không khớp tên báo cáo — ghi lại để đội phát triển không đặt route theo tên hiển thị.

## Chưa xác minh / cần dữ liệu

- Công thức thực tế của mọi báo cáo (cần dữ liệu để đối chiếu).
- Cột của các bảng khi có dữ liệu (trừ Số dư công nợ đã thấy 1 dòng mẫu).
- Preset kỳ ngoài "Tháng này" và tuỳ chọn "Phải trả nhà cung cấp" của báo cáo công nợ.
- Ghi chú đầy đủ của Chiết khấu đã cấp.
- Thẻ kho: ghi chú đúng và các cột.
