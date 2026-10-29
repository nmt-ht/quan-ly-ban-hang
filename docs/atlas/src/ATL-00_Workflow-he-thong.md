---
title: Workflow tổng thể hệ thống
Mã tài liệu: ATL-00
Phân hệ: Toàn hệ thống
Đường dẫn: Toàn bộ các màn hình
Phiên bản: 1.2 — 29/10/2026
Hệ thống: Ninh Trang ERP — quản lý bán hàng, kho, sản xuất, giao hàng, công nợ
---

# 1. Tổng quan

## Mục đích

Mô tả dòng đi của nghiệp vụ trong Ninh Trang ERP — từ mua vật tư, nhập kho, sản xuất thành phẩm, báo giá, bán hàng, giao hàng cho tới thu tiền, nhắc nợ và đối trừ công nợ — và chứng từ nào sinh ra ở bước nào, tác động tới tồn kho, công nợ, quỹ tiền ra sao.

Đây là tài liệu mẹ: mỗi chức năng có một tài liệu Atlas riêng (ATL-01 → ATL-34) mô tả sâu hơn; mục 8 là chỉ mục.

## Đối tượng sử dụng

- **CEO / Quản lý:** xem toàn bộ, duyệt đơn và lệnh sản xuất, đặt bảng giá và khuyến mãi.
- **Sale:** chăm sóc khách, báo giá, chốt đơn hàng bán (đứng tên Người bán).
- **Kế toán:** phiếu thu chi, công nợ, đối trừ, nhắc nợ, khoá sổ, trả hàng, báo cáo tài chính.
- **Thủ kho:** phiếu nhập/xuất/chuyển kho, kiểm kê, nhận hàng mua, xuất kho chuyến.
- **Nhân viên giao hàng:** chốt giao nhận, nhập số lượng khách thực nhận.
- **Nhân viên xưởng:** bắt đầu và nghiệm thu lệnh sản xuất được giao.

## Quyền liên quan

Hệ thống có 113 quyền trong 25 nhóm (người dùng, chức vụ, công ty, nhóm hàng, kho, thẻ, hàng hoá, giá, định mức, khách hàng, nhà cung cấp, tồn kho, phiếu kho, kiểm kê, đơn nhập hàng, đơn bán hàng, báo giá, xe, chuyến giao hàng, lệnh sản xuất, công nợ, phiếu thu chi, tổng quan, báo cáo, nhật ký hoạt động) — xem ATL-23.

> Lưu ý: quyền được kiểm tra ở cả hai nơi — giao diện ẩn trang, mục menu và nút mà chức vụ không có quyền; máy chủ kiểm tra lại ở mọi API (thiếu quyền thì báo "Chức vụ của bạn chưa có quyền…"). Danh mục quyền: ATL-23.

# 2. Quy trình (workflow)

Mọi chứng từ đi một chiều: **lập → duyệt / thực hiện → ghi kho → ghi công nợ → thu / chi tiền**. Không chứng từ nào bị xoá: sai thì huỷ (phiếu vẫn còn, đánh dấu huỷ) và lập lại.

