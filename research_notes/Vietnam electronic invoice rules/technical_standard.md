# Vietnam e-invoice (hoá đơn điện tử) technical standard, as of November 2026

> Scope note for the report writer: the legal and technical base changed twice in 2025–2026.
> - 07/10/2021 to 12/06/2025: **QĐ 1450/QĐ-TCT** (amended by **QĐ 1510/QĐ-TCT**, 21/09/2022). Legal base: Decree 123/2020 and Circular 78/2021.
> - 13/06/2025 to 26/08/2026: **QĐ 1306/QĐ-CT**, after Decree 70/2025 and Circular 32/2025 (both effective 01/06/2025).
> - From 27/08/2026 (current): **QĐ 1233/QĐ-CT**, after the **Law on Tax Administration 108/2025/QH15**, **Decree 254/2026/NĐ-CP** and **Circular 91/2026/TT-BTC** (both effective 01/07/2026). Decree 254 replaces Decrees 123/2020 and 70/2025. Circular 91 replaces Circular 32/2025.
> - Most blogs, SDKs and GitHub samples online still describe 1450/1510 (message version 2.0.x). The tag names below come from 1450, because I could not read the full 1233 annex (it is paywalled or the PDF is over 10 MB). The 1233 annex lists use the same tag families (DLQRCode, KDLieu, and so on), so the core structure very likely carries over. Field-level differences in version 2.1.1 are **unverified** (see Gaps).

## 1. XML data format: governing decision, structure, key fields, code lists

### Takeaway
The current spec is **QĐ 1233/QĐ-CT (27/08/2026)**. It replaces 1306/QĐ-CT (13/06/2025), which had replaced 1450/1510. Two message versions, **2.1.0 and 2.1.1**, are accepted in parallel only until **31/12/2026**. After that only 2.1.1 is accepted. The invoice XML keeps the 1450 shape: `HDon > DLHDon(TTChung, NDHDon(NBan, NMua, DSHHDVu, TToan)) + DLQRCode + MCCQT + DSCKS`. The tax-rate list now also includes CTTC, KTPVDC and KTGTT alongside 0/5/8/10/KCT/KKKNT/KHAC.

