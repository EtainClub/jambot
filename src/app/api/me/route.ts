import { errorResponse, requireMember } from "@/lib/auth/member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const m = await requireMember(request);
    return Response.json({ uid: m.uid, email: m.email, name: m.name, role: m.role });
  } catch (error) {
    return errorResponse(error, "me");
  }
}
