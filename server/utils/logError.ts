export function summarizeError(error: unknown): { errorName: string; errorMessage: string } {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const message = error instanceof Error ? error.message : 'Unknown failure';
  return {
    errorName: name.slice(0, 80),
    errorMessage: message
      .replace(/https?:\/\/\S+/g, '[URL]')
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[EMAIL]')
      .slice(0, 200),
  };
}