[flow] Nhà cung cấp → Đơn nhập hàng → Nhận hàng → Phiếu nhập kho → Tồn kho (giá vốn bình quân)
[next]
[flow] Báo giá → Đơn hàng bán → Lệnh sản xuất (nếu có thành phẩm) → Giao tại kho / Chuyến giao hàng
[next]
[flow] Mỗi đợt khách nhận = 1 khoản công nợ → Nhắc nợ, VietQR → Phiếu thu → trừ Công nợ phải thu
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thu mua | Khai báo nhà cung cấp, danh mục hàng theo NCC (mã theo NCC, giá mua), số ngày được nợ. Tồn kho gợi ý đơn nhập khi vật tư dưới tối thiểu. | Nhà cung cấp sẵn sàng để lập đơn nhập. |
| 2 | Thu mua | Lập Đơn nhập hàng (Nháp) → Gửi NCC. | Đơn chưa đụng tới kho và công nợ. |
| 3 | Thủ kho | Nhận hàng (đủ hoặc một phần) vào kho. | Phiếu nhập kho theo giá mua (mỗi kho một phiếu), tồn tăng, giá vốn bình quân cập nhật; mỗi lần nhận một khoản công nợ phải trả (gồm thuế). Hàng sai / lỗi thì Trả lại hàng mua (TLM). |
| 4 | Kế toán | Lập Phiếu chi cho nhà cung cấp. | Đối trừ công nợ phải trả (đến hạn sớm nhất trước hoặc chọn tay); không chi vượt tồn quỹ. |
| 5 | Sale | Lập Báo giá theo bảng giá của khách và khuyến mãi; khách đồng ý thì Lập đơn hàng (giữ giá báo). | Đơn bán; máy chủ kiểm giá tối thiểu, chiết khấu, hạn mức công nợ. Trạng thái tự suy ra: Chờ sản xuất hoặc Chờ giao hàng. |
| 6 | Sale / Quản lý | Với dòng thành phẩm: Lập lệnh sản xuất trên đơn. | Lệnh Nháp chụp bản sao định mức. |
| 7 | Xưởng | Bắt đầu → Nghiệm thu (nhập số thực làm được). | Bắt đầu: xuất vật tư theo định mức. Nghiệm thu: nhập thành phẩm vào Kho thành phẩm theo chi phí vật tư đã xuất. |
| 8 | Giao hàng | Giao tại kho trên đơn, hoặc gom đơn vào Chuyến giao hàng → Xuất kho → Chốt giao từng đơn → Xe về kho → Hoàn tất. | Xuất kho (chốt giá vốn); mỗi đợt khách nhận một khoản công nợ phải thu theo số thực nhận; "Thu tiền ngay" tự lập phiếu thu; hàng không giao được nhập lại kho. |
| 9 | Kế toán | Nhắc nợ (Zalo, SMS, gọi, email, mã VietQR), lập Phiếu thu. | Đối trừ công nợ phải thu; tăng số dư tài khoản tiền. Khách trả hàng thì lập phiếu trả hàng (TH). |
| 10 | Kế toán | Cuối kỳ khoá sổ. | Chứng từ có ngày trong kỳ đã khoá không lập / huỷ được. |
| 11 | Quản lý | Theo dõi Tổng quan, Báo cáo, Tuổi nợ, Nhật ký hoạt động. | Phát hiện công nợ quá hạn, hàng bán dưới giá vốn, khách ngừng mua, hàng dưới tồn tối thiểu. |

## Quy trình A — Mua hàng & trả tiền nhà cung cấp

[flow] Lập đơn nhập (Nháp) → Gửi NCC → Nhận hàng (một phần / đủ) → Hoàn tất đơn
[next]
[flow] Trả lại hàng mua (nếu có) → Phiếu chi trả NCC
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thu mua | Chọn NCC, thêm dòng hàng (ĐVT chính hoặc quy đổi, thuế 0/5/8/10%), hoặc mở từ Gợi ý đơn nhập ở Tồn kho. | Đơn ở trạng thái Nháp, còn sửa được. |
| 2 | Thu mua | Gửi NCC. | Chuyển Đã gửi NCC; không còn sửa nội dung đơn; hàng vào cột "Sắp về". |
| 3 | Thủ kho | Nhận hàng: chọn ngày nhận, số thực nhận từng dòng và kho nhập. | Phiếu nhập kho theo từng kho; tồn tăng; một khoản công nợ phải trả cho lần nhận, hạn = ngày nhận + số ngày được nợ. Trạng thái: Nhận một phần hoặc Đã nhận đủ. Không nhận vượt số còn lại. |
| 4 | Kế toán | Trả lại hàng mua (TLM…) khi hàng sai / lỗi. | Xuất kho theo giá mua; công nợ phải trả giảm vào ngày trả. |
| 5 | Thu mua | Hoàn tất đơn (đã nhận đủ, hoặc chốt ngắn khi nhận một phần). | Đơn đóng. |
| 6 | Kế toán | Công nợ phải trả → Lập phiếu chi. | Đối trừ khoản đến hạn sớm nhất trước, hoặc chọn tay; phiếu chi không được vượt tồn quỹ. |

## Quy trình B — Báo giá → đơn bán → sản xuất

