# Quy định hoá đơn điện tử Việt Nam từ tháng 7/2026: phần mềm cần làm gì

Từ ngày 01/07/2026, hoá đơn điện tử vận hành theo Nghị định 254/2026/NĐ-CP và Thông tư 91/2026/TT-BTC. Hai văn bản này thay NĐ 123/2020, NĐ 70/2025 và TT 32/2025. Chuẩn dữ liệu XML và chữ ký số hiện hành là QĐ 1233/QĐ-CT ngày 27/08/2026.

Với một phần mềm bán hàng kiểu MISA cho doanh nghiệp nhỏ và vừa, yêu cầu gói lại trong năm điểm:

1. Mặc định lập hoá đơn có mã của cơ quan thuế.
2. Lập hoá đơn khi chuyển giao quyền sở hữu ở mỗi lần giao hàng, dù khách đã trả tiền hay chưa.
3. Sửa sai chỉ bằng thông báo Mẫu 04/SS-HĐĐT, hoá đơn điều chỉnh hoặc hoá đơn thay thế. Huỷ hoá đơn đã bị bỏ từ 01/06/2025.
4. Truyền dữ liệu qua một nhà cung cấp dịch vụ được cấp phép. Chỉ đơn vị lập từ một triệu hoá đơn mỗi tháng mới được kết nối thẳng với cơ quan thuế.
5. Kịp hai mốc kỹ thuật: từ 01/01/2027 chỉ nhận thông điệp phiên bản 2.1.1, từ 10/04/2027 chỉ nhận chữ ký XAdES.

Mức phạt lập hoá đơn trễ hoặc không lập tăng theo số hoá đơn vi phạm, tối đa 70 và 80 triệu đồng. Vì vậy một lỗi sai thời điểm có tính hệ thống trong phần mềm là rủi ro lớn nhất. Để đáp ứng, phần mềm cần bốn thứ: sinh hoá đơn từ phiếu xuất kho, bộ quy tắc chọn theo ngày hoá đơn (chế độ cũ, chế độ mới, thời hạn thuế suất 8%, chuẩn chữ ký), một lớp kết nối không phụ thuộc nhà cung cấp, và quy trình sửa sai không có nút "huỷ".

Lưu ý chung cho cả báo cáo: chưa lấy được toàn văn TT 91, cũng chưa đọc được phụ lục chi tiết từng trường của QĐ 1233. Một số chi tiết bên dưới dựa trên bản tóm tắt thứ cấp và được đánh dấu ở chỗ cần.

## NĐ 254 và TT 91 thay toàn bộ quy định giai đoạn 2020–2025 từ 01/07/2026

NĐ 254/2026/NĐ-CP ban hành ngày 30/06/2026, có hiệu lực từ 01/07/2026. Nghị định hướng dẫn Luật Quản lý thuế mới 108/2025/QH15 và thay NĐ 123/2020 đã sửa đổi bởi NĐ 70/2025 ([EY Việt Nam](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)). Điều khoản chuyển tiếp bãi bỏ NĐ 123, Điều 1 NĐ 41/2022 và NĐ 70 ([MISA meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)). TT 91/2026/TT-BTC có hiệu lực cùng ngày, thay TT 32/2025 ([meInvoice về TT 91](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)).

Nghị định mới gọn hơn NĐ 123. Nó không còn quy định chi tiết về đăng ký, định dạng hoá đơn, trường hợp phải dùng hoá đơn có mã, hay điều chỉnh và thay thế. Bộ Tài chính đưa các nội dung đó vào TT 91 và các phụ lục ([EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)). Với lập trình viên, tài liệu cần đọc là Phụ lục I của TT 91 (ký hiệu), Phụ lục III (các mẫu 01/ĐKTĐ-HĐĐT, 04/SS-HĐĐT, 01/TH-HĐĐT, 01/BK-ĐCTT) và Phụ lục V (mẫu thể hiện tham khảo). Cơ quan thuế giải thích các điểm thay đổi trong Công văn 4831/CT-CS ngày 15/07/2026.

Một nguồn thứ cấp cho biết giao dịch hoàn thành trong tháng 6/2026 vẫn theo NĐ 123/NĐ 70 dù lập hoá đơn trễ sang tháng 7 ([Kế toán Lê Ánh](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/thoi-diem-lap-hoa-don-dien-tu.html)). Vì vậy phần mềm nên có công tắc chế độ theo ngày giao dịch và ngày hoá đơn, thay vì viết cứng quy định mới.

Về nguồn: nội dung điều khoản NĐ 254 trích ở đây lấy từ trang sao chép hethongphapluat.com, vì thuvienphapluat.vn chặn truy cập tự động. Chi tiết TT 91 lấy từ bản tóm tắt của nhà cung cấp và công ty luật, không phải từ Công báo.

### Ai dùng loại hoá đơn nào

Hoá đơn có mã nay là mặc định cho mọi đối tượng. Điều 6.1(a) NĐ 254 yêu cầu tổ chức kinh tế, hộ và cá nhân kinh doanh, người nộp thuế rủi ro cao dùng hoá đơn có mã. Hoá đơn không có mã chỉ dành cho các ngành được liệt kê: điện, xăng dầu, viễn thông, nước, ngân hàng, chứng khoán, bảo hiểm, y tế, thương mại điện tử, siêu thị, "thương mại" và vận tải. Doanh nghiệp trong các ngành đó còn phải có hạ tầng công nghệ để truyền dữ liệu, không thuộc diện rủi ro cao và chưa đăng ký hoá đơn có mã ([NĐ 254 Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6)).

Một doanh nghiệp thương mại có thể được dùng hoá đơn không mã theo nhóm "thương mại". Tuy nhiên người nộp thuế bị đưa vào diện rủi ro cao theo Mẫu 01/TB-KTT phải chuyển sang hoá đơn có mã trong 10 ngày làm việc ([MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)). Phần mềm nên hỗ trợ cả hai, mặc định có mã.

Hoá đơn khởi tạo từ máy tính tiền dùng cho bán trực tiếp đến người tiêu dùng trong bán lẻ, ăn uống, khách sạn, vận tải hành khách, giải trí và dịch vụ cá nhân. Người bán đã đăng ký hoá đơn có mã hoặc không mã thì không bắt buộc đăng ký thêm loại này (Điều 6.1(c)). Hoá đơn máy tính tiền không cần chữ ký số, và người mua được tính là có hoá đơn hợp lệ nếu tra cứu được trên hệ thống thuế (Điều 8.9) ([NĐ 254 Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)). Hộ và cá nhân kinh doanh có doanh thu năm trên 1 tỷ đồng phải dùng hoá đơn có mã hoặc hoá đơn máy tính tiền (Điều 6.1(d)).

