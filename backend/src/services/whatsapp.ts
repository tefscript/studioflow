import prisma from "../lib/prisma";

interface ConfirmationPayload {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
  userId: string;
}

interface ReminderPayload {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
  userId: string;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

async function getConfig(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  return {
    url: settings?.evolutionUrl || process.env.EVOLUTION_API_URL || "",
    key: settings?.evolutionKey || process.env.EVOLUTION_API_KEY || "",
    instance: settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE || "",
  };
}

async function sendMessage(userId: string, phone: string, text: string): Promise<void> {
  const config = await getConfig(userId);
  if (!config.url || !config.key || !config.instance || !phone) return;

  const formatted = formatPhone(phone);
  if (formatted.length < 12) return;

  const response = await fetch(`${config.url}/message/sendText/${config.instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
    },
    body: JSON.stringify({ number: formatted, text }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`EvolutionAPI error ${response.status}: ${txt}`);
  }
}

export async function sendWhatsAppConfirmation(payload: ConfirmationPayload): Promise<void> {
  const text =
    `Olá, ${payload.clientName}!\n\n` +
    `Seu agendamento foi confirmado.\n\n` +
    `*Serviço:* ${payload.serviceName}\n` +
    `*Data:* ${formatDate(payload.date)}\n` +
    `*Horário:* ${payload.time}\n\n` +
    `Qualquer dúvida, é só chamar!`;

  await sendMessage(payload.userId, payload.clientPhone, text);
}

export async function sendWhatsAppReminder(payload: ReminderPayload): Promise<void> {
  const text =
    `Olá, ${payload.clientName}!\n\n` +
    `Lembrando do seu agendamento *hoje*.\n\n` +
    `*Serviço:* ${payload.serviceName}\n` +
    `*Data:* ${formatDate(payload.date)}\n` +
    `*Horário:* ${payload.time}\n\n` +
    `Te esperamos!`;

  await sendMessage(payload.userId, payload.clientPhone, text);
}
