const baseUrl = (process.env.PERF_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const paths = (process.env.PERF_PATHS || '/,/explore,/search')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

const results = [];
for (const path of paths) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    const body = await response.arrayBuffer();
    results.push({
      path,
      status: response.status,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      bytes: body.byteLength,
    });
  } catch (error) {
    results.push({ path, error: error instanceof Error ? error.message : String(error) });
  }
}

console.table(results);
console.log(JSON.stringify({ baseUrl, measuredAt: new Date().toISOString(), results }, null, 2));
