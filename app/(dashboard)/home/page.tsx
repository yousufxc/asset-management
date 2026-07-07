import MarketTicker from "./MarketTicker";
import NewsDigest from "./NewsDigest";
import QuickActions from "./QuickActions";
import Watchlist from "./Watchlist";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <h2>Home</h2>
      <MarketTicker />
      <NewsDigest />
      <Watchlist />
      <QuickActions />
    </>
  );
}
