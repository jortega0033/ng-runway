import { Injectable, signal } from '@angular/core';

/** Open state of the command palette. `app-command-palette` (mounted once in the shell) reacts to it. */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly state = signal(false);
  readonly isOpen = this.state.asReadonly();

  open(): void {
    this.state.set(true);
  }

  close(): void {
    this.state.set(false);
  }

  toggle(): void {
    this.state.update((open) => !open);
  }
}
