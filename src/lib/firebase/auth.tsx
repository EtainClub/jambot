"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onIdTokenChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
  type User,
} from "firebase/auth";

import type { OperatorRole, Role } from "@/lib/tasks/transitions";

import { firebaseAuth, firebaseConfigured } from "./client";

/**
 * 로그인 상태.
 *
 * ★ 익명으로 시작한다.
 *   처음 들어온 사람에게 로그인 화면을 들이밀지 않는다. 계정이 없으면 익명
 *   계정을 만들어 둘러보게 하고, 제보처럼 기록이 남아야 하는 일을 할 때 구글을
 *   **연결**한다. 연결은 uid를 바꾸지 않으므로 그 사이의 상태가 그대로 이어진다.
 *
 * ★ 그 구글 계정이 이미 있으면 연결 대신 그 계정으로 들어간다.
 *   다른 기기에서 먼저 연결한 사람이다. 익명 계정에는 남은 것이 없다 — 제보는
 *   구글 연결 뒤에만 되기 때문이다. 그래서 묻지 않고 넘어가며, 두 번째 팝업 없이
 *   연결 실패의 자격 증명으로 바로 로그인한다(팝업은 클릭 한 번에 하나만 열린다).
 */

export interface Profile {
  uid: string;
  email: string | null;
  displayName: string;
  linkedAt: number;
  updatedAt: number;
  reportCount: number;
}

export interface Me {
  uid: string;
  google: boolean;
  profile: Profile | null;
  /** 익명이면 null, 구글을 연결했으면 contributor 이상. */
  role: Role | null;
}

export interface Member {
  uid: string;
  email: string | null;
  name: string;
  role: OperatorRole;
}

interface AuthState {
  ready: boolean;
  configured: boolean;
  /** 구글이 연결됐는가. */
  google: boolean;
  me: Me | null;
  /** 운영자면 채워진다. */
  member: Member | null;
  linkGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** 로그인 토큰을 붙여 API를 부른다. */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AuthState | null>(null);

function linked(user: User | null): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === "google.com"));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!firebaseConfigured);
  const [google, setGoogle] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await firebaseAuth()?.currentUser?.getIdToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(path, { ...init, headers });
  }, []);

  const fetchMe = useCallback(async (): Promise<Me | null> => {
    const res = await api("/api/my");
    return res.ok ? ((await res.json()) as Me) : null;
  }, [api]);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onIdTokenChanged(auth, (user) => {
      if (!user) {
        // 계정이 없으면 익명으로 만든다. 다음 호출에서 이 리스너가 다시 불린다.
        void signInAnonymously(auth).catch((error) => {
          console.error("[auth] 익명 로그인 실패 — 콘솔에서 익명 로그인을 켰는지 확인하세요.", error);
          setReady(true);
        });
        return;
      }
      setGoogle(linked(user));
      void fetchMe().then((next) => {
        setMe(next);
        setReady(true);
      });
    });
  }, [fetchMe]);

  const value = useMemo<AuthState>(() => {
    const role = me?.role && me.role !== "contributor" ? me.role : null;
    return {
      ready,
      configured: firebaseConfigured,
      google,
      me,
      member:
        role && me?.profile
          ? { uid: me.uid, email: me.profile.email, name: me.profile.displayName, role }
          : null,
      api,

      async refreshMe() {
        setMe(await fetchMe());
      },

      async linkGoogle() {
        const auth = firebaseAuth();
        const user = auth?.currentUser;
        if (!auth || !user) return;
        const provider = new GoogleAuthProvider();
        try {
          await linkWithPopup(user, provider);
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
          if (code === "auth/credential-already-in-use") {
            const credential = GoogleAuthProvider.credentialFromError(error as never);
            if (!credential) throw error;
            await signInWithCredential(auth, credential);
          } else {
            throw error;
          }
        }
        // 연결 직후 토큰에는 아직 google.com이 없다. 새로 받아야 서버가 연결을 안다.
        await auth.currentUser?.getIdToken(true);
        setGoogle(linked(auth.currentUser));
        setMe(await fetchMe());
      },

      async signOutUser() {
        const auth = firebaseAuth();
        if (!auth) return;
        setMe(null);
        await signOut(auth); // 리스너가 새 익명 계정을 만든다
      },
    };
  }, [ready, google, me, api, fetchMe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있다");
  return value;
}
