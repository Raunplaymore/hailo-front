import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { formatMediaTitle } from "./lib/utils";
import { Shell } from "./components/layout/Shell";
import { UploadCard } from "./components/upload/UploadCard";
import { ShotList } from "./components/shots/ShotList";
import { MetricsTable } from "./components/analysis/MetricsTable";
import { AnalysisPlayer } from "./components/analysis/AnalysisPlayer";
import { CoachSummary } from "./components/analysis/CoachSummary";
import { KeyMetrics } from "./components/analysis/KeyMetrics";
import { AnalysisProgressCard } from "./components/analysis/AnalysisProgressCard";
import { Button } from "./components/ui/button";
import { useUpload } from "./hooks/useUpload";
import { useShots } from "./hooks/useShots";
import { useAnalysis } from "./hooks/useAnalysis";
import { useToast } from "./hooks/use-toast";
import { JobStatus, Shot, SwingEventKey } from "./types/shots";
import { SettingsForm, UploadSettings } from "./components/settings/SettingsForm";
import { API_BASE } from "./api/client";
import { CameraSettings, CameraSettingsValue } from "./components/camera/CameraSettings";
import { CameraStatusPanel } from "./components/camera/CameraStatusPanel";
import { FieldConnectionPanel } from "./components/camera/FieldConnectionPanel";
import { CameraPreview } from "./components/camera/CameraPreview";
import { SessionControls } from "./components/camera/SessionControls";
import { AutoRecordState, AutoRecordStatus, CameraStatus } from "./types/camera";
import { LiveOverlayBox, SessionRecord, SessionState, SessionStatus } from "./types/session";
import {
  buildStreamUrl,
  getAutoRecordStatus,
  getAutoRecordLive,
  getStatus as getCameraStatus,
  getCalibration,
  listCalibrations,
  startAutoRecord,
  stopAutoRecord,
  stopStream,
} from "./api/cameraApi";
import {
  deleteSession,
  getSessionLive,
  getSessionStatus,
  listSessionFiles,
  resolveCameraFileUrl,
  SessionApiError,
  stopSession,
} from "./api/sessionApi";
import { createAnalysisJob, createAnalysisJobFromFile, fetchAnalysisStatus, retryNasArchive } from "./api/shots";
import { SessionList } from "./components/sessions/SessionList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { InferDebugPage } from "./components/debug/InferDebugPage";
import { LibraryApp } from "./components/library/LibraryApp";

type TabKey = "camera" | "upload" | "list" | "analysis";

const CAMERA_ENV_BASE =
  (import.meta.env.VITE_CAMERA_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_CAMERA_API_BASE as string | undefined) ||
  // NEXT_PUBLIC prefix도 허용
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_API_BASE ?? "");
const CAMERA_ENV_TOKEN =
  (import.meta.env.VITE_CAMERA_AUTH_TOKEN as string | undefined) ||
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_AUTH_TOKEN ?? "");
const DEFAULT_LENS = "lens_8mm_intrinsics.json";
const DEFAULT_PREVIEW_RESOLUTION = "640x360";
const SESSION_FPS = 60;
const SESSION_RESOLUTION = { width: 1456, height: 1088 };

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
const MAX_PREVIEW_PIXELS = 1280 * 720;
const parsePreviewResolution = (value?: string) => {
  const [width, height] = (value ?? "").split("x").map(Number);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    return { width, height };
  }
  return { width: 640, height: 360 };
};

const AUTO_RECORD_ACTIVE_STATES = new Set<SessionState>([
  "starting",
  "arming",
  "addressLocked",
  "recording",
  "finishLocked",
  "stopping",
]);

const mapAutoRecordState = (state: AutoRecordState): SessionState => {
  switch (state) {
    case "arming":
      return "arming";
    case "addressLocked":
      return "addressLocked";
    case "recording":
      return "recording";
    case "finishLocked":
      return "finishLocked";
    case "stopping":
      return "stopping";
    case "failed":
      return "failed";
    case "idle":
    default:
      return "idle";
  }
};

function App() {
  const isNasLibraryMode = import.meta.env.VITE_NAS_LIBRARY_MODE === "true";
  if (isNasLibraryMode) return <LibraryApp />;
  const isInferDebugPage =
    typeof window !== "undefined" && window.location.pathname.startsWith("/test/infer-debug");
  if (isInferDebugPage) return <InferDebugPage />;
  return <MainApp />;
}

