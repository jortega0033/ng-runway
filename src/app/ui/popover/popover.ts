import { type ConnectedPosition, Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { hasModifierKey } from '@angular/cdk/keycodes';
import type { TemplateRef } from '@angular/core';
import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  ViewContainerRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  booleanAttribute,
} from '@angular/core';
import { Subscription } from 'rxjs';

export type PopoverPosition = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
export type PopoverMode = 'click' | 'manual';

/** What the popover template receives: `<ng-template let-close="close">`. */
export interface PopoverContext {
  readonly $implicit: PopoverTriggerDirective;
  readonly close: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let nextId = 0;

function positionsFor(position: PopoverPosition): ConnectedPosition[] {
  const [side, align] = position.split('-') as ['bottom' | 'top', 'start' | 'end'];
  const flip = side === 'bottom' ? 'top' : 'bottom';
  const make = (s: 'bottom' | 'top'): ConnectedPosition => ({
    originX: align,
    originY: s,
    overlayX: align,
    overlayY: s === 'bottom' ? 'top' : 'bottom',
    offsetY: s === 'bottom' ? 4 : -4,
  });
  return [make(side), make(flip)];
}

/**
 * Anchors an overlay to the host element.
 *
 * ```html
 * <button ui-button [uiPopoverTrigger]="menu">Filters</button>
 * <ng-template #menu let-close="close">...</ng-template>
 * ```
 * In `click` mode the host toggles the popover and gets aria-expanded / aria-controls.
 * In `manual` mode the host is only the anchor; call `open()`, `close()` or `toggle()`.
 * Escape closes it and returns focus to where it was before opening; a click outside closes it.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- UI library prefix is `ui`
  selector: '[uiPopoverTrigger]',
  exportAs: 'uiPopoverTrigger',
  host: {
    '[attr.aria-haspopup]':
      'uiPopoverMode() === "click" && uiPopoverRole() !== "none" ? uiPopoverRole() : null',
    '[attr.aria-expanded]': 'uiPopoverMode() === "click" ? isOpen() : null',
    '[attr.aria-controls]': 'uiPopoverMode() === "click" && isOpen() ? panelId : null',
    '(click)': 'onHostClick()',
  },
})
export class PopoverTriggerDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly injector = inject(Injector);

  readonly uiPopoverTrigger = input.required<TemplateRef<PopoverContext>>();
  readonly uiPopoverPosition = input<PopoverPosition>('bottom-start');
  readonly uiPopoverMode = input<PopoverMode>('click');
  readonly uiPopoverRole = input<'dialog' | 'listbox' | 'menu' | 'none'>('dialog');
  readonly uiPopoverLabel = input('');
  /** Move focus into the panel on open. Turn off when focus must stay in an input. */
  readonly uiPopoverAutofocus = input(true, { transform: booleanAttribute });
  /** Make the panel at least as wide as the host. */
  readonly uiPopoverMatchWidth = input(false, { transform: booleanAttribute });

  readonly uiPopoverOpened = output();
  readonly uiPopoverClosed = output();

  protected readonly panelId = `ui-popover-${nextId++}`;
  private readonly open$ = signal(false);
  readonly isOpen = computed(() => this.open$());

  private overlayRef: OverlayRef | null = null;
  private subscription: Subscription | null = null;
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  toggle(restoreFocusTo?: HTMLElement): void {
    if (this.open$()) {
      this.close();
    } else {
      this.open(restoreFocusTo);
    }
  }

  /** `restoreFocusTo` is where focus goes on close; defaults to the focused element, then the host. */
  open(restoreFocusTo?: HTMLElement): void {
    if (this.open$()) return;
    const active = document.activeElement;
    this.returnFocusTo =
      restoreFocusTo ?? (active instanceof HTMLElement ? active : this.host.nativeElement);

    const overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withPositions(positionsFor(this.uiPopoverPosition()))
        .withPush(false),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      minWidth: this.uiPopoverMatchWidth() ? this.host.nativeElement.offsetWidth : undefined,
      panelClass: [
        'rounded-lg',
        'border',
        'border-border',
        'bg-background-surface-page',
        'text-foreground',
        'shadow-lg',
      ],
    });
    this.overlayRef = overlayRef;

    const pane = overlayRef.overlayElement;
    pane.id = this.panelId;
    if (this.uiPopoverRole() !== 'none') pane.setAttribute('role', this.uiPopoverRole());
    if (this.uiPopoverLabel()) pane.setAttribute('aria-label', this.uiPopoverLabel());

    const context: PopoverContext = { $implicit: this, close: () => this.close() };
    overlayRef.attach(new TemplatePortal(this.uiPopoverTrigger(), this.viewContainer, context));

    this.subscription = new Subscription();
    this.subscription.add(
      overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape' && !hasModifierKey(event)) {
          event.preventDefault();
          this.close();
        }
      }),
    );
    this.subscription.add(
      overlayRef.outsidePointerEvents().subscribe((event) => {
        const target = event.target;
        if (target instanceof Node && this.host.nativeElement.contains(target)) return;
        this.close(false);
      }),
    );

    this.open$.set(true);
    if (this.uiPopoverAutofocus()) {
      afterNextRender(() => this.focusFirst(pane), { injector: this.injector });
    }
    this.uiPopoverOpened.emit();
  }

  close(restoreFocus = true): void {
    if (!this.open$()) return;
    this.dispose();
    this.open$.set(false);
    if (restoreFocus) {
      const target = this.returnFocusTo?.isConnected ? this.returnFocusTo : this.host.nativeElement;
      target.focus();
    }
    this.returnFocusTo = null;
    this.uiPopoverClosed.emit();
  }

  protected onHostClick(): void {
    if (this.uiPopoverMode() === 'click') this.toggle();
  }

  private focusFirst(pane: HTMLElement): void {
    const first = pane.querySelector<HTMLElement>(FOCUSABLE);
    if (first) {
      first.focus();
    } else {
      pane.tabIndex = -1;
      pane.focus();
    }
  }

  private dispose(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
