// src/server.ts
import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

// CORS + body parsing BEFORE routes
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: "5mb" })); // CSV import safety

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/", routes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found", path: req.path }));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`POS API running on http://localhost:${PORT}`);
});

export default app; // handy for supertest