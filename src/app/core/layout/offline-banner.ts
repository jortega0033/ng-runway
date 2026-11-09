import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AlertComponent } from '@ui/alert/alert';

/** Tells the user when the browser loses its connection. */
@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, TranslocoPipe],
  host: {
    '(window:online)': 'online.set(true)',
    '(window:offline)': 'online.set(false)',
  },
  template: `
    @if (!online()) {
      <ui-alert variant="warning">{{ 'shell.offline' | transloco }}</ui-alert>
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
}
