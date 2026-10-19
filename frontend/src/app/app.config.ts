import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { DisplayColorsService } from './core/services/display-colors.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Writes the user's tag colours (Thiết lập → Màu hiển thị) before any page renders.
    provideAppInitializer(() => {
      inject(DisplayColorsService);
    }),
  ]
};
