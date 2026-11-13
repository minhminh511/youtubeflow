"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Coins, Eye, Film, Info, Link2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, TrendingUp, Users, Wallet } from "lucide-react";
import { Modal } from "@/components/ui";
import { formatDate, formatNumber, requestJson } from "@/lib/client";
import type { MonetizationData, RevenueEntry, View } from "@/lib/types";

const CHECKLIST = [
  { key: "twoStep", title: "Bật xác minh 2 bước", description: "Bảo vệ tài khoản Google của kênh." },
  { key: "adsense", title: "Liên kết tài khoản AdSense", description: "Nhận thanh toán quảng cáo khi đủ điều kiện." },
  { key: "policies", title: "Tuân thủ chính sách YouTube", description: "Không vi phạm nguyên tắc cộng đồng và bản quyền." },
  { key: "noStrikes", title: "Không có cảnh cáo bản quyền", description: "Kênh không có cảnh cáo còn hiệu lực." },
  { key: "contentOriginal", title: "Nội dung gốc, có giá trị", description: "Video do bạn sáng tạo, không sao chép hàng loạt." },
];
const SOURCES = ["Quảng cáo", "Hội viên kênh", "Super Chat", "Super Thanks", "Sản phẩm", "Khác"];

function Progress({ label, current, target, note }: { label: string; current: number; target: number; note: string }) {
  const percent = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  return <div className="monetization-progress"><div className="monetization-progress-head"><span>{label}</span><strong>{formatNumber(current)} / {formatNumber(target)}</strong></div><div className="progress-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${Math.round(percent)} phần trăm`}><span style={{ width: `${percent}%`, background: "#9a7ad9" }} /></div><p>{note}</p></div>;
}

