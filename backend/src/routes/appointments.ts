import { Router, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { sendWhatsAppConfirmation } from "../services/whatsapp";

const router = Router();
router.use(requireAuth);

const appointmentSchema = z.object({
  client_id: z.string().min(1),
  service_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)"),
  notes: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(["confirmado", "aguardando", "concluido", "cancelado"]),
});

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    client: { select: { name: true; phone: true } };
    service: { select: { name: true; price: true } };
  };
}>;

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatAppointment(apt: AppointmentWithRelations) {
  return {
    id: apt.id,
    client_id: apt.clientId,
    service_id: apt.serviceId,
    date: apt.date,
    time: apt.time,
    duration: apt.duration,
    status: apt.status,
    notes: apt.notes,
    createdAt: apt.createdAt,
    updatedAt: apt.updatedAt,
    client_name: apt.client.name,
    client_phone: apt.client.phone,
    clientInitials: buildInitials(apt.client.name),
    service_name: apt.service.name,
    service_price: Number(apt.service.price),
  };
}

const includeRelations = {
  client: { select: { name: true, phone: true } },
  service: { select: { name: true, price: true } },
} as const;

router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const dateFilter = req.query.date as string | undefined;
  const statusFilter = req.query.status as string | undefined;

  const appointments = await prisma.appointment.findMany({
    where: {
      userId: req.userId!,
      ...(dateFilter ? { date: dateFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: includeRelations,
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  res.json(appointments.map(formatAppointment));
});

router.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const apt = await prisma.appointment.findFirst({
    where: { id, userId: req.userId! },
    include: includeRelations,
  });
  if (!apt) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }
  res.json(formatAppointment(apt));
});

router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const parse = appointmentSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const { client_id, service_id, date, time, notes } = parse.data;

  const [client, service] = await Promise.all([
    prisma.client.findFirst({ where: { id: client_id, userId: req.userId! } }),
    prisma.service.findFirst({ where: { id: service_id, userId: req.userId! } }),
  ]);

  if (!client) {
    res.status(404).json({ error: "Cliente não encontrada" });
    return;
  }
  if (!service) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }

  // RN03: Verificar conflito de horário
  const conflict = await prisma.appointment.findFirst({
    where: {
      userId: req.userId!,
      date,
      time,
      status: { notIn: ["cancelado"] },
    },
  });
  if (conflict) {
    res.status(409).json({ error: "Já existe um agendamento neste horário" });
    return;
  }

  const apt = await prisma.appointment.create({
    data: {
      userId: req.userId!,
      clientId: client_id,
      serviceId: service_id,
      date,
      time,
      duration: service.duration,
      status: "aguardando",
      notes: notes || null,
    },
    include: includeRelations,
  });

  // Atualizar contador de visitas do cliente
  await prisma.client.update({
    where: { id: client_id },
    data: { visits: { increment: 1 }, lastVisit: date },
  });

  // Enviar confirmação via WhatsApp (não bloqueia a resposta)
  sendWhatsAppConfirmation({
    userId: req.userId!,
    clientName: client.name,
    clientPhone: client.phone,
    serviceName: service.name,
    date,
    time,
  }).catch(() => {});

  res.status(201).json(formatAppointment(apt));
});

router.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.appointment.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }

  const parse = appointmentSchema.partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0].message });
    return;
  }

  const data = parse.data;

  // Verificar conflito se data/hora mudou
  const newDate = data.date ?? existing.date;
  const newTime = data.time ?? existing.time;
  if (newDate !== existing.date || newTime !== existing.time) {
    const conflict = await prisma.appointment.findFirst({
      where: {
        userId: req.userId!,
        date: newDate,
        time: newTime,
        status: { notIn: ["cancelado"] },
        id: { not: id },
      },
    });
    if (conflict) {
      res.status(409).json({ error: "Já existe um agendamento neste horário" });
      return;
    }
  }

  // Se serviço mudou, buscar nova duração
  let duration = existing.duration;
  if (data.service_id && data.service_id !== existing.serviceId) {
    const svc = await prisma.service.findFirst({
      where: { id: data.service_id, userId: req.userId! },
    });
    if (!svc) {
      res.status(404).json({ error: "Serviço não encontrado" });
      return;
    }
    duration = svc.duration;
  }

  const apt = await prisma.appointment.update({
    where: { id },
    data: {
      ...(data.client_id ? { clientId: data.client_id } : {}),
      ...(data.service_id ? { serviceId: data.service_id } : {}),
      ...(data.date ? { date: data.date } : {}),
      ...(data.time ? { time: data.time } : {}),
      duration,
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
    include: includeRelations,
  });

  res.json(formatAppointment(apt));
});

router.patch("/:id/status", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const parse = statusSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Status inválido" });
    return;
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }

  const apt = await prisma.appointment.update({
    where: { id },
    data: { status: parse.data.status },
    include: includeRelations,
  });

  res.json(formatAppointment(apt));
});

router.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const existing = await prisma.appointment.findFirst({
    where: { id, userId: req.userId! },
  });
  if (!existing) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }

  await prisma.appointment.delete({ where: { id } });
  res.json({ message: "Agendamento removido" });
});

export default router;
