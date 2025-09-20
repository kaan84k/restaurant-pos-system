import jwt, { JwtPayload } from "jsonwebtoken";

// Keep it simple: local Role type (matches your Prisma enum values)
export type Role = "CASHIER" | "MANAGER" | "ADMIN";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES = "7d";

export function signUser(u: { id: number; name: string; role: Role }) {
  // JWT 'sub' should be a string per spec
  return jwt.sign(
    { sub: String(u.id), name: u.name, role: u.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export type UserJwtPayload = JwtPayload & {
  sub: string; // per JwtPayload it's string|undefined; we assert string after checks
  name: string;
  role: Role;
};

export function verifyToken(token: string): UserJwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded !== "object" || !decoded) {
    throw new Error("Invalid token payload");
  }

  const { sub, name, role } = decoded as JwtPayload & {
    sub?: string;
    name?: unknown;
    role?: unknown;
  };

  if (typeof sub !== "string") throw new Error("Invalid token: sub");
  if (typeof name !== "string") throw new Error("Invalid token: name");
  if (role !== "CASHIER" && role !== "MANAGER" && role !== "ADMIN") {
    throw new Error("Invalid token: role");
  }

  // Return a normalized payload typed as UserJwtPayload
  return { ...(decoded as JwtPayload), sub, name, role };
}
