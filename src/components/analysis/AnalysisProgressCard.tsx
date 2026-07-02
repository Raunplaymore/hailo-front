import { useState } from "react";
import { Check, CheckCircle2, Circle, Copy, LoaderCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import type { AnalysisProgress, JobStatus } from "@/types/shots";

type AnalysisProgressCardProps = {
  jobId?: string | null;
  status: JobStatus;
  isLoading: boolean;
  analysisVersion?: string | null;
  error?: string | null;
  progress?: AnalysisProgress | null;
};

type ProgressStep = {
  key: string;
  title: string;
  description: string;
  state: "pending" | "active" | "done" | "failed";
};

const DETAIL_LABELS: Record<string, string> = {
  bodyPipeline: "Body Pipeline",
  clubPipeline: "Club Pipeline",
  fusionPipeline: "Fusion Pipeline",
  reason: "Failure Reason",
  source: "Source",
  metaPath: "Meta Path",
  bodyPath: "Body Path",
  clubPath: "Club Path",
  fusionPath: "Fusion Path",
  bodyReason: "Body Reason",
  bodyStatus: "Body Status",
  bodySkipped: "Body Skipped",
  generatedMetaPath: "Generated Meta Path",
  responseBodySnippet: "Response Snippet",
  bodyResponseSnippet: "Body Response Snippet",
  submitStatus: "Submit Status",
  visibilityStatus: "Visibility Status",
  visibilityAttempts: "Visibility Attempts",
  converted: "Converted",
  conversion: "Conversion",
  warning: "Warning",
};

const getStageMessage = ({
  status,
  isLoading,
  analysisVersion,
  error,
  progress,
}: Omit<AnalysisProgressCardProps, "jobId">) => {
  if (progress?.message) {
    if (status === "succeeded" && analysisVersion) {
      return `${progress.message} 현재 결과 경로: ${analysisVersion}`;
    }
    return progress.message;
  }
  if (status === "failed") {
    return error || "분석 중 오류가 발생했습니다.";
  }
  if (status === "succeeded") {
    return analysisVersion
      ? `분석이 완료되었습니다. 현재 결과 경로: ${analysisVersion}`
      : "분석이 완료되었습니다.";
  }
  if (status === "running") {
    return "분석 엔진이 영상을 처리하고 있습니다.";
  }
  if (status === "queued") {
    return "업로드는 끝났고, 분석 작업이 준비 중입니다.";
  }
  if (isLoading) {
    return "분석 상태를 확인하고 있습니다.";
  }
  return "분석 작업을 기다리는 중입니다.";
};

const buildSteps = ({
  jobId,
  status,
  isLoading,
  progress,
}: Pick<AnalysisProgressCardProps, "jobId" | "status" | "isLoading" | "progress">): ProgressStep[] => {
  const hasJob = Boolean(jobId);
  const failed = status === "failed";
  const succeeded = status === "succeeded";
  const running = status === "running";
  const queued = status === "queued" || status === "idle" || isLoading;
  const stage = progress?.stage || "";

  if (stage) {
    const groupedPath =
      stage.includes("pose") ||
      stage.includes("club") ||
      stage.includes("fusion") ||
      Boolean(progress?.bodyPath || progress?.clubPath || progress?.fusionPath);
    const inferPath = progress?.analysisPath === "infer" && !groupedPath;
    const stageSet = new Set<string>();
    if (hasJob) stageSet.add("upload_received");
    const addUntil = (items: string[]) => items.forEach((item) => stageSet.add(item));

    if (groupedPath) {
      if (progress?.bodyPath) {
        addUntil(["video_ready", "pose_running", "pose_ready"]);
      }
      if (progress?.clubPath) {
        addUntil(["club_running", "club_ready"]);
      }
      if (progress?.fusionPath) {
        addUntil(["fusion_running", "fusion_succeeded"]);
      }
      if (["video_ready", "pose_running", "pose_ready", "club_running", "club_ready", "fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["video_ready"]);
      }
      if (["pose_running", "pose_ready", "club_running", "club_ready", "fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["pose_running"]);
      }
      if (["pose_ready", "club_running", "club_ready", "fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["pose_ready"]);
      }
      if (["club_running", "club_ready", "fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["club_running"]);
      }
      if (["club_ready", "fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["club_ready"]);
      }
      if (["fusion_running", "fusion_succeeded"].includes(stage)) {
        addUntil(["fusion_running"]);
      }
      if (stage === "fusion_succeeded") addUntil(["fusion_succeeded"]);
    } else if (inferPath) {
      if (["meta_generation_requested", "meta_ready", "infer_submitting", "infer_pending", "infer_running", "infer_succeeded"].includes(stage)) {
        addUntil(["meta_generation_requested"]);
      }
      if (["meta_ready", "infer_submitting", "infer_pending", "infer_running", "infer_succeeded"].includes(stage)) {
        addUntil(["meta_ready"]);
      }
      if (["infer_submitting", "infer_pending", "infer_running", "infer_succeeded"].includes(stage)) {
        addUntil(["infer_submitting"]);
      }
      if (["infer_pending", "infer_running", "infer_succeeded"].includes(stage)) {
        addUntil(["infer_pending"]);
      }
      if (["infer_running", "infer_succeeded"].includes(stage)) {
        addUntil(["infer_running"]);
      }
      if (stage === "infer_succeeded") addUntil(["infer_succeeded"]);
    } else {
      if (["video_preparing", "video_ready", "fallback_opencv", "opencv_precheck", "opencv_running", "opencv_succeeded"].includes(stage)) {
        addUntil(["video_preparing"]);
      }
      if (["video_ready", "fallback_opencv", "opencv_precheck", "opencv_running", "opencv_succeeded"].includes(stage)) {
        addUntil(["video_ready"]);
      }
      if (["fallback_opencv", "opencv_precheck", "opencv_running", "opencv_succeeded"].includes(stage)) {
        addUntil(["fallback_opencv"]);
      }
      if (["opencv_precheck", "opencv_running", "opencv_succeeded"].includes(stage)) {
        addUntil(["opencv_precheck"]);
      }
      if (["opencv_running", "opencv_succeeded"].includes(stage)) {
        addUntil(["opencv_running"]);
      }
      if (stage === "opencv_succeeded") addUntil(["opencv_succeeded"]);
    }

    const groupedSteps: ProgressStep[] = [
      {
        key: "upload",
        title: "업로드 완료",
        description: "파일이 서버에 등록되었습니다.",
        state: hasJob ? "done" : "pending",
      },
      {
        key: "pose",
        title: "몸 분석",
        description: "pose 기반 body track을 생성합니다.",
        state: (() => {
          const failedStep =
            failed && groupedPath
              ? !progress?.bodyPath
                ? "pose"
                : !progress?.clubPath
                  ? "club"
                  : "fusion"
              : null;
          if (failedStep === "pose") return "failed";
          if (stageSet.has("pose_ready")) return "done";
          if (stageSet.has("pose_running")) return "active";
          return "pending";
        })(),
      },
      {
        key: "club",
        title: "클럽 분석",
        description: "Hailo club track을 생성합니다.",
        state: (() => {
          const failedStep =
            failed && groupedPath
              ? !progress?.bodyPath
                ? "pose"
                : !progress?.clubPath
                  ? "club"
                  : "fusion"
              : null;
          if (failedStep === "club") return "failed";
          if (stageSet.has("club_ready")) return "done";
          if (stageSet.has("club_running")) return "active";
          return "pending";
        })(),
      },
      {
        key: "fusion",
        title: "융합 분석",
        description: "body/club 데이터를 결합해 이벤트와 지표를 계산합니다.",
        state: (() => {
          const failedStep =
            failed && groupedPath
              ? !progress?.bodyPath
                ? "pose"
                : !progress?.clubPath
                  ? "club"
                  : "fusion"
              : null;
          if (failedStep === "fusion") return "failed";
          if (stageSet.has("fusion_succeeded")) return "done";
          if (stageSet.has("fusion_running")) return "active";
          return "pending";
        })(),
      },
    ];

    const inferSteps: ProgressStep[] = [
      {
        key: "upload",
        title: "업로드 완료",
        description: "파일이 서버에 등록되었습니다.",
        state: hasJob ? "done" : "pending",
      },
      {
        key: "meta",
        title: "메타 준비",
        description: "service7 추론용 입력 메타를 준비합니다.",
        state:
          failed && inferPath ? "failed" : stageSet.has("meta_ready") ? "done" : stageSet.has("meta_generation_requested") ? "active" : "pending",
      },
      {
        key: "infer",
        title: "추론 실행",
        description: "hailo-infer service7 분석을 실행합니다.",
        state:
          failed && inferPath && ["infer_submitting", "infer_pending", "infer_running"].includes(stage)
            ? "failed"
            : stageSet.has("infer_succeeded")
            ? "done"
            : stageSet.has("infer_running") || stageSet.has("infer_pending") || stageSet.has("infer_submitting")
            ? "active"
            : "pending",
      },
      {
        key: "result",
        title: "결과 정리",
        description: "추론 결과를 화면용 데이터로 정리합니다.",
        state: succeeded && inferPath ? "done" : "pending",
      },
    ];

    const opencvSteps: ProgressStep[] = [
      {
        key: "upload",
        title: "업로드 완료",
        description: "파일이 서버에 등록되었습니다.",
        state: hasJob ? "done" : "pending",
      },
      {
        key: "prepare",
        title: "영상 준비",
        description: "분석 가능한 형식으로 영상을 정리합니다.",
        state:
          failed && !inferPath && ["video_preparing", "video_ready"].includes(stage)
            ? "failed"
            : stageSet.has("video_ready")
            ? "done"
            : stageSet.has("video_preparing")
            ? "active"
            : "pending",
      },
      {
        key: "fallback",
        title: "대체 분석 전환",
        description: "service7 대신 OpenCV 경로로 분석합니다.",
        state:
          stageSet.has("opencv_succeeded") || stageSet.has("opencv_running") || stageSet.has("opencv_precheck")
            ? "done"
            : stageSet.has("fallback_opencv")
            ? "active"
            : "pending",
      },
      {
        key: "opencv",
        title: "OpenCV 분석",
        description: "스윙 이벤트와 지표를 계산합니다.",
        state:
          failed && !inferPath ? "failed" : stageSet.has("opencv_succeeded") ? "done" : stageSet.has("opencv_running") || stageSet.has("opencv_precheck") ? "active" : "pending",
      },
    ];

    if (groupedPath) return groupedSteps;
    return inferPath ? inferSteps : opencvSteps;
  }

  return [
    {
      key: "upload",
      title: "업로드 완료",
      description: hasJob ? "파일이 서버에 등록되었습니다." : "파일 업로드를 기다립니다.",
      state: hasJob ? "done" : "pending",
    },
    {
      key: "queue",
      title: "분석 준비",
      description: "분석 작업과 입력 데이터를 준비합니다.",
      state: failed ? "failed" : succeeded || running ? "done" : queued && hasJob ? "active" : "pending",
    },
    {
      key: "run",
      title: "분석 실행",
      description: "스윙 이벤트와 지표를 계산합니다.",
      state: failed ? "failed" : succeeded ? "done" : running ? "active" : "pending",
    },
    {
      key: "result",
      title: "결과 정리",
      description: "분석 결과를 화면용 데이터로 정리합니다.",
      state: failed ? "failed" : succeeded ? "done" : "pending",
    },
  ];
};

const StepIcon = ({ state }: { state: ProgressStep["state"] }) => {
  if (state === "done") return <CheckCircle2 className="size-4 text-emerald-300" aria-hidden="true" />;
  if (state === "active") return <LoaderCircle className="size-4 animate-spin text-sky-300" aria-hidden="true" />;
  if (state === "failed") return <XCircle className="size-4 text-red-300" aria-hidden="true" />;
  return <Circle className="size-4 text-muted-foreground" aria-hidden="true" />;
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
};

const JobIdLine = ({ jobId }: { jobId: string }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(jobId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      toast({ title: "Job ID 복사됨", description: jobId });
    } catch {
      toast({
        variant: "destructive",
        title: "복사 실패",
        description: "브라우저에서 클립보드 접근을 허용하지 않았습니다.",
      });
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="break-all">Job ID: {jobId}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        fullWidth={false}
        className="h-7 gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        aria-label="Job ID 복사"
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        {copied ? "복사됨" : "복사"}
      </Button>
    </div>
  );
};

export function AnalysisProgressCard(props: AnalysisProgressCardProps) {
  const steps = buildSteps(props);
  const stageMessage = getStageMessage(props);
  const detailEntries = [
    ...(props.progress?.bodyPath ? [["bodyPath", props.progress.bodyPath] as const] : []),
    ...(props.progress?.clubPath ? [["clubPath", props.progress.clubPath] as const] : []),
    ...(props.progress?.fusionPath ? [["fusionPath", props.progress.fusionPath] as const] : []),
    ...Object.entries(props.progress?.detail || {}),
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">분석 진행 상태</CardTitle>
        <CardDescription>업로드 이후 현재 어느 단계인지 표시합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/35 px-3 py-3">
          <p className="text-sm font-medium text-foreground">{stageMessage}</p>
          {props.jobId ? <JobIdLine jobId={props.jobId} /> : null}
          {detailEntries.length > 0 ? (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border/70 bg-background/40 px-2 py-2">
                  <dt className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {DETAIL_LABELS[key] || key}
                  </dt>
                  <dd className="mt-1 break-all text-xs text-foreground">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <ol className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.key}
              className={cn(
                "rounded-xl border px-3 py-3",
                step.state === "done" && "border-emerald-400/25 bg-emerald-400/8",
                step.state === "active" && "border-sky-400/25 bg-sky-400/8",
                step.state === "failed" && "border-red-400/25 bg-red-400/8",
                step.state === "pending" && "border-border bg-muted/20"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <StepIcon state={step.state} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
