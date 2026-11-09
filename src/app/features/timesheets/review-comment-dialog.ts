import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ButtonComponent,
  DialogComponent,
  FieldComponent,
  TextareaComponent,
  type DialogService,
} from '@ui/index';

/** All texts come from the caller, so the dialog works for timesheets and for absence requests. */
export interface ReviewDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  commentLabel: string;
  commentHint?: string;
  /** Shown when the comment is empty. Its presence makes the comment required. */
  requiredError?: string;
  variant: 'primary' | 'danger';
}

export interface ReviewDialogResult {
  comment: string;
}

@Component({
  selector: 'app-review-comment-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, DialogComponent, FieldComponent, TextareaComponent],
  template: `
    <ui-dialog [title]="data.title" [closeLabel]="data.closeLabel">
      <div class="flex flex-col gap-4">
        <p>{{ data.message }}</p>
        <ui-field
          [label]="data.commentLabel"
          [hint]="data.commentHint ?? ''"
          [error]="error()"
          [required]="!!data.requiredError"
        >
          <ui-textarea [rows]="3" [value]="comment()" (valueChange)="onInput($event)" />
        </ui-field>
      </div>
      <ng-container uiDialogFooter>
        <button ui-button type="button" variant="secondary" (click)="ref.close()">
          {{ data.cancelLabel }}
        </button>
        <button ui-button type="button" [variant]="data.variant" (click)="confirm()">
          {{ data.confirmLabel }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class ReviewCommentDialog {
  protected readonly data = inject<ReviewDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ReviewDialogResult>>(DialogRef);

  protected readonly comment = signal('');
  protected readonly error = signal('');

  protected onInput(value: string): void {
    this.comment.set(value);
    if (value.trim()) this.error.set('');
  }

  protected confirm(): void {
    const comment = this.comment().trim();
    if (this.data.requiredError && !comment) {
      this.error.set(this.data.requiredError);
      return;
    }
    this.ref.close({ comment });
  }
}

/** Opens the dialog. Resolves with the trimmed comment, or `null` when the user cancels. */
export async function askReviewComment(
  dialogs: DialogService,
  data: ReviewDialogData,
): Promise<string | null> {
  const ref = dialogs.open<ReviewDialogResult, ReviewDialogData, ReviewCommentDialog>(
    ReviewCommentDialog,
    { size: 'sm', data },
  );
  const result = await firstValueFrom(ref.closed, { defaultValue: undefined });
  return result ? result.comment : null;
}
