/**
 * DEEPSEEK IMPLEMENTATION TARGET — Task P1-UI-COMMODITIES (see docs/TASKS.md).
 * Mirror the /properties reference slice:
 *   - client form -> POST /api/commodities (validate with CommodityInputSchema)
 *     Capture metal_type, weight + weight_unit, purity (offer karat input ->
 *     karatToFraction) , form, quantity, storage.
 *   - server list with show-your-work value lineage (commodityValueFils) once
 *     the Phase-2 Metals.dev spot feed exists; until then show weight/purity.
 * Contract already exists: CommodityInputSchema, insertCommodity, listCommodities.
 */

import { listCommodities } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function CommoditiesPage() {
  const commodities = listCommodities();

  return (
    <>
      <h2>Commodities</h2>
      <div className="stub">
        <strong>Form not built yet.</strong> DeepSeek to implement per{" "}
        <code>docs/TASKS.md</code> task <code>P1-UI-COMMODITIES</code>, mirroring{" "}
        <code>app/(dashboard)/properties/</code>. Backend contract is ready:{" "}
        <code>CommodityInputSchema</code> + <code>insertCommodity</code>.
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Holdings ({commodities.length})</h3>
        {commodities.length === 0 ? (
          <p className="muted">No commodities yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Metal</th><th>Weight</th><th>Purity</th><th>Qty</th></tr>
            </thead>
            <tbody>
              {commodities.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.metal_type}</td>
                  <td>{c.weight} {c.weight_unit}</td>
                  <td>{(c.purity_fraction * 100).toFixed(1)}%</td>
                  <td>{c.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
