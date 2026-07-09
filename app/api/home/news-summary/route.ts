import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "@/lib/db/settings";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  section: "gulf" | "global";
}

const FEEDS: { url: string; source: string; section: "gulf" | "global" }[] = [
  { url: "https://gulfnews.com/stories.rss", source: "Gulf News", section: "gulf" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC", section: "global" },
];

function parseRssXml(xml: string): { title: string; link: string; pubDate: string }[] {
  const items: { title: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const body = match[1]!;
    const title = body.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const link = body.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = body.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

async function fetchFeed(feed: { url: string; source: string; section: "gulf" | "global" }): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml).map((item) => ({
      ...item,
      source: feed.source,
      section: feed.section,
    }));
  } catch {
    return [];
  }
}

async function fetchHeadlines(): Promise<NewsItem[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  return results
    .flat()
    .filter((item) => {
      const key = `${item.source}:${item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 20);
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let cachedSummary: { text: string; ts: number } | null = null;

export async function GET() {
  if (cachedSummary && Date.now() - cachedSummary.ts < CACHE_TTL_MS) {
    return NextResponse.json({ summary: cachedSummary.text, cached: true });
  }

  const headlines = await fetchHeadlines();
  if (headlines.length === 0) {
    return NextResponse.json({ summary: "No headlines available right now.", cached: false });
  }

  const apiKey = (() => {
    try {
      return getSetting("anthropicApiKey");
    } catch {
      return null;
    }
  })();

  if (!apiKey) {
    const fallback = generateFallbackSummary(headlines);
    cachedSummary = { text: fallback, ts: Date.now() };
    return NextResponse.json({ summary: fallback, cached: false });
  }

  const headlineText = headlines
    .map((h) => `[${h.section === "gulf" ? "Gulf" : "Global"} | ${h.source}] ${h.title}`)
    .join("\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system:
        "You are a financial news analyst producing a brief daily briefing for a UAE-based investor. " +
        "Write 3-4 concise, insightful sentences that capture the most important themes, trends, or events " +
        "from the headlines provided. Focus on what matters for someone managing a multi-asset portfolio " +
        "(property, commodities, cash, land). Be specific — mention actual data points, sectors, or regions " +
        "when possible. Never use placeholder language like 'some analysts say'. Start directly, no preamble.",
      messages: [
        {
          role: "user",
          content:
            "Summarise the key takeaways from these Gulf and Global business headlines in 3-4 sentences.\n\nHEADLINES:\n" +
            headlineText,
        },
      ],
    });

    const text =
      msg.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim() || generateFallbackSummary(headlines);

    cachedSummary = { text, ts: Date.now() };
    return NextResponse.json({ summary: text, cached: false });
  } catch {
    const fallback = generateFallbackSummary(headlines);
    cachedSummary = { text: fallback, ts: Date.now() };
    return NextResponse.json({ summary: fallback, cached: false });
  }
}

function generateFallbackSummary(headlines: NewsItem[]): string {
  const gulfCount = headlines.filter((h) => h.section === "gulf").length;
  const globalCount = headlines.filter((h) => h.section === "global").length;
  const topThree = headlines.slice(0, 3).map((h) => `"${h.title}"`).join("; ");
  return (
    `Today's briefing covers ${gulfCount} Gulf and ${globalCount} global business stories. ` +
    `Key headlines include: ${topThree}. Open the AI Chat for deeper analysis of any story.`
  );
}
