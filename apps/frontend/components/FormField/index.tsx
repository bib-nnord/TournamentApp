interface FormFieldProps {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  labelRight?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function FormField({
  label,
  id,
  type = "text",
  placeholder,
  value,
  onChange,
  labelRight,
  className,
  disabled,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <div className={labelRight ? "flex items-center justify-between" : undefined}>
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {labelRight}
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500${disabled ? " bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}
