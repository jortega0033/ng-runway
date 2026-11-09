import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { useMockApi } from '../../testing/msw-test-server';
import { HomePage } from './home.page';

describe('HomePage', () => {
  const api = useMockApi();

  it('greets the signed-in user and links to the example feature', async () => {
    api.signIn('manager');
    TestBed.configureTestingModule({ providers: [...api.providers(), provideRouter([])] });
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));

    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('h1')?.textContent).toContain('Home');
    expect(root.textContent).toContain('Mark Jansen');
    expect(root.querySelector('a[href="/items"]')).not.toBeNull();
  });
});
