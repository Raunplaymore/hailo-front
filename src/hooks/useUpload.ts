import { useState } from "react";
import { createAnalysisJob } from "../api/shots";
import { Shot } from "../types/shots";

type UseUploadOptions = {
  onSuccess?: (shot?: Shot) => void;
};

const SUPPORTED_EXTENSIONS = [".mp4", ".mov"];
const SUPPORTED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/mov",
  "video/x-m4v",
]);

const isSupportedVideoFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (hasSupportedExtension) return true;
  return Boolean(file.type && SUPPORTED_MIME_TYPES.has(file.type.toLowerCase()));
};

export function useUpload(hookOptions?: UseUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [activeFilename, setActiveFilename] = useState<string>("");

  const start = async (
    file: File,
    sourceType: "upload" | "camera" = "upload",
    uploadOptions?: {
      club?: string;
      fps?: number;
      roi?: string;
      cam_distance?: number;
      cam_height?: number;
      h_fov?: number;
      v_fov?: number;
      impact_frame?: number;
      track_frames?: number;
      metaPath?: string | null;
    }
  ): Promise<Shot | undefined> => {
    if (!isSupportedVideoFile(file)) {
      setMessage("지원하지 않는 영상 형식입니다. MP4 또는 iPhone MOV 파일을 선택하세요.");
      return undefined;
    }

    setIsUploading(true);
    setActiveFilename(file.name);
    setMessage(`${file.name} 업로드 중...`);
    try {
      const shot = await createAnalysisJob(file, sourceType, uploadOptions);
      setMessage(
        `업로드 완료. 분석 Job ${shot.jobId ?? shot.id}이 ${shot.status ?? "대기"} 상태입니다.`
      );
      hookOptions?.onSuccess?.(shot);
      return shot;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "업로드 실패. 다시 시도하세요.";
      setMessage(`업로드 실패: ${message}`);
      return undefined;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, message, activeFilename, start, setMessage };
}
