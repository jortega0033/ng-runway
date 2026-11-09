import {
  emailRule,
  hourlyRateRule,
  hoursPerWeekRule,
  parseDecimal,
  requiredRule,
  startDateRule,
} from './employee-form.rules';

describe('employee form rules', () => {
  it('parses decimals with a dot or a comma and rejects the rest', () => {
    expect(parseDecimal('37.5')).toBe(37.5);
    expect(parseDecimal(' 37,5 ')).toBe(37.5);
    expect(parseDecimal('32')).toBe(32);
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('-4')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
    expect(parseDecimal('')).toBeNaN();
  });

  it('requires text that is not only spaces', () => {
    expect(requiredRule('')).toBe('required');
    expect(requiredRule('   ')).toBe('required');
    expect(requiredRule('Sara')).toBeNull();
  });

  it('checks email', () => {
    expect(emailRule('')).toBe('required');
    expect(emailRule('sara')).toBe('email');
    expect(emailRule('sara@example')).toBe('email');
    expect(emailRule('sara bakker@example.com')).toBe('email');
    expect(emailRule('sara.bakker@example.com')).toBeNull();
  });

  it('keeps hours per week between 0 and 60', () => {
    expect(hoursPerWeekRule('')).toBe('required');
    expect(hoursPerWeekRule('many')).toBe('number');
    expect(hoursPerWeekRule('61')).toBe('hoursRange');
    expect(hoursPerWeekRule('60')).toBeNull();
    expect(hoursPerWeekRule('0')).toBeNull();
    expect(hoursPerWeekRule('37,5')).toBeNull();
  });

  it('checks the hourly rate', () => {
    expect(hourlyRateRule('')).toBe('required');
    expect(hourlyRateRule('free')).toBe('number');
    expect(hourlyRateRule('9999')).toBe('rateRange');
    expect(hourlyRateRule('18,50')).toBeNull();
  });

  it('accepts only real calendar dates', () => {
    expect(startDateRule('')).toBe('required');
    expect(startDateRule('09-11-2026')).toBe('date');
    expect(startDateRule('2026-02-30')).toBe('date');
    expect(startDateRule('2026-11-09')).toBeNull();
  });
});
