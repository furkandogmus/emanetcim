"use client";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="ui-card w-full max-w-sm p-6 flex flex-col gap-4">
        {title ? <h3 className="ui-heading-md">{title}</h3> : null}
        <p className="ui-body-sm text-gray-700">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-ui btn-ui-md btn-ui-ghost flex-1">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-ui btn-ui-md btn-ui-primary flex-1">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
