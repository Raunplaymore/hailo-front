import { useMemo } from 'react';
import { LiveOverlayBox } from '../types/session';

interface Size {
  width: number;
  height: number;
}

interface RawDetection {
  bbox?: number[] | Record<string, number>;
  box?: number[] | Record<string, number>;
  rect?: number[] | Record<string, number>;
  bbox_xywh?: number[];
  xmin?: number;
  ymin?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  label?: string;
  class?: string;
  className?: string;
  category?: string;
  score?: number;
  confidence?: number;
  conf?: number;
  prob?: number;
}

interface RawFrame {
  detections?: RawDetection[];
  boxes?: RawDetection[];
  objects?: RawDetection[];
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
}

interface RawMetaPayload {
  frames?: RawFrame[];
  detections?: RawDetection[];
  boxes?: RawDetection[];
  objects?: RawDetection[];
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
}

/**
 * 메타 데이터에서 최신 프레임 추출
 */
function extractLatestFrame(payload: RawMetaPayload): RawFrame | null {
  if (!payload || typeof payload !== 'object') return null;

  const frames = Array.isArray(payload.frames) ? payload.frames : [];
  if (frames.length > 0) {
    return frames[frames.length - 1];
  }

  // frames가 없으면 payload 자체가 프레임일 수 있음
  return payload as RawFrame;
}

/**
 * 프레임 크기 추출
 */
function getFrameSize(frame: RawFrame, fallback?: Size): Size | null {
  const width = frame.width ?? frame.frameWidth ?? fallback?.width;
  const height = frame.height ?? frame.frameHeight ?? fallback?.height;

  if (width && height) {
    return { width, height };
  }

  return null;
}

/**
 * 단일 detection을 정규화된 bbox로 변환
 */
function normalizeDetection(
  detection: RawDetection,
  frameSize: Size | null
): LiveOverlayBox | null {
  const box = detection.bbox ?? detection.box ?? detection.rect ?? detection.bbox_xywh ?? detection;

  let xmin: number | undefined;
  let ymin: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  // 배열 형식: [xmin, ymin, width, height]
  if (Array.isArray(box) && box.length >= 4) {
    [xmin, ymin, width, height] = box.map(Number);
  }
  // 객체 형식
  else if (box && typeof box === 'object') {
    // xyxy 형식 (x1, y1, x2, y2)
    const x1 = box.xmin ?? box.x1 ?? box.left ?? box.x ?? detection.xmin ?? detection.x1 ?? detection.left;
    const y1 = box.ymin ?? box.y1 ?? box.top ?? box.y ?? detection.ymin ?? detection.y1 ?? detection.top;
    const x2 = box.xmax ?? box.x2 ?? box.right ?? detection.xmax ?? detection.x2 ?? detection.right;
    const y2 = box.ymax ?? box.y2 ?? box.bottom ?? detection.ymax ?? detection.y2 ?? detection.bottom;

    if (x1 != null && y1 != null && x2 != null && y2 != null) {
      xmin = Number(x1);
      ymin = Number(y1);
      width = Number(x2) - Number(x1);
      height = Number(y2) - Number(y1);
    }
    // xywh 형식
    else {
      xmin = Number(x1 ?? 0);
      ymin = Number(y1 ?? 0);
      width = Number(box.w ?? box.width ?? detection.w ?? detection.width);
      height = Number(box.h ?? box.height ?? detection.h ?? detection.height);
    }
  }

  // 유효성 검증
  if (
    xmin == null ||
    ymin == null ||
    width == null ||
    height == null ||
    Number.isNaN(xmin) ||
    Number.isNaN(ymin) ||
    Number.isNaN(width) ||
    Number.isNaN(height)
  ) {
    return null;
  }

  // 정규화 (0~1 범위로)
  let nx = xmin;
  let ny = ymin;
  let nw = width;
  let nh = height;

  // frameSize가 있고, 좌표가 1보다 크면 절대 좌표로 간주하고 정규화
  if (frameSize && (nx > 1 || ny > 1 || nw > 1 || nh > 1)) {
    nx = nx / frameSize.width;
    ny = ny / frameSize.height;
    nw = nw / frameSize.width;
    nh = nh / frameSize.height;
  }

  // 라벨 및 점수 추출
  const label = detection.label ?? detection.class ?? detection.className ?? detection.category;
  const score =
    typeof detection.score === 'number'
      ? detection.score
      : typeof detection.confidence === 'number'
      ? detection.confidence
      : typeof detection.conf === 'number'
      ? detection.conf
      : typeof detection.prob === 'number'
      ? detection.prob
      : undefined;

  return {
    xmin: nx,
    ymin: ny,
    width: nw,
    height: nh,
    label: typeof label === 'string' ? label : undefined,
    score,
  };
}

/**
 * bbox 정규화 훅
 *
 * @example
 * const normalizer = useBboxNormalizer({ width: 1456, height: 1088 });
 * const boxes = normalizer(rawMetaPayload);
 */
export function useBboxNormalizer(fallbackSize?: Size) {
  return useMemo(
    () => (payload: unknown): LiveOverlayBox[] => {
      const typedPayload = payload as RawMetaPayload;
      const frame = extractLatestFrame(typedPayload);
      if (!frame) return [];

      const frameSize = getFrameSize(frame, fallbackSize);
      const detections =
        frame.detections ?? frame.boxes ?? frame.objects ?? typedPayload.detections ?? typedPayload.boxes ?? [];

      if (!Array.isArray(detections)) return [];

      return detections
        .map((d) => normalizeDetection(d, frameSize))
        .filter((box): box is LiveOverlayBox => box !== null);
    },
    [fallbackSize?.width, fallbackSize?.height]
  );
}
