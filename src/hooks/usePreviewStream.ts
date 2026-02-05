import { useCallback, useState } from 'react';
import { buildStreamUrl, stopStream } from '../api/cameraApi';
import { useToast } from './use-toast';

interface UsePreviewStreamOptions {
  baseUrl: string;
  token?: string;
  autoStopOnCapture?: boolean;
  maxPixels?: number;
  onStatusCheck?: () => void;
}

interface PreviewParams {
  width: number;
  height: number;
  fps: number;
}

/**
 * 프리뷰 스트림 관리 훅
 */
export function usePreviewStream(options: UsePreviewStreamOptions) {
  const { baseUrl, token, autoStopOnCapture = true, maxPixels = 1280 * 720, onStatusCheck } = options;
  const { toast } = useToast();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState(0);

  const start = useCallback(
    (params: PreviewParams) => {
      if (params.width * params.height > maxPixels) {
        toast({
          variant: 'destructive',
          title: '프리뷰 시작 실패',
          description: '해상도가 너무 높습니다. 설정에서 낮춰주세요.',
        });
        return;
      }

      try {
        const url = buildStreamUrl(baseUrl, {
          ...params,
          token,
          cacheBust: Date.now(),
        });
        setStreamUrl(url);
        setIsActive(true);
        setSessionId((id) => id + 1);
        toast({
          title: '프리뷰 시작',
          description: `${params.width} x ${params.height} · ${params.fps}fps`,
        });
      } catch (err) {
        setIsActive(false);
        const message = err instanceof Error ? err.message : '프리뷰를 시작할 수 없습니다.';
        toast({
          variant: 'destructive',
          title: '프리뷰 시작 실패',
          description: message,
        });
      }
    },
    [baseUrl, token, maxPixels, toast]
  );

  const stop = useCallback(
    async (silent = false) => {
      if (baseUrl) {
        try {
          await stopStream(baseUrl, token);
        } catch (err) {
          const message = err instanceof Error ? err.message : '프리뷰 스트림 종료 실패';
          console.warn(message);
        }
      }

      setIsActive(false);
      setStreamUrl(null);

      // 상태 확인 콜백 호출 (낙관적 업데이트 후 정합성 맞추기)
      onStatusCheck?.();
      window.setTimeout(() => onStatusCheck?.(), 800);
      window.setTimeout(() => onStatusCheck?.(), 2500);

      if (!silent) {
        toast({ title: '프리뷰 종료', description: '스트림을 닫았습니다.' });
      }
    },
    [baseUrl, token, onStatusCheck, toast]
  );

  const handleError = useCallback(() => {
    setIsActive(false);
    setStreamUrl(null);
    onStatusCheck?.();
    toast({
      variant: 'destructive',
      title: '프리뷰 연결 끊김',
      description: '스트림이 종료되었습니다. 다시 켜주세요.',
    });
  }, [onStatusCheck, toast]);

  return {
    streamUrl,
    isActive,
    sessionId,
    start,
    stop,
    handleError,
    autoStopOnCapture,
  };
}
