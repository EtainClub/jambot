import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { FactEntry } from "@/lib/factbase/types";

import { extractionSchema, judgmentSchema, type Extraction, type Judgment } from "./types";

/**
 * 모델 호출 두 번.
 *
 *   1. 읽기 — 캡션과 이미지에서 글을 옮기고 정책 주장을 뽑는다.
 *   2. 판정 — 주장을 잼통 근거 후보와 대조한다.
 *
 * 둘을 나누는 이유는 후보 검색이 그 사이에 있어서다. 이미지 속 글을 읽어야
 * 무엇을 찾을지 알 수 있다.
 */

export const CHECK_MODEL = process.env.CHECK_MODEL ?? "claude-sonnet-5-5";

/**
 * 토큰 사용량. 판정 한 번(읽기 + 판정, 재시도 포함)에 든 것을 모아 fc_checks에 남긴다.
 * 실제 건당 비용을 알아야 모델·후보 수를 숫자로 고를 수 있다.
 */
export interface Usage {
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const emptyUsage = (): Usage => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

function meter(usage: Usage | undefined, u: Anthropic.Usage): void {
  if (!usage) return;
  usage.calls += 1;
  usage.input += u.input_tokens;
  usage.output += u.output_tokens;
  usage.cacheRead += u.cache_read_input_tokens ?? 0;
  usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
}

/** 100만 토큰당 달러 (platform.claude.com 가격표, 2026-10-10 확인). 표에 없는 모델은 비용을 적지 않는다. */
const PRICE: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function costUsd(model: string, u: Usage): number | null {
  const p = PRICE[model];
  if (!p) return null;
  const usd = (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1_000_000;
  return Math.round(usd * 100_000) / 100_000;
}

/** 모델이 거절하면 사람에게 넘긴다. 재시도해도 같은 답이 나온다. */
export class ModelRefusal extends Error {}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export interface PostImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
}

const EXTRACT_SYSTEM = `당신은 인스타그램 게시물에서 글을 옮겨 적는 사람입니다.

- 캡션과 이미지 속 글자를 있는 그대로 옮깁니다. 고치거나 요약하지 않습니다.
- 그중 한국 정부 정책에 관한 **사실 주장**만 따로 뽑습니다. 확인할 수 있는 내용(금액, 대상, 날짜, 시행 여부, 누가 무엇을 했다)이어야 합니다.
- 비난·비꼼·질문·제목 형식이어도, 그 말이 성립하려면 참이어야 하는 **정책에 관한 사실 전제**가 있으면 그 전제를 주장으로 뽑습니다.
  예: "세금 걷어서 놀고먹는 사람한테 퍼준다는 정부, 이게 맞나요?" → "정부가 일하지 않는 사람에게 세금으로 현금을 지급하는 정책을 시행한다"
  예: "이제 퇴직금도 나라가 가져가는 시대?" → "정부가 퇴직금을 관리해 퇴직자가 바로 받을 수 없게 된다"
- 평가·감정·예측만 있고 확인할 사실이 없으면 주장이 아닙니다. 예: "무능한 정부", "나라 망한다", "또 말 바꿀 거다".
- 정부 정책과 상관없는 내용(인물 일화, 역사, 정당 내부 일)은 뽑지 않습니다.
- 주장은 최대 3개. 게시물의 표현을 살리되 한 문장으로 만듭니다.
- 글을 읽을 수 없으면 readable을 false로 둡니다. 추측해서 채우지 않습니다.`;

export async function extract(input: {
  caption: string | null;
  hints: string[];
  images: PostImage[];
}, usage?: Usage): Promise<Extraction> {
  const content: Anthropic.ContentBlockParam[] = [
    ...input.images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      }),
    ),
    {
      type: "text",
      text: [
        `<caption>\n${input.caption ?? "(캡션 없음)"}\n</caption>`,
        input.hints.length
          ? `<reporter_hints>\n제보자가 짚은 주장(참고만 하고, 게시물에 실제로 있는 것만 뽑으세요):\n${input.hints.map((h) => `- ${h}`).join("\n")}\n</reporter_hints>`
          : "",
      ].join("\n\n"),
    },
  ];

  const response = await anthropic().messages.parse({
    model: CHECK_MODEL,
    max_tokens: 4000,
    system: EXTRACT_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(extractionSchema) },
    messages: [{ role: "user", content }],
  });
  meter(usage, response.usage);
  if (response.stop_reason === "refusal") throw new ModelRefusal("읽기 단계에서 모델이 거절했습니다.");
  if (!response.parsed_output) throw new Error("읽기 결과를 해석하지 못했습니다.");
  return response.parsed_output;
}