### Đăng ký và đường truyền

Đăng ký và thay đổi thông tin vẫn dùng Mẫu 01/ĐKTĐ-HĐĐT, nay theo Điều 6 TT 91 ([Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)). Mỗi lần thay đổi đăng ký phải xác thực sinh trắc học hoặc OTP ([einvoice.vn](https://einvoice.vn/tin-tuc/cap-nhat-hoa-don-dien-tu-thang-10-den-12-2026)).

Kiến trúc tích hợp do Điều 16.3(b) quyết định. Chỉ đơn vị lập "từ 1.000.000 hóa đơn một tháng trở lên", hoặc công ty mẹ có hệ thống tập trung, được kết nối thẳng với cơ quan thuế. Mọi đơn vị khác truyền qua nhà cung cấp dịch vụ hoá đơn đã ký hợp đồng ([NĐ 254 Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)). Phần mềm không bao giờ tự nói chuyện với Tổng cục Thuế. Hoá đơn giấy do cơ quan thuế đặt in hết giá trị từ 01/07/2026 ([NĐ 254 Điều 44](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-44)).

### Các loại hoá đơn

Điều 8 giữ các loại quen thuộc:

- Hoá đơn GTGT: cho người nộp thuế theo phương pháp khấu trừ, kể cả hàng xuất khẩu.
- Hoá đơn bán hàng: cho người nộp thuế theo phương pháp trực tiếp, và cho tổ chức trong khu phi thuế quan (kèm dòng chữ bắt buộc).
- Hoá đơn thương mại điện tử: cho doanh nghiệp xuất khẩu truyền được dữ liệu hoá đơn thương mại bằng điện tử. Doanh nghiệp không truyền được thì dùng hoá đơn GTGT hoặc hoá đơn bán hàng.

Điều 8.7 quy định phiếu xuất kho kiêm vận chuyển nội bộ và phiếu xuất kho hàng gửi bán đại lý "được đăng ký, sử dụng và quản lý như hóa đơn" ([NĐ 254 Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)).

### Nội dung bắt buộc

Điều 10.1 yêu cầu: tên hoá đơn, ký hiệu mẫu số, ký hiệu và số hoá đơn; tên, địa chỉ, mã số thuế người bán; tên, địa chỉ người mua và mã số thuế, mã đơn vị có quan hệ với ngân sách hoặc số định danh cá nhân; tên hàng, đơn vị tính, số lượng, đơn giá, thành tiền chưa thuế, thuế suất, tiền thuế theo từng thuế suất và tổng cộng; ngày lập, thời điểm ký, mã của cơ quan thuế; phí, chiết khấu thương mại, khuyến mại. Không bắt buộc chữ ký người mua trừ khi hai bên thoả thuận ([NĐ 254 Điều 10](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-10)).

Phụ lục NĐ 254 thêm dòng "Bán cho người tiêu dùng" khi người mua cá nhân không cung cấp thông tin, và số hộ chiếu cùng quốc tịch với người mua nước ngoài ([meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)). Một nguồn cho biết tên hàng ghi theo mã phân loại sản phẩm 7 chữ số của QĐ 43/2018, hoặc mã HS với hàng nhập khẩu ([Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)).

Do đó danh mục khách hàng và hàng hoá cần thêm các trường: mã số thuế, mã đơn vị ngân sách, CCCD hoặc số định danh, hộ chiếu và quốc tịch, cờ "người tiêu dùng", mã phân loại sản phẩm, và nhiều địa chỉ địa điểm kinh doanh cho cùng một mã số thuế.

### Mức phạt

Mức phạt vẫn nằm ở NĐ 125/2020. NĐ 310/2025 (hiệu lực 16/01/2026) sửa đổi và đưa vào mức phạt theo bậc số lượng hoá đơn. NĐ 291/2026 tiếp tục sửa đổi, bổ sung chế tài về trao đổi thông tin, và theo các nguồn đã đọc không đổi mức phạt hoá đơn ([meInvoice về NĐ 310](https://www.meinvoice.vn/tin-tuc/42191/nghi-dinh-310-2025-nd-cp-sua-doi-nghi-dinh-125-2020/); [LuatVietnam về NĐ 291](https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-291-2026-nd-cp-sua-doi-nghi-dinh-125-2020-nd-cp-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don-186-110744-article.html)). Bảng dưới là mức phạt với hoạt động bán hàng thông thường ([MISA AMIS về NĐ 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)).

| Số hoá đơn vi phạm | Lập sai thời điểm (đồng) | Không lập (đồng) |
|---|---|---|
| 1 | 0,5–1,5 triệu | 1–2 triệu |
| 2 đến dưới 10 | 2–5 triệu | 2–10 triệu |
| 10 đến dưới 20 | 5–15 triệu | 10–30 triệu |
| 20 đến dưới 50 | 15–30 triệu | 30–50 triệu |
| 50 đến dưới 100 | 30–50 triệu | 60–80 triệu |
| Từ 100 trở lên | 50–70 triệu | 60–80 triệu |

Hàng khuyến mại, biếu tặng, hàng mẫu, tiêu dùng nội bộ và cho mượn hàng có bảng nhẹ hơn: một hoá đơn chỉ bị cảnh cáo, cao nhất 15–30 triệu (lập trễ) hoặc 30–50 triệu (không lập) với từ 100 hoá đơn. Điều 41 NĐ 254 còn thưởng người tiêu dùng tố giác tối đa 10% số tiền phạt, không quá 10 triệu đồng mỗi vụ ([meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)).

## QĐ 1233 đặt hai mốc chuyển đổi: phiên bản 2.1.1 từ 01/01/2027 và XAdES từ 10/04/2027

Chuẩn XML đã đổi ba lần. QĐ 1450/QĐ-TCT (2021), sửa đổi bởi QĐ 1510 (2022), được thay bằng QĐ 1306/QĐ-CT ngày 13/06/2025 ([nhansu.vn](https://nhansu.vn/van-ban-phap-luat/Quyet-dinh-1306-QD-CT-2025-thanh-phan-chua-du-lieu-nghiep-vu-hoa-don-chung-tu-dien-tu-664897.html)). QĐ 1306 lại được thay bằng QĐ 1233/QĐ-CT ngày 27/08/2026, có hiệu lực từ ngày ký. Theo Điều 2, thông điệp phiên bản 2.1.0 và 2.1.1 chạy song song đến hết 31/12/2026, chữ ký chuẩn DSig và XAdES chạy song song đến hết 09/04/2027 ([LuatVietnam về QĐ 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)). Công văn 7714/CT-CĐS ngày 16/10/2026 đặt lịch triển khai XAdES vào tháng 11/2026, và hệ thống thuế bắt đầu nhận thông điệp theo QĐ 1233 trong tháng đó ([einvoice.vn](https://einvoice.vn/tin-tuc/cap-nhat-hoa-don-dien-tu-thang-10-den-12-2026); [Thuế & Hải quan](https://thuehaiquan.tapchikinhtetaichinh.vn/nang-cap-ha-tang-cong-nghe-thong-tin-phuc-vu-trien-khai-hoa-don-chung-tu-dien-tu-170047.html)).

Quy tắc chung: số tối đa 21 chữ số, tối đa 6 chữ số thập phân; ngày dạng `YYYY-MM-DD`; ngày giờ theo GMT+7 ([M-Invoice](https://minvoice.vn/quyet-dinh-1233-qd-ct-quy-dinh-moi-ve-du-lieu-hoa-don-chung-tu-dien-tu/)). Phụ lục QĐ 1233 là tệp PDF trên 10 MB, không đọc được. Vì thế khác biệt từng trường của phiên bản 2.1.1 chưa được kiểm chứng, kể cả thẻ mới cho CCCD, hộ chiếu, quốc tịch của người mua. Cấu trúc dưới đây lấy từ QĐ 1450. Phụ lục QĐ 1233 dùng cùng các nhóm thẻ, nên nhiều khả năng cấu trúc giữ nguyên.

### Cấu trúc hoá đơn

Hoá đơn có dạng `HDon > DLHDon (TTChung, NDHDon (NBan, NMua, DSHHDVu, TToan)) + DLQRCode + MCCQT + DSCKS`. Nhóm `TTChung` gồm:

- PBan: phiên bản thông điệp;
- KHMSHDon: ký hiệu mẫu số, một chữ số;
- KHHDon: ký hiệu hoá đơn, 6 ký tự;
- SHDon: số hoá đơn, tối đa 8 chữ số;
- NLap: ngày lập;
- DVTTe: mã tiền tệ 3 chữ cái;
- TGia: tỷ giá, Number(7,2), bắt buộc khi tiền tệ khác VND;
- HTTToan: hình thức thanh toán, ghi tự do;
- khối TTHDLQuan khi hoá đơn là điều chỉnh hoặc thay thế.

Dòng hàng gồm TChat, MHHDVu, THHDVu, DVTinh, SLuong, DGia, TLCKhau, STCKhau, ThTien và TSuat. Phần tổng cộng chia theo từng thuế suất, tiếp theo là TgTCThue, TgTThue, TTCKTMai (tổng chiết khấu thương mại), TgTTTBSo và TgTTTBChu (số tiền bằng chữ). Người lập không bao giờ điền MCCQT: hệ thống thuế sinh mã này và chèn vào `HDon`, là chuỗi duy nhất tối đa 34 ký tự ([LuatVietnam về QĐ 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)).

Các danh mục mã trong phụ lục QĐ 1233 mà phần mềm phải mô hình hoá ([LuatVietnam về QĐ 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)):

| Trường | Giá trị (QĐ 1233) | Ghi chú khi xây dựng |
|---|---|---|
| TChat (tính chất dòng) | 1 hàng hoá, dịch vụ; 2 khuyến mại; 3 chiết khấu thương mại; 4 ghi chú; 5 hàng đặc trưng | Quyết định cách hiện dòng khuyến mại và chiết khấu |
| TSuat (thuế suất) | 0%, 5%, 8%, 10%, KCT, KKKNT, KHAC hoặc KHAC:AB.CD%, CTTC, KTPVDC, KTGTT | Lưu dạng mã chuỗi, không lưu dạng số |
| DVTTe (tiền tệ) | 21 mã ISO: VND, USD, EUR, JPY, CNY, KRW, SGD, THB và các mã khác | TGia bắt buộc khi khác VND |
| TCHDon / LHDCLQuan | 1 thay thế, 2 điều chỉnh / loại hoá đơn liên quan 1 = NĐ 123/70, 5 = NĐ 254 | Chọn theo ngày của hoá đơn gốc |
| Lý do điều chỉnh (Phụ lục XVII) | 14 mã, ví dụ 4 chiết khấu thương mại, 5 trả lại hàng không phải đăng ký, 8 huỷ giao dịch, 13 sai sót chung, 14 thay thế hoá đơn máy tính tiền | Thêm trường lý do có mã cho chứng từ sửa sai |

### Mẫu số, ký hiệu và số hoá đơn

Ký hiệu mẫu số là một chữ số từ 1 đến 9: 1 hoá đơn GTGT, 2 hoá đơn bán hàng, 6 phiếu xuất kho kiêm vận chuyển nội bộ hoặc gửi bán đại lý, 7 hoá đơn thương mại điện tử, 8 và 9 là hoá đơn tích hợp biên lai.

Ký hiệu hoá đơn có 6 ký tự. Ký tự đầu là C (có mã) hoặc K (không mã). Hai ký tự tiếp là năm. Ký tự thứ tư là loại: T doanh nghiệp đã đăng ký, M máy tính tiền, N phiếu xuất kho nội bộ, B phiếu gửi bán đại lý, X hoá đơn thương mại điện tử. Hai ký tự cuối do người bán tự chọn. Ví dụ 1C26TAA, 6K26NAB ([einvoice.vn](https://einvoice.vn/tin-tuc/quy-dinh-ve-ky-hieu-mau-so-ky-hieu-hoa-don-dien-tu-tu-ngay-01-6-2025-theo-thong-tu-32-2025-tt-btc)). MISA cho biết TT 91 thêm chữ F, cho hoá đơn GTGT tích hợp tờ khai hoàn thuế ([MISA về TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/)). Các nguồn chưa thống nhất chữ X là mới hay có từ trước.

Số hoá đơn chạy liên tục theo từng ký hiệu và bắt đầu lại từ 1 mỗi năm ([MAN](https://thue.man.net.vn/nghi-dinh-254-2026/)). Phần mềm phải chuyển dãy số vào ngày 1 tháng 1: hoá đơn ngày năm 2027 không được mang ký hiệu "26".

### Thông điệp và trạng thái

Mỗi dữ liệu được gói trong `TDiep`, với mã `MLTDiep` cho biết loại thông điệp. Các mã chính:

- 200: gửi hoá đơn đề nghị cấp mã;
- 202: kết quả cấp mã;
- 203: dữ liệu hoá đơn không mã;
- 204: kết quả kiểm tra (01/TB-KTDL);
- 206 / 216: hoá đơn máy tính tiền có mã / không mã;
- 208 / 210: điều chỉnh hoặc thay thế nhiều hoá đơn kèm bảng kê;
- 300: thông báo sai sót;
- 400: bảng tổng hợp;
- 999: phản hồi kỹ thuật;
- -1: lỗi định dạng.

Trên thực tế, hoá đơn có mã chỉ hoàn chỉnh về pháp lý khi thông điệp 202 trả về hoá đơn kèm MCCQT và chữ ký của cơ quan thuế. Vì vậy "người bán đã ký" và "cơ quan thuế đã cấp mã" phải là hai trạng thái riêng trong phần mềm.

### Truyền dữ liệu và chữ ký

Với hoá đơn không mã, mặc định người bán hàng hoá gửi toàn bộ nội dung cho người mua và cơ quan thuế chậm nhất ngày làm việc tiếp theo sau ngày lập (Điều 16.3(a.3)). Bảng tổng hợp 01/TH-HĐĐT chỉ dành cho các ngành được liệt kê ([NĐ 254 Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)).

Người bán ký `DLHDon` bằng XML Signature, đặt ở `DSCKS/NBan`, có thuộc tính `SigningTime` và chứng thư số nhúng kèm. Cơ quan thuế ký tiếp ở `DSCKS/CQT` ([LuatVietnam về QĐ 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)). Nếu thời điểm ký khác ngày lập, dữ liệu vẫn phải gửi chậm nhất ngày làm việc tiếp theo ([MAN](https://thue.man.net.vn/nghi-dinh-254-2026/)). Chưa có nguồn gốc nào xác nhận được hồ sơ XAdES cụ thể, kể cả có bắt buộc gắn dấu thời gian hay không. Khối QR (`DLQRCode`) là tuỳ chọn, theo định dạng EMVCo/VietQR với một trường con chứa thông tin hoá đơn.

Thuế suất 8% theo Nghị quyết 204/2025/QH15 và NĐ 174/2025 chỉ áp dụng đến 31/12/2026, có danh sách loại trừ. Đến ngày 11/11/2026 chưa thấy văn bản gia hạn ([einvoice.vn về NĐ 174](https://einvoice.vn/van-ban-hddt/nghi-dinh-174-2025-nd-cp-quy-dinh-ve-chinh-sach-giam-thue-gtgt-theo-nghi-quyet-so-204-2025-qh15)). Phần mềm nên chỉ cho chọn 8% theo ngày hoá đơn.

## Chỉ MISA công khai tài liệu API, nên cần lớp kết nối không phụ thuộc nhà cung cấp

Doanh nghiệp nhỏ và vừa phải truyền qua nhà cung cấp, nên thứ phần mềm tích hợp là API của nhà cung cấp chứ không phải XML của cơ quan thuế. Các nhà cung cấp chính: Viettel S-Invoice, VNPT Invoice, MISA meInvoice, BKAV eHoadon, Softdreams EasyInvoice, M-Invoice, Thái Sơn, FPT và MobiFone. Các nền tảng bán hàng như KiotViet, Sapo, Haravan, iPOS nay có tên trong danh sách 39 đơn vị công nghệ hỗ trợ hộ kinh doanh năm 2026 của cơ quan thuế ([Thuế & Hải quan](https://thuehaiquan.tapchikinhtetaichinh.vn/cong-bo-39-ong-lon-cong-nghe-tiep-suc-ho-kinh-doanh-trien-khai-hoa-don-dien-tu-152563.html)). Không có số liệu thị phần đáng tin, chỉ có lời tự nhận "số một" của nhà cung cấp. Thường khách hàng, không phải người viết phần mềm, chọn nhà cung cấp. Đó là lý do chính để thiết kế cho nhiều nhà cung cấp.

### Tài liệu từng nhà cung cấp

Tài liệu công khai rất ít:

- **MISA meInvoice** là nhà cung cấp duy nhất có trang dành cho lập trình viên (doc.meinvoice.vn), mô tả tích hợp REST/JSON ([meInvoice](https://www.meinvoice.vn/?p=44747)). SDK .NET cộng đồng MisaConnect.EInvoice (v2.10.0, 07/11/2026) xác nhận môi trường thử `https://testapi.meinvoice.vn/api/integration` và môi trường thật `https://api.meinvoice.vn/api/integration`. SDK đăng nhập bằng TaxCode, UserName, Password và AppId để lấy Bearer token, có các thao tác lấy mẫu, xem trước PDF, lưu nháp, tra cứu theo RefId, điều chỉnh, thay thế ([NuGet](https://www.nuget.org/packages/MisaConnect.EInvoice)). Đây là mã cộng đồng, không phải sản phẩm chính thức của MISA.
- **Viettel S-Invoice** có tài liệu webservice V2.0 (11/2024) lưu hành ngoài tên miền của Viettel. Hướng dẫn của Viindoo cho địa chỉ gốc v2 `https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/`, đăng nhập bằng tài khoản và mật khẩu, ký số phía máy chủ Viettel. Hướng dẫn này cũng ghi thông báo sai sót 04/SS phải gửi trên cổng S-Invoice, không qua API ([Viindoo](https://viindoo.com/documentation/15.0/applications/finance/accounting-and-invoicing/fiscal-localizations/issue-e-invoice-by-integrating-viindoo-with-viettel-s-s-invoice-service.html)).
- **VNPT, BKAV, EasyInvoice, M-Invoice, FPT, CyberLotus, Thái Sơn** không công khai tài liệu API. Tài liệu do nhân viên kinh doanh cung cấp. Cổng đối tác SmartCA của VNPT chỉ hướng ký số từ xa ([VNPT SmartCA](https://doitac-smartca.vnpt.vn/help/document/TL_tich_hop_ban_hang_SmartCA_v1.0.pdf)). Các chi tiết nhớ được về những nhà cung cấp này (đường dẫn Viettel dùng Basic auth và `transactionUuid`, dịch vụ SOAP của VNPT dùng `Fkey`, điểm cuối `ExecCommand` của BKAV) chưa kiểm chứng, cần đối chiếu với tài liệu nhà cung cấp gửi.

### Dịch vụ gom nhiều nhà cung cấp

Hai dịch vụ đặt một API chung trước nhiều nhà cung cấp:

- **SePay** dùng Bearer token. Các lệnh tạo, phát hành, điều chỉnh, thay thế đều bất đồng bộ: mỗi lệnh trả về `tracking_code` để hỏi trạng thái. Chưa thấy webhook hay lệnh huỷ trong tài liệu ([SePay](https://developer.sepay.vn/en/einvoice-api/tong-quan)).
- **Tingee** ký yêu cầu bằng HMAC-SHA512, nhận `invoiceCode` do đối tác tự sinh làm khoá chống trùng, có trường tiền tệ, tỷ giá, chiết khấu theo phần trăm hoặc số tiền, mã thuế -1 (KCT) và -2 (KKKNT) ([Tingee](http://developers.tingee.vn/docs/hoa-don-dien-tu/create/)).

### Mẫu kiến trúc tham khảo

Mẫu tốt nhất để tham khảo là module Odoo 18 `l10n_vn_viin_edi` của Viindoo. Module có một lớp nền không phụ thuộc nhà cung cấp, bộ trạng thái chung (chờ phát hành, đã phát hành, đã điều chỉnh, đã thay thế, đã huỷ, lỗi) và bộ chuyển đổi riêng cho S-Invoice, VN-Invoice và meInvoice. Mặc định module chặn huỷ hoá đơn đã phát hành từ 01/07/2026. Module cũng cho thấy khả năng thực tế khác nhau giữa nhà cung cấp: điều chỉnh tăng không làm được qua API với MISA và VN-Invoice trong module này ([kho ứng dụng Viindoo](https://viindoo.com/vi/apps/app/18.0/l10n_vn_viin_edi)).

Giá giảm mạnh trong năm 2025. Viettel, VNPT và MobiFone cam kết dưới 50 đồng mỗi hoá đơn cho hộ kinh doanh, M-Invoice và Fast cam kết 30 đồng ([VCCI](https://www.vcci.com.vn/tin-tuc/nha-cung-cap-dich-vu-cam-ket-giam-gia-hoa-don-dien-tu-cho-ho-kinh-doanh)).

### Thiết kế tích hợp

Từ các điểm trên, thiết kế như sau:

- Định nghĩa interface `EInvoiceProvider` với các thao tác: lấy mẫu và dãy ký hiệu, tạo nháp, phát hành, điều chỉnh, thay thế, lấy trạng thái, lấy PDF/XML, gửi email cho người mua, và gửi 04/SS nếu nhà cung cấp hỗ trợ.
- Lưu cấu hình nhà cung cấp theo từng doanh nghiệp, kèm bảng khả năng của từng nhà cung cấp.
- Trước mỗi lệnh, sinh và lưu khoá đối tác (RefId, transactionUuid, invoiceCode hoặc Fkey). Khi quá thời gian chờ, tra cứu theo khoá đó, không tạo lại hoá đơn.
- Chạy tác vụ nền hỏi trạng thái đến khi có MCCQT, rồi lấy XML và PDF cuối cùng.
- Yêu cầu chứng thư HSM hoặc ký số từ xa. Token USB hợp với phần mềm cài trên máy, không hợp với web.
- Trước 01/01/2027, xin xác nhận bằng văn bản rằng mỗi nhà cung cấp đã chuyển sang QĐ 1233 / 2.1.1 và XAdES. Tài liệu API nào đề ngày trước giữa năm 2026 đều cần kiểm tra lại.

## Giao hàng, không phải đơn hàng hay thanh toán, là lúc lập hoá đơn

Điều 9.1 NĐ 254 quy định thời điểm lập hoá đơn bán hàng hoá là lúc chuyển giao quyền sở hữu hoặc quyền sử dụng, "không phân biệt đã thu được tiền hay chưa thu được tiền". Hàng xuất khẩu lập hoá đơn chậm nhất ngày làm việc tiếp theo sau ngày thông quan. Điều 9.3 yêu cầu "mỗi lần giao hàng" lập hoá đơn cho số lượng đã giao ([NĐ 254 Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)).

Suy ra báo giá và đơn hàng chưa giao không bao giờ sinh hoá đơn. Chứng từ gắn với hoá đơn là phiếu xuất kho bán hàng, không phải đơn bán hàng.

Bảng dưới đối chiếu từng tình huống với quy định hiện hành. Phần nghiên cứu tình huống ban đầu dẫn NĐ 123/NĐ 70/TT 32. Với quy định được giữ nguyên, bảng dẫn văn bản hiện hành. Với quy định NĐ 254 đã thay đổi, bảng ghi rõ.

| Tình huống | Có lập hoá đơn? | Chứng từ và thời điểm | Căn cứ hiện hành | Độ tin cậy |
|---|---|---|---|---|
| Báo giá; đơn bán đã xác nhận nhưng chưa giao | Không | Không lập đến khi giao | Điều 9.1 NĐ 254 (suy luận) | Cao |
| Giao hàng, một hoặc nhiều lần | Có, mỗi lần giao một hoá đơn | Hoá đơn GTGT (mẫu 1) hoặc bán hàng (mẫu 2), ngày giao | Điều 9.1, 9.3 (giữ từ NĐ 123) | Cao |
| Khách đặt cọc hoặc trả trước tiền hàng | Không | Ghi nhận khách trả trước; lập hoá đơn khi giao rồi bù trừ | Điều 9.1; Điều 9.2 nay loại trừ mọi khoản đặt cọc theo Bộ luật Dân sự | Cao với hàng hoá |
| Trả trước tiền dịch vụ (lắp đặt, bảo trì) | Có, khi thu tiền | Trừ khi là đặt cọc bảo đảm hợp đồng theo Bộ luật Dân sự | Điều 9.2, mở rộng so với danh sách dịch vụ chuyên môn của NĐ 70 | Trung bình (EY cho rằng phạm vi chưa rõ) |
| Phiếu thu cho khoản bán đã có hoá đơn | Không | Không | Điều 9.1 (suy luận) | Cao |
| Chiết khấu thương mại biết ngay khi bán | Ghi trên hoá đơn | Dòng chiết khấu (TChat 3) hoặc TTCKTMai | Điều 10.1(k) | Cao |
| Chiết khấu thương mại cuối kỳ | Có | Trừ trên hoá đơn cuối hoặc hoá đơn sau, không vượt giá trị hoá đơn đó; hoặc lập hoá đơn điều chỉnh riêng kèm bảng kê | Điều 10 TT 91 (theo MAN) | Trung bình |
| Chiết khấu thanh toán | Không | Chi phí tài chính, không lập hoá đơn | Công văn 1810/VLO-QLDN3 | Trung bình |
| Khuyến mại, biếu tặng, hàng mẫu | Có | Dòng TChat 2; nay được lập một hoá đơn tổng hợp theo tháng hoặc quý | NĐ 254 (theo EY); giá tính thuế bằng 0 theo NĐ 181 | Trung bình đến cao |
| Hàng bán bị trả lại | Có, người bán lập điều chỉnh giảm | Người mua chỉ lập hoá đơn trả hàng khi hai bên thoả thuận, hoặc với tài sản phải đăng ký | Điều 10 TT 91 (giữ từ NĐ 70) | Cao |
| Xuất khẩu bằng ngoại tệ | Có | Mẫu 7 (X) nếu kết nối dữ liệu với cơ quan thuế, nếu không dùng hoá đơn GTGT; chậm nhất một ngày làm việc sau thông quan; DVTTe và TGia | Điều 8.3, 9.1 | Trung bình (chưa đọc được quy tắc tỷ giá) |
| Bán lẻ tại quầy | Có, mỗi lần bán | Ghi "Bán cho người tiêu dùng" nếu khách không cho thông tin; hoá đơn máy tính tiền (M) là tuỳ chọn với đơn vị đã đăng ký hoá đơn có mã | Điều 6.1(c), 10.4, Phụ lục | Trung bình (chưa rõ được lập tổng hợp cuối ngày hay không) |
| Chuyển kho hoặc chuyển chi nhánh nội bộ | Phiếu xuất kho điện tử | Mẫu 6, chữ N, quản lý như hoá đơn | Điều 8.7 | Cao |
| Hàng gửi bán đại lý | Phiếu xuất kho điện tử | Mẫu 6, chữ B; lập hoá đơn khi đại lý báo bán được | Điều 8.7; quy trình đại lý theo thực tiễn trước đây | Trung bình |
| Sản xuất (xuất vật tư, nhập thành phẩm) | Không | Chỉ chứng từ nội bộ | Điều 7, qua các trường hợp sản xuất nội bộ của NĐ 181 | Trung bình |
| Mua của nhà cung cấp có đăng ký thuế GTGT | Nhà cung cấp lập | Lưu mẫu số, ký hiệu, số, ngày và MCCQT theo phiếu nhập | Điều 8.9 với hoá đơn máy tính tiền | Cao |
| Mua của hộ kinh doanh không có hoá đơn | Không có hoá đơn | Bảng kê 02/TNDN cho các nhóm được phép; không khấu trừ thuế đầu vào | TT 20/2026 và NĐ 320/2025 | Trung bình |

### Trả hàng và chiết khấu

Với hàng bán bị trả lại, người bán nay là người lập mặc định. Người bán lập hoá đơn điều chỉnh tham chiếu hoá đơn gốc, mã lý do 5 (trả lại hàng không phải đăng ký). Người mua có thể lập hoá đơn trả hàng thay nếu hai bên thoả thuận; với tài sản phải đăng ký như xe, người mua lập ([MAN về TT 91](https://thue.man.net.vn/thong-tu-91-2026/)). Cách này ngược với thực tiễn trước NĐ 70, khi người mua thường lập hoá đơn trả hàng. Quy định được giữ từ lần NĐ 70 sửa Điều 19 ([LuatVietnam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)).

Các nguồn không phân biệt người mua là doanh nghiệp hay người tiêu dùng. Người tiêu dùng vốn không lập được hoá đơn, nên điều chỉnh giảm của người bán là cách duy nhất, và trả toàn bộ hàng nghĩa là điều chỉnh về 0. Phiếu trả hàng nên bắt buộc đính kèm biên bản trả hàng.

Chiết khấu theo doanh số cuối kỳ theo Điều 10 TT 91. Người bán trừ vào hoá đơn cuối hoặc hoá đơn sau nhưng không vượt giá trị hoá đơn đó, hoặc lập hoá đơn điều chỉnh riêng kèm bảng kê ([MAN về TT 91](https://thue.man.net.vn/thong-tu-91-2026/)). Ví dụ của MISA cho trường hợp vượt: chiết khấu 30 triệu đồng trên hoá đơn cuối chỉ 10 triệu ([MISA AMIS](https://amis.misa.vn/40617/hoa-don-chiet-khau-thuong-mai/)). Chiết khấu thanh toán là khoản tài chính (TK 635 bên bán, TK 515 bên mua) và không được lập hoá đơn ([MISA AMIS](https://amis.misa.vn/26292/hach-toan-chiet-khau-thanh-toan/)).

### Khuyến mại

Coi hàng tặng là "giá 0 nên không lập hoá đơn" là vi phạm ([meInvoice](https://www.meinvoice.vn/?p=38685)). Hàng khuyến mại đúng quy định thương mại có giá tính thuế GTGT bằng 0; khuyến mại dạng giảm giá tính thuế trên giá đã giảm. Khuyến mại không theo quy định thương mại bị tính thuế như hàng biếu tặng, theo giá thị trường ([Hỏi đáp Bộ Tài chính](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158126)).

NĐ 254 thêm một lựa chọn mà phần nghiên cứu tình huống chưa xác nhận được dưới NĐ 70: hàng khuyến mại, biếu tặng được lập một hoá đơn tổng hợp theo tháng hoặc quý, khớp kỳ khai thuế GTGT ([EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)). Phần mềm nên có danh mục chương trình khuyến mại kèm số đăng ký và thời hạn, sinh dòng TChat 2 giá 0, và cảnh báo khi dòng hàng tặng nằm ngoài chương trình còn hiệu lực.

### Xuất khẩu và ngoại tệ

Hoá đơn thương mại điện tử, điểm mà phần nghiên cứu tình huống chưa xác nhận được, nay được quy định rõ tại Điều 8.3: mẫu 7, chữ X. Loại này chỉ dành cho doanh nghiệp xuất khẩu truyền được dữ liệu hoá đơn thương mại bằng điện tử. Doanh nghiệp khác tiếp tục dùng hoá đơn GTGT ([NĐ 254 Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)). Hồ sơ hải quan dùng hoá đơn thương mại và phiếu đóng gói; hoá đơn điện tử lập sau khi thông quan ([MISA AMIS](https://amis.misa.vn/89381/hoa-don-dien-tu-xuat-khau/)). Thuế suất 0% cần hợp đồng xuất khẩu, chứng từ thanh toán không dùng tiền mặt và chứng từ hải quan theo NĐ 181/2025 và TT 69/2025 ([Lao Động](https://news.laodong.vn/kinh-doanh/dieu-kien-ap-dung-thue-suat-gia-tri-gia-tang-0-cho-hang-hoa-dich-vu-xuat-khau-tu-17-1533622.ldo)).

Trong XML, tiền tệ ghi ở DVTTe theo danh mục 21 mã, TGia bắt buộc, số tiền tối đa 6 chữ số thập phân. Quy tắc chọn tỷ giá nào và làm tròn số tiền quy đổi VND nằm ở điểm 8 Phụ lục NĐ 254, chưa lấy được. Trong lúc chờ, nên lưu số tiền nguyên tệ đúng độ chính xác gốc, tỷ giá, và số tiền VND làm tròn đến đồng, theo cách nhà cung cấp đang làm. Phần mềm nên lấy ngày hoá đơn từ ngày thông quan trên tờ khai hải quan và nhắc người dùng vào ngày thông quan cộng một ngày làm việc.

### Bán lẻ tại quầy và thông tin người mua

Mọi lần bán lẻ đều phải lập hoá đơn, kể cả khi khách không lấy ([LuatVietnam](https://luatvietnam.vn/thue-phi-le-phi/xuat-hoa-don-cho-khach-hang-ca-nhan-khong-lay-hoa-don-nhu-the-nao-565-102155-article.html)). Dòng người mua ghi "Bán cho người tiêu dùng" khi không có thông tin, và hoá đơn này không dùng được để người mua tính chi phí ([Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)). Người mua có đăng ký kinh doanh phải được ghi đủ thông tin. Một chi cục thuế đã nhắc trong Công văn 2921/ĐTTNG-QLDN không được ghi "khách lẻ không lấy hóa đơn" cho những người mua này ([Kế toán Lê Ánh](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/cong-van-2921dttng-qldn-huong-dan-nnt-lap-hoa-don-dien-tu-theo-quy-dinh-tai-nghi-dinh-702025nd-cp.html)).

Doanh nghiệp đã dùng hoá đơn có mã có thể lập ngay tại quầy, hoặc đăng ký thêm dãy máy tính tiền (M) cho nhanh. Hoá đơn máy tính tiền không cần ký số, nhưng sai thì chỉ sửa được bằng thay thế.

Dưới NĐ 70, việc bán lẻ thông thường có được gộp doanh thu cả ngày vào một hoá đơn hay không còn tranh cãi: Sapo nói không, còn một hỏi đáp trên thuvienphapluat và bản tin của Grant Thornton mô tả cách làm này ([Sapo](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2); [Grant Thornton](https://www.grantthornton.com.vn/contentassets/0a95b00a770a4a50abe80985fe2502dd/tax-newsletter-june-2025---vietnamese-version.pdf)). Điều 9.4 NĐ 254 chỉ nêu tổng hợp cuối ngày cho bệnh viện và một số dịch vụ cụ thể, nên cách thiết kế an toàn là mỗi giao dịch tại quầy một hoá đơn. Điều 9.5 có một nới lỏng: người bán chưa có phần mềm lập hoá đơn tự động được lập hoá đơn cho ca đêm vào ngày làm việc tiếp theo ([NĐ 254 Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)).

### Luồng nội bộ, sản xuất và mua hàng không hoá đơn

Chuyển hàng giữa các kho hoặc chi nhánh của công ty dùng phiếu xuất kho kiêm vận chuyển nội bộ (mẫu 6, chữ N). Hàng gửi đại lý dùng phiếu xuất kho hàng gửi bán đại lý (chữ B). Cả hai được đăng ký và đánh số như hoá đơn nhưng không phải hoá đơn GTGT.

Điều 7 liệt kê tám trường hợp không cần hoá đơn điện tử, trong đó có góp vốn bằng tài sản, điều chuyển tài sản giữa công ty mẹ và đơn vị phụ thuộc, và tiêu dùng nội bộ cho sản xuất theo nghị định thuế GTGT 181/2025 ([meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)). Vì vậy xuất vật tư cho lệnh sản xuất và nhập thành phẩm không sinh hoá đơn.

Còn một điểm chưa khớp: bảng phạt NĐ 310 vẫn ghi "tiêu dùng nội bộ" là trường hợp phải lập hoá đơn ([MISA AMIS](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)). Với tiêu dùng nội bộ ngoài sản xuất, như lấy hàng dùng cho văn phòng, nên giữ lựa chọn lập hoá đơn đến khi đọc đủ Điều 7.

Mua hàng của hộ và cá nhân không có hoá đơn lập Bảng kê 02/TNDN theo TT 20/2026 và NĐ 320/2025 ([MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)). Bảng kê chỉ dùng được cho: nông sản, thuỷ sản mua trực tiếp của người sản xuất; hàng thủ công; phế liệu mua của người thu gom; tài sản của cá nhân; người bán có doanh thu dưới 1 tỷ đồng mỗi năm. Khoản thanh toán từ 5 triệu đồng trở lên cho một người bán trong một ngày phải không dùng tiền mặt. Ngày áp dụng điều kiện này có nguồn ghi 01/10/2025, nguồn khác ghi 15/12/2025 ([einvoice.vn](https://einvoice.vn/tin-tuc/mua-hang-khong-co-hoa-don); [meInvoice](https://www.meinvoice.vn/?p=51891)). Vì hộ kinh doanh trên ngưỡng nay phải lập hoá đơn, phân hệ mua hàng nên giới hạn đúng các nhóm được phép, lưu CCCD người bán, đặt thuế đầu vào là không được khấu trừ, và cảnh báo khi trả tiền mặt từ 5 triệu đồng.

## Sửa sai chỉ qua thông báo, điều chỉnh hoặc thay thế

Không còn được huỷ hoá đơn điện tử sai từ khi NĐ 70 có hiệu lực ngày 01/06/2025 ([Sapo](https://www.sapo.vn/blog/dieu-kien-va-thu-tuc-huy-hoa-don-dien-tu)). Điều 10 TT 91 nay có ba cách:

1. Sai chỉ ở tên hoặc địa chỉ người mua (một số nguồn thêm số tiền bằng chữ), còn mã số thuế, số tiền, thuế suất, tiền thuế và hàng hoá đúng: người bán báo cho người mua và gửi Mẫu 04/SS-HĐĐT, không lập hoá đơn mới. Các nguồn chưa thống nhất "số tiền bằng chữ" có thuộc trường hợp này không ([MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/); [Arito](https://arito.vn/en/thoi-han-nop-mau-04-ss-hddt-la-khi-nao/)).
2. và 3. Sai mã số thuế, hàng hoá, quy cách, số tiền, thuế suất hoặc tiền thuế: người bán chọn lập hoá đơn điều chỉnh ("Điều chỉnh cho hóa đơn Mẫu số… ký hiệu… số… ngày…") hoặc hoá đơn thay thế ("Thay thế cho hóa đơn…"). Hoá đơn thay thế được gửi cấp mã mới và không cần 04/SS ([meInvoice về TT 91](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/); [MISA ASP](https://asp.misa.vn/tt/kien-thuc/hoa-don-thay-the-co-can-gui-mau-04-khong)).

Hoá đơn máy tính tiền và hoá đơn tài sản phải đăng ký chỉ được thay thế, không được điều chỉnh ([MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)).

TT 91 đổi một số chi tiết so với NĐ 70 mà phần nghiên cứu tình huống đã mô tả:

- Một hoá đơn điều chỉnh hoặc thay thế có thể xử lý nhiều hoá đơn sai lập trong cùng tháng cho cùng người mua, kèm bảng kê 01/BK-ĐCTT. Các hoá đơn phải cùng hàng hoá, đơn giá, thuế suất, và nay thêm điều kiện cùng số lượng, điều NĐ 70 không có ([meInvoice về TT 91](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)).
- Vẫn cần văn bản thoả thuận với người mua là tổ chức và hộ kinh doanh trước khi sửa. Với cá nhân, chỉ cần thông báo hoặc đăng trên website. Có thêm ngoại lệ cho dữ liệu gửi bằng bảng tổng hợp hoặc bảng chi tiết giao dịch, và cho bán hàng trên sàn thương mại điện tử.
- Đã chọn cách sửa nào cho một sai sót thì các lần sửa sau của sai sót đó dùng đúng cách ấy ([MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)).
- Người bán kê khai hoá đơn điều chỉnh vào kỳ lập, người mua vào kỳ nhận. TT 91 bỏ quy định của NĐ 70/TT 32 về việc sai nội dung bắt buộc thì khai vào kỳ của hoá đơn gốc; EY khuyên đối chiếu thêm luật thuế GTGT ở điểm này ([EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)).
- Hoá đơn lập theo NĐ 123, NĐ 70 hoặc TT 32 được sửa theo quy định mới ([MISA về TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/)). Trong XML, loại hoá đơn liên quan là 1 với các hoá đơn đó và 5 với hoá đơn theo NĐ 254.

Trong XML, hoá đơn điều chỉnh đặt TCHDon = 2 và chỉ chứa các dòng chênh lệch: tăng ghi dương, giảm ghi âm. Hoá đơn thay thế đặt TCHDon = 1 và chứa toàn bộ hoá đơn đã sửa. Sửa theo lô dùng thông điệp 208 (có mã) hoặc 210 (không mã). Mỗi lần sửa mang một mã lý do theo Phụ lục XVII. Một nguồn thứ cấp cho rằng hoá đơn không mã chỉ được điều chỉnh, không được thay thế ([MAN về TT 91](https://thue.man.net.vn/thong-tu-91-2026/)). Chưa đọc được Điều 10 TT 91 nên coi điều này là chưa kiểm chứng, và để bảng khả năng của nhà cung cấp quyết định.

Phân hệ sửa sai vì vậy cần: mô hình liên kết chứng từ một-nhiều kèm bảng kê 01/BK-ĐCTT, tệp đính kèm thoả thuận, trường mã lý do, quy tắc buộc thay thế với dãy M, và không có nút huỷ cho bất kỳ hoá đơn đã ký nào.

## Tám điểm còn cần đối chiếu văn bản gốc

Các điểm này không đổi kiến trúc, nhưng mỗi điểm có thể đổi một quy tắc kiểm tra. Nên chốt lại theo Công báo hoặc tài liệu nhà cung cấp trước khi chạy thật.

| Điểm chưa rõ | Vì sao quan trọng | Đối chiếu ở đâu |
|---|---|---|
| Toàn văn TT 91, nhất là đánh số Điều 10, phạm vi và thời hạn 04/SS, việc thay thế hoá đơn không mã | Quy tắc sửa sai và hạn nộp mẫu | Công báo hoặc vanban.chinhphu.vn |
| Thay đổi trường của QĐ 1233 v2.1.1 (thẻ định danh người mua, độ dài TGia) | Ánh xạ XML và dữ liệu gửi nhà cung cấp | Phụ lục PDF QĐ 1233; ghi chú phát hành của nhà cung cấp |
| Hồ sơ XAdES và yêu cầu dấu thời gian (TSA) | Cách ký số trước 10/04/2027 | QĐ 1233; nhà cung cấp chữ ký số |
| Quy tắc tỷ giá và làm tròn (điểm 8 Phụ lục NĐ 254) | Hoá đơn xuất khẩu, tổng tiền VND | Phụ lục NĐ 254 |
| Tổng hợp cuối ngày cho bán lẻ thông thường | Thiết kế bán hàng tại quầy | Toàn văn Điều 9.4 NĐ 254 |
| Miễn lập hoá đơn tiêu dùng nội bộ ở Điều 7 so với mức phạt "tiêu dùng nội bộ" của NĐ 310 | Lấy hàng dùng cho văn phòng có cần hoá đơn không | Điều 7 NĐ 254; NĐ 181 |
| Mã phân loại sản phẩm 7 chữ số: bắt buộc hay khuyến nghị | Kiểm tra danh mục hàng hoá | Phụ lục NĐ 254 |
| Thời hạn lưu trữ (Điều 5 dẫn về luật kế toán; thường là 10 năm, chưa kiểm chứng ở đây) | Lưu trữ XML đã ký | Luật Kế toán 88/2015 |

## Kết luận

Đợt thay đổi năm 2026 biến tuân thủ thành bài toán phiên bản, không còn là danh sách tính năng. Ít nhất bốn mốc thời gian độc lập cùng quyết định một hoá đơn hợp lệ trông thế nào:

- chế độ pháp lý: NĐ 123/NĐ 70 trước 01/07/2026, NĐ 254 sau đó;
- phiên bản thông điệp: 2.1.0 đến 31/12/2026, sau đó 2.1.1;
- chuẩn chữ ký: DSig đến 09/04/2027, sau đó XAdES;
- thuế suất: 8% đến 31/12/2026.

Phần mềm viết cứng quy định hôm nay sẽ sai trong vòng năm tháng. Phần mềm chọn quy tắc theo ngày hoá đơn và ngày của hoá đơn gốc sẽ trụ được cả lần sửa đổi tiếp theo. Phần lớn việc XML và ký số do nhà cung cấp đảm nhận. Quyết định đáng giá nhất của người viết phần mềm là hỗ trợ nhà cung cấp nào, và việc kiểm tra đầu tiên là nhà cung cấp đó đã chạy QĐ 1233 / 2.1.1 và XAdES chưa. Kết nối thẳng hay qua dịch vụ gom như SePay, Tingee là chuyện thứ yếu.

Cách tính phạt chỉ ra chỗ nên dồn công sức. Mức phạt tăng theo số hoá đơn, trần 70–80 triệu đồng, và người tiêu dùng được thưởng khi tố giác hoá đơn không lập. Vì thế một lỗi thời điểm có tính hệ thống tốn kém hơn bất kỳ lỗi dữ liệu đơn lẻ nào. Rào chắn mạnh nhất nằm ở cấu trúc: sinh hoá đơn từ phiếu xuất kho lúc giao hàng, sinh hoá đơn xuất khẩu từ ngày thông quan, không bao giờ để hoá đơn chờ phiếu thu hay khoá sổ cuối tháng. Kết hợp với phân hệ sửa sai không cho huỷ, phần mềm chặn được hai lỗi các nguồn nhắc nhiều nhất ở kế toán Việt Nam: lập hoá đơn trễ và huỷ thay vì điều chỉnh.
