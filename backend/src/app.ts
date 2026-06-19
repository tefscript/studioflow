import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import serviceRoutes from "./routes/services";
import appointmentRoutes from "./routes/appointments";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import profileRoutes from "./routes/profile";
import whatsappRoutes from "./routes/whatsapp";
import { startReminderJob } from "./jobs/reminderJob";

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/whatsapp", whatsappRoutes);

startReminderJob();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada" });
});

export default app;
