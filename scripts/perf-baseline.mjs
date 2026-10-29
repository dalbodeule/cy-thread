const baseUrl = (process.env.PERF_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const paths = (process.env.PERF_PATHS || '/,/explore,/search')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
const iterations = Number(process.env.PERF_ITERATIONS || 5);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100) {
  throw new Error('PERF_ITERATIONS must be an integer from 1 to 100');
}

const percentile = (samples, fraction) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

const results = [];
let failed = false;
for (const path of paths) {
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
      const body = await response.arrayBuffer();
      const durationMs = Math.round((performance.now() - started) * 100) / 100;
      samples.push({
        iteration: iteration + 1,
        status: response.status,
        ok: response.ok,
        durationMs,
        bodyBytes: body.byteLength,
        cfCacheStatus: response.headers.get('cf-cache-status'),
        cacheControl: response.headers.get('cache-control'),
        contentEncoding: response.headers.get('content-encoding'),
        serverTiming: response.headers.get('server-timing'),
      });
      if (!response.ok) failed = true;
    } catch (error) {
      samples.push({
        iteration: iteration + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      failed = true;
    }
  }

  const timings = samples.flatMap((sample) => ('durationMs' in sample ? [sample.durationMs] : []));
  results.push({
    path,
    samples,
    p50Ms: timings.length ? percentile(timings, 0.5) : null,
    p95Ms: timings.length ? percentile(timings, 0.95) : null,
    bodyBytes: samples.find((sample) => 'bodyBytes' in sample)?.bodyBytes ?? null,
    cacheStatuses: samples.map((sample) => sample.cfCacheStatus ?? sample.error ?? 'unknown'),
    cacheControl: samples.findLast((sample) => sample.cacheControl)?.cacheControl ?? null,
  });
}

console.table(
  results.map(({ path, p50Ms, p95Ms, bodyBytes, cacheStatuses, cacheControl }) => ({
    path,
    p50Ms,
    p95Ms,
    bodyBytes,
    cacheStatuses: cacheStatuses.join(' → '),
    cacheControl,
  }))
);
console.log(
  JSON.stringify({ baseUrl, iterations, measuredAt: new Date().toISOString(), results }, null, 2)
);
if (failed) process.exitCode = 1;
