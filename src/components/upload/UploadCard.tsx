import { ChangeEvent, useRef } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { UploadStatus } from "../../hooks/useUpload";
import { UploadSettings } from "../settings/SettingsForm";

type UploadCardProps = {
  status: UploadStatus;
  message: string;
  activeFilename?: string;
  settings?: UploadSettings;
  onUpload: (file: File) => void | Promise<void>;
};
export function UploadCard({ status, message, activeFilename, settings, onUpload }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = status === "uploading";
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onUpload(file);
  };
  return <section aria-labelledby="upload-title" className="mx-auto max-w-xl space-y-5">
    <div><h1 id="upload-title" className="text-2xl font-semibold">스윙 업로드</h1><p className="mt-2 text-sm text-muted-foreground">영상을 선택하면 분석이 시작됩니다.</p></div>
    <Card><CardContent className="space-y-6 px-5 pb-6 pt-8 sm:px-8">
      <div className="space-y-3 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Upload className="size-6" aria-hidden="true" /></span><h2 className="text-lg font-semibold">내 스윙을 확인해 보세요</h2><p className="text-sm leading-6 text-muted-foreground">준비 자세부터 피니시까지 담긴 영상<br />MP4 또는 MOV</p></div>
      <input ref={inputRef} type="file" aria-label="스윙 영상 파일" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={handleChange} disabled={busy} className="hidden" aria-hidden="true" tabIndex={-1} />
      <Button type="button" size="lg" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <><Spinner className="mr-2 size-4" />업로드 중...</> : status === "failed" ? "다시 선택해 업로드" : "영상 선택 및 업로드"}
      </Button>
      {status !== "idle" && <div role={status === "failed" ? "alert" : "status"} className="space-y-1 rounded-xl bg-muted p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">{status === "succeeded" && <Check className="size-4 text-primary" aria-hidden="true" />}{busy ? "업로드 중" : status === "failed" ? "업로드 실패" : "업로드 완료 · 분석 화면으로 이동합니다"}</p>
        {activeFilename && <p className="break-all text-xs text-muted-foreground">{activeFilename}</p>}
        {message && <p className={status === "failed" ? "text-red-300" : "text-muted-foreground"}>{message}</p>}
      </div>}
      <p className="border-t border-border pt-4 text-xs leading-6 text-muted-foreground">촬영 방향: {settings?.viewpoint === "face_on" ? "정면" : "후방 (DTL)"} · {settings?.handedness === "left" ? "왼손" : "오른손"}<br />촬영 조건과 클럽은 상단 설정에서 변경할 수 있습니다.</p>
    </CardContent></Card>
    <p className="px-1 text-xs leading-6 text-muted-foreground">임팩트 후보와 자세 움직임을 영상에서 확인합니다. 고정된 카메라로 전신과 클럽이 보이게 촬영해 주세요.</p>
  </section>;
}
