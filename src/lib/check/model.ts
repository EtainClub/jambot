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

export const CHECK_MODEL = process.env.CHECK_MODEL ?? "claude-opus-5-5";

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
- 의견, 감탄, 비난, 홍보 문구, 질문은 주장이 아닙니다.
- 주장은 최대 3개. 게시물의 표현을 살리되 한 문장으로 만듭니다.
- 글을 읽을 수 없으면 readable을 false로 둡니다. 추측해서 채우지 않습니다.`;

export async function extract(input: {
  caption: string | null;
  hints: string[];
  images: PostImage[];
}): Promise<Extraction> {
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
}): Promise<Judgment> {
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
  if (response.stop_reason === "refusal") throw new ModelRefusal("판정 단계에서 모델이 거절했습니다.");
  if (!response.parsed_output) throw new Error("판정 결과를 해석하지 못했습니다.");
  return response.parsed_output;
}