[flow] Báo giá (BG) → Khách đồng ý: Lập đơn hàng → Lập lệnh sản xuất (Nháp) → Bắt đầu: xuất vật tư
[next]
[flow] Nghiệm thu: nhập thành phẩm → Đơn chuyển Chờ giao hàng
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Sale | Lập báo giá (không trừ kho, không ghi công nợ); in gửi khách. | Báo giá Mới; hiệu lực đến ngày đã chọn. |
| 2 | Sale | Lập đơn hàng từ báo giá. | Đơn cùng khách, giữ đơn giá báo; báo giá chuyển Đã lập đơn. |
| 3 | Sale | Mở đơn hàng bán → Lập lệnh sản xuất. | Mỗi dòng thành phẩm chưa có lệnh sinh một lệnh Nháp; định mức được chụp lại. |
| 4 | Xưởng / Quản lý | Bắt đầu sản xuất (chọn ngày). | Xuất vật tư theo định mức × số lượng từ kho ngầm định của từng vật tư (một phiếu mỗi kho). Thiếu tồn: cảnh báo, hoặc bị chặn nếu công ty không cho xuất quá số tồn. |
| 5 | Xưởng / Quản lý | Nghiệm thu: nhập số thực làm được (chọn ngày). | Phiếu nhập Kho thành phẩm đúng số thực; giá nhập = chi phí vật tư đã xuất ÷ số làm được. |
| 6 | Hệ thống | Tự cập nhật trạng thái đơn bán. | Chờ sản xuất → Đang sản xuất → Chờ giao hàng. |
| 7 | Quản lý | Huỷ lệnh (nếu cần). | Vật tư đã xuất không tự nhập lại — lập phiếu nhập kho nếu còn dùng được. |

## Quy trình C — Giao hàng bằng Chuyến giao hàng

[flow] Đang gom đơn → Xuất kho một lượt → Chốt giao từng đơn → Xe đã về kho
[next]
[flow] Hoàn tất
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Điều vận | Tạo chuyến, chọn xe/tài xế, gom các đơn còn hàng phải giao. | Đơn không nằm trên hai chuyến đang chạy cùng lúc. |
| 2 | Điều vận / Thủ kho | Xuất kho một lượt (chọn ngày). | Xếp toàn bộ phần còn phải giao lên xe; một phiếu xuất kho cho mỗi kho; đơn chuyển Đang giao. |
| 3 | Tài xế | Chốt giao từng đơn: ngày khách nhận, số khách thực nhận từng dòng (≤ số đã xếp). | Một đợt giao → một khoản công nợ phải thu; Thu tiền ngay tự lập phiếu thu; Bỏ chốt được trước khi xe về kho. Chỉ tài xế của chuyến hoặc người điều phối được chốt. |
| 4 | Thủ kho | Xe về kho (chọn ngày): nhập lại hàng khách không nhận. | Phiếu "Nhập trả về" vào đúng kho đã xuất, đúng giá vốn đã xuất. |
| 5 | Điều vận | Hoàn tất chuyến; nhập chi phí xe (xăng, cầu đường, khác). | Chi phí chuyến dùng cho báo cáo Chi phí xe. |

## Quy trình D — Thu tiền khách, nhắc nợ & đối trừ công nợ

[flow] Đợt giao (công nợ phát sinh) → Nhắc nợ / thông báo công nợ có VietQR → Phiếu thu → Đối trừ (tự động / chọn tay)
[next]
[flow] Số dư công nợ & Tuổi nợ
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Nhắc nợ: chọn khách quá hạn / sắp đến hạn, gửi tin soạn sẵn kèm mã VietQR, ghi nhận lần nhắc và hẹn trả. | Lịch sử nhắc; khách lỡ hẹn được đánh dấu. |
| 2 | Kế toán | Công nợ phải thu → Lập phiếu thu cho khách. | Phiếu chọn tài khoản tiền, loại thu, số tiền. |
| 3 | Hệ thống | Đối trừ: phần Chọn tay trừ đúng chứng từ đã chọn; phần còn lại trừ khoản đến hạn sớm nhất trước. | Dư không gán được là Trả trước (số dư âm trên công nợ). |
| 4 | Kế toán | Huỷ phiếu nếu lập nhầm. | Phiếu huỷ vẫn lưu, không tính vào quỹ / báo cáo; công nợ tự mở lại; huỷ phiếu thu không được làm quỹ âm. |
| 5 | Quản lý | Xem Tuổi nợ. | Khoản chưa đến hạn / quá hạn 1–30 / 31–60 / 61–90 / trên 90 ngày. |

