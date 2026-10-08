import { errorResponse, requireMember } from "@/lib/auth/member";
import { db } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** 공백 목록. 많이 걸린 주제부터. */
export async function GET(request: Request) {
  try {
    await requireMember(request);
    const status = new URL(request.url).searchParams.get("status") ?? "open";
    const snap = await db()
      .collection("fc_gaps")
      .where("status", "==", status)
      .orderBy("count", "desc")
      .limit(100)
      .get();
    return Response.json({ gaps: snap.docs.map((d) => ({ key: d.id, ...d.data() })) });
  } catch (error) {
    return errorResponse(error, "gaps");
  }
}
