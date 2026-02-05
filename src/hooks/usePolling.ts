import { useEffect, useRef } from 'react';

interface UsePollingOptions<T> {
  interval: number;
  enabled: boolean;
  onError?: (err: Error) => void;
  onData: (data: T) => void;
}

/**
 * 재사용 가능한 폴링 훅
 *
 * @example
 * usePolling(
 *   () => getAutoRecordLive(baseUrl, token, 30),
 *   {
 *     interval: 300,
 *     enabled: isRecording,
 *     onData: (data) => setLiveBoxes(normalizeLiveBoxes(data)),
 *     onError: (err) => console.error(err),
 *   }
 * );
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions<T>
) {
  const { interval, enabled, onError, onData } = options;

  // interval을 ref로 보관하여 의존성 배열에서 제외
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  // fetcher와 콜백도 ref로 보관
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      try {
        const data = await fetcherRef.current();
        if (cancelled) return;
        onDataRef.current(data);
      } catch (err) {
        if (cancelled) return;
        onErrorRef.current?.(err as Error);
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(poll, intervalRef.current);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled]); // enabled만 의존성으로
}
