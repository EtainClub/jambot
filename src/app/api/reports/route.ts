import { randomUUID } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { after } from "next/server";

import { errorResponse, HttpError, requireUser } from "@/lib/auth/member";
import { runCheck } from "@/lib/check/pipeline";
import { bucket, db } from "@/lib/firebase/admin";
import { parseInstagramUrl } from "@/lib/instagram/url";
import { clientIpHash, consume } from "@/lib/ratelimit";
import { countReport, ensureProfile } from "@/lib/users";

/**
 * 제보 접수. 구글이 연결된 계정만 받는다.
 *
 * ★ 왜 구글 연결인가.
 *   제보자가 자기 제보와 그 처리 결과를 내 기록에서 다시 볼 수 있어야 하고,
 *   익명 계정은 브라우저를 지우면 사라진다. 남용을 막는 데도 계정 단위 한도가
 *   접속 지점 한도보다 정확하다. 둘러보기는 익명으로 그대로 된다.
 *
 * ★ 같은 게시물은 한 문서다.
 *   문서 id가 shortcode이므로 두 사람이 같은 게시물을 동시에 제보해도 문서는
 *   하나만 생긴다. 뒤에 온 제보는 제보 수를 올리고 주장·스크린샷을 보탠다.
 *
 * ★ 판정은 응답을 보낸 뒤에 돈다(after).
 *   모델을 두 번 부르므로 수십 초가 걸린다. 제보자를 그동안 붙잡아 둘 이유가 없다.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function text(form: FormData, key: string, max: number): string {
  const value = form.get(key);
  if (typeof value !== "string") return "";
  if (value.length > max) throw new HttpError(400, `${key}가 너무 깁니다 (최대 ${max}자).`);
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request, { google: true });
    await ensureProfile(user);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, "요청 형식이 올바르지 않습니다.");
    }

    const parsed = parseInstagramUrl(text(form, "url", 500));
    if (!parsed) throw new HttpError(400, "인스타그램 게시물 주소를 넣어 주세요.");
    const claim = text(form, "claim", 500);
    const memo = text(form, "memo", 1000);

    const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) throw new HttpError(400, `스크린샷은 ${MAX_IMAGES}장까지입니다.`);
    for (const f of files) {
      if (!EXT[f.type]) throw new HttpError(400, "스크린샷은 JPG·PNG·WEBP·GIF만 받습니다.");
      if (f.size > MAX_BYTES) throw new HttpError(400, "스크린샷 한 장은 5MB 이하여야 합니다.");
    }

    const ipHash = clientIpHash(request);
    if (!(await consume(ipHash, user.uid))) throw new HttpError(429, "제보가 몰리고 있습니다. 잠시 후 다시 시도해 주세요.");

    const reportId = randomUUID();
    const imagePaths = await Promise.all(
      files.map(async (f, i) => {
        const path = `reports/${reportId}/${i}.${EXT[f.type]}`;
        await bucket().file(path).save(Buffer.from(await f.arrayBuffer()), { contentType: f.type });
        return path;
      }),
    );

    const now = Date.now();
    const { shortcode, url } = parsed;
    await db().collection("fc_reports").doc(reportId).set({
      shortcode,
      url,
      claim: claim || null,
      memo: memo || null,
      imagePaths,
      reporterUid: user.uid,
      ipHash,
      createdAt: now,
    });

    const postRef = db().collection("fc_posts").doc(shortcode);
    const taskRef = db().collection("fc_tasks").doc(shortcode);
    const { created, recheck } = await db().runTransaction(async (tx) => {
      const [post, task] = await Promise.all([tx.get(postRef), tx.get(taskRef)]);
      if (!post.exists) {
        tx.set(postRef, {
          shortcode,
          url,
          caption: null,
          contentText: null,
          claimHints: claim ? [claim] : [],
          imagePaths,
          sources: ["report"],
          reportCount: 1,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(taskRef, {
          postId: shortcode,
          url,
          status: "processing",
          reportCount: 1,
          assignee: null,
          expiresAt: null,
          finalComment: null,
          createdAt: now,
          updatedAt: now,
          history: [{ at: now, uid: "system", name: "제보", action: "pipeline", note: "제보 접수" }],
        });
        return { created: true, recheck: false };
      }
      tx.update(postRef, {
        reportCount: FieldValue.increment(1),
        ...(claim ? { claimHints: FieldValue.arrayUnion(claim) } : {}),
        ...(imagePaths.length ? { imagePaths: FieldValue.arrayUnion(...imagePaths) } : {}),
        sources: FieldValue.arrayUnion("report"),
        updatedAt: now,
      });
      tx.update(taskRef, { reportCount: FieldValue.increment(1), updatedAt: now });
      // 본문이 없어 멈췄던 게시물에 스크린샷이 새로 왔으면 다시 판정한다.
      return { created: false, recheck: task.data()?.status === "no_content" && imagePaths.length > 0 };
    });

    await countReport(user.uid);
    if (created || recheck) after(() => runCheck(shortcode));
    return Response.json({ shortcode, merged: !created }, { status: created ? 201 : 200 });
  } catch (error) {
    return errorResponse(error, "reports");
  }
}

