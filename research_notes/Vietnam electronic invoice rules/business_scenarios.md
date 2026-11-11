# Vietnamese e-invoice rules applied to SME sales / inventory / accounting scenarios (as of Nov 2026)

Scope note: legal baseline is Nghị định 123/2020/NĐ-CP (ND 123) as amended by Nghị định 70/2025/NĐ-CP (ND 70, issued 20/3/2025, effective 01/6/2025), with Thông tư 32/2025/TT-BTC (TT 32) replacing Thông tư 78/2021 from 01/6/2025. VAT is now governed by Luật Thuế GTGT 2024 + Nghị định 181/2025 (effective 01/7/2025); CIT by Nghị định 320/2025 + Thông tư 20/2026; penalties by ND 125/2020 as amended by Nghị định 310/2025 (effective 16/01/2026). Most direct fetches of the decree text and Big4 PDFs failed in this session (403, encrypted or image-only PDFs, 10MB size limit), so many findings rest on law-portal summaries (luatvietnam, lsvn, thuvienphapluat Q&A titles), the Ministry of Finance Q&A portal, and MISA/Sapo articles. Items marked "prior knowledge, not re-verified" in Inferences come from training knowledge and must be checked against the decree text before they are coded into the app.

## 1. Scenario matrix: is an invoice required, what kind, when?

### Takeaway
After 01/6/2025, an invoice is due for every sale of goods at the moment ownership or the right to use passes, whether or not the money has been received. It is also due for promotions, gifts, samples and internal consumption (except internal flows to continue production). Exports must be invoiced no later than the next working day after customs clearance. Services are invoiced at completion, or when money is received earlier, with a deposit/advance exception that covers only listed professional services.

