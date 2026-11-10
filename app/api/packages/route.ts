import { readPackages } from "@/lib/read-packages";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await readPackages());
}
