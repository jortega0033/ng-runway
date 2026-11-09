import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DsChartsNavComponent } from './charts-nav-section';

describe('charts and nav design-system section', () => {
  it('renders every chart variant and both nav modes', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DsChartsNavComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('ui-bar-chart')).toHaveLength(4);
    expect(root.querySelectorAll('ui-line-chart')).toHaveLength(2);
    expect(root.querySelectorAll('ui-sidebar-nav nav')).toHaveLength(2);
    expect(root.querySelector('ui-top-bar header')).toBeTruthy();
  });
});
