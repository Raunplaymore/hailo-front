import { ChangeEvent, useRef } from "react";
import { Button } from "../Button";
import { Card } from "../Card";

import { UploadSettings } from "../settings/SettingsForm";

type UploadCardProps = {
  isUploading: boolean;
  message: string;
  settings?: UploadSettings;
  onUpload: (file: File) => void;
};

export function UploadCard({ isUploading, message, onUpload }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(file);
  };

  return (
    <>
      <Card className="grid gap-3">
        <label className="w-full flex flex-col gap-2 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
          <span className="text-sm text-slate-700">영상 파일을 선택하세요</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleChange}
            className="text-base w-full"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm text-slate-700">설정</span>
          <p className="text-sm text-slate-500">
            세부 옵션은 상단의 <strong>설정</strong> 탭에서 변경할 수 있습니다.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          isLoading={isUploading}
          loadingText="업로드 중..."
          disabled={isUploading}
        >
          업로드
        </Button>
      </Card>
      <Card>
        <p className="text-sm text-slate-500 mb-2">업로드 상태</p>
        <div className="min-h-[40px] p-3 rounded-lg bg-slate-50 text-slate-900 text-base">
          {message || "메시지가 여기에 표시됩니다."}
        </div>
      </Card>
    </>
  );
}
