import { NextResponse } from "next/server";
import { z } from "zod";
import { getAllSettings, setSetting } from "@/lib/db/settings";

const SettingsUpdateSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

const VALID_KEYS: Record<string, z.ZodType<string>> = {
  runwayHorizonDays: z
    .string()
    .refine((v) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && Number.isInteger(n) && n >= 7 && n <= 365;
    }, "must be an integer between 7 and 365"),
  theme: z.enum(["dark", "light"]),
  anthropicApiKey: z.string().min(1, "API key cannot be empty"),
  assetSelection: z.string().refine((v) => {
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) && arr.every((s: unknown) => typeof s === "string");
    } catch {
      return false;
    }
  }, "must be a JSON array of strings"),
};

export async function GET() {
  return NextResponse.json({ settings: getAllSettings() });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { key, value } = parsed.data;
  const validator = VALID_KEYS[key];
  if (!validator) {
    return NextResponse.json(
      { error: "Unknown setting key", key },
      { status: 400 },
    );
  }

  const valueParsed = validator.safeParse(value);
  if (!valueParsed.success) {
    return NextResponse.json(
      { error: "Invalid value for key", key, issues: valueParsed.error.flatten() },
      { status: 400 },
    );
  }

  setSetting(key, value);
  return NextResponse.json({ key, value, updated: true });
}
