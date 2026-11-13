"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Eye, Film, Info, Lightbulb, Link2, Loader2, Pencil, Plus, RefreshCw, Sparkles, Target, Trash2, Users } from "lucide-react";
import { Modal } from "@/components/ui";
import { formatDate, formatNumber, requestJson } from "@/lib/client";
import type { Channel, Competitor, ContentPillar, GeneratedIdea, Plan, View, WorkspaceData } from "@/lib/types";

type Tab = "ideas" | "pillars" | "competitors";
interface Props { data: WorkspaceData; onNavigate: (view: View) => void; onPlansChange: (plans: Plan[]) => void; notify: (message: string, error?: boolean) => void }

export function StrategyView({ data, onNavigate, onPlansChange, notify }: Props) {
  const [tab, setTab] = useState<Tab>("ideas");
  const [pillars, setPillars] = useState<ContentPillar[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [syncingCompetitors, setSyncingCompetitors] = useState(false);
  const [error, setError] = useState("");
  const [pillarForm, setPillarForm] = useState<ContentPillar | null | undefined>(undefined);
  const [pillarName, setPillarName] = useState("");
  const [pillarDescription, setPillarDescription] = useState("");
  const [savingPillar, setSavingPillar] = useState(false);
  const [deletingPillar, setDeletingPillar] = useState<ContentPillar | null>(null);
  const [deletingCompetitor, setDeletingCompetitor] = useState<Competitor | null>(null);
  const [handle, setHandle] = useState("");
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const channel: Channel | null = data.channel;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [pillarData, competitorData] = await Promise.all([
        requestJson<ContentPillar[]>("/api/strategy/pillars"),
        requestJson<Competitor[]>("/api/strategy/competitors"),
      ]);
      setPillars(pillarData); setCompetitors(competitorData);
    } catch (issue) { setError((issue as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setGenerating(true); setError("");
    try {
      const generated = await requestJson<GeneratedIdea[]>("/api/strategy/ideas", { method: "POST" });
      setIdeas(generated);
      if (generated.length === 0) notify("Chưa đủ dữ liệu để gợi ý. Hãy thêm trụ cột nội dung hoặc kết nối kênh.", true);
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setGenerating(false); }
  }

  function openPillar(pillar: ContentPillar | null = null) {
    setPillarName(pillar?.name || "");
    setPillarDescription(pillar?.description || "");
    setPillarForm(pillar);
  }

  async function savePillar(event: FormEvent) {
    event.preventDefault();
    if (!pillarName.trim()) return;
    setSavingPillar(true);
    try {
      if (pillarForm) {
        const updated = await requestJson<ContentPillar>(`/api/strategy/pillars/${pillarForm.id}`, { method: "PATCH", body: JSON.stringify({ name: pillarName.trim(), description: pillarDescription.trim() }) });
        setPillars(pillars.map((pillar) => pillar.id === updated.id ? updated : pillar));
        notify("Đã cập nhật trụ cột nội dung.");
      } else {
        const created = await requestJson<ContentPillar>("/api/strategy/pillars", { method: "POST", body: JSON.stringify({ name: pillarName.trim(), description: pillarDescription.trim() }) });
        setPillars([created, ...pillars]);
        notify("Đã thêm trụ cột nội dung mới.");
      }
      setPillarForm(undefined);
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setSavingPillar(false); }
  }

  async function removePillar() {
    if (!deletingPillar) return;
    try {
      await requestJson(`/api/strategy/pillars/${deletingPillar.id}`, { method: "DELETE" });
      setPillars(pillars.filter((pillar) => pillar.id !== deletingPillar.id));
      setDeletingPillar(null);
      notify("Đã xóa trụ cột nội dung.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  async function addCompetitor(event: FormEvent) {
    event.preventDefault();
    if (!handle.trim()) return;
    setAddingCompetitor(true);
    try {
      const created = await requestJson<Competitor>("/api/strategy/competitors", { method: "POST", body: JSON.stringify({ handle: handle.trim() }) });
      setCompetitors([created, ...competitors.filter((item) => item.channelId !== created.channelId)]);
      setHandle("");
      notify(`Đã thêm ${created.title} để theo dõi.`);
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setAddingCompetitor(false); }
  }

  async function syncCompetitors() {
    setSyncingCompetitors(true);
    try {
      const fresh = await requestJson<Competitor[]>("/api/strategy/competitors/sync", { method: "POST" });
      setCompetitors(fresh);
      notify("Đã cập nhật số liệu đối thủ.");
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setSyncingCompetitors(false); }
  }

  async function removeCompetitor() {
    if (!deletingCompetitor) return;
    try {
      await requestJson(`/api/strategy/competitors/${deletingCompetitor.id}`, { method: "DELETE" });
      setCompetitors(competitors.filter((item) => item.id !== deletingCompetitor.id));
      setDeletingCompetitor(null);
      notify("Đã ngừng theo dõi đối thủ này.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  async function saveIdea(idea: GeneratedIdea, planned: boolean) {
    try {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      const plan = await requestJson<Plan>("/api/plans", { method: "POST", body: JSON.stringify({ title: idea.title, description: `${idea.hook}\n\nLý do: ${idea.reason}`, format: idea.format, status: planned ? "planned" : "idea", scheduledDate: planned ? date.toISOString().slice(0, 10) : null }) });
      onPlansChange([plan, ...data.plans]);
      notify(planned ? "Đã đưa ý tưởng vào lịch nội dung." : "Đã lưu ý tưởng vào kho ý tưởng.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  return <div className="workspace-view strategy-view">
    <div className="page-heading"><div><div className="eyebrow">PHÁT TRIỂN KÊNH CÓ CHIẾN LƯỢC</div><h1>Ý tưởng & chiến lược<span className="heading-dot">.</span></h1><p>Xây trụ cột nội dung, gợi ý video từ dữ liệu thật và theo dõi đối thủ.</p></div><button className="button button-primary" onClick={() => setTab("pillars")}><Target size={16} />Quản lý trụ cột</button></div>
    {error && <div className="load-error" role="alert"><Info size={18} /><span>{error}</span><button className="text-button" onClick={load}>Thử lại</button></div>}
    <div className="page-tabs studio-tabs" role="tablist" aria-label="Chức năng chiến lược">
      <button role="tab" aria-selected={tab === "ideas"} className={tab === "ideas" ? "active" : ""} onClick={() => setTab("ideas")}><Lightbulb size={16} /> Gợi ý video</button>
      <button role="tab" aria-selected={tab === "pillars"} className={tab === "pillars" ? "active" : ""} onClick={() => setTab("pillars")}><Target size={16} /> Trụ cột nội dung <span className="tab-count">{pillars.length}</span></button>
      <button role="tab" aria-selected={tab === "competitors"} className={tab === "competitors" ? "active" : ""} onClick={() => setTab("competitors")}><Users size={16} /> Đối thủ <span className="tab-count">{competitors.length}</span></button>
    </div>

    {tab === "ideas" && <div className="strategy-ideas">
      <section className="card strategy-generator">
        <div className="strategy-generator-head"><span className="studio-upload-icon"><Sparkles size={22} /></span><div><h2>Gợi ý từ dữ liệu kênh của bạn</h2><p>{channel ? `Dựa trên video hiệu quả nhất của ${channel.title} và ${pillars.length} trụ cột nội dung.` : "Thêm trụ cột nội dung để nhận gợi ý theo chủ đề. Kết nối kênh để gợi ý dựa trên video hiệu quả nhất."}</p></div><button className="button button-primary" onClick={generate} disabled={generating}>{generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}{generating ? "Đang gợi ý…" : ideas.length ? "Gợi ý lại" : "Tạo gợi ý video"}</button></div>
        {!channel && <div className="strategy-connect-note"><Link2 size={15} /><span>Kết nối kênh để gợi ý dựa trên video hiệu quả nhất của bạn.</span><button className="text-button" onClick={() => onNavigate("connections")}>Kết nối kênh <ArrowRight size={13} /></button></div>}
      </section>
      {ideas.length ? <div className="idea-grid strategy-idea-grid">{ideas.map((idea, index) => <article key={`${idea.title}-${index}`} className="idea-card card">
        <div className="idea-card-top"><span className="format-tag"><Film size={13} />{idea.format === "short" ? "YouTube Shorts" : "Video dài"}</span>{idea.pillarId && pillars.find((pillar) => pillar.id === idea.pillarId) && <span className="strategy-pillar-tag">{pillars.find((pillar) => pillar.id === idea.pillarId)?.name}</span>}</div>
        <h3>{idea.title}</h3><p><strong>Mở đầu:</strong> {idea.hook}</p><p className="strategy-idea-reason">{idea.reason}</p>
        <div className="idea-card-footer"><button className="text-button" onClick={() => saveIdea(idea, false)}><Lightbulb size={14} />Lưu ý tưởng</button><button className="text-button" onClick={() => saveIdea(idea, true)}><CalendarDays size={14} />Lên lịch</button></div>
      </article>)}</div> : <div className="empty-state card"><span className="empty-icon"><Lightbulb size={34} /></span><span className="eyebrow">Ý TƯỞNG TỪ DỮ LIỆU THẬT</span><h2>Bắt đầu với một gợi ý</h2><p>TubeFlow sẽ phân tích video hiệu quả nhất và trụ cột nội dung của bạn để đề xuất tiêu đề video tiếp theo.</p><button className="button button-primary" onClick={generate} disabled={generating}>{generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}Tạo gợi ý video</button></div>}
    </div>}

    {tab === "pillars" && <div className="strategy-pillars">
      <div className="strategy-section-head"><div><h2>Trụ cột nội dung</h2><p>Các chủ đề chính kênh của bạn sẽ tập trung phát triển.</p></div><button className="button button-primary" onClick={() => openPillar()}><Plus size={16} />Thêm trụ cột</button></div>
      {loading ? <div className="loading-state card"><Loader2 size={24} className="spin" /><p>Đang tải trụ cột nội dung…</p></div> : pillars.length ? <div className="strategy-pillar-grid">{pillars.map((pillar) => <article key={pillar.id} className="card strategy-pillar-card"><div className="idea-card-top"><span className="format-tag"><Target size={13} />Trụ cột</span><div className="row-actions"><button className="icon-button" aria-label={`Sửa trụ cột ${pillar.name}`} onClick={() => openPillar(pillar)}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label={`Xóa trụ cột ${pillar.name}`} onClick={() => setDeletingPillar(pillar)}><Trash2 size={15} /></button></div></div><h3>{pillar.name}</h3><p>{pillar.description || "Chưa có mô tả. Hãy ghi rõ khán giả nào, vấn đề nào và giá trị kênh mang lại."}</p><small>Tạo ngày {formatDate(pillar.createdAt)}</small></article>)}</div> : <div className="empty-state card"><span className="empty-icon"><Target size={34} /></span><span className="eyebrow">XÂY DỰNG CHỦ ĐỀ CHÍNH</span><h2>Định hình trụ cột nội dung</h2><p>Ví dụ: Mẹo quay phim, Review thiết bị, Hậu trường sáng tạo. Trụ cột rõ ràng giúp gợi ý video sát với kênh của bạn.</p><button className="button button-primary" onClick={() => openPillar()}><Plus size={16} />Thêm trụ cột đầu tiên</button></div>}
    </div>}

    {tab === "competitors" && <div className="strategy-competitors">
      <section className="card strategy-add-competitor">
        <div><h2>Theo dõi đối thủ</h2><p>Nhập handle kênh để xem số người đăng ký, lượt xem và số video mới nhất. Dữ liệu lấy trực tiếp từ YouTube.</p></div>
        <form onSubmit={addCompetitor} className="strategy-competitor-form"><label className="field-label" htmlFor="competitor-handle">Handle kênh đối thủ</label><div className="strategy-competitor-input"><input id="competitor-handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@tenkenh hoặc link kênh" /><button className="button button-primary" type="submit" disabled={addingCompetitor || !channel}>{addingCompetitor ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}Thêm</button></div>{!channel && <p className="field-hint">Cần kết nối kênh của bạn trước để đọc dữ liệu công khai qua API.</p>}</form>
        {competitors.length > 0 && <button className="text-button" onClick={syncCompetitors} disabled={syncingCompetitors}>{syncingCompetitors ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}Đồng bộ số liệu</button>}
      </section>
      {competitors.length ? <div className="strategy-competitor-grid">{competitors.map((competitor) => <article key={competitor.id} className="card strategy-competitor-card"><div className="strategy-competitor-head">{competitor.thumbnail ? <img src={competitor.thumbnail} alt="" /> : <span className="studio-channel-avatar fallback"><Users size={20} /></span>}<div><h3>{competitor.title}</h3><span>{competitor.handle}</span></div><button className="icon-button danger-icon" aria-label={`Ngừng theo dõi ${competitor.title}`} onClick={() => setDeletingCompetitor(competitor)}><Trash2 size={15} /></button></div><div className="strategy-competitor-stats"><span><Users size={14} />{formatNumber(competitor.subscribers)}</span><span><Film size={14} />{formatNumber(competitor.videoCount)} video</span><span><Eye size={14} />{formatNumber(competitor.views)} lượt xem</span></div><div className="strategy-competitor-foot"><span>Cập nhật {formatDate(competitor.lastSyncedAt)}</span><a className="text-button" href={`https://www.youtube.com/${competitor.channelId}`} target="_blank" rel="noreferrer">Xem kênh <ArrowUpRight size={12} /></a></div></article>)}</div> : <div className="empty-state card"><span className="empty-icon"><Users size={34} /></span><span className="eyebrow">HỌC HỎI TỪ ĐỐI THỦ</span><h2>Theo dõi kênh cùng lĩnh vực</h2><p>So sánh quy mô kênh và tìm cảm hứng cho nội dung tiếp theo của bạn.</p></div>}
      {channel && <section className="card strategy-own-card"><h3>Kênh của bạn</h3><div className="strategy-competitor-stats"><span><Users size={14} />{formatNumber(channel.subscribers)} người đăng ký</span><span><Film size={14} />{formatNumber(channel.videoCount)} video</span><span><Eye size={14} />{formatNumber(channel.views)} lượt xem</span></div></section>}
    </div>}

    <Modal open={pillarForm !== undefined} onClose={() => !savingPillar && setPillarForm(undefined)} title={pillarForm ? "Chỉnh sửa trụ cột" : "Thêm trụ cột nội dung"} description="Trụ cột giúp gợi ý video bám sát định hướng kênh.">
      <form onSubmit={savePillar} className="plan-form"><label className="field-label" htmlFor="pillar-name">Tên trụ cột <span className="required">*</span></label><input id="pillar-name" value={pillarName} onChange={(event) => setPillarName(event.target.value)} maxLength={120} placeholder="Ví dụ: Mẹo quay phim bằng điện thoại" required /><label className="field-label" htmlFor="pillar-description">Mô tả</label><textarea id="pillar-description" rows={3} value={pillarDescription} onChange={(event) => setPillarDescription(event.target.value)} maxLength={2000} placeholder="Khán giả nào, vấn đề nào, giá trị kênh mang lại…" /><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setPillarForm(undefined)} disabled={savingPillar}>Hủy</button><button className="button button-primary" type="submit" disabled={savingPillar || !pillarName.trim()}>{savingPillar ? <Loader2 size={15} className="spin" /> : <Check size={16} />}Lưu trụ cột</button></div></form>
    </Modal>
    <Modal open={!!deletingPillar} onClose={() => setDeletingPillar(null)} title="Xóa trụ cột này?" description="Ý tưởng đã lưu trong kho ý tưởng không bị xóa."><p className="modal-body-copy">“{deletingPillar?.name}” sẽ không còn trong chiến lược nội dung của bạn.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeletingPillar(null)}>Giữ lại</button><button className="button button-danger" onClick={removePillar}><Trash2 size={15} />Xóa trụ cột</button></div></Modal>
    <Modal open={!!deletingCompetitor} onClose={() => setDeletingCompetitor(null)} title="Ngừng theo dõi đối thủ?" description="Dữ liệu kênh đối thủ sẽ bị xóa khỏi TubeFlow."><p className="modal-body-copy">Bạn sẽ không còn xem số liệu của “{deletingCompetitor?.title}” trong mục này.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeletingCompetitor(null)}>Giữ lại</button><button className="button button-danger" onClick={removeCompetitor}><Trash2 size={15} />Ngừng theo dõi</button></div></Modal>
  </div>;
}

