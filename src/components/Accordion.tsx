import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const accordionVariants = cva(
  "flex flex-col items-start w-[689px] text-[#1a1a1a] border-b border-[#4d4d4d] font-normal",
  {
    variants: {
      state: {
        closed: "gap-0",
        open: "gap-0",
      },
    },
    defaultVariants: {
      state: "closed",
    },
  }
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="15"
    height="8"
    viewBox="0 0 15 8"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("shrink-0 transition-transform duration-200", open && "rotate-180")}
    aria-hidden="true"
  >
    <path
      d="M1 1L7.5 7L14 1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface AccordionProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof accordionVariants> {
  label?: string;
  content?: string;
  state?: "closed" | "open";
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      label = "O que é o Portal 360?",
      content = "Lorem ipsum dolor sit amet consectetur. Venenatis turpis pulvinar sit varius. Mauris purus in nulla ligula dignissim etiam viverra semper posuere. Pretium magna massa consectetur purus egestas ut. Fames in ac at lacus lacus.",
      state,
      checked,
      defaultChecked,
      onChange,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const isControlled = checked !== undefined;
    const stateFromProp = state !== undefined ? state === "open" : undefined;

    const initialOpen =
      stateFromProp !== undefined ? stateFromProp : defaultChecked ?? false;

    const [internalOpen, setInternalOpen] = React.useState(initialOpen);

    const isOpen = isControlled
      ? checked!
      : stateFromProp !== undefined
      ? stateFromProp
      : internalOpen;

    const resolvedState: "closed" | "open" = isOpen ? "open" : "closed";

    const regionId = React.useId();

    const handleToggle = () => {
      if (disabled) return;
      const next = !isOpen;
      if (!isControlled && stateFromProp === undefined) {
        setInternalOpen(next);
      }
      onChange?.(next);
    };

    return (
      <div
        ref={ref}
        className={cn(accordionVariants({ state: resolvedState }), className)}
        {...props}
      >
        {/* @node "Interactive area" */}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={regionId}
          disabled={disabled}
          onClick={handleToggle}
          className={cn(
            "flex flex-row justify-between items-center py-[20px] px-[8px] w-full text-left",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#019bef)]",
            "transition-colors",
            disabled && "cursor-not-allowed opacity-50 pointer-events-none"
          )}
        >
          {/* @node "title area" */}
          <span className="text-[16px] font-normal leading-none">{label}</span>
          <Chevron open={isOpen} />
        </button>

        {isOpen && (
          /* @node "Content area" */
          <div
            id={regionId}
            role="region"
            className="flex flex-row w-full px-[8px] pt-[8px] pb-[var(--spaces-space-l,24px)]"
          >
            <span className="text-[16px] font-normal leading-[1.4] w-full">
              {content}
            </span>
          </div>
        )}
      </div>
    );
  }
);

Accordion.displayName = "Accordion";

export { Accordion };
export default Accordion;