import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  default: {
    notificationLog: { create: vi.fn() },
    pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
    bookingSeal: { findMany: vi.fn() },
  },
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
  SessionProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock("next-auth", () => ({
  default: () => ({}),
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Mock framer-motion (Next.js 16/15 often uses it)
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
