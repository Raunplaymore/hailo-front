import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionState, SessionStatus, LiveOverlayBox } from '../types/session';
import { AutoRecordState, AutoRecordStatus } from '../types/camera';
import { JobStatus, SessionRecord } from '../types/shots';
import {
  getAutoRecordStatus,
  getAutoRecordLive,
  startAutoRecord,
  stopAutoRecord,
} from '../api/cameraApi';
import { resolveCameraFileUrl } from '../api/sessionApi';
import { createAnalysisJobFromFile, fetchAnalysisStatus } from '../api/shots';
import { usePolling } from './usePolling';
import { useBboxNormalizer } from './useBboxNormalizer';

const AUTO_RECORD_ACTIVE_STATES = new Set<SessionState>([
  'starting',
  'arming',
  'addressLocked',
  'recording',
  'finishLocked',
  'stopping',
]);

const SESSION_RESOLUTION = { width: 1456, height: 1088 };

function mapAutoRecordState(state: AutoRecordState): SessionState {
  switch (state) {
    case 'arming':
      return 'arming';
    case 'addressLocked':
      return 'addressLocked';
    case 'recording':
      return 'recording';
    case 'finishLocked':
      return 'finishLocked';
    case 'stopping':
      return 'stopping';
    case 'failed':
      return 'failed';
    case 'idle':
    default:
      return 'idle';
  }
}

interface UseSessionRecordingOptions {
  baseUrl: string;
  token?: string;
  onSessionComplete?: (session: SessionRecord) => void;
  onPreviewStart?: () => void;
  onPreviewStop?: () => void;
}

/**
 * 세션 녹화 및 Auto-record 관리 훅
 */
