import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Source: Design System Document section 7.2
const FIELD_BASE =
  "w-full box-border rounded-input border border-border-default bg-card-bg px-3 py-[9px] text-body text-text-primary outline-none " +
  "focus:border-nhs-blue disabled:bg-page-bg disabled:text-text-muted";
const FIELD_ERROR = "border-nhs-red";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className = "", ...rest }: InputProps) {
  return (
    <input className={[FIELD_BASE, error ? FIELD_ERROR : "", className].join(" ")} {...rest} />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error = false, className = "", ...rest }: TextareaProps) {
  return (
    <textarea
      className={[FIELD_BASE, "min-h-[72px] resize-none leading-normal", error ? FIELD_ERROR : "", className].join(
        " ",
      )}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error = false, className = "", children, ...rest }: SelectProps) {
  return (
    <select className={[FIELD_BASE, error ? FIELD_ERROR : "", className].join(" ")} {...rest}>
      {children}
    </select>
  );
}

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function FieldLabel({ required = false, className = "", children, ...rest }: FieldLabelProps) {
  return (
    <label className={["mb-1 block text-label text-text-secondary", className].join(" ")} {...rest}>
      {children}
      {required ? <span className="text-nhs-red"> *</span> : null}
    </label>
  );
}
