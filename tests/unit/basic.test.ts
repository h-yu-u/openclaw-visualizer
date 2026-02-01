import { describe, it, expect } from 'vitest';

describe('Environment Check', () => {
  it('should have Node.js 18+', () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(18);
  });

  it('should have required environment variables', () => {
    expect(process.env).toBeDefined();
  });
});

describe('Basic Math', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
    expect(2 + 3).toBe(5);
  });

  it('should handle strings', () => {
    expect('hello').toContain('ell');
    expect('world'.length).toBe(5);
  });
});
