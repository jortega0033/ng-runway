import {
  availableDays,
  dayError,
  dayLabel,
  defaultWeek,
  formToWeek,
  isValidTime,
  weekToForm,
} from './availability';

describe('availability helpers', () => {
  it('starts a new employee on weekdays 09:00-17:00 with the weekend off', () => {
    const week = defaultWeek();
    expect(week).toHaveLength(7);
    expect(
      week.slice(0, 5).every((d) => d.available && d.from === '09:00' && d.to === '17:00'),
    ).toBe(true);
    expect(week.slice(5).every((d) => !d.available)).toBe(true);
  });

  it('round-trips the API shape through the form shape', () => {
    const api = [
      { from: '08:00', to: '16:00' },
      null,
      { from: '10:00', to: '18:30' },
      null,
      null,
      null,
      { from: '12:00', to: '20:00' },
    ];
    expect(formToWeek(weekToForm(api))).toEqual(api);
  });

  it('keeps default times for a day that is off, so switching it on has sane values', () => {
    expect(weekToForm([null])[0]).toEqual({ available: false, from: '09:00', to: '17:00' });
  });

  it('always yields seven days, even when the API sends fewer', () => {
    expect(weekToForm([{ from: '08:00', to: '12:00' }])).toHaveLength(7);
    expect(formToWeek([])).toEqual([null, null, null, null, null, null, null]);
  });

  it('validates times only for days that are switched on', () => {
    expect(dayError({ available: false, from: '', to: '' })).toBeNull();
    expect(dayError({ available: true, from: '', to: '17:00' })).toBe('timeRequired');
    expect(dayError({ available: true, from: '17:00', to: '09:00' })).toBe('timeOrder');
    expect(dayError({ available: true, from: '09:00', to: '09:00' })).toBe('timeOrder');
    expect(dayError({ available: true, from: '09:00', to: '17:00' })).toBeNull();
  });

  it('accepts HH:mm only', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
  });

  it('labels and counts days', () => {
    expect(dayLabel({ from: '09:00', to: '17:00' }, 'Off')).toBe('09:00 - 17:00');
    expect(dayLabel(null, 'Off')).toBe('Off');
    expect(
      availableDays([{ from: '09:00', to: '17:00' }, null, { from: '09:00', to: '12:00' }]),
    ).toBe(2);
  });
});
