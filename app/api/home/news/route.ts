import { NextResponse } from "next/server";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  section: "gulf" | "global";
}

const FEEDS: { url: string; source: string; section: "gulf" | "global" }[] = [
  { url: "https://gulfnews.com/business/rss", source: "Gulf News", section: "gulf" },
  { url: "https://www.khaleejtimes.com/business/rss", source: "Khaleej Times", section: "gulf" },
  { url: "https://feeds.reuters.com/reuters/businessNews", source: "Reuters", section: "global" },
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

export async function GET() {
  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    const items = results.flat().sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    }).slice(0, 20);

    const gulf = items.filter((i) => i.section === "gulf");
    const global = items.filter((i) => i.section === "global");

    return NextResponse.json({ gulf, global });
  } catch {
    return NextResponse.json({ gulf: [], global: [], error: "News temporarily unavailable" }, { status: 200 });
  }
}
