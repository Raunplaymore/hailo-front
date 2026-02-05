import { useCallback, useEffect, useState } from 'react';
import { CameraStatus } from '../types/camera';
import { getStatus as getCameraStatus } from '../api/cameraApi';

interface UseCameraStateOptions {
  baseUrl: string;
  token?: string;
  pollingInterval?: number;
  enabled?: boolean;
}

/**
 * 카메라 상태 관리 훅
 *
 * @example
 * const camera = useCameraState({
 *   baseUrl: cameraSettings.baseUrl,
 *   token: cameraSettings.token,
 *   pollingInterval: 5000,
 *   enabled: activeTab === 'camera',
 * });
 */
export function useCameraState(options: UseCameraStateOptions) {
  const { baseUrl, token, pollingInterval = 5000, enabled = true } = options;

  const [status, setStatus] = useState<CameraStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!baseUrl) {
      setError('카메라 서버 주소를 입력하세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cameraStatus = await getCameraStatus(baseUrl, token);
      setStatus(cameraStatus);
      setLastCheckedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태 확인 실패';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, token]);

  // 폴링
  useEffect(() => {
    if (!enabled || !baseUrl) return;

    refresh();
    const interval = window.setInterval(() => {
      refresh();
    }, pollingInterval);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, baseUrl, token, pollingInterval, refresh]);

  return {
    status,
    error,
    isLoading,
    lastCheckedAt,
    refresh,
  };
}
