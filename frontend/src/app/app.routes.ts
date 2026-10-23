import { Routes } from '@angular/router';
import { authGuard, catalogGuard, permissionGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard, catalogGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
      { path: 'tong-quan', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'bao-cao', loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent) },

      { path: 'hang-hoa', loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent) },
      { path: 'hang-hoa/them', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/products/product-form/product-form.component').then((m) => m.ProductFormComponent) },
      { path: 'hang-hoa/:id', loadComponent: () => import('./features/products/product-detail/product-detail.component').then((m) => m.ProductDetailComponent) },
      { path: 'hang-hoa/:id/sua', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/products/product-form/product-form.component').then((m) => m.ProductFormComponent) },
      { path: 'kho/ton-kho', loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent) },
      { path: 'kho/phieu', loadComponent: () => import('./features/warehouse-vouchers/warehouse-vouchers.component').then((m) => m.WarehouseVouchersComponent) },
      { path: 'kho/phieu/lap/:kind', loadComponent: () => import('./features/warehouse-vouchers/warehouse-voucher-form/warehouse-voucher-form.component').then((m) => m.WarehouseVoucherFormComponent) },
      { path: 'kho/phieu/:id', loadComponent: () => import('./features/warehouse-vouchers/warehouse-voucher-form/warehouse-voucher-form.component').then((m) => m.WarehouseVoucherFormComponent) },
      { path: 'san-xuat', loadComponent: () => import('./features/production-orders/production-orders.component').then((m) => m.ProductionOrdersComponent) },
      { path: 'san-xuat/:id', loadComponent: () => import('./features/production-orders/production-order-detail/production-order-detail.component').then((m) => m.ProductionOrderDetailComponent) },

      { path: 'nha-cung-cap', loadComponent: () => import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent) },
      { path: 'nha-cung-cap/them', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent) },
      { path: 'nha-cung-cap/:id', loadComponent: () => import('./features/suppliers/supplier-detail/supplier-detail.component').then((m) => m.SupplierDetailComponent) },
      { path: 'nha-cung-cap/:id/sua', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/suppliers/supplier-form/supplier-form.component').then((m) => m.SupplierFormComponent) },
      { path: 'mua-hang', loadComponent: () => import('./features/purchase-orders/purchase-orders.component').then((m) => m.PurchaseOrdersComponent) },
      { path: 'mua-hang/them', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/purchase-orders/purchase-order-voucher/purchase-order-voucher.component').then((m) => m.PurchaseOrderVoucherComponent) },
      { path: 'mua-hang/:id', loadComponent: () => import('./features/purchase-orders/purchase-order-voucher/purchase-order-voucher.component').then((m) => m.PurchaseOrderVoucherComponent) },
      { path: 'mua-hang/:id/sua', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/purchase-orders/purchase-order-voucher/purchase-order-voucher.component').then((m) => m.PurchaseOrderVoucherComponent) },
      { path: 'cong-no/nha-cung-cap', loadComponent: () => import('./features/payables/payables.component').then((m) => m.PayablesComponent) },

      { path: 'khach-hang', loadComponent: () => import('./features/customers/customers.component').then((m) => m.CustomersComponent) },
      { path: 'khach-hang/them', redirectTo: 'khach-hang/them-moi' },
      { path: 'khach-hang/them-moi', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/customers/customer-form/customer-form.component').then((m) => m.CustomerFormComponent) },
      { path: 'khach-hang/:id', loadComponent: () => import('./features/customers/customer-detail/customer-detail.component').then((m) => m.CustomerDetailComponent) },
      { path: 'khach-hang/:id/sua', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/customers/customer-form/customer-form.component').then((m) => m.CustomerFormComponent) },
      { path: 'don-hang', loadComponent: () => import('./features/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent) },
      { path: 'don-hang/them', redirectTo: 'don-hang/them-moi' },
      { path: 'don-hang/them-moi', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/sales-orders/sales-order-voucher/sales-order-voucher.component').then((m) => m.SalesOrderVoucherComponent) },
      { path: 'don-hang/:id', loadComponent: () => import('./features/sales-orders/sales-order-voucher/sales-order-voucher.component').then((m) => m.SalesOrderVoucherComponent) },
      { path: 'don-hang/:id/sua', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./features/sales-orders/sales-order-voucher/sales-order-voucher.component').then((m) => m.SalesOrderVoucherComponent) },
      { path: 'giao-hang', loadComponent: () => import('./features/delivery-trips/delivery-trips.component').then((m) => m.DeliveryTripsComponent) },
      { path: 'giao-hang/:id', loadComponent: () => import('./features/delivery-trips/delivery-trip-voucher/delivery-trip-voucher.component').then((m) => m.DeliveryTripVoucherComponent) },
      { path: 'xe', loadComponent: () => import('./features/vehicles/vehicles.component').then((m) => m.VehiclesComponent) },
      { path: 'xe/:id', loadComponent: () => import('./features/vehicles/vehicle-detail/vehicle-detail.component').then((m) => m.VehicleDetailComponent) },
      { path: 'cong-no/khach-hang', loadComponent: () => import('./features/receivables/receivables.component').then((m) => m.ReceivablesComponent) },

      { path: 'thu-chi/tai-khoan', loadComponent: () => import('./features/cash-vouchers/cash-accounts/cash-accounts.component').then((m) => m.CashAccountsComponent) },
      { path: 'thu-chi/loai', loadComponent: () => import('./features/cash-vouchers/cash-categories/cash-categories.component').then((m) => m.CashCategoriesComponent) },
      { path: 'thu-chi/lap/:kind', loadComponent: () => import('./features/cash-vouchers/cash-voucher-form/cash-voucher-form.component').then((m) => m.CashVoucherFormComponent) },
      { path: 'thu-chi', loadComponent: () => import('./features/cash-vouchers/cash-vouchers.component').then((m) => m.CashVouchersComponent) },
      { path: 'thu-chi/:id', loadComponent: () => import('./features/cash-vouchers/cash-voucher-view/cash-voucher-view.component').then((m) => m.CashVoucherViewComponent) },
      { path: 'cong-no/tuoi-no', loadComponent: () => import('./features/debt-aging/debt-aging.component').then((m) => m.DebtAgingComponent) },

      { path: 'thiet-lap/cong-ty', loadComponent: () => import('./features/settings/company-info/company-info.component').then((m) => m.CompanyInfoComponent) },
      { path: 'thiet-lap/the', loadComponent: () => import('./features/settings/tags/tags.component').then((m) => m.TagsComponent) },
      { path: 'thiet-lap/nguoi-dung', loadComponent: () => import('./features/settings/users/users.component').then((m) => m.UsersComponent) },
      { path: 'thiet-lap/nguoi-dung/:id', loadComponent: () => import('./features/settings/users/user-detail/user-detail.component').then((m) => m.UserDetailComponent) },
      { path: 'thiet-lap/chuc-vu', loadComponent: () => import('./features/settings/roles-permissions/roles-permissions.component').then((m) => m.RolesPermissionsComponent) },
      { path: 'thiet-lap/mau-hien-thi', loadComponent: () => import('./features/settings/display-colors/display-colors.component').then((m) => m.DisplayColorsComponent) },
      { path: 'thiet-lap/nhat-ky', loadComponent: () => import('./features/settings/activity-log/activity-log.component').then((m) => m.ActivityLogComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