## Quy trình E — Phiếu kho lập tay (nhập, xuất, chuyển, kiểm kê)

[flow] Chọn loại phiếu → Chọn kho & hàng → Lưu phiếu → Tồn kho cập nhật
[next]
[flow] Huỷ phiếu (nếu nhầm)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Thủ kho | Phiếu kho → Lập phiếu → chọn Nhập / Xuất / Chuyển / Kiểm kê. | Số phiếu cấp khi lưu: PNK, PXK, PCK, PKK. |
| 2 | Thủ kho | Chọn ngày (không sau hôm nay), kho, thêm dòng hàng, nhập số lượng (kiểm kê: số thực đếm). | Xem tồn tại kho ngay trên dòng; xuất/chuyển vượt tồn bị cảnh báo (hoặc chặn theo thiết lập công ty). |
| 3 | Hệ thống | Lưu phiếu. | Nhập +; Xuất −; Chuyển − kho xuất và + kho nhận; Kiểm kê điều chỉnh theo chênh lệch (thực đếm − sổ sách). |
| 4 | Thủ kho | Huỷ phiếu lập tay. | Tồn trả về như trước khi lập. Phiếu sinh từ chứng từ khác phải huỷ ở chứng từ gốc. |

## Quy trình F — Trả hàng

[flow] Khách trả hàng: phiếu TH → Nhập trả về kho → Công nợ phải thu & doanh thu giảm → Phiếu chi hoàn tiền (nếu đã thu)
| Bước | Người thực hiện | Hành động | Kết quả / tác động |
|---|---|---|---|
| 1 | Kế toán | Trên đơn bán: Nhận hàng trả lại (≤ số khách đã nhận − đã trả). | Phiếu TH…; hàng nhập lại kho đúng giá vốn đã xuất; công nợ phải thu và doanh thu giảm vào ngày trả; xem trước hoá đơn điều chỉnh giảm. |
| 2 | Kế toán | Trên đơn nhập: Trả lại hàng mua (≤ số đã nhận − đã trả). | Phiếu TLM…; xuất kho theo giá mua; công nợ phải trả giảm vào ngày trả. |
| 3 | Kế toán | Tiền đã thu / đã trả thừa. | Hoàn bằng phiếu chi (khách) hoặc phiếu thu (NCC hoàn lại). |

# 3. Liên kết với chức năng khác

| Chức năng | Quan hệ |
|---|---|
| ATL-01 → ATL-34 | Mỗi tài liệu mô tả riêng một chức năng; tài liệu này là bản đồ nối chúng. |

# 4. Vòng đời các chứng từ

| Chứng từ | Chuỗi trạng thái | Điểm cần nhớ |
|---|---|---|
| Báo giá (BG…) | Mới → Đã lập đơn; nhánh Huỷ; "Hết hạn" suy ra từ ngày hiệu lực | Không trừ kho, không ghi công nợ. |
| Đơn nhập hàng (DN…) | Nháp → Đã gửi NCC → Nhận một phần / Đã nhận đủ → Hoàn tất; nhánh Huỷ | Chỉ Nháp mới sửa được; Huỷ chỉ khi chưa nhận hàng. |
| Đơn hàng bán (DH…) | Chờ sản xuất → Đang sản xuất → Chờ giao hàng → Đang giao → Hoàn thành / Giao một phần / Trả toàn bộ; Huỷ | Trạng thái tự suy ra; "Kết thúc đơn" cho đơn Giao một phần. |
| Lệnh sản xuất (LSX…) | Nháp → Đang sản xuất → Hoàn tất; nhánh Huỷ | Huỷ được khi Nháp hoặc Đang sản xuất. |
| Chuyến giao hàng (CH…) | Đang gom đơn → Đã xuất kho → Xe đã về kho → Hoàn tất; nhánh Huỷ | Huỷ chỉ khi chưa xuất kho. |
| Phiếu trả hàng (TH…), Trả lại hàng mua (TLM…) | Hiệu lực → Đã huỷ | Huỷ đảo lại kho và công nợ. |
| Phiếu kho | Hiệu lực → Đã huỷ | Không xoá; huỷ chỉ với phiếu lập tay. |
| Phiếu thu chi (PT… / PC…) | Hiệu lực → Đã huỷ | Phiếu huỷ không tính vào quỹ, báo cáo, đối trừ công nợ. |
| Khuyến mãi (KM…), Bảng giá | Đang chạy / Đang dùng ↔ Dừng / Ngừng dùng | Chứng từ đã lưu giữ nguyên giá và chiết khấu. |
| Xe | Đang dùng / Bảo trì / Ngừng dùng | Không xoá, giữ lịch sử chuyến. |
| Khách hàng / Nhà cung cấp | Đang theo dõi (Còn hợp tác) ↔ Ngừng theo dõi (Ngừng hợp tác) | Không xoá, giữ đơn và công nợ. |
| Tài khoản người dùng | Hoạt động ↔ Bị khoá | Khoá = không xoá, đăng xuất mọi phiên. |

