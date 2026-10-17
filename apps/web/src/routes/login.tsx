import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = "https://accounts.google.com/gsi/client";

// Random 32-byte value, hex encoded. The raw value goes to Supabase; the
// SHA-256 hash of it goes to Google. Swapping these is the usual cause of
// "nonce mismatch" errors.
function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("no dom"));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-gsi-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi load failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi load failed"));
    document.head.appendChild(script);
  });
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | LiftCamp" },
      // Admin sign-in only. Nothing here for a crawler.
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LoginPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** Sign-in for /admin. The public site has no accounts; this page exists so
 *  an admin can get a session, and sends them to /admin once they have one. */
function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const rawNonceRef = useRef<string>("");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/admin", replace: true });
  }, [session, loading, navigate]);

  async function handleCredential(response: { credential?: string }) {
    if (!response?.credential) return;
    setError(null);
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        nonce: rawNonceRef.current,
      });
      if (error) throw error;
      // On success the auth listener picks up the session and the redirect
      // effect above navigates away.
    } catch (err: unknown) {
      setGoogleBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't sign in with Google. Try again.");
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    (async () => {
      try {
        await loadGis();
        if (cancelled) return;

        const raw = randomNonce();
        const hashed = await sha256Hex(raw);
        if (cancelled) return;
        rawNonceRef.current = raw;

        const google = window.google;
        const target = googleButtonRef.current;
        if (!google || !target) return;

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          nonce: hashed,
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
        });

        target.innerHTML = "";
        google.accounts.id.renderButton(target, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 320,
        });

        if (!cancelled) setGisReady(true);
      } catch {
        if (!cancelled) setGisReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect flow. Used only when the Google script is blocked or the client
  // ID is missing from the build.
  async function signInWithGoogle() {
    setError(null);
    setGoogleBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (error) {
      setGoogleBusy(false);
      setError("Couldn't sign in with Google. Try again.");
    }
    // On success the browser navigates to Google; nothing further runs here.
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight">Admin sign in</h1>
        <div className="mt-5">
          <div ref={googleButtonRef} className={cn("flex justify-center", !gisReady && "hidden")} />
          {!gisReady && (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleBusy}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-input bg-card text-sm font-semibold transition-colors hover:bg-accent/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GoogleMark />
              {googleBusy ? "Opening Google…" : "Continue with Google"}
            </button>
          )}
          {gisReady && googleBusy && (
            <p className="mt-2 text-center text-sm text-muted-foreground">Signing you in…</p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
