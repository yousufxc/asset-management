import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import MarketInsights from "./MarketInsights";
import MarketTicker from "./MarketTicker";
import NewsDigest from "./NewsDigest";
import QuickActions from "./QuickActions";
import Watchlist from "./Watchlist";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  return (
    <>
      <h2>News</h2>
      <MarketInsights />
      <AnimateOnScroll delay={0}>
        <MarketTicker />
      </AnimateOnScroll>
      <AnimateOnScroll delay={150}>
        <NewsDigest />
      </AnimateOnScroll>
      <AnimateOnScroll delay={300}>
        <Watchlist />
      </AnimateOnScroll>
      <AnimateOnScroll delay={450}>
        <QuickActions />
      </AnimateOnScroll>
    </>
  );
}
