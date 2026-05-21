import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { User, MessageCircle, Bell, Sliders, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Settings,
});

const sections = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "preferencias", label: "Preferências", icon: Sliders },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

function Settings() {
  const [active, setActive] = useState("perfil");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Configurações" subtitle="Personalize sua experiência no StudioFlow." />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
                active === s.id
                  ? "bg-brand-100 text-brand-600"
                  : "text-brand-900/60 hover:bg-brand-50"
              }`}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          {active === "perfil" && <PerfilSection />}
          {active === "whatsapp" && <WhatsAppSection />}
          {active === "preferencias" && <PreferencesSection />}
          {active === "notificacoes" && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

function PerfilSection() {
  const [name, setName] = useState("Isabel Rocha");
  const [email, setEmail] = useState("mariana@studio.com");
  const [studio, setStudio] = useState("Studio Isabel Lashes");
  const [loading, setLoading] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Perfil atualizado!");
    }, 700);
  };

  return (
    <form onSubmit={save}>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Perfil</h2>
      <p className="mb-8 text-sm text-brand-900/50">Informações do seu estúdio e da sua conta.</p>

      <div className="mb-8 flex items-center gap-5">
        <div className="flex size-20 items-center justify-center rounded-full bg-brand-100 font-serif text-2xl font-semibold text-brand-600">
          MS
        </div>
        <div>
          <button
            type="button"
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-brand-100"
          >
            Alterar foto
          </button>
          <p className="mt-2 text-xs text-brand-900/50">JPG ou PNG, até 2MB.</p>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Nome">
          <Input value={name} onChange={setName} />
        </Field>
        <Field label="Nome do estúdio">
          <Input value={studio} onChange={setStudio} />
        </Field>
        <Field label="E-mail">
          <Input value={email} onChange={setEmail} type="email" />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-8 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500 disabled:opacity-70"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}

function WhatsAppSection() {
  const [connected, setConnected] = useState(true);
  const [number, setNumber] = useState("(11) 99876-5432");

  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Integração WhatsApp</h2>
      <p className="mb-8 text-sm text-brand-900/50">Envie confirmações e lembretes automáticos para suas clientes.</p>

      <div className={`mb-6 flex items-center justify-between rounded-2xl p-5 ${connected ? "bg-emerald-50" : "bg-brand-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex size-10 items-center justify-center rounded-full ${connected ? "bg-emerald-100 text-emerald-700" : "bg-brand-200 text-brand-600"}`}>
            {connected ? <Check className="size-5" /> : <MessageCircle className="size-5" />}
          </div>
          <div>
            <p className="font-semibold">{connected ? "Conectado" : "Não conectado"}</p>
            <p className="text-xs text-brand-900/60">{connected ? number : "Conecte seu WhatsApp"}</p>
          </div>
        </div>
        <button
          onClick={() => {
            setConnected((v) => !v);
            toast.success(connected ? "WhatsApp desconectado" : "WhatsApp conectado!");
          }}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-brand-100"
        >
          {connected ? "Desconectar" : "Conectar"}
        </button>
      </div>

      <Field label="Número do WhatsApp">
        <Input value={number} onChange={setNumber} />
      </Field>

      <div className="mt-6 space-y-3">
        <Toggle label="Enviar confirmação 24h antes" defaultOn />
        <Toggle label="Enviar lembrete 2h antes" defaultOn />
        <Toggle label="Agradecimento após o atendimento" />
      </div>
    </div>
  );
}

function PreferencesSection() {
  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Preferências</h2>
      <p className="mb-8 text-sm text-brand-900/50">Ajuste o funcionamento do StudioFlow.</p>

      <div className="space-y-3">
        <Toggle label="Tema escuro automático" />
        <Toggle label="Mostrar valores na agenda" defaultOn />
        <Toggle label="Bloquear horários de almoço" defaultOn />
        <Toggle label="Permitir agendamentos no domingo" />
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Notificações</h2>
      <p className="mb-8 text-sm text-brand-900/50">Escolha quando quer ser avisada.</p>

      <div className="space-y-3">
        <Toggle label="Novo agendamento" defaultOn />
        <Toggle label="Cancelamento" defaultOn />
        <Toggle label="Confirmação de cliente" defaultOn />
        <Toggle label="Resumo diário por e-mail" />
        <Toggle label="Relatório semanal" defaultOn />
      </div>
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left hover:bg-brand-50"
    >
      <span className="text-sm font-medium">{label}</span>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-brand-500" : "bg-brand-200"}`}>
        <div
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-900/60">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    />
  );
}