export function useSessionRecording(options: UseSessionRecordingOptions) {
  const { baseUrl, token, onSessionComplete, onPreviewStart, onPreviewStop } = options;

  const [state, setState] = useState<SessionState>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [metaPath, setMetaPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<JobStatus | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [autoRecordStatus, setAutoRecordStatus] = useState<AutoRecordStatus | null>(null);
  const [liveBoxes, setLiveBoxes] = useState<LiveOverlayBox[]>([]);

  const lastAutoFilenameRef = useRef<string | null>(null);
  const normalizeBbox = useBboxNormalizer(SESSION_RESOLUTION);

  const processAutoRecordStatus = useCallback(
    async (status: AutoRecordStatus) => {
      setAutoRecordStatus(status);
      setRuntimeStatus(status.state);
      setRuntimeError(status.lastError ?? null);

      if (status.state === 'failed') {
        setError(status.lastError || '자동 녹화에 실패했습니다.');
        setState('failed');
        setLiveBoxes([]);
        onPreviewStop?.();
        return;
      }

      if (status.state === 'idle') {
        const recordedFilename = status.lastRecordingFilename || status.recordingFilename;
        if (recordedFilename && lastAutoFilenameRef.current !== recordedFilename) {
          lastAutoFilenameRef.current = recordedFilename;
          const url = resolveCameraFileUrl(baseUrl, `/uploads/${encodeURIComponent(recordedFilename)}`, recordedFilename);
          setFilename(recordedFilename);
          setVideoUrl(url);
          setMetaPath(null);

          try {
            const analysis = await createAnalysisJobFromFile(recordedFilename);
            setAnalysisJobId(analysis.jobId);
            setAnalysisStatus(analysis.status ?? 'queued');
            setState('analyzing');

            onSessionComplete?.({
              id: analysis.jobId ?? recordedFilename,
              filename: recordedFilename,
              createdAt: new Date().toISOString(),
              status: 'analyzing',
              videoUrl: url,
              jobId: analysis.jobId,
              analysisJobId: analysis.jobId,
            });

            onPreviewStop?.();
          } catch (err) {
            const message = err instanceof Error ? err.message : '분석을 시작하지 못했습니다.';
            setAnalysisError(message);
            setState('failed');
          }
        } else {
          setState('idle');
          setLiveBoxes([]);
        }
        return;
      }

      const mapped = mapAutoRecordState(status.state);
      setState(mapped);
      if (status.state === 'recording') {
        onPreviewStart?.();
      }
    },
    [baseUrl, onSessionComplete, onPreviewStart, onPreviewStop, normalizeBbox]
  );

  const start = useCallback(async () => {
    if (!baseUrl) {
      setError('카메라 서버 주소를 입력하세요.');
      return;
    }

    setError(null);
    setState('starting');
    setJobId(null);
    setFilename(null);
    setVideoUrl(null);
    setMetaPath(null);
    setAnalysisJobId(null);
    setAnalysisStatus(null);
    setAnalysisError(null);
    setRuntimeStatus(null);
    setRuntimeError(null);
    setLiveBoxes([]);
    setAutoRecordStatus(null);
    lastAutoFilenameRef.current = null;

    try {
      const res = await startAutoRecord(baseUrl, token);
      const status = res.status;
      await processAutoRecordStatus(status);
      onPreviewStart?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '세션 시작 실패';
      setError(message);
      setState('failed');
      onPreviewStop?.();
    }
  }, [baseUrl, token, processAutoRecordStatus, onPreviewStart, onPreviewStop]);

  const stop = useCallback(async () => {
    if (!baseUrl) {
      setError('카메라 서버 주소를 입력하세요.');
      return;
    }

    setError(null);
    setState('stopping');

    try {
      const res = await stopAutoRecord(baseUrl, token);
      await processAutoRecordStatus(res.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : '세션 종료 실패';
      setError(message);
      setState('failed');
      onPreviewStop?.();
    }
  }, [baseUrl, token, processAutoRecordStatus, onPreviewStop]);

  const reset = useCallback(() => {
    setState('idle');
    setJobId(null);
    setFilename(null);
    setVideoUrl(null);
    setMetaPath(null);
    setRuntimeStatus(null);
    setRuntimeError(null);
    setError(null);
    setAnalysisJobId(null);
    setAnalysisStatus(null);
    setAnalysisError(null);
    setLiveBoxes([]);
    setAutoRecordStatus(null);
    lastAutoFilenameRef.current = null;
  }, []);

  // Auto-record 상태 폴링
  usePolling(
    () => getAutoRecordStatus(baseUrl, token),
    {
      interval: 500,
      enabled: AUTO_RECORD_ACTIVE_STATES.has(state) && Boolean(baseUrl),
      onData: (res) => processAutoRecordStatus(res.status),
      onError: () => setRuntimeError('자동 녹화 상태를 불러오지 못했습니다.'),
    }
  );

  // Auto-record 라이브 bbox 폴링
  usePolling(
    () => getAutoRecordLive(baseUrl, token, 30),
    {
      interval: 300,
      enabled: AUTO_RECORD_ACTIVE_STATES.has(state) && Boolean(baseUrl),
      onData: (res) => setLiveBoxes(normalizeBbox(res)),
      onError: () => {}, // 에러 무시
    }
  );

  // 분석 상태 폴링
  useEffect(() => {
    if (state !== 'analyzing' || !analysisJobId) return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await fetchAnalysisStatus(analysisJobId);
        if (cancelled) return;

        setAnalysisStatus(res.status);

        if (res.status === 'succeeded') {
          setState('done');
          return;
        }

        if (res.status === 'failed') {
          const message = res.errorMessage ?? '분석이 실패했습니다.';
          setAnalysisError(message);
          setState('failed');
          onPreviewStop?.();
          return;
        }

        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setAnalysisError('분석 상태를 불러오지 못했습니다.');
        timer = window.setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [state, analysisJobId, onPreviewStop]);

  const isActive = AUTO_RECORD_ACTIVE_STATES.has(state);

  const overlayLabel =
    state === 'arming'
      ? '어드레스 감지 중'
      : state === 'addressLocked'
      ? '어드레스 확인'
      : state === 'recording'
      ? 'AI 세션 촬영중'
      : state === 'finishLocked'
      ? '스윙 종료 감지'
      : state === 'stopping'
      ? '세션 종료 중'
      : state === 'analyzing'
      ? '분석 중'
      : null;

  return {
    state,
    jobId,
    filename,
    videoUrl,
    metaPath,
    error,
    runtimeStatus,
    runtimeError,
    analysisJobId,
    analysisStatus,
    analysisError,
    liveBoxes,
    isActive,
    overlayLabel,
    start,
    stop,
    reset,
  };
}
