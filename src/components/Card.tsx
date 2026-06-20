import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl shadow-black/20 md:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
