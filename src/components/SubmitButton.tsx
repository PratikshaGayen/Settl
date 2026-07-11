"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for progressive server-action forms that shows a pending
 * spinner + label while the action runs. Critical for the on-chain actions
 * (fund/approve) which take several seconds for the tx receipt — without this
 * the button looks frozen.
 */
type Props = React.ComponentPropsWithoutRef<"button"> & {
  pendingLabel: string;
};

export default function SubmitButton({
  children,
  pendingLabel,
  className,
  ...props
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
