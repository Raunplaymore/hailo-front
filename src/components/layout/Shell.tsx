import { ReactNode } from "react";

import { Button } from "../Button";

type ShellProps<T extends string> = {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  children: ReactNode;
  onSettingsClick?: () => void;
  settingsLabel?: string;
};

export function Shell<T extends string>({
  tabs,
  active,
  onChange,
  children,
  onSettingsClick,
  settingsLabel = "설정",
}: ShellProps<T>) {
  return (
    <div className="min-h-screen bg-slate-50 flex justify-center px-4 py-6 sm:px-6">
      <main className="w-full max-w-3xl mx-auto space-y-4" style={{ maxWidth: "640px" }}>
        <header className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500 mb-1">나의 스윙 영상 업로드</p>
            <h1 className="text-2xl font-semibold text-slate-900 leading-tight">Hailo App</h1>
          </div>
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            className="py-2 px-3 text-sm"
            onClick={onSettingsClick}
          >
            ⚙️ {settingsLabel}
          </Button>
        </header>
        <nav className="flex gap-2 mb-2 sticky top-0 bg-slate-50/90 backdrop-blur z-10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold border transition ${
                active === tab.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {children}
      </main>
    </div>
  );
}