function MainApp() {
  const {
    shots,
    selected: selectedShot,
    select: selectShot,
    isLoading: shotsLoading,
    error: shotsError,
    refresh: refreshShots,
  } = useShots();
  const upload = useUpload();
  const [activeTab, setActiveTab] = useState<TabKey>("camera");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingArchiveId, setRetryingArchiveId] = useState<string | null>(null);
  const [openShotIds, setOpenShotIds] = useState<Set<string>>(new Set());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [coachEvidenceFocus, setCoachEvidenceFocus] = useState<{ event: SwingEventKey; requestId: number } | null>(null);
  const [settings, setSettings] = useState<UploadSettings>({
    club: "driver",
    viewpoint: "down_the_line",
    handedness: "right",
    lens: DEFAULT_LENS,
  });
  const [lensOptions, setLensOptions] = useState<string[]>([]);
  const [lensError, setLensError] = useState<string | null>(null);
  const [cameraSettings, setCameraSettings] = useState<CameraSettingsValue>(() => {
    const stored = loadLocalJson<CameraSettingsValue>("cameraSettings");
    return {
      baseUrl:
        stored?.baseUrl ||
        CAMERA_ENV_BASE ||
        (typeof window !== "undefined" ? window.location.origin : ""),
      token: stored?.token || CAMERA_ENV_TOKEN || "",
      sessionPrefix: stored?.sessionPrefix || "",
      autoStopPreviewOnCapture: stored?.autoStopPreviewOnCapture ?? true,
      previewResolution: stored?.previewResolution ?? DEFAULT_PREVIEW_RESOLUTION,
    };
  });
  const [baseHistory, setBaseHistory] = useState<string[]>(
    () => loadLocalJson<string[]>("cameraBaseHistory") || []
  );
  const [sessionStatusMap, setSessionStatusMap] = useState<
    Record<
      string,
      {
        status: SessionStatus;
        analysisJobId?: string;
        jobId?: string;
        errorMessage?: string;
        metaPath?: string;
        videoUrl?: string;
        updatedAt?: string;
      }
    >
  >(() => loadLocalJson("sessionStatusMap") || {});
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [lastStatusCheckedAt, setLastStatusCheckedAt] = useState<string | null>(null);
  const [previewParams, setPreviewParams] = useState(() => {
    const stored = loadLocalJson<CameraSettingsValue>("cameraSettings");
    const { width, height } = parsePreviewResolution(
      stored?.previewResolution ?? DEFAULT_PREVIEW_RESOLUTION
    );
    return { width, height, fps: 15 };
  });
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPreviewOn, setIsPreviewOn] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState<number>(0);
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionJobId, setSessionJobId] = useState<string | null>(null);
  const [sessionFilename, setSessionFilename] = useState<string | null>(null);
  const [sessionVideoUrl, setSessionVideoUrl] = useState<string | null>(null);
  const [sessionMetaPath, setSessionMetaPath] = useState<string | null>(null);
  const [sessionRuntimeStatus, setSessionRuntimeStatus] = useState<string | null>(null);
  const [sessionRuntimeError, setSessionRuntimeError] = useState<string | null>(null);
  const [sessionLiveSize, setSessionLiveSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAnalysisJobId, setSessionAnalysisJobId] = useState<string | null>(null);
  const [sessionAnalysisStatus, setSessionAnalysisStatus] = useState<JobStatus | null>(null);
  const [sessionAnalysisError, setSessionAnalysisError] = useState<string | null>(null);
  const [autoRecordStatus, setAutoRecordStatus] = useState<AutoRecordStatus | null>(null);
  const lastAutoFilenameRef = useRef<string | null>(null);
  const [liveBoxes, setLiveBoxes] = useState<LiveOverlayBox[]>([]);
  const livePollTimer = useRef<number | null>(null);
  const livePollId = useRef(0);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [listMode, setListMode] = useState<"sessions" | "uploads">("uploads");
  const [showCameraSettingsLayer, setShowCameraSettingsLayer] = useState(false);
  useEffect(() => {
    if (!showCameraSettingsLayer && !showVideoModal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]')).filter(el => {
      if (!el.getClientRects().length) return false;
      // Closed details can retain layout boxes while their controls cannot receive focus.
      for (let parent = el.parentElement; parent && parent !== dialog; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open && parent.querySelector("summary") !== el) return false;
      }
      return true;
    });
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setShowCameraSettingsLayer(false); setShowVideoModal(false); }
      if (event.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [showCameraSettingsLayer, showVideoModal]);
  const { toast } = useToast();
  const streamClients = cameraStatus?.streamClients ?? 0;
  const isStreaming = cameraStatus?.streaming === true;

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "camera", label: "촬영" },
      { key: "upload", label: "업로드" },
      { key: "list", label: "기록" },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("sessionStatusMap", JSON.stringify(sessionStatusMap));
  }, [sessionStatusMap]);

  const applyLensCalibration = async (lensName: string) => {
    if (!cameraSettings.baseUrl) return;
    try {
      const calibration = await getCalibration(
        cameraSettings.baseUrl,
        lensName,
        cameraSettings.token || undefined
      );
      const hFov = Number(calibration?.data?.h_fov_deg);
      const vFov = Number(calibration?.data?.v_fov_deg);
      setSettings((prev) => ({
        ...prev,
        lens: lensName,
        h_fov: Number.isFinite(hFov) ? Number(hFov.toFixed(2)) : prev.h_fov,
        v_fov: Number.isFinite(vFov) ? Number(vFov.toFixed(2)) : prev.v_fov,
      }));
      setLensError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "캘리브레이션 정보를 불러오지 못했습니다.";
      setLensError(message);
    }
  };

  useEffect(() => {
    if (!cameraSettings.baseUrl) {
      setLensOptions([]);
      setLensError("카메라 서버 주소를 먼저 입력하세요.");
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const list = await listCalibrations(
          cameraSettings.baseUrl,
          cameraSettings.token || undefined
        );
        if (cancelled) return;
        const names = list.map((item) => item.name);
        setLensOptions(names);
        setLensError(null);
        const currentLens = settings.lens;
        const nextLens = currentLens || (names.includes(DEFAULT_LENS) ? DEFAULT_LENS : names[0]);
        const needsFov =
          nextLens &&
          (settings.h_fov === undefined || settings.h_fov === null ||
            settings.v_fov === undefined || settings.v_fov === null);
        if (nextLens && (nextLens !== currentLens || needsFov)) {
          await applyLensCalibration(nextLens);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "캘리브레이션 목록을 불러오지 못했습니다.";
        setLensOptions([]);
        setLensError(message);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [cameraSettings.baseUrl, cameraSettings.token]);

  const handleDelete = async (shot: Shot) => {
    if (!window.confirm(`${formatMediaTitle(shot.filename, shot.originalName)} 영상을 삭제할까요?`)) return;
    setDeletingId(shot.id);
    try {
      const response = await fetch(`${API_BASE}/api/files/${encodeURIComponent(shot.filename)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("영상을 삭제하지 못했습니다. 다시 시도해 주세요.");
      await refreshShots();
      if (selectedShot?.id === shot.id) {
        selectShot(null);
        setActiveTab("list");
        setOpenShotIds(new Set());
      }
    } catch (err) {
      toast({ title: "삭제 실패", description: err instanceof Error ? err.message : "삭제하지 못했습니다.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetryArchive = async (shot: Shot) => {
    if (!shot.jobId) return;
    setRetryingArchiveId(shot.id);
    try {
      await retryNasArchive(shot.jobId);
      await refreshShots({ silent: true });
      toast({ title: "NAS 보관을 다시 시도합니다.", description: "분석은 다시 실행하지 않습니다." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "NAS 보관 재시도 요청에 실패했습니다.";
      toast({ title: "NAS 재시도 실패", description: message, variant: "destructive" });
    } finally {
      setRetryingArchiveId(null);
    }
  };

  const handleDeleteSession = async (session: SessionRecord) => {
    if (!cameraSettings.baseUrl) {
      setSessionsError("카메라 서버 주소를 입력하세요.");
      return;
    }
    const confirmed = window.confirm(`${formatMediaTitle(session.filename)} 촬영 기록을 삭제할까요?`);
    if (!confirmed) return;
    setDeletingSessionId(session.id);
    setSessionsError(null);
    try {
      await deleteSession(
        cameraSettings.baseUrl,
        session.jobId,
        session.filename,
        cameraSettings.token || undefined
      );
      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
      }
      await refreshSessions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "세션을 삭제하지 못했습니다.";
      setSessionsError(message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const sessionToShot = (session: SessionRecord): Shot => {
    const analysisJobId =
      session.analysisJobId ??
      (["analyzing", "done", "failed"].includes(session.status) ? session.jobId : undefined);
    const status: JobStatus =
      session.status === "done"
        ? "succeeded"
        : session.status === "analyzing"
        ? "running"
        : session.status === "failed"
        ? "failed"
        : "not-analyzed";
    return {
      id: session.id,
      filename: session.filename,
      createdAt: session.createdAt,
      sourceType: "camera",
      videoUrl: session.videoUrl,
      metaPath: session.metaPath ?? null,
      jobId: analysisJobId,
      status,
    };
  };

  const analysisTarget = selectedSession ? sessionToShot(selectedSession) : selectedShot;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [activeTab, analysisTarget?.id]);

  const selectedVideoUrl =
    analysisTarget?.videoUrl && analysisTarget.videoUrl !== ""
      ? analysisTarget.videoUrl
      : analysisTarget
      ? `${API_BASE}/uploads/${encodeURIComponent(analysisTarget.filename)}`
      : "";

  const {
    analysis,
    status: jobStatus,
    isLoading: isAnalysisLoading,
    error: analysisError,
  } = useAnalysis(analysisTarget);

  const openImpactReview = (shot: Shot) => {
    selectShot(shot);
    setSelectedSession(null);
    setActiveTab("analysis");
  };

  const toggleOpen = (shot: Shot) => {
    const next = new Set(openShotIds);
    if (next.has(shot.id)) {
      next.delete(shot.id);
    } else {
      next.add(shot.id);
    }
    setOpenShotIds(next);
    selectShot(shot);
    setSelectedSession(null);
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
    const { width, height } = parsePreviewResolution(
      cameraSettings.previewResolution ?? DEFAULT_PREVIEW_RESOLUTION
    );
    setPreviewParams((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { ...prev, width, height, fps: 15 };
    });
  }, [cameraSettings.previewResolution]);

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
    if (activeTab !== "camera") return;
    handleCheckStatus();
    const interval = window.setInterval(() => {
      handleCheckStatus();
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, cameraSettings.baseUrl, cameraSettings.token]);

  const handleStartPreview = () => {
    if (previewParams.width * previewParams.height > MAX_PREVIEW_PIXELS) {
      toast({
        variant: "destructive",
        title: "프리뷰 시작 실패",
        description: "해상도가 너무 높습니다. 설정에서 낮춰주세요.",
      });
      return;
    }
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
      toast({
        title: "프리뷰 시작",
        description: `${previewParams.width} x ${previewParams.height} · 15fps`,
      });
    } catch (err) {
      setIsPreviewOn(false);
      const message = err instanceof Error ? err.message : "프리뷰를 시작할 수 없습니다.";
      toast({
        variant: "destructive",
        title: "프리뷰 시작 실패",
        description: message,
      });
    }
  };

  const handleStreamError = () => {
    setIsPreviewOn(false);
    setStreamUrl(null);
    handleCheckStatus();
    toast({
      variant: "destructive",
      title: "프리뷰 연결 끊김",
      description: "스트림이 종료되었습니다. 다시 켜주세요.",
    });
  };

  const handleStopPreview = async (silent = false) => {
    if (cameraSettings.baseUrl) {
      try {
        await stopStream(cameraSettings.baseUrl, cameraSettings.token || undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : "프리뷰 스트림 종료 실패";
        console.warn(message);
      }
    }
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
    if (!silent) {
      toast({ title: "프리뷰 종료", description: "스트림을 닫았습니다." });
    }
  };

  const resolveSessionStatus = (status?: string): SessionStatus => {
    switch (status) {
      case "queued":
      case "running":
      case "analyzing":
        return status === "running" ? "recording" : "analyzing";
      case "stopped":
        return "recorded";
      case "succeeded":
      case "done":
        return "done";
      case "failed":
        return "failed";
      default:
        return "recorded";
    }
  };

  const isVideoFile = (filename: string) => {
    const lower = filename.toLowerCase();
    return lower.endsWith(".mp4") || lower.endsWith(".mov");
  };

  const updateSessionMap = (
    filename: string,
    patch: Partial<{
      status: SessionStatus;
      analysisJobId?: string;
      jobId?: string;
      errorMessage?: string;
      metaPath?: string;
      videoUrl?: string;
    }>
  ) => {
    setSessionStatusMap((prev) => ({
      ...prev,
      [filename]: {
        ...prev[filename],
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const refreshSessions = async () => {
    if (!cameraSettings.baseUrl) {
      setSessions([]);
      setSessionsError("카메라 서버 주소를 입력하세요.");
      return;
    }
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const files = await listSessionFiles(
        cameraSettings.baseUrl,
        cameraSettings.token || undefined,
        { limit: 50, offset: 0 }
      );
      const nextSessions = files
        .filter((file) => isVideoFile(file.filename))
        .map((file) => {
          const local = sessionStatusMap[file.filename];
          const status = local?.status ?? resolveSessionStatus(file.status);
          const analysisJobId =
            local?.analysisJobId ??
            ((status === "analyzing" || status === "done" || status === "failed")
              ? file.jobId
              : undefined);
          const videoUrl =
            local?.videoUrl ??
            resolveCameraFileUrl(cameraSettings.baseUrl, file.url, file.filename);
          return {
            id: file.jobId ?? file.filename,
            filename: file.filename,
            createdAt:
              file.stoppedAt ??
              file.startedAt ??
              file.modifiedAt ??
              file.createdAt ??
              new Date().toISOString(),
            status,
            videoUrl,
            jobId: local?.jobId ?? file.jobId,
            analysisJobId,
            metaPath: local?.metaPath ?? file.metaPath,
            errorMessage: local?.errorMessage ?? file.errorMessage,
          } as SessionRecord;
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setSessions(nextSessions);
      rememberBase(cameraSettings.baseUrl);
    } catch (err) {
      if (err instanceof SessionApiError && err.status === 404) {
        setSessionsError("세션 목록 API가 아직 준비되지 않았습니다.");
      } else {
        const message = err instanceof Error ? err.message : "세션 목록을 불러오지 못했습니다.";
        setSessionsError(message);
      }
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "camera" && activeTab !== "list") return;
    refreshSessions();
  }, [activeTab, cameraSettings.baseUrl, cameraSettings.token, sessionStatusMap]);

  useEffect(() => {
    if (!selectedSession) return;
    const match = sessions.find((session) => session.filename === selectedSession.filename);
    if (!match) return;
    if (
      match.status !== selectedSession.status ||
      match.analysisJobId !== selectedSession.analysisJobId ||
      match.videoUrl !== selectedSession.videoUrl ||
      match.errorMessage !== selectedSession.errorMessage
    ) {
      setSelectedSession(match);
    }
  }, [sessions, selectedSession]);

  const normalizeLiveBoxes = (
    payload: any,
    fallbackSize?: { width: number; height: number }
  ): LiveOverlayBox[] => {
    if (!payload || typeof payload !== "object") return [];
    const frames = Array.isArray(payload.frames) ? payload.frames : [];
    const frame = frames.length ? frames[frames.length - 1] : payload;
    const rawBoxes =
      frame?.detections ??
      frame?.boxes ??
      frame?.objects ??
      payload.detections ??
      payload.boxes ??
      [];
    const frameWidth =
      frame?.width ?? frame?.frameWidth ?? payload.width ?? payload.frameWidth ?? fallbackSize?.width;
    const frameHeight =
      frame?.height ?? frame?.frameHeight ?? payload.height ?? payload.frameHeight ?? fallbackSize?.height;

    if (!Array.isArray(rawBoxes)) return [];

    return rawBoxes
      .map((entry) => {
        const box =
          entry?.bbox ?? entry?.box ?? entry?.rect ?? entry?.bbox_xywh ?? entry;
        let xmin: number | undefined;
        let ymin: number | undefined;
        let width: number | undefined;
        let height: number | undefined;

        if (Array.isArray(box) && box.length >= 4) {
          [xmin, ymin, width, height] = box.map(Number);
        } else if (box && typeof box === "object") {
          const x1 =
            box.xmin ?? box.x1 ?? box.left ?? box.x ?? entry?.xmin ?? entry?.x1 ?? entry?.left;
          const y1 =
            box.ymin ?? box.y1 ?? box.top ?? box.y ?? entry?.ymin ?? entry?.y1 ?? entry?.top;
          const x2 = box.xmax ?? box.x2 ?? box.right ?? entry?.xmax ?? entry?.x2 ?? entry?.right;
          const y2 = box.ymax ?? box.y2 ?? box.bottom ?? entry?.ymax ?? entry?.y2 ?? entry?.bottom;
          if (x1 != null && y1 != null && x2 != null && y2 != null) {
            xmin = Number(x1);
            ymin = Number(y1);
            width = Number(x2) - Number(x1);
            height = Number(y2) - Number(y1);
          } else {
            xmin = Number(x1 ?? 0);
            ymin = Number(y1 ?? 0);
            width = Number(box.w ?? box.width ?? entry?.w ?? entry?.width);
            height = Number(box.h ?? box.height ?? entry?.h ?? entry?.height);
          }
        }

        if (
          xmin == null ||
          ymin == null ||
          width == null ||
          height == null ||
          Number.isNaN(xmin) ||
          Number.isNaN(ymin) ||
          Number.isNaN(width) ||
          Number.isNaN(height)
        ) {
          return null;
        }

        let nx = xmin;
        let ny = ymin;
        let nw = width;
        let nh = height;
        if (
          frameWidth &&
          frameHeight &&
          (nx > 1 || ny > 1 || nw > 1 || nh > 1)
        ) {
          nx = nx / frameWidth;
          ny = ny / frameHeight;
          nw = nw / frameWidth;
          nh = nh / frameHeight;
        }

        const label = entry?.label ?? entry?.class ?? entry?.className ?? entry?.category;
        const score =
          typeof entry?.score === "number"
            ? entry.score
            : typeof entry?.confidence === "number"
            ? entry.confidence
            : typeof entry?.conf === "number"
            ? entry.conf
            : typeof entry?.prob === "number"
            ? entry.prob
            : undefined;

        return {
          xmin: nx,
          ymin: ny,
          width: nw,
          height: nh,
          label: typeof label === "string" ? label : undefined,
          score,
        } as LiveOverlayBox;
      })
      .filter((item): item is LiveOverlayBox => Boolean(item));
  };

  const handleSessionStart = async () => {
    if (!cameraSettings.baseUrl) {
      setSessionError("카메라 서버 주소를 입력하세요.");
      return;
    }
    if (previewParams.width * previewParams.height > MAX_PREVIEW_PIXELS) {
      setSessionError("해상도가 너무 높습니다. 네트워크 상태를 고려해 낮춰주세요.");
      return;
    }
    if (isPreviewOn && cameraSettings.autoStopPreviewOnCapture) {
      await handleStopPreview(true);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
    setSessionError(null);
    setSessionState("starting");
    setSessionJobId(null);
    setSessionFilename(null);
    setSessionVideoUrl(null);
    setSessionMetaPath(null);
    setSessionAnalysisJobId(null);
    setSessionAnalysisStatus(null);
    setSessionAnalysisError(null);
    setSessionRuntimeStatus(null);
    setSessionRuntimeError(null);
    setSessionLiveSize({ width: SESSION_RESOLUTION.width, height: SESSION_RESOLUTION.height });
    setLiveBoxes([]);
    setAutoRecordStatus(null);
    lastAutoFilenameRef.current = null;
    try {
      const res = await startAutoRecord(
        cameraSettings.baseUrl,
        cameraSettings.token || undefined,
        {
          club: settings.club,
          viewpoint: settings.viewpoint,
          handedness: settings.handedness,
        }
      );
      const status = res.status;
      setAutoRecordStatus(status);
      setSessionRuntimeStatus(status.state);
      setSessionRuntimeError(status.lastError ?? null);
      setSessionState(mapAutoRecordState(status.state));
      if (!isPreviewOn) {
        handleStartPreview();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "세션 시작 실패";
      setSessionError(message);
      setSessionState("failed");
      await handleStopPreview(true);
    }
  };

  const handleSessionStop = async () => {
    if (!cameraSettings.baseUrl) {
      setSessionError("카메라 서버 주소를 입력하세요.");
      return;
    }
    const isAutoRecord = AUTO_RECORD_ACTIVE_STATES.has(sessionState);
    if (isAutoRecord) {
      setSessionError(null);
      setSessionState("stopping");
      try {
        const res = await stopAutoRecord(
          cameraSettings.baseUrl,
          cameraSettings.token || undefined
        );
        await processAutoRecordStatus(res.status);
      } catch (err) {
        const message = err instanceof Error ? err.message : "세션 종료 실패";
        setSessionError(message);
        setSessionState("failed");
        await handleStopPreview(true);
      }
      return;
    }

    if (!sessionJobId) {
      setSessionError("세션 ID가 없습니다. 다시 시작해주세요.");
      return;
    }
    setSessionError(null);
    setSessionState("stopping");
    try {
      const res = await stopSession(
        cameraSettings.baseUrl,
        sessionJobId,
        cameraSettings.token || undefined
      );
      const resolvedJobId = res.jobId ?? sessionJobId;
      const filename = res.filename || sessionFilename || `${resolvedJobId}.mp4`;
      const videoUrl = resolveCameraFileUrl(
        cameraSettings.baseUrl,
        res.videoUrl || res.url,
        filename
      );
      setSessionFilename(filename);
      setSessionVideoUrl(videoUrl);
      setSessionMetaPath(res.metaPath ?? null);
      updateSessionMap(filename, {
        status: "recorded",
        jobId: resolvedJobId,
        metaPath: res.metaPath ?? undefined,
        videoUrl,
      });

      const analysis = await createAnalysisJobFromFile(filename, {
        jobId: resolvedJobId,
        metaPath: res.metaPath,
      });
      setSessionAnalysisJobId(analysis.jobId);
      setSessionAnalysisStatus(analysis.status ?? "queued");
      setSessionState("analyzing");
      updateSessionMap(filename, {
        status: "analyzing",
        analysisJobId: analysis.jobId,
      });
      setSelectedSession({
        id: res.jobId ?? sessionJobId,
        filename,
        createdAt: new Date().toISOString(),
        status: "analyzing",
        videoUrl,
        jobId: res.jobId ?? sessionJobId,
        analysisJobId: analysis.jobId,
        metaPath: res.metaPath ?? undefined,
      });
      await handleStopPreview(true);
      refreshSessions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "세션 종료 실패";
      setSessionError(message);
      setSessionState("failed");
      await handleStopPreview(true);
      if (sessionFilename) {
        updateSessionMap(sessionFilename, { status: "failed", errorMessage: message });
      }
    }
  };

  const handleSessionReset = () => {
    setSessionState("idle");
    setSessionJobId(null);
    setSessionFilename(null);
    setSessionVideoUrl(null);
    setSessionMetaPath(null);
    setSessionRuntimeStatus(null);
    setSessionRuntimeError(null);
    setSessionError(null);
    setSessionAnalysisJobId(null);
    setSessionAnalysisStatus(null);
    setSessionAnalysisError(null);
    setSessionLiveSize(null);
    setLiveBoxes([]);
    setAutoRecordStatus(null);
    lastAutoFilenameRef.current = null;
  };

  const processAutoRecordStatus = async (status: AutoRecordStatus) => {
    setAutoRecordStatus(status);
    setSessionRuntimeStatus(status.state);
    setSessionRuntimeError(status.lastError ?? null);

    if (status.state === "failed") {
      setSessionError(status.lastError || "자동 녹화에 실패했습니다.");
      setSessionState("failed");
      setLiveBoxes([]);
      await handleStopPreview(true);
      return;
    }

    if (status.state === "idle") {
      const filename = status.lastRecordingFilename || status.recordingFilename;
      if (filename && lastAutoFilenameRef.current !== filename) {
        if (status.finalizing) {
          setSessionState("stopping");
          return;
        }
        if (status.videoReady !== true) {
          const message = status.lastError || "녹화 영상이 생성되지 않았거나 비어 있습니다.";
          setSessionError(message);
          setSessionState("failed");
          updateSessionMap(filename, { status: "failed", errorMessage: message });
          await handleStopPreview(true);
          return;
        }
        if (!status.lastRecordingMetaPath || !status.analysisRequested) {
          const message = "녹화 후처리 또는 분석 요청이 완료되지 않았습니다.";
          setSessionError(message);
          setSessionState("failed");
          updateSessionMap(filename, { status: "failed", errorMessage: message });
          await handleStopPreview(true);
          return;
        }
        lastAutoFilenameRef.current = filename;
        const metaPath = status.lastRecordingMetaPath ?? null;
        const analysisJobId = status.jobId || filename.replace(/\.[^.]+$/, "");
        const videoUrl = resolveCameraFileUrl(
          cameraSettings.baseUrl,
          `/uploads/${encodeURIComponent(filename)}`,
          filename
        );
        setSessionFilename(filename);
        setSessionVideoUrl(videoUrl);
        setSessionMetaPath(metaPath);
        updateSessionMap(filename, {
          status: "recorded",
          videoUrl,
          metaPath: metaPath ?? undefined,
        });
        setSessionAnalysisJobId(analysisJobId);
        setSessionAnalysisStatus("queued");
        setSessionState("analyzing");
        updateSessionMap(filename, {
          status: "analyzing",
          analysisJobId,
        });
        setSelectedSession({
          id: analysisJobId,
          filename,
          createdAt: new Date().toISOString(),
          status: "analyzing",
          videoUrl,
          jobId: analysisJobId,
          analysisJobId,
          metaPath: metaPath ?? undefined,
        });
        await handleStopPreview(true);
        refreshSessions();
        } else {
          setSessionState("idle");
          setLiveBoxes([]);
        }
        return;
      }

    const mapped = mapAutoRecordState(status.state);
    setSessionState(mapped);
    if (status.state === "recording" && !isPreviewOn) {
      handleStartPreview();
    }
  };

  useEffect(() => {
    if (!cameraSettings.baseUrl) return;
    if (!AUTO_RECORD_ACTIVE_STATES.has(sessionState)) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await getAutoRecordStatus(
          cameraSettings.baseUrl,
          cameraSettings.token || undefined
        );
        if (cancelled) return;
        await processAutoRecordStatus(res.status);
      } catch (err) {
        if (cancelled) return;
        setSessionRuntimeError("자동 녹화 상태를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 500);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionState, cameraSettings.baseUrl, cameraSettings.token, isPreviewOn]);

  useEffect(() => {
    if (!cameraSettings.baseUrl) return;
    if (!AUTO_RECORD_ACTIVE_STATES.has(sessionState)) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await getAutoRecordLive(
          cameraSettings.baseUrl,
          cameraSettings.token || undefined,
          30
        );
        if (cancelled) return;
        setLiveBoxes(
          normalizeLiveBoxes(res, {
            width: SESSION_RESOLUTION.width,
            height: SESSION_RESOLUTION.height,
          })
        );
      } catch (err) {
        if (cancelled) return;
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 300);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionState, cameraSettings.baseUrl, cameraSettings.token]);

  useEffect(() => {
    if (AUTO_RECORD_ACTIVE_STATES.has(sessionState)) return;
    if (sessionState !== "recording" || !sessionJobId || !cameraSettings.baseUrl) {
      setLiveBoxes([]);
      return;
    }
    let cancelled = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      const requestId = ++livePollId.current;
      if (controller) controller.abort();
      controller = new AbortController();
      try {
        const res = await getSessionLive(
          cameraSettings.baseUrl,
          sessionJobId,
          30,
          cameraSettings.token || undefined,
          controller.signal
        );
        if (cancelled || requestId !== livePollId.current) return;
        setLiveBoxes(normalizeLiveBoxes(res, sessionLiveSize ?? previewParams));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    };

    poll();
    livePollTimer.current = window.setInterval(poll, 300);

    return () => {
      cancelled = true;
      if (controller) controller.abort();
      if (livePollTimer.current) {
        window.clearInterval(livePollTimer.current);
        livePollTimer.current = null;
      }
    };
  }, [sessionState, sessionJobId, cameraSettings.baseUrl, cameraSettings.token]);

  useEffect(() => {
    if (AUTO_RECORD_ACTIVE_STATES.has(sessionState)) return;
    if (!sessionJobId || !cameraSettings.baseUrl) {
      setSessionRuntimeStatus(null);
      return;
    }
    if (sessionState !== "recording" && sessionState !== "stopping") return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await getSessionStatus(
          cameraSettings.baseUrl,
          sessionJobId,
          cameraSettings.token || undefined
        );
        if (cancelled) return;
        const status = typeof res.status === "string" ? res.status : null;
        setSessionRuntimeStatus(status);
        if (res.errorMessage) {
          setSessionRuntimeError(res.errorMessage);
        }
        if (status === "failed") {
          setSessionRuntimeError(res.errorMessage || "세션이 실패했습니다.");
          setSessionState("failed");
          await handleStopPreview(true);
          return;
        }
        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setSessionRuntimeError("세션 상태를 불러오지 못했습니다.");
        timer = window.setTimeout(poll, 2500);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionJobId, sessionState, cameraSettings.baseUrl, cameraSettings.token]);

  useEffect(() => {
    if (sessionState !== "analyzing" || !sessionAnalysisJobId) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const res = await fetchAnalysisStatus(sessionAnalysisJobId);
        if (cancelled) return;
        setSessionAnalysisStatus(res.status);
        if (res.status === "succeeded") {
          setSessionState("done");
          if (sessionFilename) {
            updateSessionMap(sessionFilename, { status: "done" });
            setSelectedSession((prev) =>
              prev && prev.filename === sessionFilename ? { ...prev, status: "done" } : prev
            );
          }
          return;
        }
        if (res.status === "failed") {
          const message = res.errorMessage ?? "분석이 실패했습니다.";
          setSessionAnalysisError(message);
          setSessionState("failed");
          await handleStopPreview(true);
          if (sessionFilename) {
            updateSessionMap(sessionFilename, { status: "failed", errorMessage: message });
            setSelectedSession((prev) =>
              prev && prev.filename === sessionFilename
                ? { ...prev, status: "failed", errorMessage: message }
                : prev
            );
          }
          return;
        }
        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (cancelled) return;
        setSessionAnalysisError("분석 상태를 불러오지 못했습니다.");
        timer = window.setTimeout(poll, 2000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [sessionState, sessionAnalysisJobId, sessionFilename]);

  const handleAnalyzeShot = async (shot: Shot) => {
    setAnalyzingId(shot.id);
    setAnalyzeError(null);
    try {
      let jobId: string | null = null;
      let nextStatus: any = "queued";

      try {
        const res = await createAnalysisJobFromFile(shot.filename, {
          metaPath: shot.metaPath,
          club: settings.club,
          viewpoint: settings.viewpoint,
          handedness: settings.handedness,
        });
        jobId = res.jobId;
        nextStatus = res.status ?? "queued";
      } catch (err) {
        // 백엔드가 from-file API를 아직 제공하지 않는 경우 fallback (재업로드 방식)
        console.warn("createAnalysisJobFromFile failed, fallback to upload", err);
        if (!shot.videoUrl) throw err;
        const videoRes = await fetch(shot.videoUrl);
        const blob = await videoRes.blob();
        const file = new File([blob], shot.filename, { type: blob.type || "video/mp4" });
        const analyzedShot = await createAnalysisJob(file, shot.sourceType ?? "upload", settings);
        jobId = analyzedShot.jobId ?? analyzedShot.id;
        nextStatus = analyzedShot.status ?? "queued";
      }

      if (jobId) {
        selectShot({ ...shot, jobId, status: nextStatus });
        setSelectedSession(null);
      }
      setActiveTab("analysis");
      void refreshShots({ silent: true });
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
      const res = await createAnalysisJobFromFile(shot.filename, {
        force: true,
        metaPath: shot.metaPath,
        club: settings.club,
        viewpoint: settings.viewpoint,
        handedness: settings.handedness,
      });
      selectShot({ ...shot, jobId: res.jobId, status: res.status ?? "queued" });
      setSelectedSession(null);
      setActiveTab("analysis");
      void refreshShots({ silent: true });
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

  const sortedShots = [...shots].sort(
    (a, b) => toTime(b.modifiedAt ?? b.createdAt) - toTime(a.modifiedAt ?? a.createdAt)
  );
  const sessionOverlayLabel =
    sessionState === "arming"
      ? "어드레스 감지 중"
      : sessionState === "addressLocked"
      ? "어드레스 확인"
      : sessionState === "recording"
      ? "AI 세션 촬영중"
      : sessionState === "finishLocked"
      ? "스윙 종료 감지"
      : sessionState === "stopping"
      ? "세션 종료 중"
      : sessionState === "analyzing"
      ? "분석 중"
      : null;
  const previewOverlayLabel = sessionOverlayLabel;
  const isOverlayActive =
    sessionState === "arming" ||
    sessionState === "addressLocked" ||
    sessionState === "recording" ||
    sessionState === "finishLocked";

  useEffect(() => {
    if (activeTab !== "list") return;
    const hasInProgress = shots.some((shot) => {
      const status = (shot.analysis?.status ?? shot.status) as string | undefined;
      return status === "queued" || status === "running" || ["pending", "uploading", "retrying"].includes(shot.nasArchive?.state ?? "");
    });
    if (!hasInProgress) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refreshShots({ silent: true, activeOnly: true });
    }, 3000);
    return () => window.clearInterval(interval);
  }, [activeTab, shots, refreshShots]);

  return (
    <Shell
      tabs={tabs}
      active={activeTab}
      onChange={setActiveTab}
      onSettingsClick={() => setShowCameraSettingsLayer(true)}
    >
      {activeTab === "camera" && (
        <section className="min-w-0 space-y-4" aria-label="카메라 촬영 화면">
          <div><h1 className="text-2xl font-semibold">스윙 촬영</h1><p className="mt-2 text-sm text-muted-foreground">전신과 클럽을 화면에 맞추고 촬영을 시작하세요.</p></div>
          {statusError && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted px-4 py-2"><p className="text-sm">카메라에 연결하지 못했습니다.</p><Button size="sm" variant="outline" fullWidth={false} onClick={() => setShowCameraSettingsLayer(true)}>연결 설정</Button></div>}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div id="camera-preview" className="min-w-0">
              <CameraPreview
                embedded
                isActive={isPreviewOn}
                streamUrl={streamUrl}
                key={previewSessionId}
                width={previewParams.width}
                height={previewParams.height}
                onStart={handleStartPreview}
                onStop={handleStopPreview}
                onStreamError={handleStreamError}
                statusOverlay={previewOverlayLabel}
                overlayBoxes={liveBoxes}
                overlayEnabled={isOverlayActive}
              />
            </div>

            <aside className="min-w-0 space-y-4">
              <SessionControls
                embedded
                state={sessionState}
                jobId={sessionJobId}
                filename={sessionFilename}
                analysisStatus={sessionAnalysisStatus ?? undefined}
                sessionStatus={sessionRuntimeStatus}
                error={sessionError || sessionRuntimeError}
                analysisError={sessionAnalysisError}
                club={settings.club}
                onStart={handleSessionStart}
                onStop={handleSessionStop}
                onReset={handleSessionReset}
                onViewResult={selectedSession ? () => setActiveTab("analysis") : undefined}
                onClubChange={(club) => setSettings((prev) => ({ ...prev, club }))}
              />

              <details className="rounded-xl border border-border px-4"><summary className="text-sm font-semibold">카메라 연결 상태</summary>
              <FieldConnectionPanel
                baseUrl={cameraSettings.baseUrl}
                status={cameraStatus}
                statusError={statusError}
                isLoading={isStatusLoading}
                lastCheckedAt={lastStatusCheckedAt}
                isPreviewOn={isPreviewOn}
                isStreaming={isStreaming}
                streamClients={streamClients}
                previewPreset={previewParams}
                sessionState={sessionState}
                onRefresh={handleCheckStatus}
                onOpenSettings={() => setShowCameraSettingsLayer(true)}
                onStartPreview={handleStartPreview}
                onStopPreview={() => handleStopPreview()}
              />
              </details>
            </aside>
          </div>
        </section>
      )}

      {activeTab === "upload" && (
        <UploadCard
          status={upload.status}
          message={upload.message}
          activeFilename={upload.activeFilename}
          settings={settings}
          onUpload={async (file) => {
            const shot = await upload.start(file, "upload", settings);
            if (shot) {
              selectShot(shot);
              setSelectedSession(null);
              setActiveTab("analysis");
              void refreshShots({ silent: true });
            }
          }}
        />
      )}

      {activeTab === "list" && (
        <section aria-labelledby="record-title" className="space-y-4">
          <div><h1 id="record-title" className="text-2xl font-semibold">스윙 기록</h1><p className="mt-2 text-sm text-muted-foreground">영상을 열고 임팩트와 자세를 확인하세요.</p></div>
          <Tabs value={listMode} onValueChange={(value) => setListMode(value as "sessions" | "uploads")}>
            <TabsList className="mb-4"><TabsTrigger value="uploads">업로드 영상</TabsTrigger><TabsTrigger value="sessions">카메라 촬영</TabsTrigger></TabsList>
            <TabsContent value="uploads">
              <ShotList title="내 영상" emptyMessage="아직 업로드한 영상이 없습니다. 하단 업로드에서 첫 스윙을 추가하세요."
                shots={sortedShots} isLoading={shotsLoading} error={shotsError || analyzeError} onRefresh={refreshShots}
                onSelect={toggleOpen} onReview={openImpactReview} onTitleClick={openImpactReview}
                onAnalyze={handleAnalyzeShot} onForceAnalyze={handleForceAnalyzeShot} onRetake={handleRetake}
                onDelete={handleDelete} onRetryArchive={handleRetryArchive} deletingId={deletingId}
                retryingArchiveId={retryingArchiveId} analyzingId={analyzingId} openIds={openShotIds} />
            </TabsContent>
            <TabsContent value="sessions"><SessionList sessions={sessions} isLoading={isSessionsLoading} error={sessionsError}
              onRefresh={refreshSessions} onSelect={(session) => { setSelectedSession(session); selectShot(null); setActiveTab("analysis"); }}
              onDelete={handleDeleteSession} deletingId={deletingSessionId} /></TabsContent>
          </Tabs>
        </section>
      )}

      {activeTab === "analysis" && !analysisTarget && (
        <section className="mx-auto max-w-lg space-y-4 py-12 text-center"><h1 className="text-2xl font-semibold">확인할 스윙을 골라주세요</h1><p className="text-sm text-muted-foreground">기록에서 영상을 열거나 새 스윙을 업로드하세요.</p><Button onClick={() => setActiveTab("list")}>기록 보기</Button><Button variant="outline" onClick={() => setActiveTab("upload")}>영상 업로드</Button></section>
      )}
      {activeTab === "analysis" && analysisTarget && (
        <div className="min-w-0 space-y-2 lg:space-y-4">
          <div className="flex min-h-11 min-w-0 items-center gap-2"><Button variant="ghost" fullWidth={false} size="icon" aria-label="기록으로 돌아가기" onClick={() => setActiveTab("list")}><ArrowLeft className="size-5" /></Button><div className="min-w-0"><p className="sr-only">스윙 확인</p><h1 className="truncate text-base font-semibold">{formatMediaTitle(analysisTarget.filename, analysisTarget.originalName)}</h1></div></div>

          <div className="space-y-2">
            {isAnalysisLoading && <p className="text-sm text-muted-foreground">분석 상태를 불러오는 중...</p>}
            {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
            {jobStatus === "failed" && !analysis && selectedShot?.errorMessage && (
              <div className="px-4 py-2 text-xs text-red-100 border border-red-300/30 rounded-xl bg-red-400/10">
                실패 원인: {selectedShot.errorMessage}
              </div>
            )}
            {selectedShot?.errorCode === "NOT_SWING" &&
              (jobStatus === "failed" || selectedShot.status === "failed") &&
              !analysis && (
              <div className="px-4 py-3 border rounded-2xl border-amber-200 bg-amber-50">
                <p className="text-sm font-semibold text-amber-900">스윙 영상이 아닌 것 같아요</p>
                <p className="mt-1 text-xs break-words text-amber-800">
                  {selectedShot.errorMessage ||
                    "스윙 동작이 충분히 담기지 않았을 수 있어요. 다시 촬영해 주세요."}
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
          </div>

          {(jobStatus === "queued" || jobStatus === "running" || jobStatus === "failed") && (
            <AnalysisProgressCard jobId={analysisTarget.jobId ?? analysisTarget.id} status={jobStatus} isLoading={isAnalysisLoading}
              analysisVersion={analysis?.analysisVersion} error={analysisError || selectedShot?.errorMessage || null}
              progress={analysis?.progress ?? analysisTarget.analysis?.progress ?? null} compact />
          )}
          {jobStatus === "failed" && <Button fullWidth={false} onClick={() => handleAnalyzeShot(analysisTarget)} disabled={Boolean(analyzingId)}>분석 다시 시도</Button>}

          <div className="mx-auto max-w-5xl space-y-4">
            <div className="min-w-0">
              <AnalysisPlayer
                jobId={analysisTarget?.jobId ?? (selectedSession ? undefined : analysisTarget?.id)}
                videoUrl={selectedVideoUrl}
                events={analysis?.events}
                overlay={analysis?.overlay}
                dtlClubPointsV2={analysis?.dtlClubPointsV2}
                isModalOpen={showVideoModal}
                evidenceFocus={coachEvidenceFocus}
              />
            </div>
            <details className="rounded-xl border border-border px-4"><summary className="text-sm font-semibold">연구 기록 및 상세 수치</summary><div className="space-y-3 pb-4">
              <KeyMetrics analysis={analysis} status={jobStatus} />
              <details className="rounded-xl border border-border p-3">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold">기존 코칭 기록 · 연구 참고용</summary>
                <p className="mb-2 text-xs text-muted-foreground">아래 기록은 이번 임팩트 후보 검수와 별개이며, 자동 교정의 근거로 검증되지 않았습니다.</p>
                <CoachSummary
                  summary={
                    analysis?.summary
                      ? analysis.summary
                      : jobStatus === "queued" || jobStatus === "running"
                      ? "분석 중입니다. 잠시만 기다려 주세요."
                      : "데이터가 부족합니다."
                  }
                  comments={analysis?.coachSummary ?? []}
                  findings={analysis?.coachFindings ?? []}
                  events={analysis?.events}
                  onWatchEvidence={selectedVideoUrl ? (event) => setCoachEvidenceFocus((current) => ({ event, requestId: (current?.requestId ?? 0) + 1 })) : undefined}
                />

              </details>
              <details className="border shadow-sm group rounded-2xl border-border bg-card">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">상세 지표 / 디버그</p>
                    <p className="text-xs truncate text-muted-foreground">
                      템포, 이벤트 타이밍, 트래킹 품질 등 세부 항목은 필요할 때만 펼칩니다.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <span className="group-open:hidden">펼치기</span>
                    <span className="hidden group-open:inline">접기</span>
                  </span>
                </summary>
                <div className="p-2 border-t border-border sm:p-3">
                  <MetricsTable
                    analysis={analysis}
                    status={jobStatus}
                    onOpenVideo={analysisTarget ? () => setShowVideoModal(true) : undefined}
                  />
                </div>
              </details>
            </div></details>


          </div>
        </div>
      )}

      {showCameraSettingsLayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 bg-black/65 sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-settings-layer-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-background shadow-2xl shadow-black/50">
            <div className="flex flex-col gap-3 p-4 border-b border-border bg-card/90 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 id="camera-settings-layer-title" className="text-xl font-semibold text-foreground">
                  설정
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  클럽과 촬영 조건을 변경하세요.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="px-4 min-h-11"
                fullWidth={false}
                onClick={() => setShowCameraSettingsLayer(false)}
              >
                닫기
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
              <div className="space-y-4">
                <SettingsForm
                  value={settings}
                  lensOptions={lensOptions}
                  lensError={lensError}
                  onChange={(next) => {
                    const nextLens = next.lens;
                    const prevLens = settings.lens;
                    setSettings(next);
                    if (nextLens && nextLens !== prevLens) {
                      applyLensCalibration(nextLens);
                    }
                  }}
                  onSubmit={() => setShowCameraSettingsLayer(false)}
                />
                <details open={Boolean(statusError)} className="rounded-xl border border-border px-4"><summary className="text-sm font-semibold">카메라 연결 및 상태</summary><div className="space-y-4 pb-4">
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
                </div></details>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVideoModal && analysisTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analysis-video-dialog-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowVideoModal(false);
          }}
        >
          <div className="relative w-full max-w-xl p-4 space-y-3 border shadow-2xl border-border bg-card shadow-black/40 rounded-xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="analysis-video-dialog-title" className="text-sm font-semibold">분석 영상 확대</h2>
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
            <AnalysisPlayer
              jobId={analysisTarget?.jobId ?? (selectedSession ? undefined : analysisTarget?.id)}
              videoUrl={selectedVideoUrl}
              events={analysis?.events}
              overlay={analysis?.overlay}
              dtlClubPointsV2={analysis?.dtlClubPointsV2}
            />
          </div>
        </div>
      )}
    </Shell>
  );
}

export default App;
