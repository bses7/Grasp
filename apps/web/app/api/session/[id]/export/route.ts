/**
 * GET /api/session/:id/export: the participant's own data, the six MVP tables as one JSON document (doc 09, doc 14
 * section 7). The id must equal the cookie's sessionId; the researcher exports by participant code with
 * `pnpm research:export`.
 */
import { exportSession } from "@grasp/db";
import { z } from "zod";
import { cookieSessionId, forbidden, getDb, unavailable } from "@/lib/db";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || cookieSessionId(request) !== id) return forbidden();
  const db = getDb();
  if (!db) return unavailable();
  try {
    return Response.json(await exportSession(db, id), {
      headers: { "content-disposition": `attachment; filename="grasp-data-${id.slice(0, 8)}.json"` },
    });
  } catch (err) {
    console.error("GET /api/session/:id/export", err);
    return unavailable();
  }
}
