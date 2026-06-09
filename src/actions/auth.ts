"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
  message?: string;
};

const SignupSchema = z.object({
  name: z.string().min(1, { error: "이름을 입력해주세요" }),
  email: z.email({ error: "올바른 이메일을 입력해주세요" }),
  password: z
    .string()
    .min(8, { error: "비밀번호는 8자 이상이어야 합니다" })
    .regex(/[A-Za-z]/, { error: "영문자를 포함해야 합니다" })
    .regex(/[0-9]/, { error: "숫자를 포함해야 합니다" }),
});

const LoginSchema = z.object({
  email: z.email({ error: "올바른 이메일을 입력해주세요" }),
  password: z.string().min(1, { error: "비밀번호를 입력해주세요" }),
});

export async function signup(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["이미 사용 중인 이메일입니다"] } };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: { name, email, hashedPassword },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function login(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.hashedPassword) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
  if (!passwordMatch) {
    return { message: "이메일 또는 비밀번호가 올바르지 않습니다" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
