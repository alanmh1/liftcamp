import * as Sentry from '@sentry/react-native';

import { isDevBuild } from '@/lib/dev-build';

/**
 * Crash and error reporting. Imported for its side effect at the top of the
 * root layout, so errors while later modules load are caught too.
 *
 * Errors only, to fit the free plan's 5,000 events a month: no tracing, no
 * session replay, no profiling. A debug build, or any build on a Simulator
 * or emulator (lib/dev-build), sends nothing. Turning the SDK off here
 * rather than filtering in `beforeSend` also covers native crashes, which
 * never pass through JS.
 *
 * This reads no supabase-js state, so nothing here waits on auth-js at
 * launch. AuthProvider hands over the user id.
 */
const DEV_BUILD = isDevBuild();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !DEV_BUILD,
  enableNative: !DEV_BUILD,
  enableNativeNagger: false,
  environment: DEV_BUILD ? 'development' : 'production',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeBreadcrumb(breadcrumb) {
    // Log lines can quote a server error, and request query strings carry
    // filter values such as a searched username. Neither goes to Sentry.
    if (breadcrumb.category === 'console') return null;
    if ((breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') && breadcrumb.data) {
      const { url } = breadcrumb.data;
      if (typeof url === 'string') breadcrumb.data.url = url.split(/[?#]/)[0];
      delete breadcrumb.data['http.query'];
      delete breadcrumb.data['http.fragment'];
    }
    return breadcrumb;
  },
});

/** The Supabase user id, and nothing else about the user. Null when signed out. */
export function setSentryUser(userId: string | null): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

export const wrapRoot = Sentry.wrap;
