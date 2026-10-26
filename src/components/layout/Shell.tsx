import { ReactNode } from "react";
import { Camera, ListVideo, Settings, Upload } from "lucide-react";
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

export function Shell<T extends string>({ tabs, active, onChange, children, onSettingsClick, settingsLabel = "설정" }: ShellProps<T>) {
  const icon = (key: T) => key === "camera" ? <Camera aria-hidden="true" className="size-5" /> : key === "upload" ? <Upload aria-hidden="true" className="size-5" /> : <ListVideo aria-hidden="true" className="size-5" />;
  const selected = (key: T) => active === key || (String(active) === "analysis" && key === "list");
  const navigation = (mobile: boolean) => <nav aria-label={mobile ? "하단 탐색" : "주요 화면"} className={mobile ? "app-bottom-nav lg:hidden" : "hidden lg:block"}>
    <ul className={mobile ? "mx-auto grid max-w-lg grid-cols-3" : "flex items-center gap-2"}>
      {tabs.map(tab => <li key={tab.key}>
        <button type="button" aria-current={selected(tab.key) ? "page" : undefined} onClick={() => onChange(tab.key)}
          className={cn("flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors", mobile && "min-h-16 flex-col gap-1 rounded-none text-xs", selected(tab.key) ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <span className={cn("grid h-7 w-12 place-items-center rounded-full", selected(tab.key) && "bg-primary/10")}>{icon(tab.key)}</span>{tab.label}
        </button>
      </li>)}
    </ul>
  </nav>;
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">본문으로 이동</a>
    <header className="border-b border-border bg-background px-4 sm:px-6">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-primary/40 text-lg font-semibold text-primary">S</span><span className="text-base font-semibold">Swing Lab</span></div>
        {navigation(false)}
        <Button type="button" variant="ghost" size="icon" fullWidth={false} onClick={onSettingsClick} aria-label={settingsLabel} title={settingsLabel}><Settings aria-hidden="true" className="size-5" /></Button>
      </div>
    </header>
    <main id="main-content" className="mx-auto w-full max-w-5xl min-w-0 space-y-5 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</main>
    {navigation(true)}
  </div>;
}
