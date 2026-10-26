import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'impact-review-'));
try {
  const outfile = join(dir, 'review.mjs');
  await build({entryPoints: ['src/api/impactReview.ts'], bundle: true, platform: 'node', format: 'esm', outfile, define: {'import.meta.env': '{}'}, logLevel: 'silent'});
  const {validateImpactReview} = await import(outfile);
  const valid = {ok: true, jobId: 'job', status: 'reference_candidate', modelSha256: '70b338b519565f870ed1fce044a0453f828773e53b9fa9d024391b3b4cf57733', publicValue: null, automaticCoachingReady: false, appliedToPrimary: false, requiresHumanConfirmation: true, frameTimesMs: [0, 33, 67, 100], candidate: {frameIndex: 2, timeMs: 67}};
  assert.equal(validateImpactReview(valid, 'job'), valid);
  for (const changed of [{jobId: 'other'}, {automaticCoachingReady: true}, {publicValue: 67}, {frameTimesMs: [0, 33, 30, 100]}, {candidate: {frameIndex: 4, timeMs: 100}}, {candidate: {frameIndex: 2, timeMs: 66}}, {modelSha256: 'other'}]) {
    assert.throws(() => validateImpactReview({...valid, ...changed}, 'job'));
  }
  console.log('impact review response checks passed');
} finally { await rm(dir, {recursive: true, force: true}); }