const JUDGE_SYSTEM = `당신은 "잼통" 근거 자료만으로 정책 주장을 대조하는 검토자입니다. 잼통은 이재명 정부의 정책과 업적을 1차 자료로 정리한 위키입니다.

## 근거
- 판정에 쓸 수 있는 것은 <candidates>에 있는 항목뿐입니다. 사전 지식, 상식, 추측으로 판정하지 않습니다.
- anchors에는 후보의 anchor 값을 그대로 적습니다. 목록에 없는 값을 만들지 않습니다.
- 후보에 관련 내용이 없으면 out_of_scope입니다. 이때 anchors는 비우고, gapTopic에 잼통에 추가해야 할 주제를 짧게 적습니다(예: "고유가 피해지원금 지급 대상").
- 관련 후보는 있지만 판정하기에 모자라면 insufficient입니다. 이때도 gapTopic에 무엇이 모자란지 적습니다(예: "울산 비축유 90만 배럴 판매 경위").
- gapTopic은 정책 단위로 적습니다. 한 게시물의 주장들이 같은 정책을 다루면 같은 gapTopic을 그대로 씁니다(예: 원가와 판매가를 다룬 두 주장 → 둘 다 "브라질산 계란 수입").

## 판정
- accurate: 근거와 일치
- false: 근거와 정면으로 어긋남
- missing_context: 조건·대상·시점이 빠져 오해를 부름
- outdated: 예전에는 맞았지만 근거의 날짜 이후 바뀜. 날짜(date)가 있는 근거로만 판정
- opinion: 사실 주장이 아니라 의견·평가
- status가 planned나 ongoing인 근거를 '이미 끝난 일'의 근거로 쓰지 않습니다.

## 주장의 성격
- 후보의 assertionType이 CLAIM이면 그것은 assertedBy의 주장입니다. 사실로 단정하지 말고 댓글에 "○○에 따르면"처럼 주체를 밝힙니다.
- INTERPRETATION, OPINION 근거로 false를 내리지 않습니다.
- 게시자의 정치 성향이나 의도는 판정에 쓰지 않습니다. 정부에 유리한 쪽으로 틀린 주장도 똑같이 false입니다.

## 댓글 (commentBody)
- false, missing_context, outdated 판정이 하나라도 있을 때만 씁니다. 없으면 null.
- 300자 이내, 존댓말, 차분하게. 사람이 아니라 주장에 대해 씁니다.
- 주소나 링크를 쓰지 않습니다. 머리말("[잼통 근거 안내]")도 쓰지 않습니다. 둘 다 서버가 붙입니다.
- 근거에 있는 사실만 씁니다.`;

function renderCandidates(candidates: FactEntry[]): string {
  return candidates
    .map((c) => {
      const meta = [
        `anchor=${c.anchor}`,
        c.assertionType ? `assertionType=${c.assertionType}` : null,
        c.assertedBy ? `assertedBy=${c.assertedBy}` : null,
        c.status ? `status=${c.status}` : null,
        c.date ? `date=${c.date}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return `<candidate ${meta}>\n[${c.title}] ${c.text}\n</candidate>`;
    })
    .join("\n");
}

export async function judge(input: {
  contentText: string;
  claims: string[];
  candidates: FactEntry[];
  retryErrors?: string[];
}, usage?: Usage): Promise<Judgment> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        `<candidates>\n${renderCandidates(input.candidates)}\n</candidates>`,
        `<post>\n${input.contentText}\n</post>`,
        `<claims>\n${input.claims.map((c) => `- ${c}`).join("\n")}\n</claims>`,
        "각 주장을 판정하세요.",
        input.retryErrors?.length
          ? `직전 판정이 다음 검사에서 거절됐습니다. 고쳐서 다시 판정하세요:\n${input.retryErrors.map((e) => `- ${e}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  const response = await anthropic().messages.parse({
    model: CHECK_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: JUDGE_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(judgmentSchema) },
    messages,
  });
  meter(usage, response.usage);
  if (response.stop_reason === "refusal") throw new ModelRefusal("판정 단계에서 모델이 거절했습니다.");
  if (!response.parsed_output) throw new Error("판정 결과를 해석하지 못했습니다.");
  return response.parsed_output;
}
