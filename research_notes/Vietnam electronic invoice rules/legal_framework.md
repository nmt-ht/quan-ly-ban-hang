# Vietnamese e-invoice (hoá đơn điện tử) legal framework for a goods-selling SME, as of November 2026

> Headline finding: **the framework changed on 01/07/2026.** Nghị định 123/2020/NĐ-CP (as amended by NĐ 70/2025/NĐ-CP) and Thông tư 32/2025/TT-BTC are **no longer in force**. They were replaced by **Nghị định 254/2026/NĐ-CP** and **Thông tư 91/2026/TT-BTC**. Both were issued 30/06/2026, took effect 01/07/2026, and implement the new **Luật Quản lý thuế số 108/2025/QH15**. Software built against NĐ123/NĐ70/TT78/TT32 must be re-checked against NĐ254/TT91.
>
> Source caveat: thuvienphapluat.vn returned HTTP 403 to automated fetches. The article text of NĐ254 below comes from hethongphapluat.com, a mirror site whose metadata wrongly lists "Quốc hội" as the issuer and shows status "Kiểm tra". The other sources are an EY Vietnam tax alert, a government news page (xaydungchinhsach.chinhphu.vn) and vendor explainers (MISA meInvoice, MAN, Manabox). The full text of TT91 could not be retrieved, so TT91 article details come from secondary summaries and should be checked against the gazette (Công báo) or vanban.chinhphu.vn before coding hard rules.

## 1. Governing instruments and their current status

### Takeaway
In force since 01/07/2026: Luật QLT 108/2025/QH15, NĐ 254/2026/NĐ-CP and TT 91/2026/TT-BTC. NĐ254 repealed NĐ 123/2020, NĐ 70/2025 and Điều 1 of NĐ 41/2022. TT91 replaced TT 32/2025, which had itself replaced TT 78/2021 on 01/06/2025. Penalties still sit in NĐ 125/2020, amended by NĐ 102/2021, NĐ 310/2025 (effective 16/01/2026) and NĐ 291/2026 (issued 21/07/2026).

