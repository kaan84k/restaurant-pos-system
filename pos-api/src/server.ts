// src/server.ts
import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

// Allow *any* origin while testing (no credentials), and answer all preflights
app.use(cors({
  origin: (_origin, cb) => cb(null, true), // reflect request origin
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
}));
// Fallback for OPTIONS requests
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
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
