import "server-only";

import { readFile } from "node:fs/promises";

import { buildIndex } from "./search";
import { factbaseSchema, type Factbase, type FactEntry } from "./types";

/**
 * 잼통 근거 묶음을 받아 둔다.
 *
 * FACTBASE_URL은 http(s) 주소나 `file:` 경로다. 손에서 돌릴 때는 잼통을
 * `pnpm dev`로 띄워 http://localhost:3000/factbase.json을 쓰면 된다.
 *
 * 인스턴스 메모리에 10분 둔다. 잼통 배포는 하루 몇 번이므로 이보다 자주 받을
 * 이유가 없다. 버전 변경 감지는 factbase-sync 작업이 따로 한다.
 */

const TTL_MS = 10 * 60_000;
const DEFAULT_URL = "https://jamtong.kr/factbase.json";

interface Loaded {
  factbase: Factbase;
  byAnchor: Map<string, FactEntry>;
  index: ReturnType<typeof buildIndex>;
  loadedAt: number;
}

let cache: Loaded | null = null;

export async function fetchFactbase(): Promise<Factbase> {
  const url = process.env.FACTBASE_URL ?? DEFAULT_URL;
  let raw: unknown;
  if (url.startsWith("file:")) {
    raw = JSON.parse(await readFile(new URL(url), "utf8"));
  } else {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`factbase를 받지 못했습니다: ${res.status} ${url}`);
    raw = await res.json();
  }
  // 모양이 다르면 여기서 터진다. 빈 근거로 판정이 나가는 것보다 낫다.
  return factbaseSchema.parse(raw);
}

export async function loadFactbase(force = false): Promise<Loaded> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  const factbase = await fetchFactbase();
  cache = {
    factbase,
    byAnchor: new Map(factbase.entries.map((e) => [e.anchor, e])),
    index: buildIndex(factbase.entries),
    loadedAt: Date.now(),
  };
  return cache;
}
