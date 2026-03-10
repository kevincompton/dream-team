const originalWarn = console.warn;

console.warn = (...args: unknown[]) => {
  const msg = String(args[0] || '');
  if (
    msg.includes('Zod field at') ||
    msg.includes('.optional()` without `.nullable()') ||
    msg.includes('This will become an error in a future version of the SDK')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
