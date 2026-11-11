# Vietnamese e-invoice providers and their integration APIs (as of November 2026)

Research date: 2026-11-11. About 25 search/fetch calls. Many provider API specs are only given to customers or partners, so a lot of the per-provider technical detail could NOT be checked against public primary documentation. Those items are marked as gaps rather than filled in from memory.

## Which providers are licensed and widely used? Approximate market share

### Takeaway
The big names are Viettel (S-Invoice), VNPT (VNPT Invoice), MISA (meInvoice), BKAV (eHoadon), Softdreams (EasyInvoice), M-Invoice, Thái Sơn, FPT, CyberLotus and MobiFone. Sales/POS platforms (KiotViet, Sapo, Haravan, iPOS) now also show up as registered e-invoice solution providers for household businesses. I found no credible public market-share figures for 2025–2026. Every "#1" claim found was vendor marketing.

### Cited Findings
- The Tax Department published a list of 39 entries (38 distinct organisations, because M-invoice appears twice). They are technology providers supporting household businesses with e-invoices, sorted by registration date up to 25/3/2026. The list includes KiotViet, MISA, Fast, Sapo, MobiFone, TS24, Vi Na, Bkav, M-invoice, Viettel, Haravan, VNPT VinaPhone, T-VAN HILO, iPOS.VN, Thái Sơn, NACENCOMM, Softdreams, FPT IS, CyberLotus, Mắt Bão, BIDV, A3, SFIN and others. The article says the list is an introduction, not an endorsement. Article dated 02/04/2026. — [Tạp chí Kinh tế Tài chính / Thuế Hải quan](https://thuehaiquan.tapchikinhtetaichinh.vn/cong-bo-39-ong-lon-cong-nghe-tiep-suc-ho-kinh-doanh-trien-khai-hoa-don-dien-tu-152563.html)
- A MISA article says 102 e-invoice software providers have been verified by the General Department of Taxation. This comes from a vendor blog, and the count's date is unclear. — [meinvoice.vn](https://www.meinvoice.vn/?p=22115)
- A MISA help page (updated Oct 2025) lists VNPT, Viettel, BKAV, Softdreams, Thái Sơn and EasyInvoice as issuers whose invoices MISA can import. This is a sign of which providers are common in practice. — [helpact.misa.vn](https://helpact.misa.vn/?p=1735)
- Meeting of 17 June 2025 (article dated 19/06/2025): about 20 cash-register and e-invoice providers plus 2 banks attended. Viettel, VNPT and MobiFone committed to prices under 50 VND/invoice for household businesses. M-invoice and Fast committed to 30 VND/invoice. MISA, Softdreams and Sapo said they would study preferential packages. 16,395 households in Tax Sub-Department II had registered for cash-register e-invoices under Decree 70/2025. — [VCCI](https://www.vcci.com.vn/tin-tuc/nha-cung-cap-dich-vu-cam-ket-giam-gia-hoa-don-dien-tu-cho-ho-kinh-doanh)
- MISA markets meInvoice as "#1 Phần mềm Hóa đơn điện tử". This is a marketing claim, not verified. — [meinvoice.vn](https://www.meinvoice.vn/.)
- VNPT has been approved as a provider for receiving, transmitting and storing e-invoice data (T-VAN role). — [vnba.org.vn](https://vnba.org.vn/vi/vnpt-se-la-nha-cung-cap-dich-vu-nhan--truyen--luu-tru-du-lieu-hoa-don-dien-tu-2909.htm)
- Regulatory context: Decree 254/2026/NĐ-CP and Circular 91/2026/TT-BTC took effect on 01/7/2026. Changes include a new registration form 01/ĐKTĐ-HĐĐT, a new option for POS-generated invoices without a tax-authority code, and four data-transmission methods (adding 01/TH-DT and 01/TTGD). This summary comes from a provider blog (xCyber, 03/11/2026), not the decree text. — [xCyber](https://xcyber.vn/?p=15766)
- In April 2026 the Ministry of Justice published appraisal documents for a draft decree replacing Decree 123/2020 and Decree 70/2025. — [meinvoice.vn](https://www.meinvoice.vn/?p=45641)

### Inferences
- In practice, an SME app in Vietnam should expect customers to already have a contract with one of about 5–8 providers: Viettel, VNPT, MISA, BKAV, Softdreams/EasyInvoice, M-Invoice, Thái Sơn, FPT or MobiFone. A multi-provider connector is the norm (see the existing-apps section).
- The 1/7/2026 regulatory change (Decree 254/2026) probably forces API changes at providers. Any API doc dated before mid-2026 should be treated as possibly outdated.

### Gaps
- No independent 2025–2026 market-share data was found, from the GDT, an industry association or analysts. Vendor "#1" claims (MISA, and in my training knowledge Viettel and VNPT too) cannot be checked.
- I did not check the official GDT list of licensed T-VAN / e-invoice solution providers directly.
- I did not read the text of Decree 254/2026 itself. Whether it removes "cancel" (hủy) for issued invoices could not be confirmed from primary text. See the Odoo/Viindoo finding below, which suggests it does.

## Public APIs per major provider: docs, auth, sandbox, operations, webhooks, rate limits, signing

### Takeaway
Only MISA meInvoice has a public developer-documentation site (doc.meinvoice.vn), and a community SDK confirms its REST endpoints. Viettel S-Invoice uses a REST/JSON "webservice" spec (V2.0, last dated 11/2024) that circulates as a PDF, not on an official portal. VNPT, BKAV, EasyInvoice, M-Invoice, FPT, CyberLotus and Thái Sơn have no public API docs that I could find. Their specs are given out by account managers. Server-side or remote signing is normal for API issuance. USB-token signing exists mainly for desktop clients.

### Cited Findings
**MISA meInvoice**
- MISA has a developer doc site, doc.meinvoice.vn. It describes "tích hợp sâu" (deep integration: call the API or use the MISA SDK) and "tích hợp nhanh" (quick integration: push data through the webapp or desktop). The production app is app.meinvoice.vn. The /about page returned 404 when fetched on 2026-11-11, so the site layout may have changed. — [doc.meinvoice.vn (search snippet)](https://doc.meinvoice.vn/about)
- MISA says the API is RESTful plus ESB, uses JSON, and can be integrated in about 2 days. The "2 days" figure is marketing. — [meinvoice.vn](https://www.meinvoice.vn/?p=44747)
- Community .NET SDK "MisaConnect.EInvoice" (owner ChuKhaLi; v2.10.0, updated 07/11/2026):
  - Sandbox base URL: `https://testapi.meinvoice.vn/api/integration`. Production: `https://api.meinvoice.vn/api/integration`.
  - Credentials are TaxCode, UserName, Password and AppId. The SDK sends `<TaxCode>-<AppId>`, gets an access token and uses it as a Bearer token.
  - Operations: list active templates, preview PDF, save draft invoices, get draft PDF by RefId, delete draft, lookup by RefIds, paginated lookups, issue replacement invoice, issue adjustment invoice.
  - This is community code, not an official MISA product. — [NuGet](https://www.nuget.org/packages/MisaConnect.EInvoice)
- MISA says it connects meInvoice for free with KiotViet, CukCuk, iPOS, Sapo and others. — [meinvoice.vn](https://www.meinvoice.vn/meInvoice/html/home-page-new.html)
- MISA said it waives integration fees for more than 50 software products. This is a 2020 article, so it is outdated. — [meinvoice.vn, 27/08/2020](https://www.meinvoice.vn/tin-tuc/9621/misa-mien-phi-tich-hop-hoa-don-dien-tu/)

**Viettel S-Invoice (SInvoice)**
- A "Tài liệu mô tả webservice hóa đơn điện tử V2.0 Sinvoice" is circulating as a Google Docs PDF. It is dated Hà Nội 11/2024, its change log runs to revision 2.40, and it has error-code and invoice-lookup sections. It is not hosted on a Viettel domain, and I could not fetch the full PDF (HTTP 400 on the redirect). — [Google Docs (search snippet)](https://docs.google.com/document/d/1pnLbebmPQBmIuEo0iOhbXgrISllt_i2K/export?format=pdf)
- Base URLs from Viindoo's guide: S-Invoice v1 test `https://demo-sinvoice.viettel.vn:8443/`. S-Invoice v2 `https://api-vinvoice.viettel.vn/services/einvoiceapplication/api/`. Viettel gives each enterprise its own URL. Test tax code is 0106026495-999. Authentication is a username and password from the provider. Signing uses a server signature "already integrated into the e-invoice account", so the client does no signing step. The cancel flow takes a reference, a cancellation date and an optional cancellation-minutes PDF. Error notices to the tax authority (form 04/SS) must be sent from the S-Invoice portal. — [Viindoo docs v15](https://viindoo.com/documentation/15.0/applications/finance/accounting-and-invoicing/fiscal-localizations/issue-e-invoice-by-integrating-viindoo-with-viettel-s-s-invoice-service.html)
- An Odoo community module lists a production server `API-sinvoice.viettel.vn:443` plus a demo server. — [Odoo Apps viettel_s_invoice (search snippet)](https://apps.odoo.com/apps/modules/13.0/viettel_s_invoice)

**VNPT Invoice**
- No public API documentation was found. Third-party connectors exist: an Odoo 18 module (james_vnpt_invoice_integration) pushes invoices under Circular 78 and handles VNPT error codes, and there is an Odoo 16 module biz_einvoice_vnpt. VNPT Invoice runs as SaaS or on-premise, which changes the endpoint host. — [Odoo Apps](https://apps.odoo.com/apps/modules/18.0/james_vnpt_invoice_integration); [Odoo Apps biz_einvoice_vnpt](https://apps.odoo.com/apps/modules/16.0/biz_einvoice_vnpt)
- VNPT runs a partner portal for SmartCA (remote signing, CA) with a sales-integration document (TL_tich_hop_ban_hang_SmartCA_v1.0). This points to remote signing as the VNPT signing route. — [doitac-smartca.vnpt.vn](https://doitac-smartca.vnpt.vn/help/document/TL_tich_hop_ban_hang_SmartCA_v1.0.pdf)

**BKAV eHoadon, Softdreams EasyInvoice, M-Invoice, FPT, CyberLotus, Thái Sơn**
- BKAV's public site only has user guides, no API docs. — [bkav.com/ehoadon](https://www.bkav.com/ehoadon/huong-dan/-/chi-tiet-huong-dan/404/huong-dan-ket-xuat-excel-du-lieu-hoa-on-tren-nen-tang-bkav-ehoadon)
- EasyInvoice is made by Softdreams. Its official domain is easyinvoice.vn. Public material only makes generic "connects with other software" claims. — [fptshop.com.vn](https://fptshop.com.vn/tin-tuc/thu-thuat/tra-cuu-hoa-don-easyinvoice-175679); [ketoanthuanthien.vn](https://ketoanthuanthien.vn/dich-vu/hoa-don-dien-tu/)
- xCyber links to "Điều khoản sử dụng API" (API terms of use) but shows no API reference publicly. — [xCyber](https://xcyber.vn/?p=15766)

**Aggregators (one API in front of several providers). Worth considering instead of direct integration.**
- **SePay eInvoice API**:
  - REST. Production `https://einvoice-api.sepay.vn`, sandbox `https://einvoice-api-sandbox.sepay.vn`.
  - Authentication: `POST v1/token`, then a Bearer token.
  - Create and issue are asynchronous. Each returns a `tracking_code`, which you poll at `GET v1/invoices/create/check/{code}` or `GET v1/invoices/issue/check/{code}`.
  - Adjustment and replacement endpoints also return tracking codes.
  - Download: `GET v1/invoices/{tracking_code}/download?type=pdf|xml` returns base64.
  - Other endpoints: `GET v1/usage` (quota), provider-accounts listing, email logs.
  - No cancel endpoint and no webhooks are documented. Underlying providers are not named on the pages read. — [SePay overview](https://developer.sepay.vn/en/einvoice-api/tong-quan); [SePay download](https://developer.sepay.vn/en/einvoice-api/tai-hoa-don)
- **Tingee e-invoice API**:
  - Providers mentioned: SInvoice, BKAV, XCyber, HiLo, MISA.
  - Authentication uses the headers `x-client-id`, `x-signature` (HMAC-SHA512 over timestamp:body) and `x-request-timestamp` (yyyyMMddHHmmssSSS, UTC+7).
  - Operations: create draft (returns base64 PDF), create-and-issue, download, templates, send email, incoming invoices, provider-account CRUD.
  - Line fields include `discount` (%) and `discountAmount`, plus `totalDiscount`, `currency` (default VND), `exchangeRate` and `taxRateCode` (0/5/8/10/-1 KCT/-2 KKKNT). A partner-generated unique `invoiceCode` acts as the idempotency key.
  - A sandbox exists. No e-invoice webhook is documented. — [Tingee docs](http://developers.tingee.vn/docs/hoa-don-dien-tu/create/)

### Inferences
- Signing: for API-driven issuance, every documented flow (Viettel through Viindoo, the SePay and Tingee aggregators) has the provider sign server-side (HSM, or a CA's remote signing like VNPT SmartCA). A web app should require customers to buy an HSM or remote-signing certificate and avoid USB-token plug-in flows.
- Webhooks look rare. Async status (MCCQT issuance) is handled by polling in the documented APIs (SePay tracking_code). Plan a polling job.
- A partner-supplied unique key exists in most APIs: MISA RefId (from the SDK operations), Tingee invoiceCode, and in Viettel's case transactionUuid (method name in the npm wrapper). Use the sales-order ID or a UUID per attempt as that key.

### Gaps
- I could not read the full Viettel V2.0 PDF. Exact endpoint paths, the auth scheme (Basic Auth vs token), whether transactionUuid is idempotent, rate limits and timeouts are unverified. From training knowledge (unverified this session), Viettel uses paths like `/InvoiceAPI/InvoiceWS/createInvoice/{supplierTaxCode}` with HTTP Basic auth and a `transactionUuid` field for duplicate prevention. Confirm against the official spec.
- VNPT: from training knowledge (unverified), it is a SOAP/ASMX web service (PublishService/BusinessService/PortalService) with methods like ImportAndPublishInv and an `Fkey` per invoice for idempotency. No public source was found this session.
- BKAV: from training knowledge (unverified), it is a single "ExecCommand"-style endpoint with CmdType codes and a PartnerGUID/token. No public source was found.
- EasyInvoice, M-Invoice, FPT eInvoice, CyberLotus, Thái Sơn, MobiFone: no public API docs were found. All require contacting sales.
- I found no published rate limits for any provider.
- The full MISA meInvoice endpoint list (paths for publish, cancel, email to buyer, SignType options) was not readable because doc.meinvoice.vn/about returned 404.

## Pricing models and partner/ISV programmes

### Takeaway
Pricing is per-invoice packages plus, sometimes, setup or annual fees. Household-business pricing collapsed to under 50 VND/invoice in 2025 under government pressure. API access is usually bundled free with the invoice subscription, but I found no current public price list that confirms this.

### Cited Findings
- Viettel, VNPT and MobiFone committed to under 50 VND per invoice for household businesses. M-invoice and Fast committed to 30 VND. Households had been paying about 200–400 VND per invoice on average (June 2025). — [VCCI](https://www.vcci.com.vn/tin-tuc/nha-cung-cap-dich-vu-cam-ket-giam-gia-hoa-don-dien-tu-cho-ho-kinh-doanh)
- KiotViet offers its customers free e-invoices and digital signatures, and says the service is free for household businesses under Decree 70/2025. — [VCCI](https://www.vcci.com.vn/tin-tuc/kiotviet-dong-hanh-cung-ho-kinh-doanh-giam-chi-phi-su-dung-may-tinh-tien)
- MISA (2020): free integration for more than 50 partner software products, plus a free annual fee and 10-year storage promotions. This is outdated. — [meinvoice.vn](https://www.meinvoice.vn/tin-tuc/9621/misa-mien-phi-tich-hop-hoa-don-dien-tu/)
- MISA's service agreement MEI22 v2.0 is dated 25/08/2022. — [meinvoice.vn PDF](https://MeInvoice.vn/meInvoice/documents/MEI22_DK_TT_VN_V2.0_Thoa thuan su dung dich vu MeInvoice_25082022.pdf)
- SePay exposes `GET v1/usage` (remaining quota), which shows a prepaid quota model. Prices are not published on the pages read. — [SePay](https://developer.sepay.vn/en/einvoice-api/tong-quan)

### Inferences
- For an ISV, the customer usually pays the provider for the invoice package, and the ISV integrates for free or under a partner agreement. Aggregators (SePay, Tingee) may charge the ISV directly.

### Gaps
- I found no current 2026 enterprise price lists (per-invoice packages, setup fees) from the provider sites. No formal ISV/partner programme terms were found for any provider.

## How existing apps integrate (KiotViet, Sapo, Haravan, MISA AMIS, Odoo, Base.vn)

### Takeaway
Big POS/retail platforms (KiotViet, Sapo, Haravan, iPOS) both partner with providers (MISA connects with them) and have registered as e-invoice providers themselves for household businesses. Odoo/Viindoo shows the reference pattern: one provider-neutral base module (`l10n_vn_viin_edi`) with a normalised status model and per-provider adapter modules.

### Cited Findings
- MISA meInvoice is connected with KiotViet, CukCuk, iPOS, Sapo and others. — [meinvoice.vn](https://www.meinvoice.vn/meInvoice/html/home-page-new.html)
- KiotViet, Sapo, Haravan and iPOS.VN are on the Tax Department's 2026 list of providers supporting household e-invoices. — [Thuế Hải quan](https://thuehaiquan.tapchikinhtetaichinh.vn/cong-bo-39-ong-lon-cong-nghe-tiep-suc-ho-kinh-doanh-trien-khai-hoa-don-dien-tu-152563.html)
- Viindoo (Odoo 18) base module `l10n_vn_viin_edi` (changelog to 2026-07-05, page updated 2026-09-11). Adapters exist for Viettel S-Invoice (`l10n_vn_viin_accounting_sinvoice`), VN-Invoice (`..._vninvoice`) and MISA meInvoice (`..._meinvoice`). The base module provides:
  - provider-neutral settings
  - a normalised status (to issue / issued / adjusted / replaced / cancelled / error)
  - decreasing adjustments as credit notes for all providers (increasing adjustments in Odoo only for S-Invoice)
  - replacement for all providers, with the required reference text
  - **cancelling issued invoices blocked from a configurable date, default 01/07/2026**, with users directed to adjust or replace instead. — [Viindoo app store](https://viindoo.com/vi/apps/app/18.0/l10n_vn_viin_edi)
- Viindoo S-Invoice notes: item name and description are merged into one line, item names have a character limit, and cancellation is a two-step process (cancel on the provider, then reset in the ERP). — [Viindoo docs](https://viindoo.com/documentation/15.0/applications/finance/accounting-and-invoicing/fiscal-localizations/issue-e-invoice-by-integrating-viindoo-with-viettel-s-s-invoice-service.html)
- Other Odoo community modules: viettel_s_invoice (Odoo 12/13), biz_einvoice_vnpt (16) and james_vnpt_invoice_integration (18). — [Odoo Apps](https://apps.odoo.com/apps/modules/13.0/viettel_s_invoice); [Odoo Apps](https://apps.odoo.com/apps/modules/18.0/james_vnpt_invoice_integration)
- Aggregator APIs (SePay, Tingee) hide multiple providers behind one API. Provider accounts are configured per tenant. — [Tingee](http://developers.tingee.vn/docs/hoa-don-dien-tu/create/); [SePay](https://developer.sepay.vn/en/einvoice-api/tong-quan)

### Inferences
- Recommended pattern for the NestJS app:
  - an `EInvoiceProvider` interface (createDraft, issue, adjust, replace, getStatus, getPdf/getXml, sendEmail, listTemplates)
  - per-tenant provider config (templates/series stored locally)
  - a normalised status enum like Viindoo's
  - an outbox/job table keyed by a unique partner reference
- Since 01/07/2026, the "cancel" path should be disabled or hidden for issued invoices, and only adjust/replace offered. This is inferred from the Viindoo default and the Decree 254 effective date. Confirm against the decree text.
- An aggregator (SePay or Tingee) is a quick way to support several providers. The cost is a third-party dependency and fewer provider-specific features.

### Gaps
- I did not check Sapo, Haravan, MISA AMIS or Base.vn help centres for their exact supported-provider lists or integration method. KiotViet's list of supported external providers was also not checked.

## Practical pitfalls (idempotency, duplicates, timeouts, signing delays, discount/FX mapping, MCCQT delay)

### Takeaway
The documented APIs point to three needs: async issuance with polling (SePay tracking codes), a partner unique key to prevent duplicate invoices, and careful line mapping (discount % vs amount, tax-rate codes including KCT/KKKNT, currency plus exchange rate, name length limits). I found no developer forum write-ups (viblo/tinhte) with first-hand incident reports.

### Cited Findings
- SePay create and issue are async. You must poll the check endpoints before the next step, and adjust/replace are tracked the same way. — [SePay](https://developer.sepay.vn/en/einvoice-api/tong-quan)
- Tingee's partner `invoiceCode` is a unique key. Discounts can be a percentage or an amount, and the system calculates them if omitted. Currency and exchange rate fields exist. Tax-rate codes include -1 (KCT) and -2 (KKKNT). `itemType` values depend on the provider. — [Tingee](http://developers.tingee.vn/docs/hoa-don-dien-tu/create/)
- Viettel via Viindoo: item-name length limit, line-break handling settings, the serial must match the one registered with the tax authority, and error notices must be made on the provider portal. — [Viindoo docs](https://viindoo.com/documentation/15.0/applications/finance/accounting-and-invoicing/fiscal-localizations/issue-e-invoice-by-integrating-viindoo-with-viettel-s-s-invoice-service.html)
- Viindoo: increasing adjustments are not supported through the API for MISA and VN-Invoice in their module, only on the portal or a separate module. This shows feature gaps between providers. — [Viindoo](https://viindoo.com/vi/apps/app/18.0/l10n_vn_viin_edi)
- Registration responses to the tax authority under the new form typically take 1–2 working days. That is registration, not per-invoice. — [xCyber](https://xcyber.vn/?p=15766)

### Inferences
- Generate the partner key (RefId / transactionUuid / invoiceCode / Fkey) before calling and persist it. On a timeout, look the invoice up by that key before retrying, never blindly re-create it.
- Treat "issued and signed" and "MCCQT received" as separate states. Poll until the tax-authority code arrives, then fetch the final PDF/XML.
- Keep a per-provider capability matrix (for example, increasing adjustment supported or not).

### Gaps
- I found no measured MCCQT latency, signing-delay figures, rate limits or first-hand developer pitfall reports (viblo/tinhte/Facebook). Searches did not surface them in the call budget.

## Open-source libraries and SDKs

### Takeaway
The ecosystem is thin. There is one small unofficial npm wrapper for Viettel S-Invoice, a community .NET SDK for MISA meInvoice (actively updated in Nov 2026), and several Odoo (Python) modules. I found no official Node.js SDK from any provider and nothing for VNPT/BKAV on npm.

### Cited Findings
- npm `viettel-s-invoice`:
  - v1.0.10, MIT, unofficial, repo github.com/dev10katec/viettel-s-invoice.
  - The constructor takes username, password and apiEndPoint.
  - Methods: previewDraftInvoice, createInvoice, getInvoiceByTransactionUuid, getInvoicesByDateRange (DD/MM/YYYY), getInvoiceFile (PDF/ZIP), getInvoiceTemplates.
  - No adjust/replace/cancel. Release dates are not shown. — [unpkg README](https://app.unpkg.com/viettel-s-invoice@1.0.10/files/README.md); [pkgstats](https://pkgstats.com/pkg:viettel-s-invoice)
- NuGet `MisaConnect.EInvoice` (.NET, community, v2.10.0 updated 07/11/2026). Includes adjustment and replacement operations. Docs at chukhali.github.io/MisaConnect/einvoice, which redirects to chung-nd.id.vn. — [NuGet](https://www.nuget.org/packages/MisaConnect.EInvoice)
- Odoo/Viindoo modules (Python, readable reference implementations): `l10n_vn_viin_edi`, `l10n_vn_viin_accounting_sinvoice`, `l10n_vn_viin_accounting_meinvoice`, `l10n_vn_viin_accounting_vninvoice`, `viettel_s_invoice`, `biz_einvoice_vnpt`, `james_vnpt_invoice_integration`. — [Viindoo](https://viindoo.com/vi/apps/app/18.0/l10n_vn_viin_edi); [Odoo Apps](https://apps.odoo.com/apps/modules/18.0/james_vnpt_invoice_integration)
- `einvoice-sdk-nodejs` on npm is for Malaysia LHDN, not Vietnam. Do not confuse the two. — [npm](https://www.npmjs.com/package/einvoice-sdk-nodejs)

### Inferences
- A NestJS team will probably write its own provider adapters. The MisaConnect .NET SDK and the Viindoo/Odoo modules (where the source is available) are the best references for request shapes.

### Gaps
- I did not search GitHub for code directly (no GitHub tool available). There may be more repos (for example VNPT ASMX clients in C#/PHP) that were not found.
