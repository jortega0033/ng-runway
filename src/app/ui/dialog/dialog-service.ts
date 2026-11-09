import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  type TemplateRef,
  inject,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../button/button';
import { DialogComponent, OVERLAY_TITLE_ID, type DialogSize } from './dialog';

export interface DialogConfig<D = unknown> {
  readonly size?: DialogSize;
  readonly data?: D;
  /** Accessible name when the content has no `ui-dialog` / `ui-drawer` title. */
  readonly ariaLabel?: string;
  /** Block Escape and backdrop dismissal (for example while saving). */
  readonly disableClose?: boolean;
  /** `end` is the drawer layout: a full-height panel on the right. */
  readonly placement?: 'center' | 'end';
}

export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  readonly danger?: boolean;
}

const WIDTHS: Record<DialogSize, string> = { sm: '24rem', md: '32rem', lg: '44rem' };

let nextTitleId = 0;

/**
 * Opens components or templates in a modal. Built on the CDK Dialog, which provides the focus
 * trap, Escape and backdrop dismissal, scroll blocking and focus restore to the opener.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  open<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config: DialogConfig<D> = {},
  ): DialogRef<R, C> {
    const size = config.size ?? 'md';
    const end = config.placement === 'end';
    const titleId = `ui-overlay-title-${nextTitleId++}`;
    return this.dialog.open<R, D, C>(content, {
      data: config.data,
      disableClose: config.disableClose ?? false,
      hasBackdrop: true,
      backdropClass: 'bg-scrim',
      panelClass: end ? 'ui-drawer-panel' : 'ui-dialog-panel',
      width: end ? `min(100vw, ${WIDTHS[size]})` : `min(calc(100vw - 2rem), ${WIDTHS[size]})`,
      height: end ? '100dvh' : undefined,
      maxWidth: '100vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
      ariaLabel: config.ariaLabel ?? null,
      ariaLabelledBy: config.ariaLabel ? null : titleId,
      providers: () => [{ provide: OVERLAY_TITLE_ID, useValue: titleId }],
      positionStrategy: end ? this.overlay.position().global().right('0').top('0') : undefined,
    });
  }

  /** Asks a yes/no question. Resolves `true` only when the user confirms; Escape resolves `false`. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const ref = this.open<boolean, ConfirmOptions, ConfirmDialogComponent>(ConfirmDialogComponent, {
      size: 'sm',
      data: options,
    });
    return (await firstValueFrom(ref.closed, { defaultValue: false })) === true;
  }
}

/** Content of `DialogService.confirm()`. */
@Component({
  selector: 'ui-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent],
  template: `
    <ui-dialog [title]="options.title" [closable]="false">
      {{ options.message }}
      <ng-container uiDialogFooter>
        <button ui-button type="button" variant="secondary" (click)="ref.close(false)">
          {{ options.cancelLabel ?? 'Cancel' }}
        </button>
        <button
          ui-button
          type="button"
          [variant]="options.danger ? 'danger' : 'primary'"
          (click)="ref.close(true)"
        >
          {{ options.confirmLabel ?? 'Confirm' }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly options = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
