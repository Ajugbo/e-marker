"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme: "outline";
      size: "large";
      text: "signin_with";
      shape: "rectangular";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

export default function AuthButton() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonReady, setButtonReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (sessionResponse) => {
        const session = (await sessionResponse.json()) as {
          user: AuthUser | null;
          error?: string;
        };
        if (!sessionResponse.ok) {
          throw new Error(session.error || "Could not check your sign-in status.");
        }
        setUser(session.user);
        if (session.user) return;

        const configResponse = await fetch("/api/auth/google", {
          cache: "no-store",
          signal: controller.signal,
        });
        const config = (await configResponse.json()) as {
          clientId?: string;
          error?: string;
        };
        if (!configResponse.ok || !config.clientId) {
          throw new Error(config.error || "Google Sign-In is not configured.");
        }
        setClientId(config.clientId);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Could not load sign-in.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!clientId || !scriptReady || !window.google || !buttonRef.current) return;
    if (buttonRef.current.childElementCount > 0) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        setError("");
        setSigningIn(true);
        try {
          const response = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential }),
          });
          const result = (await response.json()) as {
            user?: AuthUser;
            error?: string;
          };
          if (!response.ok || !result.user) {
            throw new Error(result.error || "Google Sign-In could not be completed.");
          }
          setUser(result.user);
        } catch (signInError) {
          setError(signInError instanceof Error ? signInError.message : "Google Sign-In failed.");
        } finally {
          setSigningIn(false);
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
    });
    setButtonReady(true);
  }, [clientId, scriptReady]);

  if (user) {
    const initials = (user.name || user.email)
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <div className="flex max-w-full items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm text-blue-950 shadow-sm">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-800"
        >
          {initials}
        </span>
        <span className="max-w-[min(16rem,50vw)] truncate">{user.email}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      {clientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onError={() => setError("Google Sign-In could not be loaded. Please try again.")}
        />
      )}
      <div
        ref={buttonRef}
        aria-label="Sign in with Google"
        aria-busy={signingIn}
        className={signingIn ? "pointer-events-none opacity-60" : ""}
      />
      {!buttonReady && (
        <span className="px-3 py-2 text-sm text-blue-800">
          {loading ? "Checking sign-in…" : error ? "Sign-in unavailable" : "Loading Google Sign-In…"}
        </span>
      )}
      {error && <p role="alert" className="mt-1 max-w-xs text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
