import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CatalogLoader } from './core/api/catalog-loader.service';
import { ErrorBannerComponent } from './layout/error-banner/error-banner.component';
import { ToastHostComponent } from './shared/toast/toast-host.component';
import { ConfirmHostComponent } from './shared/confirm/confirm-host.component';
import { LoadingScreenComponent } from './layout/loading-screen/loading-screen.component';

@Component({
  imports: [RouterOutlet, LoadingScreenComponent, ErrorBannerComponent, ConfirmHostComponent, ToastHostComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly catalog = inject(CatalogLoader);
}
