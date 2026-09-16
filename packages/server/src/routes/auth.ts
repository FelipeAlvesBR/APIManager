import { Router } from "express";
import { z } from "zod";
import { ApiError } from "@apiplatform/shared";
import { registerUser, authenticateUser, toPublicUser, getUserById } from "../auth/service.js";
import { requireAuth } from "../http/auth.js";
import { asyncHandler } from "../http/error.js";
import { audit } from "../audit/service.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().min(3),
  name: z.string().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authenticateUser(input.email, input.password);
    res.json(result);
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = getUserById(req.user!.id);
    if (!user) throw ApiError.unauthorized();
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    audit(req.user!.id, "auth.logout", "user", undefined, req.user!.id, {});
    res.json({ ok: true });
  }),
);