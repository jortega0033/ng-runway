import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AlertComponent } from '@ui/alert/alert';
import { AvatarComponent } from '@ui/avatar/avatar';
import { BadgeComponent } from '@ui/badge/badge';
import { ButtonComponent } from '@ui/button/button';
import { IconButtonComponent } from '@ui/button/icon-button';
import { ICON_NAMES, IconComponent } from '@ui/icon/icon';
import { LinkComponent } from '@ui/link/link';
import { SkeletonComponent } from '@ui/skeleton/skeleton';
import { SpinnerComponent } from '@ui/spinner/spinner';
import { TagComponent } from '@ui/tag/tag';

@Component({
  selector: 'app-ds-basics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    IconButtonComponent,
    IconComponent,
    LinkComponent,
    SkeletonComponent,
    SpinnerComponent,
    TagComponent,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <div>
        <h3 class="mb-2 text-lg font-semibold">Buttons</h3>
        <div class="flex flex-wrap items-center gap-3">
          <button ui-button type="button">Primary</button>
          <button ui-button variant="secondary" type="button">Secondary</button>
          <button ui-button variant="ghost" type="button">Ghost</button>
          <button ui-button variant="danger" type="button">Danger</button>
          <button ui-button size="sm" type="button">Small</button>
          <button ui-button size="lg" type="button">Large</button>
          <button ui-button loading type="button">Loading</button>
          <button ui-button disabled type="button">Disabled</button>
          <button ui-icon-button icon="edit" label="Edit" type="button"></button>
          <a ui-link href="#">Link</a>
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-lg font-semibold">Badges, tags and avatars</h3>
        <div class="flex flex-wrap items-center gap-3">
          <ui-badge>Neutral</ui-badge>
          <ui-badge variant="brand">Brand</ui-badge>
          <ui-badge variant="success">Success</ui-badge>
          <ui-badge variant="warning">Warning</ui-badge>
          <ui-badge variant="danger">Danger</ui-badge>
          @if (tagVisible()) {
            <ui-tag removable removeLabel="Remove Kitchen" (removed)="tagVisible.set(false)"
              >Kitchen</ui-tag
            >
          }
          <ui-avatar name="Sara Bakker" size="sm" />
          <ui-avatar name="Mark Jansen" />
          <ui-avatar name="Anna de Vries" size="lg" />
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-lg font-semibold">Feedback</h3>
        <div class="flex flex-col gap-3">
          <ui-alert variant="info" heading="Info"
            >The schedule for next week is still a draft.</ui-alert
          >
          <ui-alert variant="success" heading="Saved">Your changes were saved.</ui-alert>
          <ui-alert variant="warning" heading="Overtime"
            >This shift goes over the contract hours.</ui-alert
          >
          <ui-alert variant="danger" heading="Failed" dismissible
            >The request could not be sent.</ui-alert
          >
        </div>
        <div class="mt-3 flex items-center gap-4">
          <ui-spinner />
          <ui-skeleton class="h-4 w-48" />
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-lg font-semibold">Icons</h3>
        <ul class="flex flex-wrap gap-4">
          @for (name of icons; track name) {
            <li class="flex w-20 flex-col items-center gap-1 text-xs text-foreground-subtle">
              <ui-icon [name]="name" [size]="24" />
              {{ name }}
            </li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class BasicsSectionComponent {
  protected readonly icons = ICON_NAMES;
  protected readonly tagVisible = signal(true);
}
