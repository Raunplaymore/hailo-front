import { useEffect, useRef, useState } from "react";

type UploadResponse = {
  ok: boolean;
  file?: string;
};

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [files, setFiles] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 최초 진입 시 한번 목록 조회
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
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("삭제 실패");
      }
      const data: { ok: boolean } = await res.json();
      if (!data.ok) {
        throw new Error("삭제 실패");
      }

      setFiles((prev) => prev.filter((file) => file !== name));
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
      const res = await fetch("/api/files");
      if (!res.ok) {
        throw new Error("목록 요청 실패");
      }
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
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("업로드 실패");
      }

      const data: UploadResponse = await res.json();
      if (!data.ok) {
        throw new Error("업로드 실패");
      }

      setMessage("업로드 완료!");
      setSelectedFile(null);
      // 선택값 초기화 (iOS Safari에서 동일 파일 재선택 가능하게)
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchFiles();
    } catch (error) {
      console.error(error);
      setMessage("업로드 실패. 다시 시도하세요.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        display: "flex",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <main
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: "20px 20px 28px",
          boxSizing: "border-box",
        }}
      >
        <header style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              margin: "0 0 6px",
            }}
          >
            스윙 영상 업로드
          </p>
          <h1
            style={{
              fontSize: "22px",
              margin: 0,
              color: "#111827",
              lineHeight: 1.25,
            }}
          >
            아이폰 Safari 전용 업로드 툴
          </h1>
        </header>

        <section
          style={{
            display: "grid",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "14px",
              border: "1px dashed #d1d5db",
              borderRadius: "12px",
              background: "#f9fafb",
            }}
          >
            <span style={{ fontSize: "14px", color: "#374151" }}>
              영상 파일을 선택하세요
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ fontSize: "16px" }}
            />
          </label>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "17px",
              fontWeight: 600,
              borderRadius: "12px",
              border: "none",
              color: "#fff",
              background: isUploading ? "#9ca3af" : "#2563eb",
              boxShadow: "0 10px 25px rgba(37,99,235,0.18)",
              opacity: !selectedFile || isUploading ? 0.8 : 1,
              transition: "background 0.2s ease, transform 0.1s ease",
            }}
          >
            {isUploading ? "업로드 중..." : "업로드"}
          </button>

          <button
            type="button"
            onClick={fetchFiles}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              fontWeight: 600,
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              color: "#111827",
              background: "#f3f4f6",
            }}
          >
            파일 목록 새로고침
          </button>
        </section>

        <section style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>
            업로드 상태
          </p>
          <div
            style={{
              minHeight: "40px",
              padding: "12px",
              borderRadius: "10px",
              background: "#f9fafb",
              color: "#111827",
              fontSize: "15px",
            }}
          >
            {message || "메시지가 여기에 표시됩니다."}
          </div>
        </section>

        <section>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>
            업로드된 파일
          </p>
          {files.length === 0 ? (
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                color: "#6b7280",
                background: "#f9fafb",
              }}
            >
              아직 등록된 파일이 없습니다.
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: "8px",
              }}
            >
              {files.map((name) => (
                <li
                  key={name}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    color: "#111827",
                    fontSize: "15px",
                    wordBreak: "break-all",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <span style={{ flex: 1 }}>{name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    disabled={deleting === name}
                    style={{
                      border: "1px solid #ef4444",
                      background: deleting === name ? "#fecdd3" : "#fee2e2",
                      color: "#b91c1c",
                      borderRadius: "999px",
                      padding: "6px 10px",
                      fontSize: "13px",
                      fontWeight: 700,
                      minWidth: "48px",
                    }}
                    aria-label={`${name} 삭제`}
                  >
                    {deleting === name ? "삭제중" : "삭제"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
