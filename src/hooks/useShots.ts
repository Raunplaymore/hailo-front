import { useCallback, useEffect, useState } from "react";
import { Shot } from "../types/shots";
import { fetchShots } from "../api/shots";

type UseShotsResult = {
  shots: Shot[];
  selected: Shot | null;
  isLoading: boolean;
  error: string | null;
  select: (shot: Shot | null) => void;
  refresh: () => Promise<void>;
};

export function useShots(): UseShotsResult {
  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState<Shot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchShots();
      setShots(data);
    } catch (err) {
      console.error(err);
      setError("샷 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [selected]);

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
