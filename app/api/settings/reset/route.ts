import { NextResponse } from "next/server";
import { resetAllData, exportToDisk } from "@/lib/db/settings";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { confirmation } = body as { confirmation?: string };
  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Must type 'DELETE' to confirm data reset" },
      { status: 400 },
    );
  }

  let backupPath: string;
  try {
    backupPath = exportToDisk();
  } catch (e) {
    return NextResponse.json(
      { error: "Backup failed, reset aborted", detail: String(e) },
      { status: 500 },
    );
  }

  resetAllData();

  return NextResponse.json({
    reset: true,
    backupPath,
    message: "All data deleted. Backup saved to disk.",
  });
}
