import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; name: string; role: Role };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  if (!m) return res.status(401).json({ error: "Missing token" });

  try {
    const p = verifyToken(m[1]);
    req.user = { id: Number(p.sub), name: p.name, role: p.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(roles: Role | Role[]) {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!list.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
