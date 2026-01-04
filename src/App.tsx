import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { UploadCard } from "./components/upload/UploadCard";
import { ShotList } from "./components/shots/ShotList";
import { MetricsTable } from "./components/analysis/MetricsTable";
import { AnalysisPlayer } from "./components/analysis/AnalysisPlayer";
import { CoachSummary } from "./components/analysis/CoachSummary";
import { KeyMetrics } from "./components/analysis/KeyMetrics";
import { Button } from "./components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { useUpload } from "./hooks/useUpload";
import { useShots } from "./hooks/useShots";
import { useAnalysis } from "./hooks/useAnalysis";
import { JobStatus, Shot } from "./types/shots";
import { SettingsForm, UploadSettings } from "./components/settings/SettingsForm";
import { API_BASE } from "./api/client";
import { CameraSettings, CameraSettingsValue } from "./components/camera/CameraSettings";
import { CameraStatusPanel } from "./components/camera/CameraStatusPanel";
import { CameraPreview } from "./components/camera/CameraPreview";
import { CaptureControls } from "./components/camera/CaptureControls";
import { CaptureGallery } from "./components/camera/CaptureGallery";
import { SessionControls } from "./components/camera/SessionControls";
import { CameraStatus, CaptureItem, CapturePayload } from "./types/camera";
import { LiveOverlayBox, SessionRecord, SessionState, SessionStatus } from "./types/session";
import {
  buildStreamUrl,
  captureAndAnalyze,
  CameraApiError,
  getStatus as getCameraStatus,
  getCalibration,
  listCalibrations,
  setAiConfig,
  startCapture,
  stopStream,
} from "./api/cameraApi";
import {
  deleteSession,
  getSessionLive,
  getSessionStatus,
  listSessionFiles,
  resolveCameraFileUrl,
  SessionApiError,
  startSession,
  stopSession,
} from "./api/sessionApi";
import { createAnalysisJob, createAnalysisJobFromFile, fetchAnalysisStatus } from "./api/shots";
import { SessionList } from "./components/sessions/SessionList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

type TabKey = "camera" | "upload" | "list" | "analysis" | "settings";

const CAMERA_ENV_BASE =
  (import.meta.env.VITE_CAMERA_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_CAMERA_API_BASE as string | undefined) ||
  // NEXT_PUBLIC prefix도 허용
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_API_BASE ?? "");
const CAMERA_ENV_TOKEN =
  (import.meta.env.VITE_CAMERA_AUTH_TOKEN as string | undefined) ||
  ((import.meta.env as unknown as Record<string, string | undefined>).NEXT_PUBLIC_CAMERA_AUTH_TOKEN ?? "");
const AI_CONFIG_GOLF = "yolov8s_nms_golf.json";
const DEFAULT_LENS = "lens_8mm_intrinsics.json";
const SESSION_FPS = 60;

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

