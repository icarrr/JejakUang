import type { NextAuthConfig } from "next-auth";

/** Edge-safe config used by middleware. No DB, no hashing. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const loggedIn = !!auth?.user;
      const isAuthPage = pathname === "/login" || pathname === "/register";
      if (isAuthPage) return loggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      return loggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;