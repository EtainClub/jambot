import { z } from "zod";

/**
 * 판정.
 *
 * 앞의 넷만 근거 앵커가 있어야 한다. 사실이라 말하든 틀렸다 말하든, 잼통의
 * 어느 문장에 기댔는지 대지 못하면 판정이 아니라 의견이다.
 */
export const VERDICTS = [
  "accurate",
  "false",
  "missing_context",
  "outdated",
  "opinion",
  "insufficient",
  "out_of_scope",
] as const;
export const verdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof verdictSchema>;

export const ANCHORED: ReadonlySet<Verdict> = new Set(["accurate", "false", "missing_context", "outdated"]);

/** 댓글을 다는 판정. 사실이거나 의견이면 달 말이 없다. */
export const COMMENTABLE: ReadonlySet<Verdict> = new Set(["false", "missing_context", "outdated"]);

export const VERDICT_LABEL: Record<Verdict, string> = {
  accurate: "사실",
  false: "사실과 다름",
  missing_context: "맥락 누락",
  outdated: "과거에는 사실",
  opinion: "의견·해석",
  insufficient: "근거 불충분",
  out_of_scope: "잼통 범위 밖",
};

/** 작업 하나에 주장이 여럿이면 가장 손이 가야 하는 것을 대표로 세운다. */
const PRIORITY: Verdict[] = [
  "false",
  "missing_context",
  "outdated",
  "insufficient",
  "out_of_scope",
  "opinion",
  "accurate",
];

export function headlineVerdict(verdicts: Verdict[]): Verdict | null {
  for (const v of PRIORITY) if (verdicts.includes(v)) return v;
  return null;
}

/** 모델이 내는 판정. 앵커는 후보 목록에서 고른 것이어야 한다(validate.ts가 본다). */
export const claimJudgmentSchema = z.object({
  claim: z.string().describe("게시물에서 뽑은 주장 문장 그대로"),
  verdict: verdictSchema,
  anchors: z.array(z.string()).describe("근거로 쓴 후보의 anchor. 후보 목록에 있는 값만"),
  reasoning: z.string().describe("운영자가 읽을 판정 이유. 두세 문장"),
  gapTopic: z
    .string()
    .nullable()
    .describe("out_of_scope이면 필수, insufficient이면 모자란 자료가 무엇인지: 잼통에 추가해야 할 주제를 짧은 명사구로. 그 밖에는 null"),
});
export type ClaimJudgment = z.infer<typeof claimJudgmentSchema>;

export const judgmentSchema = z.object({
  claims: z.array(claimJudgmentSchema),
  commentBody: z
    .string()
    .nullable()
    .describe("댓글 본문. 머리말과 링크 없이. 댓글을 달 판정이 없으면 null"),
});
export type Judgment = z.infer<typeof judgmentSchema>;

export const extractionSchema = z.object({
  readable: z.boolean().describe("캡션이나 이미지에서 글을 읽어 낼 수 있었는가"),
  contentText: z.string().describe("게시물에서 읽은 글. 캡션과 이미지 속 글자를 옮긴 것"),
  claims: z
    .array(z.string())
    .describe("정부 정책에 관한 사실 주장 문장. 최대 3개. 의견·감탄·홍보 문구는 빼고, 없으면 빈 배열"),
});
export type Extraction = z.infer<typeof extractionSchema>;
