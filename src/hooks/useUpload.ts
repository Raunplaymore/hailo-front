import { useState } from "react";
import { createShot } from "../api/shots";

type UseUploadOptions = {
  onSuccess?: () => void;
};

export function useUpload(options?: UseUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const start = async (file: File, sourceType: "upload" | "camera" = "upload", club?: string) => {
    setIsUploading(true);
    setMessage("업로드 중...");
    try {
      await createShot(file, sourceType, club);
      setMessage("업로드 완료!");
      options?.onSuccess?.();
    } catch (error) {
      console.error(error);
      setMessage("업로드 실패. 다시 시도하세요.");
    } finally {
      setIsUploading(false);
    }
  };

  return { isUploading, message, start, setMessage };
}
