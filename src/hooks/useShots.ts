import { useCallback, useEffect, useRef, useState } from "react";
import { Shot } from "../types/shots";
import { fetchShots } from "../api/shots";
import { isShotStoreUnavailable } from "../api/client";

type UseShotsResult = {
  shots: Shot[];
  selected: Shot | null;
  isLoading: boolean;
  error: string | null;
  select: (shot: Shot | null) => void;
  refresh: (options?: { silent?: boolean; activeOnly?: boolean }) => Promise<void>;
};

export function useShots(): UseShotsResult {
  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState<Shot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const refreshPending = useRef(false);
  const currentShots = useRef(shots);
  currentShots.current = shots;

  const load = useCallback(async ({ silent = false, activeOnly = false }: { silent?: boolean; activeOnly?: boolean } = {}): Promise<void> => {
    if (inFlight.current) {
      if (!activeOnly) refreshPending.current = true;
      return;
    }
    const jobIds = activeOnly ? currentShots.current.filter((shot) =>
      ["queued", "running"].includes(shot.status || "") ||
      ["pending", "uploading", "retrying"].includes(shot.nasArchive?.state || "")
    ).map((shot) => shot.jobId).filter((id): id is string => Boolean(id)) : undefined;
    if (jobIds?.length === 0) return;
    inFlight.current = true;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const data = await fetchShots(jobIds);
      setError(null);
      if (jobIds) {
        const updates = new Map(data.map((shot) => [shot.jobId, shot]));
        setShots((current) => current.map((shot) => updates.get(shot.jobId) || shot));
      } else {
        setShots(data);
      }
    } catch (err) {
      console.error(err);
      setError(isShotStoreUnavailable(err) ? err.message : "영상 목록을 불러오지 못했습니다.");
    } finally {
      inFlight.current = false;
      if (!silent) setIsLoading(false);
      if (refreshPending.current) {
        refreshPending.current = false;
        void load({ silent: true });
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    shots,
    selected,
    isLoading,
    error,
    select: setSelected,
    refresh: load,
  };
}
