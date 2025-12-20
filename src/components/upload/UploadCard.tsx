import { ChangeEvent, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">스윙 업로드 & 분석</CardTitle>
          <CardDescription>
            스윙 영상을 선택해 업로드하면 자동으로 분석이 시작됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className={cn(
              "flex w-full cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/50 p-4 transition",
              "hover:border-blue-200 hover:bg-blue-50"
            )}
          >
            <span className="text-sm text-foreground">영상 파일을 선택하세요</span>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              onChange={handleChange}
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted"
            />
          </label>

          <div className="grid gap-1">
            <span className="text-sm text-foreground">설정</span>
            <p className="text-sm text-muted-foreground">
              세부 옵션은 상단의 <strong>설정</strong> 탭에서 변경할 수 있습니다.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/80 bg-muted/40 px-5 py-4">
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            fullWidth
          >
            {isUploading ? "업로드 중..." : "업로드"}
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">업로드 상태</CardTitle>
          <CardDescription>서버 응답 및 Job 상태를 표시합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[48px] rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {message || "메시지가 여기에 표시됩니다."}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
