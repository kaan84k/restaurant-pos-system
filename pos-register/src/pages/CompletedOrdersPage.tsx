import React from "react";
import { listKitchenOrders, type KitchenOrder } from "../services/kitchen.service";

function formatTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatOrderCode(order: KitchenOrder) {
  return order.orderCode || `Sale #${order.id}`;
}

export default function CompletedOrdersPage() {
  const [orders, setOrders] = React.useState<KitchenOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listKitchenOrders({ status: "COMPLETED", limit: 100 });
      setOrders(res.orders);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load completed orders");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Completed Orders</div>
        <button
          className="px-3 py-2 rounded-xl border text-sm"
          onClick={load}
          disabled={loading}
        >
          Refresh
        </button>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-3">
        {orders.length === 0 && !loading ? (
          <div className="border rounded-2xl p-4 text-sm text-gray-500 bg-white">
            No completed orders yet.
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="border rounded-2xl p-4 bg-white shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold text-lg">{formatOrderCode(order)}</div>
                  <div className="text-xs text-gray-500">Terminal {order.terminalId}</div>
                </div>
                <div className="text-sm text-gray-600">
                  Completed {formatTime(order.kitchenCompletedAt)}
                </div>
              </div>

              <ul className="mt-3 text-sm space-y-1">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="font-mono">×{item.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
