import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import type { AdjusterRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas/claim";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: AdjusterRole;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: AdjusterRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdjusterRole;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const adjuster = await prisma.adjuster.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        if (!adjuster || !adjuster.isActive) return null;

        const valid = await compare(parsed.data.password, adjuster.passwordHash);
        if (!valid) return null;

        return {
          id: adjuster.id,
          email: adjuster.email,
          name: adjuster.name,
          role: adjuster.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function canEdit(role: AdjusterRole): boolean {
  return role === "ADMIN" || role === "ADJUSTER";
}

export function canManagePayments(role: AdjusterRole): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: AdjusterRole): boolean {
  return role === "ADMIN";
}
