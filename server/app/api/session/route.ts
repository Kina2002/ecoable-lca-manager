import { reply, session, MAX_BYTES } from "../../../lib/workspace";
export const dynamic = "force-dynamic";
export async function GET() { return reply({ user: await session(), maxBytes: MAX_BYTES }); }
