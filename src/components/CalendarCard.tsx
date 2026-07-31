import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const calendarCardVariants = cva(
  "bg-white border border-[var(--color-surface,#e6e6e6)] text-[var(--color-neutral,#404040)]",
  {
    variants: {
      variant: {
        horizontal: "inline-flex flex-col justify-center items-center rounded-[var(--border-radius-border-radius-x,8px)]",
        vertical: "flex flex-col items-start w-fit min-w-[480px] rounded-[var(--border-radius-border-radius-x,8px)]",
      },
    },
    defaultVariants: {
      variant: "horizontal",
    },
  }
);

interface CalendarCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calendarCardVariants> {
  monthTitleLeft?: string;
  monthTitleRight?: string;
  monthTitleSingle?: string;
  dateRangeSummary?: string;
  modalTitle?: string;
  toggleLabel?: string;
  timeSectionTitle?: string;
  applyLabel?: string;
  cancelLabel?: string;
}

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg
    className={cn("shrink-0", className)}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* @node "Vector 335" */}
    <path
      d="M14.5 17L9.5 12L14.5 7"
      stroke="var(--color-accent-2,#CC1219)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg
    className={cn("shrink-0", className)}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* @node "Vector 335" */}
    <path
      d="M9.5 7L14.5 12L9.5 17"
      stroke="var(--color-accent-2,#CC1219)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="shrink-0"
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* @node "Vector" */}
    <path
      d="M18 30L30 18M18 18L30 30"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="shrink-0"
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* @node "Vector" */}
    <path
      d="M24 16.5V31.5M31.5 24L16.5 24"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    className="shrink-0"
    width="24"
    height="40"
    viewBox="0 0 24 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* @node "Vector" */}
    <path
      d="M14.7404 17L14.3942 26M9.60577 26L9.25962 17M4.77235 13.7906C5.91878 13.6174 7.07849 13.4849 8.25 13.3943C9.48744 13.2987 10.738 13.25 12 13.25C13.262 13.25 14.5126 13.2987 15.75 13.3943C16.9215 13.4849 18.0812 13.6174 19.2276 13.7906C19.5696 13.8422 19.9104 13.8975 20.25 13.9563M19.2276 13.7906L18.1598 27.6726C18.0696 28.8448 17.0921 29.75 15.9164 29.75H8.08357C6.90786 29.75 5.93037 28.8448 5.8402 27.6726L4.77235 13.7906M3.75 13.9563C4.08957 13.8975 4.43037 13.8422 4.77235 13.7906M15.75 13.3943V12.4782C15.75 11.2988 14.8393 10.3142 13.6606 10.2765C13.1092 10.2589 12.5556 10.25 12 10.25C11.4444 10.25 10.8908 10.2589 10.3394 10.2765C9.16065 10.3142 8.25 11.2988 8.25 12.4782V13.3943"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SwitchOff = () => (
  <svg
    className="shrink-0"
    width="48"
    height="24"
    viewBox="0 0 48 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12C48 18.6274 42.6274 24 36 24H12C5.37258 24 0 18.6274 0 12Z"
      fill="var(--color-neutral-2,#BFBFBF)"
    />
    {/* @node "chave" */}
    <circle cx="12" cy="12" r="8" fill="white" />
  </svg>
);

const SwitchOn = () => (
  <svg
    className="shrink-0"
    width="48"
    height="24"
    viewBox="0 0 48 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12C48 18.6274 42.6274 24 36 24H12C5.37258 24 0 18.6274 0 12Z"
      fill="var(--color-accent-3,#FF161F)"
    />
    {/* @node "chave" */}
    <circle cx="36" cy="12" r="8" fill="white" />
  </svg>
);

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type CellState = "default" | "muted" | "selected" | "range" | "outlined" | "empty";

const dayCellClasses = (state: CellState) => {
  switch (state) {
    case "muted":
      return "text-[var(--color-neutral-2,#bfbfbf)]";
    case "selected":
      return "bg-[var(--color-accent-3,#FF161F)] text-white rounded-[4px]";
    case "range":
      return "bg-[var(--color-surface-2,#FDDCDD)] text-[var(--color-neutral,#404040)] rounded-[4px]";
    case "outlined":
      return "border border-[var(--color-accent-3,#FF161F)] text-[var(--color-neutral,#404040)] rounded-[4px]";
    default:
      return "text-[var(--color-neutral,#404040)]";
  }
};

