import { describe, expect, it } from 'vitest';
import { WEATHER_LABEL, unitForLocale, weatherKind } from '../hooks/useWeather';

describe('weatherKind', () => {
  it('maps the WMO codes the API actually sends', () => {
    expect(weatherKind(0)).toBe('clear');
    expect(weatherKind(1)).toBe('partly');
    expect(weatherKind(2)).toBe('partly');
    expect(weatherKind(3)).toBe('cloud');
    expect(weatherKind(45)).toBe('fog');
    expect(weatherKind(48)).toBe('fog');
    expect(weatherKind(61)).toBe('rain');
    expect(weatherKind(80)).toBe('rain');
    expect(weatherKind(71)).toBe('snow');
    expect(weatherKind(86)).toBe('snow');
    expect(weatherKind(95)).toBe('storm');
    expect(weatherKind(99)).toBe('storm');
  });

  it('checks thunder before drizzle, so a storm is never drawn as rain', () => {
    // 95..99 overlap nothing, but the ordering in the function matters: a
    // reordering that put the 51..67 test first would swallow them.
    expect(weatherKind(96)).toBe('storm');
  });

  it('falls back to cloud for a code it has never seen', () => {
    expect(weatherKind(7)).toBe('cloud');
    expect(weatherKind(-1)).toBe('cloud');
  });

  it('has a label for every kind it can return', () => {
    const kinds = new Set(
      Array.from({ length: 110 }, (_, code) => weatherKind(code)),
    );
    for (const kind of kinds) {
      expect(WEATHER_LABEL[kind]).toBeTruthy();
    }
  });
});

describe('unitForLocale', () => {
  it('uses Fahrenheit where it is the everyday unit', () => {
    expect(unitForLocale('en-US')).toBe('fahrenheit');
    expect(unitForLocale('en-BZ')).toBe('fahrenheit');
  });

  it('uses Celsius everywhere else', () => {
    expect(unitForLocale('en-GB')).toBe('celsius');
    expect(unitForLocale('de-DE')).toBe('celsius');
    expect(unitForLocale('ja-JP')).toBe('celsius');
  });

  it('is case insensitive about the region', () => {
    expect(unitForLocale('en-us')).toBe('fahrenheit');
  });

  it('falls back to Celsius when the locale carries no region', () => {
    expect(unitForLocale('en')).toBe('celsius');
    expect(unitForLocale('')).toBe('celsius');
  });

  it('reads the browser locale when it is given nothing', () => {
    // The default argument is navigator.language, so calling it with no
    // argument has to agree with calling it with that value.
    expect(unitForLocale()).toBe(unitForLocale(navigator.language));
  });
});
