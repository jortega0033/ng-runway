import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';
import { CommandPaletteComponent } from '../command-palette/command-palette';
import { CommandPaletteTriggerComponent } from '../command-palette/command-palette-trigger';
import { DevToolbarComponent, devToolbarEnabled } from '../dev/dev-toolbar';
import { LanguageService, type Language } from '../i18n/i18n';
import { ThemeService, type ThemePreference } from '../theme/theme.service';
import { AvatarComponent } from '@ui/avatar/avatar';
import { IconComponent, type IconName } from '@ui/icon/icon';
import { IconButtonComponent } from '@ui/button/icon-button';
import { SegmentedComponent } from '@ui/segmented/segmented';
import { SidebarNavComponent } from '@ui/nav/sidebar-nav';
import { TopBarComponent } from '@ui/nav/top-bar';
import { ToastContainerComponent } from '@ui/toast/toast';
import { navFor } from './nav-items';
import { OfflineBannerComponent } from './offline-banner';

const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'system'];
const THEME_ICON: Record<ThemePreference, IconName> = {
  light: 'sun',
  dark: 'moon',
  system: 'globe',
};

/** Layout for every signed-in page: sidebar, top bar and the routed content. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    CommandPaletteComponent,
    CommandPaletteTriggerComponent,
    DevToolbarComponent,
    IconButtonComponent,
    IconComponent,
    OfflineBannerComponent,
    RouterLink,
    RouterOutlet,
    SegmentedComponent,
    SidebarNavComponent,
    ToastContainerComponent,
    TopBarComponent,
    TranslocoPipe,
  ],
  template: `
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background-primary focus:px-3 focus:py-2 focus:text-foreground-on-primary"
    >
      {{ 'shell.skipToContent' | transloco }}
    </a>
    <div class="flex h-dvh bg-background-surface-page text-foreground">
      <aside
        class="shrink-0 border-r border-border-subtle bg-background-surface-page p-2 transition-[width] motion-reduce:transition-none"
        [class]="collapsed() ? 'w-16' : 'w-60'"
      >
        <ui-sidebar-nav
          [items]="items()"
          [collapsed]="collapsed()"
          [label]="'nav.main' | transloco"
        />
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <ui-top-bar>
          <button
            slot="start"
            ui-icon-button
            type="button"
            icon="menu"
            [label]="(collapsed() ? 'shell.expandMenu' : 'shell.collapseMenu') | transloco"
            (click)="collapsed.set(!collapsed())"
          ></button>
          <a
            slot="start"
            routerLink="/dashboard"
            class="font-title text-lg font-semibold text-foreground"
          >
            ng-runway
          </a>
          <app-command-palette-trigger slot="center" />
          <div slot="end" class="flex items-center gap-2">
            <ui-segmented
              [label]="'shell.language' | transloco"
              [options]="languages"
              [value]="language.language()"
              (valueChange)="language.set($any($event))"
            />
            <button
              ui-icon-button
              type="button"
              [icon]="themeIcon()"
              [label]="
                ('theme.label' | transloco) + ': ' + ('theme.' + theme.preference() | transloco)
              "
              (click)="cycleTheme()"
            ></button>
            <a
              routerLink="/notifications"
              class="inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle outline-offset-2 hover:bg-background-hover focus-visible:outline-2 focus-visible:outline-border-brand"
              [attr.aria-label]="'shell.notifications' | transloco"
            >
              <ui-icon name="bell" />
            </a>
            @if (auth.user(); as user) {
              <ui-avatar [name]="user.name" />
              <span class="hidden text-sm text-foreground-subtle lg:inline">
                {{ user.name }} · {{ 'roles.' + user.role | transloco }}
              </span>
            }
            <button
              ui-icon-button
              type="button"
              icon="logout"
              [label]="'shell.signOut' | transloco"
              (click)="auth.logout()"
            ></button>
          </div>
        </ui-top-bar>
        <app-offline-banner />
        <main id="main" tabindex="-1" class="min-h-0 flex-1 overflow-auto p-6 outline-none">
          <router-outlet />
        </main>
      </div>
    </div>
    <ui-toast-container />
    <app-command-palette />
    @if (devTools) {
      <app-dev-toolbar />
    }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$);

  protected readonly collapsed = signal(typeof window !== 'undefined' && window.innerWidth < 1024);
  protected readonly devTools = devToolbarEnabled();
  protected readonly languages = [
    { value: 'en', label: 'EN' },
    { value: 'nl', label: 'NL' },
  ] satisfies { value: Language; label: string }[];

  protected readonly items = computed(() => {
    this.lang(); // re-run when the language changes
    return navFor(this.auth.role(), (key) => this.transloco.translate(key));
  });

  protected readonly themeIcon = computed(() => THEME_ICON[this.theme.preference()]);

  protected cycleTheme(): void {
    const next =
      THEME_ORDER[(THEME_ORDER.indexOf(this.theme.preference()) + 1) % THEME_ORDER.length];
    this.theme.set(next ?? 'system');
  }
}
