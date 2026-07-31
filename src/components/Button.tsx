import * as React from "react";
import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex h-[48px] flex-row items-center justify-center gap-[var(--spaces-space-x,12px)] px-[var(--spaces-space-m,16px)] py-[8px] rounded-[4px] text-[14px] font-bold border border-transparent transition-colors outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#019bef)] disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        button: "",
      },
      emphasis: {
        primary:
          "bg-[var(--color-accent-3,#ff161f)] text-white hover:bg-[var(--color-accent-2,#cc1219)] disabled:bg-[var(--color-neutral-3,#808080)] disabled:text-[var(--color-surface,#e6e6e6)]",
        secundary:
          "bg-transparent border-[var(--color-neutral-2,#bfbfbf)] text-[var(--color-neutral,#404040)] hover:border-[var(--color-neutral,#404040)] hover:border-2 hover:text-[var(--color-neutral,#404040)] disabled:text-[var(--color-neutral-2,#bfbfbf)] disabled:border-[var(--color-neutral-2,#bfbfbf)]",
        tertiary:
          "bg-transparent text-[var(--color-neutral,#404040)] hover:bg-[#f6f6f6] hover:text-[var(--color-ink,#000000)] disabled:text-[var(--color-neutral-2,#bfbfbf)]",
      },
      showIcon: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "button",
      emphasis: "tertiary",
      showIcon: false,
    },
  }
);

/* --- Icon components (verbatim from Figma assets) --- */
const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn("shrink-0", className)}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 4.5V19.5M19.5 12L4.5 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={cn("shrink-0 animate-spin", className)}
    width="24"
    height="24"
    viewBox="0 0 25 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.11507 2.13807L8.50282 2.80967C8.76939 3.27139 9.28082 3.47981 9.77256 3.3638C13.5742 2.40018 17.6833 4.00137 19.719 7.52723C22.1909 11.8086 20.7 17.2586 16.4678 19.7021C12.1936 22.1698 6.77031 20.7117 4.29843 16.4303C3.53263 15.1039 3.14351 13.663 3.10167 12.2318C3.0845 11.6447 3.21177 10.8597 3.47595 10.0657C3.72423 9.31949 3.94194 8.61271 3.32554 8.16534L2.68581 7.90891C1.31098 7.54053 0.790666 7.80836 0.495021 8.68209C-0.0234977 10.2145 -0.00214038 11.6547 0.00128072 12.0718C0.0180167 14.1122 0.55455 16.1768 1.66507 18.0626C4.98513 23.8131 12.3022 25.7449 18.0187 22.3885C23.7595 19.074 25.7209 11.7294 22.4008 5.97888C19.6139 1.1518 13.9109 -0.984287 8.74866 0.429086C8.02317 0.624084 7.72733 1.46648 8.11507 2.13807Z"
      fill="currentColor"
    />
  </svg>
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof buttonVariants> {
  txtButton?: string;
  leftIcon?: boolean;
  rightIcon?: boolean;
  showLabel?: boolean;
  loading?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "button",
      emphasis = "tertiary",
      showIcon = false,
      txtButton = "Label",
      leftIcon = true,
      rightIcon = true,
      showLabel = true,
      loading = false,
      disabled = false,
      checked,
      defaultChecked = false,
      onChange,
      onClick,
      ...props
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      const next = !isChecked;
      if (!isControlled) setInternalChecked(next);
      onChange?.(next);
      onClick?.(e);
    };

    const isProgress = loading;

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isChecked}
        aria-busy={isProgress || undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant, emphasis, showIcon }),
          isProgress && "flex-col",
          className
        )}
        {...props}
      >
        {isProgress ? (
          <Spinner className="w-[24px] h-[24px]" />
        ) : (
          <>
            {showIcon && leftIcon && (
              <PlusIcon className="w-[24px] h-[24px]" />
            )}
            {showLabel && (
              <span className="whitespace-nowrap text-[14px] leading-none">
                {txtButton}
              </span>
            )}
            {showIcon && rightIcon && (
              <PlusIcon className="w-[24px] h-[24px]" />
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export default Button;