### Cited Findings
**Currently in force:**
- **NĐ 254/2026/NĐ-CP:** issued 30/06/2026, effective 01/07/2026. It details the Luật Quản lý thuế 108/2025/QH15 on e-invoices and e-documents and replaces NĐ 123/2020/NĐ-CP as amended by NĐ 70/2025/NĐ-CP — [EY Vietnam tax alert](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu); [vanban.chinhphu.vn record](https://vanban.chinhphu.vn/?docid=218689&pageid=27160)
- NĐ254's transitional clause repeals NĐ 123/2020/NĐ-CP, Điều 1 of NĐ 41/2022/NĐ-CP, and NĐ 70/2025/NĐ-CP — [MISA meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)
- NĐ254 structure: 5 chapters and 45 articles. 25 articles were carried over, 11 amended, 2 are new, and 5 content groups were removed — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
- NĐ254 table of contents, relevant articles: Art. 5 storage/retention and conversion; Art. 6 users; Art. 7 cases not requiring e-invoices; Art. 8 invoice types; Art. 9 timing; Art. 10 content; Art. 12 coded invoices; Art. 13 uncoded invoices; Art. 14 incident handling; Art. 15–16 seller duties for coded and uncoded invoices; Art. 17–18 seller and buyer rights; Art. 41 consumer whistleblower reward; Art. 43 effective date; Art. 44 transition — [hethongphapluat.com, Điều 8 page with TOC](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- NĐ254 no longer sets detailed rules on registration and stopping use, e-invoice format, cases for coded invoices, or replacement and adjustment. These were delegated to the Ministry of Finance (TT91) — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **TT 91/2026/TT-BTC:** issued 30/06/2026, effective 01/07/2026, signed by Cao Anh Tuấn. It guides Luật QLT 108/2025/QH15 and NĐ254 — [nhansu.vn record](https://nhansu.vn/van-ban-phap-luat/Thong-tu-91-2026-TT-BTC-huong-dan-Luat-Quan-ly-thue-va-Nghi-dinh-254-2026-ND-CP-699151.html)
- TT91 replaces TT 32/2025/TT-BTC — [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/); [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- TT91 article titles: Art. 3 e-invoice format; Art. 4 form symbols, invoice symbols and reference templates; Art. 6 registration and changes; Art. 8 stopping use; Art. 9 delegated issuance (ủy nhiệm); Art. 10 handling issued e-invoices (errors); Art. 15 per-transaction coded invoices; Art. 16 destruction of tax-authority printed invoices; Art. 24 transition; Art. 25 effect — [nhansu.vn](https://nhansu.vn/van-ban-phap-luat/Thong-tu-91-2026-TT-BTC-huong-dan-Luat-Quan-ly-thue-va-Nghi-dinh-254-2026-ND-CP-699151.html); [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
- The Cục Thuế issued **Công văn 4831/CT-CS (15/07/2026)** introducing the changes in NĐ254 and TT91 — [meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)

**Superseded (historical, still relevant for invoices and transactions before 01/07/2026):**
- **NĐ 70/2025/NĐ-CP** amended NĐ 123/2020 effective 01/06/2025. It changed Điều 9 (timing), Điều 11 (cash-register invoices) and Điều 19 (errors), and repealed several NĐ123 provisions — [MISA AMIS](https://amis.misa.vn/210443/nghi-dinh-70-2025-nd-cp/); [iHOADON](https://ihoadon.vn/hddt/diem-moi-can-chu-y-cua-nghi-dinh-70-ve-hoa-don-chung-tu.html)
- **TT 32/2025/TT-BTC** was issued 31/05/2025, effective 01/06/2025, and fully replaced TT 78/2021/TT-BTC — [MISA AMIS](https://amis.misa.vn/45271/thong-tu-78-ve-hoa-don-dien-tu/); [meInvoice](https://www.meinvoice.vn/?p=34635)
- One source says a transaction completed in June 2026 is still governed by NĐ123/NĐ70, and invoicing it late in July does not move it into the new regime — [Kế toán Lê Ánh](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/thoi-diem-lap-hoa-don-dien-tu.html). This is a single secondary source.

**Penalties:**
- No decree has replaced NĐ 125/2020/NĐ-CP. It was amended by NĐ 102/2021, then **NĐ 310/2025/NĐ-CP (effective 16/01/2026)**, then **NĐ 291/2026/NĐ-CP (issued 21/07/2026)**. A consolidated text, **VBHN 27/2026/VBHN-BTC**, is reported dated 27/08/2026 — [LuatVietnam on NĐ291](https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-291-2026-nd-cp-sua-doi-nghi-dinh-125-2020-nd-cp-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don-186-110744-article.html); [LuatVietnam VBHN 27/2026](https://luatvietnam.vn/thue/van-ban-hop-nhat-27-2026-vbhn-nd-btc-2026-xu-phat-vi-pham-hanh-chinh-ve-thue-va-hoa-don-445970-d5.html); [meInvoice on NĐ310](https://www.meinvoice.vn/tin-tuc/42191/nghi-dinh-310-2025-nd-cp-sua-doi-nghi-dinh-125-2020/)

**Related:**
- A single source reports **NĐ 141/2026/NĐ-CP**, effective 01/01/2026, raising the revenue threshold above which household and individual businesses must use e-invoices to 1 billion VND — [Luật Quang Huy](https://luatquanghuy.vn/tu-van-luat/thue-phi/huong-dan-chi-tiet-danh-sach-luat-thue-nghi-dinh-va-thong-tu-thue-moi-nhat-2026/). This is unverified, but the 1-billion threshold is confirmed in NĐ254 Điều 6.1(d) (see §2).

### Inferences
- The new Tax Administration Law 108/2025/QH15 appears to have taken effect 01/07/2026, the same day as its implementing decree and circular. The effective date of the law itself was not directly confirmed in fetched sources.
- For the app: store a `legal_regime` / invoice-date-based rule switch. Invoices dated before 01/07/2026 follow NĐ123/NĐ70/TT32 for error handling and timing. Invoices dated on or after 01/07/2026 follow NĐ254/TT91.
- NĐ254 moved most operational detail (symbols, registration forms, error procedures) into TT91 and its appendices. TT91 Appendix I (symbols), Appendix III (forms 01/ĐKTĐ-HĐĐT, 04/SS-HĐĐT, 01/TH-HĐĐT, 01/BK-ĐCTT) and Appendix V (display samples) are the key developer references.

### Gaps
- Full official text of TT91 was not retrieved (thuvienphapluat 403; nhansu.vn shows only the TOC).
- Text of NĐ254 Điều 43 (effective date) and Điều 45 was not retrieved. The repeal list comes from meInvoice's summary only.
- The effective date of Luật QLT 108/2025/QH15 was not confirmed from a primary source.

## 2. Who must use e-invoices; coded vs uncoded vs cash-register invoices; registration

### Takeaway
Under NĐ254 Điều 6, **coded invoices (có mã của CQT) are the default for all businesses**. **Uncoded invoices are limited to listed sectors** (electricity, petroleum, telecom, banking, insurance, e-commerce, supermarkets, "thương mại", transport, etc.) that meet IT conditions. **Cash-register invoices** apply to sellers selling directly to consumers, but are **not required if the seller is already registered for coded or uncoded e-invoices**. Household and individual businesses with **annual revenue above 1 billion VND** must use coded or cash-register invoices. Registration still uses **Mẫu 01/ĐKTĐ-HĐĐT**, now in TT91 Appendix III.

### Cited Findings
- **Điều 6.1(a), coded invoices:** "Tổ chức kinh tế, tổ chức khác, hộ kinh doanh, cá nhân kinh doanh và các trường hợp rủi ro cao về thuế" must use coded e-invoices when selling goods or services, except under points b and c — [hethongphapluat Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6)
- **Điều 6.1(b), uncoded invoices:**
  - Sectors: electricity, petroleum, postal/telecom, clean water, banking/finance, securities, crypto-assets, carbon-exchange support, insurance, healthcare, e-commerce, supermarkets, commerce, and air/road/rail/sea/waterway transport.
  - Conditions: the firm transacts (or can transact) electronically with the tax authority, and has IT infrastructure and software to create, look up, store and transmit e-invoices to the buyer and the tax authority.
  - Exclusions: high-risk taxpayers, and firms that register for coded invoices.
  - Source: [hethongphapluat Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6)
- EY describes this as: "Nghị định 254 giới hạn phạm vi sử dụng hóa đơn điện tử không có mã của cơ quan thuế" — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- Banking, securities, crypto-assets and carbon-exchange support were newly added to the uncoded-eligible list — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
- **TT91 Art. 11 (per secondary source):** from 01/07/2026, uncoded-invoice holders may switch to coded invoices. High-risk taxpayers notified by **Mẫu 01/TB-KTT** must switch within 10 working days — [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)
- **Điều 6.1(c), cash-register invoices:**
  - Applies to entities selling directly to consumers in: shopping centres, supermarkets, retail (excluding cars, motorbikes and other motor vehicles), F&B, restaurants, hotels, passenger transport, road-transport support, arts, entertainment, cinemas, and other personal services.
  - Exception: entities already registered under 1(a) or 1(b) need not register cash-register invoices.
  - Sources: [hethongphapluat Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6); [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Điều 8.9, cash-register invoices:**
  - They must be recognisable as generated by a cash register connected to the tax authority, and **no digital signature is required**.
  - Purchase costs backed by such invoices, if they can be looked up in the tax authority system, count as having valid invoices.
  - Source: [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **Điều 6.1(d), household and individual businesses:**
  - Must use coded e-invoices or cash-register e-invoices connected to tax data if annual revenue is "trên 01 tỷ đồng", or if they sell assets requiring ownership or use-right registration.
  - Others may opt in voluntarily.
  - Source: [hethongphapluat Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6)
- **Điều 6.2, per-transaction coded invoices (cấp theo từng lần phát sinh):**
  - Covers non-business organisations with taxable sales, and enterprises that have ceased operations, are suspended, under enforced stop-use, in bankruptcy, etc.
  - Procedure is set by the MoF (TT91 Art. 15, Mẫu 06/ĐN-PSDT).
  - Sources: [hethongphapluat Điều 6](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-6); [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
- **Điều 7, cases not requiring e-invoices (8 items).** They include:
  - capital contributions in kind;
  - asset transfers between parent and dependent units or during restructuring;
  - free lending of fixed assets or tools for processing;
  - cases referenced to the VAT decree NĐ 181/2025/NĐ-CP (internal production use, self-supplied goods, compensation, collection on behalf).
  - Internal goods transfers are exempt only when the goods serve continued production and are non-VAT-taxable.
  - Sources: [meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/); [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Registration:**
  - Principle: "Trước khi sử dụng hóa đơn điện tử ... phải thực hiện đăng ký sử dụng ... theo quy định của Bộ trưởng Bộ Tài chính" — [xaydungchinhsach.chinhphu.vn](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-so-254-2026-nd-cp-ve-hoa-don-dien-tu-chung-tu-dien-tu-119260713164251972.htm)
  - Registration and changes use **Mẫu 01/ĐKTĐ-HĐĐT** (TT91 Art. 6, Appendix III) — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/); [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
- **Stopping use (TT91 Art. 8.2(d)):** the taxpayer's window to explain or supplement before e-invoice use is stopped rose to **3 working days, from 2 under NĐ70** — [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
- Households with tax codes issued before 01/07/2025 must reconcile owner details with the national population database. If this is not done within 10 working days, e-invoice use is suspended — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
- **Data transmission route (Điều 16.3(b)):**
  - Direct connection to the tax authority is allowed only for large issuers ("từ 1.000.000 hóa đơn một tháng trở lên") with compliant IT, or parent companies with central systems.
  - All others must transmit via a contracted e-invoice service provider.
  - Source: [hethongphapluat Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)
- **Paper invoices:** tax-authority printed invoices "hết giá trị sử dụng" from 01/07/2026 and unused stock must be destroyed (NĐ254 Điều 44.3; TT91 Art. 16) — [hethongphapluat Điều 44](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-44); [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
- **Delegated issuance (ủy nhiệm):**
  - Sellers may authorise a third party to issue e-invoices — [xaydungchinhsach](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-so-254-2026-nd-cp-ve-hoa-don-dien-tu-chung-tu-dien-tu-119260713164251972.htm)
  - Under TT91 Art. 9.3(c), household businesses may authorise an organisation, which notifies the tax authority on Mẫu 01/ĐKTĐ-HĐĐT — [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
  - TT32 had already removed the "related party" condition — [meInvoice on TT32](https://www.meinvoice.vn/?p=34635)

### Inferences
- For a typical SME goods seller (trading company, not in the listed sectors): **coded e-invoices are the compliant default**. "Thương mại" and "siêu thị" appear in the uncoded list, so a commercial or retail SME *may* qualify for uncoded invoices if it meets the IT conditions and is not high-risk. The app should support both, but default to coded.
- An SME already registered for coded invoices that opens a retail counter does **not** need to add cash-register invoices. It may choose them for POS speed (no digital signature, optional buyer ID).
- The app does not need to talk to the GDT directly. It integrates with a licensed provider (T-VAN / e-invoice service provider), which matches how MISA meInvoice works.

### Gaps
- How "doanh thu năm trên 01 tỷ đồng" is measured for households (prior year vs current year) is not in the fetched text.
- Contents and fields of Mẫu 01/ĐKTĐ-HĐĐT under TT91, and the tax authority's acceptance deadline, were not retrieved.
- The TT91 list of high-tax-risk criteria was not retrieved. TT32 had five criteria per [einvoice.vn](https://einvoice.vn/tin-tuc/tong-hop-8-diem-moi-cua-thong-tu-32-2025-tt-btc-ve-hoa-don-chung-tu).

## 3. Invoice kinds (Điều 8 NĐ254) and what changed

### Takeaway
The kinds are largely carried over from NĐ123/NĐ70: hoá đơn GTGT (deduction-method VAT payers), hoá đơn bán hàng (direct-method payers and non-tariff zones), hoá đơn thương mại điện tử (exports), public-asset and national-reserve sale invoices, and stamps, tickets and cards. **Phiếu xuất kho kiêm vận chuyển nội bộ and phiếu xuất kho hàng gửi bán đại lý are "registered, used and managed as invoices."**

### Cited Findings
- **8.1, VAT invoice:** used by organisations "khai thuế giá trị gia tăng theo phương pháp khấu trừ" for domestic sales, international transport, supplies to non-tariff zones and deemed exports, exports, and foreign digital-platform suppliers — [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **8.2, sales invoice (hoá đơn bán hàng):**
  - (a) used by direct-method VAT payers (organisations, households, individuals);
  - (b) used by entities in non-tariff zones, with the mandatory text "Dành cho tổ chức, cá nhân trong khu phi thuế quan";
  - export-processing enterprises use the invoice matching their VAT method.
  - Source: [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **8.3, e-commerce/commercial invoice for exports (hoá đơn thương mại điện tử):**
  - Used by exporters that can transmit commercial-invoice data electronically to the tax authority, with content per Điều 10.
  - Exporters that cannot may issue an electronic VAT invoice or sales invoice instead.
  - Source: [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **8.4–8.6:** public-asset sale invoices, national-reserve sale invoices, and electronic stamps, tickets, cards and receipts — [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **8.7, delivery notes treated as invoices:** phiếu xuất kho kiêm vận chuyển nội bộ and phiếu xuất kho hàng gửi bán đại lý are "được đăng ký, sử dụng và quản lý như hóa đơn" — [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8)
- **8.8:** the MoF issues reference display samples (TT91 Appendix V) — [hethongphapluat Điều 8](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-8); [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
- **Symbols:**
  - The form-number and invoice-symbol rules, previously in TT32 Art. 5(1)(a)-(b), moved to TT91 Art. 4 cl. 4-5 and Appendix I — [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
  - The first character of the invoice symbol is **C** (coded) or **K** (uncoded). The letter **M** denotes cash-register invoices — [nhansu.vn TT91](https://nhansu.vn/van-ban-phap-luat/Thong-tu-91-2026-TT-BTC-huong-dan-Luat-Quan-ly-thue-va-Nghi-dinh-254-2026-ND-CP-699151.html)
  - Invoice numbers have at most 8 digits — [MISA AMIS](https://amis.misa.vn/237773/mau-so-04-ss-hddt/)

### Inferences
- From prior knowledge of TT78/TT32, **not re-verified against TT91 text in this session**. The structure is very likely retained, but confirm against TT91 Appendix I:
  - Form number (ký hiệu mẫu số) is one digit: 1 = VAT invoice; 2 = sales invoice; 3 = public-asset sale; 4 = national-reserve sale; 5 = stamps, tickets, cards; 6 = internal-transfer and consignment delivery notes. TT32 reportedly added new codes (e.g., 7, 8, 9).
  - Invoice symbol (ký hiệu hoá đơn) has 6 characters:
    - character 1: C or K;
    - characters 2-3: last two digits of the year;
    - character 4: T (enterprise registered with the tax authority), D (public asset / special), L (per-transaction), M (cash register), N (internal-transfer note), B (consignment note), G/H (stamps, tickets, cards);
    - characters 5-6: chosen by the seller.
  - Invoice numbering restarts at 1 each year (1 January) per symbol.
- For an inventory app: **internal transfers between the company's own warehouses or branches and consignment dispatches** must produce an e-delivery note in the invoice regime (mẫu số 6, N/B letters). Some intra-company transfers are now carved out of invoicing by Điều 7 (see §2).

### Gaps
- The exact TT91 Appendix I character tables were not retrieved.
- Whether NĐ254 changed when an internal-transfer note can be used instead of an invoice for branch transfers is not confirmed beyond the Điều 7 summary.

## 4. Timing of issuance (Điều 9 NĐ254)

### Takeaway
For goods, the invoice is issued **at the transfer of ownership or right of use, whether or not paid**. Exports: no later than the next working day after customs clearance. Each partial delivery needs its own invoice. Services: on completion, or when payment is collected first. **Deposits securing a contract (Civil Code) do not trigger an invoice.** New: next-working-day issuance for night-shift transactions, and wider "invoice after reconciliation" windows for specific services.

### Cited Findings
- **9.1, goods:** the timing is "chuyển giao quyền sở hữu hoặc quyền sử dụng hàng hóa cho người mua, không phân biệt đã thu được tiền hay chưa thu được tiền". For exports, including processing, the seller decides, but "chậm nhất không quá ngày làm việc tiếp theo kể từ ngày hàng hóa được thông quan" — [hethongphapluat Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)
- **9.2, services:**
  - The invoice is issued at "thời điểm hoàn thành việc cung cấp dịch vụ", including services for foreign customers.
  - If payment is collected before or during the service, the invoice is issued when payment is collected.
  - Civil Code deposits securing contract performance are excluded.
  - Source: [hethongphapluat Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)
- **Deposit rule change:** NĐ123/NĐ70 exempted deposits only for listed services (accounting, audit, tax consulting, valuation, design, etc.). NĐ254 exempts any Civil Code deposit — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/); [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu). EY warns the scope is unclear, for example for real-estate leasing.
- **9.3, multiple deliveries:** "mỗi lần giao hàng hoặc bàn giao đều phải lập hóa đơn cho khối lượng, giá trị hàng hóa, dịch vụ được giao tương ứng" — [hethongphapluat Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)
- **9.4, special cases (points a–r):**
  - (a) high-volume recurring services issue after reconciliation, "chậm nhất không quá ngày 07 của tháng sau";
  - (b) telecom and IT data reconciliation: within 2 months;
  - (c) construction: on acceptance and handover;
  - (d) real estate collected by instalment schedule: on collection;
  - (h) retail petroleum: at the end of each sale;
  - (l) taxi with fare software: at the end of the trip;
  - (m) hospitals: end-of-day summary invoice;
  - (n) non-stop tolls: by month-end;
  - (o) insurance; (p) lottery; (q) casino;
  - (r) consumer services where detailed transaction data is sent to the tax authority.
  - Source: [hethongphapluat Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)
- **9.5, night shift:** if the seller has no automatic invoicing software and the transaction occurs during night hours under the Labour Code, the invoice is due no later than the "ngày làm việc tiếp theo" — [hethongphapluat Điều 9](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-9)
- **Groups added to the post-reconciliation list:** marine pilotage, online press advertising, digital platforms, crypto-asset services, carbon trading support, security services, industrial meals, commodity exchanges, credit information, and passenger transport for organisations — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Promotions and gifts:** goods and services used for promotion or gifts may be invoiced in a **monthly or quarterly summary invoice matching the VAT return period** — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu); [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
- **Superseded:** under NĐ70 (01/06/2025–30/06/2026), Điều 9.4 had post-reconciliation special rules for insurance, lottery, casino and electronic games (points p, q, r) — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/); [MISA AMIS](https://amis.misa.vn/210443/nghi-dinh-70-2025-nd-cp/)

### Inferences
- App rule for goods sales: set the invoice date to the delivery or ownership-transfer date, which is normally the date of the phiếu xuất kho / delivery confirmation, not the payment date. Block or warn on back-dating beyond the delivery date, because late issuance is penalised per invoice count (§8).
- Partial deliveries against one sales order should generate one invoice per delivery. The app should link delivery notes to invoices 1:1 (or n:1 within one delivery).
- Customer advance payments for **goods** do not trigger an invoice under 9.1, because goods are invoiced on transfer. For services, advances do trigger one, except Civil Code deposits.
- The issuance date (ngày lập) and digital-signature date may differ. Under NĐ123 practice, a signing date after the issuance date was tolerated and the invoice was declared by issuance date. NĐ254 Điều 10.1(g)-(h) lists the two dates separately but the fetched text does not state the rule.

### Gaps
- No fetched source states how advance payments in foreign currency or exchange-rate timing are handled.
- No retrieved NĐ254/TT91 text addresses how "ngày lập" relates to "ngày ký số".

## 5. Mandatory content (Điều 10 NĐ254 + Appendix)

### Takeaway
Required: invoice name, form and invoice symbols, invoice number; seller name, address and MST; buyer name, address and **MST, or budget-unit code, or personal identification number**; line items with unit, quantity, unit price, pre-tax amount, VAT rate, VAT by rate and total; issuance date; digital-signature time; tax authority code (for coded invoices); and fees, discounts or promotions where applicable. Buyer signature is not required. New: if an individual buyer gives no details, write **"Bán cho người tiêu dùng"**. Goods names should use the 7-digit product classification (or HS for imports).

### Cited Findings
- **Điều 10.1:**
  - (a) invoice name, invoice symbol, form symbol;
  - (b) number;
  - (c) seller name, address, MST;
  - (d) "Tên, địa chỉ, mã số thuế hoặc mã số đơn vị có quan hệ với ngân sách hoặc số định danh cá nhân của người mua";
  - (đ) name, unit, quantity, unit price, pre-VAT amount, VAT rate, VAT by rate, total VAT, total payment;
  - (e) the buyer's digital signature is not required "trừ trường hợp người mua, người bán có thỏa thuận";
  - (g) issuance date in dd/mm/yyyy per Điều 9;
  - (h) digital-signature time;
  - (i) tax authority code (coded invoices only);
  - (k) state-budget fees and charges, trade discount, promotion.
  - Sources: [hethongphapluat Điều 10](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-10); [xaydungchinhsach](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-so-254-2026-nd-cp-ve-hoa-don-dien-tu-chung-tu-dien-tu-119260713164251972.htm)
- **Điều 10.2:** "Chữ viết, chữ số và đồng tiền" (writing, numerals, currency). Detailed rules are in the Appendix. **Điều 10.3:** some e-invoices "không nhất thiết có đầy đủ các nội dung" — [hethongphapluat Điều 10](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-10)
- **Điều 10.4, cash-register invoices:** the buyer's MST, personal ID or phone number is required only "nếu người mua yêu cầu". The seller must deliver the invoice electronically or provide a lookup link or QR code — [hethongphapluat Điều 10](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-10)
- **Điều 10.5:** households are encouraged to show industry codes; non-taxable goods must be marked; logos and contract or shipment references are optional — [hethongphapluat Điều 10](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-10)
- **Appendix (per summaries):**
  - Individual consumer giving no details: write "Bán cho người tiêu dùng". If details are given: full name, address and personal ID number. Foreign buyers: passport or entry-exit document number and nationality — [meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)
  - Such consumer invoices cannot support expense claims or tax finalisation — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
  - Supermarkets, shopping centres and cinemas may omit buyer info if not provided; dishes sold by portion need not be itemised — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
  - Multiple business locations under one MST: the invoice shows the name, code and address of each location. Delegated invoices show both principal and agent — [meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)
  - Goods naming uses the **7-digit product classification under QĐ 43/2018**, or HS name and code for imports; legal identification rules take priority — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
  - Cars and motorbikes: buyer details, make, model, year, chassis and engine numbers, certificate number. Road transport: plate and route, except fixed-route contracts — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/); [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Trade discounts in invoices (TT91 Art. 10):**
  - Method 1: deduct on the last purchase invoice or a later one; the discount cannot exceed the invoice value.
  - Method 2: separate adjustment invoice plus a detail list.
  - Source: [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)

### Inferences
- From NĐ123 Điều 10 khoản 13 and Luật Kế toán, **not re-verified in NĐ254/TT91 text**, and likely carried into the NĐ254 Appendix:
  - Text in Vietnamese, with an optional foreign-language line.
  - Currency is VND by default. Foreign currency is allowed where the transaction may lawfully be settled in foreign currency; then the unit price, amounts, VAT and total are in that currency, and the **exchange rate to VND is shown**.
  - Totals in words.
  - The ISO currency code (e.g., USD) is used.
- For the app: the buyer-ID data model needs fields for MST, budget-unit code (mã ĐVQHNS), personal ID number (CCCD / số định danh), passport and nationality. It also needs a "bán cho người tiêu dùng" flag that fills the buyer-name line, and a 7-digit product classification code on each product master. Support multiple business-location codes and addresses per MST.

### Gaps
- The exact NĐ254 Appendix text on currency, exchange rate (which rate: transaction-date commercial bank rate?), language and rounding was not retrieved.
- Whether the 7-digit product classification is mandatory or recommended for ordinary goods sellers, and from when, is not confirmed. One secondary source only.

## 6. Handling errors, returns, discounts, promotions

### Takeaway
Under **TT91 Art. 10 (from 01/07/2026)**:
- Errors only in buyer name, address or amount in words, with MST, amount, rate, tax and goods correct: notify the buyer and file **Mẫu 04/SS-HĐĐT**; no new invoice.
- Errors in MST, goods name or quality, amount, rate or tax: the seller **chooses adjustment or replacement**, with a written agreement with organisational buyers (exceptions apply).
- **Cash-register invoices and registered-asset invoices must be replaced.**
- One adjustment or replacement can cover several same-month invoices with bảng kê **01/BK-ĐCTT**.
- **Returns: the seller issues an adjustment invoice.** The buyer may issue a return invoice if the parties agree; for registered assets the buyer issues it.
- Adjustments are declared in the period issued.
- **Invoice cancellation (hủy) for errors was already abolished by NĐ70 from 01/06/2025.**

### Cited Findings
- **Notice only, no reissue (TT91 Art. 10):** errors in name, address or amount in words, with MST, amount, rate, tax and goods correct. The seller notifies the buyer and reports on Mẫu 04/SS-HĐĐT (TT91 Appendix III).
  - Under NĐ70 this route covered only buyer name and address — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/); [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/); [MISA ASP](https://asp.misa.vn/tt/kien-thuc/mau-04-ss-hddt/)
  - Before 01/07/2026, Mẫu 04/SS-HĐĐT was in NĐ70 Appendix IA — [ketoanthienung](https://ketoanthienung.net/mau-04-ss-hddt-thong-bao-hoa-don-dien-tu-co-sai-sot.htm)
  - Secondary sources disagree on whether "amount in words" is in this route ("hoặc" vs "và"), and on whether the 04/SS scope narrowed or widened — [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/); [Arito](https://arito.vn/en/thoi-han-nop-mau-04-ss-hddt-la-khi-nao/)
- **Adjust or replace (TT91 Art. 10.1(b)):** for wrong MST, goods name or non-conforming quality, amount, rate, tax or other mandatory content, the seller may issue either. Required wording:
  - "Điều chỉnh cho hóa đơn Mẫu số… ký hiệu… số… ngày… tháng… năm"
  - "Thay thế cho hóa đơn Mẫu số… ký hiệu… số… ngày… tháng… năm"
  - The replacement invoice is signed and sent to the tax authority for a code (coded invoices).
  - Sources: [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/); [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
- **Replacement invoices do not require Mẫu 04/SS-HĐĐT** — [MISA ASP](https://asp.misa.vn/tt/kien-thuc/hoa-don-thay-the-co-can-gui-mau-04-khong)
- **Batching:**
  - TT91 allows one adjustment or replacement invoice for several erroneous invoices in the same month with the same buyer, goods, unit price, **quantity** and VAT rate, with bảng kê Mẫu 01/BK-ĐCTT — [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/)
  - NĐ70 had introduced batching without the same-quantity condition — [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/); [iHOADON on NĐ70](https://ihoadon.vn/hddt/diem-moi-ve-thay-the-dieu-chinh-hoa-don-dien-tu-tu-1-6-2025.html?lang=vn)
- **Written agreement (văn bản thỏa thuận):**
  - Required with organisations, businesses and households before adjusting or replacing.
  - For individual buyers, the seller notifies them or publishes on its website.
  - Exemptions: data sent via summary table (Bảng tổng hợp), data sent via transaction-detail table, and sales on e-commerce or digital platforms.
  - The seller keeps the document for inspection.
  - Source: [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)
- **Mandatory replacement:**
  - Cash-register invoices and invoices for registrable assets (vehicles, real estate) must be **replaced** — "người bán phải lập hóa đơn thay thế".
  - Exception: returns where the asset is registered in the buyer's name.
  - Sources: [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/); [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/)
- **Invoices already reported in a summary table:** no 04/SS. Corrections go in a later period's 01/TH-HĐĐT, citing the original invoice in **column 18 "thông tin hóa đơn liên quan"**. A wrong summary table itself is fixed by a supplementary table — [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/); [Luật Nguyễn](https://luatnguyen.vn/van-ban-moi/thong-tu-91-2026-tt-btc-2317.html)
- **Returns (hàng bán bị trả lại):**
  - The **seller issues an adjustment invoice**; the buyer may issue a return invoice if the parties agree.
  - For returned registered assets, the buyer (if an eligible e-invoice user) issues a return invoice to the seller.
  - Real-estate or construction cancellations are adjusted like returns.
  - Source: [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
  - EY confirms adjustment invoices remain for trade discounts, returns and re-settlement after authority conclusions, declared in the period the adjustment invoice is issued — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Declaration period:**
  - The seller declares adjustments in the period issued; the buyer declares them in the period received — [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
  - TT91 dropped the rule (under NĐ70/TT32) that errors in mandatory content be declared in the original invoice's period. VAT law must now be checked — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Consistency:** once a correction method is chosen for an error, later corrections of the same error use the same method — [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
- **Value change after an authority's conclusion:** issue a new invoice for the difference (negative or positive) — [MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/)
- **Promotions and gifts:** may be invoiced as a monthly or quarterly summary invoice — [EY](https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-254-2026-nd-cp-ve-hoa-don-dien-tu-va-chung-tu-dien-tu)
- **Superseded (NĐ70, 01/06/2025–30/06/2026):**
  - Erroneous invoices could no longer be cancelled (hủy) — [Sapo](https://www.sapo.vn/blog/dieu-kien-va-thu-tuc-huy-hoa-don-dien-tu)
  - One adjustment or replacement could cover several same-month invoices of one buyer, with bảng kê 01/BK-ĐCTT — [iHOADON](https://ihoadon.vn/hddt/diem-moi-ve-thay-the-dieu-chinh-hoa-don-dien-tu-tu-1-6-2025.html?lang=vn)
  - Before adjusting or replacing, an agreement with organisational buyers was required, with no listed exemptions — [MAN](https://ketoan.man.net.vn/05-thay-doi-quan-trong-khi-dieu-chinh-hoa-don-dien-tu/)

### Inferences
- App design:
  - Support adjustment invoices (increase or decrease, linked to the original by form, symbol, number and date), replacement invoices, and the 04/SS notice. Allow 1-to-many linkage with bảng kê 01/BK-ĐCTT.
  - Store the buyer-agreement document as an attachment.
  - **Disable "adjust" for cash-register-origin invoices**, which must be replaced.
  - A sales-return transaction should by default produce a **seller-side decrease adjustment invoice**. This differs from older (pre-NĐ70) practice, where the buyer issued a return invoice. Keep an option to record a buyer-issued return invoice when agreed.
- Never offer "cancel invoice" (hủy) for signed and sent invoices issued after 01/06/2025.
- One secondary source says uncoded invoices may only be adjusted, not replaced ([MAN TT91](https://thue.man.net.vn/thong-tu-91-2026/), §12). Treat this as unverified until checked against TT91 Art. 10.

### Gaps
- Deadline for filing Mẫu 04/SS-HĐĐT under TT91 is not stated consistently. The tax authority's error-notice form (formerly Mẫu 01/TB-RSĐT) and its response deadline under TT91 were not found.
- TT91 khoản/điểm numbering within Art. 10 is not available from the sources.

## 7. Data transmission (uncoded and cash-register invoices)

### Takeaway
Under NĐ254 Điều 16.3, uncoded invoices go to the tax authority by one of three routes:
- (a.3) full invoice content, sent to the buyer and the tax authority **no later than the next working day after issuance**. This is the default for goods sellers.
- (a.1) **summary table Mẫu 01/TH-HĐĐT**, for listed sectors (telecom, insurance, banking, aviation, securities, electricity and water with customer code, foreign digital platforms).
- (a.2) **transaction-detail table Mẫu 01/TTGT**, for consumer services under Điều 9.4(r).

Tables (a.1) and (a.2) are due by the VAT return deadline for the month or quarter. Coded and cash-register invoices are coded or connected in real time, so no separate summary is needed.

### Cited Findings
- **Điều 16.3(a.1), summary table:** for telecom, insurance, banking, aviation, securities, digital assets, carbon trading and similar services; electricity and water sales with customer code or MST recorded; and foreign organisations' sales via e-commerce or digital platforms — [hethongphapluat Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)
- **Điều 16.3(a.2), transaction-detail table:** for services under Điều 9.4(r) — [hethongphapluat Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)
- **Điều 16.3(a.3), full content:** for all other cases. The seller sends the full invoice to the buyer and the tax authority at the same time, "chậm nhất là ngày làm việc tiếp theo kể từ thời điểm lập hóa đơn" — [hethongphapluat Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)
- **Deadline for tables:** summary and detail tables are monthly or quarterly, due "chậm nhất là thời hạn gửi Tờ khai thuế giá trị gia tăng". Large volumes are split into files in the standard format — [hethongphapluat Điều 16](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-16)
- **TT91 forms (Art. 4(6)):**
  - Mẫu 01/TH-HĐĐT: summary under Điều 16.3(a.1);
  - Mẫu 01/TTGT: transaction details under Điều 16.3(a.2);
  - Mẫu 01/TH-DT: casino and gaming data under Điều 9.4(q);
  - Mẫu 01/TH-BLĐT: receipts.
  - Sources: [meInvoice](https://www.meinvoice.vn/tin-tuc/48237/thong-tu-91-2026-tt-btc/); [MISA eShop 01/TH-HĐĐT](https://www.misaeshop.vn/44649/mau-so-01-th-hddt/)
- **Outage:** if a system failure prevents transmission, data must be sent within **3 working days after the fault is fixed** — [Manabox](https://manaboxvietnam.com/diem-moi-nghi-dinh-ve-hoa-don-2026/). NĐ254 Điều 14 "Xử lý sự cố" text was not retrieved.

### Inferences
- From prior knowledge of NĐ123/NĐ70, **not re-verified here**: under NĐ123, uncoded invoices were sent either in full on the same day as sent to the buyer, or via 01/TH-HĐĐT for listed sectors. Petroleum retailers had to send per-sale data by end of day after NĐ70. Cash-register invoice data was sent to the tax authority on the same day. NĐ254 appears to have loosened the full-content deadline to the next working day. Confirm against the old NĐ123 Điều 22 text if the app must reproduce historical rules.
- For a goods-selling SME on uncoded invoices, the app (via provider) must transmit each invoice within one working day. A queue with retry and "sent / accepted / rejected" status is needed.

### Gaps
- Cash-register invoice transmission timing under NĐ254 was not found (Điều 12/15 text not retrieved).
- NĐ254 Điều 14 incident-handling text was not retrieved.

## 8. Retention, cancellation and penalties

### Takeaway
Retention follows accounting law (NĐ254 Điều 5), in data-message form. Conversion to paper is allowed for audits and bookkeeping, but the paper copy has no transactional validity (except cash-register invoices). Cancelling an erroneous invoice is no longer allowed (since 01/06/2025). Penalties sit in NĐ125/2020 as amended by NĐ102/2021, NĐ310/2025 (from 16/01/2026, **tiered fines by number of invoices**) and NĐ291/2026. Late issuance runs up to 70 million VND and failure to issue up to 80 million VND.

### Cited Findings
- **Điều 5.1, retention:** invoices must be stored with "Tính an toàn, bảo mật, toàn vẹn, đầy đủ, không bị thay đổi, sai lệch", for the period set by accounting law ("đúng và đủ thời hạn theo quy định của pháp luật kế toán") — [hethongphapluat Điều 5](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-5)
- **Điều 5.2:** invoices are stored as data messages meeting Art. 13 of the Law on E-Transactions, and must be "sẵn sàng in được ra giấy hoặc tra cứu được khi có yêu cầu" — [hethongphapluat Điều 5](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-5)
- **Điều 5.4, conversion to paper:**
  - Allowed for audits, inspections or investigations, or for bookkeeping.
  - A bookkeeping copy "không có hiệu lực để giao dịch, thanh toán", except for cash-register invoices that transmit data to the tax authority.
  - Source: [hethongphapluat Điều 5](https://hethongphapluat.com/nghi-dinh-254-2026-nd-cp-huong-dan-luat-quan-ly-thue-ve-hoa-don-dien-tu-chung-tu-dien-tu/dieu-5)
- **Cancellation:** NĐ70 removed cancellation (hủy) of erroneous e-invoices from 01/06/2025 — [Sapo](https://www.sapo.vn/blog/dieu-kien-va-thu-tuc-huy-hoa-don-dien-tu)
- **Late issuance (NĐ310/2025 amending NĐ125 Điều 24.2, from 16/01/2026):**
  - Normal sales: 1 invoice = 0.5–1.5M; 2–<10 = 2–5M; 10–<20 = 5–15M; 20–<50 = 15–30M; 50–<100 = 30–50M; ≥100 = 50–70M VND.
  - Special cases (promotions, samples, gifts, exchanges, in-kind pay, internal use, loans): warning for 1 invoice, rising to 15–30M for ≥100 invoices.
  - Source: [meInvoice on NĐ310](https://www.meinvoice.vn/tin-tuc/42191/nghi-dinh-310-2025-nd-cp-sua-doi-nghi-dinh-125-2020/)
- **Failure to issue (NĐ125 Điều 24.3 as amended):**
  - Normal sales: 1 invoice = 1–2M; 2–<10 = 2–10M; 10–<20 = 10–30M; 20–<50 = 30–50M; ≥50 = 60–80M VND.
  - Giving or selling invoices: 20–50M.
  - Source: [meInvoice on NĐ310](https://www.meinvoice.vn/tin-tuc/42191/nghi-dinh-310-2025-nd-cp-sua-doi-nghi-dinh-125-2020/)
- **NĐ310 transition:** violations ended before 16/01/2026 are penalised under the old rules. Violations that started before and were detected after fall under NĐ310 — [meInvoice](https://www.meinvoice.vn/tin-tuc/42191/nghi-dinh-310-2025-nd-cp-sua-doi-nghi-dinh-125-2020/)
- **NĐ291/2026 (21/07/2026):** mainly adds sanctions (10–100M VND) on providing information for exchange-of-information purposes. No found source shows it changing the invoice fines above — [LuatVietnam](https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-291-2026-nd-cp-sua-doi-nghi-dinh-125-2020-nd-cp-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don-186-110744-article.html); [meInvoice on NĐ291](https://www.meinvoice.vn/tin-tuc/49541/nghi-dinh-291-2026-nd-cp-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)
- **Consumer whistleblower reward (NĐ254 Điều 41):** up to 10% of the fine, capped at 10M VND per case, for reports on sellers that fail to issue e-invoices — [meInvoice](https://www.meinvoice.vn/tin-tuc/48311/nghi-dinh-254-2026-nd-cp-thay-the-nghi-dinh-123/)

### Inferences
- Retention period: accounting law (Luật Kế toán 88/2015 and NĐ 174/2016) requires accounting documents used directly for bookkeeping and financial statements to be kept for **at least 10 years**. This is prior knowledge, not fetched in this session. The app/provider must keep invoice XML (signed originals) for 10+ years.
- Fine levels: under NĐ125 the fines in the invoice chapter are stated for organisations, and individuals pay half. This is prior knowledge, not verified in this session.
- Because fines are tiered by invoice count, a systematic software bug (e.g., always issuing invoices one day late) multiplies exposure quickly. Timing validation in the app is high-value.

### Gaps
- Fines for wrong content, late transmission of uncoded invoice data, failure to file 04/SS, and registration violations under the consolidated NĐ125 (VBHN 27/2026) were not retrieved.
- The NĐ291/2026 invoice-specific changes were not fully reviewed. The consolidated text should be checked.
