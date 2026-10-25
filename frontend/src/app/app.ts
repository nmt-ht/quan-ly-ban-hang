import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CatalogLoader } from './core/api/catalog-loader.service';
import { LoadingScreenComponent } from './layout/loading-screen/loading-screen.component';

@Component({
  imports: [RouterOutlet, LoadingScreenComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly catalog = inject(CatalogLoader);
}
