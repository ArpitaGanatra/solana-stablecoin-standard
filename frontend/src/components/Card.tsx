"use client";

import { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export default function Card({
  title,
  children,
  className = "",
  action,
}: CardProps) {
  return (
    <div
      className={`bg-bg-card/60 backdrop-blur-sm border border-border-default rounded-xl p-6 transition-all duration-200 hover:border-border-strong ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-semibold text-text-primary tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
