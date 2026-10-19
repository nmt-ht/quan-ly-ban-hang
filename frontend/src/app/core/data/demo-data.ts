/* eslint-disable */
// prettier-ignore
// FILE SINH TỰ ĐỘNG bởi tools/gen-demo-data.mjs — KHÔNG SỬA TAY (chạy lại: node tools/gen-demo-data.mjs).
// Toàn bộ dữ liệu là GIẢ, chỉ để thử giao diện.
import type {
  Product, StockLevel, WarehouseVoucher, ProductionOrder, Supplier, PurchaseOrder, Customer, SalesOrder,
  DeliveryTrip, Vehicle, CashAccount, CashVoucher, Tag, AppUser, BomLine,
} from '../models/domain.models';

export const DEMO_TODAY = '2026-10-19';
export const DEMO_PRODUCTS: Product[] = [
  {
    "id": "vt-nep-soi",
    "code": "VT0000001",
    "name": "Nẹp gỗ sồi 2cm (cây 2,4m)",
    "type": "VAT_TU",
    "baseUnit": "Cây",
    "categoryId": "cat-nep",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 100,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Việt Nam",
    "retailPrice": 55000,
    "wholesalePrice": 48000,
    "dropshipPrice": 52000,
    "unitConversions": [
      {
        "unitName": "Bó",
        "ratioToBaseUnit": 10,
        "price": 480000
      }
    ],
    "purchaseNote": "Mua theo bó 10 cây. Hao hụt cắt góc khoảng 8%.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-nep-oc-cho",
    "code": "VT0000002",
    "name": "Nẹp gỗ óc chó 3cm (cây 2,4m)",
    "type": "VAT_TU",
    "baseUnit": "Cây",
    "categoryId": "cat-nep",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 60,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Mỹ",
    "retailPrice": 105000,
    "wholesalePrice": 92000,
    "dropshipPrice": 98000,
    "unitConversions": [
      {
        "unitName": "Bó",
        "ratioToBaseUnit": 10,
        "price": 1020000
      }
    ],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-nhom-vang",
    "code": "VT0000003",
    "name": "Nẹp nhôm vàng 1,5cm (cây 2,5m)",
    "type": "VAT_TU",
    "baseUnit": "Cây",
    "categoryId": "cat-nhom",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 120,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Việt Nam",
    "retailPrice": 68000,
    "wholesalePrice": 58000,
    "dropshipPrice": 63000,
    "unitConversions": [
      {
        "unitName": "Bó",
        "ratioToBaseUnit": 20,
        "price": 1280000
      }
    ],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-nhom-den",
    "code": "VT0000004",
    "name": "Nẹp nhôm đen 2cm (cây 2,5m)",
    "type": "VAT_TU",
    "baseUnit": "Cây",
    "categoryId": "cat-nhom",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 120,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Việt Nam",
    "retailPrice": 76000,
    "wholesalePrice": 65000,
    "dropshipPrice": 71000,
    "unitConversions": [
      {
        "unitName": "Bó",
        "ratioToBaseUnit": 20,
        "price": 1420000
      }
    ],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-kinh-3ly",
    "code": "VT0000005",
    "name": "Kính trắng 3mm (tấm 1m × 2m)",
    "type": "VAT_TU",
    "baseUnit": "Tấm",
    "categoryId": "cat-kinh",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 20,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Việt Nam",
    "retailPrice": 240000,
    "wholesalePrice": 205000,
    "dropshipPrice": 225000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-mica-2ly",
    "code": "VT0000006",
    "name": "Mica trong 2mm (tấm 1,22m × 2,44m)",
    "type": "VAT_TU",
    "baseUnit": "Tấm",
    "categoryId": "cat-kinh",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 15,
    "vatRate": 8,
    "warrantyMonths": 0,
    "origin": "Đài Loan",
    "retailPrice": 590000,
    "wholesalePrice": 505000,
    "dropshipPrice": 550000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-hau-mdf",
    "code": "VT0000007",
    "name": "Tấm hậu MDF 3mm (tấm 1,22m × 2,44m)",
    "type": "VAT_TU",
    "baseUnit": "Tấm",
    "categoryId": "cat-kinh",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 25,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 140000,
    "wholesalePrice": 120000,
    "dropshipPrice": 132000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-go-tho",
    "code": "VT0000008",
    "name": "Gỗ sồi thanh thô (cây 2,4m)",
    "type": "VAT_TU",
    "baseUnit": "Cây",
    "categoryId": "cat-nvl",
    "defaultWarehouseId": "wh-vattu",
    "minStock": 80,
    "vatRate": 0,
    "warrantyMonths": 0,
    "retailPrice": 0,
    "wholesalePrice": 0,
    "dropshipPrice": 0,
    "unitConversions": [],
    "purchaseNote": "Nguyên liệu phay nẹp, không bán ra.",
    "isSellable": false,
    "isActive": true
  },
  {
    "id": "vt-moc-treo",
    "code": "VT0000009",
    "name": "Móc treo tranh số 3",
    "type": "VAT_TU",
    "baseUnit": "Cái",
    "categoryId": "cat-pk",
    "defaultWarehouseId": "wh-phukien",
    "minStock": 500,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 1500,
    "wholesalePrice": 1000,
    "dropshipPrice": 1200,
    "unitConversions": [
      {
        "unitName": "Hộp",
        "ratioToBaseUnit": 100,
        "price": 90000
      }
    ],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-dinh-ghim",
    "code": "VT0000010",
    "name": "Đinh ghim hậu khung (hộp 500 cái)",
    "type": "VAT_TU",
    "baseUnit": "Hộp",
    "categoryId": "cat-pk",
    "defaultWarehouseId": "wh-phukien",
    "minStock": 10,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 45000,
    "wholesalePrice": 38000,
    "dropshipPrice": 42000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-day-thep",
    "code": "VT0000011",
    "name": "Dây thép treo tranh 0,8mm",
    "type": "VAT_TU",
    "baseUnit": "Cuộn",
    "categoryId": "cat-pk",
    "defaultWarehouseId": "wh-phukien",
    "minStock": 15,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 38000,
    "wholesalePrice": 31000,
    "dropshipPrice": 35000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-kep-kinh",
    "code": "VT0000012",
    "name": "Kẹp giữ kính inox",
    "type": "VAT_TU",
    "baseUnit": "Bộ",
    "categoryId": "cat-pk",
    "defaultWarehouseId": "wh-phukien",
    "minStock": 100,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 6500,
    "wholesalePrice": 5000,
    "dropshipPrice": 5500,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-keo-dan",
    "code": "VT0000013",
    "name": "Keo dán gỗ 1kg",
    "type": "VAT_TU",
    "baseUnit": "Chai",
    "categoryId": "cat-pk",
    "defaultWarehouseId": "wh-phukien",
    "minStock": 20,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 65000,
    "wholesalePrice": 55000,
    "dropshipPrice": 60000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-den-led",
    "code": "VT0000014",
    "name": "Đèn rọi tranh LED 6W",
    "type": "VAT_TU",
    "baseUnit": "Cái",
    "categoryId": "cat-hh",
    "defaultWarehouseId": "wh-ninhtrang",
    "minStock": 10,
    "vatRate": 8,
    "warrantyMonths": 12,
    "origin": "Trung Quốc",
    "retailPrice": 160000,
    "wholesalePrice": 135000,
    "dropshipPrice": 148000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "vt-ve-sinh-kinh",
    "code": "VT0000015",
    "name": "Bộ vệ sinh kính",
    "type": "VAT_TU",
    "baseUnit": "Bộ",
    "categoryId": "cat-hh",
    "defaultWarehouseId": "wh-ninhtrang",
    "minStock": 20,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 35000,
    "wholesalePrice": 28000,
    "dropshipPrice": 31000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-soi-20x30",
    "code": "SP0000001",
    "name": "Khung tranh gỗ sồi 20×30 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 120000,
    "wholesalePrice": 102000,
    "dropshipPrice": 110000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-soi-30x40",
    "code": "SP0000002",
    "name": "Khung tranh gỗ sồi 30×40 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 185000,
    "wholesalePrice": 157000,
    "dropshipPrice": 170000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-soi-40x60",
    "code": "SP0000003",
    "name": "Khung tranh gỗ sồi 40×60 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 295000,
    "wholesalePrice": 251000,
    "dropshipPrice": 271000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-soi-50x70",
    "code": "SP0000004",
    "name": "Khung tranh gỗ sồi 50×70 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 420000,
    "wholesalePrice": 357000,
    "dropshipPrice": 386000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-soi-60x90",
    "code": "SP0000005",
    "name": "Khung tranh gỗ sồi 60×90 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 650000,
    "wholesalePrice": 553000,
    "dropshipPrice": 598000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-nhom-vang-30x40",
    "code": "SP0000006",
    "name": "Khung tranh nhôm vàng 30×40 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 210000,
    "wholesalePrice": 179000,
    "dropshipPrice": 193000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-nhom-den-40x60",
    "code": "SP0000007",
    "name": "Khung tranh nhôm đen 40×60 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 330000,
    "wholesalePrice": 281000,
    "dropshipPrice": 304000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-khung-oc-cho-40x60",
    "code": "SP0000008",
    "name": "Khung tranh gỗ óc chó 40×60 cm",
    "type": "THANH_PHAM",
    "baseUnit": "Cái",
    "categoryId": "cat-khung",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 8,
    "vatRate": 8,
    "warrantyMonths": 6,
    "retailPrice": 480000,
    "wholesalePrice": 408000,
    "dropshipPrice": 442000,
    "unitConversions": [],
    "description": "Đóng khung hoàn chỉnh gồm nẹp, kính, hậu, móc treo.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-kinh-cat",
    "code": "SP0000009",
    "name": "Kính cắt theo cỡ 3mm",
    "type": "THANH_PHAM",
    "baseUnit": "Tấm",
    "categoryId": "cat-tp",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 0,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 120000,
    "wholesalePrice": 100000,
    "dropshipPrice": 110000,
    "unitConversions": [],
    "saleNote": "Nhập Dài × Rộng (cm) trên dòng đơn.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "sp-mica-cat",
    "code": "SP0000010",
    "name": "Mica cắt theo cỡ 2mm",
    "type": "THANH_PHAM",
    "baseUnit": "Tấm",
    "categoryId": "cat-tp",
    "defaultWarehouseId": "wh-thanhpham",
    "minStock": 0,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 180000,
    "wholesalePrice": 150000,
    "dropshipPrice": 165000,
    "unitConversions": [],
    "saleNote": "Nhập Dài × Rộng (cm) trên dòng đơn.",
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "dv-cong-dong",
    "code": "DV0000001",
    "name": "Công đóng khung theo yêu cầu",
    "type": "DICH_VU",
    "baseUnit": "Lần",
    "minStock": 0,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 50000,
    "wholesalePrice": 45000,
    "dropshipPrice": 48000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  },
  {
    "id": "dv-giao-hang",
    "code": "DV0000002",
    "name": "Phí giao hàng nội thành",
    "type": "DICH_VU",
    "baseUnit": "Chuyến",
    "minStock": 0,
    "vatRate": 8,
    "warrantyMonths": 0,
    "retailPrice": 30000,
    "wholesalePrice": 30000,
    "dropshipPrice": 30000,
    "unitConversions": [],
    "isSellable": true,
    "isActive": true
  }
];
export const DEMO_BOM_LINES: BomLine[] = [
  {
    "finishedProductId": "sp-khung-soi-20x30",
    "componentId": "vt-nep-soi",
    "quantityPerUnit": 0.45
  },
  {
    "finishedProductId": "sp-khung-soi-20x30",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.0345
  },
  {
    "finishedProductId": "sp-khung-soi-20x30",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0232
  },
  {
    "finishedProductId": "sp-khung-soi-20x30",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-soi-20x30",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-soi-30x40",
    "componentId": "vt-nep-soi",
    "quantityPerUnit": 0.6167
  },
  {
    "finishedProductId": "sp-khung-soi-30x40",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.069
  },
  {
    "finishedProductId": "sp-khung-soi-30x40",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0464
  },
  {
    "finishedProductId": "sp-khung-soi-30x40",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-soi-30x40",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-soi-40x60",
    "componentId": "vt-nep-soi",
    "quantityPerUnit": 0.8667
  },
  {
    "finishedProductId": "sp-khung-soi-40x60",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.138
  },
  {
    "finishedProductId": "sp-khung-soi-40x60",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0927
  },
  {
    "finishedProductId": "sp-khung-soi-40x60",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-soi-40x60",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-soi-50x70",
    "componentId": "vt-nep-soi",
    "quantityPerUnit": 1.0333
  },
  {
    "finishedProductId": "sp-khung-soi-50x70",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.2012
  },
  {
    "finishedProductId": "sp-khung-soi-50x70",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.1352
  },
  {
    "finishedProductId": "sp-khung-soi-50x70",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-soi-50x70",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-soi-60x90",
    "componentId": "vt-nep-soi",
    "quantityPerUnit": 1.2833
  },
  {
    "finishedProductId": "sp-khung-soi-60x90",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.3105
  },
  {
    "finishedProductId": "sp-khung-soi-60x90",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.2086
  },
  {
    "finishedProductId": "sp-khung-soi-60x90",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-soi-60x90",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-nhom-vang",
    "quantityPerUnit": 0.592
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.069
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0464
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-nhom-vang-30x40",
    "componentId": "vt-kep-kinh",
    "quantityPerUnit": 1
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-nhom-den",
    "quantityPerUnit": 0.832
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.138
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0927
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-khung-nhom-den-40x60",
    "componentId": "vt-kep-kinh",
    "quantityPerUnit": 1
  },
  {
    "finishedProductId": "sp-khung-oc-cho-40x60",
    "componentId": "vt-nep-oc-cho",
    "quantityPerUnit": 0.8667
  },
  {
    "finishedProductId": "sp-khung-oc-cho-40x60",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.138
  },
  {
    "finishedProductId": "sp-khung-oc-cho-40x60",
    "componentId": "vt-hau-mdf",
    "quantityPerUnit": 0.0927
  },
  {
    "finishedProductId": "sp-khung-oc-cho-40x60",
    "componentId": "vt-moc-treo",
    "quantityPerUnit": 2
  },
  {
    "finishedProductId": "sp-khung-oc-cho-40x60",
    "componentId": "vt-dinh-ghim",
    "quantityPerUnit": 0.02
  },
  {
    "finishedProductId": "sp-kinh-cat",
    "componentId": "vt-kinh-3ly",
    "quantityPerUnit": 0.25
  },
  {
    "finishedProductId": "sp-mica-cat",
    "componentId": "vt-mica-2ly",
    "quantityPerUnit": 0.15
  }
];
export const DEMO_STOCK_LEVELS: StockLevel[] = [
  {
    "productId": "sp-khung-nhom-den-40x60",
    "warehouseId": "wh-thanhpham",
    "quantity": 38,
    "minStock": 8
  },
  {
    "productId": "sp-khung-nhom-vang-30x40",
    "warehouseId": "wh-thanhpham",
    "quantity": 17,
    "minStock": 8
  },
  {
    "productId": "sp-khung-oc-cho-40x60",
    "warehouseId": "wh-thanhpham",
    "quantity": 9,
    "minStock": 8
  },
  {
    "productId": "sp-khung-soi-20x30",
    "warehouseId": "wh-thanhpham",
    "quantity": 10,
    "minStock": 8
  },
  {
    "productId": "sp-khung-soi-30x40",
    "warehouseId": "wh-thanhpham",
    "quantity": 33,
    "minStock": 8
  },
  {
    "productId": "sp-khung-soi-40x60",
    "warehouseId": "wh-thanhpham",
    "quantity": 13,
    "minStock": 8
  },
  {
    "productId": "sp-khung-soi-50x70",
    "warehouseId": "wh-thanhpham",
    "quantity": 10,
    "minStock": 8
  },
  {
    "productId": "sp-khung-soi-60x90",
    "warehouseId": "wh-thanhpham",
    "quantity": 4,
    "minStock": 8
  },
  {
    "productId": "vt-day-thep",
    "warehouseId": "wh-phukien",
    "quantity": 10,
    "minStock": 15
  },
  {
    "productId": "vt-den-led",
    "warehouseId": "wh-ninhtrang",
    "quantity": 49,
    "minStock": 10
  },
  {
    "productId": "vt-dinh-ghim",
    "warehouseId": "wh-phukien",
    "quantity": 40.34,
    "minStock": 10
  },
  {
    "productId": "vt-dinh-ghim",
    "warehouseId": "wh-vattu",
    "quantity": 5,
    "minStock": 10
  },
  {
    "productId": "vt-go-tho",
    "warehouseId": "wh-vattu",
    "quantity": 242,
    "minStock": 80
  },
  {
    "productId": "vt-hau-mdf",
    "warehouseId": "wh-vattu",
    "quantity": 81.08,
    "minStock": 25
  },
  {
    "productId": "vt-keo-dan",
    "warehouseId": "wh-phukien",
    "quantity": 48,
    "minStock": 20
  },
  {
    "productId": "vt-kep-kinh",
    "warehouseId": "wh-phukien",
    "quantity": 546,
    "minStock": 100
  },
  {
    "productId": "vt-kinh-3ly",
    "warehouseId": "wh-vattu",
    "quantity": 10,
    "minStock": 20
  },
  {
    "productId": "vt-mica-2ly",
    "warehouseId": "wh-vattu",
    "quantity": 59.1,
    "minStock": 15
  },
  {
    "productId": "vt-moc-treo",
    "warehouseId": "wh-phukien",
    "quantity": 3404,
    "minStock": 500
  },
  {
    "productId": "vt-nep-oc-cho",
    "warehouseId": "wh-vattu",
    "quantity": 312.73,
    "minStock": 60
  },
  {
    "productId": "vt-nep-soi",
    "warehouseId": "wh-vattu",
    "quantity": 465.87,
    "minStock": 100
  },
  {
    "productId": "vt-nhom-den",
    "warehouseId": "wh-vattu",
    "quantity": 323.75,
    "minStock": 120
  },
  {
    "productId": "vt-nhom-vang",
    "warehouseId": "wh-vattu",
    "quantity": 371.75,
    "minStock": 120
  },
  {
    "productId": "vt-ve-sinh-kinh",
    "warehouseId": "wh-ninhtrang",
    "quantity": 15,
    "minStock": 20
  }
];
export const DEMO_WAREHOUSE_VOUCHERS: WarehouseVoucher[] = [
  {
    "id": "pk-nhap-24",
    "code": "PNK0000024",
    "type": "NHAP",
    "date": "2026-10-19",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000033",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 24,
        "delta": 24
      }
    ]
  },
  {
    "id": "pk-nhap-23",
    "code": "PNK0000023",
    "type": "NHAP",
    "date": "2026-10-18",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000032",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 20,
        "delta": 20
      }
    ]
  },
  {
    "id": "pk-xuat-50",
    "code": "PXK0000050",
    "type": "XUAT",
    "date": "2026-10-17",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000008",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 12,
        "delta": 12
      }
    ]
  },
  {
    "id": "pk-xuat-49",
    "code": "PXK0000049",
    "type": "XUAT",
    "date": "2026-10-17",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000036",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.4,
        "delta": 0.4
      }
    ]
  },
  {
    "id": "pk-xuat-48",
    "code": "PXK0000048",
    "type": "XUAT",
    "date": "2026-10-17",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000036, LSX0000037",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 20.67,
        "delta": 20.67
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 6.52,
        "delta": 6.52
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 2.7,
        "delta": 2.7
      }
    ]
  },
  {
    "id": "pk-xuat-47",
    "code": "PXK0000047",
    "type": "XUAT",
    "date": "2026-10-16",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000033",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 48,
        "delta": 48
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.48,
        "delta": 0.48
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 24,
        "delta": 24
      }
    ]
  },
  {
    "id": "pk-xuat-46",
    "code": "PXK0000046",
    "type": "XUAT",
    "date": "2026-10-16",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000033",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-den",
        "quantity": 19.97,
        "delta": 19.97
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 3.31,
        "delta": 3.31
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 2.22,
        "delta": 2.22
      }
    ]
  },
  {
    "id": "pk-nhap-22",
    "code": "PNK0000022",
    "type": "NHAP",
    "date": "2026-10-16",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000029, LSX0000030, LSX0000031",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 12,
        "delta": 12
      }
    ]
  },
  {
    "id": "pk-xuat-45",
    "code": "PXK0000045",
    "type": "XUAT",
    "date": "2026-10-15",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000032, LSX0000034, LSX0000035",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 120,
        "delta": 120
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 1.2,
        "delta": 1.2
      }
    ]
  },
  {
    "id": "pk-xuat-44",
    "code": "PXK0000044",
    "type": "XUAT",
    "date": "2026-10-15",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000032, LSX0000034, LSX0000035",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 38.34,
        "delta": 38.34
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 6.9,
        "delta": 6.9
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 4.64,
        "delta": 4.64
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 8.67,
        "delta": 8.67
      }
    ]
  },
  {
    "id": "pk-xuat-43",
    "code": "PXK0000043",
    "type": "XUAT",
    "date": "2026-10-14",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000031",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 24,
        "delta": 24
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.24,
        "delta": 0.24
      }
    ]
  },
  {
    "id": "pk-xuat-42",
    "code": "PXK0000042",
    "type": "XUAT",
    "date": "2026-10-14",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000031",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 10.4,
        "delta": 10.4
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 1.66,
        "delta": 1.66
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 1.11,
        "delta": 1.11
      }
    ]
  },
  {
    "id": "pk-xuat-41",
    "code": "PXK0000041",
    "type": "XUAT",
    "date": "2026-10-13",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000029, LSX0000030",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 32,
        "delta": 32
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.32,
        "delta": 0.32
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 8,
        "delta": 8
      }
    ]
  },
  {
    "id": "pk-xuat-40",
    "code": "PXK0000040",
    "type": "XUAT",
    "date": "2026-10-13",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000029, LSX0000030",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 4.74,
        "delta": 4.74
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 1.1,
        "delta": 1.1
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.74,
        "delta": 0.74
      },
      {
        "productId": "vt-nep-soi",
        "quantity": 4.93,
        "delta": 4.93
      }
    ]
  },
  {
    "id": "pk-nhap-21",
    "code": "PNK0000021",
    "type": "NHAP",
    "date": "2026-10-13",
    "warehouseId": "wh-ninhtrang",
    "reason": "Nhập hàng theo đơn DN0000009",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-den-led",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "vt-ve-sinh-kinh",
        "quantity": 15,
        "delta": 15
      }
    ]
  },
  {
    "id": "pk-xuat-39",
    "code": "PXK0000039",
    "type": "XUAT",
    "date": "2026-10-12",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000007",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 16,
        "delta": 16
      },
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 2,
        "delta": 2
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-nhap-20",
    "code": "PNK0000020",
    "type": "NHAP",
    "date": "2026-10-11",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000027, LSX0000028",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 2,
        "delta": 2
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-nhap-19",
    "code": "PNK0000019",
    "type": "NHAP",
    "date": "2026-10-09",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000025, LSX0000026",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 16,
        "delta": 16
      },
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-xuat-38",
    "code": "PXK0000038",
    "type": "XUAT",
    "date": "2026-10-08",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000027, LSX0000028",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.1,
        "delta": 0.1
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 2,
        "delta": 2
      }
    ]
  },
  {
    "id": "pk-xuat-37",
    "code": "PXK0000037",
    "type": "XUAT",
    "date": "2026-10-08",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000027, LSX0000028",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 1.18,
        "delta": 1.18
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.35,
        "delta": 0.35
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.23,
        "delta": 0.23
      },
      {
        "productId": "vt-nep-soi",
        "quantity": 1.85,
        "delta": 1.85
      }
    ]
  },
  {
    "id": "pk-xuat-36",
    "code": "PXK0000036",
    "type": "XUAT",
    "date": "2026-10-06",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000025, LSX0000026",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 52,
        "delta": 52
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.52,
        "delta": 0.52
      }
    ]
  },
  {
    "id": "pk-xuat-35",
    "code": "PXK0000035",
    "type": "XUAT",
    "date": "2026-10-06",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000025, LSX0000026",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 29.37,
        "delta": 29.37
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 6.32,
        "delta": 6.32
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 4.25,
        "delta": 4.25
      }
    ]
  },
  {
    "id": "pk-xuat-34",
    "code": "PXK0000034",
    "type": "XUAT",
    "date": "2026-09-30",
    "warehouseId": "wh-ninhtrang",
    "reason": "Xuất kho giao hàng — chuyến CH0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-ve-sinh-kinh",
        "quantity": 2,
        "delta": 2
      }
    ]
  },
  {
    "id": "pk-xuat-33",
    "code": "PXK0000033",
    "type": "XUAT",
    "date": "2026-09-30",
    "warehouseId": "wh-phukien",
    "reason": "Xuất kho giao hàng — chuyến CH0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-keo-dan",
        "quantity": 1,
        "delta": 1
      }
    ]
  },
  {
    "id": "pk-xuat-32",
    "code": "PXK0000032",
    "type": "XUAT",
    "date": "2026-09-30",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 24,
        "delta": 24
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 12,
        "delta": 12
      },
      {
        "productId": "sp-khung-oc-cho-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 1,
        "delta": 1
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 1,
        "delta": 1
      }
    ]
  },
  {
    "id": "pk-kiem_ke-05",
    "code": "PKK0000005",
    "type": "KIEM_KE",
    "date": "2026-09-30",
    "warehouseId": "wh-vattu",
    "reason": "Kiểm kê định kỳ cuối tháng 9",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 571.43,
        "delta": -3
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 36.16,
        "delta": -1
      }
    ]
  },
  {
    "id": "pk-nhap-18",
    "code": "PNK0000018",
    "type": "NHAP",
    "date": "2026-09-29",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000023, LSX0000024",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 1,
        "delta": 1
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 1,
        "delta": 1
      }
    ]
  },
  {
    "id": "pk-nhap-17",
    "code": "PNK0000017",
    "type": "NHAP",
    "date": "2026-09-28",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000021, LSX0000022",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-oc-cho-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-xuat-31",
    "code": "PXK0000031",
    "type": "XUAT",
    "date": "2026-09-26",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000023, LSX0000024",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 4,
        "delta": 4
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.04,
        "delta": 0.04
      }
    ]
  },
  {
    "id": "pk-xuat-30",
    "code": "PXK0000030",
    "type": "XUAT",
    "date": "2026-09-26",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000023, LSX0000024",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 1.9,
        "delta": 1.9
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.38,
        "delta": 0.38
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.26,
        "delta": 0.26
      }
    ]
  },
  {
    "id": "pk-nhap-16",
    "code": "PNK0000016",
    "type": "NHAP",
    "date": "2026-09-26",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000019, LSX0000020",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 24,
        "delta": 24
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 12,
        "delta": 12
      }
    ]
  },
  {
    "id": "pk-xuat-29",
    "code": "PXK0000029",
    "type": "XUAT",
    "date": "2026-09-25",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000021, LSX0000022",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.4,
        "delta": 0.4
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-xuat-28",
    "code": "PXK0000028",
    "type": "XUAT",
    "date": "2026-09-25",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000021, LSX0000022",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 8.67,
        "delta": 8.67
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 2.76,
        "delta": 2.76
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 1.85,
        "delta": 1.85
      },
      {
        "productId": "vt-nhom-den",
        "quantity": 8.32,
        "delta": 8.32
      }
    ]
  },
  {
    "id": "pk-xuat-27",
    "code": "PXK0000027",
    "type": "XUAT",
    "date": "2026-09-23",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000019, LSX0000020",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 72,
        "delta": 72
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.72,
        "delta": 0.72
      }
    ]
  },
  {
    "id": "pk-xuat-26",
    "code": "PXK0000026",
    "type": "XUAT",
    "date": "2026-09-23",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000019, LSX0000020",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 33.2,
        "delta": 33.2
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 5.73,
        "delta": 5.73
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 3.85,
        "delta": 3.85
      }
    ]
  },
  {
    "id": "pk-nhap-15",
    "code": "PNK0000015",
    "type": "NHAP",
    "date": "2026-09-22",
    "warehouseId": "wh-vattu",
    "reason": "Nhập hàng theo đơn DN0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 250,
        "delta": 250
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 120,
        "delta": 120
      }
    ]
  },
  {
    "id": "pk-xuat-25",
    "code": "PXK0000025",
    "type": "XUAT",
    "date": "2026-09-18",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000004",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 15,
        "delta": 15
      },
      {
        "productId": "sp-mica-cat",
        "quantity": 6,
        "delta": 6
      },
      {
        "productId": "sp-khung-soi-20x30",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-nhap-14",
    "code": "PNK0000014",
    "type": "NHAP",
    "date": "2026-09-16",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000017, LSX0000018",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-20x30",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-nhap-13",
    "code": "PNK0000013",
    "type": "NHAP",
    "date": "2026-09-14",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000015, LSX0000016",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 15,
        "delta": 15
      },
      {
        "productId": "sp-mica-cat",
        "quantity": 6,
        "delta": 6
      }
    ]
  },
  {
    "id": "pk-xuat-24",
    "code": "PXK0000024",
    "type": "XUAT",
    "date": "2026-09-13",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000017, LSX0000018",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.4,
        "delta": 0.4
      }
    ]
  },
  {
    "id": "pk-xuat-23",
    "code": "PXK0000023",
    "type": "XUAT",
    "date": "2026-09-13",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000017, LSX0000018",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 10.67,
        "delta": 10.67
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 1.04,
        "delta": 1.04
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.7,
        "delta": 0.7
      }
    ]
  },
  {
    "id": "pk-xuat-22",
    "code": "PXK0000022",
    "type": "XUAT",
    "date": "2026-09-11",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000015",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.3,
        "delta": 0.3
      }
    ]
  },
  {
    "id": "pk-xuat-21",
    "code": "PXK0000021",
    "type": "XUAT",
    "date": "2026-09-11",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000015, LSX0000016",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 13,
        "delta": 13
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 2.07,
        "delta": 2.07
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 1.39,
        "delta": 1.39
      },
      {
        "productId": "vt-mica-2ly",
        "quantity": 0.9,
        "delta": 0.9
      }
    ]
  },
  {
    "id": "pk-chuyen-01",
    "code": "PCK0000001",
    "type": "CHUYEN",
    "date": "2026-09-08",
    "warehouseId": "wh-phukien",
    "targetWarehouseId": "wh-vattu",
    "reason": "Chuyển đinh ghim ra xưởng đóng khung",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-dinh-ghim",
        "quantity": 5,
        "delta": 5
      }
    ]
  },
  {
    "id": "pk-xuat-20",
    "code": "PXK0000020",
    "type": "XUAT",
    "date": "2026-09-05",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000003",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-20x30",
        "quantity": 4,
        "delta": 4
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-nhap-12",
    "code": "PNK0000012",
    "type": "NHAP",
    "date": "2026-09-05",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập trả về — chuyến CH0000003 (DH0000007, DH0000008)",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 3,
        "delta": 3
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-nhap-11",
    "code": "PNK0000011",
    "type": "NHAP",
    "date": "2026-09-04",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000012, LSX0000013, LSX0000014",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-nhap-10",
    "code": "PNK0000010",
    "type": "NHAP",
    "date": "2026-09-03",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000011",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-20x30",
        "quantity": 4,
        "delta": 4
      }
    ]
  },
  {
    "id": "pk-xuat-19",
    "code": "PXK0000019",
    "type": "XUAT",
    "date": "2026-09-02",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000014",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 6,
        "delta": 6
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.06,
        "delta": 0.06
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 3,
        "delta": 3
      }
    ]
  },
  {
    "id": "pk-xuat-18",
    "code": "PXK0000018",
    "type": "XUAT",
    "date": "2026-09-02",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000014",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 1.78,
        "delta": 1.78
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.21,
        "delta": 0.21
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.14,
        "delta": 0.14
      }
    ]
  },
  {
    "id": "pk-xuat-17",
    "code": "PXK0000017",
    "type": "XUAT",
    "date": "2026-09-01",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000012, LSX0000013",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.4,
        "delta": 0.4
      }
    ]
  },
  {
    "id": "pk-xuat-16",
    "code": "PXK0000016",
    "type": "XUAT",
    "date": "2026-09-01",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000012, LSX0000013",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 14.83,
        "delta": 14.83
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 2.07,
        "delta": 2.07
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 1.39,
        "delta": 1.39
      }
    ]
  },
  {
    "id": "pk-xuat-15",
    "code": "PXK0000015",
    "type": "XUAT",
    "date": "2026-08-31",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000011",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.08,
        "delta": 0.08
      }
    ]
  },
  {
    "id": "pk-xuat-14",
    "code": "PXK0000014",
    "type": "XUAT",
    "date": "2026-08-31",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000011",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 1.8,
        "delta": 1.8
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.14,
        "delta": 0.14
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.09,
        "delta": 0.09
      }
    ]
  },
  {
    "id": "pk-xuat-13",
    "code": "PXK0000013",
    "type": "XUAT",
    "date": "2026-08-28",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000002",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 12,
        "delta": 12
      },
      {
        "productId": "sp-khung-oc-cho-40x60",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-kinh-cat",
        "quantity": 5,
        "delta": 5
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 30,
        "delta": 30
      }
    ]
  },
  {
    "id": "pk-nhap-09",
    "code": "PNK0000009",
    "type": "NHAP",
    "date": "2026-08-24",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000006, LSX0000007, LSX0000008",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 12,
        "delta": 12
      },
      {
        "productId": "sp-khung-oc-cho-40x60",
        "quantity": 8,
        "delta": 8
      },
      {
        "productId": "sp-kinh-cat",
        "quantity": 5,
        "delta": 5
      }
    ]
  },
  {
    "id": "pk-nhap-08",
    "code": "PNK0000008",
    "type": "NHAP",
    "date": "2026-08-23",
    "warehouseId": "wh-phukien",
    "reason": "Nhập hàng theo đơn DN0000004",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 3000,
        "delta": 3000
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-day-thep",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 400,
        "delta": 400
      },
      {
        "productId": "vt-keo-dan",
        "quantity": 30,
        "delta": 30
      }
    ]
  },
  {
    "id": "pk-nhap-07",
    "code": "PNK0000007",
    "type": "NHAP",
    "date": "2026-08-22",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000009, LSX0000010",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 30,
        "delta": 30
      }
    ]
  },
  {
    "id": "pk-xuat-12",
    "code": "PXK0000012",
    "type": "XUAT",
    "date": "2026-08-21",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000006, LSX0000007",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 40,
        "delta": 40
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.4,
        "delta": 0.4
      }
    ]
  },
  {
    "id": "pk-xuat-11",
    "code": "PXK0000011",
    "type": "XUAT",
    "date": "2026-08-21",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000006, LSX0000007, LSX0000008",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 15.4,
        "delta": 15.4
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 6.08,
        "delta": 6.08
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 3.24,
        "delta": 3.24
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 6.93,
        "delta": 6.93
      }
    ]
  },
  {
    "id": "pk-xuat-10",
    "code": "PXK0000010",
    "type": "XUAT",
    "date": "2026-08-20",
    "warehouseId": "wh-ninhtrang",
    "reason": "Xuất kho giao hàng — chuyến CH0000001",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-den-led",
        "quantity": 6,
        "delta": 6
      }
    ]
  },
  {
    "id": "pk-xuat-09",
    "code": "PXK0000009",
    "type": "XUAT",
    "date": "2026-08-20",
    "warehouseId": "wh-thanhpham",
    "reason": "Xuất kho giao hàng — chuyến CH0000001",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 2,
        "delta": 2
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 21,
        "delta": 21
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 6,
        "delta": 6
      }
    ]
  },
  {
    "id": "pk-xuat-08",
    "code": "PXK0000008",
    "type": "XUAT",
    "date": "2026-08-19",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000009, LSX0000010",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 120,
        "delta": 120
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 1.2,
        "delta": 1.2
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 30,
        "delta": 30
      }
    ]
  },
  {
    "id": "pk-xuat-07",
    "code": "PXK0000007",
    "type": "XUAT",
    "date": "2026-08-19",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000009, LSX0000010",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 31,
        "delta": 31
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 10.18,
        "delta": 10.18
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 6.84,
        "delta": 6.84
      },
      {
        "productId": "vt-nhom-den",
        "quantity": 24.96,
        "delta": 24.96
      }
    ]
  },
  {
    "id": "pk-nhap-06",
    "code": "PNK0000006",
    "type": "NHAP",
    "date": "2026-08-18",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 6,
        "delta": 6
      }
    ]
  },
  {
    "id": "pk-nhap-05",
    "code": "PNK0000005",
    "type": "NHAP",
    "date": "2026-08-17",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000003, LSX0000004",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 20,
        "delta": 20
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 10,
        "delta": 10
      }
    ]
  },
  {
    "id": "pk-nhap-04",
    "code": "PNK0000004",
    "type": "NHAP",
    "date": "2026-08-16",
    "warehouseId": "wh-thanhpham",
    "reason": "Nhập thành phẩm từ xưởng: LSX0000001, LSX0000002",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 2,
        "delta": 2
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 1,
        "delta": 1
      }
    ]
  },
  {
    "id": "pk-xuat-06",
    "code": "PXK0000006",
    "type": "XUAT",
    "date": "2026-08-15",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 12,
        "delta": 12
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.12,
        "delta": 0.12
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 6,
        "delta": 6
      }
    ]
  },
  {
    "id": "pk-xuat-05",
    "code": "PXK0000005",
    "type": "XUAT",
    "date": "2026-08-15",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000005",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 3.55,
        "delta": 3.55
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.41,
        "delta": 0.41
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.28,
        "delta": 0.28
      }
    ]
  },
  {
    "id": "pk-nhap-03",
    "code": "PNK0000003",
    "type": "NHAP",
    "date": "2026-08-15",
    "warehouseId": "wh-vattu",
    "reason": "Nhập hàng theo đơn DN0000003",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-kinh-3ly",
        "quantity": 60,
        "delta": 60
      },
      {
        "productId": "vt-mica-2ly",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 80,
        "delta": 80
      }
    ]
  },
  {
    "id": "pk-xuat-04",
    "code": "PXK0000004",
    "type": "XUAT",
    "date": "2026-08-14",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000003, LSX0000004",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 60,
        "delta": 60
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.6,
        "delta": 0.6
      }
    ]
  },
  {
    "id": "pk-xuat-03",
    "code": "PXK0000003",
    "type": "XUAT",
    "date": "2026-08-14",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000003, LSX0000004",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 27.67,
        "delta": 27.67
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 4.77,
        "delta": 4.77
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 3.21,
        "delta": 3.21
      }
    ]
  },
  {
    "id": "pk-xuat-02",
    "code": "PXK0000002",
    "type": "XUAT",
    "date": "2026-08-13",
    "warehouseId": "wh-phukien",
    "reason": "Xuất vật tư cho LSX0000001, LSX0000002",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 6,
        "delta": 6
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 0.06,
        "delta": 0.06
      }
    ]
  },
  {
    "id": "pk-xuat-01",
    "code": "PXK0000001",
    "type": "XUAT",
    "date": "2026-08-13",
    "warehouseId": "wh-vattu",
    "reason": "Xuất vật tư cho LSX0000001, LSX0000002",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 2.1,
        "delta": 2.1
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 0.28,
        "delta": 0.28
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 0.19,
        "delta": 0.19
      }
    ]
  },
  {
    "id": "pk-nhap-02",
    "code": "PNK0000002",
    "type": "NHAP",
    "date": "2026-08-09",
    "warehouseId": "wh-vattu",
    "reason": "Nhập hàng theo đơn DN0000002",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 200,
        "delta": 200
      },
      {
        "productId": "vt-nhom-den",
        "quantity": 200,
        "delta": 200
      }
    ]
  },
  {
    "id": "pk-nhap-01",
    "code": "PNK0000001",
    "type": "NHAP",
    "date": "2026-08-06",
    "warehouseId": "wh-vattu",
    "reason": "Nhập hàng theo đơn DN0000001",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 300,
        "delta": 300
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 100,
        "delta": 100
      },
      {
        "productId": "vt-go-tho",
        "quantity": 150,
        "delta": 150
      }
    ]
  },
  {
    "id": "pk-kiem_ke-04",
    "code": "PKK0000004",
    "type": "KIEM_KE",
    "date": "2026-08-01",
    "warehouseId": "wh-vattu",
    "reason": "Kiểm kê, nhập tồn đầu kỳ",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 176,
        "delta": 176
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 117,
        "delta": 117
      },
      {
        "productId": "vt-nhom-vang",
        "quantity": 183,
        "delta": 183
      },
      {
        "productId": "vt-nhom-den",
        "quantity": 177,
        "delta": 177
      },
      {
        "productId": "vt-kinh-3ly",
        "quantity": 13.28,
        "delta": 13.28
      },
      {
        "productId": "vt-mica-2ly",
        "quantity": 30,
        "delta": 30
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 40.4,
        "delta": 40.4
      },
      {
        "productId": "vt-go-tho",
        "quantity": 92,
        "delta": 92
      }
    ]
  },
  {
    "id": "pk-kiem_ke-03",
    "code": "PKK0000003",
    "type": "KIEM_KE",
    "date": "2026-08-01",
    "warehouseId": "wh-thanhpham",
    "reason": "Kiểm kê, nhập tồn đầu kỳ",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "sp-khung-soi-20x30",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-30x40",
        "quantity": 13,
        "delta": 13
      },
      {
        "productId": "sp-khung-soi-40x60",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-50x70",
        "quantity": 10,
        "delta": 10
      },
      {
        "productId": "sp-khung-soi-60x90",
        "quantity": 4,
        "delta": 4
      },
      {
        "productId": "sp-khung-nhom-vang-30x40",
        "quantity": 14,
        "delta": 14
      },
      {
        "productId": "sp-khung-nhom-den-40x60",
        "quantity": 14,
        "delta": 14
      },
      {
        "productId": "sp-khung-oc-cho-40x60",
        "quantity": 9,
        "delta": 9
      }
    ]
  },
  {
    "id": "pk-kiem_ke-02",
    "code": "PKK0000002",
    "type": "KIEM_KE",
    "date": "2026-08-01",
    "warehouseId": "wh-phukien",
    "reason": "Kiểm kê, nhập tồn đầu kỳ",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 1208,
        "delta": 1208
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 13.38,
        "delta": 13.38
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 229,
        "delta": 229
      },
      {
        "productId": "vt-keo-dan",
        "quantity": 19,
        "delta": 19
      }
    ]
  },
  {
    "id": "pk-kiem_ke-01",
    "code": "PKK0000001",
    "type": "KIEM_KE",
    "date": "2026-08-01",
    "warehouseId": "wh-ninhtrang",
    "reason": "Kiểm kê, nhập tồn đầu kỳ",
    "createdBy": "thu.kho@ninhtrang.local",
    "isCancelled": false,
    "lines": [
      {
        "productId": "vt-den-led",
        "quantity": 25,
        "delta": 25
      },
      {
        "productId": "vt-ve-sinh-kinh",
        "quantity": 2,
        "delta": 2
      }
    ]
  }
];
export const DEMO_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    "id": "lsx-39",
    "code": "LSX0000039",
    "sourceOrderId": "dh-23",
    "productId": "sp-khung-soi-20x30",
    "quantity": 3,
    "status": "NHAP",
    "createdDate": "2026-10-18"
  },
  {
    "id": "lsx-38",
    "code": "LSX0000038",
    "sourceOrderId": "dh-23",
    "productId": "sp-khung-soi-60x90",
    "quantity": 2,
    "status": "NHAP",
    "createdDate": "2026-10-18"
  },
  {
    "id": "lsx-37",
    "code": "LSX0000037",
    "sourceOrderId": "dh-22",
    "productId": "sp-kinh-cat",
    "quantity": 10,
    "status": "DANG_SAN_XUAT",
    "createdDate": "2026-10-17"
  },
  {
    "id": "lsx-36",
    "code": "LSX0000036",
    "sourceOrderId": "dh-22",
    "productId": "sp-khung-soi-50x70",
    "quantity": 20,
    "status": "DANG_SAN_XUAT",
    "createdDate": "2026-10-17"
  },
  {
    "id": "lsx-33",
    "code": "LSX0000033",
    "sourceOrderId": "dh-19",
    "productId": "sp-khung-nhom-den-40x60",
    "quantity": 24,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-16"
  },
  {
    "id": "lsx-35",
    "code": "LSX0000035",
    "sourceOrderId": "dh-21",
    "productId": "sp-khung-oc-cho-40x60",
    "quantity": 10,
    "status": "DANG_SAN_XUAT",
    "createdDate": "2026-10-15"
  },
  {
    "id": "lsx-34",
    "code": "LSX0000034",
    "sourceOrderId": "dh-21",
    "productId": "sp-khung-soi-40x60",
    "quantity": 30,
    "status": "DANG_SAN_XUAT",
    "createdDate": "2026-10-15"
  },
  {
    "id": "lsx-32",
    "code": "LSX0000032",
    "sourceOrderId": "dh-18",
    "productId": "sp-khung-soi-30x40",
    "quantity": 20,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-15"
  },
  {
    "id": "lsx-31",
    "code": "LSX0000031",
    "sourceOrderId": "dh-17",
    "productId": "sp-khung-soi-40x60",
    "quantity": 12,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-14"
  },
  {
    "id": "lsx-30",
    "code": "LSX0000030",
    "sourceOrderId": "dh-16",
    "productId": "sp-khung-soi-30x40",
    "quantity": 8,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-13"
  },
  {
    "id": "lsx-29",
    "code": "LSX0000029",
    "sourceOrderId": "dh-16",
    "productId": "sp-khung-nhom-vang-30x40",
    "quantity": 8,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-13"
  },
  {
    "id": "lsx-40",
    "code": "LSX0000040",
    "sourceOrderId": "dh-25",
    "productId": "sp-khung-soi-30x40",
    "quantity": 1,
    "status": "HUY",
    "createdDate": "2026-10-11"
  },
  {
    "id": "lsx-28",
    "code": "LSX0000028",
    "sourceOrderId": "dh-15",
    "productId": "sp-khung-soi-30x40",
    "quantity": 3,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-08"
  },
  {
    "id": "lsx-27",
    "code": "LSX0000027",
    "sourceOrderId": "dh-15",
    "productId": "sp-khung-nhom-vang-30x40",
    "quantity": 2,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-08"
  },
  {
    "id": "lsx-26",
    "code": "LSX0000026",
    "sourceOrderId": "dh-14",
    "productId": "sp-khung-soi-60x90",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-06"
  },
  {
    "id": "lsx-25",
    "code": "LSX0000025",
    "sourceOrderId": "dh-14",
    "productId": "sp-khung-soi-50x70",
    "quantity": 16,
    "status": "HOAN_TAT",
    "createdDate": "2026-10-06"
  },
  {
    "id": "lsx-24",
    "code": "LSX0000024",
    "sourceOrderId": "dh-13",
    "productId": "sp-khung-soi-30x40",
    "quantity": 1,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-26"
  },
  {
    "id": "lsx-23",
    "code": "LSX0000023",
    "sourceOrderId": "dh-13",
    "productId": "sp-khung-soi-60x90",
    "quantity": 1,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-26"
  },
  {
    "id": "lsx-22",
    "code": "LSX0000022",
    "sourceOrderId": "dh-12",
    "productId": "sp-khung-nhom-den-40x60",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-25"
  },
  {
    "id": "lsx-21",
    "code": "LSX0000021",
    "sourceOrderId": "dh-12",
    "productId": "sp-khung-oc-cho-40x60",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-25"
  },
  {
    "id": "lsx-20",
    "code": "LSX0000020",
    "sourceOrderId": "dh-11",
    "productId": "sp-khung-soi-50x70",
    "quantity": 12,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-23"
  },
  {
    "id": "lsx-19",
    "code": "LSX0000019",
    "sourceOrderId": "dh-11",
    "productId": "sp-khung-soi-40x60",
    "quantity": 24,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-23"
  },
  {
    "id": "lsx-18",
    "code": "LSX0000018",
    "sourceOrderId": "dh-10",
    "productId": "sp-khung-soi-30x40",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-13"
  },
  {
    "id": "lsx-17",
    "code": "LSX0000017",
    "sourceOrderId": "dh-10",
    "productId": "sp-khung-soi-20x30",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-13"
  },
  {
    "id": "lsx-16",
    "code": "LSX0000016",
    "sourceOrderId": "dh-09",
    "productId": "sp-mica-cat",
    "quantity": 6,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-11"
  },
  {
    "id": "lsx-15",
    "code": "LSX0000015",
    "sourceOrderId": "dh-09",
    "productId": "sp-khung-soi-40x60",
    "quantity": 15,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-11"
  },
  {
    "id": "lsx-14",
    "code": "LSX0000014",
    "sourceOrderId": "dh-08",
    "productId": "sp-khung-nhom-vang-30x40",
    "quantity": 3,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-02"
  },
  {
    "id": "lsx-13",
    "code": "LSX0000013",
    "sourceOrderId": "dh-07",
    "productId": "sp-khung-soi-30x40",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-01"
  },
  {
    "id": "lsx-12",
    "code": "LSX0000012",
    "sourceOrderId": "dh-07",
    "productId": "sp-khung-soi-40x60",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-09-01"
  },
  {
    "id": "lsx-11",
    "code": "LSX0000011",
    "sourceOrderId": "dh-06",
    "productId": "sp-khung-soi-20x30",
    "quantity": 4,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-31"
  },
  {
    "id": "lsx-08",
    "code": "LSX0000008",
    "sourceOrderId": "dh-04",
    "productId": "sp-kinh-cat",
    "quantity": 5,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-21"
  },
  {
    "id": "lsx-07",
    "code": "LSX0000007",
    "sourceOrderId": "dh-04",
    "productId": "sp-khung-oc-cho-40x60",
    "quantity": 8,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-21"
  },
  {
    "id": "lsx-06",
    "code": "LSX0000006",
    "sourceOrderId": "dh-04",
    "productId": "sp-khung-soi-60x90",
    "quantity": 12,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-21"
  },
  {
    "id": "lsx-10",
    "code": "LSX0000010",
    "sourceOrderId": "dh-05",
    "productId": "sp-khung-nhom-den-40x60",
    "quantity": 30,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-19"
  },
  {
    "id": "lsx-09",
    "code": "LSX0000009",
    "sourceOrderId": "dh-05",
    "productId": "sp-khung-soi-50x70",
    "quantity": 30,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-19"
  },
  {
    "id": "lsx-05",
    "code": "LSX0000005",
    "sourceOrderId": "dh-03",
    "productId": "sp-khung-nhom-vang-30x40",
    "quantity": 6,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-15"
  },
  {
    "id": "lsx-04",
    "code": "LSX0000004",
    "sourceOrderId": "dh-02",
    "productId": "sp-khung-soi-50x70",
    "quantity": 10,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-14"
  },
  {
    "id": "lsx-03",
    "code": "LSX0000003",
    "sourceOrderId": "dh-02",
    "productId": "sp-khung-soi-40x60",
    "quantity": 20,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-14"
  },
  {
    "id": "lsx-02",
    "code": "LSX0000002",
    "sourceOrderId": "dh-01",
    "productId": "sp-khung-soi-40x60",
    "quantity": 1,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-13"
  },
  {
    "id": "lsx-01",
    "code": "LSX0000001",
    "sourceOrderId": "dh-01",
    "productId": "sp-khung-soi-30x40",
    "quantity": 2,
    "status": "HOAN_TAT",
    "createdDate": "2026-08-13"
  }
];
export const DEMO_SUPPLIERS: Supplier[] = [
  {
    "id": "ncc-1",
    "code": "NCC0000001",
    "name": "Công ty TNHH Gỗ Phú Thịnh",
    "contactPhone": "0901000101",
    "taxCode": "0300000011",
    "address": "45 Đường số 7, KCN Vĩnh Lộc, TP.HCM",
    "creditAllowed": true,
    "productCount": 3,
    "purchaseOrderCount": 2,
    "isActive": true
  },
  {
    "id": "ncc-2",
    "code": "NCC0000002",
    "name": "Nhôm Việt Phát",
    "contactPhone": "0901000102",
    "taxCode": "0300000012",
    "address": "18 Quốc lộ 1A, Bình Tân, TP.HCM",
    "creditAllowed": true,
    "productCount": 2,
    "purchaseOrderCount": 2,
    "isActive": true
  },
  {
    "id": "ncc-3",
    "code": "NCC0000003",
    "name": "Kính Hoàng Gia",
    "contactPhone": "0901000103",
    "taxCode": "0300000013",
    "address": "112 Nguyễn Văn Linh, Quận 7, TP.HCM",
    "creditAllowed": true,
    "productCount": 3,
    "purchaseOrderCount": 2,
    "isActive": true
  },
  {
    "id": "ncc-4",
    "code": "NCC0000004",
    "name": "Phụ kiện Minh Tâm",
    "contactPhone": "0901000104",
    "taxCode": "0300000014",
    "address": "9 Lý Chiêu Hoàng, Quận 6, TP.HCM",
    "creditAllowed": false,
    "productCount": 7,
    "purchaseOrderCount": 2,
    "isActive": true
  },
  {
    "id": "ncc-5",
    "code": "NCC0000005",
    "name": "Xưởng gỗ Tư Hiển",
    "contactPhone": "0901000105",
    "address": "Ấp 3, Bình Chánh, TP.HCM",
    "creditAllowed": false,
    "productCount": 1,
    "purchaseOrderCount": 1,
    "isActive": false
  }
];
export const DEMO_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    "id": "dn-07",
    "code": "DN0000007",
    "supplierId": "ncc-2",
    "date": "2026-10-14",
    "status": "NHAP",
    "totalValue": 7050000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 0,
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 150,
        "unitPrice": 47000,
        "receivedQuantity": 0
      }
    ]
  },
  {
    "id": "dn-09",
    "code": "DN0000009",
    "supplierId": "ncc-4",
    "date": "2026-10-10",
    "status": "HOAN_TAT",
    "totalValue": 3120000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 3120000,
    "receivedDate": "2026-10-13",
    "lines": [
      {
        "productId": "vt-den-led",
        "quantity": 30,
        "unitPrice": 95000,
        "receivedQuantity": 30
      },
      {
        "productId": "vt-ve-sinh-kinh",
        "quantity": 15,
        "unitPrice": 18000,
        "receivedQuantity": 15
      }
    ]
  },
  {
    "id": "dn-06",
    "code": "DN0000006",
    "supplierId": "ncc-3",
    "date": "2026-10-05",
    "status": "DA_GUI_NCC",
    "totalValue": 40040000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 0,
    "lines": [
      {
        "productId": "vt-kinh-3ly",
        "quantity": 80,
        "unitPrice": 168000,
        "receivedQuantity": 0
      },
      {
        "productId": "vt-mica-2ly",
        "quantity": 40,
        "unitPrice": 425000,
        "receivedQuantity": 0
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 100,
        "unitPrice": 96000,
        "receivedQuantity": 0
      }
    ]
  },
  {
    "id": "dn-05",
    "code": "DN0000005",
    "supplierId": "ncc-1",
    "date": "2026-09-15",
    "status": "NHAN_MOT_PHAN",
    "totalValue": 24360000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 18510000,
    "receivedDate": "2026-09-22",
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 400,
        "unitPrice": 39000,
        "receivedQuantity": 250
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 120,
        "unitPrice": 73000,
        "receivedQuantity": 120
      }
    ]
  },
  {
    "id": "dn-04",
    "code": "DN0000004",
    "supplierId": "ncc-4",
    "date": "2026-08-20",
    "status": "HOAN_TAT",
    "totalValue": 5800000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 5800000,
    "receivedDate": "2026-08-23",
    "lines": [
      {
        "productId": "vt-moc-treo",
        "quantity": 3000,
        "unitPrice": 600,
        "receivedQuantity": 3000
      },
      {
        "productId": "vt-dinh-ghim",
        "quantity": 40,
        "unitPrice": 28000,
        "receivedQuantity": 40
      },
      {
        "productId": "vt-day-thep",
        "quantity": 10,
        "unitPrice": 22000,
        "receivedQuantity": 10
      },
      {
        "productId": "vt-kep-kinh",
        "quantity": 400,
        "unitPrice": 3500,
        "receivedQuantity": 400
      },
      {
        "productId": "vt-keo-dan",
        "quantity": 30,
        "unitPrice": 42000,
        "receivedQuantity": 30
      }
    ]
  },
  {
    "id": "dn-08",
    "code": "DN0000008",
    "supplierId": "ncc-5",
    "date": "2026-08-12",
    "status": "HUY",
    "totalValue": 6200000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 0,
    "lines": [
      {
        "productId": "vt-go-tho",
        "quantity": 200,
        "unitPrice": 31000,
        "receivedQuantity": 0
      }
    ]
  },
  {
    "id": "dn-03",
    "code": "DN0000003",
    "supplierId": "ncc-3",
    "date": "2026-08-10",
    "status": "DA_NHAN_DU",
    "totalValue": 30100000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 30100000,
    "receivedDate": "2026-08-15",
    "lines": [
      {
        "productId": "vt-kinh-3ly",
        "quantity": 60,
        "unitPrice": 165000,
        "receivedQuantity": 60
      },
      {
        "productId": "vt-mica-2ly",
        "quantity": 30,
        "unitPrice": 420000,
        "receivedQuantity": 30
      },
      {
        "productId": "vt-hau-mdf",
        "quantity": 80,
        "unitPrice": 95000,
        "receivedQuantity": 80
      }
    ]
  },
  {
    "id": "dn-02",
    "code": "DN0000002",
    "supplierId": "ncc-2",
    "date": "2026-08-04",
    "status": "HOAN_TAT",
    "totalValue": 19600000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 19600000,
    "receivedDate": "2026-08-09",
    "lines": [
      {
        "productId": "vt-nhom-vang",
        "quantity": 200,
        "unitPrice": 46000,
        "receivedQuantity": 200
      },
      {
        "productId": "vt-nhom-den",
        "quantity": 200,
        "unitPrice": 52000,
        "receivedQuantity": 200
      }
    ]
  },
  {
    "id": "dn-01",
    "code": "DN0000001",
    "supplierId": "ncc-1",
    "date": "2026-08-02",
    "status": "HOAN_TAT",
    "totalValue": 23100000,
    "createdBy": "quan.ly@ninhtrang.local",
    "receivedValue": 23100000,
    "receivedDate": "2026-08-06",
    "lines": [
      {
        "productId": "vt-nep-soi",
        "quantity": 300,
        "unitPrice": 38000,
        "receivedQuantity": 300
      },
      {
        "productId": "vt-nep-oc-cho",
        "quantity": 100,
        "unitPrice": 72000,
        "receivedQuantity": 100
      },
      {
        "productId": "vt-go-tho",
        "quantity": 150,
        "unitPrice": 30000,
        "receivedQuantity": 150
      }
    ]
  }
];
export const DEMO_CUSTOMERS: Customer[] = [
  {
    "id": "kh-01",
    "code": "KH0000001",
    "name": "Nguyễn Thị Mai Anh",
    "type": "LE",
    "creditDays": 0,
    "phone": "0912000001",
    "email": "maianh.demo@example.com",
    "tagIds": [
      "tag-quen"
    ],
    "orderCount": 3,
    "isActive": true
  },
  {
    "id": "kh-02",
    "code": "KH0000002",
    "name": "Trần Quốc Bảo",
    "type": "LE",
    "creditDays": 0,
    "phone": "0912000002",
    "tagIds": [],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-03",
    "code": "KH0000003",
    "name": "Lê Ánh Dương",
    "companyName": "Cửa hàng Tranh Ánh Dương",
    "type": "SI",
    "creditDays": 15,
    "phone": "0912000003",
    "companyTaxCode": "8000000003",
    "note": "Khách sỉ lớn, thanh toán 15 ngày.",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderCount": 3,
    "isActive": true
  },
  {
    "id": "kh-04",
    "code": "KH0000004",
    "name": "Phạm Hồng Phúc",
    "companyName": "Công ty TNHH Studio Hình Xưa",
    "type": "SI",
    "creditDays": 30,
    "phone": "0912000004",
    "email": "studio.demo@example.com",
    "companyTaxCode": "0310000004",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderCount": 3,
    "isActive": true
  },
  {
    "id": "kh-05",
    "code": "KH0000005",
    "name": "Võ Thị Thu Hà",
    "type": "DROPSHIP",
    "creditDays": 0,
    "phone": "0912000005",
    "tagIds": [
      "tag-shopee"
    ],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-06",
    "code": "KH0000006",
    "name": "Đặng Thuỳ Linh",
    "companyName": "Shop Decor Nhà Nhỏ",
    "type": "DROPSHIP",
    "creditDays": 7,
    "phone": "0912000006",
    "tagIds": [
      "tag-shopee"
    ],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-07",
    "code": "KH0000007",
    "name": "Hoàng Văn Thắng",
    "companyName": "Công ty CP Khách sạn Hoa Sen",
    "type": "SI",
    "creditDays": 30,
    "phone": "0912000007",
    "companyTaxCode": "0311000007",
    "note": "Cần xuất hoá đơn VAT.",
    "tagIds": [
      "tag-si"
    ],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-08",
    "code": "KH0000008",
    "name": "Bùi Thị Cúc",
    "companyName": "Trường Mầm non Hướng Dương",
    "type": "SI",
    "creditDays": 30,
    "phone": "0912000008",
    "tagIds": [],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-09",
    "code": "KH0000009",
    "name": "Ngô Thanh Tùng",
    "type": "LE",
    "creditDays": 0,
    "phone": "0912000009",
    "tagIds": [
      "tag-quen"
    ],
    "orderCount": 3,
    "isActive": true
  },
  {
    "id": "kh-10",
    "code": "KH0000010",
    "name": "Đỗ Minh Khôi",
    "companyName": "Phòng tranh Đồng Xanh",
    "type": "SI",
    "creditDays": 15,
    "phone": "0912000010",
    "companyTaxCode": "0312000010",
    "tagIds": [
      "tag-si"
    ],
    "orderCount": 2,
    "isActive": true
  },
  {
    "id": "kh-11",
    "code": "KH0000011",
    "name": "Lương Hải Yến",
    "type": "LE",
    "creditDays": 0,
    "phone": "0912000011",
    "note": "Không còn liên lạc được.",
    "tagIds": [],
    "orderCount": 0,
    "isActive": false
  },
  {
    "id": "kh-12",
    "code": "KH0000012",
    "name": "Trịnh Văn Lộc",
    "companyName": "Nhà hàng Bến Đò",
    "type": "SI",
    "creditDays": 15,
    "phone": "0912000012",
    "tagIds": [
      "tag-si"
    ],
    "orderCount": 2,
    "isActive": true
  }
];
export const DEMO_SALES_ORDERS: SalesOrder[] = [
  {
    "id": "dh-26",
    "code": "DH0000026",
    "customerId": "kh-01",
    "source": "Zalo",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-10-18",
    "neededByDate": "2026-10-28",
    "status": "CHO_SAN_XUAT",
    "lines": [
      {
        "id": "dh-26-l1",
        "productId": "sp-khung-oc-cho-40x60",
        "unit": "Cái",
        "quantity": 1,
        "unitPrice": 480000,
        "lineTotal": 480000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-26-l2",
        "productId": "dv-cong-dong",
        "unit": "Lần",
        "quantity": 1,
        "unitPrice": 50000,
        "lineTotal": 50000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 530000,
    "totalOrder": 530000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-24",
    "code": "DH0000024",
    "customerId": "kh-04",
    "source": "Email",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-10-17",
    "neededByDate": "2026-10-27",
    "status": "CHO_SAN_XUAT",
    "lines": [
      {
        "id": "dh-24-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 40,
        "unitPrice": 251000,
        "lineTotal": 10040000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-24-l2",
        "productId": "sp-mica-cat",
        "unit": "Tấm",
        "quantity": 12,
        "unitPrice": 150000,
        "lineTotal": 1800000,
        "length": 70,
        "width": 100,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 11840000,
    "totalOrder": 11840000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-23",
    "code": "DH0000023",
    "customerId": "kh-02",
    "source": "Facebook",
    "tagIds": [],
    "orderDate": "2026-10-17",
    "neededByDate": "2026-10-27",
    "status": "CHO_SAN_XUAT",
    "lines": [
      {
        "id": "dh-23-l1",
        "productId": "sp-khung-soi-60x90",
        "unit": "Cái",
        "quantity": 2,
        "unitPrice": 650000,
        "lineTotal": 1300000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-23-l2",
        "productId": "sp-khung-soi-20x30",
        "unit": "Cái",
        "quantity": 3,
        "unitPrice": 120000,
        "lineTotal": 360000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 1660000,
    "totalOrder": 1660000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-22",
    "code": "DH0000022",
    "customerId": "kh-08",
    "source": "Điện thoại",
    "tagIds": [],
    "orderDate": "2026-10-16",
    "neededByDate": "2026-10-26",
    "status": "DANG_SAN_XUAT",
    "lines": [
      {
        "id": "dh-22-l1",
        "productId": "sp-khung-soi-50x70",
        "unit": "Cái",
        "quantity": 20,
        "unitPrice": 357000,
        "lineTotal": 7140000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-22-l2",
        "productId": "sp-kinh-cat",
        "unit": "Tấm",
        "quantity": 10,
        "unitPrice": 100000,
        "lineTotal": 1000000,
        "length": 100,
        "width": 150,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 8140000,
    "totalOrder": 8140000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-20",
    "code": "DH0000020",
    "customerId": "kh-06",
    "recipientName": "Hồ Thị Sen",
    "recipientPhone": "0988000444",
    "source": "Shopee",
    "tagIds": [
      "tag-shopee"
    ],
    "orderDate": "2026-10-16",
    "neededByDate": "2026-10-26",
    "status": "CHO_GIAO_HANG",
    "lines": [
      {
        "id": "dh-20-l1",
        "productId": "vt-den-led",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 148000,
        "lineTotal": 1480000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-20-l2",
        "productId": "vt-moc-treo",
        "unit": "Cái",
        "quantity": 200,
        "unitPrice": 1200,
        "lineTotal": 240000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 1720000,
    "totalOrder": 1720000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-19",
    "code": "DH0000019",
    "customerId": "kh-07",
    "source": "Điện thoại",
    "tagIds": [
      "tag-si"
    ],
    "orderDate": "2026-10-15",
    "neededByDate": "2026-10-25",
    "status": "CHO_GIAO_HANG",
    "lines": [
      {
        "id": "dh-19-l1",
        "productId": "sp-khung-nhom-den-40x60",
        "unit": "Cái",
        "quantity": 24,
        "unitPrice": 281000,
        "lineTotal": 6744000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 6744000,
    "totalOrder": 6744000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-21",
    "code": "DH0000021",
    "customerId": "kh-03",
    "description": "Khách đặt cọc 5.000.000 đ",
    "source": "Khách quen",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-10-14",
    "neededByDate": "2026-10-24",
    "status": "DANG_SAN_XUAT",
    "lines": [
      {
        "id": "dh-21-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 30,
        "unitPrice": 251000,
        "lineTotal": 7530000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-21-l2",
        "productId": "sp-khung-oc-cho-40x60",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 408000,
        "lineTotal": 4080000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 11610000,
    "totalOrder": 11610000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-18",
    "code": "DH0000018",
    "customerId": "kh-10",
    "description": "Khách cần gấp, giao trước thứ Năm",
    "source": "Zalo",
    "tagIds": [
      "tag-si",
      "tag-gap"
    ],
    "orderDate": "2026-10-14",
    "neededByDate": "2026-10-24",
    "status": "CHO_GIAO_HANG",
    "lines": [
      {
        "id": "dh-18-l1",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 20,
        "unitPrice": 157000,
        "lineTotal": 3140000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-18-l2",
        "productId": "vt-nep-soi",
        "unit": "Bó",
        "quantity": 2,
        "unitPrice": 408000,
        "lineTotal": 816000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 3956000,
    "totalOrder": 3956000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-9",
    "receivedValue": 0
  },
  {
    "id": "dh-17",
    "code": "DH0000017",
    "customerId": "kh-12",
    "source": "Điện thoại",
    "tagIds": [
      "tag-si"
    ],
    "orderDate": "2026-10-13",
    "neededByDate": "2026-10-23",
    "status": "DANG_GIAO",
    "lines": [
      {
        "id": "dh-17-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 12,
        "unitPrice": 251000,
        "lineTotal": 3012000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 3012000,
    "totalOrder": 3012000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-8",
    "receivedValue": 0
  },
  {
    "id": "dh-16",
    "code": "DH0000016",
    "customerId": "kh-05",
    "recipientName": "Lý Thị Mận",
    "recipientPhone": "0988000333",
    "source": "Shopee",
    "tagIds": [
      "tag-shopee"
    ],
    "orderDate": "2026-10-12",
    "neededByDate": "2026-10-22",
    "status": "DANG_GIAO",
    "lines": [
      {
        "id": "dh-16-l1",
        "productId": "sp-khung-nhom-vang-30x40",
        "unit": "Cái",
        "quantity": 8,
        "unitPrice": 193000,
        "lineTotal": 1544000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-16-l2",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 8,
        "unitPrice": 170000,
        "lineTotal": 1360000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 2904000,
    "totalOrder": 2904000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-8",
    "receivedValue": 0
  },
  {
    "id": "dh-25",
    "code": "DH0000025",
    "customerId": "kh-09",
    "description": "Khách huỷ vì đổi cỡ tranh",
    "source": "Facebook",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-10-10",
    "status": "HUY",
    "lines": [
      {
        "id": "dh-25-l1",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 1,
        "unitPrice": 185000,
        "lineTotal": 185000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 185000,
    "totalOrder": 185000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "receivedValue": 0
  },
  {
    "id": "dh-15",
    "code": "DH0000015",
    "customerId": "kh-09",
    "source": "Facebook",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-10-07",
    "neededByDate": "2026-10-17",
    "status": "DANG_GIAO",
    "lines": [
      {
        "id": "dh-15-l1",
        "productId": "sp-khung-nhom-vang-30x40",
        "unit": "Cái",
        "quantity": 2,
        "unitPrice": 210000,
        "lineTotal": 420000,
        "receivedQuantity": 0
      },
      {
        "id": "dh-15-l2",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 3,
        "unitPrice": 185000,
        "lineTotal": 555000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 975000,
    "totalOrder": 975000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-7",
    "receivedValue": 0
  },
  {
    "id": "dh-14",
    "code": "DH0000014",
    "customerId": "kh-04",
    "source": "Email",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-10-05",
    "neededByDate": "2026-10-15",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-14-l1",
        "productId": "sp-khung-soi-50x70",
        "unit": "Cái",
        "quantity": 16,
        "unitPrice": 357000,
        "lineTotal": 5712000,
        "receivedQuantity": 16
      },
      {
        "id": "dh-14-l2",
        "productId": "sp-khung-soi-60x90",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 553000,
        "lineTotal": 5530000,
        "receivedQuantity": 10
      }
    ],
    "discountAmount": 0,
    "totalGoods": 11242000,
    "totalOrder": 11242000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-7",
    "deliveredDate": "2026-10-12",
    "receivedValue": 11242000,
    "dueDate": "2026-11-11"
  },
  {
    "id": "dh-13",
    "code": "DH0000013",
    "customerId": "kh-01",
    "source": "Zalo",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-09-25",
    "neededByDate": "2026-10-05",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-13-l1",
        "productId": "sp-khung-soi-60x90",
        "unit": "Cái",
        "quantity": 1,
        "unitPrice": 650000,
        "lineTotal": 650000,
        "receivedQuantity": 1
      },
      {
        "id": "dh-13-l2",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 1,
        "unitPrice": 185000,
        "lineTotal": 185000,
        "receivedQuantity": 1
      },
      {
        "id": "dh-13-l3",
        "productId": "vt-keo-dan",
        "unit": "Chai",
        "quantity": 1,
        "unitPrice": 65000,
        "lineTotal": 65000,
        "receivedQuantity": 1
      },
      {
        "id": "dh-13-l4",
        "productId": "vt-ve-sinh-kinh",
        "unit": "Bộ",
        "quantity": 2,
        "unitPrice": 35000,
        "lineTotal": 70000,
        "receivedQuantity": 2
      }
    ],
    "discountAmount": 0,
    "totalGoods": 970000,
    "totalOrder": 970000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-5",
    "deliveredDate": "2026-09-30",
    "receivedValue": 970000,
    "dueDate": "2026-09-30"
  },
  {
    "id": "dh-12",
    "code": "DH0000012",
    "customerId": "kh-03",
    "source": "Khách quen",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-09-24",
    "neededByDate": "2026-10-04",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-12-l1",
        "productId": "sp-khung-oc-cho-40x60",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 408000,
        "lineTotal": 4080000,
        "receivedQuantity": 10
      },
      {
        "id": "dh-12-l2",
        "productId": "sp-khung-nhom-den-40x60",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 281000,
        "lineTotal": 2810000,
        "receivedQuantity": 10
      }
    ],
    "discountAmount": 0,
    "totalGoods": 6890000,
    "totalOrder": 6890000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-5",
    "deliveredDate": "2026-09-30",
    "receivedValue": 6890000,
    "dueDate": "2026-10-15"
  },
  {
    "id": "dh-11",
    "code": "DH0000011",
    "customerId": "kh-08",
    "source": "Điện thoại",
    "tagIds": [],
    "orderDate": "2026-09-22",
    "neededByDate": "2026-10-02",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-11-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 24,
        "unitPrice": 251000,
        "lineTotal": 6024000,
        "receivedQuantity": 24
      },
      {
        "id": "dh-11-l2",
        "productId": "sp-khung-soi-50x70",
        "unit": "Cái",
        "quantity": 12,
        "unitPrice": 357000,
        "lineTotal": 4284000,
        "receivedQuantity": 12
      },
      {
        "id": "dh-11-l3",
        "productId": "dv-cong-dong",
        "unit": "Lần",
        "quantity": 1,
        "unitPrice": 45000,
        "lineTotal": 45000,
        "receivedQuantity": 1
      }
    ],
    "discountAmount": 800000,
    "totalGoods": 10353000,
    "totalOrder": 9553000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-5",
    "deliveredDate": "2026-09-30",
    "receivedValue": 9553000,
    "dueDate": "2026-10-30"
  },
  {
    "id": "dh-10",
    "code": "DH0000010",
    "customerId": "kh-06",
    "recipientName": "Phạm Văn Đức",
    "recipientPhone": "0988000222",
    "source": "Shopee",
    "tagIds": [
      "tag-shopee"
    ],
    "orderDate": "2026-09-12",
    "neededByDate": "2026-09-22",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-10-l1",
        "productId": "sp-khung-soi-20x30",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 110000,
        "lineTotal": 1100000,
        "receivedQuantity": 10
      },
      {
        "id": "dh-10-l2",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 170000,
        "lineTotal": 1700000,
        "receivedQuantity": 10
      }
    ],
    "discountAmount": 0,
    "totalGoods": 2800000,
    "totalOrder": 2800000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-4",
    "deliveredDate": "2026-09-18",
    "receivedValue": 2800000,
    "dueDate": "2026-09-25"
  },
  {
    "id": "dh-09",
    "code": "DH0000009",
    "customerId": "kh-12",
    "source": "Điện thoại",
    "tagIds": [
      "tag-si"
    ],
    "orderDate": "2026-09-10",
    "neededByDate": "2026-09-20",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-09-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 15,
        "unitPrice": 251000,
        "lineTotal": 3765000,
        "receivedQuantity": 15
      },
      {
        "id": "dh-09-l2",
        "productId": "sp-mica-cat",
        "unit": "Tấm",
        "quantity": 6,
        "unitPrice": 150000,
        "lineTotal": 900000,
        "length": 60,
        "width": 90,
        "receivedQuantity": 6
      }
    ],
    "discountAmount": 0,
    "totalGoods": 4665000,
    "totalOrder": 4665000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-4",
    "deliveredDate": "2026-09-18",
    "receivedValue": 4665000,
    "dueDate": "2026-10-03"
  },
  {
    "id": "dh-08",
    "code": "DH0000008",
    "customerId": "kh-02",
    "description": "Khách đổi ý, trả toàn bộ",
    "source": "Facebook",
    "tagIds": [],
    "orderDate": "2026-09-01",
    "neededByDate": "2026-09-11",
    "status": "TRA_TOAN_BO",
    "lines": [
      {
        "id": "dh-08-l1",
        "productId": "sp-khung-nhom-vang-30x40",
        "unit": "Cái",
        "quantity": 3,
        "unitPrice": 210000,
        "lineTotal": 630000,
        "receivedQuantity": 0
      }
    ],
    "discountAmount": 0,
    "totalGoods": 630000,
    "totalOrder": 630000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-3",
    "deliveredDate": "2026-09-05",
    "receivedValue": 0
  },
  {
    "id": "dh-07",
    "code": "DH0000007",
    "customerId": "kh-10",
    "description": "3 khung 40×60 bị nứt góc, khách trả lại",
    "source": "Zalo",
    "tagIds": [
      "tag-si"
    ],
    "orderDate": "2026-08-31",
    "neededByDate": "2026-09-10",
    "status": "GIAO_MOT_PHAN",
    "lines": [
      {
        "id": "dh-07-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 251000,
        "lineTotal": 2510000,
        "receivedQuantity": 7
      },
      {
        "id": "dh-07-l2",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 157000,
        "lineTotal": 1570000,
        "receivedQuantity": 10
      }
    ],
    "discountAmount": 0,
    "totalGoods": 4080000,
    "totalOrder": 4080000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-3",
    "deliveredDate": "2026-09-05",
    "receivedValue": 3327000,
    "dueDate": "2026-09-20"
  },
  {
    "id": "dh-06",
    "code": "DH0000006",
    "customerId": "kh-09",
    "source": "Facebook",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-08-30",
    "neededByDate": "2026-09-09",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-06-l1",
        "productId": "sp-khung-soi-20x30",
        "unit": "Cái",
        "quantity": 4,
        "unitPrice": 120000,
        "lineTotal": 480000,
        "receivedQuantity": 4
      }
    ],
    "discountAmount": 0,
    "totalGoods": 480000,
    "totalOrder": 480000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-3",
    "deliveredDate": "2026-09-05",
    "receivedValue": 480000,
    "dueDate": "2026-09-05"
  },
  {
    "id": "dh-04",
    "code": "DH0000004",
    "customerId": "kh-04",
    "source": "Email",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-08-20",
    "neededByDate": "2026-08-30",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-04-l1",
        "productId": "sp-khung-soi-60x90",
        "unit": "Cái",
        "quantity": 12,
        "unitPrice": 553000,
        "lineTotal": 6636000,
        "receivedQuantity": 12
      },
      {
        "id": "dh-04-l2",
        "productId": "sp-khung-oc-cho-40x60",
        "unit": "Cái",
        "quantity": 8,
        "unitPrice": 408000,
        "lineTotal": 3264000,
        "receivedQuantity": 8
      },
      {
        "id": "dh-04-l3",
        "productId": "sp-kinh-cat",
        "unit": "Tấm",
        "quantity": 5,
        "unitPrice": 100000,
        "lineTotal": 500000,
        "length": 80,
        "width": 120,
        "receivedQuantity": 5
      }
    ],
    "discountAmount": 1000000,
    "totalGoods": 10400000,
    "totalOrder": 9400000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-2",
    "deliveredDate": "2026-08-28",
    "receivedValue": 9400000,
    "dueDate": "2026-09-27"
  },
  {
    "id": "dh-05",
    "code": "DH0000005",
    "customerId": "kh-07",
    "description": "Khung tranh cho 60 phòng khách sạn",
    "source": "Điện thoại",
    "tagIds": [
      "tag-si"
    ],
    "orderDate": "2026-08-18",
    "neededByDate": "2026-08-28",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-05-l1",
        "productId": "sp-khung-soi-50x70",
        "unit": "Cái",
        "quantity": 30,
        "unitPrice": 357000,
        "lineTotal": 10710000,
        "receivedQuantity": 30
      },
      {
        "id": "dh-05-l2",
        "productId": "sp-khung-nhom-den-40x60",
        "unit": "Cái",
        "quantity": 30,
        "unitPrice": 281000,
        "lineTotal": 8430000,
        "receivedQuantity": 30
      }
    ],
    "discountAmount": 0,
    "totalGoods": 19140000,
    "totalOrder": 19140000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-2",
    "deliveredDate": "2026-08-28",
    "receivedValue": 19140000,
    "dueDate": "2026-09-27"
  },
  {
    "id": "dh-03",
    "code": "DH0000003",
    "customerId": "kh-05",
    "recipientName": "Nguyễn Thị Hạnh",
    "recipientPhone": "0988000111",
    "source": "Shopee",
    "tagIds": [
      "tag-shopee"
    ],
    "orderDate": "2026-08-14",
    "neededByDate": "2026-08-24",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-03-l1",
        "productId": "sp-khung-nhom-vang-30x40",
        "unit": "Cái",
        "quantity": 6,
        "unitPrice": 193000,
        "lineTotal": 1158000,
        "receivedQuantity": 6
      },
      {
        "id": "dh-03-l2",
        "productId": "vt-den-led",
        "unit": "Cái",
        "quantity": 6,
        "unitPrice": 148000,
        "lineTotal": 888000,
        "receivedQuantity": 6
      }
    ],
    "discountAmount": 0,
    "totalGoods": 2046000,
    "totalOrder": 2046000,
    "salesRep": "sale2@ninhtrang.local",
    "createdBy": "sale2@ninhtrang.local",
    "tripId": "ch-1",
    "deliveredDate": "2026-08-20",
    "receivedValue": 2046000,
    "dueDate": "2026-08-20"
  },
  {
    "id": "dh-02",
    "code": "DH0000002",
    "customerId": "kh-03",
    "source": "Khách quen",
    "tagIds": [
      "tag-vip",
      "tag-si"
    ],
    "orderDate": "2026-08-13",
    "neededByDate": "2026-08-23",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-02-l1",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 20,
        "unitPrice": 251000,
        "lineTotal": 5020000,
        "receivedQuantity": 20
      },
      {
        "id": "dh-02-l2",
        "productId": "sp-khung-soi-50x70",
        "unit": "Cái",
        "quantity": 10,
        "unitPrice": 357000,
        "lineTotal": 3570000,
        "receivedQuantity": 10
      }
    ],
    "discountAmount": 500000,
    "totalGoods": 8590000,
    "totalOrder": 8090000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-1",
    "deliveredDate": "2026-08-20",
    "receivedValue": 8090000,
    "dueDate": "2026-09-04"
  },
  {
    "id": "dh-01",
    "code": "DH0000001",
    "customerId": "kh-01",
    "description": "Khung treo phòng khách",
    "source": "Zalo",
    "tagIds": [
      "tag-quen"
    ],
    "orderDate": "2026-08-12",
    "neededByDate": "2026-08-22",
    "status": "HOAN_THANH",
    "lines": [
      {
        "id": "dh-01-l1",
        "productId": "sp-khung-soi-30x40",
        "unit": "Cái",
        "quantity": 2,
        "unitPrice": 185000,
        "lineTotal": 370000,
        "receivedQuantity": 2
      },
      {
        "id": "dh-01-l2",
        "productId": "sp-khung-soi-40x60",
        "unit": "Cái",
        "quantity": 1,
        "unitPrice": 295000,
        "lineTotal": 295000,
        "receivedQuantity": 1
      }
    ],
    "discountAmount": 0,
    "totalGoods": 665000,
    "totalOrder": 665000,
    "salesRep": "sale1@ninhtrang.local",
    "createdBy": "sale1@ninhtrang.local",
    "tripId": "ch-1",
    "deliveredDate": "2026-08-20",
    "receivedValue": 665000,
    "dueDate": "2026-08-20"
  }
];
export const DEMO_DELIVERY_TRIPS: DeliveryTrip[] = [
  {
    "id": "ch-10",
    "code": "CH0000010",
    "date": "2026-10-19",
    "status": "GOM_DON",
    "orderIds": [],
    "totalValue": 0,
    "confirmedCount": 0,
    "receivedValue": 0
  },
  {
    "id": "ch-9",
    "code": "CH0000009",
    "date": "2026-10-19",
    "driverName": "Đặng Văn Tài",
    "plateNumber": "51C-123.45",
    "status": "GOM_DON",
    "orderIds": [
      "dh-18"
    ],
    "totalValue": 3956000,
    "vehicleId": "xe-1",
    "confirmedCount": 0,
    "receivedValue": 0
  },
  {
    "id": "ch-8",
    "code": "CH0000008",
    "date": "2026-10-17",
    "driverName": "Lý Văn Sáu",
    "plateNumber": "51D-678.90",
    "status": "DA_XUAT_KHO",
    "orderIds": [
      "dh-16",
      "dh-17"
    ],
    "totalValue": 5916000,
    "vehicleId": "xe-2",
    "confirmedCount": 0,
    "receivedValue": 0
  },
  {
    "id": "ch-7",
    "code": "CH0000007",
    "date": "2026-10-12",
    "driverName": "Đặng Văn Tài",
    "plateNumber": "51C-123.45",
    "status": "XE_VE_KHO",
    "orderIds": [
      "dh-14",
      "dh-15"
    ],
    "totalValue": 12217000,
    "vehicleId": "xe-1",
    "confirmedCount": 1,
    "receivedValue": 11242000
  },
  {
    "id": "ch-6",
    "code": "CH0000006",
    "date": "2026-10-08",
    "driverName": "Nguyễn Văn Bốn",
    "plateNumber": "60C-777.77",
    "status": "HUY",
    "orderIds": [],
    "totalValue": 0,
    "confirmedCount": 0,
    "receivedValue": 0
  },
  {
    "id": "ch-5",
    "code": "CH0000005",
    "date": "2026-09-30",
    "driverName": "Lý Văn Sáu",
    "plateNumber": "51D-678.90",
    "status": "HOAN_TAT",
    "orderIds": [
      "dh-11",
      "dh-12",
      "dh-13"
    ],
    "totalValue": 17413000,
    "vehicleId": "xe-2",
    "confirmedCount": 3,
    "receivedValue": 17413000
  },
  {
    "id": "ch-4",
    "code": "CH0000004",
    "date": "2026-09-18",
    "driverName": "Đặng Văn Tài",
    "plateNumber": "51C-123.45",
    "status": "HOAN_TAT",
    "orderIds": [
      "dh-09",
      "dh-10"
    ],
    "totalValue": 7465000,
    "vehicleId": "xe-1",
    "confirmedCount": 2,
    "receivedValue": 7465000
  },
  {
    "id": "ch-3",
    "code": "CH0000003",
    "date": "2026-09-05",
    "driverName": "Đặng Văn Tài",
    "plateNumber": "51C-123.45",
    "status": "HOAN_TAT",
    "orderIds": [
      "dh-06",
      "dh-07",
      "dh-08"
    ],
    "totalValue": 5190000,
    "vehicleId": "xe-1",
    "confirmedCount": 3,
    "receivedValue": 3807000
  },
  {
    "id": "ch-2",
    "code": "CH0000002",
    "date": "2026-08-28",
    "driverName": "Lý Văn Sáu",
    "plateNumber": "51D-678.90",
    "status": "HOAN_TAT",
    "orderIds": [
      "dh-04",
      "dh-05"
    ],
    "totalValue": 28540000,
    "vehicleId": "xe-2",
    "confirmedCount": 2,
    "receivedValue": 28540000
  },
  {
    "id": "ch-1",
    "code": "CH0000001",
    "date": "2026-08-20",
    "driverName": "Đặng Văn Tài",
    "plateNumber": "51C-123.45",
    "status": "HOAN_TAT",
    "orderIds": [
      "dh-01",
      "dh-02",
      "dh-03"
    ],
    "totalValue": 10801000,
    "vehicleId": "xe-1",
    "confirmedCount": 3,
    "receivedValue": 10801000
  }
];
export const DEMO_VEHICLES: Vehicle[] = [
  {
    "id": "xe-1",
    "code": "XE0000001",
    "plateNumber": "51C-123.45",
    "type": "Xe tải 1,5 tấn",
    "loadCapacity": 1500,
    "usualDriver": "Đặng Văn Tài",
    "status": "DANG_DUNG",
    "currentTripCode": "CH0000009"
  },
  {
    "id": "xe-2",
    "code": "XE0000002",
    "plateNumber": "51D-678.90",
    "type": "Xe tải 750kg",
    "loadCapacity": 750,
    "usualDriver": "Lý Văn Sáu",
    "status": "DANG_DUNG",
    "currentTripCode": "CH0000008"
  },
  {
    "id": "xe-3",
    "code": "XE0000003",
    "plateNumber": "59C-246.81",
    "type": "Xe ba gác máy",
    "loadCapacity": 400,
    "status": "BAO_TRI"
  }
];
export const DEMO_CASH_ACCOUNTS: CashAccount[] = [
  {
    "id": "acc-cash",
    "name": "Quỹ tiền mặt",
    "type": "TIEN_MAT",
    "balance": 10105000
  },
  {
    "id": "acc-bank",
    "name": "Tài khoản ngân hàng",
    "type": "NGAN_HANG",
    "balance": 17209000
  }
];
export const DEMO_CASH_VOUCHERS: CashVoucher[] = [
  {
    "id": "pc-21",
    "code": "PC0000021",
    "date": "2026-10-17",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 430000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000008",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-14",
    "code": "PT0000014",
    "date": "2026-10-14",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-03",
    "accountId": "acc-bank",
    "amount": 5000000,
    "settledAmount": 0,
    "description": "Khách đặt cọc đơn DH0000021",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-20",
    "code": "PC0000020",
    "date": "2026-10-13",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-4",
    "accountId": "acc-bank",
    "amount": 3120000,
    "settledAmount": 3120000,
    "description": "Thanh toán đơn nhập DN0000009",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-19",
    "code": "PC0000019",
    "date": "2026-10-12",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 480000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000007",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-13",
    "code": "PT0000013",
    "date": "2026-10-10",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-12",
    "accountId": "acc-bank",
    "amount": 4665000,
    "settledAmount": 4665000,
    "description": "Khách thanh toán đơn DH0000009",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-18",
    "code": "PC0000018",
    "date": "2026-10-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 64000000,
    "settledAmount": 0,
    "description": "Lương nhân viên tháng 9",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-17",
    "code": "PC0000017",
    "date": "2026-10-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 18000000,
    "settledAmount": 0,
    "description": "Tiền thuê xưởng tháng 10",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-16",
    "code": "PC0000016",
    "date": "2026-10-02",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 4120000,
    "settledAmount": 0,
    "description": "Tiền điện nước tháng 9",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-12",
    "code": "PT0000012",
    "date": "2026-09-30",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-01",
    "accountId": "acc-bank",
    "amount": 970000,
    "settledAmount": 970000,
    "description": "Khách thanh toán đơn DH0000013",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-11",
    "code": "PT0000011",
    "date": "2026-09-30",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-04",
    "accountId": "acc-bank",
    "amount": 9400000,
    "settledAmount": 9400000,
    "description": "Khách thanh toán đơn DH0000004",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-15",
    "code": "PC0000015",
    "date": "2026-09-30",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 610000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000005",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-10",
    "code": "PT0000010",
    "date": "2026-09-27",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-06",
    "accountId": "acc-bank",
    "amount": 2800000,
    "settledAmount": 2800000,
    "description": "Khách thanh toán đơn DH0000010",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-14",
    "code": "PC0000014",
    "date": "2026-09-25",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-1",
    "accountId": "acc-bank",
    "amount": 5553000,
    "settledAmount": 5553000,
    "description": "Thanh toán đơn nhập DN0000005",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-09",
    "code": "PT0000009",
    "date": "2026-09-20",
    "kind": "THU",
    "category": "Thu khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 1350000,
    "settledAmount": 0,
    "description": "Thanh lý phế liệu nhôm",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-13",
    "code": "PC0000013",
    "date": "2026-09-18",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 560000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000004",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-08",
    "code": "PT0000008",
    "date": "2026-09-17",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-07",
    "accountId": "acc-bank",
    "amount": 9570000,
    "settledAmount": 9570000,
    "description": "Khách thanh toán đơn DH0000005",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-07",
    "code": "PT0000007",
    "date": "2026-09-15",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-10",
    "accountId": "acc-bank",
    "amount": 3327000,
    "settledAmount": 3327000,
    "description": "Khách thanh toán đơn DH0000007",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-12",
    "code": "PC0000012",
    "date": "2026-09-12",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 2000000,
    "settledAmount": 0,
    "description": "Chi nhầm quỹ, đã lập lại phiếu khác",
    "isCancelled": true,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-06",
    "code": "PT0000006",
    "date": "2026-09-05",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-09",
    "accountId": "acc-cash",
    "amount": 480000,
    "settledAmount": 480000,
    "description": "Khách thanh toán đơn DH0000006",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-05",
    "code": "PT0000005",
    "date": "2026-09-05",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-03",
    "accountId": "acc-bank",
    "amount": 4854000,
    "settledAmount": 4854000,
    "description": "Khách thanh toán đơn DH0000002",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-11",
    "code": "PC0000011",
    "date": "2026-09-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 62000000,
    "settledAmount": 0,
    "description": "Lương nhân viên tháng 8",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-10",
    "code": "PC0000010",
    "date": "2026-09-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 18000000,
    "settledAmount": 0,
    "description": "Tiền thuê xưởng tháng 9",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-09",
    "code": "PC0000009",
    "date": "2026-09-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 640000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000003",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-08",
    "code": "PC0000008",
    "date": "2026-09-02",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 3850000,
    "settledAmount": 0,
    "description": "Tiền điện nước tháng 8",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-07",
    "code": "PC0000007",
    "date": "2026-08-28",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 380000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000002",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-06",
    "code": "PC0000006",
    "date": "2026-08-23",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-4",
    "accountId": "acc-cash",
    "amount": 5800000,
    "settledAmount": 5800000,
    "description": "Thanh toán đơn nhập DN0000004",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-04",
    "code": "PT0000004",
    "date": "2026-08-20",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-05",
    "accountId": "acc-bank",
    "amount": 2046000,
    "settledAmount": 2046000,
    "description": "Khách thanh toán đơn DH0000003",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-03",
    "code": "PT0000003",
    "date": "2026-08-20",
    "kind": "THU",
    "category": "Thu tiền khách hàng",
    "partnerType": "KHACH_HANG",
    "partnerId": "kh-01",
    "accountId": "acc-cash",
    "amount": 665000,
    "settledAmount": 665000,
    "description": "Khách thanh toán đơn DH0000001",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-05",
    "code": "PC0000005",
    "date": "2026-08-20",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 520000,
    "settledAmount": 0,
    "description": "Tiền dầu chuyến CH0000001",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-04",
    "code": "PC0000004",
    "date": "2026-08-20",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-3",
    "accountId": "acc-bank",
    "amount": 15050000,
    "settledAmount": 15050000,
    "description": "Thanh toán đơn nhập DN0000003",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-03",
    "code": "PC0000003",
    "date": "2026-08-12",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-2",
    "accountId": "acc-bank",
    "amount": 19600000,
    "settledAmount": 19600000,
    "description": "Thanh toán đơn nhập DN0000002",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-02",
    "code": "PC0000002",
    "date": "2026-08-08",
    "kind": "CHI",
    "category": "Chi trả nhà cung cấp",
    "partnerType": "NHA_CUNG_CAP",
    "partnerId": "ncc-1",
    "accountId": "acc-bank",
    "amount": 23100000,
    "settledAmount": 23100000,
    "description": "Thanh toán đơn nhập DN0000001",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pc-01",
    "code": "PC0000001",
    "date": "2026-08-05",
    "kind": "CHI",
    "category": "Chi khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 18000000,
    "settledAmount": 0,
    "description": "Tiền thuê xưởng tháng 8",
    "isCancelled": false,
    "createdBy": "ke.toan@ninhtrang.local"
  },
  {
    "id": "pt-02",
    "code": "PT0000002",
    "date": "2026-08-01",
    "kind": "THU",
    "category": "Thu khác",
    "partnerType": "KHAC",
    "accountId": "acc-bank",
    "amount": 221000000,
    "settledAmount": 0,
    "description": "Góp vốn đầu kỳ",
    "isCancelled": false,
    "createdBy": "admin@ninhtrang.local"
  },
  {
    "id": "pt-01",
    "code": "PT0000001",
    "date": "2026-08-01",
    "kind": "THU",
    "category": "Thu khác",
    "partnerType": "KHAC",
    "accountId": "acc-cash",
    "amount": 25000000,
    "settledAmount": 0,
    "description": "Góp vốn đầu kỳ",
    "isCancelled": false,
    "createdBy": "admin@ninhtrang.local"
  }
];
export const DEMO_TAGS: Tag[] = [
  {
    "id": "tag-vip",
    "name": "VIP",
    "sortOrder": 1,
    "orderCount": 6,
    "customerCount": 2,
    "isActive": true
  },
  {
    "id": "tag-quen",
    "name": "Khách quen",
    "sortOrder": 2,
    "orderCount": 6,
    "customerCount": 2,
    "isActive": true
  },
  {
    "id": "tag-si",
    "name": "Tranh sỉ",
    "sortOrder": 3,
    "orderCount": 12,
    "customerCount": 5,
    "isActive": true
  },
  {
    "id": "tag-gap",
    "name": "Đơn gấp",
    "sortOrder": 4,
    "orderCount": 1,
    "customerCount": 0,
    "isActive": true
  },
  {
    "id": "tag-shopee",
    "name": "Dropship Shopee",
    "sortOrder": 5,
    "orderCount": 4,
    "customerCount": 2,
    "isActive": true
  }
];
export const DEMO_USERS: AppUser[] = [
  {
    "id": "user-admin",
    "name": "Quản trị hệ thống",
    "email": "admin@ninhtrang.local",
    "roleId": "role-ceo",
    "lastLoginAt": "2026-10-19T08:15:00",
    "openSessions": 1,
    "status": "ACTIVE"
  },
  {
    "id": "user-quanly",
    "name": "Nguyễn Minh Quân",
    "email": "quan.ly@ninhtrang.local",
    "roleId": "role-manager",
    "lastLoginAt": "2026-10-18T17:40:00",
    "openSessions": 0,
    "status": "ACTIVE"
  },
  {
    "id": "user-ketoan",
    "name": "Lê Thị Hoa",
    "email": "ke.toan@ninhtrang.local",
    "roleId": "role-accountant",
    "lastLoginAt": "2026-10-19T08:50:00",
    "openSessions": 1,
    "status": "ACTIVE"
  },
  {
    "id": "user-sale1",
    "name": "Trần Văn Nam",
    "email": "sale1@ninhtrang.local",
    "roleId": "role-sale",
    "lastLoginAt": "2026-10-19T09:05:00",
    "openSessions": 2,
    "status": "ACTIVE"
  },
  {
    "id": "user-sale2",
    "name": "Phạm Thị Lan",
    "email": "sale2@ninhtrang.local",
    "roleId": "role-sale",
    "lastLoginAt": "2026-10-18T16:20:00",
    "openSessions": 0,
    "status": "ACTIVE"
  },
  {
    "id": "user-thukho",
    "name": "Võ Văn Khoa",
    "email": "thu.kho@ninhtrang.local",
    "roleId": "role-thukho",
    "lastLoginAt": "2026-10-19T07:55:00",
    "openSessions": 1,
    "status": "ACTIVE"
  },
  {
    "id": "user-taixe",
    "name": "Đặng Văn Tài",
    "email": "tai.xe@ninhtrang.local",
    "roleId": "role-giaohang",
    "lastLoginAt": "2026-10-17T06:30:00",
    "openSessions": 0,
    "status": "ACTIVE"
  },
  {
    "id": "user-xuong",
    "name": "Hoàng Văn Xưởng",
    "email": "xuong@ninhtrang.local",
    "roleId": "role-xuong",
    "lastLoginAt": "2026-10-18T07:10:00",
    "openSessions": 0,
    "status": "ACTIVE"
  },
  {
    "id": "user-cu",
    "name": "Lâm Văn Cũ",
    "email": "nv.da.nghi@ninhtrang.local",
    "roleId": "role-giaohang",
    "lastLoginAt": "2026-08-30T10:00:00",
    "openSessions": 0,
    "status": "DISABLED"
  }
];
export const DEMO_ROLE_USER_COUNT: Record<string, number> = {
  "role-ceo": 1,
  "role-manager": 1,
  "role-accountant": 1,
  "role-sale": 2,
  "role-thukho": 1,
  "role-giaohang": 2,
  "role-xuong": 1
};
