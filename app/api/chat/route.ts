import { NextRequest } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/settings";
import {
  listProperties,
  listCashAccounts,
  listCommodities,
  listAllInstallments,
} from "@/lib/db/queries";
import { buildSystemPrompt } from "@/lib/core/chat";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", issues: parsed.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKey = (() => {
    try {
      return getSetting("anthropicApiKey");
    } catch {
      return null;
    }
  })();

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Anthropic API key not configured. Add it in Settings." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const properties = listProperties();
  const cashAccounts = listCashAccounts();
  const commodities = listCommodities();
  const installments = listAllInstallments();

  const todayIso = new Date().toISOString().slice(0, 10);
  const systemPrompt = buildSystemPrompt(
    { properties, cashAccounts, commodities, installments },
    todayIso,
  );

  const anthropic = new Anthropic({ apiKey });

  try {
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: parsed.data.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return new Response(stream.toReadableStream(), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Anthropic API error", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
