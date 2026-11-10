import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ACCOUNT_PATH = "/account";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const isApi = path.startsWith("/api/");
    if (!token || isApi || path.startsWith(ACCOUNT_PATH)) return NextResponse.next();

    const mfaSetupRequired =
      process.env.REQUIRE_ADMIN_MFA === "1" && token.role === "ADMIN" && !token.mfaEnabled;
    if (token.mustChangePassword || mfaSetupRequired) {
      const url = req.nextUrl.clone();
      url.pathname = ACCOUNT_PATH;
      url.search = token.mustChangePassword ? "?required=password" : "?required=mfa";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && !token.revoked,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/claims/:path*",
    "/people/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/api/people/:path*",
    "/api/upload",
    "/api/upload/:path*",
    "/api/documents/:path*",
  ],
};
