interface ConfirmationPayload {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
}

function formatPhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, "");
  // Garante código do país 55 (Brasil)
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function buildMessage(payload: ConfirmationPayload): string {
  return (
    `Olá, ${payload.clientName}! 👋\n\n` +
    `Seu agendamento foi confirmado! ✅\n\n` +
    `📋 *Serviço:* ${payload.serviceName}\n` +
    `📅 *Data:* ${formatDate(payload.date)}\n` +
    `🕐 *Horário:* ${payload.time}\n\n` +
    `Qualquer dúvida, é só chamar! 💖`
  );
}

export async function sendWhatsAppConfirmation(payload: ConfirmationPayload): Promise<void> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  // RN04: Não enviar se número inválido ou API não configurada
  if (!apiUrl || !apiKey || !instance || !payload.clientPhone) return;

  const phone = formatPhone(payload.clientPhone);
  if (phone.length < 12) return;

  const body = {
    number: phone,
    text: buildMessage(payload),
  };

  const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EvolutionAPI error ${response.status}: ${text}`);
  }
}
