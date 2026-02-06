import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/@")) {
    const username = pathname.replace("/@", "");
    const url = request.nextUrl.clone();
    url.pathname = username ? `/profile/${username}` : "/profile";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/@:path*"],
};
