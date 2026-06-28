import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UPLOAD_PREFIX_PATTERN =
  /^\d{13,}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

const HASHY_FILENAME_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]{6,}){2,}$/i;

export function formatMediaTitle(filename: string, originalName?: string | null): string {
  const preferred = originalName?.trim();
  if (preferred) return preferred;
  if (!filename) return "";

  const trimmed = filename.trim();
  const extMatch = trimmed.match(/(\.[^.]+)$/);
  const extension = extMatch?.[1] ?? "";
  const withoutPrefix = trimmed.replace(UPLOAD_PREFIX_PATTERN, "").replace(/^[-_]+/, "");
  const stem = withoutPrefix.slice(0, withoutPrefix.length - extension.length);

  if (HASHY_FILENAME_PATTERN.test(stem)) {
    return `업로드 영상${extension}`;
  }

  return withoutPrefix || trimmed;
}
