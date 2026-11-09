import { Overlay, type ConnectedPosition, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import type { Subscription } from 'rxjs';

export type TooltipPosition = 'top' | 'bottom';

let nextId = 0;

/** The bubble. Rendered by the directive, not used directly. */
@Component({
  selector: 'ui-tooltip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tooltip',
    '[id]': 'id()',
    class:
      'pointer-events-none block max-w-64 animate-tooltip-enter rounded-md bg-background-inverted ' +
      'px-2 py-1 text-sm text-foreground-inverted shadow-md motion-reduce:animate-none',
  },
  template: `{{ text() }}`,
})
export class TooltipComponent {
  readonly text = signal('');
  readonly id = signal('');
}

/**
 * Short text hint for an element: `<button uiTooltip="Copy link">`.
 * Shows on hover (after `uiTooltipDelay` ms) and immediately on keyboard focus; hides on
 * leave, blur or Escape. While visible the host is described by it (aria-describedby).
 * Keep it for supplementary text; do not put essential information only in a tooltip.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- UI library prefix is `ui`
  selector: '[uiTooltip]',
  host: {
    '[attr.aria-describedby]': 'visible() ? tooltipId : null',
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(click)': 'hide()',
  },
})
export class TooltipDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlay = inject(Overlay);

  readonly uiTooltip = input('');
  readonly uiTooltipPosition = input<TooltipPosition>('top');
  /** Hover delay in milliseconds. Focus ignores it. */
  readonly uiTooltipDelay = input(300, { transform: numberAttribute });

  protected readonly tooltipId = `ui-tooltip-${nextId++}`;
  protected readonly visible = signal(false);

  private overlayRef: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private keys: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected scheduleShow(): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.show(), this.uiTooltipDelay());
  }

  protected show(): void {
    this.clearTimer();
    const text = this.uiTooltip();
    if (!text || this.overlayRef) return;

    const above = this.uiTooltipPosition() === 'top';
    const positions: ConnectedPosition[] = [
      { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
      { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
    ];
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withPositions(above ? positions : [positions[1], positions[0]]),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    });
    const ref = this.overlayRef.attach(new ComponentPortal(TooltipComponent));
    ref.instance.text.set(text);
    ref.instance.id.set(this.tooltipId);
    ref.changeDetectorRef.detectChanges();

    this.keys = this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.hide();
    });
    this.visible.set(true);
  }

  protected hide(): void {
    this.clearTimer();
    this.keys?.unsubscribe();
    this.keys = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.visible.set(false);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
