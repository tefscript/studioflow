import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { settingsApi, profileApi, whatsappApi } from "@/lib/api";
import type { Settings, User } from "@/lib/api";
import { User as UserIcon, MessageCircle, Bell, Sliders, Loader2, Check, Wifi, WifiOff, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Settings,
});

const sections = [
  { id: "perfil", label: "Perfil", icon: UserIcon },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "preferencias", label: "Preferências", icon: Sliders },
  { id: "notificacoes", label: "Notificações", icon: Bell },
];

function Settings() {
  const [active, setActive] = useState("perfil");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    settingsApi
      .get()
      .then(setSettings)
      .catch(() => toast.error("Erro ao carregar configurações"))
      .finally(() => setLoadingSettings(false));
  }, []);

  const saveSettings = async (updated: Partial<Settings>) => {
    if (!settings) return;
    const merged = { ...settings, ...updated };
    setSettings(merged);
    try {
      const saved = await settingsApi.update(merged);
      setSettings(saved);
      toast.success("Configurações salvas!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

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
          {loadingSettings ? (
            <div className="flex items-center justify-center py-16 text-brand-900/40">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <>
              {active === "perfil" && <PerfilSection />}
              {active === "whatsapp" && settings && (
                <WhatsAppSection settings={settings} onChange={saveSettings} />
              )}
              {active === "preferencias" && settings && (
                <PreferencesSection settings={settings} onChange={saveSettings} />
              )}
              {active === "notificacoes" && settings && (
                <NotificationsSection settings={settings} onChange={saveSettings} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PerfilSection() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studio, setStudio] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    import("@/lib/api")
      .then(({ authApi }) => authApi.me())
      .then((u) => {
        setUser(u);
        setName(u.name);
        setEmail(u.email);
        setStudio(u.studio_name);
      })
      .catch(() => toast.error("Erro ao carregar perfil"))
      .finally(() => setFetching(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await profileApi.update({
        name,
        email,
        studio_name: studio,
        ...(password ? { password } : {}),
      });
      setUser(updated);
      setPassword("");
      toast.success("Perfil atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-16 text-brand-900/40">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <form onSubmit={save}>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Perfil</h2>
      <p className="mb-8 text-sm text-brand-900/50">Informações do seu estúdio e da sua conta.</p>

      <div className="mb-8 flex items-center gap-5">
        <div className="flex size-20 items-center justify-center rounded-full bg-brand-100 font-serif text-2xl font-semibold text-brand-600">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold">{user?.name}</p>
          <p className="mt-1 text-xs text-brand-900/50">{user?.email}</p>
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
        <Field label="Nova senha (deixe em branco para manter)">
          <Input value={password} onChange={setPassword} type="password" placeholder="••••••••" />
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

function WhatsAppSection({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
}) {
  const [evolutionUrl, setEvolutionUrl] = useState(settings.evolution_url ?? "http://localhost:8080");
  const [evolutionKey, setEvolutionKey] = useState(settings.evolution_key ?? "");
  const [instanceName, setInstanceName] = useState(settings.evolution_instance ?? "studioflow");
  const [status, setStatus] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);

  const isConfigured = !!settings.evolution_instance;

  useEffect(() => {
    if (isConfigured) checkStatus();
  }, [isConfigured]);

  async function checkStatus() {
    setLoadingStatus(true);
    try {
      const s = await whatsappApi.getStatus();
      setStatus(s);
      if (!s.connected && s.configured) fetchQr();
    } catch {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoadingStatus(false);
    }
  }

  async function fetchQr() {
    setLoadingQr(true);
    try {
      const data = await whatsappApi.getQrCode();
      setQrCode(data.base64 ?? null);
    } catch {
      toast.error("Erro ao buscar QR Code");
    } finally {
      setLoadingQr(false);
    }
  }

  async function connect() {
    if (!evolutionUrl || !evolutionKey || !instanceName) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoadingConnect(true);
    try {
      await whatsappApi.createInstance({
        instance_name: instanceName,
        evolution_url: evolutionUrl,
        evolution_key: evolutionKey,
      });
      onChange({ evolution_url: evolutionUrl, evolution_key: evolutionKey, evolution_instance: instanceName });
      toast.success("Instância criada! Aguardando conexão...");
      await checkStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setLoadingConnect(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp?")) return;
    setLoadingDisconnect(true);
    try {
      await whatsappApi.deleteInstance();
      onChange({ evolution_url: null, evolution_key: null, evolution_instance: null });
      setStatus(null);
      setQrCode(null);
      toast.success("WhatsApp desconectado");
    } catch {
      toast.error("Erro ao desconectar");
    } finally {
      setLoadingDisconnect(false);
    }
  }

  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Integração WhatsApp</h2>
      <p className="mb-8 text-sm text-brand-900/50">
        Envie confirmações e lembretes automáticos para suas clientes via WhatsApp.
      </p>

      {/* Status badge */}
      <div className={`mb-6 flex items-center justify-between rounded-2xl p-4 ${status?.connected ? "bg-emerald-50" : "bg-brand-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex size-9 items-center justify-center rounded-full ${status?.connected ? "bg-emerald-100 text-emerald-700" : "bg-brand-200 text-brand-600"}`}>
            {status?.connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {status?.connected ? "Conectado" : isConfigured ? "Desconectado — escaneie o QR Code" : "Não configurado"}
            </p>
            {settings.evolution_instance && (
              <p className="text-xs text-brand-900/50">Instância: {settings.evolution_instance}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isConfigured && (
            <>
              <button onClick={checkStatus} disabled={loadingStatus} className="rounded-lg p-2 hover:bg-brand-100 disabled:opacity-50" title="Verificar status">
                <RefreshCw className={`size-4 ${loadingStatus ? "animate-spin" : ""}`} />
              </button>
              <button onClick={disconnect} disabled={loadingDisconnect} className="rounded-lg p-2 text-destructive hover:bg-rose-50 disabled:opacity-50" title="Desconectar">
                {loadingDisconnect ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* QR Code */}
      {isConfigured && !status?.connected && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-6">
          {loadingQr ? (
            <Loader2 className="size-8 animate-spin text-brand-900/40" />
          ) : qrCode ? (
            <>
              <p className="text-sm font-medium">Escaneie com o WhatsApp</p>
              <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="size-52 rounded-xl" />
              <button onClick={fetchQr} className="text-xs text-brand-600 underline">Atualizar QR Code</button>
            </>
          ) : (
            <button onClick={fetchQr} className="text-sm text-brand-600 underline">Buscar QR Code</button>
          )}
        </div>
      )}

      {/* Formulário de configuração */}
      {!isConfigured && (
        <div className="mb-6 space-y-4 rounded-2xl border border-border p-5">
          <p className="text-sm font-semibold">Configurar EvolutionAPI</p>
          <Field label="URL da EvolutionAPI">
            <Input value={evolutionUrl} onChange={setEvolutionUrl} placeholder="http://localhost:8080" />
          </Field>
          <Field label="Chave da API (apikey)">
            <Input value={evolutionKey} onChange={setEvolutionKey} placeholder="minha-chave-evolution" />
          </Field>
          <Field label="Nome da instância">
            <Input value={instanceName} onChange={setInstanceName} placeholder="studioflow" />
          </Field>
          <button
            onClick={connect}
            disabled={loadingConnect}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500 disabled:opacity-70"
          >
            {loadingConnect ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {loadingConnect ? "Conectando..." : "Conectar WhatsApp"}
          </button>
        </div>
      )}

      {/* Toggles de quando enviar */}
      {status?.connected && (
        <div className="space-y-3">
          <p className="mb-3 text-sm font-semibold text-brand-900/70">Quando enviar mensagens</p>
          <Toggle
            label="Confirmação ao criar agendamento"
            value={!!settings.wa_confirm_24h}
            onChange={(v) => onChange({ wa_confirm_24h: v ? 1 : 0 })}
          />
          <Toggle
            label="Lembrete 12h antes do agendamento"
            value={!!settings.wa_reminder_2h}
            onChange={(v) => onChange({ wa_reminder_2h: v ? 1 : 0 })}
          />
          <Toggle
            label="Agradecimento após o atendimento"
            value={!!settings.wa_thanks}
            onChange={(v) => onChange({ wa_thanks: v ? 1 : 0 })}
          />
        </div>
      )}
    </div>
  );
}

function PreferencesSection({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Preferências</h2>
      <p className="mb-8 text-sm text-brand-900/50">Ajuste o funcionamento do StudioFlow.</p>

      <div className="space-y-3">
        <Toggle
          label="Tema escuro automático"
          value={!!settings.pref_dark_auto}
          onChange={(v) => onChange({ pref_dark_auto: v ? 1 : 0 })}
        />
        <Toggle
          label="Mostrar valores na agenda"
          value={!!settings.pref_show_values}
          onChange={(v) => onChange({ pref_show_values: v ? 1 : 0 })}
        />
        <Toggle
          label="Bloquear horários de almoço"
          value={!!settings.pref_block_lunch}
          onChange={(v) => onChange({ pref_block_lunch: v ? 1 : 0 })}
        />
        <Toggle
          label="Permitir agendamentos no domingo"
          value={!!settings.pref_allow_sunday}
          onChange={(v) => onChange({ pref_allow_sunday: v ? 1 : 0 })}
        />
      </div>
    </div>
  );
}

function NotificationsSection({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 font-serif text-2xl font-semibold">Notificações</h2>
      <p className="mb-8 text-sm text-brand-900/50">Escolha quando quer ser avisada.</p>

      <div className="space-y-3">
        <Toggle
          label="Novo agendamento"
          value={!!settings.notify_new}
          onChange={(v) => onChange({ notify_new: v ? 1 : 0 })}
        />
        <Toggle
          label="Cancelamento"
          value={!!settings.notify_cancel}
          onChange={(v) => onChange({ notify_cancel: v ? 1 : 0 })}
        />
        <Toggle
          label="Confirmação de cliente"
          value={!!settings.notify_confirm}
          onChange={(v) => onChange({ notify_confirm: v ? 1 : 0 })}
        />
        <Toggle
          label="Resumo diário por e-mail"
          value={!!settings.notify_daily_email}
          onChange={(v) => onChange({ notify_daily_email: v ? 1 : 0 })}
        />
        <Toggle
          label="Relatório semanal"
          value={!!settings.notify_weekly}
          onChange={(v) => onChange({ notify_weekly: v ? 1 : 0 })}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left hover:bg-brand-50"
    >
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-brand-500" : "bg-brand-200"}`}
      >
        <div
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
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
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    />
  );
}
