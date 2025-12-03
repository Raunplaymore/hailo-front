import { useMemo, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { UploadCard } from "./components/upload/UploadCard";
import { ShotList } from "./components/shots/ShotList";
import { MetricsTable } from "./components/analysis/MetricsTable";
import { CoachSummary } from "./components/analysis/CoachSummary";
import { useUpload } from "./hooks/useUpload";
import { useShots } from "./hooks/useShots";
import { useAnalysis } from "./hooks/useAnalysis";
import { Shot } from "./types/shots";

type TabKey = "upload" | "list" | "analysis";

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
  const [openShotIds, setOpenShotIds] = useState<Set<string>>(new Set());

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "upload", label: "업로드" },
      { key: "list", label: "영상 목록" },
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
        setOpenShotIds(new Set());
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

  const toggleOpen = (shot: Shot) => {
    const next = new Set(openShotIds);
    if (next.has(shot.id)) {
      next.delete(shot.id);
    } else {
      next.add(shot.id);
      select(shot);
      setActiveTab("analysis");
    }
    setOpenShotIds(next);
  };

  return (
    <Shell tabs={tabs} active={activeTab} onChange={setActiveTab}>
      {activeTab === "upload" && (
        <UploadCard
          isUploading={upload.isUploading}
          message={upload.message}
          onUpload={async (file, club) => {
            const shot = await upload.start(file, "upload", club);
            if (shot) {
              await refresh();
              select(shot);
              setActiveTab("analysis");
            }
          }}
        />
      )}

      {activeTab === "list" && (
        <ShotList
          shots={shots}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
          onSelect={toggleOpen}
          onDelete={(shot) => handleDelete(shot)}
          deletingId={deletingId}
          openIds={openShotIds}
        />
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
