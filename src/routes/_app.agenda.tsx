import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, PrimaryButton } from "@/components/AppShell";
import { appointments, clients, services, statusLabels, statusStyles, type Appointment } from "@/lib/mock-data";
import { buildConfirmationMessage, buildWhatsAppLink, getClientPhone } from "@/lib/whatsapp";
import { ChevronLeft, ChevronRight, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/agenda")({
  component: AgendaPage,
});

const hours = Array.from({ length: 11 }, (_, i) => `${String(8 + i).padStart(2, "0")}:00`);

function AgendaPage() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(appointments);
  const [dayOffset, setDayOffset] = useState(0);
  const [waApt, setWaApt] = useState<Appointment | null>(null);

  const date = new Date(Date.now() + dayOffset * 86400000);
  const dateISO = date.toISOString().slice(0, 10);
  const dayApts = items.filter((a) => a.date === dateISO);

  const dateLabel = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Agenda"
        subtitle="Visualize, crie e gerencie seus atendimentos."
        action={<PrimaryButton onClick={() => setOpen(true)}>Novo agendamento</PrimaryButton>}
      />

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDayOffset((v) => v - 1)}
            className="rounded-xl p-2 hover:bg-brand-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-48 text-center">
            <p className="font-serif text-lg font-semibold capitalize">{dateLabel}</p>
            <p className="text-xs text-brand-900/50">{dayApts.length} atendimentos</p>
          </div>
          <button
            onClick={() => setDayOffset((v) => v + 1)}
            className="rounded-xl p-2 hover:bg-brand-100"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          onClick={() => setDayOffset(0)}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-brand-100"
        >
          Hoje
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-2 shadow-sm md:p-4">
        {hours.map((h) => {
          const apt = dayApts.find((a) => a.time.startsWith(h.slice(0, 2)));
          return (
            <div key={h} className="flex gap-4 border-b border-border/60 last:border-b-0">
              <div className="w-16 shrink-0 py-4 text-right">
                <span className="text-xs font-semibold text-brand-900/40">{h}</span>
              </div>
              <div className="flex-1 py-2">
                {apt ? (
                  <div className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-left transition-all hover:border-brand-500 hover:shadow-md">
                    <button
                      onClick={() => toast.info(`${apt.clientName} — ${apt.service}`)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-brand-200 font-serif text-sm font-semibold text-brand-700">
                        {apt.clientInitials}
                      </div>
                      <div>
                        <p className="font-semibold">{apt.clientName}</p>
                        <p className="text-xs text-brand-900/50">
                          {apt.service} • {apt.duration} min
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWaApt(apt)}
                        title="Confirmar via WhatsApp"
                        className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200"
                      >
                        <MessageCircle className="size-4" />
                      </button>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${statusStyles[apt.status]}`}>
                        {statusLabels[apt.status]}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOpen(true)}
                    className="flex h-14 w-full items-center justify-center rounded-2xl border border-dashed border-transparent text-xs text-brand-900/30 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                  >
                    + Adicionar atendimento às {h}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <NewAppointmentModal
          onClose={() => setOpen(false)}
          onSave={(apt) => {
            setItems((prev) => [...prev, apt]);
            setOpen(false);
            toast.success("Agendamento criado!", { description: `${apt.clientName} às ${apt.time}` });
          }}
          defaultDate={dateISO}
        />
      )}

      {waApt && <WhatsAppModal apt={waApt} onClose={() => setWaApt(null)} />}
    </div>
  );
}

function NewAppointmentModal({
  onClose,
  onSave,
  defaultDate,
}: {
  onClose: () => void;
  onSave: (apt: Appointment) => void;
  defaultDate: string;
}) {
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!clientId) errs.client = "Selecione uma cliente";
    if (!serviceId) errs.service = "Selecione um serviço";
    if (!date) errs.date = "Informe a data";
    if (!time) errs.time = "Informe o horário";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setTimeout(() => {
      const client = clients.find((c) => c.id === clientId)!;
      const service = services.find((s) => s.id === serviceId)!;
      onSave({
        id: Math.random().toString(36).slice(2),
        clientName: client.name,
        clientInitials: client.name.split(" ").map((n) => n[0]).slice(0, 2).join(""),
        service: service.name,
        time,
        duration: service.duration,
        date,
        status: "aguardando",
        notes,
      });
      setLoading(false);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-lg animate-float-in rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl md:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Novo agendamento</h2>
            <p className="mt-1 text-sm text-brand-900/50">Preencha os dados abaixo.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-brand-100">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Cliente" error={errors.client}>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Selecione uma cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Serviço" error={errors.service}>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Selecione um serviço</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} • {s.duration}min • R$ {s.price}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" error={errors.date}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
            <Field label="Horário" error={errors.time}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ex: preferências, alergias, indicação..."
              className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-brand-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500 disabled:opacity-70"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-900/60">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

function WhatsAppModal({ apt, onClose }: { apt: Appointment; onClose: () => void }) {
  const phone = getClientPhone(apt);
  const [message, setMessage] = useState(() => buildConfirmationMessage(apt));
  const link = buildWhatsAppLink(phone, message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
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
              <p className="text-sm text-brand-900/50">
                {apt.clientName} {phone ? `• ${phone}` : "• telefone não cadastrado"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-brand-100">
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-900/60">
          Mensagem
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <p className="mt-1 text-xs text-brand-900/50">
          Edite a mensagem antes de enviar. O link abre o WhatsApp já preenchido.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={copy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-brand-100"
          >
            <Copy className="size-4" /> Copiar
          </button>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (!phone) toast.warning("Telefone não cadastrado — abrindo WhatsApp sem destinatário.");
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500"
          >
            <MessageCircle className="size-4" /> Abrir no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
