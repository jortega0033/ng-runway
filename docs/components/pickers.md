# Pickers

Date and time fields for Signal Forms. Both implement `FormValueControl<string>`, sit inside `ui-field` for label, hint and error, and use the popover overlay. Import from `@ui/index`.

## Date picker

```html
<ui-field label="Start date">
  <ui-date-picker [formField]="f.startDate" min="2026-01-01" />
</ui-field>
```

The value is an ISO date `yyyy-MM-dd` (local calendar date, no time zone) or an empty string.

| Input                                         | Default      | Notes                                             |
| --------------------------------------------- | ------------ | ------------------------------------------------- |
| `value` (model)                               | `''`         | `yyyy-MM-dd`                                      |
| `min`, `max`                                  |              | `yyyy-MM-dd`; days outside are disabled           |
| `displayFormat`                               | `yyyy-MM-dd` | date-fns format of the text box (value stays ISO) |
| `weekStartsOn`                                | `1`          | 0 = Sunday, 1 = Monday                            |
| `size`                                        | `md`         | `sm` `md` `lg`                                    |
| `placeholder`, `name`                         |              |                                                   |
| `disabled`, `readonly`, `required`, `invalid` | `false`      |                                                   |
| `buttonLabel`, `calendarLabel`                | English      | aria-labels, override for translation             |

Output `touch`. Method `focus()`.

Typing: the text is committed on Enter or blur. Invalid text, impossible dates (2026-02-30) and dates outside `min`/`max` are rejected and the last good value is restored.

Keyboard (text box): ArrowDown opens the calendar. Calendar: arrows move by day and week, PageUp/PageDown by month (Shift: year), Home/End to the start and end of the week, Enter or Space selects, Escape closes and returns focus. Disabled days never receive focus.

`ui-calendar` (the grid) is exported on its own: inputs `value`, `min`, `max`, `weekStartsOn`, `locale`, `autofocus`, labels; output `selected`. It is an ARIA grid with one tab stop; today has `aria-current="date"` and a border, the selected day is filled.

## Time picker

```html
<ui-time-picker [formField]="f.start" [step]="30" min="06:00" max="22:00" />
```

The value is `HH:mm` (24-hour) or an empty string.

| Input                                         | Default       | Notes                                     |
| --------------------------------------------- | ------------- | ----------------------------------------- |
| `value` (model)                               | `''`          | `HH:mm`                                   |
| `step`                                        | `15`          | minutes between listed times              |
| `min`, `max`                                  | whole day     | `HH:mm`; limits the list and typed values |
| `size`, `placeholder`, `name`                 | `md`, `HH:mm` |                                           |
| `disabled`, `readonly`, `required`, `invalid` | `false`       |                                           |
| `buttonLabel`, `listLabel`                    | English       | aria-labels                               |

It is a combobox: focus stays in the text box; ArrowDown opens the list (current time active), ArrowUp/ArrowDown move, Enter picks, Escape closes. Any valid time can be typed: `930`, `9:30` and `09:30` all become `09:30`, committed on Enter or blur. Anything else restores the last value. Typed times between steps are accepted.
