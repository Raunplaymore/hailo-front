import { CaptureItem } from "../../types/camera";
import { Card } from "../Card";

type CaptureGalleryProps = {
  items: CaptureItem[];
};

export function CaptureGallery({ items }: CaptureGalleryProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-500">결과</p>
          <h2 className="text-lg font-semibold text-slate-900">최근 촬영물</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          아직 촬영물이 없습니다.
        </p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div
              key={item.filename}
              className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 break-words">{item.filename}</p>
                <span className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-black">
                {item.format === "mp4" ? (
                  <video src={item.url} controls className="w-full object-contain max-h-[320px]" />
                ) : (
                  <img src={item.url} alt={item.filename} className="w-full object-contain max-h-[320px]" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  {item.url}
                </a>
                {item.jobId && <span>Job: {item.jobId} ({item.status ?? "queued"})</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