# 5. Ma trận tác động của chứng từ

| Sự kiện | Tồn kho | Công nợ | Quỹ tiền | Chứng từ sinh ra |
|---|---|---|---|---|
| Báo giá | — | — | — | Báo giá |
| Nhận hàng đơn nhập | + (ĐVT chính, giá mua) | Phải trả + (một khoản mỗi lần nhận) | — | Phiếu nhập kho / kho |
| Trả lại hàng mua | − (giá mua) | Phải trả − | — | TLM + phiếu xuất kho |
| Bắt đầu sản xuất | − vật tư | — | — | Phiếu xuất kho / kho |
| Nghiệm thu sản xuất | + thành phẩm (số thực) | — | — | Phiếu nhập Kho thành phẩm |
| Giao tại kho / chốt giao | − hàng (khi giao / khi xuất chuyến) | Phải thu + (một khoản mỗi đợt, theo số thực nhận) | + nếu Thu tiền ngay | Phiếu xuất kho; phiếu thu tự lập |
| Xe về kho | + hàng khách không nhận | Không đổi (đã ghi theo số thực nhận) | — | Phiếu nhập trả về |
| Khách trả hàng | + (giá vốn đã xuất) | Phải thu − | — | TH + phiếu nhập trả về |
| Phiếu thu | — | Phải thu − (hoặc trả trước) | + | Phiếu thu |
| Phiếu chi | — | Phải trả − (hoặc trả trước) | − (không vượt tồn quỹ) | Phiếu chi |
| Kiểm kê | Điều chỉnh theo chênh lệch | — | — | Phiếu kiểm kê |
| Chuyển kho | − kho xuất, + kho nhận | — | — | Phiếu chuyển kho |
| Huỷ phiếu kho lập tay / phiếu thu chi | Đảo lại | Mở lại công nợ đã đối trừ | Đảo lại | Giữ phiếu, đánh dấu Đã huỷ |

# 6. Mã chứng từ

| Loại | Tiền tố | Ví dụ |
|---|---|---|
| Hàng hoá: vật tư / thành phẩm / dịch vụ | VT / SP / DV | VT0000008 |
| Khách hàng / Nhà cung cấp / Xe / Kho | KH / NCC / XE / KHO | KH0000004 |
| Báo giá | BG | BG0000003 |
| Đơn hàng bán | DH | DH0000014 |
| Phiếu trả hàng bán | TH | TH0000002 |
| Đơn nhập hàng | DN | DN0000009 |
| Trả lại hàng mua | TLM | TLM0000001 |
| Lệnh sản xuất | LSX | LSX0000039 |
| Chuyến giao hàng | CH | CH0000008 |
| Phiếu nhập / xuất / chuyển / kiểm kê kho | PNK / PXK / PCK / PKK | PXK0000051 |
| Phiếu thu / phiếu chi | PT / PC | PT0000120 |
| Khuyến mãi | KM | KM0000002 |

Mã cấp tăng dần, 7 chữ số, cấp khi lưu. Một khoản công nợ theo đợt ghi thêm "·n" sau mã đơn (DH0000012·2).

# 7. Quy tắc xuyên suốt

