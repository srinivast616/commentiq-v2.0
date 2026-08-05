import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../middleware/error-handler.middleware";
import { rateLimit } from "../../middleware/rate-limit.middleware";

export const authRouter = Router();
authRouter.use(rateLimit(20, 60_000));

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "7d" });
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = credsSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "invalid_body", parsed.error.errors[0]?.message ?? "Invalid input");

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) throw new ApiError(409, "email_taken", "An account with that email already exists");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: { email: parsed.data.email, passwordHash, name: parsed.data.name },
    });

    res.status(201).json({ token: issueToken(user.id), user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "invalid_body", "email and password are required");

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      throw new ApiError(401, "invalid_credentials", "Incorrect email or password");
    }

    res.json({ token: issueToken(user.id), user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});
