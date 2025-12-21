import { useEffect, useMemo, useRef, useState } from "react";
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
import { API_BASE } from "./api/client";
import { CameraSettings, CameraSettingsValue } from "./components/camera/CameraSettings";
import { CameraStatusPanel } from "./components/camera/CameraStatusPanel";
import { CameraPreview } from "./components/camera/CameraPreview";
import { CaptureControls } from "./components/camera/CaptureControls";
import { CaptureGallery } from "./components/camera/CaptureGallery";
import { AutoRecordStatus, CameraStatus, CaptureItem, CapturePayload } from "./types/camera";
import {
  buildStreamUrl,
  captureAndAnalyze,
  CameraApiError,
  getAutoRecordStatus,
  getStatus as getCameraStatus,
  startAutoRecord,
  stopAutoRecord,
  startCapture,
} from "./api/cameraApi";
import { createAnalysisJob, createAnalysisJobFromFile } from "./api/shots";
import { AutoRecordPanel } from "./components/camera/AutoRecordPanel";

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
  const [captureResolution, setCaptureResolution] = useState({ width: 1280, height: 720 });
  const [captureFps, setCaptureFps] = useState(30);
  const [captureDuration, setCaptureDuration] = useState(5);
  const [captureBusyMessage, setCaptureBusyMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const captureLockRef = useRef(false);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoRecordStatus | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoPendingFilename, setAutoPendingFilename] = useState<string | null>(null);
  const autoPollTimer = useRef<number | null>(null);
  const autoRefreshTimer = useRef<number | null>(null);
  const autoStateKey =
    autoStatus && typeof autoStatus.state === "string"
      ? autoStatus.state.toLowerCase()
      : "";
  const isAutoActive = autoStateKey ? !["idle", "failed", "stopped"].includes(autoStateKey) : false;
  const autoStateLabels: Record<string, string> = {
    idle: "대기",
    address: "어드레스 감지",
    recording: "촬영중",
    finish: "피니시 감지",
    analyzing: "분석중",
    stopped: "정지",
    failed: "실패",
  };
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
    handleCheckStatus();
    window.setTimeout(handleCheckStatus, 800);
    window.setTimeout(handleCheckStatus, 2500);
  };

  const clearAutoPoll = () => {
    if (autoPollTimer.current) {
      window.clearInterval(autoPollTimer.current);
      autoPollTimer.current = null;
    }
  };

  const clearAutoRefresh = () => {
    if (autoRefreshTimer.current) {
      window.clearInterval(autoRefreshTimer.current);
      autoRefreshTimer.current = null;
    }
  };

  const fetchAutoStatus = async () => {
    if (!cameraSettings.baseUrl) {
      setAutoError("카메라 서버 주소를 입력하세요.");
      return;
    }
    try {
      const res = await getAutoRecordStatus(cameraSettings.baseUrl, cameraSettings.token || undefined);
      setAutoStatus(res);
      setAutoError(null);
      if (res.recordingFilename) {
        setAutoPendingFilename(res.recordingFilename);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "자동 촬영 상태 확인 실패";
      setAutoError(message);
    }
  };

  const startAutoPolling = () => {
    clearAutoPoll();
    fetchAutoStatus();
    autoPollTimer.current = window.setInterval(fetchAutoStatus, 1000);
  };

  const handleStartAuto = async () => {
    if (!cameraSettings.baseUrl) {
      setAutoError("카메라 서버 주소를 입력하세요.");
      return;
    }
    if (isCameraBusy || hasExternalStream) {
      setAutoError("카메라 사용 중입니다. 스트리밍/녹화를 종료 후 자동 촬영을 시작하세요.");
      return;
    }
    try {
      setAutoError(null);
      const res = await startAutoRecord(cameraSettings.baseUrl, cameraSettings.token || undefined);
      setAutoStatus(res);
      if (res.recordingFilename) {
        setAutoPendingFilename(res.recordingFilename);
      }
      startAutoPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : "자동 촬영 시작 실패";
      setAutoError(message);
    }
  };

  const handleStopAuto = async () => {
    if (!cameraSettings.baseUrl) {
      setAutoError("카메라 서버 주소를 입력하세요.");
      return;
    }
    try {
      const res = await stopAutoRecord(cameraSettings.baseUrl, cameraSettings.token || undefined);
      setAutoStatus(res);
      if (res.recordingFilename) {
        setAutoPendingFilename(res.recordingFilename);
      }
      clearAutoPoll();
      clearAutoRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "자동 촬영 중지 실패";
      setAutoError(message);
    }
  };

  const makeFilename = (ext: "jpg" | "mp4", type: string) => {
    const now = new Date();
    const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}_${pad(now.getMilliseconds(), 3)}`;
    const cleanType = type.replace(/\s+/g, "_");
    return `golf_${stamp}_${cleanType}.${ext}`;
  };

  const runCapture = async (payload: CapturePayload, analyze = false) => {
    const logPrefix = analyze ? "[capture:analyze]" : "[capture]";
    if (captureLockRef.current) {
      console.warn(`${logPrefix} skipped: capture lock in place`, {
        payload,
        isCapturing,
        isCameraBusy,
        hasExternalStream,
      });
      return;
    }
    captureLockRef.current = true;
    console.log(`${logPrefix} start`, {
      payload,
      isCameraBusy,
      isPreviewOn,
      hasExternalStream,
      baseUrl: cameraSettings.baseUrl,
    });
    if (!cameraSettings.baseUrl) {
      setCaptureBusyMessage("카메라 서버 주소를 입력하세요.");
      captureLockRef.current = false;
      return;
    }

    if (hasExternalStream) {
      setCaptureBusyMessage("스트림 중입니다. 다른 기기에서 프리뷰를 종료 후 다시 시도하세요.");
      captureLockRef.current = false;
      return;
    }

    if (isCameraBusy && !isPreviewOn) {
      setCaptureBusyMessage("카메라 사용 중(409): 스트리밍/녹화 종료 후 다시 시도하세요.");
      captureLockRef.current = false;
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
      console.log(`${logPrefix} success`, { filename: res.filename, jobId: res.jobId, status: res.status });
    } catch (err) {
      console.error(`${logPrefix} failed`, err);
      if (err instanceof CameraApiError && err.status === 409) {
        setCaptureBusyMessage("카메라 사용 중(409): 프리뷰나 다른 녹화를 종료 후 재시도하세요.");
      } else {
        const message = err instanceof Error ? err.message : "캡처 요청 실패";
        setCaptureBusyMessage(message);
      }
    } finally {
      setIsCapturing(false);
      captureLockRef.current = false;
      console.log(`${logPrefix} end`);
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

  const handleAnalyzeShot = async (shot: Shot) => {
    setAnalyzingId(shot.id);
    setAnalyzeError(null);
    try {
      let jobId: string | null = null;
      let nextStatus: any = "queued";

      try {
        const res = await createAnalysisJobFromFile(shot.filename);
        jobId = res.jobId;
        nextStatus = res.status ?? "queued";
      } catch (err) {
        // 백엔드가 from-file API를 아직 제공하지 않는 경우 fallback (재업로드 방식)
        console.warn("createAnalysisJobFromFile failed, fallback to upload", err);
        if (!shot.videoUrl) throw err;
        const videoRes = await fetch(shot.videoUrl);
        const blob = await videoRes.blob();
        const file = new File([blob], shot.filename, { type: blob.type || "video/mp4" });
        const analyzedShot = await createAnalysisJob(file, shot.sourceType ?? "upload");
        jobId = analyzedShot.jobId ?? analyzedShot.id;
        nextStatus = analyzedShot.status ?? "queued";
      }

      if (jobId) {
        select({ ...shot, jobId, status: nextStatus });
      }
      await refresh();
      setActiveTab("analysis");
    } catch (err) {
      const message = err instanceof Error ? err.message : "분석 요청 실패";
      setAnalyzeError(message);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleForceAnalyzeShot = async (shot: Shot) => {
    setAnalyzingId(shot.id);
    setAnalyzeError(null);
    try {
      const res = await createAnalysisJobFromFile(shot.filename, { force: true });
      select({ ...shot, jobId: res.jobId, status: res.status ?? "queued" });
      await refresh();
      setActiveTab("analysis");
    } catch (err) {
      const message = err instanceof Error ? err.message : "강제 분석 요청 실패";
      setAnalyzeError(message);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleRetake = () => {
    setActiveTab("camera");
    window.setTimeout(() => {
      document.getElementById("camera-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const toTime = (value?: string) => {
    if (!value) return 0;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : 0;
  };

  const isAnalyzedDone = (shot: Shot) => {
    const status = (shot.status ?? shot.analysis?.status) as string | undefined;
    return status === "succeeded" && Boolean(shot.analysis);
  };

  const sortedShots = [...shots].sort(
    (a, b) => toTime(b.modifiedAt ?? b.createdAt) - toTime(a.modifiedAt ?? a.createdAt)
  );
  const analyzedShots = sortedShots.filter((shot) => isAnalyzedDone(shot));
  const pendingShots = sortedShots.filter((shot) => !isAnalyzedDone(shot));
  const autoOverlayLabel =
    autoStatus && autoStatus.state && autoStatus.state.toLowerCase() !== "idle"
      ? autoStateLabels[autoStateKey] ?? autoStatus.state
      : null;

  useEffect(() => {
    if (activeTab !== "list") return;
    const hasInProgress = shots.some((shot) => {
      const status = (shot.status ?? shot.analysis?.status) as string | undefined;
      return status === "queued" || status === "running";
    });
    if (!hasInProgress) return;
    const interval = window.setInterval(() => {
      refresh();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTab, shots, refresh]);

  useEffect(() => {
    if (!autoPendingFilename) return;
    refresh();
    clearAutoRefresh();
    autoRefreshTimer.current = window.setInterval(() => {
      refresh();
      fetchAutoStatus();
    }, 1500);
    return () => clearAutoRefresh();
  }, [autoPendingFilename, refresh]);

  useEffect(() => {
    if (!autoPendingFilename) return;
    const match = shots.find((shot) => shot.filename === autoPendingFilename);
    const status = match?.status ?? match?.analysis?.status;
    if (match && (status === "succeeded" || match.analysis)) {
      select(match);
      setActiveTab("analysis");
      setAutoPendingFilename(null);
      clearAutoRefresh();
      clearAutoPoll();
    }
  }, [shots, autoPendingFilename, select]);

  useEffect(() => {
    if (!isAutoActive && !autoPendingFilename) {
      clearAutoPoll();
    }
  }, [isAutoActive, autoPendingFilename]);

  useEffect(() => {
    return () => {
      clearAutoPoll();
      clearAutoRefresh();
    };
  }, []);

  return (
    <Shell
      tabs={tabs}
      active={activeTab}
      onChange={setActiveTab}
      onSettingsClick={() => setActiveTab("settings")}
    >
      {activeTab === "camera" && (
        <div className="space-y-4">
          <AutoRecordPanel
            status={autoStatus}
            isRunning={Boolean(isAutoActive)}
            isLoading={isStatusLoading}
            error={autoError}
            onStart={handleStartAuto}
            onStop={handleStopAuto}
            onFallbackManual={() => document.getElementById("capture-section")?.scrollIntoView({ behavior: "smooth" })}
          />
          <div id="capture-section">
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
          </div>
          <div id="camera-preview" />
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
            statusOverlay={autoOverlayLabel}
          />
          {/* <CaptureGallery items={captures} /> */}
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
        <div className="space-y-4">
          <ShotList
            title="분석 전 파일(영상)"
            emptyMessage="분석 대기 중인 영상이 없습니다."
            shots={pendingShots}
            isLoading={isLoading}
            error={error || analyzeError}
            onRefresh={refresh}
            onSelect={toggleOpen}
            onAnalyze={(shot) => handleAnalyzeShot(shot)}
            onForceAnalyze={(shot) => handleForceAnalyzeShot(shot)}
            onRetake={handleRetake}
            onDelete={(shot) => handleDelete(shot)}
            deletingId={deletingId}
            analyzingId={analyzingId}
            openIds={openShotIds}
          />
          <ShotList
            title="분석 완료 파일"
            emptyMessage="분석 완료된 파일이 없습니다."
            shots={analyzedShots}
            isLoading={isLoading}
            error={error || analyzeError}
            onRefresh={refresh}
            onSelect={toggleOpen}
            onTitleClick={(shot) => {
              select(shot);
              setActiveTab("analysis");
            }}
            onDelete={(shot) => handleDelete(shot)}
            deletingId={deletingId}
            openIds={openShotIds}
          />
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {isAnalysisLoading && <p className="text-sm text-slate-500">분석 상태를 불러오는 중...</p>}
            {analysisError && <p className="text-sm text-red-600">{analysisError}</p>}
            {selected?.errorCode === "NOT_SWING" && (jobStatus === "failed" || selected.status === "failed") && !analysis && (
              <div className="px-4 py-3 border rounded-2xl border-amber-200 bg-amber-50">
                <p className="text-sm font-semibold text-amber-900">스윙 영상이 아닌 것 같아요</p>
                <p className="mt-1 text-xs break-words text-amber-800">
                  {selected.errorMessage || "스윙 동작이 충분히 담기지 않았을 수 있어요. 다시 촬영해 주세요."}
                </p>
                <div className="flex justify-end mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-auto px-3 py-1 text-sm"
                    fullWidth={false}
                    onClick={handleRetake}
                  >
                    다시 촬영
                  </Button>
                </div>
              </div>
            )}
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
