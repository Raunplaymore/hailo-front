type VideoPlayerProps = {
  src: string;
  title?: string;
};

export function VideoPlayer({ src, title }: VideoPlayerProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm text-slate-700 break-words">{title}</p>}
      <video
        key={src}
        className="w-full rounded-lg border border-slate-200 max-h-[600px] object-contain"
        controls
        preload="metadata"
        src={src}
      >
        브라우저에서 video 태그를 지원하지 않습니다.
      </video>
    </div>
  );
}
