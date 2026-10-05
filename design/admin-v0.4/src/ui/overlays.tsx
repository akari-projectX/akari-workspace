import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useTr } from "../lib/i18n";
import { Icon, type IconName } from "./icons";
import { Button, Input } from "./primitives";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

/* ---------- Drawer (details) ---------- */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  footer,
  width = "max-w-xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  const tr = useTr();
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn("anim-drawer absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-pop", width)}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          {actions}
          <Button variant="ghost" size="icon-sm" icon="x" aria-label={tr("关闭", "Close")} onClick={onClose} />
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "default",
  footer,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  tone?: "default" | "danger" | "warning";
  footer?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  const iconStyle = tone === "danger" ? "bg-destructive-soft text-destructive" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="alertdialog"
        aria-modal="true"
        className={cn(
          "anim-in relative w-full rounded-t-xl border border-border bg-popover shadow-pop sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="flex gap-3 px-5 pt-5">
          {icon && (
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", iconStyle)}>
              <Icon name={icon} size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <div className="mt-1 text-[13px] text-muted-foreground">{description}</div>}
          </div>
        </div>
        {children && <div className="px-5 pt-4">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>
      </div>
    </div>
  );
}

/* ---------- Confirm ----------
 * Destructive confirmations always state the affected count; with
 * `typeToConfirm` the user must also type the phrase (second confirmation).
 */
export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  /** e.g. "将删除 128 个账户" — shown prominently. */
  impact?: ReactNode;
  details?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "default";
  typeToConfirm?: string;
  onConfirm?: () => void;
};

type ConfirmCtx = (o: ConfirmOptions) => void;
const ConfirmContext = createContext<ConfirmCtx>(() => {});
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  const tr = useTr();
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [options]);
  if (!options) return null;
  const tone = options.tone ?? "danger";
  const blocked = options.typeToConfirm !== undefined && typed.trim() !== options.typeToConfirm;
  return (
    <Dialog
      open
      onClose={onClose}
      title={options.title}
      description={options.description}
      icon={tone === "default" ? "info" : "alert"}
      tone={tone}
      footer={
        <>
          <Button onClick={onClose}>{tr("取消", "Cancel")}</Button>
          <Button
            variant={tone === "danger" ? "destructive" : "primary"}
            disabled={blocked}
            onClick={() => {
              options.onConfirm?.();
              onClose();
            }}
          >
            {options.confirmLabel ?? tr("确认", "Confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {options.impact && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium",
              tone === "danger" ? "border-destructive/30 bg-destructive-soft text-destructive" : "border-warning/40 bg-warning-soft text-warning",
            )}
          >
            {options.impact}
          </div>
        )}
        {options.details}
        {options.typeToConfirm !== undefined && (
          <label className="block space-y-1.5">
            <span className="text-[13px] text-muted-foreground">
              {tr("二次确认：请输入", "Second confirmation: type")} <code className="rounded bg-muted px-1 font-mono text-foreground">{options.typeToConfirm}</code>
            </span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={options.typeToConfirm} autoFocus />
          </label>
        )}
      </div>
    </Dialog>
  );
}

/* ---------- Toast ---------- */
type Toast = { id: number; tone: "success" | "error" | "info"; title: string; description?: string };
type ToastCtx = (t: Omit<Toast, "id">) => void;
const ToastContext = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(ToastContext);

export function Providers({ children, initialConfirm }: { children: ReactNode; initialConfirm?: ConfirmOptions | null }) {
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(initialConfirm ?? null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback<ToastCtx>((t) => {
    const id = ++seq.current;
    setToasts((xs) => [...xs, { ...t, id }]);
    window.setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  useEffect(() => {
    if (initialConfirm !== undefined) setConfirm(initialConfirm);
  }, [initialConfirm]);
  return (
    <ConfirmContext.Provider value={setConfirm}>
      <ToastContext.Provider value={push}>
        {children}
        <ConfirmDialog options={confirm} onClose={() => setConfirm(null)} />
        <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((xs) => xs.filter((x) => x.id !== id))} />
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

export function ToastCard({ toast, onDismiss }: { toast: Omit<Toast, "id">; onDismiss?: () => void }) {
  const icon: IconName = toast.tone === "success" ? "check" : toast.tone === "error" ? "alert" : "info";
  const color = toast.tone === "success" ? "text-success bg-success-soft" : toast.tone === "error" ? "text-destructive bg-destructive-soft" : "text-info bg-info-soft";
  return (
    <div className="anim-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-popover p-3 shadow-pop">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", color)}>
        <Icon name={icon} size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{toast.title}</div>
        {toast.description && <div className="mt-0.5 text-xs text-muted-foreground">{toast.description}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground" aria-label="close">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------- Menu (simple popover) ---------- */
export function Popover({
  open,
  onClose,
  children,
  align = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className={cn(
          "anim-in absolute top-full z-40 mt-1 min-w-48 rounded-lg border border-border bg-popover p-1 shadow-pop",
          align === "right" ? "right-0" : "left-0",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: IconName; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-muted",
        danger && "text-destructive hover:bg-destructive-soft",
      )}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}