1. **Không xoá chứng từ — chỉ huỷ hoặc ngừng dùng.** Khách, NCC, xe, thẻ, kho, tài khoản tiền, bảng giá, người dùng đều đổi trạng thái thay vì xoá để giữ lịch sử.
1. **Tồn kho tính theo ĐVT chính.** Số lượng theo ĐVT quy đổi được quy về ĐVT chính bằng tỷ lệ của mặt hàng (không lấy từ chứng từ gửi lên).
1. **Giá vốn bình quân gia quyền di động**, chốt trên từng dòng phiếu xuất; lãi gộp của đơn đã giao không đổi khi giá nhập sau này thay đổi.
1. **Tồn âm** giữ nguyên, không làm tròn về 0; xuất vượt tồn chỉ cảnh báo, trừ khi công ty tắt "Cho xuất quá số tồn" (khi đó chỉ người có quyền Xuất vượt tồn kho làm được).
1. **Doanh thu và công nợ phải thu ghi theo số khách THỰC NHẬN**, mỗi đợt nhận một khoản có hạn riêng. Chiết khấu cả đơn chia về từng dòng theo tỷ lệ giá trị.
1. **Công nợ phải trả ghi theo hàng ĐÃ NHẬN**, mỗi lần nhận một khoản.
1. **Ngày chứng từ** theo giờ Việt Nam, không sau hôm nay, không trước mốc trước đó (ngày đặt đơn, ngày xuất kho chuyến, ngày bắt đầu…), không thuộc kỳ đã khoá sổ.
1. **Không chi vượt tồn quỹ** (phiếu chi, huỷ phiếu thu, bỏ chốt giao có phiếu thu tự lập), trừ quyền Chi vượt tồn quỹ.
1. **Giá bán:** bảng giá riêng → giá theo loại khách; khuyến mãi tự áp; không bán dưới giá tối thiểu; chiết khấu ngoài khuyến mãi và bán dưới giá tối thiểu cần quyền riêng; hạn mức công nợ chặn đơn vượt nợ.
1. **Giá nhập, giá vốn, giá trị tồn** chỉ gửi cho chức vụ được xem.
1. **Tiền VND làm tròn đến đồng.** Dòng cuối nhận phần dư làm tròn để tổng chia khớp tuyệt đối.
1. **Số tiền dương/âm có màu:** xanh cho thu/tăng, đỏ cho chi/giảm/âm; dấu trừ hiển thị là "−".
1. **Chứng từ lập từ màn hình khác mang tham số quay lại (?back=)** và quay về đúng nơi gọi kèm thông báo.
1. Mọi thao tác ghi đi qua API của máy chủ và được ghi vào **Nhật ký hoạt động** trong cùng giao dịch: ai, lúc nào (đến giây), chứng từ nào, trường nào đổi từ giá trị nào sang giá trị nào. Không ai sửa hay xoá được nhật ký (ATL-27).

# 8. Chỉ mục tài liệu Atlas

| Mã | Chức năng | Phân hệ | Đường dẫn |
|---|---|---|---|
| ATL-01 | Đăng nhập & phiên làm việc | Hệ thống | /login, /doi-mat-khau |
| ATL-02 | Tổng quan | Tổng quan | /tong-quan |
| ATL-03 | Báo cáo | Báo cáo | /bao-cao |
| ATL-04 | Hàng hoá & định mức | Nghiệp vụ | /hang-hoa |
| ATL-05 | Tồn kho | Nghiệp vụ | /kho/ton-kho |
| ATL-06 | Phiếu kho | Nghiệp vụ | /kho/phieu |
| ATL-07 | Lệnh sản xuất | Nghiệp vụ | /san-xuat |
| ATL-08 | Nhà cung cấp | Mua hàng | /nha-cung-cap |
| ATL-09 | Đơn nhập hàng & trả lại hàng mua | Mua hàng | /mua-hang |
| ATL-10 | Công nợ phải trả | Mua hàng | /cong-no/nha-cung-cap |
| ATL-11 | Khách hàng | Bán hàng | /khach-hang |
| ATL-12 | Đơn hàng bán, trả hàng, hoá đơn | Bán hàng | /don-hang |
| ATL-13 | Chuyến giao hàng | Bán hàng | /giao-hang |
| ATL-14 | Danh mục xe | Bán hàng | /xe |
| ATL-15 | Công nợ phải thu | Bán hàng | /cong-no/khach-hang |
| ATL-16 | Phiếu thu chi | Dòng tiền | /thu-chi |
| ATL-17 | Tài khoản tiền | Dòng tiền | /thu-chi/tai-khoan |
| ATL-18 | Loại thu chi | Dòng tiền | /thu-chi/loai |
| ATL-19 | Tuổi nợ | Dòng tiền | /cong-no/tuoi-no |
| ATL-20 | Thông tin công ty, khoá sổ | Thiết lập | /thiet-lap/cong-ty |
| ATL-21 | Thẻ đánh dấu | Thiết lập | /thiet-lap/the |
| ATL-22 | Người dùng | Thiết lập | /thiet-lap/nguoi-dung |
| ATL-23 | Chức vụ & phân quyền | Thiết lập | /thiet-lap/chuc-vu |
| ATL-24 | Màu hiển thị | Thiết lập | /thiet-lap/mau-hien-thi |
| ATL-25 | Tìm hoặc tạo nhanh & mật độ hiển thị | Hệ thống | Thanh trên cùng (Ctrl K) |
| ATL-26 | Phiếu in (khuôn in chung) | Hệ thống | Nút In ở các màn hình chứng từ |
| ATL-27 | Nhật ký hoạt động | Thiết lập | /thiet-lap/nhat-ky |
| ATL-28 | Báo giá | Bán hàng | /bao-gia |
| ATL-29 | Bảng giá riêng | Bán hàng | /bang-gia |
| ATL-30 | Khuyến mãi | Bán hàng | /khuyen-mai |
| ATL-31 | Nhắc nợ & thông báo công nợ | Bán hàng | /cong-no/nhac-no |
| ATL-32 | Danh mục kho | Thiết lập | /thiet-lap/kho |
| ATL-33 | Nhóm hàng | Thiết lập | /thiet-lap/nhom-hang |
| ATL-34 | Quản trị nền tảng (nhiều doanh nghiệp) | Hệ thống | /quan-tri-nen-tang |