function App() {
  const {
    shots,
    selected: selectedShot,
    select: selectShot,
    isLoading: shotsLoading,
    error: shotsError,
    refresh: refreshShots,
  } = useShots();
  const upload = useUpload({
    onSuccess: () => {
      refreshShots();
    },
  });
  const [activeTab, setActiveTab] = useState<TabKey>("camera");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openShotIds, setOpenShotIds] = useState<Set<string>>(new Set());
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [settings, setSettings] = useState<UploadSettings>({
    club: "driver",
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
  const [previewParams, setPreviewParams] = useState({ width: 640, height: 360, fps: 15 });
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPreviewOn, setIsPreviewOn] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
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
  const [liveBoxes, setLiveBoxes] = useState<LiveOverlayBox[]>([]);
  const livePollTimer = useRef<number | null>(null);
  const livePollId = useRef(0);
  const [captureResolution, setCaptureResolution] = useState({ width: 1280, height: 720 });
  const [captureFps, setCaptureFps] = useState(30);
  const [captureDuration, setCaptureDuration] = useState(5);
  const [captureBusyMessage, setCaptureBusyMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const captureLockRef = useRef(false);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiConfigNote, setAiConfigNote] = useState<string | null>(null);
  const [listMode, setListMode] = useState<"sessions" | "uploads">("sessions");
  const [uploadListTab, setUploadListTab] = useState<"pending" | "done">("pending");
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
    setDeletingId(shot.id);
    try {
      await fetch(`${API_BASE}/api/files/${encodeURIComponent(shot.filename)}`, {
        method: "DELETE",
      });
      await refreshShots();
      if (selectedShot?.id === shot.id) {
        selectShot(null);
        setActiveTab("list");
        setOpenShotIds(new Set());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSession = async (session: SessionRecord) => {
    if (!cameraSettings.baseUrl) {
      setSessionsError("카메라 서버 주소를 입력하세요.");
      return;
    }
    const confirmed = window.confirm(`${session.filename} 세션을 삭제할까요?`);
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
      jobId: analysisJobId,
      status,
    };
  };

  const analysisTarget = selectedSession ? sessionToShot(selectedSession) : selectedShot;

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
    if (!cameraSettings.baseUrl) {
      setAiConfigNote("카메라 서버 주소를 먼저 입력하세요.");
      return;
    }
    let canceled = false;
    const run = async () => {
      try {
        const res = await setAiConfig(
          cameraSettings.baseUrl,
          AI_CONFIG_GOLF,
          cameraSettings.token || undefined
        );
        if (canceled) return;
        setAiConfigNote(
          res.needsRestart ? "현재 세션/AI 스트림이 동작 중이면 다음 시작부터 적용됩니다." : null
        );
      } catch (err) {
        if (canceled) return;
        setAiConfigNote(err instanceof Error ? err.message : "AI 설정을 변경하지 못했습니다.");
      }
    };
    run();
    return () => {
      canceled = true;
    };
  }, [cameraSettings.baseUrl, cameraSettings.token]);

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
    if (previewParams.width * previewParams.height > MAX_PREVIEW_PIXELS) {
      setPreviewError("해상도가 너무 높습니다. 네트워크 상태를 고려해 낮춰주세요.");
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

  const handleStreamError = () => {
    setPreviewError("프리뷰 연결이 끊어졌습니다. 다시 시도하세요.");
    setIsPreviewOn(false);
    setStreamUrl(null);
    handleCheckStatus();
  };

  const handleStopPreview = async () => {
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
      await handleStopPreview();
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
    setSessionError(null);
    setSessionState("starting");
    setSessionFilename(null);
    setSessionVideoUrl(null);
    setSessionMetaPath(null);
    setSessionAnalysisJobId(null);
    setSessionAnalysisStatus(null);
    setSessionAnalysisError(null);
    setSessionRuntimeStatus(null);
    setSessionRuntimeError(null);
    setSessionLiveSize(null);
    setLiveBoxes([]);
    try {
      const payload = {
        width: previewParams.width,
        height: previewParams.height,
        fps: SESSION_FPS,
        model: "yolov8s",
        durationSec: 0,
      };
      const res = await startSession(
        cameraSettings.baseUrl,
        payload,
        cameraSettings.token || undefined
      );
      setSessionJobId(res.jobId);
      setSessionFilename(res.videoFile ?? null);
      setSessionVideoUrl(res.videoUrl ?? null);
      setSessionMetaPath(res.metaPath ?? null);
      setSessionLiveSize({ width: payload.width, height: payload.height });
      setSessionState("recording");
      if (!isPreviewOn) {
        handleStartPreview();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "세션 시작 실패";
      setSessionError(message);
      setSessionState("failed");
      await handleStopPreview();
    }
  };

  const handleSessionStop = async () => {
    if (!cameraSettings.baseUrl) {
      setSessionError("카메라 서버 주소를 입력하세요.");
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
      await handleStopPreview();
      refreshSessions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "세션 종료 실패";
      setSessionError(message);
      setSessionState("failed");
      await handleStopPreview();
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
  };

  useEffect(() => {
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
          await handleStopPreview();
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
          await handleStopPreview();
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
      isPreviewOn,
      baseUrl: cameraSettings.baseUrl,
    });
    if (!cameraSettings.baseUrl) {
      setCaptureBusyMessage("카메라 서버 주소를 입력하세요.");
      captureLockRef.current = false;
      return;
    }

    if (cameraSettings.autoStopPreviewOnCapture && isPreviewOn) {
      await handleStopPreview();
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
        selectShot({ ...shot, jobId, status: nextStatus });
        setSelectedSession(null);
      }
      await refreshShots();
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
      selectShot({ ...shot, jobId: res.jobId, status: res.status ?? "queued" });
      setSelectedSession(null);
      await refreshShots();
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
  const sessionOverlayLabel =
    sessionState === "recording"
      ? "AI 세션 촬영중"
      : sessionState === "stopping"
      ? "세션 종료 중"
      : sessionState === "analyzing"
      ? "분석 중"
      : null;
  const previewOverlayLabel = sessionOverlayLabel;

  useEffect(() => {
    if (activeTab !== "list") return;
    const hasInProgress = shots.some((shot) => {
      const status = (shot.status ?? shot.analysis?.status) as string | undefined;
      return status === "queued" || status === "running";
    });
    if (!hasInProgress) return;
    const interval = window.setInterval(() => {
      refreshShots();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTab, shots, refreshShots]);

  return (
    <Shell
      tabs={tabs}
      active={activeTab}
      onChange={setActiveTab}
      onSettingsClick={() => setActiveTab("settings")}
    >
      {activeTab === "camera" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div id="camera-preview" />
              <CameraPreview
                embedded
                isActive={isPreviewOn}
                streamUrl={streamUrl}
                key={previewSessionId}
                width={previewParams.width}
                height={previewParams.height}
                fps={previewParams.fps}
                onChangeResolution={(width, height) =>
                  setPreviewParams((prev) => ({ ...prev, width, height }))
                }
                onChangeFps={(value) => setPreviewParams((prev) => ({ ...prev, fps: value }))}
                onStart={handleStartPreview}
                onStop={handleStopPreview}
                onStreamError={handleStreamError}
                error={previewError}
                statusOverlay={previewOverlayLabel}
                overlayBoxes={liveBoxes}
                overlayEnabled={sessionState === "recording"}
              />
              <SessionControls
                embedded
                state={sessionState}
                jobId={sessionJobId}
                filename={sessionFilename}
                analysisStatus={sessionAnalysisStatus ?? undefined}
                sessionStatus={sessionRuntimeStatus}
                error={sessionError || sessionRuntimeError}
                analysisError={sessionAnalysisError}
                onStart={handleSessionStart}
                onStop={handleSessionStop}
                onReset={handleSessionReset}
              />
            </CardContent>
          </Card>
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
              isBusy={false}
            />
          </div>
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
              await refreshShots();
              selectShot(shot);
              setSelectedSession(null);
              setActiveTab("analysis");
            }
          }}
        />
      )}

      {activeTab === "list" && (
        <Tabs
          value={listMode}
          onValueChange={(val) => setListMode(val as "sessions" | "uploads")}
        >
          <TabsList className="mb-3">
            <TabsTrigger value="sessions">세션</TabsTrigger>
            <TabsTrigger value="uploads">업로드</TabsTrigger>
          </TabsList>
          <TabsContent value="sessions">
            <SessionList
              sessions={sessions}
              isLoading={isSessionsLoading}
              error={sessionsError}
              onRefresh={refreshSessions}
              onSelect={(session) => {
                setSelectedSession(session);
                selectShot(null);
                setActiveTab("analysis");
              }}
              onDelete={handleDeleteSession}
              deletingId={deletingSessionId}
            />
          </TabsContent>
          <TabsContent value="uploads">
            <Tabs
              value={uploadListTab}
              onValueChange={(val) => setUploadListTab(val as "pending" | "done")}
            >
              <TabsList className="mb-3">
                <TabsTrigger value="pending">분석 전</TabsTrigger>
                <TabsTrigger value="done">분석 후</TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                <ShotList
                  title="분석 전 파일(영상)"
                  emptyMessage="분석 대기 중인 영상이 없습니다."
                  shots={pendingShots}
                  isLoading={shotsLoading}
                  error={shotsError || analyzeError}
                  onRefresh={refreshShots}
                  onSelect={toggleOpen}
                  onAnalyze={(shot) => handleAnalyzeShot(shot)}
                  onForceAnalyze={(shot) => handleForceAnalyzeShot(shot)}
                  onRetake={handleRetake}
                  onDelete={(shot) => handleDelete(shot)}
                  deletingId={deletingId}
                  analyzingId={analyzingId}
                  openIds={openShotIds}
                />
              </TabsContent>
              <TabsContent value="done">
                <ShotList
                  title="분석 완료 파일"
                  emptyMessage="분석 완료된 파일이 없습니다."
                  shots={analyzedShots}
                  isLoading={shotsLoading}
                  error={shotsError || analyzeError}
                  onRefresh={refreshShots}
                  onSelect={toggleOpen}
                  onTitleClick={(shot) => {
                    selectShot(shot);
                    setSelectedSession(null);
                    setActiveTab("analysis");
                  }}
                  onDelete={(shot) => handleDelete(shot)}
                  deletingId={deletingId}
                  openIds={openShotIds}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}

      {activeTab === "analysis" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {isAnalysisLoading && <p className="text-sm text-slate-500">분석 상태를 불러오는 중...</p>}
            {analysisError && <p className="text-sm text-red-600">{analysisError}</p>}
            {jobStatus === "failed" && !analysis && selectedShot?.errorMessage && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
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
            {analysisTarget && <KeyMetrics analysis={analysis} status={jobStatus} />}
            <MetricsTable
              analysis={analysis}
              status={jobStatus}
              onOpenVideo={analysisTarget ? () => setShowVideoModal(true) : undefined}
            />
          </div>
          <div className="space-y-2">
            <AnalysisPlayer
              videoUrl={selectedVideoUrl}
              events={analysis?.events}
              isModalOpen={showVideoModal}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">코칭 요약</CardTitle>
                <CardDescription>분석 결과 기반 짧은 요약입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {analysis?.summary
                    ? analysis.summary
                    : jobStatus === "queued" || jobStatus === "running"
                    ? "분석 중입니다. 잠시만 기다려 주세요."
                    : "데이터가 부족합니다."}
                </p>
              </CardContent>
            </Card>
            <CoachSummary comments={analysis?.coachSummary ?? []} />
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-4">
          <CameraSettings
            value={cameraSettings}
            history={baseHistory}
            aiConfigNote={aiConfigNote}
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
            onSubmit={() => setActiveTab("upload")}
          />
        </div>
      )}

      {showVideoModal && analysisTarget && (
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
              key={analysisTarget.id}
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
