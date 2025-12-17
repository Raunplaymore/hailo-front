import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { UploadCard } from "./components/upload/UploadCard";
import { ShotList } from "./components/shots/ShotList";
import { MetricsTable } from "./components/analysis/MetricsTable";
import { AnalysisPlayer } from "./components/analysis/AnalysisPlayer";
import { CoachSummary } from "./components/analysis/CoachSummary";
import { Button } from "./components/Button";
import { useUpload } from "./hooks/useUpload";
import { useShots } from "./hooks/useShots";
import { useAnalysis } from "./hooks/useAnalysis";
import { Shot } from "./types/shots";
import { SettingsForm, UploadSettings } from "./components/settings/SettingsForm";
import { CameraSettings, CameraSettingsValue } from "./components/camera/CameraSettings";
import { CameraStatusPanel } from "./components/camera/CameraStatusPanel";
import { CameraPreview } from "./components/camera/CameraPreview";
import { CaptureControls } from "./components/camera/CaptureControls";
import { CaptureGallery } from "./components/camera/CaptureGallery";
import { CameraStatus, CaptureItem, CapturePayload } from "./types/camera";
import {
  buildStreamUrl,
  captureAndAnalyze,
  CameraApiError,
  getStatus as getCameraStatus,
  startCapture,
} from "./api/cameraApi";

type TabKey = "camera" | "upload" | "list" | "analysis" | "settings";

const CAMERA_ENV_BASE =
  (import.meta.env.VITE_CAMERA_API_BASE as string | undefined) ||
  // NEXT_PUBLIC prefix도 허용
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_API_BASE ?? "");
const CAMERA_ENV_TOKEN =
  (import.meta.env.VITE_CAMERA_AUTH_TOKEN as string | undefined) ||
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_AUTH_TOKEN ?? "");

const loadLocalJson = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(err);
    return null;
  }
};

