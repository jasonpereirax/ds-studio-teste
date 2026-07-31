import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex flex-col gap-[8px] items-start w-[360px] text-[var(--color-ink,#000000)] text-[14px] font-normal",
  {
    variants: {
      variant: {
        simple: "",
        textArea: "",
        dropdown: "",
      },
    },
    defaultVariants: {
      variant: "simple",
    },
  }
);

const SearchIcon = ({ color = "var(--color-neutral-3,#808080)" }: { color?: string }) => (
  <svg
    className="shrink-0"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth="1.5" />
    <path
      d="M13 13L16.5 16.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ChevronIcon = ({ color = "black" }: { color?: string }) => (
  <svg
    className="shrink-0"
    width="12"
    height="12"
    viewBox="0 0 12 7"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 1L6 6L11 1"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const InfoCircleIcon = () => (
  <svg
    className="w-[16px] h-[16px] shrink-0"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="8" cy="8" r="6.25" stroke="var(--color-neutral-3,#808080)" strokeWidth="1.5" />
    <path
      d="M8 7.2V11M8 5.4V5.41"
      stroke="var(--color-neutral-3,#808080)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

type InputState =
  | "default"
  | "hover"
  | "selected"
  | "error"
  | "disabled";

interface InputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof inputVariants> {
  showLabel?: boolean;
  inputLabel?: string;
  showInfo?: boolean;
  infoText?: string;
  leadingIcon?: boolean;
  treallingIcon?: boolean;
  placeholder?: string;
  inputText?: string;
  obrigatory?: boolean;
  infoButton?: boolean;
  filled?: boolean;
  state?: InputState;
  obrigatoryContent?: React.ReactNode;
  infoButtonContent?: React.ReactNode;
}

const DROPDOWN_ITEMS = Array.from({ length: 6 }, (_, i) => i);

function fieldStyles(state: InputState) {
  switch (state) {
    case "hover":
      return { border: "border-[var(--color-neutral-2,#BFBFBF)]", bg: "bg-[#F6F6F6]" };
    case "selected":
      return { border: "border-[var(--color-accent-4,#2E7D32)]", bg: "bg-white" };
    case "error":
      return { border: "border-[var(--color-accent-3,#ff161f)]", bg: "bg-white" };
    case "disabled":
      return { border: "border-[#E5E5E5]", bg: "bg-[#F0F0F0]" };
    default:
      return { border: "border-[var(--color-neutral-2,#BFBFBF)]", bg: "bg-white" };
  }
}

function textAreaStyles(state: InputState) {
  switch (state) {
    case "hover":
      return { border: "border-[var(--color-neutral-2,#BFBFBF)]", bg: "bg-[#F6F6F6]" };
    case "selected":
      return { border: "border-[var(--color-accent-4,#2E7D32)]", bg: "bg-[#F6F6F6]" };
    case "error":
      return { border: "border-[var(--color-accent-3,#ff161f)]", bg: "bg-[#F6F6F6]" };
    case "disabled":
      return { border: "border-[#E5E5E5]", bg: "bg-[#E0E0E0]" };
    default:
      return { border: "border-[var(--color-neutral-2,#BFBFBF)]", bg: "bg-white" };
  }
}

function infoTextColor(state: InputState) {
  switch (state) {
    case "selected":
      return "text-[var(--color-accent-4,#2E7D32)]";
    case "error":
      return "text-[var(--color-accent-3,#ff161f)]";
    default:
      return "text-[var(--color-neutral-3,#808080)]";
  }
}

const Input = React.forwardRef<HTMLDivElement, InputProps>(
  (
    {
      className,
      variant = "simple",
      showLabel = true,
      inputLabel = "Label",
      showInfo = true,
      infoText = "Info text",
      leadingIcon = true,
      treallingIcon = true,
      placeholder = "Placeholder",
      inputText = "Filled text",
      obrigatory = false,
      infoButton = false,
      filled = false,
      state = "default",
      obrigatoryContent,
      infoButtonContent,
      ...props
    },
    ref
  ) => {
    const disabled = state === "disabled";

    const Label = showLabel && (
      <div className="flex flex-row items-center px-[var(--spaces-space-xxs,4px)] w-full h-[16px]">
        <div className="flex flex-row items-center flex-1 min-w-0 gap-[var(--spaces-space-xxs,4px)]">
          <span
            className={cn(
              "text-[14px] truncate",
              disabled ? "text-[var(--color-neutral-2,#BFBFBF)]" : "text-[var(--color-neutral,#404040)]"
            )}
          >
            {inputLabel}
          </span>
          {obrigatory &&
            (obrigatoryContent ? (
              <span className="text-[14px] text-[var(--color-neutral,#404040)]">
                {obrigatoryContent}
              </span>
            ) : (
              <span className="text-[14px] text-[var(--color-accent-3,#ff161f)]">*</span>
            ))}
        </div>
        {infoButton && (
          <div className="w-[16px] shrink-0 h-[16px] flex items-center justify-center">
            {infoButtonContent ?? <InfoCircleIcon />}
          </div>
        )}
      </div>
    );

    const Info = showInfo && (
      <div className="flex flex-col items-start px-[var(--spaces-space-xxs,4px)] w-full">
        <span
          className={cn(
            "text-[14px] truncate w-full",
            infoTextColor(state)
          )}
        >
          {infoText}
        </span>
      </div>
    );

    const iconColor = disabled ? "var(--color-neutral-2,#BFBFBF)" : "var(--color-neutral-3,#808080)";
    const chevronColor = disabled ? "var(--color-neutral-2,#BFBFBF)" : "black";

    // ── TEXT AREA ──
    if (variant === "textArea") {
      const s = textAreaStyles(state);
      return (
        <div
          ref={ref}
          className={cn(inputVariants({ variant }), className)}
          {...props}
        >
          <div className="flex flex-col gap-[8px] items-start w-full">
            {Label}
            <div
              className={cn(
                "flex flex-col p-[var(--spaces-space-m,16px)] w-full h-[200px] border rounded-[var(--border-radius-border-radius-x,8px)]",
                s.border,
                s.bg
              )}
            >
              <span
                className={cn(
                  "text-[16px] leading-[24px]",
                  disabled
                    ? "text-[var(--color-neutral-2,#BFBFBF)]"
                    : filled
                    ? "text-[var(--color-ink,#000000)]"
                    : "text-[var(--color-neutral-3,#808080)]"
                )}
              >
                {filled ? inputText : placeholder}
              </span>
            </div>
          </div>
          {Info}
        </div>
      );
    }

    // ── DROPDOWN ──
    if (variant === "dropdown") {
      const headerBorder =
        state === "error" ? "border-[var(--color-accent-3,#ff161f)]" : "border-[var(--color-accent-4,#2E7D32)]";
      const scrollColor = "bg-[var(--color-accent-3,#ff161f)]";
      return (
        <div
          ref={ref}
          className={cn(inputVariants({ variant }), className)}
          {...props}
        >
          <div className="flex flex-col gap-[8px] items-start w-full">
            {Label}
            <div
              className={cn(
                "flex flex-row gap-[8px] items-center px-[var(--spaces-space-x,12px)] py-[var(--spaces-space-x,12px)] w-full border rounded-[var(--border-radius-border-radius-x,8px)] bg-white",
                headerBorder
              )}
            >
              {leadingIcon && <SearchIcon color={iconColor} />}
              <div className="flex flex-row items-center flex-1 min-w-0">
                <span className="text-[16px] text-[var(--color-ink,#000000)] truncate">
                  {inputText}
                </span>
              </div>
              {treallingIcon && <ChevronIcon color={chevronColor} />}
            </div>
          </div>
          <div className="flex flex-row items-start w-full h-[200px] overflow-hidden bg-white border border-[#F6F6F6] rounded-[var(--border-radius-border-radius-x,8px)] shadow-md">
            <div className="flex flex-col items-start py-[var(--spaces-space-xxs,4px)] flex-1 min-w-0">
              {DROPDOWN_ITEMS.map((i) => (
                <div
                  key={i}
                  className="flex flex-row gap-[8px] items-center pl-[var(--spaces-space-l,24px)] pr-[var(--spaces-space-m,16px)] py-[9px] w-full"
                >
                  <span className="text-[14px] text-[var(--color-neutral,#404040)]">Label</span>
                </div>
              ))}
            </div>
            <div className="flex flex-row items-start p-[var(--spaces-space-xxs,4px)] self-stretch">
              <div
                className={cn(
                  "w-[4px] shrink-0 h-[48px] rounded-full",
                  scrollColor
                )}
              />
            </div>
          </div>
        </div>
      );
    }

    // ── SIMPLE (default) ──
    const s = fieldStyles(state);
    return (
      <div
        ref={ref}
        className={cn(inputVariants({ variant }), className)}
        {...props}
      >
        <div className="flex flex-col gap-[8px] items-start w-full">
          {Label}
          <div
            className={cn(
              "flex flex-row gap-[8px] items-center px-[var(--spaces-space-x,12px)] py-[var(--spaces-space-x,12px)] w-full border rounded-[var(--border-radius-border-radius-x,8px)]",
              s.border,
              s.bg
            )}
          >
            {leadingIcon && <SearchIcon color={iconColor} />}
            <div className="flex flex-row items-center flex-1 min-w-0">
              <span
                className={cn(
                  "text-[16px] truncate",
                  disabled
                    ? "text-[var(--color-neutral-2,#BFBFBF)]"
                    : filled
                    ? "text-[var(--color-ink,#000000)]"
                    : "text-[var(--color-neutral-3,#808080)]"
                )}
              >
                {filled ? inputText : placeholder}
              </span>
            </div>
            {treallingIcon && <ChevronIcon color={chevronColor} />}
          </div>
        </div>
        {Info}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export default Input;