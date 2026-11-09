import { TestBed } from '@angular/core/testing';
import { ToastContainerComponent, ToastService } from './toast';

describe('toast', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    const service = TestBed.inject(ToastService);
    const root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    return { fixture, service, root };
  }

  it('service adds toasts with defaults and dismisses by id', () => {
    const { service } = setup();
    const a = service.show({ variant: 'success', title: 'Roster published' });
    const b = service.show({ variant: 'info', title: 'Sync started', message: '12 employees' });

    expect(service.toasts().map((t) => t.id)).toEqual([a, b]);
    expect(service.toasts()[0].durationMs).toBe(5000);
    expect(service.toasts()[1].message).toBe('12 employees');

    service.dismiss(a);
    expect(service.toasts().map((t) => t.id)).toEqual([b]);
  });

  it('renders danger as role alert and info as role status', () => {
    const { fixture, service, root } = setup();
    service.show({ variant: 'danger', title: 'Save failed', durationMs: 0 });
    service.show({ variant: 'info', title: 'Draft saved', durationMs: 0 });
    fixture.detectChanges();

    const toasts = root.querySelectorAll('ui-toast');
    expect(toasts[0].getAttribute('role')).toBe('alert');
    expect(toasts[1].getAttribute('role')).toBe('status');
    expect(root.getAttribute('role')).toBe('region');
  });

  it('dismisses from its labelled button', () => {
    const { fixture, service, root } = setup();
    service.show({ variant: 'info', title: 'Draft saved', durationMs: 0 });
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')!.click();
    expect(service.toasts()).toEqual([]);
  });

  it('sets --index so the newest toast is 1 and older ones stack behind it', () => {
    const { fixture, service, root } = setup();
    service.show({ variant: 'info', title: 'First', durationMs: 0 });
    service.show({ variant: 'info', title: 'Second', durationMs: 0 });
    service.show({ variant: 'info', title: 'Third', durationMs: 0 });
    fixture.detectChanges();

    const indexes = [...root.querySelectorAll<HTMLElement>('ui-toast')].map((el) =>
      el.style.getPropertyValue('--index'),
    );
    expect(indexes).toEqual(['3', '2', '1']);
  });

  it('closes itself after durationMs', () => {
    vi.useFakeTimers();
    const { fixture, service } = setup();
    service.show({ variant: 'success', title: 'Saved', durationMs: 3000 });
    fixture.detectChanges();

    vi.advanceTimersByTime(2999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('pauses while hovered or focused and resumes with the time that was left', () => {
    vi.useFakeTimers();
    const { fixture, service, root } = setup();
    service.show({ variant: 'warning', title: 'Overtime limit', durationMs: 4000 });
    fixture.detectChanges();
    const toast = root.querySelector('ui-toast')!;

    vi.advanceTimersByTime(3000);
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(10_000);
    expect(service.toasts().length).toBe(1);

    toast.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('keeps a toast with durationMs 0 until dismissed', () => {
    vi.useFakeTimers();
    const { fixture, service } = setup();
    service.show({ variant: 'danger', title: 'Offline', durationMs: 0 });
    fixture.detectChanges();
    vi.advanceTimersByTime(60_000);
    expect(service.toasts().length).toBe(1);
  });
});
