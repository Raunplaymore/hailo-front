import { useState } from "react";
import { createAnalysisJob } from "../api/shots";
import { Shot } from "../types/shots";

type UseUploadOptions = {
  onSuccess?: (shot?: Shot) => void;
};

export function useUpload(options?: UseUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const start = async (
    file: File,
    sourceType: "upload" | "camera" = "upload",
    options?: {
      club?: string;
      fps?: number;
      roi?: string;
      cam_distance?: number;
      cam_height?: number;
      h_fov?: number;
      v_fov?: number;
      impact_frame?: number;
      track_frames?: number;
    }
  ): Promise<Shot | undefined> => {
    setIsUploading(true);
    setMessage("업로드 중...");
    try {
      const shot = await createAnalysisJob(file, sourceType, options);
      setMessage(
        `업로드 완료. 분석 Job ${shot.jobId ?? shot.id}이 ${shot.status ?? "대기"} 상태입니다.`
      );
      options?.onSuccess?.(shot);
      return shot;
    } catch (error) {
      console.error(error);
      setMessage("업로드 실패. 다시 시도하세요.");
      return undefined;
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, message, start, setMessage };
}
