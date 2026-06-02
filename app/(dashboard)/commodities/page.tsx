import { listCommodities } from "@/lib/db/queries";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { commodityValueFils } from "@/lib/core/valuation";
import { getSpotFilsPerGram } from "@/lib/integrations/metals";
import type { MetalType } from "@/lib/types";

export const dynamic = "force-dynamic";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};

function daysBetweenIso(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.floor((db - da) / 86_400_000);
}

function daysSince(iso: string | null): string {
  if (!iso) return "never valued";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last valued ${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function CommoditiesPage() {
  const commodities = listCommodities();

  // Determine which metal types are present and fetch spot prices for them
  const metalTypes = [...new Set(commodities.map((c) => c.metal_type as MetalType))];
  const spotMap = new Map<string, { spotFilsPerGram: number; fetchedAt: string }>();

  for (const mt of metalTypes) {
    if (mt === "other") continue; // no spot for "other"
    try {
      const spot = await getSpotFilsPerGram(mt);
      spotMap.set(mt, spot);
    } catch {
      // Spot fetch failed — skip this metal type, show "spot unavailable"
    }
  }

  const fetchedAt = spotMap.size > 0 ? [...spotMap.values()][0]!.fetchedAt : null;
  const fetchStaleness = fetchedAt
    ? `${daysBetweenIso(fetchedAt, new Date().toISOString())}h ago`
    : "unavailable";

  return (
    <>
      <h2>Commodities</h2>
      <div className="stub" style={{ padding: "12px 0" }}>
        <strong>Form in PR #2 (feat/commodities).</strong> Spot prices from{" "}
        <code>api.metals.dev</code>{" "}
        <span className="muted">
          {fetchedAt
            ? `· fetched ${new Date(fetchedAt).toLocaleTimeString("en-AE")}`
            : "· METALS_DEV_API_KEY required in .env.local"}
        </span>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Holdings ({commodities.length})</h3>
        {commodities.length === 0 ? (
          <p className="muted">No commodities yet. Add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Metal</th>
                <th>Weight</th>
                <th>Purity (%)</th>
                <th>Qty</th>
                <th>Est. value (AED)</th>
              </tr>
            </thead>
            <tbody>
              {commodities.map((c) => {
                const spot = spotMap.get(c.metal_type);
                const valuation = spot
                  ? commodityValueFils({
                      weight: c.weight,
                      weightUnit: c.weight_unit,
                      purityFraction: c.purity_fraction,
                      spotFilsPerGram: spot.spotFilsPerGram,
                      quantity: c.quantity,
                    })
                  : null;

                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{METAL_LABEL[c.metal_type] ?? c.metal_type}</td>
                    <td>
                      {c.weight} {c.weight_unit}
                    </td>
                    <td>{(c.purity_fraction * 100).toFixed(1)}%</td>
                    <td>{c.quantity}</td>
                    <td>
                      {valuation ? (
                        <details className="work">
                          <summary>
                            {formatAed(valuation.valueFils)}
                            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                              as of{" "}
                              {spot
                                ? new Date(spot.fetchedAt).toLocaleTimeString("en-AE", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "?"}{" "}
                              ({fetchStaleness})
                            </span>
                          </summary>
                          <div className="work-body">
                            <div>Weight: {c.weight} {c.weight_unit}</div>
                            <div>Purity fraction: {c.purity_fraction}</div>
                            <div>
                              Pure grams: {valuation.pureGrams.toFixed(2)} g (
                              {c.weight} {c.weight_unit} × {c.purity_fraction})
                            </div>
                            <div>
                              Spot price: {formatAed(valuation.spotFilsPerGram)}/g pure
                            </div>
                            <div>Quantity: {valuation.quantity}</div>
                            <hr />
                            <div>
                              <strong>
                                Value: {formatAed(valuation.valueFils)}
                              </strong>{" "}
                              = round({valuation.pureGrams.toFixed(2)} g ×{" "}
                              {valuation.spotFilsPerGram} fils/g) × {valuation.quantity}
                            </div>
                          </div>
                        </details>
                      ) : (
                        <span className="muted">spot unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
