import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange focus:border-transparent',
          error ? 'border-red-400 bg-red-50' : 'border-stone-300 bg-white',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={clsx(
          'w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange focus:border-transparent resize-none',
          error ? 'border-red-400 bg-red-50' : 'border-stone-300 bg-white',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
