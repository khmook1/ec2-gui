import type { ReactNode } from "react";

export interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="form-section">
      <h2 className="form-section__title">{title}</h2>
      {children}
    </section>
  );
}

type FormFieldWidth = "default" | "wide" | "narrow";

export interface FormFieldProps {
  label: string;
  width?: FormFieldWidth;
  /** input을 label로 감쌀 수 없을 때(행 레이아웃 등) */
  as?: "label" | "div";
  children: ReactNode;
}

function fieldClassName(width: FormFieldWidth): string {
  const base = "form-field";
  if (width === "wide") return `${base} form-field--wide`;
  if (width === "narrow") return `${base} form-field--narrow`;
  return base;
}

export function FormField({
  label,
  width = "default",
  as = "label",
  children,
}: FormFieldProps) {
  const className = fieldClassName(width);

  if (as === "div") {
    return (
      <div className={className}>
        <span>{label}</span>
        {children}
      </div>
    );
  }

  return (
    <label className={className}>
      <span>{label}</span>
      {children}
    </label>
  );
}
