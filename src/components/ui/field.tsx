import { cn } from "@/lib/cn";

const control =
  "w-full rounded-btn border border-line bg-card-soft px-[13px] py-[11px] text-body outline-none transition-colors focus:border-orange focus:bg-card";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[13px]">
      <label htmlFor={htmlFor} className="mb-[6px] block text-[12px] text-ink-2">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-[6px] text-meta text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "appearance-none", className)} {...props} />;
}

/** Inline explainer block. `calm` is the neutral tint variant. */
export function Note({
  calm,
  className,
  children,
}: {
  calm?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-[14px] rounded-btn px-[13px] py-[11px] text-label",
        calm ? "bg-tint text-ink-2" : "bg-orange-soft text-orange-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Form-level error. Errors say what to do, per the copy rules. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mb-[10px] text-[12px] text-orange-ink" role="alert">
      {children}
    </p>
  );
}

/** Checkbox on its own row, with the label to the right of the box. */
export function CheckField({
  label,
  hint,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;

  return (
    <div className="mb-[13px]">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-[9px] text-body"
      >
        <input
          id={id}
          type="checkbox"
          className="size-4 shrink-0 accent-orange"
          {...props}
        />
        {label}
      </label>
      {hint ? <p className="mt-[6px] text-meta text-ink-3">{hint}</p> : null}
    </div>
  );
}
