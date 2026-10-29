# Kiến trúc kỹ thuật — Ninh Trang ERP

Sơ đồ cho người sửa mã: hệ thống gồm những khối nào, một yêu cầu đi qua những lớp nào, dữ liệu nằm ở đâu và các quy tắc lõi (tồn kho, giá vốn, công nợ, nhật ký) được giữ ở chỗ nào. Nghiệp vụ từng màn hình xem ở [`docs/atlas`](docs/atlas/src/ATL-00_Workflow-he-thong.md); cách chạy, biến môi trường và quy ước sửa mã xem ở [`README.md`](README.md).

## Mục lục

1. [Tổng thể hệ thống](#1-tổng-thể-hệ-thống)
2. [Đường đi của một yêu cầu API](#2-đường-đi-của-một-yêu-cầu-api)
3. [Backend: module và dịch vụ lõi](#3-backend-module-và-dịch-vụ-lõi)
4. [Frontend: lớp và luồng dữ liệu](#4-frontend-lớp-và-luồng-dữ-liệu)
5. [Mô hình dữ liệu](#5-mô-hình-dữ-liệu)
6. [Tồn kho và giá vốn](#6-tồn-kho-và-giá-vốn)
7. [Công nợ và quỹ tiền tính khi đọc](#7-công-nợ-và-quỹ-tiền-tính-khi-đọc)
8. [Vòng đời chứng từ chính](#8-vòng-đời-chứng-từ-chính)
9. [Nhiều doanh nghiệp](#9-nhiều-doanh-nghiệp)
10. [Build, CI, triển khai và sao lưu](#10-build-ci-triển-khai-và-sao-lưu)
11. [Bản đồ thư mục](#11-bản-đồ-thư-mục)

---

## 1. Tổng thể hệ thống

Một web service duy nhất trên Render: NestJS vừa phục vụ API dưới `/api`, vừa trả file tĩnh của Angular (mọi đường dẫn khác trả `index.html`). Dữ liệu ở PostgreSQL trên Neon; ở chế độ nhiều doanh nghiệp mỗi doanh nghiệp một database.

```mermaid
flowchart LR
  subgraph Client["Trình duyệt"]
    SPA["Angular 22 SPA<br/>signals · DataStore"]
  end

  subgraph Render["Render web service (Node 24)"]
    STATIC["Static: frontend/dist<br/>SPA fallback index.html"]
    API["NestJS 12 /api<br/>helmet · CSP · throttler"]
    PRISMA["Prisma 7 client<br/>(1 client mỗi doanh nghiệp)"]
  end

  subgraph Neon["Neon PostgreSQL (Singapore)"]
    DB1[("DATABASE_URL<br/>doanh nghiệp mặc định")]
    DBN[("nt_&lt;mã&gt;<br/>doanh nghiệp khác")]
    PDB[("platform<br/>danh sách DN, nhật ký")]
  end

  SENTRY["Sentry (tuỳ chọn)"]
  GHA["GitHub Actions<br/>CI · sao lưu hằng ngày"]

  SPA -- "HTTPS JSON<br/>Bearer JWT + X-Tenant" --> API
  SPA -. "tải 1 lần" .-> STATIC
  API --> PRISMA
  PRISMA --> DB1
  PRISMA --> DBN
  API --> PDB
  API -. lỗi .-> SENTRY
  SPA -. lỗi .-> SENTRY
  GHA -- "pg_dump mã hoá" --> Neon
```

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Giao diện | Angular 22, standalone components, signals, lazy routes | Font tự host (Be Vietnam Pro, JetBrains Mono); `design.md` là hệ thống thiết kế |
| API | NestJS 12 (Express), class-validator | Tiền tố `/api`; body JSON tối đa 10 MB |
| ORM | Prisma 7 | `PrismaService` là proxy chuyển mọi lời gọi tới client của doanh nghiệp đang xử lý |
| CSDL | PostgreSQL 17 (Neon) | 21 migration; cột tiền / số lượng là `Decimal`, ngày chứng từ là `@db.Date` |
| Kiểm thử | Vitest (unit + e2e trên Postgres thật), Playwright (`tools/qa`) | e2e chặn mọi lệnh ghi thiếu nhật ký |

---

## 2. Đường đi của một yêu cầu API

Mọi lệnh ghi đi qua cùng một chuỗi: xác định doanh nghiệp → xác thực → kiểm quyền → một giao dịch Prisma (khoá dòng, ghi kho, cấp mã, ghi nhật ký) → chuẩn hoá phản hồi.

```mermaid
sequenceDiagram
  autonumber
  participant B as Trình duyệt<br/>auth.interceptor
  participant M as Middleware<br/>requestId · helmet · TenantMiddleware
  participant G as Guards<br/>JwtAuthGuard · PermissionsGuard
  participant C as Controller<br/>ValidationPipe (DTO)
  participant S as Service
  participant T as prisma.$transaction
  participant I as Interceptors / Filter

  B->>M: POST /api/sales-orders/:id/deliver<br/>Authorization, X-Tenant
  M->>M: X-Request-Id, header bảo mật + CSP
  M->>M: X-Tenant → AsyncLocalStorage { code, PrismaClient }<br/>(DN tạm ngưng → 403 kèm tenant)
  M->>G: tiếp tục
  G->>G: JWT hợp lệ, tid khớp doanh nghiệp,<br/>user ACTIVE, role isActive
  G->>G: mustChangePassword → chỉ cho /auth/me, đổi mật khẩu
  G->>G: @RequirePermissions('order.update') có trong quyền của role (đọc DB mỗi yêu cầu)
  G->>C: hợp lệ
  C->>S: DTO đã whitelist + transform
  S->>T: mở giao dịch
  T->>T: SELECT … FOR UPDATE (đơn, khách, tồn)
  T->>T: documentDay() · assertOpenPeriod() (khoá sổ)
  T->>T: quy tắc nghiệp vụ (*.rules.ts)
  T->>T: InventoryService.post() → StockLevel, avgCost, unitCost
  T->>T: SequenceService.nextCode('PXK')
  T->>T: AuditService.log(tx, …)
  T-->>S: commit (hoặc rollback toàn bộ)
  S-->>C: kết quả
  C-->>I: DecimalInterceptor: Decimal → number
  I-->>I: AuditContextInterceptor: ghi 'api.unaudited' nếu lệnh ghi không log
  I-->>I: PrismaExceptionFilter: P2002/P2025/P2003 → 409/404/409 tiếng Việt
  I-->>B: JSON (+ X-Request-Id)
  Note over B: 401 → về /login rồi quay lại trang<br/>403 có tenant → báo doanh nghiệp tạm ngưng
```

**Điểm chặn quan trọng**

| Lớp | File | Việc |
|---|---|---|
| Request id | `backend/src/monitoring/request-id.ts` | Gắn `X-Request-Id`, ghi cùng mã vào nhật ký và log lỗi |
| Doanh nghiệp | `backend/src/platform/tenant.middleware.ts`, `tenant.context.ts` | So đường dẫn ở dạng chữ thường; đặt client Prisma vào `AsyncLocalStorage` |
| Xác thực | `backend/src/auth/jwt.strategy.ts`, `jwt-auth.guard.ts` | Token 12 giờ; từ chối token khác doanh nghiệp; buộc đổi mật khẩu |
| Thử đăng nhập | `backend/src/auth/login-throttle.ts` | Mặc định 30 lần / 5 phút / IP, 8 lần / 15 phút / IP + email |
| Phân quyền | `backend/src/auth/permissions.guard.ts` | `@RequirePermissions(...)` trên từng route |
| Phạm vi dữ liệu | `modules/sales/order-access.ts`, `common/purchase-prices.ts` | Người bán chỉ thấy đơn của mình; ẩn giá nhập / giá vốn theo quyền |
| Nhật ký | `backend/src/audit/` | `AuditService.log(tx)` cùng giao dịch; bảng `AuditLog` có trigger chặn UPDATE/DELETE/TRUNCATE |
| Lỗi | `common/prisma-exception.filter.ts`, `monitoring/error-report.interceptor.ts` | Thông báo tiếng Việt; gửi Sentry khi bật |

---

## 3. Backend: module và dịch vụ lõi

Các module nghiệp vụ không tự sửa tồn kho, tự cấp mã hay tự tính số dư: chúng gọi chung vài dịch vụ lõi. Mũi tên = "gọi tới".

```mermaid
flowchart TB
  subgraph Nghiepvu["modules/ — nghiệp vụ"]
    direction LR
    PUR["purchasing<br/>đơn nhập · nhận hàng · TLM · payables"]
    SAL["sales<br/>đơn bán · giao · trả hàng · LSX<br/>báo giá · nhắc nợ · receivables"]
    DEL["delivery<br/>chuyến · xuất kho · chốt giao · xe về"]
    CASH["cash<br/>phiếu thu chi · tài khoản · loại"]
    INV["inventory<br/>phiếu kho tay"]
    REP["reports<br/>dashboard · 21 báo cáo (defs/)"]
    CAT["danh mục<br/>products · customers · suppliers · vehicles<br/>pricing · tags · lookups · company · access"]
  end

  subgraph Core["Dịch vụ & quy tắc lõi"]
    direction LR
    INVS["InventoryService.post / reverse<br/>(duy nhất được sửa StockLevel)"]
    SEQ["SequenceService.nextCode"]
    AUD["AuditService.log(tx)"]
    LOCK["common/period-lock.ts<br/>documentDay · assertOpenPeriod"]
    DEBT["common/debt-rows.ts · settle.ts<br/>đợt công nợ · đối trừ FIFO"]
    BAL["cash/cash-balance.ts<br/>tồn quỹ tại ngày"]
    RULES["*.rules.ts<br/>(cùng quy tắc với frontend)"]
    PAGE["common/paging.ts<br/>phân trang máy chủ"]
    IMP["common/import.ts<br/>nhập Excel: savepoint + dryRun"]
  end

  PUR --> INVS & SEQ & AUD & LOCK & DEBT
  SAL --> INVS & SEQ & AUD & LOCK & DEBT & BAL & RULES
  DEL --> INVS & SEQ & AUD & LOCK & BAL
  CASH --> SEQ & AUD & LOCK & DEBT & BAL
  INV --> INVS & SEQ & AUD & LOCK
  REP --> DEBT & RULES
  CAT --> SEQ & AUD & IMP
  SAL & PUR & CASH & INV --> PAGE

  subgraph Infra["Hạ tầng"]
    direction LR
    PRS["PrismaService (proxy theo doanh nghiệp)"]
    PLAT["platform/ — doanh nghiệp, TOTP, mã hoá chuỗi kết nối"]
    AUTH["auth/ — JWT, guards, throttle"]
  end
  Core --> PRS
  Nghiepvu --> AUTH
```

| Module | Đường dẫn API chính | Ghi chú |
|---|---|---|
| `access` | `/users`, `/roles` | Người dùng, chức vụ, phiên |
| `products`, `pricing` | `/products`, `/product-costs`, `/price-lists`, `/promotions` | `avgCost` không bao giờ đi ra cùng hàng hoá |
| `customers`, `suppliers` | `/customers`, `/suppliers` (+ `/import`) | Nhập Excel chạy thử từng dòng |
| `inventory` | `/warehouse-vouchers` (+ `/page`, `/usage`) | Phiếu tay; phiếu sinh từ chứng từ khác chỉ huỷ ở gốc |
| `purchasing` | `/purchase-orders` (+ `/receive`, `/returns`), `/payables` | |
| `sales` | `/sales-orders` (+ `/deliver`, `/returns`, `/page`, `/issued-costs`), `/production-orders`, `/quotations`, `/debt-reminders`, `/receivables` | |
| `delivery` | `/delivery-trips` | Tải lên xe lưu theo dòng đơn (`DeliveryTripLoad`) |
| `cash` | `/cash-vouchers`, `/cash-accounts`, `/cash-categories` | Không lưu số dư |
| `reports` | `/dashboard`, `/reports/:slug` | Mỗi báo cáo một hàm trong `reports/defs` |
| `audit` | `/audit-logs`, `/audit-logs/entity/:type/:id` | Chỉ đọc |
| `platform` | `/platform/*` | Phiên riêng, không dùng được cho API doanh nghiệp |

---

## 4. Frontend: lớp và luồng dữ liệu

Sau đăng nhập, `CatalogLoader` nạp danh mục và chứng từ gần đây vào `DataStore` (signals); màn hình đọc từ store, danh sách lớn gọi trang máy chủ, chứng từ cũ đọc khi cần.

```mermaid
flowchart TB
  subgraph Routes["app.routes.ts (lazy)"]
    R1["authGuard"] --> R2["route-access.ts<br/>quyền → menu, Ctrl K, nút, route"]
    R3["unsavedChangesGuard"]
  end

  subgraph Features["features/* — màn hình"]
    F1["Danh sách<br/>(data-table, bộ lọc, Excel)"]
    F2["Chứng từ<br/>(*-voucher, dialogs)"]
    F3["*.rules.ts<br/>tính tiền, trạng thái, khuyến mãi"]
  end

  subgraph Core["core/"]
    STORE["DataStore<br/>signals danh mục + chứng từ"]
    LOADER["CatalogLoader<br/>nạp sau đăng nhập (?recentDays=90)"]
    ONDEM["on-demand.ts<br/>đọc theo id / chứng từ gốc"]
    APISVC["ApiService"]
    INTER["auth.interceptor<br/>Bearer + X-Tenant · 401/403"]
    SVC["Auth · Tenant · Debt · Cost · Theme ·<br/>Density · DisplayColors · CommandPalette"]
  end

  subgraph Shared["shared/"]
    SH["data-table · search-select · period-filter ·<br/>print (A4/A5/K80) · import · vietqr · audit tab"]
  end

  Routes --> Features
  F1 --> STORE
  F1 -- "trang máy chủ /page" --> APISVC
  F2 --> STORE & ONDEM & F3
  F2 -- "lưu / thao tác" --> APISVC
  LOADER --> APISVC --> INTER --> BE[("/api")]
  LOADER --> STORE
  ONDEM --> APISVC
  APISVC -- "đọc lại sau khi ghi" --> STORE
  Features --> Shared
  Features --> SVC
```

- **Quy tắc tính tiền chạy hai nơi:** `features/sales-orders/sales-order.rules.ts` và `backend/src/modules/sales/sales-order.rules.ts` giống nhau; `sales-order.parity.spec.ts` so kết quả trên 500 đơn ngẫu nhiên. Màn hình báo lỗi sớm, máy chủ quyết định.
- **Phân quyền giao diện** chỉ ẩn; máy chủ vẫn kiểm mọi lời gọi.
- **Còn tính trên phần đã nạp:** tìm nhanh Ctrl K, nút đơn trước / sau, giá nhập gần nhất khi lập đơn nhập.

---

## 5. Mô hình dữ liệu

49 bảng. Sơ đồ dưới giữ các bảng chứng từ và quan hệ chính (bỏ bảng phụ như ảnh, thẻ, địa chỉ).

```mermaid
erDiagram
  Role ||--o{ User : "giữ"
  Role ||--o{ RolePermission : ""
  Permission ||--o{ RolePermission : ""

  ProductCategory ||--o{ Product : ""
  Product ||--o{ UnitConversion : "ĐVT quy đổi"
  Product ||--o{ BomLine : "định mức"
  Product ||--o{ StockLevel : ""
  Warehouse ||--o{ StockLevel : "tồn theo kho"

  Supplier ||--o{ SupplierProduct : "danh mục NCC"
  Supplier ||--o{ PurchaseOrder : ""
  PurchaseOrder ||--o{ PurchaseOrderLine : ""
  PurchaseOrder ||--o{ PurchaseOrderReceipt : "mỗi lần nhận = 1 khoản nợ"
  PurchaseOrder ||--o{ PurchaseReturn : "TLM"

  PriceList ||--o{ PriceListItem : ""
  PriceList ||--o{ Customer : "gán"
  Customer ||--o{ Quotation : ""
  Quotation ||--o{ QuotationLine : ""
  Quotation |o--o| SalesOrder : "lập đơn"
  Customer ||--o{ SalesOrder : ""
  SalesOrder ||--o{ SalesOrderLine : ""
  SalesOrder ||--o{ SalesOrderDelivery : "mỗi đợt = 1 khoản nợ"
  SalesOrderDelivery ||--o{ SalesOrderDeliveryLine : "số nhận từng dòng"
  SalesOrder ||--o{ SalesReturn : "TH"
  SalesOrder ||--o{ ProductionOrder : "LSX"
  Promotion ||--o{ SalesOrderLine : "áp"

  Vehicle ||--o{ DeliveryTrip : ""
  DeliveryTrip ||--o{ DeliveryTripOrder : ""
  DeliveryTrip ||--o{ DeliveryTripLoad : "xếp lên xe theo dòng"

  WarehouseVoucher ||--o{ WarehouseVoucherLine : "unitCost chốt"
  PurchaseOrder ||--o{ WarehouseVoucher : "PNK"
  SalesOrder ||--o{ WarehouseVoucher : "PXK / nhập trả về"
  ProductionOrder ||--o{ WarehouseVoucher : "xuất vật tư / nhập TP"
  DeliveryTrip ||--o{ WarehouseVoucher : "xuất chuyến / xe về"

  CashAccount ||--o{ CashVoucher : ""
  CashCategory ||--o{ CashVoucher : ""
  CashVoucher ||--o{ CashAllocation : "chọn tay"
  Customer ||--o{ CashVoucher : "PT"
  Supplier ||--o{ CashVoucher : "PC"
  SalesOrderDelivery |o--o{ CashVoucher : "thu tiền ngay"
  Customer ||--o{ DebtReminder : ""

  User ||--o{ AuditLog : "chỉ thêm"
```

**Quy ước dữ liệu**

| Quy ước | Ở đâu |
|---|---|
| Không xoá chứng từ: `isCancelled`; danh mục: `isActive = false` | mọi bảng chứng từ / danh mục |
| Mã chứng từ chỉ cấp qua `SequenceService.nextCode` (bảng `DocumentSequence`, nguyên tử, đồng bộ khi khởi động) | `backend/src/prisma/sequence.service.ts` |
| Không có cột số dư: công nợ, tồn quỹ, tổng tiền đơn đều suy ra | `common/settle.ts`, `debt-rows.ts`, `cash-balance.ts` |
| Khoá lạc quan khi sửa: gửi `updatedAt` đã đọc, khác thì 409 "vừa được người khác lưu" | đơn nhập, đơn bán, báo giá |
| Ngày chứng từ `@db.Date`, gửi `YYYY-MM-DD`, "hôm nay" theo `Asia/Ho_Chi_Minh` (`vnDay()`) | `common/text.ts` |

---

## 6. Tồn kho và giá vốn

Mọi thay đổi tồn đi qua `InventoryService.post(tx, …)` trong giao dịch của chứng từ gốc; huỷ đi qua `reverse`. Giá vốn là bình quân gia quyền di động trên toàn bộ kho, chốt vào từng dòng phiếu.

```mermaid
flowchart LR
  subgraph Goc["Chứng từ gốc (trong cùng giao dịch)"]
    A1["Nhận hàng mua"] --> P
    A2["Giao tại kho / xuất chuyến"] --> P
    A3["Bắt đầu / nghiệm thu LSX"] --> P
    A4["Xe về kho · trả hàng bán"] --> P
    A5["Trả lại hàng mua (TLM)"] --> P
    A6["Phiếu kho tay"] --> P
  end

  P["InventoryService.post(tx)"]
  P --> L1["documentDay · assertOpenPeriod"]
  P --> L2["SELECT … FOR UPDATE<br/>StockLevel + Product (avgCost)"]
  L2 --> D{"Loại dòng"}
  D -- "NHẬP" --> N1["avgCost = (tồn × avg + SL × giá nhập) ÷ (tồn + SL)<br/>giá nhập: unitCost gốc → unitPrice → avg"]
  D -- "XUẤT / CHUYỂN / KIỂM KÊ" --> N2["đi theo avgCost hiện tại"]
  D -- "NHẬP TRẢ VỀ" --> N3["vào lại đúng giá đã xuất"]
  D -- "TRẢ NCC" --> N4["ra theo giá mua; tính lại avg<br/>như chưa từng nhập"]
  N1 & N2 & N3 & N4 --> W["WarehouseVoucherLine.unitCost<br/>(giá vốn chốt)"]
  N1 & N2 & N3 & N4 --> S["StockLevel.quantity ±"]
  S --> NEG{"Tồn âm?"}
  NEG -- "allowNegativeStock = false<br/>và không có stock.overdraw" --> X["từ chối"]
  NEG -- "được phép" --> OK["lưu, giao diện cảnh báo"]
  W --> RPT["Lãi gộp · bán dưới giá vốn ·<br/>giá thành sản xuất · Tổng quan"]
```

- Thành phẩm nhập kho theo chi phí vật tư đã xuất của lệnh ÷ số làm được.
- `avgCost` và `unitCost` không bao giờ được gửi ra cùng hàng hoá hay phiếu kho; `GET /api/product-costs` chỉ trả cho người có `product.view_cost_price` / `stock.view_value`.

---

## 7. Công nợ và quỹ tiền tính khi đọc

Không bảng nào lưu số dư. Khi đọc, máy chủ dựng danh sách khoản nợ từ các đợt giao / nhận và trả hàng, rồi đối trừ bằng phiếu thu chi.

```mermaid
flowchart TB
  subgraph Phatsinh["Khoản phát sinh<br/>debt-rows.ts"]
    C1["SalesOrderDelivery<br/>DH0000012, DH0000012·2 …<br/>hạn = ngày nhận + creditDays"]
    C2["PurchaseOrderReceipt<br/>DN0000009·n"]
    C3["SalesReturn / PurchaseReturn<br/>phát sinh giảm vào ngày trả"]
  end
  subgraph Thanhtoan["Thanh toán"]
    V1["CashVoucher chưa huỷ"]
    V2["CashAllocation (chọn tay)<br/>theo mã đơn → các đợt, đợt đến hạn sớm trước"]
  end
  Phatsinh --> SET["settle.ts<br/>1. chọn tay trước<br/>2. phần còn lại: khoản đến hạn sớm nhất (FIFO)<br/>3. dư → trả trước"]
  Thanhtoan --> SET
  SET --> R1["ReceivablesService / PayablesService<br/>GET /receivables · /payables"]
  R1 --> U1["Sổ công nợ · tuổi nợ · nhắc nợ · Tổng quan · hạn mức"]

  subgraph Quy["Tồn quỹ<br/>cash-balance.ts"]
    Q1["openingBalance + thu − chi<br/>(phiếu chưa huỷ, đến ngày)"]
  end
  V1 --> Q1
  Q1 --> G{"Phiếu chi / huỷ phiếu thu /<br/>bỏ chốt có thu tiền ngay<br/>làm quỹ âm?"}
  G -- "không có voucher.overdraw" --> REJ["từ chối"]
```

Hạn mức công nợ được kiểm trong giao dịch lưu đơn, sau khi khoá dòng khách hàng, nên hai đơn lưu cùng lúc không cùng lọt.

---

## 8. Vòng đời chứng từ chính

Trạng thái đơn bán không lưu tay mà suy ra từ giao hàng và sản xuất (`sales-order.rules.ts`).

```mermaid
stateDiagram-v2
  direction LR
  state "Chờ sản xuất" as ChoSanXuat
  state "Đang sản xuất" as DangSanXuat
  state "Chờ giao hàng" as ChoGiaoHang
  state "Đang giao" as DangGiao
  state "Giao một phần" as GiaoMotPhan
  state "Hoàn thành" as HoanThanh
  state "Trả toàn bộ" as TraToanBo
  state "Đã huỷ" as Huy
  [*] --> ChoSanXuat: lưu đơn có thành phẩm chưa có lệnh
  [*] --> ChoGiaoHang: lưu đơn không cần sản xuất
  ChoSanXuat --> DangSanXuat: bắt đầu lệnh
  DangSanXuat --> ChoGiaoHang: mọi lệnh hoàn tất
  ChoGiaoHang --> DangGiao: xuất kho chuyến
  ChoGiaoHang --> HoanThanh: giao tại kho đủ
  ChoGiaoHang --> GiaoMotPhan: giao tại kho một phần
  DangGiao --> HoanThanh: chốt giao đủ
  DangGiao --> GiaoMotPhan: chốt giao một phần
  DangGiao --> TraToanBo: khách không nhận
  GiaoMotPhan --> HoanThanh: giao tiếp đủ
  GiaoMotPhan --> [*]: kết thúc đơn (giữ trạng thái)
  ChoSanXuat --> Huy
  DangSanXuat --> Huy
  ChoGiaoHang --> Huy
```

```mermaid
stateDiagram-v2
  direction LR
  state "Đơn nhập (DN)" as DN {
    state "Nháp" as Nhap
    state "Đã gửi NCC" as DaGuiNCC
    state "Nhận một phần" as NhanMotPhan
    state "Đã nhận đủ" as DaNhanDu
    state "Hoàn tất" as HoanTat
    state "Đã huỷ" as Huy
    [*] --> Nhap
    Nhap --> DaGuiNCC: gửi NCC
    DaGuiNCC --> NhanMotPhan: nhận một phần
    DaGuiNCC --> DaNhanDu: nhận đủ
    NhanMotPhan --> DaNhanDu
    NhanMotPhan --> HoanTat: chốt ngắn
    DaNhanDu --> HoanTat
    Nhap --> Huy
    DaGuiNCC --> Huy: chưa nhận gì
  }
  state "Chuyến (CH)" as CH {
    state "Đang gom đơn" as GomDon
    state "Đã xuất kho" as DaXuatKho
    state "Xe đã về kho" as XeVeKho
    state "Hoàn tất" as HoanTatCH
    state "Đã huỷ" as HuyCH
    [*] --> GomDon
    GomDon --> DaXuatKho: xuất kho một lượt
    DaXuatKho --> XeVeKho: mọi đơn đã chốt
    XeVeKho --> HoanTatCH: hoàn tất
    GomDon --> HuyCH: huỷ
  }
```

---

## 9. Nhiều doanh nghiệp

Bật khi có `PLATFORM_DATABASE_URL`; không có thì chạy như một doanh nghiệp trên `DATABASE_URL`.

```mermaid
flowchart LR
  U["Người dùng<br/>mã DN + email + mật khẩu"] -- "X-Tenant: hoa-mai" --> TM{"TenantMiddleware"}
  TM -- "tra mã trong platform DB<br/>giải mã chuỗi kết nối (PLATFORM_SECRET)" --> TC["TenantClients<br/>Map&lt;mã, PrismaClient&gt;<br/>pool TENANT_POOL_MAX"]
  TC --> ALS["AsyncLocalStorage<br/>{ code, client }"]
  ALS --> PS["PrismaService (proxy)<br/>→ client của DN"]
  PS --> D1[("nt_hoa_mai")]
  TM -- "DN tạm ngưng" --> F["403 { tenant }"]
  JWT["JWT { sub, tid }"] -. "tid ≠ X-Tenant → 401" .-> TM

  O["Chủ nền tảng<br/>mật khẩu + TOTP"] --> PC["/api/platform/*<br/>khoá ký riêng"]
  PC --> PDB[("platform DB<br/>tenants · nhật ký nền tảng")]
  PC -- "tạo DN: CREATE DATABASE,<br/>migrate, seed, tài khoản CEO" --> D1
```

Khởi động: `prisma migrate deploy` (DB mặc định) → `bootstrap.ts` (seed nếu trống) → `migrate-tenants.ts` (migrate mọi doanh nghiệp; lỗi ghi vào trạng thái doanh nghiệp, không chặn khởi động).

---

## 10. Build, CI, triển khai và sao lưu

```mermaid
flowchart LR
  DEV["Commit / PR → master"] --> CI
  subgraph CI["GitHub Actions: ci.yml"]
    direction TB
    B1["backend: Postgres 17 service"] --> B2["npm ci · prisma generate ·<br/>migrate deploy · seed + seed demo"]
    B2 --> B3["lint · unit · e2e · build"]
    F1["frontend: npm ci · ng build (production,<br/>kiểm ngân sách dung lượng)"]
  end
  CI -- "xanh" --> RB
  subgraph RB["Render: build"]
    RB1["frontend: npm ci && npm run build"] --> RB2["backend: npm ci · prisma generate · build"]
  end
  RB --> RS
  subgraph RS["Render: start:render"]
    S1["prisma migrate deploy"] --> S2["bootstrap.ts"] --> S3["migrate-tenants.ts"] --> S4["node dist/main<br/>health: /api/health"]
  end

  subgraph BK["backup-db.yml — 03:17 giờ VN mỗi ngày"]
    K1["liệt kê DB (platform + DN đang hoạt động / tạm ngưng)"] --> K2["pg_dump từng DB"]
    K2 --> K3["khôi phục thử vào DB tạm"] --> K4["mã hoá AES-256"] --> K5["lưu artifact 30 ngày"]
  end
```

- Một file style component quá 16 kB làm build production thất bại; tách thành nhiều `styleUrls` thay vì nâng ngân sách.
- Quyền mới phải thêm ở ba nơi: `backend/prisma/seed.ts`, `frontend/src/app/core/data/permission-catalog.ts` và một migration cấp quyền cho chức vụ có sẵn (test `permission-matrix` so khớp).

---

## 11. Bản đồ thư mục

```
backend/
  prisma/            schema.prisma · migrations/ · seed.ts · seed-demo.ts · bootstrap.ts · migrate-tenants.ts
  src/
    main.ts          helmet, static SPA, prefix /api, ValidationPipe
    app.module.ts    nối module; DecimalInterceptor, ErrorReportInterceptor, PrismaExceptionFilter
    auth/            đăng nhập, JWT, guards, throttle
    audit/           AuditService, AuditContextInterceptor, /audit-logs
    platform/        nhiều doanh nghiệp: middleware, clients, TOTP, secret-box
    prisma/          PrismaService (proxy), SequenceService
    common/          settle, debt-rows, period-lock, paging, import, decimal, purchase-prices, text
    monitoring/      request-id, health, Sentry
    modules/         access · company · tags · lookups · products · pricing · customers · suppliers ·
                     vehicles · inventory · purchasing · sales · delivery · cash · reports
  test/              e2e trên Postgres thật (permission-matrix, audit-coverage, period-and-returns, …)
frontend/src/app/
  app.routes.ts      route lazy + guards
  core/              api/ (ApiService, CatalogLoader, on-demand, interceptor) · auth/ (route-access) ·
                     services/ (DataStore, Auth, Tenant, Debt, Cost…) · models/ · data/ (permission-catalog)
  features/          một thư mục mỗi phân hệ: danh sách, *-voucher, dialogs, *.rules.ts
  shared/            data-table, search-select, print, import, vietqr, audit, period-filter…
  layout/            shell, menu (nav-items.ts), command-palette (Ctrl K), account-menu
tools/
  atlas/             dựng tài liệu Atlas (.docx + trang HTML) từ docs/atlas/src
  backup/            giải mã chuỗi kết nối cho workflow sao lưu
  qa/                Playwright mở mọi trang theo chức vụ; xuất báo cáo kiểm thử
docs/atlas/          tài liệu nghiệp vụ từng màn hình (ATL-00 → ATL-34)
```
