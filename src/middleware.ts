
import { NextResponse, type NextRequest } from 'next/server';

const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'teeboxed.com';

function slugFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  if (h.includes('localhost')) return null;
  const preview = h.match(/^([a-z0-9-]+)--\d+--firebase-studio-[a-z0-9-]+\.web\.app$/);
  if (preview) return preview[1];
  if (h.endsWith(`.${MAIN_DOMAIN}`)) {
    const sub = h.slice(0, -(MAIN_DOMAIN.length + 1));
    if (sub && sub !== 'www' && sub !== 'app') return sub;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get('host');
  const slug = slugFromHost(host);

  // If we have a slug from subdomain/host, rewrite to the dynamic route
  if (slug && url.pathname === '/') {
    // Rewrite root path to the [slug] dynamic route
    url.pathname = `/${slug}`;
    return NextResponse.rewrite(url);
  }

  // Handle path-based facility routing for localhost and development
  if (!slug && (url.hostname.includes('localhost') || url.hostname.includes('127.0.0.1'))) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length && parts[0] !== 'api' && parts[0] !== '_next' && parts[0] !== 'find-facility' && parts[0] !== 'login' && parts[0] !== 'register' && parts[0] !== 'dashboard' && parts[0] !== 'book') {
      // This is already a facility slug path, let it pass through to [slug] route
      return NextResponse.next();
    }
  }

  // Redirect main-domain /{slug} -> {slug}.teeboxed.com (only in production)
  if (!slug && url.hostname.endsWith(MAIN_DOMAIN) && !url.hostname.includes('localhost')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length && parts[0] !== 'api' && parts[0] !== '_next' && parts[0] !== 'find-facility' && parts[0] !== 'login' && parts[0] !== 'register' && parts[0] !== 'dashboard' && parts[0] !== 'book') {
      const maybeSlug = parts[0];
      const target = new URL(url.toString());
      target.hostname = `${maybeSlug}.${MAIN_DOMAIN}`;
      target.pathname = '/' + parts.slice(1).join('/');
      return NextResponse.redirect(target, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|public|assets|images|api).*)'],
};