### Cited Findings
**Decision lineage and versions**
- QĐ 1450/QĐ-TCT (07/10/2021) was amended by QĐ 1510/QĐ-TCT (21/09/2022). — [thuvienphapluat 1510](https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Quyet-dinh-1510-QD-TCT-2022-sua-doi-Quyet-dinh-1450-QD-TCT-hoa-don-dien-tu-530232.aspx)
- QĐ 1306/QĐ-CT was signed 13/06/2025 by the Cục trưởng Cục Thuế and took effect on signing. It replaced 1450/QĐ-TCT, 1510/QĐ-TCT and QĐ 1271/QĐ-CT (30/05/2025). — [nhansu.vn text of 1306](https://nhansu.vn/van-ban-phap-luat/Quyet-dinh-1306-QD-CT-2025-thanh-phan-chua-du-lieu-nghiep-vu-hoa-don-chung-tu-dien-tu-664897.html)
- QĐ 1233/QĐ-CT is dated 27/08/2026 in the header (the annex cover says 28/08/2026). It takes effect on signing and replaces 1306/QĐ-CT. Article 2 sets these transitions:
  - the tax system must be upgraded before 01/01/2027;
  - the signing system must be upgraded before 10/04/2027;
  - message versions **2.1.0 and 2.1.1** are accepted in parallel, with 2.1.0 accepted only to 31/12/2026;
  - signature standards **DSig and XAdES** are accepted in parallel, with DSig accepted only to 09/04/2027.
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html); [hethongphapluat 1233](https://hethongphapluat.com/quyet-dinh-1233-qd-ct-nam-2026-ve-quy-dinh-thanh-phan-chua-du-lieu-nghiep-vu-hoa-don-chung-tu-dien-tu-va-phuong-thuc-truyen-nhan-voi-co-quan-thue-do-cuc-truong-cuc-thue-ban-hanh.html) (signed by Mai Sơn, Deputy Director); [FAST](https://fast.com.vn/quyet-dinh-1233-qd-ct-ve-thanh-phan-chua-du-lieu-nghiep-vu-hoa-don-chung-tu-dien-tu/); [M-Invoice](https://minvoice.vn/quyet-dinh-1233-qd-ct-quy-dinh-moi-ve-du-lieu-hoa-don-chung-tu-dien-tu/)
- The official PDF of 1233 is hosted at [cdn.thuvienphapluat.vn/.../Quyet-dinh-1233.pdf](https://cdn.thuvienphapluat.vn/phap-luat/2022-2/DTML/290826/Quyet-dinh-1233.pdf). It is over 10 MB and I could not parse it.
- 1233 has annexes I–XX:
  - I message types; II invoice form symbols; III data types; IV "tính chất" indicators; V tax rates;
  - VI related or replaced invoice types; VII period types (T/Q/N); VIII form numbers; IX notice nature; X confirmation statuses;
  - XI reconciliation results; XII acceptance statuses; XIII QR example; XIV e-voucher types; XV specialty-goods fields;
  - XVI currencies; XVII adjustment reasons; XVIII business groups; XIX nationality codes; XX income types.
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)

**General data-format rules under 1233**
- Numbers have at most 21 digits, not counting separators or the minus sign, with at most 6 decimal places.
- Dates use `YYYY-MM-DD`. Date-times use `YYYY-MM-DDThh:mm:ss`. The time zone is GMT+7 (`+07:00`).
- Currency follows point 8 of the Decree 254 Appendix. Error handling follows Art. 10 and Art. 24(2) of Circular 91.
— [M-Invoice](https://minvoice.vn/quyet-dinh-1233-qd-ct-quy-dinh-moi-ve-du-lieu-hoa-don-chung-tu-dien-tu/)

**Invoice XML structure (from 1450, the predecessor spec)**

Header `HDon > DLHDon > TTChung` (field, max length, type, requirement):

| Tag | Max length | Type | Requirement |
|---|---|---|---|
| PBan | 6 | String | Required |
| THDon (invoice name) | 100 | String | Required if applicable |
| KHMSHDon (form-number symbol) | 1 | String | Required if applicable |
| KHHDon (invoice symbol) | 6 | String | Required if applicable |
| SHDon (invoice number) | 8 | Number | Required if applicable |
| MHSo | 20 | String | Required for per-transaction CQT invoices |
| NLap | — | Date | Required |
| SBKe / NBKe (bảng kê number and date) | — | — | Required if applicable |
| DVTTe (currency) | 3 | String | Required |
| TGia (exchange rate) | 7,2 | Number | Required unless the currency is VND |
| HTTToan (payment method) | 50 | String | Optional |
| MSTTCGP (tax code of the solution provider) | 14 | String | Optional |
| MSTDVNUNLHDon / TDVNUNLHDon / DCDVNUNLHDon | 14 / 400 / 400 | String | Required for delegated (ủy nhiệm) invoicing |

— [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

Related-invoice block `TTChung > TTHDLQuan`, used for replacement and adjustment:

| Tag | Max length | Type | Requirement |
|---|---|---|---|
| TCHDon | 1 | Number: 1 = replacement, 2 = adjustment | Required |
| LHDCLQuan (type of the related invoice) | 1 | Number | Required |
| KHMSHDCLQuan | 11 | String | Conditional |
| KHHDCLQuan | 8 | String | Conditional |
| SHDCLQuan | 8 | String | Conditional |
| NLHDCLQuan | — | Date | Required |
| GChu | 255 | String | Optional |

— [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

Parties `NDHDon`:
- `NBan` (seller): Ten (400, required), MST (14, required), DChi (400, required); optional SDThoai, DCTDTu, STKNHang, TNHang, Fax, Website, TTKhac.
- `NMua` (buyer): Ten, MST and DChi are conditional; optional MKHang (50), SDThoai, DCTDTu, HVTNMHang (100, buyer's full name), STKNHang, TNHang, TTKhac.
— [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

Line items `DSHHDVu > HHDVu` (repeating):

| Tag | Max length | Type | Requirement |
|---|---|---|---|
| TChat | 1 | Number | Required |
| STT | 4 | Number | Optional |
| MHHDVu | 50 | String | Conditional |
| THHDVu | 500 | String | Required |
| DVTinh | 50 | String | Conditional |
| SLuong | 21,6 | Number | Conditional |
| DGia | 21,6 | Number | Conditional |
| TLCKhau (discount %) | 6,4 | Number | Optional |
| STCKhau (discount amount) | 21,6 | Number | Optional |
| ThTien | 21,6 | Number | Required except on note lines |
| TSuat | 11 | String | Conditional |

— [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

Totals `TToan`:
- `THTTLTSuat > LTSuat` repeats per rate, with TSuat, ThTien (required) and TThue.
- TgTCThue (total before tax, required) and TgTThue (total VAT, required).
- `DSLPhi > LPhi` repeats per fee, with TLPhi name (100) and TPhi amount.
- TTCKTMai (total trade discount).
- TgTTTBSo (total payable in figures, required) and TgTTTBChu (total in words, 255, required).
- TTKhac.
— [luatvietnam 1450, part 2](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

Other elements:
- `TTKhac > TTin(TTruong, KDLieu, DLieu)` holds extension fields. KDLieu takes a data type from Annex III.
- `DLQRCode` (optional) holds QR data for lookup and payment.
- `MCCQT` holds the tax-authority code: string, at most 34 characters, unique. The tax-authority system inserts it inside `HDon`.
- `DSCKS` holds the signatures: `NBan`, `NMua`, `CQT`, `CCKSKhac`.
— [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

1233 Annex XV adds specialty-goods tags, for example:
- vehicles: SKhung (chassis number), SMay (engine number);
- transport: BKSPTVChuyen, DDi, DDen, THHVChuyen;
- sender details: TNGHang, DCNGHang, MSTNGHang.
— [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)

**Code lists (1233 annexes)**
- **TChat (Annex IV):**
  - 1 = goods or services;
  - 2 = promotion (khuyến mại);
  - 3 = trade discount, when shown per line;
  - 4 = note or description line;
  - 5 = specialty goods ("hàng hóa đặc trưng").
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **TSuat (Annex V):**
  - `0%`, `5%`, `8%`, `10%`;
  - `KCT`: not subject to VAT;
  - `KKKNT`: not declared or paid;
  - `KHAC`: other. Use `KHAC:AB.CD%` (for example `KHAC:5.26%`) when the rate can be determined. Taxpayers under Art. 30 of Circular 89/2026/TT-BTC write plain `KHAC`;
  - `CTTC`: finance-lease invoices;
  - `KTPVDC`: outside the scope of the tax law;
  - `KTGTT`: not included in the VAT base.
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **Currencies (Annex XVI, 21 codes, ISO 4217):** VND, USD, AUD, CAD, CHF, CNY, DKK, EUR, GBP, HKD, INR, JPY, KRW, KWD, MYR, NOK, RUB, SAR, SEK, SGD, THB. — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **Related-invoice type, LHDCLQuan (Annex VI):**
  - 1 = e-invoice under Decree 123/2020 or 70/2025;
  - 2 = coded e-invoice under QĐ 1209/2660-BTC;
  - 3 = invoice under Decree 51/2010 or 04/2014;
  - 4 = printed (đặt in) invoice under Decree 123;
  - 5 = e-invoice under Decree 254/2026.
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **Notice nature (Annex IX):** 0 new, 2 adjustment, 3 replacement, 4 explanation, 5 aggregation error, 6 notification. — same source
- **Adjustment or replacement reasons (Annex XVII, codes 1–14, mapped to Circular 91 Art. 10):**
  - 1 project settlement or price under sector law;
  - 2 adjustment per a competent authority's conclusion;
  - 3 wholesale electricity price;
  - 4 trade discount;
  - 5 return of non-registered goods;
  - 6 replacement for return of a registered asset;
  - 7 insurance fee or commission refund;
  - 8 cancelled or terminated transaction;
  - 9 credit-institution fee refund;
  - 10 telecom or scratch cards;
  - 11 natural-gas price on VND conversion;
  - 12 airline ticket exchange or refund;
  - 13 general correction of a wrong invoice;
  - 14 replacement of a wrong cash-register invoice.
  — same source
- **Payment method (HTTToan):** 1450 defines it as a free string of up to 50 characters, optional. — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html). I found no code list in 1233's visible annexes.

### Inferences
- An app that maps to a provider (MISA, Viettel, VNPT, BKAV, M-Invoice, EasyInvoice) mainly needs per line: TChat, item code and name, unit, quantity, unit price, discount, amount and TSuat. It also needs per-rate totals and the related-invoice block. Providers build the envelope, sign and transmit.
- Promotion lines (TChat=2) are typically sent with zero amounts and trade-discount lines (TChat=3) with ThTien reducing the total. I did not verify the exact sign convention for TChat=3 in 1233.
- Store TSuat as a string code, not a number. The KHAC:AB.CD% form and the non-numeric codes would break a numeric column.
- Version 2.1.1 is mandatory from 01/01/2027. Before then, confirm the provider's API has moved to 1233 / 2.1.1.

### Gaps
- I could not read the field-level content of the QĐ 1233 annex: the PDF exceeds 10 MB and HTML copies are paywalled. The exact differences between versions 2.1.0 and 2.1.1, any new buyer identifier fields (CCCD, personal ID, passport, nationality), and any change to TGia length are therefore unverified.
- I found no official XSD files or GitHub repositories with 1233 / 2.1.1 schemas. Provider developer docs (Viettel S-Invoice, VNPT, MISA meInvoice API) were not retrieved.
- I found no official HTTToan code list. Common practice is free text such as "TM/CK" (from training knowledge, unverified).

## 2. Invoice symbol (ký hiệu mẫu số, ký hiệu hoá đơn) and numbering

### Takeaway
The form number (ký hiệu mẫu số) is one digit, **1–9**. Digits 7–9 were added from 01/06/2025. The invoice symbol (ký hiệu hoá đơn) is **6 characters**: C or K, then the 2-digit year, then a type letter, then 2 seller-chosen letters (default "YY"), for example 1C26TAA. Invoice numbers have at most 8 digits, run sequentially per symbol and restart at 1 each calendar year.

### Cited Findings
- **Form numbers (ký hiệu mẫu số):**
  - 1 VAT invoice;
  - 2 sales invoice;
  - 3 sale of public assets;
  - 4 national reserve goods;
  - 5 e-stamps, tickets, cards and receipts;
  - 6 electronic internal-transfer and consignment delivery notes;
  - 7 hoá đơn thương mại điện tử;
  - 8 VAT invoice integrated with a tax, fee or charge receipt;
  - 9 sales invoice integrated with a tax, fee or charge receipt.
  — [einvoice.vn (TT 32/2025)](https://einvoice.vn/tin-tuc/quy-dinh-ve-ky-hieu-mau-so-ky-hieu-hoa-don-dien-tu-tu-ngay-01-6-2025-theo-thong-tu-32-2025-tt-btc). Confirmed in 1233 Annex II: [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- "Hoá đơn thương mại điện tử" (mẫu 7) applies to cross-border export transactions with an electronic data connection to the tax authority (Decree 254, Art. 8). — [MAN summary of ND 254](https://thue.man.net.vn/nghi-dinh-254-2026/). Note that some English translations render it as "e-commerce invoice", which is misleading. It is an electronic *commercial* invoice for exports.
- **Symbol characters:**
  - Char 1: C = with a tax-authority code; K = without a code.
  - Chars 2–3: the year.
  - Char 4: the type letter:
    - T = registered with the tax authority;
    - D = public assets, national reserve, or special invoices with reduced content;
    - L = issued by the tax authority per transaction;
    - M = generated from a cash register;
    - N = internal-transfer note;
    - B = consignment note;
    - G = stamp, ticket or card used as a VAT invoice;
    - H = stamp, ticket or card used as a sales invoice;
    - X = hoá đơn thương mại điện tử.
  - Chars 5–6: seller-defined letters, default "YY".
  - Examples: 1C25TAA, 1K25TYY, 6K25NAB, 7K25XAB.
  — [einvoice.vn](https://einvoice.vn/tin-tuc/quy-dinh-ve-ky-hieu-mau-so-ky-hieu-hoa-don-dien-tu-tu-ngay-01-6-2025-theo-thong-tu-32-2025-tt-btc)
- Circular 91/2026 (effective 01/07/2026) moves the symbol and form-number rules into Annex I. MISA lists new characters: **F** = "Hóa đơn giá trị gia tăng kiêm tờ khai hoàn thuế" (VAT invoice combined with a refund declaration) and **X** = hoá đơn thương mại điện tử. — [MISA on TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/); [sapo](https://www.sapo.vn/blog/thong-tu-91-2026-tt-btc). This conflicts in part with einvoice.vn, which already lists X under TT 32/2025, so X may simply be carried over.
- Paper-era 6-character form codes still appear in the related-invoice fields: 01GTKT, 02GTTT, 03XKNB, 04HGDL, 07KPTQ. — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html). This is why KHMSHDCLQuan allows 11 characters and KHHDCLQuan allows 8.
- **Numbering:** Arabic digits, at most 8 digits. Numbering starts at 1 at the start of the year or from the series' first use, ends on 31/12, and runs sequentially upward within the same form number and symbol (Decree 254 Appendix). — [MAN summary](https://thue.man.net.vn/nghi-dinh-254-2026/). SHDon in the XML is Number(8). — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

### Inferences
- The year characters change each 1 January (C26… becomes C27…). Software must create a new symbol series, or let the provider roll it over, and reset the counter. Invoices dated in 2027 must not carry a 26 symbol.
- A unique key of (seller tax code, KHMSHDon, KHHDon, SHDon) identifies an invoice. That is what the tax portal and buyers use to look it up.

### Gaps
- I could not see the full text of Circular 91 Annex I, so the complete 2026 letter list (whether F is new and whether any other letter was added) is not confirmed against the primary text.

## 3. Digital signatures

### Takeaway
Under 1450/1306 the seller signs DLHDon with W3C XML Signature (XMLDSig), embedded in `DSCKS/NBan`. On coded invoices the tax authority adds its own signature over DLHDon and MCCQT in `DSCKS/CQT`. QĐ 1233 introduces **XAdES**: DSig and XAdES are accepted in parallel only until **09/04/2027**. Cục Thuế announced that XAdES would start rolling out in November 2026.

### Cited Findings
- **Signature content (1450 §IV.4):**
  - the signing time goes in `Signature/Object/SignatureProperties/SignatureProperty/SigningTime` as a dateTime;
  - signed regions are referenced through `Reference/@URI`;
  - the certificate must be included (`X509SubjectName`, `X509Certificate`);
  - the format follows XML Signature Syntax and Processing, as required by Circular 39/2017/TT-BTTTT.
  — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)
- **Who signs what:**
  - `NBan` (seller or authorized unit) signs DLHDon plus its own Signature Object;
  - `NMua` (buyer, optional) signs DLHDon plus its own Object;
  - `CQT` signs DLHDon, MCCQT and its own Object, and is required on coded invoices;
  - `CCKSKhac` holds other signatures.
  — [luatvietnam 1450, part 2](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)
- **1233 transition:** DSig and XAdES are accepted in parallel, and DSig is accepted only to 09/04/2027. The signing system must be upgraded before 10/04/2027. — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **Rollout:** Công văn 7714/CT-CĐS (16/10/2026) schedules "triển khai áp dụng chữ ký số theo chuẩn mới XAdES" for November 2026. — [einvoice.vn update Oct–Dec 2026](https://einvoice.vn/tin-tuc/cap-nhat-hoa-don-dien-tu-thang-10-den-12-2026). The whole system is to move to XAdES. — [Thuế & Hải quan, 20/10/2026](https://thuehaiquan.tapchikinhtetaichinh.vn/nang-cap-ha-tang-cong-nghe-thong-tin-phuc-vu-trien-khai-hoa-don-chung-tu-dien-tu-170047.html)
- **Signing time vs issue date (Decree 254):** the signing time is displayed as Gregorian day/month/year. If it differs from the issue date (NLap), the data must be sent for a code or transmitted no later than the next working day. — [MAN summary](https://thue.man.net.vn/nghi-dinh-254-2026/)
- **Buyer details:** an individual buyer who gives no details gets the text "Bán cho người tiêu dùng" instead of blank buyer fields. Foreign buyers give a passport or entry document number and their nationality. — [MISA on ND 254](https://amis.misa.vn/279369/nghi-dinh-254-2026/)
- Circular 28/2025/TT-BKHCN regulates the format of digital-signature certificate information. — [thuvienphapluat](https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/toan-van-thong-tu-282025ttbkhcn-ve-dinh-dang-thong-tin-chung-thu-chu-ky-so-214321.html) (title only, not read)

### Inferences
- The exact XAdES profile (XAdES-BES/EPES/T, required QualifyingProperties such as SigningCertificateV2 and SigningTime, and any required timestamp from a TSA) could not be verified. Plan for the 2027 cut-over: an app that signs locally with a USB token through a provider plugin will need a provider update before 09/04/2027.
- The 10/04/2027 deadline probably lines up with the 2-year transition of Decree 23/2025/NĐ-CP on electronic signatures and trust services, which I believe took effect 10/04/2025 (training knowledge, unverified here).
- Certificate types (training knowledge, not verified in this session): any certificate from a licensed public CA (USB token, HSM, or remote signing / ký số từ xa) is acceptable. For CQT-coded invoices the buyer's signature is optional. Algorithm practice is RSA with SHA-256 (rsa-sha256 signature, sha256 digest), with the Reference URI pointing to `#<DLHDon/@Id>` and to the SignatureProperties Id.

### Gaps
- No primary source was found for XAdES technical parameters, timestamping (TSA) requirements, or the signature algorithm mandated in 1233.
- Remote-signing (ký số từ xa) rules under Decree 23/2025 were not researched in this session.

## 4. How data reaches the tax authority: channels, message types, MCCQT, status codes, lookup portal

### Takeaway
Data goes either **directly** to the Cục Thuế system (CDLTTDCQT) or **through a licensed transmission provider** (CDLQTCTN, the T-VAN). It goes either as full invoices (CDDu) or as a summary table (CBTHop). Every payload is wrapped in a `TDiep` envelope whose `MLTDiep` names the message type, for example 200 (send for code), 202 (code result), 203 (no-code data), 204 (01/TB-KTDL check result), 206/216 (cash register), 300/301 (error notice), 400 (summary), 999 (technical ack), -1 (format error). MCCQT is a unique string of up to 34 characters. Cash-register codes are 23 characters and start with "M".

### Cited Findings
- **Channels:** direct to the tax authority (CDLTTDCQT) or via a transmission provider (CDLQTCTN); full data (CDDu) or summary table (CBTHop). — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)
- **Envelope `TDiep`:**
  - `TTChung`: PBan (6), MNGui (14), MNNhan (14), MLTDiep (3, number), MTDiep (46), MTDTChieu (46, conditional; references the message being answered), MST (14), SLuong (7);
  - `DLieu` holds the payload, with a maximum message size of 2 MB;
  - MTDiep = sender code + 32 uppercase characters from a UUID v4 without hyphens;
  - MNGui/MNNhan start with "V" for transmission providers and "K" for direct connections, followed by the tax code without the hyphen.
  — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)
- **Message types (1233 Annex I).** Selected codes:

  | Code | Meaning |
  |---|---|
  | 100 | Register or change e-invoice use (01/ĐKTĐ-HĐĐT) |
  | 102 | Received / not received |
  | 103 | Accepted / not accepted |
  | 106 | Per-transaction invoice request |
  | 109–111 | Same flow for e-documents |
  | 150 | Tax-system account |
  | 200 | Send invoice for a code |
  | 201 | Per-transaction code request |
  | 202 | Code result |
  | 203 | Send no-code invoice data |
  | 204 | 01/TB-KTDL data-check result |
  | 206 | Coded cash-register invoice |
  | 207 / 214 | Casino |
  | 208 / 210 | Adjustment or replacement of many invoices with a bảng kê (coded / no-code) |
  | 209 / 215 | Invoice integrated with a receipt (no-code / coded) |
  | 211 | PIT withholding voucher |
  | 216 | **No-code cash-register invoice** |
  | 300 | Notice of an erroneous invoice |
  | 301 | Receipt and result of the error notice |
  | 302 | Invoice to be reviewed |
  | 303 | Error notice for a cash-register invoice |
  | 400 | Summary table |
  | 401 | Summary with an adjustment bảng kê |
  | 402 | Transaction details |
  | 403 | Receipt summary |
  | 500–507 | Authorized coding units and data sharing |
  | 600–603 | Cục Thuế countersigning for authorized coding units |
  | 901 / 902 | Daily reconciliation |
  | 999 | Technical response |
  | -1 | Wrong format |
  | -2 | Erroneous signing-request data |

  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- **MCCQT:** String(34), unique, generated by the tax system and inserted into `HDon`. — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html). It is made of a unique transaction number plus a string encrypted from the seller's invoice data. — [search summary of luatminhkhue / webketoan](https://luatminhkhue.vn/ma-cua-co-quan-thue-tren-hoa-don-dien-tu-bao-gom-bao-nhieu-ky-tu.aspx) (page blocked, snippet only)
- **Cash-register code:** 23 characters, structured `M C2-C3C4-C5..C9-C10..C20`, per QĐ 1510/2022. Example: `M1-23-E3Z8Z-00000000137`. "M" marks cash register; C2 is the invoice-type digit (1–6). — [MISA eShop](https://www.misaeshop.vn/30747/ky-hieu-hoa-don-khoi-tao-tu-may-tinh-tien/) (via search snippet; the page itself was not fetched)
- **Coded invoices (Decree 254 Art. 12):** the seller issues and signs, then sends for a code directly or via a provider. The code is issued automatically.
- **No-code invoices (Art. 13):** the seller sends the invoice to the buyer and then transmits the data within the prescribed deadline.
— [MAN summary](https://thue.man.net.vn/nghi-dinh-254-2026/)
- **Cục Thuế rollout plan, Sep–Dec 2026 (Công văn 7714/CT-CĐS, 16/10/2026):**
  - from November, the system receives invoices under QĐ 1233, including no-code cash-register invoices and erroneous-invoice lists;
  - summaries 01/TH-DT, 01/TH-HĐĐT and 01/TTGD;
  - error notices;
  - per-transaction requests (06/ĐN-PSĐT);
  - in December, a lookup API for authorized transmission providers and lookup-authorization registration.
  — [einvoice.vn](https://einvoice.vn/tin-tuc/cap-nhat-hoa-don-dien-tu-thang-10-den-12-2026); [Thuế & Hải quan](https://thuehaiquan.tapchikinhtetaichinh.vn/nang-cap-ha-tang-cong-nghe-thong-tin-phuc-vu-trien-khai-hoa-don-chung-tu-dien-tu-170047.html)
- **Registration controls:** biometric (face or OTP) verification now applies to every change in e-invoice registration. Use is suspended 10 days after a notice of mismatch with the National Population Database. — same sources
- **Providers under Circular 91:** providers that contracted with the tax authority before 01/07/2026 continue under those contracts. — [MISA on TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/)

### Inferences
- **Typical coded flow:** app or provider builds `HDon` and signs it (NBan). It wraps it in `TDiep` (MLTDiep=200) and sends. It receives 999 (technical ack). Then it receives either 202 (with `HDon` now carrying MCCQT and the CQT signature) or 204 (rejection with error list). The invoice is valid only after 202.
- **No-code flow:** MLTDiep=203 per invoice (or 400 summary for eligible sectors), then 204 with the check result.
- **The lookup portal:** hoadondientu.gdt.gov.vn is the public lookup and taxpayer portal. Public lookup uses seller tax code, form, symbol, number, and so on. I did not verify its 2026 state in this session (training knowledge). The new provider lookup API (Dec 2026) is the programmatic alternative.

### Gaps
- I found no published list of the error codes inside 204 / 01/TB-KTDL (for example the "lý do" codes). These are usually in provider docs or the annex of the technical decision.
- I could not confirm the exact layout of the 34-character MCCQT. The 23-character cash-register code layout comes from secondary snippets only.
- The transport protocol (web service or message queue, endpoints, TLS client certificates) for direct connection is not described in any source I could read.

## 5. Adjustment / replacement, foreign currency, VAT reductions, cash-register invoices

### Takeaway
Corrections follow **Circular 91 Art. 10** (effective 01/07/2026). Minor errors are handled with a notice (04/SS-HĐĐT). Errors in tax code, amount, rate, tax or goods are fixed with an adjustment invoice ("Điều chỉnh cho hóa đơn Mẫu số… ký hiệu… số… ngày…") or a replacement invoice ("Thay thế cho…"). In XML these use `TTHDLQuan` (TCHDon 1 = replace, 2 = adjust). Increases are entered as positive values and decreases as negative values. The **8% reduced VAT rate** (Resolution 204/2025/QH15, Decree 174/2025) applies **01/07/2025–31/12/2026**. No extension beyond 2026 was found.

### Cited Findings
**Error handling (Circular 91 Art. 10)**
- Errors that do not touch tax code, amounts, rate, tax or goods (name, address, amount in words): notify the buyer, no reissue. Notify the tax authority on form 04/SS-HĐĐT, except for a no-code invoice not yet transmitted.
- Errors in tax code, amounts, rate, tax or goods: issue an adjustment or a replacement invoice with the wording above.
- Many same-type errors for one buyer in a month can be covered by one invoice with a list (01/BK-ĐCTT).
- **Increases are entered as positive values and decreases as negative values.**
- Organizations need a prior written agreement. For individuals, the seller notifies them or posts a notice on its website.
- Trade discounts use an adjustment invoice with a list. Returns use an adjustment, and the buyer may issue a return invoice.
- If the tax authority finds the error first, it sends 01/TB-RSĐT.
- Invoices issued under Decree 123, Decree 70 or Circular 32 are corrected under the new rules. Invoices under Decree 51/2010 or 04/2014 get a new invoice marked "Thay thế cho hóa đơn…".
— [MISA on TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/)

**XML for corrections**
- `TTHDLQuan` holds TCHDon, LHDCLQuan (now with value 5 = Decree 254 invoice), and the related invoice's form, symbol, number and date, plus GChu. — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html); [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- The reason code comes from 1233 Annex XVII (1–14).
- Message 208 is for coded adjustment or replacement of many invoices with a bảng kê, and 210 for the no-code version. — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)

**Foreign currency**
- DVTTe is a 3-letter code from the Annex XVI list. TGia is required whenever DVTTe ≠ VND; in 1450 it is Number(7,2). — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html); [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- Currency rules are in point 8 of the Decree 254 Appendix. — [M-Invoice](https://minvoice.vn/quyet-dinh-1233-qd-ct-quy-dinh-moi-ve-du-lieu-hoa-don-chung-tu-dien-tu/)
- Amount fields allow up to 6 decimal places (21,6), so foreign-currency amounts are carried at source precision.

**VAT reductions**
- Resolution 204/2025/QH15: from 01/07/2025 to 31/12/2026, most goods and services at 10% are reduced to 8%. Eligibility is checked against Decree 174/2025/NĐ-CP (30/06/2025) and its exclusion appendices. Telecom, finance, banking and securities are excluded, as are sugary drinks over 5 g/100 ml in 2026.
- Deduction-method sellers write 8% in TSuat.
- Households and individuals on the %-of-revenue method write the reduced amount with the note "đã giảm… (số tiền) tương ứng 20% mức tỷ lệ % để tính thuế giá trị gia tăng theo Nghị quyết số 204/2025/QH15".
— [search summary: MISA / einvoice.vn / ketoanthienung](https://amis.misa.vn/184663/nghi-dinh-giam-thue-gtgt-2025/); [einvoice.vn ND 174](https://einvoice.vn/van-ban-hddt/nghi-dinh-174-2025-nd-cp-quy-dinh-ve-chinh-sach-giam-thue-gtgt-theo-nghi-quyet-so-204-2025-qh15)
- One unconfirmed item: thuvienphapluat ran a headline about fuel VAT moving from 8% to 0% or not taxable from 26/03/2026. — [thuvienphapluat](https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/chinh-thuc-giam-thue-gtgt-xang-dau-8-con-0-tu-26032026-222459.html)

**Cash-register invoices (hoá đơn từ máy tính tiền)**
- Symbol type letter **M** (for example C26MAA). — [einvoice.vn](https://einvoice.vn/tin-tuc/quy-dinh-ve-ky-hieu-mau-so-ky-hieu-hoa-don-dien-tu-tu-ngay-01-6-2025-theo-thong-tu-32-2025-tt-btc)
- Messages: 206 for coded, 216 for no-code (new under 1233), 303 for error notices. — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- Reason 14 covers replacement of a wrong cash-register invoice. — same source
- Mandatory for direct retail to consumers (Decree 254 Art. 6(1)(c)): shopping centres, supermarkets, restaurants, hotels, passenger transport.
- Reduced content: seller name, address and tax code; item name, unit price, quantity and payment amount. Buyer details are needed only on request.
— [MAN summary](https://thue.man.net.vn/nghi-dinh-254-2026/)
- From October 2026, cash-register invoicing is stopped for entities whose business line no longer meets Art. 6(1)(c). — [einvoice.vn](https://einvoice.vn/tin-tuc/cap-nhat-hoa-don-dien-tu-thang-10-den-12-2026)

**Timing rules (Decree 254 Art. 9)**
- Services are invoiced on completion regardless of payment, or on payment if payment comes first.
- Security deposits do not trigger an invoice.
- A 7-day reconciliation is allowed for listed services.
- Sellers without automatic invoicing may issue late-night sales invoices by the next working day.
— [MISA on ND 254](https://amis.misa.vn/279369/nghi-dinh-254-2026/)

### Inferences
- **Adjustment XML:** set TCHDon=2, fill the related-invoice fields, and send only the delta lines. Decreases go in as negative quantities or amounts, and per-rate totals and TgTTTBSo may be negative.
- **Replacement XML:** set TCHDon=1 and send a full new invoice. The original is then treated as replaced.
- **Multi-currency rounding:** no primary rule was found in this session. The safe practice is:
  - keep line amounts in original currency at source precision;
  - compute VAT per rate on the per-rate subtotal;
  - put the VND equivalent (amount × TGia) in TTKhac or per provider convention;
  - round VND to whole đồng.
  Provider practice varies (unverified).
- **8% rate after 2026:** an 8% rate must not be applied to invoices dated from 01/01/2027 unless a new resolution extends it. Software should date-gate the 8% option.

### Gaps
- I found no primary text on how 1233 / 2.1.1 encodes the VND equivalent of foreign-currency invoices or on rounding rules.
- I found no confirmation of any extension of the 8% reduction beyond 31/12/2026 (as of 11/11/2026). This should be re-checked near year-end.
- The fuel 0% / not-taxable claim from 26/03/2026 is unverified.

## 6. Readable presentation (bản thể hiện) and QR codes

### Takeaway
Circular 91 Annex V provides *reference* display templates; they are not mandatory. The display must reflect the XML content, including the signing time in dd/mm/yyyy and the tax-authority code on coded invoices. QĐ 1233 Annex XIII defines an optional `DLQRCode` following the Vietnamese payment-QR (EMVCo-style) layout, with an invoice-information sub-field.

### Cited Findings
- Circular 91 has 5 annexes. I–IV are mandatory and Annex V (display samples) is for reference. — [MISA on TT 91](https://amis.misa.vn/279873/thong-tu-91-2026-tt-btc/); [sapo](https://www.sapo.vn/blog/thong-tu-91-2026-tt-btc)
- Mandatory invoice content under Decree 254 Art. 10 includes:
  - invoice name, symbol, form number and number;
  - seller and buyer name, address and tax code;
  - item, unit, quantity and price;
  - pre-tax amount, rate and VAT;
  - signatures;
  - issue time and signing time;
  - the tax-authority code where applicable.
  — [MAN summary](https://thue.man.net.vn/nghi-dinh-254-2026/)
- Multi-location household or fuel businesses must show the name, code and address of each location. Authorized (ủy nhiệm) invoices show both parties. — [MISA on ND 254](https://amis.misa.vn/279369/nghi-dinh-254-2026/)
- **QR example (1233 Annex XIII):**
  - payment-QR fields: version 01, dynamic QR method 12, MCC 5499, currency 704 (VND), amount 120000, country VN, merchant name and city;
  - additional data: bill number, store ID, terminal ID;
  - **invoice-info data:** seller tax code 0107001729001, form 1, symbol C21TYY, number 68, date 20211121 (yyyymmdd), total 120000;
  - CRC = 383C.
  — [luatvietnam 1233](https://luatvietnam.vn/thue/quyet-dinh-1233-qd-ct-2026-quy-dinh-thanh-phan-du-lieu-hoa-don-chung-tu-dien-tu-446016-d1.html)
- `DLQRCode` is optional in the XML and carries QR data used for lookup and payment. — [luatvietnam 1450](https://luatvietnam.vn/thue/quyet-dinh-1450-qd-tct-bo-tai-chinh-210675-d1.html)

### Inferences
- The QR uses the VietQR / NAPAS EMVCo TLV format with a CRC16 checksum. The invoice-info sub-tag lets a scanner both pay and identify the invoice. Software that prints receipts can generate it from seller tax code, form, symbol, number, date and total.
- Bản thể hiện is generated from the XML (usually through XSLT supplied by the provider). Show C/K, the symbol, number and MCCQT on coded invoices, the signature validity marker, and "Bán cho người tiêu dùng" when there are no buyer details.

### Gaps
- I did not read the full text of Circular 91 Annex V or any Decree 254 rules specific to the bản thể hiện (language, bilingual display, font or encoding, conversion to paper). The exact TLV tag IDs for the invoice-info sub-field in the QR are also unverified.