const normalizeBase = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const { shots, selected, select, isLoading, error, refresh } = useShots();
  const upload = useUpload({
    onSuccess: () => {
      refresh();
    },
  });
  const [activeTab, setActiveTab] = useState<TabKey>("camera");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openShotIds, setOpenShotIds] = useState<Set<string>>(new Set());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [settings, setSettings] = useState<UploadSettings>({
    club: "driver",
  });
  const [cameraSettings, setCameraSettings] = useState<CameraSettingsValue>(() => {
    const stored = loadLocalJson<CameraSettingsValue>("cameraSettings");
    return {
      baseUrl: stored?.baseUrl || CAMERA_ENV_BASE || "",
      token: stored?.token || CAMERA_ENV_TOKEN || "",
      sessionPrefix: stored?.sessionPrefix || "",
      autoStopPreviewOnCapture: stored?.autoStopPreviewOnCapture ?? true,
    };
  });
  const [baseHistory, setBaseHistory] = useState<string[]>(
    () => loadLocalJson<string[]>("cameraBaseHistory") || []
  );
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [lastStatusCheckedAt, setLastStatusCheckedAt] = useState<string | null>(null);
  const [previewParams, setPreviewParams] = useState({ width: 640, height: 360, fps: 15 });
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPreviewOn, setIsPreviewOn] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewSessionId, setPreviewSessionId] = useState<number>(0);
  const [captureResolution, setCaptureResolution] = useState({ width: 1920, height: 1080 });
  const [captureFps, setCaptureFps] = useState(30);
  const [captureDuration, setCaptureDuration] = useState(5);
  const [captureBusyMessage, setCaptureBusyMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const streamClients = cameraStatus?.streamClients ?? 0;
  const isStreaming = cameraStatus?.streaming === true;
  const isCameraBusy = cameraStatus?.busy === true || isStreaming;
  const hasExternalStream = isStreaming && !isPreviewOn && streamClients > 0;

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "camera", label: "카메라" },
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
    selected?.videoUrl && selected.videoUrl !== ""
      ? selected.videoUrl
      : selected
      ? `${API_BASE}/uploads/${encodeURIComponent(selected.filename)}`
      : "";

  const {
    analysis,
    status: jobStatus,
    isLoading: isAnalysisLoading,
    error: analysisError,
  } = useAnalysis(selected);

  const toggleOpen = (shot: Shot) => {
    const next = new Set(openShotIds);
    if (next.has(shot.id)) {
      next.delete(shot.id);
    } else {
      next.add(shot.id);
    }
    setOpenShotIds(next);
    select(shot);
  };

  const rememberBase = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBaseHistory((prev) => {
      const filtered = prev.filter((item) => item !== trimmed);
      return [trimmed, ...filtered].slice(0, 5);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("cameraSettings", JSON.stringify(cameraSettings));
  }, [cameraSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("cameraBaseHistory", JSON.stringify(baseHistory));
  }, [baseHistory]);

  const handleCheckStatus = async () => {
    setIsStatusLoading(true);
    setStatusError(null);
    try {
      const status = await getCameraStatus(cameraSettings.baseUrl, cameraSettings.token || undefined);
      setCameraStatus(status);
      setLastStatusCheckedAt(new Date().toISOString());
      rememberBase(cameraSettings.baseUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "상태 확인 실패";
      setStatusError(message);
    } finally {
      setIsStatusLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "camera" && activeTab !== "settings") return;
    handleCheckStatus();
    const interval = window.setInterval(() => {
      handleCheckStatus();
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, cameraSettings.baseUrl, cameraSettings.token]);

  const handleStartPreview = () => {
    if (isCameraBusy || hasExternalStream) {
      setPreviewError(
        hasExternalStream
          ? `스트림은 동시 1명만 허용됩니다. 다른 기기에서 프리뷰를 종료하세요. (현재 ${streamClients}명 접속)`
          : "카메라 사용 중(스트리밍/녹화). 잠시 후 다시 시도하세요."
      );
      return;
    }
    setPreviewError(null);
    try {
      const url = buildStreamUrl(cameraSettings.baseUrl, {
        ...previewParams,
        token: cameraSettings.token || undefined,
        cacheBust: Date.now(),
      });
      setStreamUrl(url);
      setIsPreviewOn(true);
      setPreviewSessionId((id) => id + 1);
      rememberBase(cameraSettings.baseUrl);
    } catch (err) {
      setIsPreviewOn(false);
      const message = err instanceof Error ? err.message : "프리뷰를 시작할 수 없습니다.";
      setPreviewError(message);
    }
  };

  const handleStopPreview = () => {
    setIsPreviewOn(false);
    setStreamUrl(null);
    // 낙관적으로 busy/streaming을 해제하고 후속 폴링으로 정합성을 맞춥니다.
    setCameraStatus((prev) =>
      prev
        ? {
            ...prev,
            busy: false,
            streaming: false,
            streamClients: 0,
          }
        : prev
    );
    console.log('handleStopPreview')
    handleCheckStatus();
    console.log('handleCheckStatus')
    window.setTimeout(handleCheckStatus, 800);
    window.setTimeout(handleCheckStatus, 2500);
  };

  const makeFilename = (ext: "jpg" | "mp4", type: string) => {
    const now = new Date();
    const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}_${pad(now.getMilliseconds(), 3)}`;
    const cleanType = type.replace(/\s+/g, "_");
    const prefix = cameraSettings.sessionPrefix ? `${cameraSettings.sessionPrefix}_` : "";
    return `${prefix}golf_${stamp}_${cleanType}.${ext}`;
  };

  const runCapture = async (payload: CapturePayload, analyze = false) => {
    if (!cameraSettings.baseUrl) {
      setCaptureBusyMessage("카메라 서버 주소를 입력하세요.");
      return;
    }

    if (hasExternalStream) {
      setCaptureBusyMessage("스트림 중입니다. 다른 기기에서 프리뷰를 종료 후 다시 시도하세요.");
      return;
    }

    if (isCameraBusy && !isPreviewOn) {
      setCaptureBusyMessage("카메라 사용 중(409): 스트리밍/녹화 종료 후 다시 시도하세요.");
      return;
    }

    if (cameraSettings.autoStopPreviewOnCapture && isPreviewOn) {
      handleStopPreview();
    }

    setIsCapturing(true);
    const durationLabel =
      payload.format === "mp4" ? `녹화 중... ${(payload as { durationSec?: number }).durationSec || ""}초` : "촬영 중...";
    setCaptureBusyMessage(durationLabel);

    try {
      const res = analyze
        ? await captureAndAnalyze(cameraSettings.baseUrl, payload, cameraSettings.token || undefined)
        : await startCapture(cameraSettings.baseUrl, payload, cameraSettings.token || undefined);
      const base = normalizeBase(cameraSettings.baseUrl);
      const url = res.url || `${base}/uploads/${encodeURIComponent(res.filename)}`;
      const item: CaptureItem = {
        filename: res.filename,
        url,
        format: payload.format,
        createdAt: new Date().toISOString(),
        jobId: res.jobId,
        status: res.status,
      };
      setCaptures((prev) => [item, ...prev].slice(0, 12));
      rememberBase(cameraSettings.baseUrl);
      setCaptureBusyMessage(analyze ? "녹화+분석 요청 완료" : "촬영 완료");
      handleCheckStatus();
    } catch (err) {
      if (err instanceof CameraApiError && err.status === 409) {
        setCaptureBusyMessage("카메라 사용 중(409): 프리뷰나 다른 녹화를 종료 후 재시도하세요.");
      } else {
        const message = err instanceof Error ? err.message : "캡처 요청 실패";
        setCaptureBusyMessage(message);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCaptureJpg = () =>
    runCapture({
      format: "jpg",
      width: captureResolution.width,
      height: captureResolution.height,
      filename: makeFilename("jpg", "still"),
    });

  const handleCaptureMp4 = (seconds: number) =>
    runCapture({
      format: "mp4",
      fps: captureFps,
      durationSec: seconds,
      width: captureResolution.width,
      height: captureResolution.height,
      filename: makeFilename("mp4", "swing"),
    });

  const handleCaptureAndAnalyze = (seconds: number) =>
    runCapture(
      {
        format: "mp4",
        fps: captureFps,
        durationSec: seconds,
        width: captureResolution.width,
        height: captureResolution.height,
        filename: makeFilename("mp4", "swing"),
      },
      true
    );

  return (
    <Shell
      tabs={tabs}
      active={activeTab}
      onChange={setActiveTab}
      onSettingsClick={() => setActiveTab("settings")}
    >
      {activeTab === "camera" && (
        <div className="space-y-4">
          <CameraPreview
            isActive={isPreviewOn}
            streamUrl={streamUrl}
            key={previewSessionId}
            width={previewParams.width}
            height={previewParams.height}
            fps={previewParams.fps}
            onChangeResolution={(width, height) => setPreviewParams((prev) => ({ ...prev, width, height }))}
            onChangeFps={(value) => setPreviewParams((prev) => ({ ...prev, fps: value }))}
            onStart={handleStartPreview}
            onStop={handleStopPreview}
            error={previewError}
            startDisabled={hasExternalStream || isCameraBusy}
          />
          <CaptureControls
            isCapturing={isCapturing}
            resolution={captureResolution}
            fps={captureFps}
            durationSec={captureDuration}
            onResolutionChange={(width, height) => setCaptureResolution({ width, height })}
            onFpsChange={(value) => setCaptureFps(value)}
            onDurationChange={(seconds) => setCaptureDuration(seconds)}
            onCaptureJpg={handleCaptureJpg}
            onCaptureMp4={handleCaptureMp4}
            onCaptureAnalyze={handleCaptureAndAnalyze}
            busyMessage={captureBusyMessage}
            isBusy={isCameraBusy || hasExternalStream}
          />
          <CaptureGallery items={captures} />
        </div>
      )}

      {activeTab === "upload" && (
        <UploadCard
          isUploading={upload.isUploading}
          message={upload.message}
          settings={settings}
          onUpload={async (file) => {
            const shot = await upload.start(file, "upload", settings);
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
          onAnalyze={(shot) => {
            select(shot);
            setActiveTab("analysis");
          }}
          onDelete={(shot) => handleDelete(shot)}
          deletingId={deletingId}
          openIds={openShotIds}
        />
      )}

      {activeTab === "analysis" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {isAnalysisLoading && <p className="text-sm text-slate-500">분석 상태를 불러오는 중...</p>}
            {analysisError && <p className="text-sm text-red-600">{analysisError}</p>}
            <MetricsTable
              analysis={analysis}
              status={jobStatus}
              onOpenVideo={selected ? () => setShowVideoModal(true) : undefined}
            />
          </div>
          <div className="space-y-2">
            <AnalysisPlayer
              videoUrl={selectedVideoUrl}
              events={analysis?.events}
              isModalOpen={showVideoModal}
            />
            {/* <CoachSummary comments={analysis?.coach_summary ?? []} /> */}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <CameraSettings
            value={cameraSettings}
            history={baseHistory}
            onChange={(next) => setCameraSettings(next)}
            onSelectHistory={(url) => setCameraSettings((prev) => ({ ...prev, baseUrl: url }))}
            onClearHistory={() => setBaseHistory([])}
          />
          <CameraStatusPanel
            status={cameraStatus}
            onRefresh={handleCheckStatus}
            isLoading={isStatusLoading}
            error={statusError}
            lastCheckedAt={lastStatusCheckedAt}
          />
          <SettingsForm
            value={settings}
            onChange={(next) => setSettings(next)}
            onSubmit={() => setActiveTab("upload")}
          />
        </div>
      )}

      {showVideoModal && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl p-4 space-y-3 bg-white shadow-xl rounded-xl">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                onClick={() => setShowVideoModal(false)}
                variant="outline"
                className="w-auto px-3 py-1 text-sm"
                fullWidth={false}
              >
                닫기
              </Button>
            </div>
            <video
              key={selected.id}
              className="w-full rounded-lg border border-slate-200 max-h-[600px] object-contain"
              controls
              preload="metadata"
              src={selectedVideoUrl}
            >
              브라우저에서 video 태그를 지원하지 않습니다.
            </video>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default App;
