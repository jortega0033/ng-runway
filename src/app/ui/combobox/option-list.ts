import { Listbox, Option } from '@angular/aria/listbox';
import { ComboboxWidget } from '@angular/aria/combobox';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon';
import { SpinnerComponent } from '../spinner/spinner';

export interface ComboOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Case-insensitive "contains" filter on the option label. An empty term keeps every option. */
export function filterOptions(
  options: readonly ComboOption[],
  term: string,
): readonly ComboOption[] {
  const needle = term.trim().toLowerCase();
  return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
}

/**
 * Merge the values a listbox reports into the current selection. Selected values that are
 * filtered out of the list are not visible to the listbox, so they are kept as they are.
 */
export function mergeSelection(
  current: readonly string[],
  emitted: readonly string[],
  visible: readonly ComboOption[],
): string[] {
  const shown = new Set(visible.map((o) => o.value));
  const next = new Set(emitted);
  const kept = current.filter((v) => !shown.has(v) || next.has(v));
  return [...kept, ...emitted.filter((v) => !kept.includes(v))];
}

/**
 * Popup body shared by ui-combobox and ui-multiselect. It must be rendered inside an
 * `ng-template[ngComboboxPopup]`, because the widget registers itself with that popup.
 */
@Component({
  selector: 'ui-option-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Listbox, Option, ComboboxWidget, IconComponent, SpinnerComponent],
  host: {
    class:
      'block max-h-64 overflow-auto rounded-md border border-border bg-background-surface-page py-1 shadow-lg',
  },
  template: `
    @if (options().length > 0) {
      <ul
        ngListbox
        ngComboboxWidget
        #lb="ngListbox"
        class="m-0 list-none p-0 outline-none"
        focusMode="activedescendant"
        selectionMode="explicit"
        [multi]="multi()"
        [softDisabled]="false"
        [value]="selectedList()"
        [activeDescendant]="lb.activeDescendant()"
        [attr.aria-label]="label() || null"
        (valueChange)="onValueChange($event)"
      >
        @for (o of options(); track o.value) {
          <li
            ngOption
            #opt="ngOption"
            class="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-base text-foreground hover:bg-background-hover data-[active=true]:bg-background-hover aria-disabled:cursor-not-allowed aria-disabled:text-foreground-disabled aria-disabled:hover:bg-transparent aria-selected:font-medium"
            [value]="o.value"
            [label]="o.label"
            [disabled]="!!o.disabled"
          >
            <span class="truncate">{{ o.label }}</span>
            @if (opt.selected()) {
              <ui-icon name="check" [size]="16" class="text-foreground-brand" />
            }
          </li>
        }
      </ul>
    }
    @if (loading()) {
      <div class="flex items-center gap-2 px-3 py-2 text-base text-foreground-subtle">
        <ui-spinner size="sm" [label]="loadingText()" />
        <span>{{ loadingText() }}</span>
      </div>
    } @else if (options().length === 0) {
      <div role="status" class="px-3 py-2 text-base text-foreground-subtle">
        {{ emptyText() }}
      </div>
    }
  `,
})
export class OptionListComponent {
  private readonly listbox = viewChild(Listbox);

  readonly options = input.required<readonly ComboOption[]>();
  readonly selected = input<readonly string[]>([]);
  readonly multi = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly emptyText = input('No results');
  readonly loadingText = input('Loading');
  readonly label = input('');
  readonly selectedChange = output<string[]>();

  /** Selected values that have an option in the list; the listbox drops all others on its own. */
  protected readonly selectedList = computed(() => {
    const shown = new Set(this.options().map((o) => o.value));
    return this.selected().filter((v) => shown.has(v));
  });

  /**
   * The listbox also reports value changes that did not come from the user (it prunes its
   * value while its options are still registering). Only changes made during a click or key
   * press are real picks; everything else is answered by restoring the value we gave it.
   */
  private pickInProgress = false;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const injector = inject(Injector);
    const arm = () => {
      this.pickInProgress = true;
      afterNextRender(
        () => {
          this.pickInProgress = false;
          this.restore();
        },
        { injector },
      );
    };
    element.addEventListener('click', arm, true);
    element.addEventListener('keydown', arm, true);
    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('click', arm, true);
      element.removeEventListener('keydown', arm, true);
    });

    // Keep the active option on the first match whenever the filtered list changes.
    effect(() => {
      this.options();
      const listbox = this.listbox();
      untracked(() => listbox?.gotoFirst());
    });
  }

  protected onValueChange(next: string[]): void {
    if (this.pickInProgress) {
      // A single select reports a de-selected option as an empty list before the new pick.
      if (next.length > 0 || this.multi()) this.selectedChange.emit(next);
      return;
    }
    this.restore();
  }

  /** Put back the value we gave the listbox, undoing changes it made on its own. */
  private restore(): void {
    const listbox = this.listbox();
    const current = this.selectedList();
    if (!listbox) return;
    const next = untracked(() => listbox.value());
    if (next.length !== current.length || next.some((v) => !current.includes(v))) {
      listbox.value.set([...current]);
    }
  }
}
