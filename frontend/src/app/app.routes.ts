import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
      { path: 'tong-quan', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'bao-cao', loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent) },

      { path: 'hang-hoa', loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent) },
      { path: 'hang-hoa/them', loadComponent: () => import('./features/products/product-form/product-form.component').then((m) => m.ProductFormComponent) },
      { path: 'kho/ton-kho', loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent) },
      { path: 'kho/phieu', loadComponent: () => import('./features/warehouse-vouchers/warehouse-vouchers.component').then((m) => m.WarehouseVouchersComponent) },
      { path: 'san-xuat', loadComponent: () => import('./features/production-orders/production-orders.component').then((m) => m.ProductionOrdersComponent) },

      { path: 'nha-cung-cap', loadComponent: () => import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent) },
      { path: 'mua-hang', loadComponent: () => import('./features/purchase-orders/purchase-orders.component').then((m) => m.PurchaseOrdersComponent) },
      { path: 'cong-no/nha-cung-cap', loadComponent: () => import('./features/payables/payables.component').then((m) => m.PayablesComponent) },

      { path: 'khach-hang', loadComponent: () => import('./features/customers/customers.component').then((m) => m.CustomersComponent) },
      { path: 'khach-hang/them', loadComponent: () => import('./features/customers/customer-form/customer-form.component').then((m) => m.CustomerFormComponent) },
      { path: 'don-hang', loadComponent: () => import('./features/sales-orders/sales-orders.component').then((m) => m.SalesOrdersComponent) },
      { path: 'don-hang/them', loadComponent: () => import('./features/sales-orders/sales-order-form/sales-order-form.component').then((m) => m.SalesOrderFormComponent) },
      { path: 'giao-hang', loadComponent: () => import('./features/delivery-trips/delivery-trips.component').then((m) => m.DeliveryTripsComponent) },
      { path: 'xe', loadComponent: () => import('./features/vehicles/vehicles.component').then((m) => m.VehiclesComponent) },
      { path: 'cong-no/khach-hang', loadComponent: () => import('./features/receivables/receivables.component').then((m) => m.ReceivablesComponent) },

      { path: 'thu-chi', loadComponent: () => import('./features/cash-vouchers/cash-vouchers.component').then((m) => m.CashVouchersComponent) },
      { path: 'cong-no/tuoi-no', loadComponent: () => import('./features/debt-aging/debt-aging.component').then((m) => m.DebtAgingComponent) },

      { path: 'thiet-lap/cong-ty', loadComponent: () => import('./features/settings/company-info/company-info.component').then((m) => m.CompanyInfoComponent) },
      { path: 'thiet-lap/the', loadComponent: () => import('./features/settings/tags/tags.component').then((m) => m.TagsComponent) },
      { path: 'thiet-lap/nguoi-dung', loadComponent: () => import('./features/settings/users/users.component').then((m) => m.UsersComponent) },
      { path: 'thiet-lap/chuc-vu', loadComponent: () => import('./features/settings/roles-permissions/roles-permissions.component').then((m) => m.RolesPermissionsComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
