import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { UserRole } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { ButtonComponent } from '@ui/button/button';
import { CardComponent } from '@ui/card/card';
import { ToastContainerComponent } from '@ui/toast/toast';

const ROLES: readonly UserRole[] = ['admin', 'manager', 'employee'];

/** Demo sign-in: no password, just pick who you want to be. */
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, ToastContainerComponent, TranslocoPipe],
  template: `
    <main class="flex min-h-dvh items-center justify-center bg-background-alt p-6">
      <ui-card class="w-full max-w-md">
        <div class="flex flex-col gap-6">
          <div>
            <h1 class="font-title text-3xl font-semibold">{{ 'login.title' | transloco }}</h1>
            <p class="mt-2 text-base text-foreground-subtle">{{ 'login.subtitle' | transloco }}</p>
          </div>
          <ul class="flex flex-col gap-3">
            @for (role of roles; track role) {
              <li class="flex flex-col gap-1">
                <button
                  ui-button
                  type="button"
                  [variant]="role === 'admin' ? 'primary' : 'secondary'"
                  [loading]="pending() === role"
                  [disabled]="pending() !== null"
                  (click)="signIn(role)"
                >
                  {{ 'login.signInAs' | transloco: { role: 'roles.' + role | transloco } }}
                </button>
                <span class="text-sm text-foreground-subtle">{{
                  'login.' + role + 'Hint' | transloco
                }}</span>
              </li>
            }
          </ul>
        </div>
      </ui-card>
    </main>
    <ui-toast-container />
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly roles = ROLES;
  protected readonly pending = signal<UserRole | null>(null);

  protected signIn(role: UserRole): void {
    this.pending.set(role);
    this.auth.login(role).subscribe({
      next: () => void this.router.navigateByUrl('/dashboard'),
      error: () => this.pending.set(null),
    });
  }
}
