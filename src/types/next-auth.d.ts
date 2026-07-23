import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CLIENTE" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "CLIENTE" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "CLIENTE" | "ADMIN";
  }
}
