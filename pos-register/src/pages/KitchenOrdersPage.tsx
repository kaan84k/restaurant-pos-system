import React from "react";
import {
  listKitchenOrders,
  updateKitchenOrderStatus,
  type KitchenOrder,
  type KitchenStatus,
} from "../services/kitchen.service";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatOrderCode(order: KitchenOrder) {
  return order.orderCode || `Sale #${order.id}`;
}

export default function KitchenOrdersPage() {
  const [date, setDate] = React.useState<string>(() => todayISO());
  const [status, setStatus] = React.useState<KitchenStatus>("PENDING");
  const [orders, setOrders] = React.useState<KitchenOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listKitchenOrders({ date, status });
      setOrders(res.orders);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [date, status]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const markStatus = async (order: KitchenOrder, next: KitchenStatus) => {
    try {
      await updateKitchenOrderStatus(order.id, next);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm">Business Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="block border rounded px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          {(["PENDING", "COMPLETED"] as KitchenStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-xl border text-sm ${
                status === s
                  ? "bg-black text-white border-black"
                  : "bg-white text-black"
              }`}
            >
              {s === "PENDING" ? "In Kitchen" : "Completed"}
            </button>
          ))}
        </div>
        <button
          className="px-3 py-2 rounded-xl border"
          onClick={load}
          disabled={loading}
        >
          Refresh
        </button>
        {loading && <div className="text-sm text-gray-500">Loading…</div>}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {orders.length === 0 && !loading ? (
          <div className="border rounded-2xl p-4 text-sm text-gray-500 bg-white">
            No orders found for this selection.
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`border rounded-2xl p-4 bg-white shadow-sm ${
                order.kitchenStatus === "COMPLETED"
                  ? "border-green-500/60"
                  : "border-amber-400/60"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="font-semibold text-lg">
                    {formatOrderCode(order)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Terminal {order.terminalId}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {status === "COMPLETED"
                    ? `Done ${formatTime(order.kitchenCompletedAt)}`
                    : `Started ${formatTime(order.createdAt)}`}
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

              {order.kitchenStatus === "PENDING" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    className="px-3 py-2 rounded-xl bg-black text-white text-sm"
                    onClick={() => markStatus(order, "COMPLETED")}
                    disabled={loading}
                  >
                    Mark Completed
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl border text-sm"
                    onClick={load}
                    disabled={loading}
                  >
                    Reload
                  </button>
                </div>
              ) : (
                <div className="mt-4 text-xs text-green-600">
                  Completed at {formatTime(order.kitchenCompletedAt)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
