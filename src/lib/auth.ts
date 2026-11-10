import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdjusterRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/schemas/claim";
import { LoginError, LOGIN_ERRORS, verifyLogin } from "@/lib/security/login-guard";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: AdjusterRole;
      mustChangePassword: boolean;
      mfaEnabled: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: AdjusterRole;
    sessionVersion: number;
    mustChangePassword: boolean;
    mfaEnabled: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AdjusterRole;
    sessionVersion?: number;
    mustChangePassword?: boolean;
    mfaEnabled?: boolean;
    revoked?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // Absolute session ceiling; idle logout is enforced client-side at 5 minutes
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new Error(LOGIN_ERRORS.invalid);

        try {
          const adjuster = await verifyLogin({
            email: parsed.data.email,
            password: parsed.data.password,
            otp: credentials?.otp || null,
            app: "BLACKBOX",
            req,
          });
          return {
            id: adjuster.id,
            email: adjuster.email,
            name: adjuster.name,
            role: adjuster.role,
            sessionVersion: adjuster.sessionVersion,
            mustChangePassword: adjuster.mustChangePassword,
            mfaEnabled: !!adjuster.mfaEnabledAt,
          };
        } catch (e) {
          if (e instanceof LoginError) throw new Error(e.message);
          console.error("[auth] login failed", e);
          throw new Error(LOGIN_ERRORS.invalid);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.sessionVersion = user.sessionVersion;
        token.mustChangePassword = user.mustChangePassword;
        token.mfaEnabled = user.mfaEnabled;
        token.revoked = false;
        return token;
      }
      if (token.revoked) return token;

      const email = typeof token.email === "string" ? token.email.toLowerCase() : null;
      if (email) {
        try {
          const adjuster = await prisma.adjuster.findUnique({
            where: { email },
            select: {
              id: true,
              role: true,
              isActive: true,
              sessionVersion: true,
              mustChangePassword: true,
              mfaEnabledAt: true,
            },
          });
          if (
            !adjuster ||
            !adjuster.isActive ||
            (token.sessionVersion ?? 0) !== adjuster.sessionVersion
          ) {
            token.revoked = true;
            return token;
          }
          token.id = adjuster.id;
          token.role = adjuster.role;
          token.mustChangePassword = adjuster.mustChangePassword;
          token.mfaEnabled = !!adjuster.mfaEnabledAt;
        } catch {
          // keep existing token if DB is briefly unavailable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as AdjusterRole;
        session.user.mustChangePassword = !!token.mustChangePassword;
        session.user.mfaEnabled = !!token.mfaEnabled;
      }
      if (token.revoked) {
        return { ...session, user: undefined } as unknown as typeof session;
      }
      return session;
    },
  },
};

export async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}

/**
 * Resolve the live Adjuster row for the current session.
 * Survives DB reseeds where JWT still holds a stale Adjuster.id.
 */
export async function resolveSessionAdjuster(session: {
  user?: { id?: string; email?: string | null; role?: AdjusterRole } | null;
}) {
  const email = session.user?.email?.toLowerCase();
  const id = session.user?.id;

  if (id) {
    const byId = await prisma.adjuster.findFirst({
      where: { id, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (byId) return byId;
  }

  if (email) {
    const byEmail = await prisma.adjuster.findFirst({
      where: { email, isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });
    if (byEmail) return byEmail;
  }

  return null;
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

/** Admins must enroll in MFA once REQUIRE_ADMIN_MFA=1 is set. */
export function adminMfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA === "1";
}
