import "server-only";

/**
 * 공백 → 잼통 저장소 이슈.
 *
 * 이 앱은 잼통 파일을 쓰지 않는다. 사람이 읽고 잼통의 편집 절차로 옮길 수
 * 있도록 이슈만 연다. 토큰이 없으면 본문만 돌려주고, 운영자가 손으로 올린다.
 */

export interface GapForIssue {
  key: string;
  topic: string;
  count: number;
  examples: { postId: string; claim: string }[];
  officialUrls: string[];
  note: string;
}

export function issueBody(gap: GapForIssue): string {
  return [
    `잼통 신고 센터가 **잼통에 근거가 없어** 판정하지 못한 주제입니다.`,
    "",
    `- 주제: ${gap.topic}`,
    `- 등장 게시물: ${gap.count}건`,
    "",
    "### 게시물에 나온 주장",
    ...gap.examples.map((e) => `- "${e.claim}" — https://www.instagram.com/p/${e.postId}/`),
    "",
    "### 공식 자료 후보 (운영자가 붙임, 미검증)",
    ...(gap.officialUrls.length ? gap.officialUrls.map((u) => `- ${u}`) : ["- (없음)"]),
    ...(gap.note ? ["", "### 메모", gap.note] : []),
    "",
    "---",
    "잼통 편집 절차(draft → 검증 → published)로 등록하면, 배포 후 봇이 버전 변경을 감지해 대기 중인 게시물을 다시 판정합니다.",
    `<!-- factbot-gap:${gap.key} -->`,
  ].join("\n");
}

export async function createIssue(gap: GapForIssue): Promise<{ url: string } | { body: string; title: string }> {
  const title = `[factbot-gap] ${gap.topic}`;
  const body = issueBody(gap);
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.JAMTONG_REPO ?? "EtainClub/jamtong";
  if (!token) return { title, body };

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ title, body, labels: ["factbot-gap"] }),
  });
  if (!res.ok) throw new Error(`GitHub 이슈 생성 실패: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { html_url: string };
  return { url: data.html_url };
}
