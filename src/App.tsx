import { useEffect, useRef, useState } from "react";
import { Button } from "./components/Button";
import { Card } from "./components/Card";

type UploadResponse = { ok: boolean; file?: string };

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE || "";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMessage(file ? `"${file.name}" 선택됨` : "");
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    setMessage(`"${name}" 삭제 중...`);
    try {
      const res = await fetch(
        `${API_BASE}/api/files/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error("삭제 실패");
      const data: { ok: boolean } = await res.json();
      if (!data.ok) throw new Error("삭제 실패");

      setFiles((prev) => prev.filter((file) => file !== name));
      if (selectedVideo === name) {
        setSelectedVideo(null);
      }
      setMessage("삭제 완료");
    } catch (error) {
      console.error(error);
      setMessage("삭제 실패. 다시 시도하세요.");
    } finally {
      setDeleting(null);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      if (!res.ok) throw new Error("목록 요청 실패");
      const data: string[] = await res.json();
      setFiles(data);
    } catch (error) {
      console.error(error);
      setMessage("파일 목록 불러오기 실패");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setMessage("업로드 중...");

    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("업로드 실패");

      const data: UploadResponse = await res.json();
      if (!data.ok) throw new Error("업로드 실패");

      setMessage("업로드 완료!");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchFiles();
    } catch (error) {
      console.error(error);
      setMessage("업로드 실패. 다시 시도하세요.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-6 sm:px-6">
      <main className="w-full max-w-lg mx-auto space-y-4">
        <header className="mb-4">
          <p className="text-sm text-slate-500 mb-1">나의 스윙 영상 업로드</p>
          <h1 className="text-2xl font-semibold text-slate-900 leading-tight">
            Hailo App
          </h1>
        </header>

        <Card className="grid gap-3 mb-4">
          <label className="w-full flex flex-col gap-2 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
            <span className="text-sm text-slate-700">영상 파일을 선택하세요</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="text-base w-full"
            />
          </label>

          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            isLoading={isUploading}
            loadingText="업로드 중..."
          >
            업로드
          </Button>

          <Button
            type="button"
            onClick={fetchFiles}
            variant="outline"
          >
            파일 목록 새로고침
          </Button>
        </Card>

        <Card className="mb-4">
          <p className="text-sm text-slate-500 mb-2">업로드 상태</p>
          <div className="min-h-[40px] p-3 rounded-lg bg-slate-50 text-slate-900 text-base">
            {message || "메시지가 여기에 표시됩니다."}
          </div>
        </Card>

        <Card>
          <p className="text-sm text-slate-500 mb-2">업로드된 파일</p>
          {files.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200 text-slate-500 bg-slate-50">
              아직 등록된 파일이 없습니다.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 grid gap-2">
              {files.map((name) => (
                <li
                  key={name}
                  className="p-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-base break-words flex items-center justify-between gap-3 w-full"
                >
                  <span className="flex-1">{name}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => setSelectedVideo(name)}
                      variant="outline"
                      className="w-auto px-3 py-1 text-sm"
                    >
                      보기
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleDelete(name)}
                      disabled={deleting === name}
                      isLoading={deleting === name}
                      loadingText="삭제중"
                      variant="danger"
                      className="w-auto"
                      aria-label={`${name} 삭제`}
                    >
                      삭제
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="text-sm text-slate-500 mb-2">선택한 영상</p>
          {selectedVideo ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700 break-words">{selectedVideo}</p>
              <video
                key={selectedVideo}
                className="w-full rounded-lg border border-slate-200"
                controls
                preload="metadata"
                src={`${API_BASE}/uploads/${encodeURIComponent(selectedVideo)}`}
              >
                브라우저에서 video 태그를 지원하지 않습니다.
              </video>
            </div>
          ) : (
            <p className="text-slate-500">목록에서 영상을 선택하면 미리보기 할 수 있습니다.</p>
          )}
        </Card>
      </main>
    </div>
  );
}

export default App;
