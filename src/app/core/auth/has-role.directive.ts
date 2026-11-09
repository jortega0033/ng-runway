import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import type { UserRole } from '../api/models';
import { AuthService } from './auth.service';

/**
 * Shows its content only to the listed roles.
 *
 *   <button *hasRole="['admin', 'manager']">Publish</button>
 */
// eslint-disable-next-line @angular-eslint/directive-selector -- the spec asks for the short `*hasRole`
@Directive({ selector: '[hasRole]' })
export class HasRoleDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  readonly hasRole = input.required<readonly UserRole[]>();

  constructor() {
    effect(() => {
      const allowed =
        this.auth.role() !== null && this.hasRole().includes(this.auth.role() as UserRole);
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}
