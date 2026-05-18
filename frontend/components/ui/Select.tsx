import React from "react"

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string
  hint?: string
  error?: string
  size?: "sm" | "md" | "lg"
}

const sizeStyles = {
  sm: "py-1.5 text-xs min-h-[32px]",
  md: "py-2.5 text-sm min-h-[40px]",
  lg: "py-3 text-base min-h-[48px]",
} as const

export const Select: React.FC<SelectProps> = ({
  label,
  hint,
  error,
  size = "md",
  className = "",
  id,
  children,
  ...rest
}) => {
  const generatedId = React.useId()
  const selectId = id || generatedId
  const hintId = hint || error ? `${selectId}-desc` : undefined
  const hasError = Boolean(error)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={hasError || undefined}
        aria-describedby={hintId}
        className={`
          w-full px-3 rounded-lg border transition-all outline-none cursor-pointer
          ${sizeStyles[size]}
          ${
            hasError
              ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          }
          disabled:bg-slate-100 disabled:cursor-not-allowed
          ${className}
        `}
        {...rest}
      >
        {children}
      </select>
      {(hint || error) && (
        <p id={hintId} className={`mt-1 text-xs ${hasError ? "text-red-600" : "text-slate-500"}`}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