function DayCell({ value, state }: { value?: number; state: CellState }) {
  if (value === undefined) {
    return (
      <div className="flex flex-col gap-[var(--spaces-space-xxs,4px)] items-center px-[8px] pt-[var(--spaces-space-x,12px)] pb-[var(--spaces-space-xxs,4px)] flex-1 min-w-0 h-[36px]" />
    );
  }
  return (
    <div className="flex flex-col gap-[var(--spaces-space-xxs,4px)] items-center px-[2px] pt-[2px] pb-[2px] flex-1 min-w-0 h-[36px]">
      {/* @node "date-day" */}
      <div
        className={cn(
          "flex flex-row gap-[8px] justify-center items-center w-[32px] h-[32px]",
          dayCellClasses(state)
        )}
      >
        <span className="text-[14px] leading-none">{value}</span>
      </div>
    </div>
  );
}

const WeekHeader = () => (
  <div className="flex flex-row items-start w-full">
    {/* @node "week" */}
    {WEEKDAYS.map((d) => (
      <div
        key={d}
        className="flex flex-row gap-[10px] justify-center items-center px-[8px] py-[6px] flex-1 min-w-0"
      >
        <span className="text-[14px]">{d}</span>
      </div>
    ))}
  </div>
);

function DaysGrid({
  weeks,
}: {
  weeks: { value?: number; state: CellState }[][];
}) {
  return (
    <div className="flex flex-col gap-[var(--spaces-space-xxs,4px)] justify-center items-center w-full">
      {/* @node "days" */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-row gap-[var(--spaces-space-xxs,4px)] items-start w-full">
          {/* @node "days-line" */}
          {week.map((cell, ci) => (
            <DayCell key={ci} value={cell.value} state={cell.state} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---- Horizontal month data ---- */
const novWeeksBase: number[][] = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31],
];
const dezWeeksBase: (number | null)[][] = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, null, null, null],
];

function buildNovWeeks(selected: boolean) {
  return novWeeksBase.map((week) =>
    week.concat(Array(7 - week.length).fill(undefined)).map((v) => {
      if (v === undefined || v === null) return { value: undefined, state: "empty" as CellState };
      const num = v as number;
      if (!selected) {
        if (num < 17) return { value: num, state: "muted" as CellState };
        if (num === 17) return { value: num, state: "outlined" as CellState };
        return { value: num, state: "default" as CellState };
      }
      if (num < 17) return { value: num, state: "muted" as CellState };
      if (num === 17) return { value: num, state: "selected" as CellState };
      if (num >= 18 && num <= 20) return { value: num, state: "range" as CellState };
      if (num >= 23 && num <= 27) return { value: num, state: "range" as CellState };
      if (num >= 30 && num <= 31) return { value: num, state: "range" as CellState };
      if (num === 21 || num === 22 || num === 28 || num === 29)
        return { value: num, state: "muted" as CellState };
      return { value: num, state: "default" as CellState };
    })
  );
}

function buildDezWeeks(selected: boolean) {
  return dezWeeksBase.map((week) =>
    week.map((v) => {
      if (v === null) return { value: undefined, state: "empty" as CellState };
      const num = v as number;
      if (!selected) {
        return { value: num, state: "default" as CellState };
      }
      if (num === 15) return { value: num, state: "selected" as CellState };
      if (num >= 1 && num <= 4) return { value: num, state: "range" as CellState };
      if (num >= 7 && num <= 11) return { value: num, state: "range" as CellState };
      if (num === 14) return { value: num, state: "range" as CellState };
      return { value: num, state: "muted" as CellState };
    })
  );
}

/* ---- Vertical (Outubro) month data ---- */
const outWeeksBase: (number | null)[][] = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31, null, null, null, null],
];

function buildOutWeeks(selected: boolean) {
  return outWeeksBase.map((week) =>
    week.map((v) => {
      if (v === null) return { value: undefined, state: "empty" as CellState };
      const num = v as number;
      if (!selected) {
        if (num < 17) return { value: num, state: "muted" as CellState };
        if (num === 17) return { value: num, state: "outlined" as CellState };
        return { value: num, state: "default" as CellState };
      }
      if (num < 17) return { value: num, state: "muted" as CellState };
      if (num === 17) return { value: num, state: "selected" as CellState };
      if (num >= 18 && num <= 20) return { value: num, state: "range" as CellState };
      if (num >= 23 && num <= 27) return { value: num, state: "range" as CellState };
      if (num >= 30 && num <= 31) return { value: num, state: "range" as CellState };
      if (num === 21 || num === 22 || num === 28)
        return { value: num, state: "muted" as CellState };
      return { value: num, state: "default" as CellState };
    })
  );
}

const TimeInput = ({ defaultValue }: { defaultValue: string }) => (
  <div className="flex flex-col gap-[8px] items-start w-[72px] shrink-0">
    <div className="flex flex-col gap-[8px] items-start w-full">
      <input
        type="text"
        defaultValue={defaultValue}
        className="flex flex-row gap-[var(--spaces-space-xxs,4px)] items-center p-[8px] w-full border border-[var(--color-surface,#e6e6e6)] rounded-[4px] text-[14px] text-[var(--color-neutral,#404040)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-3,#FF161F)]"
      />
    </div>
  </div>
);

