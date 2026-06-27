import { ReactNode } from "react";
import {
  BarChart3,
  Camera,
  ListVideo,
  Settings,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const getTabIcon = (label: string) => {
    if (label.includes("카메라")) return <Camera className="size-4" aria-hidden="true" />;
    if (label.includes("업로드")) return <Upload className="size-4" aria-hidden="true" />;
    if (label.includes("목록") || label.includes("기록")) {
      return <ListVideo className="size-4" aria-hidden="true" />;
    }
    if (label.includes("분석")) return <BarChart3 className="size-4" aria-hidden="true" />;
    return null;
  };
  const isSettingsActive = String(active) === "settings";

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background px-4 pb-44 pt-5 text-foreground sm:px-6 lg:pb-10 lg:pt-8">
      <main className="mx-auto w-full max-w-7xl min-w-0 space-y-5 overflow-x-hidden">
        <header className="rounded-2xl border border-white/10 bg-card/80 p-4 shadow-2xl shadow-black/25 backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                DTL Single Camera Lab
              </p>
              <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                Swing Capture Lab
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                라즈베리파이 카메라로 스윙을 촬영하고, Hailo 기반 실시간 감지와 분석 결과를 한 화면에서 제어합니다.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
              <nav className="hidden lg:block" aria-label="주요 화면">
                <ul className="flex rounded-xl border border-border bg-muted/50 p-1">
                  {tabs.map((tab) => {
                    const selected = active === tab.key;
                    return (
                      <li key={tab.key}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          fullWidth={false}
                          className={cn(
                            "h-10 gap-2 rounded-lg px-3 text-muted-foreground transition",
                            selected &&
                              "bg-primary text-primary-foreground shadow-lg shadow-emerald-950/30 hover:bg-primary hover:text-primary-foreground"
                          )}
                          onClick={() => onChange(tab.key)}
                        >
                          {getTabIcon(tab.label)}
                          {tab.label}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <Button
                type="button"
                variant={isSettingsActive ? "default" : "outline"}
                size="sm"
                fullWidth={false}
                className="h-10 gap-2 rounded-lg px-3"
                onClick={onSettingsClick}
              >
                <Settings className="size-4" aria-hidden="true" />
                {settingsLabel}
              </Button>
            </div>
          </div>
        </header>

        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:hidden">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-[0_-12px_28px_rgba(0,0,0,0.35)] backdrop-blur">
          <ul
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => (
              <li key={tab.key} className="flex">
                <Button
                  variant={active === tab.key ? "default" : "ghost"}
                  size="lg"
                  fullWidth
                  className={cn(
                    "h-16 flex-col gap-1 rounded-none border-0 text-xs",
                    active === tab.key
                      ? "bg-primary text-primary-foreground hover:bg-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => onChange(tab.key)}
                >
                  {getTabIcon(tab.label)}
                  {tab.label}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
}
