import { DialogRef } from '@angular/cdk/dialog';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  computed,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { DialogService, IconComponent } from '@ui/index';
import { AuthService } from '../auth/auth.service';
import { DemoDataService } from '../dev/demo-data.service';
import { LanguageService } from '../i18n/i18n';
import { ThemeService } from '../theme/theme.service';
import { CommandPaletteService } from './command-palette.service';
import { buildCommands, filterCommands, type CommandGroup, type PaletteCommand } from './commands';

let nextId = 0;

/**
 * The content of the palette dialog: a search box and a list of commands. Focus stays in the box;
 * the arrow keys move a highlight that screen readers follow through `aria-activedescendant`.
 */
@Component({
  selector: 'app-command-palette-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  providers: [provideTranslocoScope('palette')],
  host: {
    class:
      'block w-full overflow-hidden rounded-xl border border-border-subtle bg-background-surface-page text-foreground shadow-xl',
  },
  template: `
    <div class="flex items-center gap-2 border-b border-border-subtle px-4">
      <ui-icon name="search" class="text-foreground-subtle" />
      <input
        #box
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="true"
        class="h-12 min-w-0 flex-1 bg-transparent text-lg text-foreground outline-none placeholder:text-foreground-placeholder"
        [attr.aria-label]="t('palette.inputLabel')"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="activeId()"
        [placeholder]="t('palette.placeholder')"
        [value]="query()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />
      <kbd
        class="rounded-sm border border-border px-1.5 py-0.5 text-sm text-foreground-subtle"
        aria-hidden="true"
      >
        Esc
      </kbd>
    </div>
    <ul
      role="listbox"
      class="max-h-80 overflow-y-auto p-2"
      [id]="listId"
      [attr.aria-label]="t('palette.results')"
    >
      @for (command of results(); track command.id; let i = $index) {
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <li
          role="option"
          class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-base text-foreground"
          [id]="optionId(command)"
          [attr.aria-selected]="i === active()"
          [class.bg-background-hover]="i === active()"
          [class.font-medium]="i === active()"
          [class.outline-2]="i === active()"
          [class.outline-border-brand]="i === active()"
          [class.-outline-offset-2]="i === active()"
          (click)="run(command)"
          (mousemove)="active.set(i)"
        >
          <ui-icon [name]="command.icon" class="text-foreground-subtle" />
          <span class="min-w-0 flex-1 truncate">{{ command.label }}</span>
          <span class="text-sm text-foreground-subtle">{{ groupLabel(command.group) }}</span>
        </li>
      }
    </ul>
    @if (results().length === 0) {
      <p class="px-6 py-8 text-center text-base text-foreground-subtle">
        {{ t('palette.noResults') }}
      </p>
    }
    <p class="sr-only" role="status" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class CommandPaletteDialogComponent {
  private readonly ref = inject<DialogRef<undefined>>(DialogRef);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly demo = inject(DemoDataService);
  private readonly transloco = inject(TranslocoService);
  /** Emits when the palette strings are loaded and when the language changes. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('palette'));

  private readonly uid = nextId++;
  protected readonly listId = `app-palette-list-${this.uid}`;
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly t = (key: string, params?: Record<string, string | number>): string => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  private readonly commands = computed(() =>
    buildCommands({
      role: this.auth.role(),
      t: (key, params) => this.t(key, params),
      navigate: (link) => void this.router.navigateByUrl(link),
      setTheme: (preference) => this.theme.set(preference),
      setLanguage: (language) => this.language.set(language),
      signOut: () => this.auth.logout(),
      resetDemoData: () => void this.resetDemoData(),
    }),
  );

  protected readonly results = computed(() => filterCommands(this.commands(), this.query()));
  protected readonly activeId = computed(() => {
    const command = this.results()[this.active()];
    return command ? this.optionId(command) : null;
  });
  protected readonly announcement = computed(() => {
    const count = this.results().length;
    if (count === 0) return this.t('palette.noResults');
    return this.t(count === 1 ? 'palette.resultOne' : 'palette.resultMany', { count });
  });

  constructor() {
    // The dialog's own focus step can run before this view exists, so focus the box here.
    afterNextRender(() => this.box().nativeElement.focus());
    // Keep the highlighted option visible when the list scrolls.
    effect(() => {
      const id = this.activeId();
      if (id) document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected optionId(command: PaletteCommand): string {
    return `app-palette-${this.uid}-${command.id}`;
  }

  protected groupLabel(group: CommandGroup): string {
    return this.t(`palette.groups.${group}`);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.active.set((this.active() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set((this.active() - 1 + count) % count);
        break;
      case 'Enter': {
        event.preventDefault();
        const command = this.results()[this.active()];
        if (command) this.run(command);
        break;
      }
    }
  }

  /** Closes the palette first so focus goes back, then runs the command. */
  protected run(command: PaletteCommand): void {
    this.ref.close();
    command.run();
  }

  private resetDemoData(): Promise<boolean> {
    return this.demo.reset({
      confirm: {
        title: this.t('palette.resetTitle'),
        message: this.t('palette.resetMessage'),
        confirmLabel: this.t('palette.resetConfirm'),
        cancelLabel: this.t('common.cancel'),
      },
      done: this.t('palette.resetDone'),
    });
  }
}

/**
 * Mount once in the shell. Opens the palette on Ctrl+K / Cmd+K and whenever
 * `CommandPaletteService.open()` is called.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideTranslocoScope('palette')],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: '',
})
export class CommandPaletteComponent {
  private readonly service = inject(CommandPaletteService);
  private readonly dialogs = inject(DialogService);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private ref: DialogRef<undefined, CommandPaletteDialogComponent> | null = null;

  constructor() {
    effect(() => {
      const open = this.service.isOpen();
      untracked(() => (open ? this.show() : this.ref?.close()));
    });
    inject(DestroyRef).onDestroy(() => this.ref?.close());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const isShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k';
    if (!isShortcut || !this.auth.isAuthenticated()) return;
    event.preventDefault();
    this.service.toggle();
  }

  private show(): void {
    if (this.ref) return;
    const ref = this.dialogs.open<undefined, unknown, CommandPaletteDialogComponent>(
      CommandPaletteDialogComponent,
      { size: 'md', ariaLabel: this.transloco.translate('shell.commandPalette') },
    );
    this.ref = ref;
    ref.closed.subscribe(() => {
      this.ref = null;
      this.service.close();
    });
  }
}