### Cited Findings
- **Sale of goods (sales order, delivery note/phiếu xuất kho bán hàng):** ND 70 amended clauses 1–2 of Article 9 ND 123. The invoice time for goods is when ownership or the right to use the goods passes to the buyer ("thời điểm chuyển giao quyền sở hữu hoặc quyền sử dụng hàng hóa cho người mua"), whether or not payment has been collected. — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html); [MISA AMIS](https://amis.misa.vn/?p=210443)
- **Export goods (including processing for export):** the seller chooses the invoice time, but it must be no later than the next working day after customs clearance ("chậm nhất không quá ngày làm việc tiếp theo kể từ ngày hàng hóa được thông quan"). This rule is new from 01/6/2025. — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html); [Luật Việt Nam](https://luatvietnam.vn/tin-van-ban-moi/bo-sung-quy-dinh-ve-thoi-diem-lap-hoa-don-doi-voi-hang-hoa-xuat-khau-186-101508-article.html)
- MISA notes that the declarant usually cannot issue the VAT invoice at the time of the customs filing, so the invoice is not part of the customs dossier. In practice the commercial invoice and packing list go to customs and the e-invoice follows clearance. — [MISA AMIS – hóa đơn xuất khẩu](https://amis.misa.vn/89381/hoa-don-dien-tu-xuat-khau/)
- **Services:** the invoice is issued when the service is completed, including services to foreign parties, regardless of collection. If money is collected before or during the service, the invoice is issued when the money is collected ("là thời điểm thu tiền"). — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html)
- **Deposit/advance exception (services only):** collecting a deposit or advance to secure the contract does not trigger an invoice, but only for listed services. These are accounting, auditing, financial and tax advisory, valuation, technical survey and design, supervision consulting, and investment project preparation. — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html); [MISA AMIS](https://amis.misa.vn/?p=210443)
- **Recurring, high-volume supplies that need reconciliation (Art 9.4.a):** examples are electricity, telecom, logistics, e-commerce and some banking services. The invoice is due when reconciliation is complete, no later than the 7th of the following month or 7 days after the agreed period ends. — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html); [MISA AMIS](https://amis.misa.vn/?p=210443)
- **Promotions, gifts, samples, internal consumption, goods lent or returned:** the Ministry of Finance (official Q&A, 10/01/2026) refers invoicing for promotional, free and gifted goods to Art 4(1) ND 123 as amended by ND 70, and to Article 1 clause 7 ND 70 on e-invoices for promotional, free and gifted goods. — [MOF Q&A portal](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158126)
- ND 310/2025 has a separate penalty table for not invoicing, or invoicing at the wrong time, "promotion, gifts, samples, internal use, loans/returns of goods". This confirms these flows must be invoiced. — [MISA AMIS – ND 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)
- **Retail sales to individuals who don't want an invoice:** an invoice is still mandatory ("kể cả khi người mua không lấy hóa đơn") under Art 4(1) ND 123 as amended. Art 10(14) allows omitting buyer details for non-business individuals at supermarkets and shopping centres, petrol sales, and similar cases. — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/xuat-hoa-don-cho-khach-hang-ca-nhan-khong-lay-hoa-don-nhu-the-nao-565-102155-article.html)
- **Purchases from individuals or households without invoices:** no invoice can be obtained, so the buyer prepares a purchase list (bảng kê). From 2026 this is Form 02/TNDN under Thông tư 20/2026/TT-BTC, replacing 01/TNDN of TT 78/2014 (see section 9). — [MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)
- **Electronic signing date:** Sapo's ND 70 FAQ states the signing date must be no more than 1 working day after the invoice date. — [Sapo FAQ part 1](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-1)

### Inferences
Prior knowledge, not re-verified this session, unless marked otherwise:
- **Quotation (báo giá):** no invoice. It is not a supply of goods or services.
- **Sales order confirmed but not delivered:** no invoice yet. The trigger for goods is transfer of ownership, normally delivery.
- **Delivery in several shipments:** ND 123 Art 9(3) has a long-standing rule for multiple deliveries or handover by stage: each delivery is invoiced for the quantity and value delivered. The app should therefore link one invoice (or one invoice per batch) to each phiếu xuất kho bán hàng, not one invoice to the whole sales order. ND 70 did not appear to change this; the LSVN summary is silent on it.
- **Customer deposit or advance for goods:** goods are invoiced on transfer of ownership, so receiving money in advance for goods does not trigger an invoice. Record it as a customer advance on TK 131 (credit side), then invoice on delivery. For services, money received before completion triggers an invoice on receipt, unless the service is on the professional-services exception list.
- **Debt collection or cash receipt (phiếu thu) on an already-invoiced sale:** no new invoice.
- **Internal transfer between warehouses:** use a phiếu xuất kho kiêm vận chuyển nội bộ (PXKKVCNB), an e-document under ND 123/TT 78, now TT 32, not a VAT invoice. Goods sent to an agent use a phiếu xuất kho gửi bán hàng đại lý. The agent invoices the end buyer, and the principal invoices the agent when the agent reports sales. Internal consumption to continue production (raw materials issued to a production order) needs no invoice. This matches the ND 70 wording "trừ hàng hóa luân chuyển nội bộ, tiêu dùng nội bộ để tiếp tục quá trình sản xuất" as remembered from prior knowledge.
- **Production orders:** no invoice for issuing materials or receiving finished goods.
- **Goods receipt from a VAT-registered supplier:** the supplier issues the invoice. The app should store the supplier invoice (form/serial/number/date, tax-authority code) against the goods receipt.

### Gaps
- Could not retrieve verbatim Art 4(1) as amended, or the exact text of Article 1 clause 7 ND 70: both the MISA-hosted PDF (over 10MB) and the Big4 PDFs (encrypted or image-only) failed. The exact list of exempted internal flows, and whether one summary invoice per period is allowed for gifts to many customers, need checking against the decree. A hoatieu.vn article titled "Từ 1/7/2025, được lập hóa đơn tổng đối với quà tặng cho nhiều khách hàng" suggests such a rule exists, but it was not read.
- Did not verify the text of TT 32/2025 on PXKKVCNB and agent delivery notes.

## 2. Sales returns after ND 70: who issues, business vs consumer, recording

### Takeaway
From 01/6/2025, the seller is the default issuer: when the buyer returns all or part of the goods, the seller issues an adjustment invoice (hóa đơn điều chỉnh) referencing the original. The buyer issues a "return" e-invoice to the seller only if the parties agree, or if the goods are registered assets in the buyer's name and the buyer uses e-invoices. The secondary sources found draw no explicit business-vs-consumer distinction.

### Cited Findings
- ND 70 amended Article 19 ND 123 (Article 1 clause 13 ND 70). When the buyer returns all or part of the goods, including exchanges that change the value, the seller issues an adjustment invoice. If the parties agree, the buyer may instead issue the e-invoice for the return to the seller. Both parties then meet tax obligations as for a normal sale. — [Luật Việt Nam – trả lại hàng từ 01/6/2025](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)
- For goods subject to ownership or use registration (e.g. vehicles) registered in the buyer's name, the return follows the relevant law. If the buyer is eligible to use e-invoices, the buyer issues the invoice to the seller. — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)
- Both parties must keep the documents (return minutes or agreement) and produce them on request. — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)
- Secondary sources conflicted before reading the primary summary: one says the buyer issues the invoice, another says the seller issues an adjustment invoice. The luatvietnam summary of the amended Art 19 resolves this: seller adjusts by default, buyer invoices only by agreement or for registered assets. — [Search results incl. acman.vn](https://acman.vn/xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-dich-vu-theo-nghi-dinh-70-2025-nd-cp.html); [MISA AMIS – điều chỉnh giảm](https://amis.misa.vn/?p=52028)
- Adjustment invoices must state "Điều chỉnh cho hóa đơn Mẫu số... ký hiệu... số... ngày... tháng... năm". — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)
- Several wrong invoices for the same buyer in one month (same goods name, unit price and tax rate) can be fixed with one adjustment or replacement invoice plus list Mẫu 01/BK-ĐCTT. A wrong name or address with a correct tax code needs only a notice to the buyer plus Mẫu 04/SS-HĐĐT. Cancelling a wrongly issued invoice is no longer allowed from 01/6/2025. — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html); [Sapo – bỏ hủy hóa đơn](https://www.sapo.vn/blog/dieu-kien-va-thu-tuc-huy-hoa-don-dien-tu)
- Declaration: the seller declares in the period the adjustment invoice is issued, and the buyer in the period it is received (secondary source). — [search summary citing ihoadon/ketoanleanh](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/huong-dan-lap-hoa-don-dieu-chinh-theo-nd-702025nd-cp.html)

### Inferences
- **App design:** a "Hàng bán trả lại" voucher should by default generate a seller-side *adjustment-down invoice* linked to the original invoice. It should carry the quantity, unit price and VAT returned, plus a mandatory link to a return minute (biên bản trả hàng). There should be an option "buyer issues return invoice", in which case the app records the buyer's invoice as an incoming document instead of issuing one.
- **Consumers (individuals without e-invoices):** the buyer cannot issue an invoice, so the seller's adjustment invoice is the only route. Partial and full returns are handled the same way. For a full return, adjustment-down to zero is the inference, because cancellation (hủy) is abolished.
- **Accounting:** sales returns go to TK 5213 under TT 200/TT 99, or directly debit TK 511 under TT 133, with VAT reversed and inventory re-received at cost.

### Gaps
- No source found that explicitly distinguishes business vs consumer buyers for returns. Luật Việt Nam says the text doesn't separate them.
- No official letter (công văn) found specifically on returns after ND 70.

## 3. Discounts: trade discounts (chiết khấu thương mại) and payment discounts (chiết khấu thanh toán)

### Takeaway
A trade discount is shown on the invoice. If it is known at the time of sale, it is deducted on that invoice. If it is determined at period end, it is deducted on the last invoice, or, where it exceeds that invoice, issued as a separate adjustment invoice with a list of the related invoices. A payment discount for early payment is a financial item and needs no invoice.

### Cited Findings
- If the period-end trade discount exceeds the value of the last purchase, the seller issues an adjustment invoice classified as a discount invoice, with a list of the invoice numbers adjusted. MISA's worked example: a 30m VND discount against a 10m final invoice requires an adjustment invoice. — [MISA AMIS – hóa đơn chiết khấu thương mại](https://amis.misa.vn/40617/hoa-don-chiet-khau-thuong-mai/); [meInvoice](https://www.meinvoice.vn/?p=41681)
- Both parties adjust revenue and output/input VAT in the period the adjustment invoice is issued. — [MISA AMIS](https://amis.misa.vn/40617/hoa-don-chiet-khau-thuong-mai/)
- Accounting: TT 133/2016 has no TK 521, so the discount is debited directly to TK 511. TT 99/2025 (the new enterprise accounting regime replacing TT 200) uses TK 521, closed to TK 511 at period end. — [search summary citing MISA/fastca](https://fastca.vn/hach-toan-hoa-don-chiet-khau-thuong-mai)
- A payment discount (early payment, unrelated to volume) needs no invoice. The seller records it as financial expense (TK 635) and the buyer as financial income (TK 515). Công văn 1810/VLO-QLDN3 (24/12/2025, Thuế tỉnh Vĩnh Long) is cited as saying a payment discount is not a sale of goods or services. Under ND 320/2025 it is still taxable income for the buyer. — [MISA AMIS – chiết khấu thanh toán](https://amis.misa.vn/26292/hach-toan-chiet-khau-thanh-toan/)
- A promotional discount (giảm giá) under a registered or notified promotion: the VAT taxable price is the reduced price during the promotion period (ND 181/2025 Art 6(2)). — [MOF Q&A](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158126)

### Inferences
- The app should support three flows: (a) a line-level or invoice-level discount at the time of sale; (b) a period-end discount deducted on the next invoice, which needs a "chiết khấu thương mại" line referencing the invoices it covers; (c) a standalone adjustment-down invoice with a list of invoices, for when (b) exceeds the next invoice or there is no further invoice. It should block issuing an invoice for a payment discount.

### Gaps
- No primary-text quote found for how ND 70 or TT 32 words period-end trade discounts. The rules above are corroborated only by MISA and accounting blogs.

## 4. Promotions and free goods (khuyến mại, hàng tặng)

### Takeaway
Promotional, gift and sample goods must be invoiced. If the promotion follows commercial law (registration with or notice to the Sở Công Thương, where required), the VAT taxable price is 0. Otherwise it is taxed like a gift, at the market price of equivalent goods. The registration question belongs to commercial law, not tax law.

### Cited Findings
- VAT Law 2024 Art 7(1)(c) and ND 181/2025 Art 6(2) set the taxable price of goods used for promotion under commercial law at zero ("giá tính thuế được xác định bằng không (0)"), except discount-type promotions, which use the reduced price. Promotions not carried out under commercial-law rules are taxed like ordinary gifts, at the price of equivalent goods at the time of supply. — [MOF Q&A, 10/01/2026](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158126)
- MOF declined to rule on whether notification or registration with the Sở Công Thương is needed, saying this falls under commercial law. — [MOF Q&A](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158126)
- Treating promotional goods as "price 0, so no invoice" is a violation. An invoice must still be issued. — [meInvoice](https://www.meinvoice.vn/?p=38685)
- Not invoicing promotional, gift or sample goods carries penalties from a warning (1 invoice) up to 30–50m VND (100+ invoices) under ND 310/2025. — [MISA AMIS – ND 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)

### Inferences
- **Invoice presentation** (prior knowledge, long-standing practice under TT 219 and ND 123): show the promotional line with name and quantity, unit price and amount 0 (or the value without collection), and the note "Hàng khuyến mại không thu tiền". When the promotion is "buy X get Y" on the same sale, the free item can sit on the same invoice as a 0-value line.
- Output VAT on compliant promotions is 0, but the input VAT on the promotional goods remains deductible. The cost of the goods is a deductible expense.
- **App design:** add a "promotion program" master record with a registration/notification reference and validity dates. Free-goods lines then default to 0 price with the standard note. If a free line is used outside a valid program, warn that VAT must be calculated at market price.

### Gaps
- Verbatim wording of Article 1 clause 7 ND 70 (how to record value on promotional invoices) not retrieved.

## 5. Export sales in foreign currency

### Takeaway
Export goods are invoiced no later than the next working day after customs clearance. 0% VAT requires the conditions in the VAT Law 2024 and ND 181/2025: an export contract, non-cash payment documents, and customs clearance evidence. Whether exporters can use a "hóa đơn thương mại điện tử" is unconfirmed in this session.

### Cited Findings
- Timing: no later than the next working day after customs clearance (ND 70 amending Art 9). — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html); [Tạp chí Công Thương](https://tapchicongthuong.vn/quy-dinh-moi-ve-thoi-diem-lap-hoa-don-voi-xuat-khau-hang-hoa-tu-1-6-141389.htm)
- 0% conditions from 01/7/2025 (ND 181/2025, guided by TT 69/2025/TT-BTC): export goods and services must meet conditions on contracts and payment documents. — [Lao Động](https://news.laodong.vn/kinh-doanh/dieu-kien-ap-dung-thue-suat-gia-tri-gia-tang-0-cho-hang-hoa-dich-vu-xuat-khau-tu-17-1533622.ldo); [TT 69/2025 PDF](https://vnuf.edu.vn/wp-content/uploads/2025/09/Thong-tu_69-2025-TT-BTC.pdf)
- MISA guide on how to write an export e-invoice under ND 70. — [MISA AMIS](https://amis.misa.vn/89381/hoa-don-dien-tu-xuat-khau/)

### Inferences
Prior knowledge, not re-verified:
- ND 70 amended Art 8 to add a "hóa đơn thương mại điện tử" type. It would be used by organisations exporting goods or services that meet certain conditions, once the tax authority's system supports it. Until then, exporters use the hóa đơn GTGT (VAT-method taxpayers) or hóa đơn bán hàng (direct method, or exporters in non-tariff zones).
- Invoices in foreign currency show the currency, and the total is converted to VND at an exchange rate determined under accounting law, generally the commercial-bank buying rate. The app should store the currency, the exchange rate and the VND equivalent on the invoice.
- **App design:** create the invoice from the export delivery or customs declaration, with a due-date check of clearance date + 1 working day. Set the VAT rate to 0% with a checklist (contract, customs declaration, bank payment document).

### Gaps
- Could not confirm the "hóa đơn thương mại điện tử" provision, its conditions or its start date, or the exchange-rate rule on export invoices. No source found in search.

## 6. Customer deposits and advance payments

### Takeaway
For goods, receiving a deposit or advance does not trigger an invoice; the trigger is transfer of ownership. For services, money received before or during the service triggers an invoice at the time of receipt, unless it is a deposit/advance securing a contract for the listed professional services.

### Cited Findings
- Services: invoice at the time money is collected if collected before or during supply. The exception for deposits/advances securing the contract covers accounting, auditing, financial/tax advisory, valuation, technical survey/design, supervision and investment-project preparation services. — [LSVN](https://lsvn.vn/sua-doi-bo-sung-nhieu-quy-dinh-ve-thoi-diem-lap-hoa-don-a155296.html)
- Goods: invoice at transfer of ownership regardless of whether money has been collected. — [MISA AMIS](https://amis.misa.vn/?p=210443)
- If a service is cancelled or partly cancelled after an invoice was issued on an advance, the seller issues an adjustment invoice. — [Luật Việt Nam](https://luatvietnam.vn/thue-phi-le-phi/cach-xu-ly-hoa-don-dien-tu-khi-tra-lai-hang-hoa-565-101871-article.html)

### Inferences
- An SME trading in goods should treat customer prepayments as advances (TK 131 credit) with no invoice. On delivery, issue the full invoice and offset the advance. If the business also sells services such as installation or maintenance, the app must issue an invoice on receipt of a service advance (outside the exception list).

### Gaps
- None beyond confirming the exact exception list wording against the decree.

## 7. Retail counter sales to walk-in customers; cash-register invoices; buyer ID

### Takeaway
Every retail sale must be invoiced, even when the buyer doesn't want one. Buyer details may be omitted for non-business individuals. Cash-register e-invoices (hóa đơn khởi tạo từ máy tính tiền) are mandatory from 01/6/2025 for enterprises and households with revenue of 1 billion VND or more per year that sell directly to consumers in retail, F&B, hotels, passenger transport, entertainment and personal services. Whether an end-of-day summary invoice is still allowed is contested between sources.

### Cited Findings
- Cash-register invoices are mandatory under Article 1 clause 8 ND 70, amending Art 11 ND 123. The obligation covers households or individual businesses with annual revenue of 1 billion VND or more, selling directly to consumers in: retail, supermarkets and shopping centres (excluding cars and motorbikes); food and beverage, restaurants and hotels; passenger transport; entertainment and cinemas; and personal services (massage, laundry, hairdressing and beauty, funeral and wedding services). Revenue from all channels, including online, counts toward the threshold. — [Sapo FAQ part 2](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2); [Sapo](https://www.sapo.vn/blog/hoa-don-khoi-tao-tu-may-tinh-tien)
- Sapo says each cash-register invoice must be created at the moment the sale completes, whether or not the customer takes it, and that one summary invoice for the day breaches the timing rules. The data is batched, signed and sent to the tax authority at end of day under Quyết định 1306/QĐ-CT. — [Sapo FAQ part 2](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2)
- **Conflict:** a thuvienphapluat Q&A describes the practice of one summary e-invoice per day from receipts or cash-register data for customers who don't take invoices. A Grant Thornton newsletter snippet still mentions end-of-day timing "đối với hoạt động kinh doanh thương mại bán lẻ, kinh doanh dịch vụ ăn uống theo mô hình hệ thống cửa hàng bán trực tiếp đến người tiêu dùng". The same newsletter says end-of-day or end-of-month summaries were removed for banking, securities, insurance, e-wallet and electricity services to individuals. — [thuvienphapluat Q&A](https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/thoi-diem-xuat-hoa-don-theo-nghi-dinh-70-chi-tiet-248654-215343.html); [Grant Thornton newsletter Jun 2025](https://www.grantthornton.com.vn/contentassets/0a95b00a770a4a50abe80985fe2502dd/tax-newsletter-june-2025---vietnamese-version.pdf); contradicted by [Sapo FAQ part 2](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2)
- Retail petrol: from 01/6/2025 invoices must be issued per sale instead of the earlier periodic summary. — [xcyber](https://xcyber.vn/quy-dinh-xuat-hoa-don-dien-tu-tung-lan-ban-hang-doi-voi-doanh-nghiep-kinh-doanh-ban-le-xang-dau/)
- A 2026 draft amending ND 123/ND 70 would let certain sectors (banking, securities, public transport) issue end-of-day or end-of-month summary invoices. It is a draft only. — [VnBusiness](https://vnbusiness.vn/tag/nghi-dinh-702025)
- Buyer information:
  - Enterprise buyers need full name, address and tax code.
  - Non-business individuals: details are optional unless the buyer asks.
  - Individuals doing business who buy for business use must be shown with name, address and personal tax code or personal identification number (mã số định danh cá nhân).
  - Source: Art 10 ND 123 as amended. — [Sapo FAQ part 2](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2)
- Công văn 2921/ĐTTNG-QLDN (Thái Nguyên tax office, 21/5/2025): after 01/6/2025 sellers may no longer write "khách lẻ không lấy hóa đơn" when the buyer has a business registration; full details are required. — [Kế toán Lê Ánh](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/cong-van-2921dttng-qldn-huong-dan-nnt-lap-hoa-don-dien-tu-theo-quy-dinh-tai-nghi-dinh-702025nd-cp.html)
- Paper conversion of e-invoices is for bookkeeping only and cannot be used for transactions, except cash-register invoices. — [MISA AMIS](https://amis.misa.vn/?p=210443)

### Inferences
- The safest design for the app is one invoice per retail transaction (POS), with optional buyer fields. Don't build a "gộp cuối ngày" feature for ordinary retail without confirming the legal basis. If a summary mode is offered, restrict it to the sectors explicitly listed in Art 9(4).
- The POS should collect a tax code or mã định danh (CCCD number, now used as the personal tax code) when the buyer is a business household or requests an invoice.

### Gaps
- Exact text of Art 9 on end-of-day summaries for retail chains after ND 70 not retrieved, so the conflict is unresolved.
- Did not verify how the 2026 changes for household businesses interact with the 1-billion threshold. Those changes include abolition of lump-sum tax (thuế khoán) and the new Tax Administration Law.

## 8. Internal transfers between warehouses; goods sent to agents

### Takeaway
No VAT invoice is needed for internal transfers. Goods moved between the company's own warehouses, or to dependent branches in another province, travel under a phiếu xuất kho kiêm vận chuyển nội bộ. Goods sent to agents travel under a phiếu xuất kho gửi bán hàng đại lý. Internal consumption to continue production is excluded from the invoicing requirement.

### Cited Findings
- The ND 310/2025 penalty structure treats "internal use" (tiêu dùng nội bộ) as an invoiceable category, along with promotions and loans of goods. Internal consumption outside continued production therefore requires an invoice. — [MISA AMIS – ND 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)
- "Agents: whether they must invoice and charge VAT" (topic article). — [thue.man.net.vn](https://thue.man.net.vn/dai-ly-co-phai-xuat-hoa-don-va-tinh-thue-gtgt/)

### Inferences
Prior knowledge, not re-verified:
- PXKKVCNB and the agent delivery note are "chứng từ" under ND 123 and TT 78, now TT 32. They can be electronic and must accompany goods in transit. A transfer to a branch in another province that sells the goods: the head office uses PXKKVCNB, and the branch invoices the end customer. When the head office invoices the branch for sale (separate tax registration), a VAT invoice is used.
- Agents selling at the principal's price for commission: the principal invoices the agent (or the end buyer) when the agent reports sales, and the agent invoices the commission to the principal.

### Gaps
- Primary text of TT 32 on these documents not retrieved.

## 9. Purchases from individuals/households without invoices; input cost deductibility

### Takeaway
From the new CIT regime (ND 320/2025, TT 20/2026), costs without invoices are deductible only in listed cases, documented with purchase list Form 02/TNDN, which replaces 01/TNDN. Purchases of 5m VND or more per seller per day must be paid without cash. No input VAT is deductible because there is no VAT invoice.

### Cited Findings
- Form 02/TNDN is issued with Thông tư 20/2026/TT-BTC, guiding the CIT Law and ND 320/2025. Its basis is Art 9(1)(b) ND 320/2025. It replaces 01/TNDN of TT 78/2014. — [MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)
- Allowed cases:
  - agricultural, forestry and aquatic products bought directly from producers or harvesters;
  - handicrafts sold directly by the artisan;
  - scrap bought from the people who collect it;
  - household or personal property sold directly;
  - goods or services from individuals or households with revenue under 1 billion VND per year.
  — [MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)
- Non-cash condition: 5m VND or more per seller on the same day. The effective date is reported as 15/12/2025 by one source and 01/10/2025 by others, so it is unresolved. — [search summary; einvoice.vn](https://einvoice.vn/tin-tuc/mua-hang-khong-co-hoa-don); [meInvoice](https://www.meinvoice.vn/?p=51891)
- General principle (Art 9(1)(b) ND 320/2025): expenses need proper invoices or documents. The bảng kê is only for specified goods, services and sellers. — [thuvienphapluat Q&A](https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/khong-co-hoa-don-van-duoc-tinh-tru-chi-phi-hop-ly-khi-tinh-thue-tndn-dung-khong-986525-217029.html)
- The form is signed by the preparer and by the legal representative or an authorised person. It records the date, seller name, address, ID number, goods, quantity, unit price and total. — [MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)

### Inferences
- The purchase module should offer a "purchase without invoice" mode that generates Form 02/TNDN with the seller's CCCD/ID. It should enforce the allowed category, and warn when cash payment to one seller on one day reaches 5m VND or more. It should set input VAT to 0 or non-deductible.
- Because household businesses with revenue of 1 billion or more must issue cash-register invoices, the app should prompt the buyer to demand an invoice from such sellers.

### Gaps
- Exact effective date of the non-cash condition, and whether TT 20/2026 changed the 1-billion household threshold, are unconfirmed.

## 10. Reference implementations (MISA SME/AMIS, KiotViet, Sapo) and common accountant mistakes

### Takeaway
MISA (AMIS, meInvoice, eShop) and Sapo publish detailed ND 70 guides, which show that they implement adjustment invoices with list 01/BK-ĐCTT, cash-register invoices, export invoices and bảng kê 02/TNDN. No KiotViet documentation was retrieved. Frequent errors include not invoicing free goods, using "khách lẻ không lấy hóa đơn" for business buyers, cancelling invoices, end-of-day summarising, and invoicing exports late.

### Cited Findings
- MISA SME supports Form 02/TNDN with automatic aggregation and reconciliation (vendor claim). — [MISA SME](https://sme.misa.vn/349797/bang-ke-02-tndn/)
- MISA AMIS guide on issuing adjustment-down invoices under ND 70. — [MISA AMIS](https://amis.misa.vn/?p=52028)
- MISA eShop and meInvoice guides on cash-register invoices under ND 70. — [MISA eShop](https://www.misaeshop.vn/?p=30139)
- Common mistakes surfaced in sources:
  - writing "khách lẻ không lấy hóa đơn" for buyers with a business registration ([Kế toán Lê Ánh, CV 2921](https://ketoanleanh.edu.vn/kinh-nghiem-ke-toan/cong-van-2921dttng-qldn-huong-dan-nnt-lap-hoa-don-dien-tu-theo-quy-dinh-tai-nghi-dinh-702025nd-cp.html));
  - not invoicing promotional goods because the price is 0 ([meInvoice](https://www.meinvoice.vn/?p=38685));
  - summarising cash-register sales into one daily invoice ([Sapo](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-2));
  - cancelling wrong invoices, no longer allowed ([Sapo](https://www.sapo.vn/blog/dieu-kien-va-thu-tuc-huy-hoa-don-dien-tu));
  - signing late versus the invoice date ([Sapo FAQ part 1](https://www.sapo.vn/blog/giai-dap-chi-tiet-nd70-2025-nd-cp-phan-1)).

### Inferences
Software guardrails to build:
- Invoice-date checks: delivery date for goods, completion or collection date for services, clearance + 1 working day for exports.
- Block the cancellation workflow; offer only adjustment or replacement.
- Require a tax code when the customer is flagged as an organisation or business household.
- Auto-generate 0-value promotional lines with the standard note.
- Return voucher forces an adjustment invoice linked to the original.
- Period-end discount wizard with an invoice list.
- PXKKVCNB for warehouse transfers (never a VAT invoice).
- Bảng kê 02/TNDN for invoice-less purchases, with cash-payment warnings.
- A one-to-many link from sales orders to invoices for partial shipments.

### Gaps
- KiotViet help-centre content was not searched or retrieved (tool budget); no evidence on its handling.

## 11. Penalty exposure

### Takeaway
From 16/01/2026, ND 310/2025 amends ND 125/2020 so that invoice penalties scale with the number of invoices. For ordinary sales: wrong timing runs from 0.5–1.5m VND (1 invoice) to 50–70m VND (100+ invoices), and not invoicing runs up to 60–80m VND. Promotional, gift and internal-use flows have a lighter table starting with a warning.

### Cited Findings
- ND 310/2025 was issued 02/12/2025 and takes effect 16/01/2026. It amends Art 24 ND 125 (wrong invoice timing) and moves to tiered fines by invoice count. — [Đại biểu Nhân dân](https://daibieunhandan.vn/lap-hoa-don-khong-dung-thoi-diem-bi-phat-toi-70-trieu-dong-10399490.html); [LSVN](https://lsvn.vn/khong-lap-hoa-don-co-the-bi-phat-toi-80-trieu-dong-a166819.html)
- **Ordinary sales:**

  | Invoices | Wrong time | Not issued |
  |---|---|---|
  | 1 | 0.5–1.5m | 1–2m |
  | 2–<10 | 2–5m | 2–10m |
  | 10–<20 | 5–15m | 10–30m |
  | 20–<50 | 15–30m | 30–50m |
  | 50–<100 | 30–50m | 60–80m |
  | 100+ | 50–70m | 60–80m |

  — [MISA AMIS – ND 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)
- **Promotion, gift, sample, internal use, loans/returns of goods:**

  | Invoices | Wrong time | Not issued |
  |---|---|---|
  | 1 | warning | warning |
  | 2–<10 | 0.5–1.5m | 1–2m |
  | 10–<50 | 2–5m | 2–10m |
  | 50–<100 | 5–15m | 10–30m |
  | 100+ | 15–30m | 30–50m |

  — [MISA AMIS – ND 310](https://amis.misa.vn/256903/nghi-dinh-310-2025-nd-cp-ve-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don/)
- Violations that ended before 16/01/2026 use the old rules. Ongoing violations discovered after that date use ND 310. — [LSVN](https://lsvn.vn/ap-dung-quy-dinh-moi-khi-xu-phat-vi-pham-hanh-chinh-ve-thue-hoa-don-a168400.html)

### Inferences
- Wrong timing is penalised per invoice count, so systematic late invoicing (e.g. invoicing at month end for goods delivered earlier) quickly reaches the 50–70m tier. This is the strongest argument for the app to auto-create invoices from delivery notes.

### Gaps
- Penalty rules for wrong invoice content, and for failing to transmit cash-register data, were not retrieved. Exact ND 310 article numbers for the tables were not confirmed.
