import { useCallback, useEffect, useRef, useState } from "react";

export type InstallPlatform = "ios" | "android" | "inAppBrowser" | "unsupported";

const STORAGE_KEY = "liftcamp:pwa-prompt";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: string }>;
};

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt?: number };
    return typeof parsed?.dismissedAt === "number";
  } catch {
    return false;
  }
}

/**
 * Everything here runs in an effect. This app is SSR'd, so touching window,
 * navigator or localStorage during render would hydration-mismatch.
 */
export function usePwaInstall(options?: { onInstalled?: () => void }) {
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");
  const [canPrompt, setCanPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(true);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const onInstalled = useRef(options?.onInstalled);
  onInstalled.current = options?.onInstalled;

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    const ua = navigator.userAgent;
    const isInAppBrowser = /FBAN|FBAV|Instagram|Line|Twitter/.test(ua);
    // iPadOS 13+ reports a Macintosh UA, so the touch-point check is required.
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);

    setStandalone(isStandalone);
    setDismissed(readDismissed());
    setPlatform(isInAppBrowser ? "inAppBrowser" : isIOS ? "ios" : "android");

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    }
    function onAppInstalled() {
      deferred.current = null;
      setCanPrompt(false);
      setStandalone(true);
      onInstalled.current?.();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Chrome only honours .prompt() inside a user gesture — wire this to onClick.
  const promptInstall = useCallback(async () => {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    deferred.current = null;
    setCanPrompt(false);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() }));
    } catch {
      /* private mode — hide for this session only */
    }
    setDismissed(true);
  }, []);

  const shouldShow =
    !standalone &&
    !dismissed &&
    (platform === "ios" || platform === "inAppBrowser" || (platform === "android" && canPrompt));

  return { platform, canPrompt, promptInstall, dismiss, shouldShow };
}
