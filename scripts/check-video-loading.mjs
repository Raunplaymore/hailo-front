import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile('src/components/analysis/AnalysisVideoPlayer.tsx', 'utf8');
const component = source.slice(source.indexOf('type AnalysisVideoPlayerProps')).replace('export function AnalysisVideoPlayer', 'function AnalysisVideoPlayer');
const {code} = await transform(component, {loader:'tsx', jsx:'transform'});
const slots = []; let cursor = 0;
const context = vm.createContext({
  React: {createElement: (type, props, ...children) => ({type, props: props || {}, children})},
  useRef: value => { const index=cursor++; return slots[index] ??= {current:value}; },
  useState: initial => { const index=cursor++; slots[index] ??= {value:initial}; return [slots[index].value, value => {slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;}]; },
  useEffect: () => {}, cn: (...values) => values.filter(Boolean).join(' '),
  Maximize2:()=>null, ChevronLeft:()=>null, ChevronRight:()=>null, Minimize2:()=>null,
  Pause:()=>null, Play:()=>null, Volume2:()=>null, VolumeX:()=>null,
});
vm.runInContext(code, context);
const props = {src:'/video', videoRef:{current:null}, mediaRef:{current:null}, currentTimeMs:0, onTimeChange(){}};
const render = () => {cursor=0; return context.AnalysisVideoPlayer(props);};
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child=>find(child,predicate)).find(Boolean) ?? null;
  if (!node || typeof node !== 'object') return null;
  return predicate(node) ? node : find(node.children, predicate);
}
const video = tree => find(tree, node => node.type === 'video');
const status = tree => find(tree, node => node.props?.role === 'status');
const play = tree => find(tree, node => node.props?.label === '재생');
let tree = render();
assert.equal(status(tree).children[0], '영상 준비 중');
assert.equal(play(tree).props.disabled, true);
video(tree).props.onLoadedMetadata({currentTarget:{readyState:1,duration:3,muted:false,currentTime:0}});
tree=render();
assert.equal(status(tree).children[0], '재생 버튼을 눌러 영상을 준비해 주세요');
assert.equal(play(tree).props.disabled, false, 'play remains available before the first frame');
video(tree).props.onPlay(); tree=render();
assert.equal(status(tree), null, 'the prompt clears once playback starts');
video(tree).props.onPause({currentTarget:{currentTime:0}});
tree=render(); assert.equal(status(tree).children[0], '재생 버튼을 눌러 영상을 준비해 주세요', 'pausing before a frame restores the prompt');
video(tree).props.onLoadedMetadata({currentTarget:{readyState:1,duration:3,muted:false,currentTime:0}});
tree=render(); video(tree).props.onLoadedData(); tree=render();
assert.equal(status(tree), null, 'the prompt also clears when a frame loads without playback');
video(tree).props.onWaiting(); tree=render();
assert.equal(status(tree).children[0], '장면 불러오는 중…');
video(tree).props.onCanPlay(); tree=render(); assert.equal(status(tree), null);
video(tree).props.onError(); tree=render(); assert.equal(status(tree), null, 'the error state takes precedence');
console.log('video first-frame guidance and playback/loading/error states passed');
