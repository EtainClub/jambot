import { z } from "zod";

/**
 * 잼통 /factbase.json의 모양.
 *
 * 잼통 `src/lib/factbase/build.ts`가 만든다. 그쪽이 바뀌면 여기가 받지 못하고
 * 터져야 한다 — 조용히 필드가 비면 판정이 근거 없이 나간다. 그래서 받을 때
 * 한 번 검사한다.
 */

export const assertionTypeSchema = z.enum(["FACT", "CLAIM", "INTERPRETATION", "OPINION"]);
export type AssertionType = z.infer<typeof assertionTypeSchema>;

export const factSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  url: z.string().optional(),
  publishedAt: z.string().optional(),
  license: z.string(),
});
export type FactSource = z.infer<typeof factSourceSchema>;

export const factEntrySchema = z.object({
  anchor: z.string(),
  kind: z.enum(["claim", "words", "words-point", "milestone"]),
  title: z.string(),
  text: z.string(),
  assertionType: assertionTypeSchema.optional(),
  assertedBy: z.string().optional(),
  status: z.enum(["done", "ongoing", "planned"]).optional(),
  date: z.string().optional(),
  sources: z.array(factSourceSchema),
  path: z.string(),
  categories: z.array(z.string()),
});
export type FactEntry = z.infer<typeof factEntrySchema>;

export const factbaseSchema = z.object({
  version: z.string(),
  builtAt: z.string(),
  entries: z.array(factEntrySchema),
});
export type Factbase = z.infer<typeof factbaseSchema>;
