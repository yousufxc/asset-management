import { NextResponse } from "next/server";
import { getAllData } from "@/lib/db/settings";

export async function GET() {
  const data = getAllData();
  const json = JSON.stringify(data, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="asset-platform-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
