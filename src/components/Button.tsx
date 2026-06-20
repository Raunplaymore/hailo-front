import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger";
  loadingText?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  isLoading = false,
  loadingText = "Loading...",
  fullWidth = true,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base = `${
    fullWidth ? "w-full" : "w-auto"
  } rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background`;

  const styles = {
    primary:
      "py-3 text-lg shadow-lg shadow-emerald-950/30 " +
      (rest.disabled || isLoading
        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
        : "bg-primary text-primary-foreground hover:bg-primary/90"),
    outline:
      "py-3 text-base border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    danger:
      "px-3 py-1 text-sm font-bold min-w-[64px] border rounded-full " +
      (rest.disabled || isLoading
        ? "border-border bg-muted text-muted-foreground cursor-not-allowed"
        : "border-destructive/40 bg-destructive/10 text-red-100 hover:bg-destructive/20"),
  } as const;

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      disabled={isLoading || rest.disabled}
      {...rest}
    >
      {isLoading ? loadingText : children}
    </button>
  );
}
