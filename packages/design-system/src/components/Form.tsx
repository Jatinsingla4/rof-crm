import React from 'react';
import { spacing, colors, borderRadius } from '../theme';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
}

/**
 * Form Component - Base form wrapper
 * Enforces consistent spacing between form fields (24px)
 */
export const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ children, onSubmit, ...props }, ref) => {
    return (
      <form
        ref={ref}
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
        }}
        {...props}
      >
        {children}
      </form>
    );
  }
);

Form.displayName = 'Form';

// Form.Group - Wrapper for label + input + error
export interface FormGroupProps {
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
}

export function FormGroup({ label, required, error, helperText, children }: FormGroupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '14px', fontWeight: 500, color: colors.neutral[800] }}>
        {label}
        {required && <span style={{ color: colors.error[500], marginLeft: '4px' }}>*</span>}
      </label>

      {children}

      {helperText && !error && (
        <span style={{ fontSize: '12px', color: colors.neutral[600] }}>{helperText}</span>
      )}

      {error && <span style={{ fontSize: '12px', color: colors.error[500] }}>{error}</span>}
    </div>
  );
}

// Input field component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        style={{
          height: '40px',
          padding: `0 ${spacing.sm}`,
          border: `1px solid ${error ? colors.error[500] : colors.neutral[400]}`,
          borderRadius: borderRadius.input,
          fontSize: '14px',
          fontFamily: 'inherit',
          transition: 'all 150ms',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = colors.info[500]; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = error ? colors.error[500] : colors.neutral[400]; }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

// Textarea component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        style={{
          minHeight: '120px',
          maxHeight: '400px',
          padding: spacing.sm,
          border: `1px solid ${error ? colors.error[500] : colors.neutral[400]}`,
          borderRadius: borderRadius.card,
          fontSize: '14px',
          fontFamily: '"Courier New", monospace',
          resize: 'vertical',
          transition: 'all 150ms',
        }}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

// Select/Dropdown component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, options, ...props }, ref) => {
    return (
      <select
        ref={ref}
        style={{
          height: '40px',
          padding: `0 ${spacing.sm}`,
          border: `1px solid ${error ? colors.error[500] : colors.neutral[400]}`,
          borderRadius: borderRadius.input,
          fontSize: '14px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
        {...props}
      >
        <option value="">-- Select an option --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';

// Checkbox component
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (props, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        style={{
          width: '16px',
          height: '16px',
          cursor: 'pointer',
          accentColor: colors.primary[500],
        }}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

// Radio component
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  (props, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        style={{
          width: '16px',
          height: '16px',
          cursor: 'pointer',
          accentColor: colors.primary[500],
        }}
        {...props}
      />
    );
  }
);

Radio.displayName = 'Radio';
