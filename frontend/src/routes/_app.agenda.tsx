import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader, PrimaryButton } from "@/components/AppShell";
import { statusLabels, statusStyles } from "@/lib/mock-data";
import { appointmentsApi, clientsApi, servicesApi } from "@/lib/api";
import type { Appointment, Client, Service } from "@/lib/api";
import { buildConfirmationMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import { ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaPage,
});

// ── constants ──────────────────────────────────────────────
type ViewMode = "day" | "week" | "month";
const HOUR_H = 72; // px per hour slot
const START_H = 8;
const END_H = 19;
const HOURS = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
const TOTAL_H = HOURS.length * HOUR_H;
const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── helpers ────────────────────────────────────────────────
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function aptTop(time: string) {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_H) + m / 60) * HOUR_H;
}

function aptHeight(duration: number) {
  return Math.max((duration / 60) * HOUR_H, 28);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  return addDays(d, -(day === 0 ? 6 : day - 1));
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isToday(d: Date) {
  return toISO(d) === toISO(new Date());
}

// ── main page ──────────────────────────────────────────────
function AgendaPage() {
  const [view, setView] = useState<ViewMode>("day");
  const [baseDate, setBaseDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [waApt, setWaApt] = useState<Appointment | null>(null);
  const [newAptSaved, setNewAptSaved] = useState(0);

  function navigate(dir: -1 | 1) {
    if (view === "day") setBaseDate((d) => addDays(d, dir));
    else if (view === "week") setBaseDate((d) => addDays(d, dir * 7));
    else setBaseDate((d) => {
      const r = new Date(d);
      r.setMonth(r.getMonth() + dir);
      return r;
    });
  }

  function openNew(time?: string) {
    setDefaultTime(time);
    setModalOpen(true);
  }

  const navLabel =
    view === "day"
      ? baseDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
      : view === "week"
      ? (() => {
          const mon = startOfWeek(baseDate);
          const sun = addDays(mon, 6);
          return `${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${sun.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
        })()
      : `${MONTH_NAMES[baseDate.getMonth()]} ${baseDate.getFullYear()}`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Agenda"
        subtitle="Visualize, crie e gerencie seus atendimentos."
        action={<PrimaryButton onClick={() => openNew()}>Novo agendamento</PrimaryButton>}
      />

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* View tabs */}
        <div className="flex gap-1 rounded-xl bg-brand-100 p-1 w-fit">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
                view === v ? "bg-white shadow text-brand-700" : "text-brand-900/50 hover:text-brand-700"
              )}
            >
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl p-2 hover:bg-brand-100">
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-52 text-center font-serif text-base font-semibold capitalize">{navLabel}</p>
          <button onClick={() => navigate(1)} className="rounded-xl p-2 hover:bg-brand-100">
            <ChevronRight className="size-4" />
          </button>
          <button
            onClick={() => setBaseDate(new Date())}
            className="rounded-xl border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:bg-brand-100"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Views */}
      {view === "day" && (
        <DayView
          date={baseDate}
          refreshKey={newAptSaved}
          onNewAt={openNew}
          onWA={setWaApt}
        />
      )}
      {view === "week" && (
        <WeekView
          baseDate={baseDate}
          refreshKey={newAptSaved}
          onNewAt={openNew}
          onWA={setWaApt}
          onDayClick={(d) => { setBaseDate(d); setView("day"); }}
        />
      )}
      {view === "month" && (
        <MonthView
          baseDate={baseDate}
          onDayClick={(d) => { setBaseDate(d); setView("day"); }}
        />
      )}

      {modalOpen && (
        <NewAppointmentModal
          onClose={() => setModalOpen(false)}
          defaultDate={toISO(baseDate)}
          defaultTime={defaultTime}
          onSave={(apt) => {
            setModalOpen(false);
            setNewAptSaved((n) => n + 1);
            toast.success("Agendamento criado!", { description: `${apt.client_name} às ${apt.time}` });
          }}
        />
      )}

      {waApt && <WhatsAppModal apt={waApt} onClose={() => setWaApt(null)} />}
    </div>
  );
}

// ── day view ───────────────────────────────────────────────
function DayView({
  date,
  refreshKey,
  onNewAt,
  onWA,
}: {
  date: Date;
  refreshKey: number;
  onNewAt: (time?: string) => void;
  onWA: (apt: Appointment) => void;
}) {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    appointmentsApi
      .list({ date: toISO(date) })
      .then(setItems)
      .catch(() => toast.error("Erro ao carregar agendamentos"))
      .finally(() => setLoading(false));
  }, [toISO(date), refreshKey]);

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      {loading ? (
        <div className="flex items-center justify-center py-20 text-brand-900/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <TimeGrid
          appointments={items}
          onNewAt={onNewAt}
          onWA={onWA}
          onUpdate={(updated) => setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
        />
      )}
    </div>
  );
}

// ── week view ──────────────────────────────────────────────
function WeekView({
  baseDate,
  refreshKey,
  onNewAt,
  onWA,
  onDayClick,
}: {
  baseDate: Date;
  refreshKey: number;
  onNewAt: (time?: string) => void;
  onWA: (apt: Appointment) => void;
  onDayClick: (d: Date) => void;
}) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(baseDate), i));
  const [aptsByDay, setAptsByDay] = useState<Record<string, Appointment[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all(weekDays.map((d) => appointmentsApi.list({ date: toISO(d) }).then((apts) => ({ date: toISO(d), apts }))))
      .then((results) => {
        const map: Record<string, Appointment[]> = {};
        results.forEach(({ date, apts }) => { map[date] = apts; });
        setAptsByDay(map);
      })
      .catch(() => toast.error("Erro ao carregar semana"))
      .finally(() => setLoading(false));
  }, [toISO(startOfWeek(baseDate)), refreshKey]);

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden overflow-x-auto">
      {loading ? (
        <div className="flex items-center justify-center py-20 text-brand-900/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="min-w-[700px]">
          {/* Header row */}
          <div className="flex border-b border-border">
            <div className="w-14 shrink-0" />
            {weekDays.map((d, i) => (
              <button
                key={i}
                onClick={() => onDayClick(d)}
                className={cn(
                  "flex-1 py-3 text-center text-xs font-semibold border-l border-border hover:bg-brand-50 transition-colors",
                  isToday(d) ? "text-brand-600 bg-brand-50" : "text-brand-900/60"
                )}
              >
                <span className="block uppercase tracking-wider">{WEEK_LABELS[i]}</span>
                <span className={cn(
                  "mt-1 inline-flex size-6 items-center justify-center rounded-full font-serif text-sm",
                  isToday(d) ? "bg-brand-500 text-white" : ""
                )}>
                  {d.getDate()}
                </span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex">
            {/* Time labels */}
            <div className="w-14 shrink-0 relative" style={{ height: TOTAL_H }}>
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  style={{ position: "absolute", top: i * HOUR_H }}
                  className="right-2 left-0 flex justify-end pr-2 -translate-y-2.5"
                >
                  <span className="text-[10px] font-semibold text-brand-900/40">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((d, i) => {
              const dayApts = aptsByDay[toISO(d)] ?? [];
              return (
                <div
                  key={i}
                  className="flex-1 relative border-l border-border"
                  style={{ height: TOTAL_H }}
                >
                  {/* Hour lines */}
                  {HOURS.map((_, hi) => (
                    <div
                      key={hi}
                      style={{ position: "absolute", top: hi * HOUR_H, left: 0, right: 0 }}
                      className="border-t border-border/40"
                    />
                  ))}
                  {/* Appointments */}
                  {dayApts.map((apt) => (
                    <div
                      key={apt.id}
                      style={{
                        position: "absolute",
                        top: aptTop(apt.time),
                        left: 2,
                        right: 2,
                        height: aptHeight(apt.duration),
                      }}
                      className="overflow-hidden rounded-lg bg-brand-100 border border-brand-300 px-1.5 py-1 cursor-pointer hover:bg-brand-200 transition-colors"
                      onClick={() => onWA(apt)}
                      title={`${apt.client_name} — ${apt.service_name}`}
                    >
                      <p className="truncate text-[10px] font-bold text-brand-700">{apt.time} {apt.client_name}</p>
                      <p className="truncate text-[9px] text-brand-600/70">{apt.service_name}</p>
                    </div>
                  ))}
                  {/* Click to add */}
                  {dayApts.length === 0 && (
                    <div
                      className="absolute inset-0 flex items-center justify-center cursor-pointer text-[10px] text-brand-900/20 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      onClick={() => { onDayClick(d); onNewAt(); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── month view ─────────────────────────────────────────────
function MonthView({ baseDate, onDayClick }: { baseDate: Date; onDayClick: (d: Date) => void }) {
  const cells = getMonthGrid(baseDate.getFullYear(), baseDate.getMonth());
  const todayISO = toISO(new Date());

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_LABELS.map((l) => (
          <div key={l} className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-brand-900/40">
            {l}
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const isT = d ? toISO(d) === todayISO : false;
          const isCurMonth = d ? d.getMonth() === baseDate.getMonth() : false;
          return (
            <div
              key={i}
              onClick={() => d && onDayClick(d)}
              className={cn(
                "min-h-[72px] border-b border-r border-border p-2 transition-colors",
                d ? "cursor-pointer hover:bg-brand-50" : "bg-background/40",
                !isCurMonth && d ? "opacity-30" : ""
              )}
            >
              {d && (
                <span className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full font-serif text-sm font-semibold",
                  isT ? "bg-brand-500 text-white" : "text-brand-900/70"
                )}>
                  {d.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── time grid (shared by day view) ─────────────────────────
function TimeGrid({
  appointments,
  onNewAt,
  onWA,
  onUpdate,
}: {
  appointments: Appointment[];
  onNewAt: (time?: string) => void;
  onWA: (apt: Appointment) => void;
  onUpdate: (apt: Appointment) => void;
}) {
  return (
    <div className="flex">
      {/* Time labels */}
      <div className="w-16 shrink-0 border-r border-border relative" style={{ height: TOTAL_H }}>
        {HOURS.map((h, i) => (
          <div
            key={h}
            style={{ position: "absolute", top: i * HOUR_H }}
            className="right-0 left-0 flex justify-end pr-3 -translate-y-2.5"
          >
            <span className="text-xs font-semibold text-brand-900/40">{String(h).padStart(2, "0")}:00</span>
          </div>
        ))}
      </div>

      {/* Appointment area */}
      <div className="flex-1 relative" style={{ height: TOTAL_H }}>
        {/* Hour lines + click areas */}
        {HOURS.map((h, i) => {
          const hStr = `${String(h).padStart(2, "0")}:00`;
          return (
            <div
              key={h}
              style={{ position: "absolute", top: i * HOUR_H, left: 0, right: 0, height: HOUR_H }}
              className="border-t border-border/60 group cursor-pointer hover:bg-brand-50 transition-colors"
              onClick={() => onNewAt(hStr)}
            >
              <span className="invisible absolute left-4 top-1/2 -translate-y-1/2 text-xs text-brand-600 group-hover:visible">
                + {hStr}
              </span>
            </div>
          );
        })}

        {/* Appointment blocks */}
        {appointments.map((apt) => (
          <AptBlock key={apt.id} apt={apt} onWA={onWA} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}

// ── appointment block ──────────────────────────────────────
function AptBlock({
  apt,
  onWA,
  onUpdate,
}: {
  apt: Appointment;
  onWA: (apt: Appointment) => void;
  onUpdate: (apt: Appointment) => void;
}) {
  const top = aptTop(apt.time);
  const height = aptHeight(apt.duration);
  const compact = height < 56;

  return (
    <div
      style={{ position: "absolute", top, left: 8, right: 8, height }}
      className="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50 shadow-sm hover:shadow-md hover:border-brand-400 transition-all z-10"
    >
      <div className="flex h-full items-start justify-between gap-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            "shrink-0 flex items-center justify-center rounded-full bg-brand-200 font-serif font-semibold text-brand-700",
            compact ? "size-7 text-xs" : "size-10 text-sm"
          )}>
            {apt.clientInitials}
          </div>
          <div className="min-w-0">
            <p className={cn("font-semibold truncate", compact ? "text-xs" : "text-sm")}>{apt.client_name}</p>
            {!compact && (
              <p className="truncate text-xs text-brand-900/50">{apt.service_name} • {apt.duration} min</p>
            )}
          </div>
        </div>
        <div className={cn("flex shrink-0 items-center gap-2", compact ? "flex-row" : "flex-col items-end")}>
          <button
            onClick={(e) => { e.stopPropagation(); onWA(apt); }}
            className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
          >
            <MessageCircle className="size-3.5" />
          </button>
          <select
            value={apt.status}
            onClick={(e) => e.stopPropagation()}
            onChange={async (e) => {
              try {
                const updated = await appointmentsApi.setStatus(apt.id, e.target.value as Appointment["status"]);
                onUpdate(updated);
                toast.success("Status atualizado!");
              } catch {
                toast.error("Erro ao atualizar status");
              }
            }}
            className={`rounded-full border-0 px-2 py-0.5 text-[9px] font-bold uppercase cursor-pointer ${statusStyles[apt.status]}`}
          >
            {(["confirmado", "aguardando", "concluido", "cancelado"] as const).map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── new appointment modal ──────────────────────────────────
function NewAppointmentModal({
  onClose,
  onSave,
  defaultDate,
  defaultTime,
}: {
  onClose: () => void;
  onSave: (apt: Appointment) => void;
  defaultDate: string;
  defaultTime?: string;
}) {
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => toast.error("Erro ao carregar clientes"));
    servicesApi.list().then(setServices).catch(() => toast.error("Erro ao carregar serviços"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!clientId) errs.client = "Selecione uma cliente";
    if (!serviceId) errs.service = "Selecione um serviço";
    if (!date) errs.date = "Informe a data";
    if (!time) errs.time = "Informe o horário";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      const apt = await appointmentsApi.create({ client_id: clientId, service_id: serviceId, date, time, notes });
      onSave(apt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar agendamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-lg animate-float-in rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl md:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Novo agendamento</h2>
            <p className="mt-1 text-sm text-brand-900/50">Preencha os dados abaixo.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-brand-100"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente" error={errors.client}>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
              <option value="">Selecione uma cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Serviço" error={errors.service}>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
              <option value="">Selecione um serviço</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} • {s.duration}min • R$ {s.price}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" error={errors.date}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </Field>
            <Field label="Horário" error={errors.time}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Ex: preferências, alergias, indicação..."
              className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-brand-100">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500 disabled:opacity-70">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── field ──────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-900/60">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

// ── whatsapp modal ─────────────────────────────────────────
function WhatsAppModal({ apt, onClose }: { apt: Appointment; onClose: () => void }) {
  const phone = apt.client_phone;
  const [message, setMessage] = useState(() =>
    buildConfirmationMessage({
      id: apt.id, clientName: apt.client_name, clientInitials: apt.clientInitials,
      service: apt.service_name, time: apt.time, duration: apt.duration,
      date: apt.date, status: apt.status, notes: apt.notes,
    })
  );
  const link = buildWhatsAppLink(phone, message);

  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast.success("Mensagem copiada!"); }
    catch { toast.error("Não foi possível copiar."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-lg animate-float-in rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl md:p-8">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold">Confirmar via WhatsApp</h2>
              <p className="text-sm text-brand-900/50">{apt.client_name} {phone ? `• ${phone}` : "• telefone não cadastrado"}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-brand-100"><X className="size-4" /></button>
        </div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-900/60">Mensagem</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={10}
          className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
        <p className="mt-1 text-xs text-brand-900/50">Edite a mensagem antes de enviar. O link abre o WhatsApp já preenchido.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={copy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-brand-100">
            <Copy className="size-4" /> Copiar
          </button>
          <a href={link} target="_blank" rel="noreferrer"
            onClick={() => { if (!phone) toast.warning("Telefone não cadastrado — abrindo WhatsApp sem destinatário."); }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500">
            <MessageCircle className="size-4" /> Abrir no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
