"use client";

export function ConfirmSubmit({
  label,
  message,
  className,
}: {
  label: string;
  message: string;
  className: string;
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