const CalendarCard = React.forwardRef<HTMLDivElement, CalendarCardProps>(
  (
    {
      className,
      variant = "horizontal",
      monthTitleLeft = "Novembro",
      monthTitleRight = "Dezembro",
      monthTitleSingle = "Outubro",
      dateRangeSummary = "Quarta, 18 de Nov - Quarta, 18 de Dez",
      modalTitle = "Horários de agendamento",
      toggleLabel = "Selecionar todas datas abertas para entrevista.",
      timeSectionTitle = "Quais horários você estará disponível?",
      applyLabel = "Aplicar",
      cancelLabel = "Cancelar",
      ...props
    },
    ref
  ) => {
    const [selected, setSelected] = React.useState(false);

    if (variant === "vertical") {
      const outWeeks = buildOutWeeks(selected);
      return (
        <div
          ref={ref}
          className={cn(calendarCardVariants({ variant }), className)}
          {...props}
        >
          {/* top content */}
          <div className="flex flex-row justify-between items-center pl-[var(--spaces-space-m,16px)] pr-[var(--spaces-space-xxs,4px)] py-[var(--spaces-space-xxs,4px)] w-full border-b border-[var(--color-surface,#e6e6e6)]">
            <span className="text-[18px] font-medium truncate">{modalTitle}</span>
            <button
              type="button"
              aria-label="Fechar"
              className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70 active:opacity-50"
            >
              <CloseIcon />
            </button>
          </div>

          {/* content area */}
          <div className="flex flex-row items-stretch w-full">
            <div className="flex flex-col items-start w-[468px] shrink-0">
              {/* agenda area */}
              <div className="flex flex-col gap-[var(--spaces-space-xl,32px)] items-start p-[var(--spaces-space-l,24px)] w-full">
                {/* calendar */}
                <div className="flex flex-col gap-[var(--spaces-space-l,24px)] items-start w-[420px]">
                  {/* month */}
                  <div className="flex flex-row justify-between items-center py-[var(--spaces-space-xxs,4px)] w-full">
                    <button
                      type="button"
                      aria-label="Mês anterior"
                      className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
                    >
                      <ChevronLeft />
                    </button>
                    <div className="flex flex-col gap-[8px] justify-center items-center py-[var(--spaces-space-xxs,4px)] flex-1 min-w-0">
                      <span className="text-[14px]">{monthTitleSingle}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Próximo mês"
                      className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                  <div className="flex flex-col gap-[var(--spaces-space-x,12px)] items-start w-full">
                    <WeekHeader />
                    <DaysGrid weeks={outWeeks} />
                  </div>
                </div>

                {/* Selector switch */}
                <div className="flex flex-row gap-[8px] items-center w-full">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selected}
                    onClick={() => setSelected((s) => !s)}
                    className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)]"
                  >
                    {selected ? <SwitchOn /> : <SwitchOff />}
                  </button>
                  <span className="text-[14px]">{toggleLabel}</span>
                </div>
              </div>

              {/* times area */}
              <div className="flex flex-col gap-[var(--spaces-space-xl,32px)] items-start p-[var(--spaces-space-l,24px)] w-full bg-[#f7f7f7]">
                <span className="text-[18px] font-medium">{timeSectionTitle}</span>
                <div className="flex flex-col gap-[var(--spaces-space-m,16px)] items-start w-full">
                  {/* row 1 */}
                  <div className="flex flex-row justify-between items-end w-[420px]">
                    <div className="flex flex-col gap-[var(--spaces-space-m,16px)] items-start">
                      <div className="flex flex-row gap-[8px] items-end">
                        <div className="flex flex-col gap-[8px] items-start w-[72px] shrink-0">
                          <span className="text-[14px]">
                            Início<span className="text-[var(--color-accent-3,#FF161F)]">*</span>
                          </span>
                          <TimeInput defaultValue="10:00" />
                        </div>
                        <div className="flex flex-col gap-[8px] items-start w-[72px] shrink-0">
                          <span className="text-[14px]">
                            Fim<span className="text-[var(--color-accent-3,#FF161F)]">*</span>
                          </span>
                          <TimeInput defaultValue="10:30" />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Adicionar horário"
                      className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                  {/* row 2 */}
                  <div className="flex flex-row gap-[8px] items-center">
                    <TimeInput defaultValue="11:00" />
                    <TimeInput defaultValue="11:30" />
                    <button
                      type="button"
                      aria-label="Remover horário"
                      className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollbar */}
            <div className="flex flex-row items-start p-[var(--spaces-space-xxs,4px)] self-stretch">
              <div className="flex flex-row gap-[8px] justify-center items-center w-[4px] shrink-0 self-stretch" />
              <div className="w-[4px] shrink-0 h-[48px] bg-[var(--color-accent-3,#FF161F)] rounded-full" />
            </div>
          </div>

          {/* button area */}
          <div className="flex flex-row gap-[var(--spaces-space-l,24px)] items-start p-[var(--spaces-space-m,16px)] w-full border-t border-[var(--color-surface,#e6e6e6)]">
            <button
              type="button"
              className="flex flex-row gap-[var(--spaces-space-x,12px)] justify-center items-center px-[var(--spaces-space-m,16px)] py-[8px] flex-1 min-w-0 h-[48px] border border-[var(--color-surface,#e6e6e6)] rounded-[4px] text-[14px] font-bold text-[var(--color-neutral,#404040)] hover:bg-[#f2f2f2] active:bg-[var(--color-surface,#e6e6e6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="flex flex-row gap-[var(--spaces-space-x,12px)] justify-center items-center px-[var(--spaces-space-m,16px)] py-[8px] flex-1 min-w-0 h-[48px] bg-[var(--color-accent-3,#FF161F)] rounded-[4px] text-[14px] font-bold text-white hover:bg-[#e01018] active:bg-[#c00e15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {applyLabel}
            </button>
          </div>
        </div>
      );
    }

    // ---- HORIZONTAL ----
    const novWeeks = buildNovWeeks(selected);
    const dezWeeks = buildDezWeeks(selected);

    return (
      <div
        ref={ref}
        className={cn(calendarCardVariants({ variant }), className)}
        {...props}
      >
        {/* calendars */}
        <div className="flex flex-row gap-[var(--spaces-space-xxl,48px)] items-center p-[var(--spaces-space-l,24px)]">
          {/* left calendar */}
          <div className="flex flex-col gap-[var(--spaces-space-l,24px)] items-start w-[320px] shrink-0">
            <div className="flex flex-row justify-between items-center pr-[var(--spaces-space-l,24px)] py-[var(--spaces-space-xxs,4px)] w-full">
              <button
                type="button"
                aria-label="Mês anterior"
                className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
              >
                <ChevronLeft />
              </button>
              <div className="flex flex-col gap-[8px] justify-center items-center py-[var(--spaces-space-xxs,4px)] flex-1 min-w-0">
                <span className="text-[14px]">{monthTitleLeft}</span>
              </div>
            </div>
            <div className="flex flex-col gap-[var(--spaces-space-x,12px)] items-start w-full">
              <WeekHeader />
              <DaysGrid weeks={novWeeks} />
            </div>
          </div>

          {/* right calendar */}
          <div className="flex flex-col gap-[var(--spaces-space-l,24px)] items-start w-[320px] shrink-0">
            <div className="flex flex-row justify-between items-center pl-[var(--spaces-space-l,24px)] py-[var(--spaces-space-xxs,4px)] w-full">
              <div className="flex flex-col gap-[8px] justify-center items-center py-[var(--spaces-space-xxs,4px)] flex-1 min-w-0">
                <span className="text-[14px]">{monthTitleRight}</span>
              </div>
              <button
                type="button"
                aria-label="Próximo mês"
                className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)] hover:opacity-70"
              >
                <ChevronRight />
              </button>
            </div>
            <div className="flex flex-col gap-[var(--spaces-space-x,12px)] items-start w-full">
              <WeekHeader />
              <DaysGrid weeks={dezWeeks} />
            </div>
          </div>
        </div>

        {/* bottom area */}
        <div className="flex flex-row gap-[var(--spaces-space-l,24px)] justify-end items-center p-[var(--spaces-space-m,16px)] w-full border-t border-[var(--color-surface,#e6e6e6)]">
          <button
            type="button"
            onClick={() => setSelected((s) => !s)}
            className="flex flex-row gap-[8px] items-center py-[var(--spaces-space-xxs,4px)] flex-1 min-w-0 text-left rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-3,#FF161F)]"
          >
            <span className="text-[14px] truncate">{dateRangeSummary}</span>
          </button>
          <button
            type="button"
            className="flex flex-row gap-[var(--spaces-space-x,12px)] justify-center items-center px-[var(--spaces-space-m,16px)] py-[8px] h-[48px] bg-[var(--color-accent-3,#FF161F)] rounded-[4px] text-[14px] font-bold text-white hover:bg-[#e01018] active:bg-[#c00e15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    );
  }
);

CalendarCard.displayName = "CalendarCard";

export { CalendarCard };
export default CalendarCard;