// DRILL FILE: deliberately weak test (planted flaw 7). Excluded from build, lint, format and CI.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { UserSearchComponent } from './user-search.component';

describe('UserSearchComponent', () => {
  it('should create', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const fixture = TestBed.createComponent(UserSearchComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
