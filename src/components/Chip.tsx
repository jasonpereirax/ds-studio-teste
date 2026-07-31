import * as React from "react";
import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex flex-row justify-center items-center border box-border font-medium text-[14px] leading-[20px] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#008edd] disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      selected: {
        true: "bg-[var(--global-brandlow,#e6f5fd)] border-[var(--global-brandhigh,#008edd)] text-[var(--global-brandhigh,#008edd)] hover:bg-[#d5eefb]",
        false:
          "bg-[var(--background-backgroundcontainer,#ffffff)] border-[var(--borders-border,#dddddd)] text-[var(--texts-global-textprimary,#313235)] hover:bg-[#f5f5f5]",
      },
      icon: {
        true: "",
        false: "",
      },
      closable: {
        true: "",
        false: "",
      },
      filter: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      selected: false,
      icon: false,
      closable: false,
      filter: false,
    },
  }
);

/* ── Lightning-bolt leading icon ── */
const BoltIcon = ({ color }: { color: string }) => (
  <svg
    className="shrink-0"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12.0808 7.63367C12.0434 7.49361 11.9332 7.38343 11.7913 7.34795L8.78853 6.60846L10.6037 2.00529C10.6746 1.82415 10.6111 1.61687 10.4505 1.50856C10.2918 1.40212 10.077 1.42826 9.94819 1.57018L4.00422 7.94926C3.90525 8.0557 3.86977 8.20696 3.90898 8.34702C3.9482 8.48707 4.05651 8.59351 4.19656 8.62899L6.93792 9.30687L5.13961 14.0071C5.07051 14.1864 5.13401 14.39 5.29273 14.4983C5.4496 14.6047 5.66061 14.5823 5.79133 14.4441L11.9818 8.03329C12.0826 7.92685 12.12 7.77559 12.0808 7.63367V7.63367Z"
      fill={color}
    />
  </svg>
);

/* ── Close (×) trailing icon ── */
const CloseIcon = ({ color }: { color: string }) => (
  <svg
    className="shrink-0"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.1775 4.14142C11.3656 3.95337 11.6711 3.95337 11.8592 4.14142C12.0311 4.31369 12.0454 4.58368 11.9022 4.77228L11.8592 4.82209L8.68145 7.99982L11.8592 11.1776C12.0472 11.3656 12.0472 11.6711 11.8592 11.8592C11.6868 12.0314 11.416 12.0457 11.2273 11.9022L11.1785 11.8592L7.99981 8.68048L4.82207 11.8592C4.63402 12.0472 4.32848 12.0472 4.14043 11.8592C3.96825 11.6869 3.95401 11.416 4.09747 11.2274L4.14043 11.1776L7.31817 7.99884L4.14141 4.82209C3.95336 4.63403 3.95336 4.3285 4.14141 4.14045C4.31381 3.9684 4.58463 3.95393 4.77325 4.09748L4.82207 4.14045L7.99981 7.31818L11.1775 4.14142Z"
      fill={color}
    />
  </svg>
);

/* ── Chevron-down (filter) trailing icon ── */
const ChevronDownIcon = ({ color }: { color: string }) => (
  <svg
    className="shrink-0"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2.66667 5.89245C2.66667 5.73586 2.73648 5.5866 2.85638 5.48123C3.09921 5.27197 3.46953 5.2866 3.69414 5.51343L8.0393 9.94748L12.301 5.51636C12.5241 5.28807 12.8944 5.27197 13.1388 5.47977C13.3755 5.68026 13.3998 6.02708 13.1919 6.25536C13.1873 6.25976 13.1843 6.26415 13.1797 6.26854L8.48247 11.1504C8.37016 11.2675 8.21232 11.3333 8.04689 11.3333C7.88146 11.3348 7.7221 11.2704 7.60828 11.1548L2.82451 6.27146C2.72301 6.16958 2.66643 6.03372 2.66667 5.89245Z"
      fill={color}
    />
  </svg>
);

export interface ChipProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onChange" | "children"
    >,
    Omit<
      VariantProps<typeof chipVariants>,
      "selected" | "icon" | "closable" | "filter"
    > {
  label?: string;
  chooseIcon?: React.ReactNode;
  icon?: boolean;
  selected?: boolean;
  closable?: boolean;
  filter?: boolean;
  /* interactive state (selected toggle) */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  onClose?: () => void;
}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    {
      label = "Label",
      chooseIcon,
      icon = false,
      selected: selectedProp = false,
      closable = false,
      filter = false,
      checked,
      defaultChecked,
      onChange,
      disabled = false,
      onClose,
      className,
      ...props
    },
    ref
  ) => {
    const isControlled = checked !== undefined;
    const [internal, setInternal] = useState(
      defaultChecked ?? selectedProp ?? false
    );
    const isSelected = isControlled
      ? (checked as boolean)
      : defaultChecked !== undefined
      ? internal
      : selectedProp || internal;

    const handleClick = () => {
      if (disabled) return;
      const next = !isSelected;
      if (!isControlled) setInternal(next);
      onChange?.(next);
    };

    const accent = isSelected ? "#008edd" : "#6b6c6f";
    const closeColor = isSelected ? "#008edd" : "#6b6c6f";

    /* padding varies by which trailing/leading affordances exist */
    const hasTrailing = closable || filter;
    let padClass = "px-[12px] py-[6px]";
    if (icon && hasTrailing) padClass = "px-[8px] py-[6px]";
    else if (icon) padClass = "pl-[8px] pr-[12px] py-[6px]";
    else if (hasTrailing) padClass = "pl-[12px] pr-[8px] py-[6px]";

    const innerGap = hasTrailing ? "gap-[8px]" : "gap-[4px]";

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isSelected}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          chipVariants({ selected: isSelected, icon, closable, filter }),
          "rounded-[24px]",
          padClass,
          className
        )}
        {...props}
      >
        <div className={cn("flex flex-row items-center", innerGap)}>
          <div className="flex flex-row gap-[4px] justify-center items-center">
            {icon &&
              (chooseIcon ? (
                <span className="shrink-0 w-[16px] h-[16px] inline-flex items-center justify-center">
                  {chooseIcon}
                </span>
              ) : (
                <BoltIcon color={accent} />
              ))}
            <span className="text-[14px] leading-[20px] whitespace-nowrap max-w-[160px] truncate">
              {label}
            </span>
          </div>
          {closable && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Remove"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onClose?.();
              }}
              className="inline-flex items-center justify-center shrink-0"
            >
              <CloseIcon color={closeColor} />
            </span>
          )}
          {filter && <ChevronDownIcon color={closeColor} />}
        </div>
      </button>
    );
  }
);

Chip.displayName = "Chip";

export { Chip };
export default Chip;