# 9. Ghi chú & giới hạn hiện tại

- Hệ thống chạy trên máy chủ: giao diện Angular gọi API NestJS, dữ liệu lưu ở PostgreSQL; bản triển khai dùng Render (ứng dụng) và Neon (cơ sở dữ liệu). Có thể chạy nhiều doanh nghiệp trên một bản triển khai, mỗi doanh nghiệp một cơ sở dữ liệu (ATL-34). Sao lưu mã hoá hằng ngày.
- Danh sách lớn (đơn bán, đơn nhập, phiếu kho, phiếu thu chi) phân trang trên máy chủ; lúc đăng nhập chỉ nạp chứng từ còn mở và 90 ngày gần nhất.
- Báo cáo: cả 21 báo cáo đã chạy (ATL-03).
- **Bản 1.2 (29/10/2026):** thêm tài liệu Nhật ký hoạt động (ATL-27), Báo giá (ATL-28), Bảng giá (ATL-29), Khuyến mãi (ATL-30), Nhắc nợ (ATL-31), Kho (ATL-32), Nhóm hàng (ATL-33), Quản trị nền tảng (ATL-34); cập nhật theo nghiệp vụ kế toán kiểu MISA: công nợ theo đợt, trả hàng bán / trả lại hàng mua, khoá sổ, không chi vượt tồn quỹ, giá vốn bình quân di động chốt lúc xuất, giá bán tối thiểu, hạn mức công nợ, ngày chứng từ, xuất quá số tồn, xuất khẩu & ngoại tệ, hoá đơn GTGT xem trước; đổi mật khẩu bắt buộc, giới hạn thử đăng nhập; Tổng quan và trang Báo cáo thiết kế lại; in A4 / A5 / K80; 113 quyền.
- Chưa làm: gửi nhắc nợ tự động (SMS brandname, Zalo OA), phát hành hoá đơn điện tử, lưu ảnh ngoài cơ sở dữ liệu, link theo dõi đơn cho khách và ảnh xác nhận giao hàng, phân trang máy chủ cho chuyến giao hàng và lệnh sản xuất.
- Xuất Excel (mọi màn hình): tên file tiếng Việt có dấu kèm ngày giờ xuất, ví dụ "Đơn hàng bán - 22-10-2026 14h35.xlsx"; file mẫu nhập liệu không có ngày giờ.
- Dữ liệu được lưu ở máy chủ (cơ sở dữ liệu PostgreSQL) và đọc / ghi qua API; các quy tắc nghiệp vụ trong tài liệu này được áp ở máy chủ, giao diện báo lỗi sớm cho người dùng. Mỗi thao tác ghi để lại một dòng Nhật ký hoạt động (ATL-27).
