import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/api/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { DisplayColorsService } from './core/services/display-colors.service';
import { PageTitleStrategy } from './core/services/page-title.strategy';
import { ThemeService } from './core/services/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    // Writes the user's tag colours (Thiết lập → Màu hiển thị) before any page renders.
    provideAppInitializer(() => {
      inject(DisplayColorsService);
      inject(ThemeService);
      // Fresh permissions for a session restored from storage. Not awaited: the app starts at once
      // with the stored ones, and the menu follows when the answer arrives.
      void inject(AuthService).refresh();
    }),
  ]
};
