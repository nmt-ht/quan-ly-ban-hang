import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = 'demo@ninhtrang.local';
  password = '';
  error = signal('');

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  submit(): void {
    if (this.auth.login(this.email, this.password)) {
      this.error.set('');
      this.router.navigateByUrl('/tong-quan');
    } else {
      this.error.set('Sai email hoặc mật khẩu. Dùng demo@ninhtrang.local / demo1234 cho bản demo này.');
    }
  }
}
