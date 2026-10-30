import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'coaching-lesson-'));
try {
  const outfile = join(dir, 'lesson.cjs');
  await build({
    stdin: {
      contents: `import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {CoachingLesson} from './src/components/analysis/CoachingLesson'; export const render=(topic,referenceVideo=false)=>renderToStaticMarkup(createElement(CoachingLesson,{topic,referenceVideo}));`,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, platform: 'node', format: 'cjs', outfile,
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
  });
  const { render } = await import(outfile);
  const pelvis = render('pelvis');
  const head = render('head');
  for (const html of [pelvis, head]) {
    assert.match(html, /<details/);
    assert.match(html, /<summary[^>]*min-h-12/);
    assert.match(html, /교습 원리와 연습/);
    assert.match(html, /내 영상의 판정과 별개인 일반 교습 안내/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /새 창/);
    assert.doesNotMatch(html, /진단 완료|확정 진단|교정 성공|type="checkbox"|기준으로 저장/);
  }
  assert.match(pelvis, /골반이 돌아갈 공간/);
  assert.match(pelvis, /몸이 일찍 펴지며 골반이 준비 자세보다 공 쪽으로/);
  assert.match(pelvis, /공간이 줄어들 수 있습니다/);
  assert.equal((pelvis.match(/role="img"/g) || []).length, 2);
  assert.match(pelvis, /단순화한 개념도/);
  assert.match(pelvis, /공 없이 천천히/);
  assert.match(pelvis, /목표는 공을 보내는 방향입니다/);
  assert.match(pelvis, /오른손 스윙은 왼쪽 엉덩이가 목표 쪽, 오른쪽이 반대쪽입니다/);
  assert.match(pelvis, /작은 백스윙에서 목표 반대쪽 엉덩이를 뒤로 돌려봅니다/);
  assert.match(pelvis, /목표 쪽 엉덩이가 뒤로 돌 공간을 만듭니다/);
  assert.match(pelvis, /href="https:\/\/www.titleist.com\/videos\/instruction\/early-extension-swing-fault"/);
  assert.match(head, /코 한 점의 이동에는 얼굴 회전이 섞입니다/);
  assert.match(head, /href="https:\/\/www.titleist.com\/videos\/instruction\/golf-myths-keep-your-head-still"/);
  assert.doesNotMatch(head, /골반이 돌아갈 공간/);
  const reference = render('pelvis', true);
  assert.match(reference, /전문가 동작 시범/);
  assert.match(reference, /YouTube/);
  assert.match(reference, /aria-expanded="false"/);
  assert.doesNotMatch(reference, /<iframe|youtube-nocookie\.com\/embed/,'external player must not load before a user chooses it');
  assert.doesNotMatch(render('head', true), /전문가 동작 시범/);
  console.log('coaching lesson: sourced topics, accessible disclosure and education boundaries passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
