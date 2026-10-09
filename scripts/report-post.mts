/**
 * 운영자 대리 제보 (터미널).
 *
 *   pnpm report-post <제보자 email> <게시물들.json>
 *
 * 게시물들.json: [{ "url": "...", "caption": "게시물 글", "claim": "(선택) 문제 주장" }]
 *
 * 화면(/report)의 제보와 같은 문서를 남기되, 스크린샷 대신 운영자가 옮겨 적은
 * 캡션을 게시물 본문으로 넣는다. 이미 있는 게시물은 건너뛴다.
 * 판정은 이 자리에서 바로 돌리고 결과를 찍는다 (모델 비용이 든다).
 * 자격 증명은 ADC다: `gcloud auth application-default login`.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { runCheck } from "@/lib/check/pipeline";
import { adminAuth, db } from "@/lib/firebase/admin";
import { parseInstagramUrl } from "@/lib/instagram/url";
import { countReport } from "@/lib/users";

interface Item {
  url: string;
  caption: string;
  claim?: string;
}

const [email, file] = process.argv.slice(2);
if (!email || !file) {
  console.error("사용법: pnpm report-post <제보자 email> <게시물들.json>");
  process.exit(1);
}

const reporter = await adminAuth().getUserByEmail(email.trim().toLowerCase());
const items = JSON.parse(readFileSync(file, "utf8")) as Item[];

for (const item of items) {
  const parsed = parseInstagramUrl(item.url);
  if (!parsed) throw new Error(`인스타그램 게시물 주소가 아닙니다: ${item.url}`);
  const { shortcode, url } = parsed;
  const postRef = db().collection("fc_posts").doc(shortcode);
  if ((await postRef.get()).exists) {
    console.log(`- ${shortcode}: 이미 있는 게시물이라 건너뜀`);
    continue;
  }

  const now = Date.now();
  const claim = item.claim?.trim() || null;
  await db().collection("fc_reports").doc(randomUUID()).set({
    shortcode,
    url,
    claim,
    memo: "운영자 대리 제보 (캡션 옮겨 적음)",
    imagePaths: [],
    reporterUid: reporter.uid,
    ipHash: null,
    createdAt: now,
  });
  await postRef.set({
    shortcode,
    url,
    caption: item.caption.trim(),
    contentText: null,
    claimHints: claim ? [claim] : [],
    imagePaths: [],
    sources: ["report"],
    reportCount: 1,
    createdAt: now,
    updatedAt: now,
  });
  await db().collection("fc_tasks").doc(shortcode).set({
    postId: shortcode,
    url,
    status: "processing",
    reportCount: 1,
    assignee: null,
    expiresAt: null,
    finalComment: null,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, uid: "system", name: "제보", action: "pipeline", note: "제보 접수 (운영자 대리)" }],
  });
  await countReport(reporter.uid);

  await runCheck(shortcode);
  const task = (await db().collection("fc_tasks").doc(shortcode).get()).data() ?? {};
  console.log(`\n## ${shortcode} → ${task.status} / ${task.verdict ?? "-"} (${task.pipelineNote})`);
  if (task.draftComment) console.log(task.draftComment);
}
