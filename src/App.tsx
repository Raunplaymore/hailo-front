import { useMemo, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { UploadCard } from "./components/upload/UploadCard";
import { ShotList } from "./components/shots/ShotList";
import { VideoPlayer } from "./components/player/VideoPlayer";
import { MetricsTable } from "./components/analysis/MetricsTable";
import { CoachSummary } from "./components/analysis/CoachSummary";
import { useUpload } from "./hooks/useUpload";
import { useShots } from "./hooks/useShots";
import { useAnalysis } from "./hooks/useAnalysis";
import { Shot } from "./types/shots";

type TabKey = "upload" | "list" | "player" | "analysis";

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const { shots, selected, select, isLoading, error, refresh } = useShots();
  const upload = useUpload({
    onSuccess: () => {
      refresh();
      setActiveTab("list");
    },
  });
  const [activeTab, setActiveTab] = useState<TabKey>("upload");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "upload", label: "업로드" },
      { key: "list", label: "영상 목록" },
      { key: "player", label: "플레이어" },
      { key: "analysis", label: "분석" },
    ],
    []
  );

  const handleDelete = async (shot: Shot) => {
    setDeletingId(shot.id);
    try {
      await fetch(`${API_BASE}/api/files/${encodeURIComponent(shot.filename)}`, {
        method: "DELETE",
      });
      await refresh();
      if (selected?.id === shot.id) {
        select(null);
        setActiveTab("list");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedVideoUrl =
    selected?.videoUrl ||
    (selected ? `${API_BASE}/uploads/${encodeURIComponent(selected.filename)}` : "");

  const { analysis, isLoading: isAnalysisLoading, error: analysisError } = useAnalysis(selected);

  return (
    <Shell tabs={tabs} active={activeTab} onChange={setActiveTab}>
      {activeTab === "upload" && (
        <UploadCard
          isUploading={upload.isUploading}
          message={upload.message}
          onUpload={(file, club) => upload.start(file, "upload", club)}
        />
      )}

      {activeTab === "list" && (
        <ShotList
          shots={shots}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
          onSelect={(shot) => {
            select(shot);
            setActiveTab("player");
          }}
          onDelete={(shot) => handleDelete(shot)}
          deletingId={deletingId}
        />
      )}

      {activeTab === "player" && (
        <div className="grid gap-4">
          {selected ? (
            <VideoPlayer src={selectedVideoUrl} title={selected.filename} />
          ) : (
            <p className="text-slate-500">목록에서 영상을 선택하면 재생됩니다.</p>
          )}
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {isAnalysisLoading && <p className="text-sm text-slate-500">분석 불러오는 중...</p>}
            {analysisError && <p className="text-sm text-red-600">{analysisError}</p>}
            <MetricsTable analysis={analysis} />
          </div>
          <CoachSummary comments={analysis?.coach_summary ?? []} />
        </div>
      )}
    </Shell>
  );
}

export default App;
