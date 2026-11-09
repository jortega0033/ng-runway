import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui/index';
import { CommandPaletteService } from './command-palette.service';

/** Search-style button for the top bar that opens the command palette. */
@Component({
  selector: 'app-command-palette-trigger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TranslocoPipe],
  host: { class: 'block w-full max-w-72' },
  template: `
    <button
      type="button"
      class="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background-muted px-3 text-base text-foreground-subtle outline-offset-2 hover:bg-background-hover focus-visible:outline-2 focus-visible:outline-border-brand"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      [attr.aria-label]="'shell.commandPalette' | transloco"
      (click)="palette.open()"
    >
      <ui-icon name="search" [size]="16" />
      <span class="flex-1 truncate text-left" aria-hidden="true">
        {{ 'common.search' | transloco }}
      </span>
      <kbd
        class="rounded-sm border border-border px-1.5 text-sm text-foreground-subtle"
        aria-hidden="true"
      >
        Ctrl K
      </kbd>
    </button>
  `,
})
export class CommandPaletteTriggerComponent {
  protected readonly palette = inject(CommandPaletteService);
}
