import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();
router.use(requireAuth);

async function getEvolutionConfig(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  return {
    url: settings?.evolutionUrl || process.env.EVOLUTION_API_URL || "",
    key: settings?.evolutionKey || process.env.EVOLUTION_API_KEY || "",
    instance: settings?.evolutionInstance || process.env.EVOLUTION_INSTANCE || "",
  };
}

// POST /api/whatsapp/instance — cria instância na EvolutionAPI
router.post("/instance", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { instance_name, evolution_url, evolution_key } = req.body;

    if (!evolution_url || !evolution_key || !instance_name) {
      return res.status(400).json({ error: "URL, chave e nome da instância são obrigatórios" });
    }

    const response = await fetch(`${evolution_url}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolution_key,
      },
      body: JSON.stringify({
        instanceName: instance_name,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // salva config no banco
    await prisma.settings.upsert({
      where: { userId },
      create: {
        userId,
        evolutionUrl: evolution_url,
        evolutionKey: evolution_key,
        evolutionInstance: instance_name,
      },
      update: {
        evolutionUrl: evolution_url,
        evolutionKey: evolution_key,
        evolutionInstance: instance_name,
      },
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao criar instância" });
  }
});

// GET /api/whatsapp/qrcode — busca QR code da instância
router.get("/qrcode", async (req: AuthRequest, res) => {
  try {
    const config = await getEvolutionConfig(req.userId!);
    if (!config.url || !config.key || !config.instance) {
      return res.status(400).json({ error: "WhatsApp não configurado" });
    }

    const response = await fetch(`${config.url}/instance/connect/${config.instance}`, {
      headers: { apikey: config.key },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Erro ao buscar QR code" });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Erro ao buscar QR code" });
  }
});

// GET /api/whatsapp/status — verifica se está conectado
router.get("/status", async (req: AuthRequest, res) => {
  try {
    const config = await getEvolutionConfig(req.userId!);
    if (!config.url || !config.key || !config.instance) {
      return res.json({ connected: false, configured: false });
    }

    const response = await fetch(
      `${config.url}/instance/connectionState/${config.instance}`,
      { headers: { apikey: config.key } }
    );

    if (!response.ok) {
      return res.json({ connected: false, configured: true });
    }

    const data = (await response.json()) as { instance?: { state?: string } };
    const connected = data?.instance?.state === "open";
    return res.json({ connected, configured: true, state: data?.instance?.state });
  } catch {
    return res.json({ connected: false, configured: true });
  }
});

// DELETE /api/whatsapp/instance — desconecta e remove instância
router.delete("/instance", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const config = await getEvolutionConfig(userId);

    if (config.url && config.key && config.instance) {
      await fetch(`${config.url}/instance/delete/${config.instance}`, {
        method: "DELETE",
        headers: { apikey: config.key },
      }).catch(() => {});
    }

    await prisma.settings.update({
      where: { userId },
      data: { evolutionUrl: null, evolutionKey: null, evolutionInstance: null },
    });

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Erro ao desconectar" });
  }
});

export default router;
