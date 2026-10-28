import { timingSafeEqual } from "crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

const emailFrom = process.env.EMAIL_FROM ?? "UniSin <login@example.com>";
// Setting EMAIL_SERVER switches magic links to your own SMTP server, for
// self-hosters who do not want a third-party mail service. Resend stays the
// default, so an existing deployment is unaffected.
const smtpServer = process.env.EMAIL_SERVER;

/**
 * Provider id the login form has to sign in with. It differs per transport,
 * so it is derived here rather than hardcoded at the call site.
 */
export const EMAIL_PROVIDER_ID = smtpServer ? "nodemailer" : "resend";

function ownerLogin() {
  // Bracket access stays runtime. Next inlines process.env.NAME at build time,
  // which hid the password form on the first deploy.
  const email = process.env["LOGIN_EMAIL"]?.trim().toLowerCase() ?? "";
  const password = process.env["LOGIN_PASSWORD"] ?? "";
  return { email, password, enabled: email.length > 0 && password.length > 0 };
}

export function passwordLoginEnabled(): boolean {
  return ownerLogin().enabled;
}

function passwordsMatch(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    ...(ownerLogin().enabled
      ? [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const { email: loginEmail, password: loginPassword } = ownerLogin();
              const email = String(credentials?.email ?? "")
                .trim()
                .toLowerCase();
              const password = String(credentials?.password ?? "");
              if (email !== loginEmail || !passwordsMatch(password, loginPassword)) {
                return null;
              }

              const existing = await prisma.user.findFirst({
                where: { email: { equals: email, mode: "insensitive" } },
              });
              const user =
                existing ??
                (await prisma.user.create({
                  data: { email, emailVerified: new Date() },
                }));
              await ensureWorkspaceForUser(user.id, user.email);
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
    smtpServer
      ? Nodemailer({ server: smtpServer, from: emailFrom })
      : Resend({
          apiKey: process.env.RESEND_API_KEY ?? "missing-resend-api-key",
          from: emailFrom,
        }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, user, token }) {
      const id =
        user?.id ?? (typeof token?.id === "string" ? token.id : undefined);
      if (session.user && id) {
        session.user.id = id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
    error: "/login",
  },
  session: {
    // Credentials login cannot open a database session. Password sign-in uses
    // a signed cookie instead. Email magic links keep database sessions when
    // no password is configured.
    strategy: ownerLogin().enabled ? "jwt" : "database",
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
