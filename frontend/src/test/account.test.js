import { describe, it, expect } from 'vitest';
import { readResetToken } from '../lib/account';

const TOKEN = 'Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6';

describe('readResetToken', () => {
  it('reads the token after the #', () => {
    expect(readResetToken('#' + TOKEN)).toBe(TOKEN);
  });

  it('tolerates a missing # and surrounding whitespace', () => {
    expect(readResetToken(TOKEN)).toBe(TOKEN);
    expect(readResetToken('# ' + TOKEN + ' ')).toBe(TOKEN);
  });

  it('gives nothing for an empty, short or malformed fragment', () => {
    expect(readResetToken('')).toBe('');
    expect(readResetToken(undefined)).toBe('');
    expect(readResetToken('#')).toBe('');
    expect(readResetToken('#tooshort')).toBe('');
    expect(readResetToken('#' + TOKEN + '/../x')).toBe('');
    expect(readResetToken('#<script>' + TOKEN)).toBe('');
  });
});
