"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut } from "firebase/auth";

import type { Role } from "@/lib/tasks/transitions";

import { firebaseAuth, firebaseConfigured } from "./client";

/**
 * 로그인 상태와 운영자 역할.
 *
 * 잼통과 달리 익명 로그인이 없다. 이 앱의 화면은 거의 전부 운영자용이고,
 * 운영자는 구글 계정으로 들어와 fc_members에 이름이 있어야 한다.
 * 제보 화면만 로그인 없이 쓴다.
 */

export interface Member {
  uid: string;
  email: string | null;
  name: string;
  role: Role;
}

interface AuthState {
  ready: boolean;
  configured: boolean;
  signedIn: boolean;
  /** 로그인은 했지만 운영자 명단에 없으면 null. */
  member: Member | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /** 로그인 토큰을 붙여 API를 부른다. */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AuthState | null>(null);

async function token(): Promise<string | null> {
  return (await firebaseAuth()?.currentUser?.getIdToken()) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!firebaseConfigured);
  const [signedIn, setSignedIn] = useState(false);
  const [member, setMember] = useState<Member | null>(null);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const t = await token();
    const headers = new Headers(init.headers);
    if (t) headers.set("Authorization", `Bearer ${t}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(path, { ...init, headers });
  }, []);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onIdTokenChanged(auth, async (user) => {
      setSignedIn(Boolean(user));
      if (!user) {
        setMember(null);
        setReady(true);
        return;
      }
      const res = await api("/api/me");
      setMember(res.ok ? ((await res.json()) as Member) : null);
      setReady(true);
    });
  }, [api]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured: firebaseConfigured,
      signedIn,
      member,
      api,
      async signInWithGoogle() {
        const auth = firebaseAuth();
        if (!auth) return;
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
          throw error;
        }
      },
      async signOutUser() {
        const auth = firebaseAuth();
        if (auth) await signOut(auth);
      },
    }),
    [ready, signedIn, member, api],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있다");
  return value;
}
