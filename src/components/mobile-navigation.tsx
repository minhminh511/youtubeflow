"use client";

import { ArrowUpRight, CalendarDays, House, Lightbulb, Link2, Plus, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui";
import type { View } from "@/lib/types";

const items = [
  { view: "overview" as View, label: "Tổng quan", icon: House },
  { view: "planner" as View, label: "Lịch", icon: CalendarDays },
  { view: "ideas" as View, label: "Ý tưởng", icon: Lightbulb },
  { view: "connections" as View, label: "Kênh", icon: Link2 },
];

export function MobileNavigation({ view, onNavigate, onCreate }: { view: View; onNavigate: (view: View) => void; onCreate: () => void }) {
  function tab(item: typeof items[number]) {
    const Icon = item.icon;
    return <button key={item.view} className={`mobile-tab ${view === item.view ? "active" : ""}`} onClick={() => onNavigate(item.view)} aria-current={view === item.view ? "page" : undefined} aria-label={item.view === "planner" ? "Mở lịch nội dung" : item.view === "ideas" ? "Mở kho ý tưởng" : item.view === "connections" ? "Mở kết nối kênh" : "Mở tổng quan"}><span className="mobile-tab-icon"><Icon size={21} strokeWidth={view === item.view ? 2 : 1.75} /></span><span>{item.label}</span></button>;
  }
  return <nav className="mobile-tabbar" aria-label="Điều hướng dưới"><div className="mobile-tabbar-inner">{items.slice(0, 2).map(tab)}<button className="mobile-create-tab" onClick={onCreate} aria-label="Tạo nhanh nội dung"><span><Plus size={25} strokeWidth={1.8} /></span><small>Tạo mới</small></button>{items.slice(2).map(tab)}</div></nav>;
}

export function QuickCreateDialog({ open, onClose, onPlan, onIdea }: { open: boolean; onClose: () => void; onPlan: () => void; onIdea: () => void }) {
  return <Modal open={open} onClose={onClose} title="Hôm nay, bạn muốn tạo gì?" description="Một ý tưởng nhỏ. Một bước tiến mới."><div className="quick-create-options"><button onClick={() => { onClose(); onPlan(); }}><span className="quick-create-icon"><CalendarDays size={25} /></span><span><strong>Lên kế hoạch nội dung</strong><small>Chọn ngày, định dạng và phác thảo câu chuyện.</small></span><ArrowUpRight size={19} /></button><button onClick={() => { onClose(); onIdea(); }}><span className="quick-create-icon idea"><Lightbulb size={25} /></span><span><strong>Ghi lại một ý tưởng</strong><small>Giữ lại cảm hứng, phát triển khi bạn sẵn sàng.</small></span><ArrowUpRight size={19} /></button></div><div className="quick-create-note"><Sparkles size={16} /><span>Không cần kết nối YouTube để bắt đầu sáng tạo.</span></div></Modal>;
}
