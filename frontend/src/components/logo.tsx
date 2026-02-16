"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}

export function Logo({ size = "md", variant = "light" }: LogoProps) {
  const sizes = {
    sm: {
      text: "text-xl",
      ain: "text-[22px] w-7 h-7",
      gap: "gap-[2px]",
    },
    md: {
      text: "text-2xl",
      ain: "text-[26px] w-8 h-8",
      gap: "gap-[2px]",
    },
    lg: {
      text: "text-5xl",
      ain: "text-[52px] w-14 h-14",
      gap: "gap-1",
    },
  };

  const s = sizes[size];
  const textColor = variant === "light" ? "text-white" : "text-text-primary";

  return (
    <span
      className={`inline-flex items-center ${s.gap} font-bold tracking-wider ${textColor}`}
      style={{ fontFamily: "var(--font-logo)" }}
    >
      <span className={s.text}>RI</span>
      <span
        className={`wessam_font ${s.ain} inline-flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400`}
      >
        ع
      </span>
      <span className={s.text}>AYA</span>
    </span>
  );
}
