import type { FactEntry } from "./types";

/**
 * 근거 후보 찾기.
 *
 * 형태소 분석기 없이 글자 두 개짜리 조각(bigram)으로 겹침을 센다. 한국어는
 * 조사가 붙어 단어 단위 비교가 잘 안 맞는데("공소청은", "공소청이"), 두 글자
 * 조각은 조사와 상관없이 겹친다.
 *
 * 여기서 고른 후보는 모델이 읽을 목록일 뿐이다. 판정은 모델이 하고, 모델은 이
 * 목록 밖의 앵커를 인용할 수 없다. 그래서 여기가 너무 좁으면 out_of_scope가
 * 늘고, 너무 넓으면 비용이 는다 — 실패가 조용하지 않은 쪽으로 넉넉히 잡는다.
 */

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function bigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (const word of normalize(text).split(" ")) {
    if (word.length === 1) grams.add(word);
    for (let i = 0; i < word.length - 1; i++) grams.add(word.slice(i, i + 2));
  }
  return grams;
}

export interface Candidate {
  entry: FactEntry;
  score: number;
}

/** 자주 나오는 조각은 변별력이 없다. 문서 빈도로 눌러 준다. */
export function buildIndex(entries: FactEntry[]) {
  const docs = entries.map((entry) => ({
    entry,
    grams: bigrams(`${entry.title} ${entry.text} ${entry.assertedBy ?? ""}`),
  }));
  const df = new Map<string, number>();
  for (const doc of docs) for (const g of doc.grams) df.set(g, (df.get(g) ?? 0) + 1);
  const n = docs.length;
  return {
    search(query: string, limit: number): Candidate[] {
      const q = bigrams(query);
      const scored: Candidate[] = [];
      for (const doc of docs) {
        let score = 0;
        for (const g of q) {
          if (doc.grams.has(g)) score += Math.log(1 + n / (df.get(g) ?? 1));
        }
        if (score > 0) scored.push({ entry: doc.entry, score });
      }
      return scored.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  };
}

/** 주장 여럿에 대해 각자 찾고 합친다. 한 주장이 후보를 독차지하지 않게 주장마다 몫을 나눈다. */
export function candidatesFor(
  index: ReturnType<typeof buildIndex>,
  claims: string[],
  total = 40,
): FactEntry[] {
  const per = Math.max(8, Math.ceil(total / Math.max(1, claims.length)));
  const picked = new Map<string, FactEntry>();
  for (const claim of claims) {
    for (const { entry } of index.search(claim, per)) {
      if (picked.size >= total) break;
      picked.set(entry.anchor, entry);
    }
  }
  return [...picked.values()];
}
