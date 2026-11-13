"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownUp, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Film, LayoutGrid, Lightbulb, List, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { formatDate, requestJson, today } from "@/lib/client";
import type { Plan, PlanInput } from "@/lib/types";

const formats = { video: "Video dài", short: "YouTube Shorts", live: "Livestream" };
const statuses = { idea: "Ý tưởng", planned: "Đã lên lịch", published: "Đã hoàn thành" };
const emptyForm = (mode: "planner" | "ideas", date?: string): PlanInput => ({ title: "", description: "", format: "video", status: mode === "ideas" ? "idea" : "planned", scheduledDate: mode === "ideas" ? null : date || today() });
interface Props { plans: Plan[]; onChange: (plans: Plan[]) => void; mode: "planner" | "ideas"; initialized: boolean; notify: (message: string, error?: boolean) => void; newRequest: number }

export function Planner({ plans, onChange, mode, initialized, notify, newRequest }: Props) {
  const [layout, setLayout] = useState<"calendar" | "list">("calendar");
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [ascending, setAscending] = useState(true);
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const [form, setForm] = useState<PlanInput>(() => emptyForm(mode));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Plan | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    setIsMobile(media.matches);
    if (media.matches) setLayout("list");
    const onChange = () => setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (newRequest > 0) { setForm(emptyForm(mode)); setFormError(""); setEditing(null); }
  }, [newRequest, mode]);

  function openEditor(plan: Plan | null = null, date?: string) {
    setFormError("");
    setForm(plan ? { title: plan.title, description: plan.description, format: plan.format, status: plan.status, scheduledDate: plan.scheduledDate } : emptyForm(mode, date));
    setEditing(plan);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!initialized) { setFormError("Chưa kết nối được cơ sở dữ liệu. Vui lòng tải lại trang."); return; }
    setSaving(true); setFormError("");
    try {
      const result = await requestJson<Plan>(editing ? `/api/plans/${editing.id}` : "/api/plans", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) });
      onChange(editing ? plans.map((plan) => plan.id === editing.id ? result : plan) : [result, ...plans]);
      setEditing(undefined);
      notify(editing ? "Đã cập nhật nội dung." : mode === "ideas" ? "Ý tưởng mới đã được lưu. Cảm hứng luôn ở đây!" : "Đã thêm nội dung vào kế hoạch.");
    } catch (error) { setFormError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await requestJson(`/api/plans/${deleting.id}`, { method: "DELETE" });
      onChange(plans.filter((plan) => plan.id !== deleting.id));
      setDeleting(null);
      notify("Đã xóa nội dung khỏi không gian của bạn.");
    } catch (error) { notify((error as Error).message, true); }
    finally { setSaving(false); }
  }

  const visible = plans.filter((plan) => (mode !== "ideas" || plan.status === "idea") && (filter === "all" || plan.status === filter) && `${plan.title} ${plan.description}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))).sort((a, b) => (a.scheduledDate || "9999").localeCompare(b.scheduledDate || "9999") * (ascending ? 1 : -1));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  const dateString = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const selectedPlans = visible.filter((plan) => plan.scheduledDate === selectedDate);

  function mobileCards(items: Plan[]) {
    return <div className="mobile-plan-list">{items.map((plan) => <article className="mobile-plan-card" key={plan.id}><div className="mobile-plan-top"><span className="format-tag"><Film size={13} />{formats[plan.format]}</span><span className={`plan-status ${plan.status}`}>{statuses[plan.status]}</span></div><button className="mobile-plan-title" onClick={() => openEditor(plan)}>{plan.title}<ArrowRight size={16} /></button>{plan.description && <p className="mobile-plan-description">{plan.description}</p>}<div className="mobile-plan-footer"><span><CalendarDays size={14} />{plan.scheduledDate ? formatDate(plan.scheduledDate) : "Chưa lên lịch"}</span><div><button className="icon-button" aria-label={`Chỉnh sửa nội dung ${plan.title}`} onClick={() => openEditor(plan)}><Pencil size={16} /></button><button className="icon-button danger-icon" aria-label={`Xóa nội dung ${plan.title}`} onClick={() => setDeleting(plan)}><Trash2 size={16} /></button></div></div></article>)}</div>;
  }

  return <div className={`workspace-view planner-view ${mode === "ideas" ? "ideas-view" : ""}`}>
    <div className="page-heading"><div><div className="eyebrow">TỪ CẢM HỨNG ĐẾN NỘI DUNG</div><h1>{mode === "ideas" ? "Kho ý tưởng" : "Lịch nội dung"}<span className="heading-dot">.</span></h1><p>{mode === "ideas" ? "Giữ lại những ý tưởng hay. Biến chúng thành câu chuyện của bạn." : "Một góc nhìn rõ ràng cho hành trình sáng tạo của bạn."}</p></div><button className="button button-primary" onClick={() => openEditor()} disabled={!initialized}><Plus size={17} />{mode === "ideas" ? "Thêm ý tưởng" : "Tạo nội dung"}</button></div>
    <div className="planner-info"><CalendarDays size={15} /><span>Kế hoạch được lưu tại TubeFlow, không tự động đăng video lên YouTube.</span></div>
    <div className="planner-toolbar"><div className="search-input"><SearchIcon /><input aria-label="Tìm nội dung" placeholder={mode === "ideas" ? "Tìm một ý tưởng..." : "Tìm nội dung..."} value={query} onChange={(event) => setQuery(event.target.value)} /></div>{mode !== "ideas" && <><select aria-label="Lọc theo trạng thái" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="planned">Đã lên lịch</option><option value="idea">Ý tưởng</option><option value="published">Đã hoàn thành</option></select><div className="view-switch"><button className={layout === "calendar" ? "active" : ""} aria-pressed={layout === "calendar"} onClick={() => setLayout("calendar")} aria-label="Xem lịch" title="Xem lịch"><LayoutGrid size={17} /></button><button className={layout === "list" ? "active" : ""} aria-pressed={layout === "list"} onClick={() => setLayout("list")} aria-label="Xem danh sách" title="Xem danh sách"><List size={18} /></button></div></>}</div>

    {mode === "ideas" ? <>{visible.length ? <div className="idea-grid">{visible.map((plan) => <article className="idea-card card" key={plan.id}><div className="idea-card-top"><span className="format-tag"><Film size={13} />{formats[plan.format]}</span><button className="icon-button" title="Chỉnh sửa ý tưởng" aria-label={`Chỉnh sửa ${plan.title}`} onClick={() => openEditor(plan)}><MoreHorizontal size={18} /></button></div><h3>{plan.title}</h3><p>{plan.description || "Một ý tưởng mới đang chờ được phát triển. Thêm ghi chú và phác thảo câu chuyện của bạn."}</p><div className="idea-card-footer"><span>{formatDate(plan.createdAt)}</span><button className="text-button" onClick={() => { openEditor(plan); setForm({ ...plan, status: "planned", scheduledDate: today() }); }}>Lên lịch <ArrowRight size={14} /></button></div></article>)}</div> : <div className="empty-state card"><span className="empty-icon"><Lightbulb size={34} /></span><span className="eyebrow">Ý TƯỞNG LỚN BẮT ĐẦU TỪ ĐÂY</span><h2>{query ? "Chưa tìm thấy ý tưởng phù hợp" : "Đừng để cảm hứng vụt qua"}</h2><p>{query ? "Thử một từ khóa khác hoặc xóa bộ lọc tìm kiếm." : "Một chủ đề thú vị, một câu chuyện muốn kể…\nLưu lại ngay để phát triển khi bạn sẵn sàng."}</p><button className="button button-primary" onClick={() => query ? setQuery("") : openEditor()}>{query ? "Xóa tìm kiếm" : <><Plus size={16} />Thêm ý tưởng đầu tiên</>}</button></div>}</> : layout === "calendar" ?
      <section className="calendar-card card">
        <div className="calendar-heading"><h2>Tháng {month.getMonth() + 1}, {month.getFullYear()}</h2><div><button className="button button-secondary button-small" onClick={() => { setMonth(new Date()); setSelectedDate(today()); }}>Hôm nay</button><button className="icon-button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div></div>
        <div className="calendar-weekdays">{["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"].map((day, index) => <span key={day}><span className="weekday-long">{day}</span><span className="weekday-short">{index === 6 ? "CN" : `T${index + 2}`}</span></span>)}</div>
        <div className="calendar-grid">{days.map((day) => {
          const key = dateString(day);
          const dayPlans = visible.filter((plan) => plan.scheduledDate === key);
          return <div className={`calendar-day ${day.getMonth() !== month.getMonth() ? "outside-month" : ""} ${key === today() ? "is-today" : ""} ${key === selectedDate ? "selected-day" : ""}`} key={key}><button className="day-number" onClick={() => isMobile ? setSelectedDate(key) : openEditor(null, key)} aria-pressed={isMobile ? key === selectedDate : undefined} aria-label={`${isMobile ? "Chọn ngày" : "Thêm nội dung ngày"} ${formatDate(key)}`}><span>{day.getDate()}</span><Plus size={12} /></button><div className="calendar-day-markers" aria-hidden="true">{dayPlans.slice(0, 3).map((plan) => <i className={plan.status} key={plan.id} />)}</div>{dayPlans.slice(0, 3).map((plan) => <button key={plan.id} className={`calendar-plan ${plan.status}`} title={plan.title} onClick={() => openEditor(plan)}><span />{plan.title}</button>)}{dayPlans.length > 3 && <button className="more-plans" onClick={() => { setQuery(""); setLayout("list"); }}>+{dayPlans.length - 3} nội dung</button>}</div>;
        })}</div>
        <div className="calendar-legend"><span><i className="legend-planned" />Đã lên lịch</span><span><i className="legend-idea" />Ý tưởng</span><span><i className="legend-published" />Đã hoàn thành</span><span className="calendar-tip">{isMobile ? "Chọn ngày để xem nội dung" : "Chọn một ngày để thêm nội dung"}</span></div>
        <div className="mobile-day-agenda"><div className="mobile-agenda-heading"><div><span>NỘI DUNG TRONG NGÀY</span><h3>{formatDate(selectedDate)}</h3></div><button className="button button-secondary button-small" onClick={() => openEditor(null, selectedDate)}><Plus size={15} />Thêm</button></div>{selectedPlans.length ? mobileCards(selectedPlans) : <div className="mobile-day-empty"><CalendarDays size={25} /><p>Chưa có nội dung cho ngày này.</p><button className="text-button" onClick={() => openEditor(null, selectedDate)}>Lên kế hoạch cho ngày này <ArrowRight size={14} /></button></div>}</div>
      </section> :
      <section className="plan-list-card card"><div className="table-heading"><h2>Nội dung của bạn <span>{visible.length}</span></h2><button className="text-button muted" onClick={() => setAscending(!ascending)} aria-label="Đổi thứ tự ngày dự kiến"><ArrowDownUp size={14} />Ngày dự kiến</button></div>{visible.length ? <><div className="table-scroll desktop-plan-table"><table className="plan-table"><thead><tr><th>Nội dung</th><th>Định dạng</th><th>Ngày dự kiến</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{visible.map((plan) => <tr key={plan.id}><td><button className="plan-title-button" onClick={() => openEditor(plan)}>{plan.title}</button><p>{plan.description.slice(0, 70)}</p></td><td>{formats[plan.format]}</td><td>{plan.scheduledDate ? formatDate(plan.scheduledDate) : "Chưa lên lịch"}</td><td><span className={`plan-status ${plan.status}`}>{statuses[plan.status]}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`Sửa ${plan.title}`} onClick={() => openEditor(plan)}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label={`Xóa ${plan.title}`} onClick={() => setDeleting(plan)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>{mobileCards(visible)}</> : <div className="empty-state compact-empty"><CalendarDays size={33} /><h3>{query || filter !== "all" ? "Không có nội dung phù hợp" : "Lịch sáng tạo đang chờ bạn"}</h3><p>Thêm nội dung đầu tiên hoặc điều chỉnh bộ lọc.</p><button className="text-button" onClick={() => openEditor()}><Plus size={15} />Tạo nội dung mới</button></div>}</section>}

    <Modal open={editing !== undefined} onClose={() => !saving && setEditing(undefined)} title={editing ? "Chỉnh sửa nội dung" : mode === "ideas" ? "Ghi lại ý tưởng mới" : "Lên kế hoạch nội dung"} description="Mọi câu chuyện hay đều bắt đầu bằng một ý tưởng.">
      <form onSubmit={save} className="plan-form"><label className="field-label" htmlFor="plan-title">Tiêu đề nội dung <span className="required">*</span></label><input id="plan-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Bạn muốn chia sẻ điều gì?" required maxLength={200} autoComplete="off" /><label className="field-label" htmlFor="plan-description">Ghi chú & kịch bản</label><textarea id="plan-description" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ghi lại thông điệp, dàn ý hoặc nguồn cảm hứng…" maxLength={5000} /><div className="form-two-columns"><div><label className="field-label" htmlFor="plan-format">Định dạng</label><select id="plan-format" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as PlanInput["format"] })}><option value="video">Video dài</option><option value="short">YouTube Shorts</option><option value="live">Livestream</option></select></div><div><label className="field-label" htmlFor="plan-status">Trạng thái</label><select id="plan-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PlanInput["status"] })}><option value="idea">Ý tưởng</option><option value="planned">Đã lên lịch</option><option value="published">Đã hoàn thành</option></select></div></div><label className="field-label" htmlFor="plan-date">Ngày dự kiến {form.status === "planned" && <span className="required">*</span>}</label><input id="plan-date" type="date" value={form.scheduledDate || ""} onChange={(event) => setForm({ ...form, scheduledDate: event.target.value || null })} required={form.status === "planned"} /><p className="field-hint">Đây là kế hoạch cá nhân. TubeFlow không tự động đăng video lên YouTube.</p>{formError && <div className="form-error" role="alert">{formError}</div>}<div className="modal-actions">{editing && <button className="text-button delete-action" type="button" onClick={() => { setDeleting(editing); setEditing(undefined); }} disabled={saving}><Trash2 size={15} />Xóa</button>}<button className="button button-secondary" type="button" onClick={() => setEditing(undefined)} disabled={saving}>Hủy</button><button className="button button-primary" type="submit" disabled={saving || !initialized}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={16} />}Lưu nội dung</button></div></form>
    </Modal>
    <Modal open={!!deleting} onClose={() => !saving && setDeleting(null)} title="Xóa nội dung này?" description="Thao tác này không thể hoàn tác."><p className="modal-body-copy">“{deleting?.title}” sẽ bị xóa khỏi kế hoạch của bạn. Video trên YouTube không bị ảnh hưởng.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleting(null)} disabled={saving}>Giữ lại</button><button className="button button-danger" onClick={remove} disabled={saving}>{saving && <Loader2 size={15} className="spin" />}Xóa nội dung</button></div></Modal>
  </div>;
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3" /><path d="m16 16 4.6 4.6" /></svg>;
}
