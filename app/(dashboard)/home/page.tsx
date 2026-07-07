import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import MarketTicker from "./MarketTicker";
import NewsDigest from "./NewsDigest";
import QuickActions from "./QuickActions";
import Watchlist from "./Watchlist";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <h2>Home</h2>
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
