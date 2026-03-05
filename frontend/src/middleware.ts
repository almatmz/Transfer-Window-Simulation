import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('access_token')?.value

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (!isPublic && !token) {
    // localStorage tokens are handled client-side; middleware only checks cookie
    // The (app)/layout.tsx handles the actual redirect for localStorage tokens
    return NextResponse.next()
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|api|favicon|.*\\..*).*)'] }
