// Which permission opens which page. One table drives the route guard, the sidebar, Ctrl K and
// the "Thêm / Lập …" links, so a page a role cannot open never shows up as a link either.
// Each rule lists alternatives: holding any one of them is enough. First matching rule wins;
// a path with no rule is open to every signed-in user. The backend must still check every call.

const REPORTS = ['report.sales', 'report.stock', 'report.purchase', 'report.debt', 'report.cashflow', 'report.production', 'report.delivery'];

const RULES: [RegExp, string[]][] = [
  [/^\/tong-quan$/, ['report.dashboard']],
  [/^\/bao-cao(\/|$)/, REPORTS],

  [/^\/hang-hoa\/them$/, ['product.create']],
  [/^\/hang-hoa\/[^/]+\/sua$/, ['product.update']],
  [/^\/hang-hoa(\/|$)/, ['product.view']],
  [/^\/kho\/ton-kho$/, ['stock.view']],
  [/^\/kho\/phieu\/lap\/in$/, ['stock.import']],
  [/^\/kho\/phieu\/lap\/out$/, ['stock.export']],
  [/^\/kho\/phieu\/lap\/transfer$/, ['stock.transfer']],
  [/^\/kho\/phieu\/lap\/adjust$/, ['stock.adjust', 'stock.stocktake']],
  [/^\/kho\/phieu(\/|$)/, ['stock.view']],
  [/^\/san-xuat(\/|$)/, ['production.view']],

  [/^\/nha-cung-cap\/them$/, ['supplier.create']],
  [/^\/nha-cung-cap\/[^/]+\/sua$/, ['supplier.update']],
  [/^\/nha-cung-cap(\/|$)/, ['supplier.view']],
  [/^\/mua-hang\/them$/, ['purchase.create']],
  [/^\/mua-hang\/[^/]+\/sua$/, ['purchase.update']],
  [/^\/mua-hang(\/|$)/, ['purchase.view']],
  [/^\/cong-no(\/|$)/, ['debt.view']],

  [/^\/khach-hang\/them(-moi)?$/, ['customer.create']],
  [/^\/khach-hang\/[^/]+\/sua$/, ['customer.update']],
  [/^\/khach-hang(\/|$)/, ['customer.view']],
  [/^\/don-hang\/them(-moi)?$/, ['order.create']],
  [/^\/don-hang\/[^/]+\/sua$/, ['order.update']],
  [/^\/don-hang(\/|$)/, ['order.view']],
  [/^\/giao-hang(\/|$)/, ['trip.view']],
  [/^\/xe(\/|$)/, ['vehicle.view']],

  [/^\/thu-chi\/tai-khoan$/, ['voucher.manage_account']],
  [/^\/thu-chi\/loai$/, ['voucher.manage_category']],
  [/^\/thu-chi\/lap\/thu$/, ['voucher.create_receipt']],
  [/^\/thu-chi\/lap\/chi$/, ['voucher.create_payment']],
  [/^\/thu-chi(\/|$)/, ['voucher.view']],

  [/^\/thiet-lap\/cong-ty$/, ['company.view']],
  [/^\/thiet-lap\/kho(\/|$)/, ['warehouse.view']],
  [/^\/thiet-lap\/nhom-hang$/, ['category.view']],
  [/^\/thiet-lap\/the$/, ['tag.view']],
  [/^\/thiet-lap\/nguoi-dung(\/|$)/, ['user.view']],
  [/^\/thiet-lap\/chuc-vu$/, ['position.view']],
  [/^\/thiet-lap\/nhat-ky$/, ['audit.view']],
];

/** Permissions that open `url` (any one is enough), or null when the page is open to everyone signed in. */
export function permissionsForUrl(url: string): string[] | null {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return RULES.find(([re]) => re.test(path))?.[1] ?? null;
}

/** Turn a routerLink value (string or command array) into a path; null when it is relative. */
export function linkToUrl(link: string | readonly unknown[] | null | undefined): string | null {
  if (link == null) return null;
  const url = typeof link === 'string' ? link : link.map(String).join('/').replace(/\/{2,}/g, '/');
  return url.startsWith('/') ? url : null;
}
