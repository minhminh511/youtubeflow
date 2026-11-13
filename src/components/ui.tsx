"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, X } from "lucide-react";

export function BrandMark({ className = "" }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true"><svg width="25" height="25" viewBox="0 0 28 28" fill="none"><path d="M7 6.5c0-1.4 1.5-2.25 2.7-1.55l13 7.5c1.2.7 1.2 2.4 0 3.1l-13 7.5C8.5 23.75 7 22.9 7 21.5v-15Z" fill="white"/><path d="m5 7.5 10 5.8c.55.32.55 1.1 0 1.4L5 20.5V7.5Z" fill="#A99AF9"/></svg></span>;
}

export function YouTubeMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 32 24" width="32" height="24" aria-hidden="true"><path fill="#FF2638" d="M31.33 3.75a4.02 4.02 0 0 0-2.82-2.84C26 .23 16 .23 16 .23S6 .23 3.49.91A4.02 4.02 0 0 0 .67 3.75C0 6.27 0 12 0 12s0 5.73.67 8.25a4.02 4.02 0 0 0 2.82 2.84c2.51.68 12.51.68 12.51.68s10 0 12.51-.68a4.02 4.02 0 0 0 2.82-2.84C32 17.73 32 12 32 12s0-5.73-.67-8.25Z"/><path fill="white" d="m12.8 17 8.3-5-8.3-5v10Z"/></svg>;
}

export function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.04.97-3.39.97-2.61 0-4.82-1.77-5.61-4.14H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.91A6 6 0 0 1 6.07 12c0-.66.12-1.3.32-1.91V7.5H3.05A10 10 0 0 0 2 12c0 1.61.38 3.13 1.05 4.5l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.34 2.59C7.18 7.72 9.39 5.95 12 5.95Z"/></svg>;
}

export function CopyButton({ text, label = "Sao chép", compact = false, className = "" }: { text: string; label?: string; compact?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function copy() {
    setFailed(false);
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      else {
        const element = document.createElement("textarea");
        element.value = text;
        element.style.position = "fixed";
        element.style.opacity = "0";
        document.body.appendChild(element);
        element.select();
        const success = document.execCommand("copy");
        element.remove();
        if (!success) throw new Error("copy_failed");
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch { setFailed(true); }
  }
  return <button type="button" className={`${compact ? "icon-button copy-icon" : "button button-secondary button-small"} ${copied ? "is-copied" : ""} ${className}`} onClick={copy} aria-label={copied ? "Đã sao chép" : failed ? "Không sao chép được, vui lòng chọn văn bản" : label} title={copied ? "Đã sao chép" : failed ? "Hãy chọn và sao chép văn bản thủ công" : label}>{copied ? <Check size={15} /> : <Copy size={15} />}{!compact && <span>{copied ? "Đã sao chép" : failed ? "Thử sao chép lại" : label}</span>}</button>;
}

let modalLockCount = 0;
let restoreModalBackground: (() => void) | null = null;

function lockModalBackground() {
  if (modalLockCount === 0) {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const previousOverflow = document.body.style.overflow;
    const previousHidden = shell?.getAttribute("aria-hidden");
    const previousInert = shell?.inert || false;
    document.body.style.overflow = "hidden";
    if (shell) { shell.inert = true; shell.setAttribute("aria-hidden", "true"); }
    restoreModalBackground = () => {
      document.body.style.overflow = previousOverflow;
      if (shell) {
        shell.inert = previousInert;
        if (previousHidden == null) shell.removeAttribute("aria-hidden");
        else shell.setAttribute("aria-hidden", previousHidden);
      }
    };
  }
  modalLockCount++;
  return () => {
    modalLockCount = Math.max(0, modalLockCount - 1);
    if (modalLockCount === 0) { restoreModalBackground?.(); restoreModalBackground = null; }
  };
}

export function Modal({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
    // Move focus into the portal before hiding the application from VoiceOver.
    focusable()?.[0]?.focus();
    const unlockBackground = lockModalBackground();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const elements = focusable();
        if (!elements?.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => { unlockBackground(); document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}><div className="modal-heading"><div><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Đóng hộp thoại" onClick={onClose}><X size={20} /></button></div>{children}</div></div>, document.body);
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
