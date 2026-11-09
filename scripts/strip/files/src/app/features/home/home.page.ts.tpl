import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { CardComponent, EmptyStateComponent, LinkComponent, PageHeaderComponent } from '@ui/index';

/** The landing page after sign-in. Replace the empty state with your own overview. */
@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    EmptyStateComponent,
    LinkComponent,
    PageHeaderComponent,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <ui-page-header
      [title]="'home.title' | transloco"
      [description]="'home.greeting' | transloco: { name: auth.user()?.name ?? '' }"
    />
    <ui-card>
      <ui-empty-state
        icon="home"
        [title]="'home.emptyTitle' | transloco"
        [message]="'home.emptyText' | transloco"
      >
        <a empty-action ui-link routerLink="/items">{{ 'home.openExample' | transloco }}</a>
      </ui-empty-state>
    </ui-card>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
}
