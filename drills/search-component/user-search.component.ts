// DRILL FILE: deliberately flawed. Do not copy patterns from here into real code.
// Excluded from build, lint, format and CI. See drills/README.md.
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { mergeMap } from 'rxjs';

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-search',
  imports: [ReactiveFormsModule],
  template: `
    <input [formControl]="query" placeholder="Search" />

    <ul>
      @for (user of users; track $index) {
        <li>
          <div (click)="select(user)">{{ user.name }} ({{ user.email }})</div>
          <button (click)="moveUp($index)">Up</button>
        </li>
      }
    </ul>

    <p>Selected: {{ selected?.name }}</p>
  `,
})
export class UserSearchComponent implements OnInit {
  query = new FormControl('');
  users: User[] = [];
  selected: User | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.query.valueChanges
      .pipe(mergeMap((term) => this.http.get<User[]>('/api/users?q=' + term)))
      .subscribe((users) => {
        this.users = users;
        // Load the full profile of the first hit; nested subscribe, never cleaned up.
        if (users.length) {
          this.http.get<User>('/api/users/' + users[0].id).subscribe((profile) => {
            this.selected = profile;
          });
        }
      });
  }

  select(user: User) {
    this.selected = user;
  }

  moveUp(index: number) {
    if (index > 0) {
      const item = this.users[index];
      this.users.splice(index, 1);
      this.users.splice(index - 1, 0, item);
    }
  }
}
