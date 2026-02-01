// Setup file for Vitest
// Add global test utilities here

// Simple mock for tests that need it
export const mockFn = () => {
  const calls: unknown[] = [];
  const fn = (...args: unknown[]) => {
    calls.push(args);
  };
  fn.calls = calls;
  return fn;
};

// Empty export to make this a module
export {};
