import { z } from "zod";

import { errorResponse, HttpError, requireMember } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";
import { createIssue } from "@/lib/gaps/github";
import { mergeGaps } from "@/lib/gaps/store";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    officialUrls: z.array(z.string().url().max(500)).max(10).default([]),
    note: z.string().max(2000).default(""),
  }),
  /** 이슈를 따로 올렸을 때 주소만 적는다. */
  z.object({ action: z.literal("link"), issueUrl: z.string().url().max(500) }),
  z.object({ action: z.literal("dismiss"), reason: z.string().min(1).max(500) }),
  /** 같은 주제로 갈라진 공백을 하나로 합친다. 이 공백이 into 쪽으로 들어간다. */
  z.object({ action: z.literal("merge"), into: z.string().min(1).max(100) }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/gaps/[key]">) {
  try {
    const actor = await requireMember(request, "moderator");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    const { key } = await ctx.params;
    const ref = db().collection("fc_gaps").doc(key);
    const gap = (await ref.get()).data();
    if (!gap) throw new HttpError(404, "공백을 찾을 수 없습니다.");
    const now = Date.now();
    const by = { uid: actor.uid, name: actor.name, at: now };

    switch (parsed.data.action) {
      case "request": {
        if (gap.status !== "open") throw new HttpError(409, "이미 처리된 공백입니다.");
        const result = await createIssue({
          key,
          topic: gap.topic,
          count: gap.count,
          examples: gap.examples ?? [],
          officialUrls: parsed.data.officialUrls,
          note: parsed.data.note,
        });
        if ("url" in result) {
          await ref.update({ status: "requested", issueUrl: result.url, requestedBy: by, updatedAt: now });
          return Response.json({ issueUrl: result.url });
        }
        // 토큰이 없다. 본문을 돌려주고 상태는 그대로 둔다 — 실제로 올린 뒤 link로 적는다.
        return Response.json({ manual: result });
      }
      case "link":
        await ref.update({ status: "requested", issueUrl: parsed.data.issueUrl, requestedBy: by, updatedAt: now });
        return Response.json({ ok: true });
      case "merge":
        await mergeGaps(actor, key, parsed.data.into);
        return Response.json({ ok: true });
      case "dismiss":
        await ref.update({ status: "dismissed", dismissReason: parsed.data.reason, dismissedBy: by, updatedAt: now });
        return Response.json({ ok: true });
    }
  } catch (error) {
    return errorResponse(error, "gaps:action");
  }
}
