import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const weekDayVariants = cva(
  // BASE — shared layout, padding, border, colors. NO fixed w/h (HUG).
  "flex flex-col gap-[8px] items-start px-[var(--spaces-space-m,16px)] py-[var(--spaces-space-x,12px)] border border-[var(--color-surface,#e6e6e6)] bg-white box-border transition-colors data-[current=true]:border-t-[2px] data-[current=true]:border-t-[var(--color-accent-3,#ff161f)]",
  {
    variants: {
      device: {
        desktop: "",
        mobile: "",
      },
    },
    defaultVariants: {
      device: "desktop",
    },
  }
);

interface WeekDayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof weekDayVariants> {
  day?: string;
  weekDay?: string;
  showDayNumber?: boolean;
  /** "current" adds red top accent + darker number text */
  current?: boolean;
}

const WeekDay = React.forwardRef<HTMLDivElement, WeekDayProps>(
  (
    {
      className,
      device = "desktop",
      day = "16",
      weekDay = "DOM",
      showDayNumber = true,
      current = false,
      ...props
    },
    ref
  ) => {
    const numColor = current
      ? "text-[var(--color-ink,#000000)]"
      : "text-[var(--color-neutral-3,#808080)]";

    const nameColor = current
      ? "text-[var(--color-ink,#000000)]"
      : "text-[var(--color-neutral-3,#808080)]";

    return (
      <div
        ref={ref}
        data-current={current}
        data-device={device}
        className={cn(weekDayVariants({ device }), className)}
        {...props}
      >
        {showDayNumber && (
          <div className="flex flex-row gap-[8px] justify-center items-center">
            {/* @node "Num" */}
            <span
              className={cn(
                "font-bold text-[16px] leading-none whitespace-nowrap",
                numColor
              )}
            >
              {day}
            </span>
          </div>
        )}
        <div className="flex flex-row gap-[8px] justify-center items-center">
          {/* @node "Name" */}
          <span
            className={cn(
              "text-[12px] uppercase leading-none whitespace-nowrap",
              nameColor
            )}
          >
            {weekDay}
          </span>
        </div>
      </div>
    );
  }
);

WeekDay.displayName = "WeekDay";

export { WeekDay };
export default WeekDay;