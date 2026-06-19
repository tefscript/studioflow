import cron from "node-cron";
import prisma from "../lib/prisma";
import { sendWhatsAppReminder } from "../services/whatsapp";

function addHours(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + hours * 60;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// Roda a cada minuto, verifica agendamentos que são daqui a 12h
export function startReminderJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const today = getTodayStr();
      const currentTime = getCurrentTimeStr();
      // O horário do agendamento que deve receber lembrete agora = currentTime + 12h
      const targetTime = addHours(currentTime, 12);

      const appointments = await prisma.appointment.findMany({
        where: {
          date: today,
          time: targetTime,
          status: { notIn: ["cancelado"] },
        },
        include: {
          client: { select: { name: true, phone: true } },
          service: { select: { name: true } },
        },
      });

      for (const apt of appointments) {
        sendWhatsAppReminder({
          userId: apt.userId,
          clientName: apt.client.name,
          clientPhone: apt.client.phone,
          serviceName: apt.service.name,
          date: apt.date,
          time: apt.time,
        }).catch(() => {});
      }
    } catch {
      // silencioso — não travar o servidor por falha no cron
    }
  });

  console.log("✅ Cron de lembretes iniciado (12h antes do agendamento)");
}
