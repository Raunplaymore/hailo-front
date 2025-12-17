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
    <div className="flex justify-center min-h-screen px-4 pt-6 pb-24 bg-slate-50 sm:px-6">
      <main className="w-full max-w-3xl mx-auto space-y-4" style={{ maxWidth: "840px" }}>
        <header className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="mb-1 text-sm text-slate-500">DTL 단일 카메라 기반</p>
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">
              스윙 업로드 & 분석
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            className="px-2 py-1 text-sm"
            onClick={onSettingsClick}
          >
            ⚙️ {settingsLabel}
          </Button>
        </header>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
        <ul className="grid w-full max-w-3xl grid-cols-4 mx-auto">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <button
                onClick={() => onChange(tab.key)}
                className={`w-full py-4 text-sm font-semibold transition ${
                  active === tab.key
                    ? "text-blue-600 bg-blue-50"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