export function MonetizationView({ connected, onNavigate, notify }: { connected: boolean; onNavigate: (view: View) => void; notify: (message: string, error?: boolean) => void }) {
  const [data, setData] = useState<MonetizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [entryForm, setEntryForm] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("Quảng cáo");
  const [note, setNote] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleting, setDeleting] = useState<RevenueEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const fresh = await requestJson<MonetizationData>("/api/monetization");
      setData(fresh); setGoalDraft(fresh.revenueGoal);
    } catch (issue) { setError((issue as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleChecklist(key: string, value: boolean) {
    if (!data) return;
    const checklist = { ...data.checklist, [key]: value };
    setData({ ...data, checklist });
    try {
      const saved = await requestJson<{ checklist: Record<string, boolean> }>("/api/monetization", { method: "PATCH", body: JSON.stringify({ checklist }) });
      setData((current) => current ? { ...current, checklist: saved.checklist } : current);
    } catch (issue) { notify((issue as Error).message, true); void load(); }
  }

  async function saveGoal() {
    if (!/^\d{0,15}$/.test(goalDraft.trim())) { notify("Mục tiêu doanh thu phải là số nguyên.", true); return; }
    setSavingGoal(true);
    try {
      const saved = await requestJson<{ revenueGoal: string }>("/api/monetization", { method: "PATCH", body: JSON.stringify({ revenueGoal: goalDraft.trim() || "0" }) });
      setData((current) => current ? { ...current, revenueGoal: saved.revenueGoal } : current);
      notify("Đã lưu mục tiêu doanh thu.");
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setSavingGoal(false); }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{1,15}$/.test(amount.trim())) { notify("Số tiền phải là số nguyên (VNĐ).", true); return; }
    setSavingEntry(true);
    try {
      const entry = await requestJson<RevenueEntry>("/api/monetization/revenue", { method: "POST", body: JSON.stringify({ month, amount: amount.trim(), source, note: note.trim() }) });
      setData((current) => current ? { ...current, entries: [entry, ...current.entries].sort((a, b) => b.month.localeCompare(a.month)) } : current);
      setAmount(""); setNote(""); setEntryForm(false);
      notify("Đã ghi doanh thu tháng này.");
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setSavingEntry(false); }
  }

  async function removeEntry() {
    if (!deleting) return;
    try {
      await requestJson(`/api/monetization/revenue/${deleting.id}`, { method: "DELETE" });
      setData((current) => current ? { ...current, entries: current.entries.filter((entry) => entry.id !== deleting.id) } : current);
      setDeleting(null);
      notify("Đã xóa mục doanh thu.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  const loggedTotal = data?.entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0) || 0;
  const goal = Number(data?.revenueGoal || 0) || 0;
  const goalPercent = goal > 0 ? Math.min(100, (loggedTotal / goal) * 100) : 0;

  return <div className="workspace-view monetization-view">
    <div className="page-heading"><div><div className="eyebrow">ĐƯỜNG ĐẾN DOANH THU</div><h1>Kiếm tiền<span className="heading-dot">.</span></h1><p>Theo dõi điều kiện YouTube Partner Program và hành trình doanh thu của kênh.</p></div><button className="button button-secondary" onClick={load} disabled={loading}>{loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}Làm mới</button></div>
    {error && <div className="load-error" role="alert"><Info size={18} /><span>{error}</span><button className="text-button" onClick={load}>Thử lại</button></div>}
    {loading && !data ? <div className="loading-state card"><Loader2 size={26} className="spin" /><p>Đang tính tiến độ kiếm tiền…</p></div> : data && <>
      <section className={`card monetization-hero ${data.eligible ? "eligible" : ""}`}>
        <div className="monetization-hero-icon">{data.eligible ? <CheckCircle2 size={30} /> : <Coins size={30} />}</div>
        <div><span className="eyebrow">{data.eligible ? "ĐỦ ĐIỀU KIỆN YPP" : "CHƯƠNG TRÌNH ĐỐI TÁC YOUTUBE"}</span><h2>{data.eligible ? "Kênh của bạn đã đủ điều kiện bật kiếm tiền" : "Đường đến YouTube Partner Program"}</h2><p>{data.eligible ? "Hãy đăng ký trong YouTube Studio và hoàn tất các bước xác minh của YouTube." : "YPP yêu cầu 1.000 người đăng ký và 4.000 giờ xem trong 12 tháng, hoặc 10 triệu lượt xem Shorts trong 90 ngày."}</p></div>
        {!data.connected && <button className="button button-primary" onClick={() => onNavigate("connections")}><Link2 size={16} />Kết nối kênh <ArrowRight size={15} /></button>}
      </section>
      {data.connected ? <>
        <div className="stat-grid monetization-stats">
          <div className="stat-card card"><span className="stat-icon purple"><Users size={21} /></span><span className="stat-number">{formatNumber(data.subscribers)}</span><span className="stat-label">Người đăng ký</span></div>
          <div className="stat-card card"><span className="stat-icon blue"><Eye size={21} /></span><span className="stat-number">{formatNumber(data.watchHours)}</span><span className="stat-label">Giờ xem (12 tháng)</span></div>
          <div className="stat-card card"><span className="stat-icon rose"><Film size={21} /></span><span className="stat-number">{formatNumber(data.shortsViews)}</span><span className="stat-label">Lượt xem Shorts (90 ngày)</span></div>
          <div className="stat-card card"><span className="stat-icon green"><Wallet size={21} /></span><span className="stat-number">{data.revenue28Days != null ? `${formatNumber(Math.round(data.revenue28Days))} $` : "—"}</span><span className="stat-label">Doanh thu 28 ngày (USD)</span></div>
        </div>
        <section className="card monetization-progress-card"><div className="section-topline"><div><h2>Tiến độ điều kiện YPP</h2><p>Dữ liệu thật từ kênh và YouTube Analytics.</p></div><TrendingUp size={20} /></div>
          <div className="monetization-progress-list">
            <Progress label="Người đăng ký" current={Number(data.subscribers) || 0} target={1000} note="Yêu cầu: 1.000 người đăng ký." />
            <Progress label="Giờ xem công khai" current={data.watchHours} target={4000} note={data.watchHoursEstimated ? "Ước tính từ 28 ngày gần nhất (API giới hạn khoảng thời gian)." : "Tổng giờ xem 12 tháng gần nhất từ YouTube Analytics."} />
            <Progress label="Lượt xem Shorts" current={data.shortsViews} target={10000000} note="Ước tính từ video ngắn (≤3 phút) trong 90 ngày gần nhất." />
          </div>
          {data.canRequestRevenue && <div className="monetization-revenue-note"><Info size={16} /><div><strong>Xem doanh thu thật từ YouTube</strong><p>Cấp thêm quyền doanh thu để TubeFlow đọc ước tính doanh thu 28 ngày gần nhất.</p></div><a className="button button-secondary button-small" href="/api/youtube/connect?scope=monetary">Cấp quyền doanh thu <ArrowUpRight size={13} /></a></div>}
        </section>
      </> : <section className="card monetization-connect"><h2>Kết nối kênh để theo dõi tiến độ</h2><p>TubeFlow sẽ đọc số người đăng ký, giờ xem và lượt xem Shorts trực tiếp từ YouTube để tính tiến độ YPP.</p><button className="button button-primary" onClick={() => onNavigate("connections")}><Link2 size={16} />Kết nối kênh YouTube <ArrowRight size={15} /></button></section>}
      <div className="monetization-grid">
        <section className="card monetization-checklist"><div className="section-topline"><div><h2>Checklist kiếm tiền</h2><p>Các bước cần hoàn tất trước khi bật quảng cáo.</p></div><ShieldCheck size={20} /></div>
          {CHECKLIST.map((item) => <label key={item.key} className={`monetization-check ${data.checklist[item.key] ? "done" : ""}`}><input type="checkbox" checked={!!data.checklist[item.key]} onChange={(event) => toggleChecklist(item.key, event.target.checked)} /><span><strong>{item.title}</strong><small>{item.description}</small></span>{data.checklist[item.key] && <Check size={17} />}</label>)}
          <p className="monetization-small">Checklist được lưu riêng cho không gian của bạn. Việc bật kiếm tiền vẫn thực hiện tại YouTube Studio.</p>
        </section>
        <section className="card monetization-revenue">
          <div className="section-topline"><div><h2>Nhật ký doanh thu</h2><p>Ghi lại doanh thu từng tháng từ mọi nguồn.</p></div><button className="button button-secondary button-small" onClick={() => setEntryForm(!entryForm)}><Plus size={14} />Ghi doanh thu</button></div>
          <div className="monetization-goal"><label className="field-label" htmlFor="revenue-goal">Mục tiêu doanh thu (VNĐ)</label><div className="monetization-goal-input"><input id="revenue-goal" inputMode="numeric" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value.replace(/[^\d]/g, ""))} placeholder="Ví dụ: 10000000" /><button className="button button-secondary button-small" onClick={saveGoal} disabled={savingGoal}>{savingGoal ? <Loader2 size={14} className="spin" /> : <Check size={14} />}Lưu</button></div>{goal > 0 && <div className="monetization-goal-progress"><div className="progress-track" role="progressbar" aria-valuenow={Math.round(goalPercent)} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ mục tiêu doanh thu"><span style={{ width: `${goalPercent}%`, background: "#9a7ad9" }} /></div><span>{formatNumber(loggedTotal)} / {formatNumber(goal)} VNĐ ({Math.round(goalPercent)}%)</span></div>}</div>
          {entryForm && <form onSubmit={addEntry} className="monetization-entry-form"><div className="form-two-columns"><div><label className="field-label" htmlFor="revenue-month">Tháng</label><input id="revenue-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /></div><div><label className="field-label" htmlFor="revenue-source">Nguồn</label><select id="revenue-source" value={source} onChange={(event) => setSource(event.target.value)}>{SOURCES.map((item) => <option key={item}>{item}</option>)}</select></div></div><label className="field-label" htmlFor="revenue-amount">Số tiền (VNĐ)</label><input id="revenue-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} placeholder="Ví dụ: 2500000" required /><label className="field-label" htmlFor="revenue-note">Ghi chú</label><input id="revenue-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Tùy chọn" /><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setEntryForm(false)}>Hủy</button><button className="button button-primary" type="submit" disabled={savingEntry || !amount}>{savingEntry ? <Loader2 size={15} className="spin" /> : <Check size={15} />}Lưu doanh thu</button></div></form>}
          {data.entries.length ? <div className="monetization-entry-list">{data.entries.map((entry) => <div key={entry.id} className="monetization-entry"><div><strong>{formatNumber(entry.amount)} VNĐ</strong><span>{entry.month} · {entry.source}</span>{entry.note && <small>{entry.note}</small>}</div><button className="icon-button danger-icon" aria-label={`Xóa doanh thu tháng ${entry.month}`} onClick={() => setDeleting(entry)}><Trash2 size={15} /></button></div>)}</div> : <div className="empty-state compact-empty"><Wallet size={28} /><h3>Chưa có doanh thu nào được ghi</h3><p>Ghi lại doanh thu từng tháng để theo dõi hành trình kiếm tiền.</p></div>}
        </section>
      </div>
    </>}
    <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Xóa mục doanh thu?" description="Thao tác này không thể hoàn tác."><p className="modal-body-copy">Mục doanh thu tháng {deleting?.month} sẽ bị xóa khỏi nhật ký của bạn.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleting(null)}>Giữ lại</button><button className="button button-danger" onClick={removeEntry}><Trash2 size={15} />Xóa</button></div></Modal>
  </div>;
}
