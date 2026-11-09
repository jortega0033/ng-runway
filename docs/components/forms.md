# Form controls

All controls work with Signal Forms (`[formField]="form.name"`) and with plain `[(value)]` / `[(checked)]` bindings. Wrap a control in `ui-field` for the label, hint and error text.

```html
<ui-field label="Email" hint="Work address" [error]="emailError()">
  <ui-input type="email" [formField]="f.email" />
</ui-field>
```

## `ui-field`

| Input              | Notes                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `label` (required) | Visible label, linked to the control                                                         |
| `hint`             | Helper text under the control                                                                |
| `error`            | Error text. A non-empty value marks the control invalid and links it with `aria-describedby` |
| `required`         | Adds the required marker                                                                     |
| `forId`            | Use only when the control is not a direct child                                              |

## `ui-input`

`value` (model), `type` (`text | email | password | number | tel | search | url`), `size`, `placeholder`, `name`, `autocomplete`, `disabled`, `readonly`, `required`, `invalid`.

## `ui-textarea`

`value` (model), `rows` (4), `placeholder`, `disabled`, `readonly`, `required`, `invalid`.

## `ui-select`

Native `<select>`. `value` (model), `options` (`{ value, label, disabled? }[]`), `placeholder`, `disabled`, `required`, `invalid`. For long lists with search use `ui-combobox`.

## `ui-checkbox`

`checked` (model), `indeterminate`, `disabled`, `invalid`. Content is the label.

## `ui-switch`

`checked` (model), `disabled`. Applies immediately, so use it for settings, not for form fields that need Save. Content is the label.

## `ui-radio-group`

`value` (model), `options`, `orientation` (`vertical | horizontal`), `label`, `disabled`.

## `ui-segmented`

Small exclusive choice such as Day / Week. `value` (model), `options`, `label`, `disabled`.
