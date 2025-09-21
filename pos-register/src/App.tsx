// pos-register/src/App.tsx (cashier screen)
import React from "react";
import { PublicAPI, type PublicProduct } from "./services/public.service";
import type { PaymentMethod } from "./services/admin.service";
import { apiPost } from "./services/api";

// ---------- helpers ----------
const STORE_NAME = "Weerasiri Hotel & Bakery";
const money = (cents: number) => (cents / 100).toFixed(2);
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------- quick keys ----------
type QuickItem = {
  label: string;        // button text
  barcode?: string;     // best match (exact)
  sku?: string;         // next best
  query?: string;       // fallback text search
};

// EDIT these 16 to your fast-movers
const QUICK_ITEMS: QuickItem[] = [
  { label: "N Chicken Fried Rice",  sku: "RIC001", query: "N Chicken Fried Rice" },
  { label: "F Checken Fried Rice",  sku: "RIC002", query: "F Chicken Fried Rice" },
  { label: "N Egg Fried Rice",      sku: "RIC003", query: "N Egg Fried Rice" },
  { label: "F Egg Fried Rice",      sku: "RIC004", query: "F Egg Fried Rice" },
  { label: "N Mix Fried Rice",      sku: "RIC009", query: "N Mix Fried Rice" },
  { label: "F Mix Fried Rice",      sku: "RIC010", query: "F Mix Fried Rice" },

  { label: "N Chicken Kottu",       sku: "KOT001", query: "N Chicken Kottu" },
  { label: "F Chicken Kottu",       sku: "KOT002", query: "F Chicken Kottu" },
  { label: "N Egg Kottu",           sku: "KOT003", query: "N Egg Kottu" },
  { label: "F Egg Kottu",           sku: "KOT004", query: "F Egg Kottu" },
  { label: "N Mix Kottu",           sku: "KOT009", query: "N Mix Kottu" },
  { label: "F Mix Kottu",           sku: "KOT010", query: "F Mix Kottu" },

  { label: "Chicken Rice & Curry",  sku: "RIC015", query: "Chicken Rice & Curry" },
  { label: "Fish Rice & Curry",     sku: "RIC016", query: "Fish Rice & Curry" },
  { label: "Beef Rice & Curry",     sku: "RIC019", query: "Beef Rice & Curry" },
  { label: "Pork Rice & Curry",     sku: "RIC020", query: "Pork Rice & Curry" },
];

function colomboYMD() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDailyCode(): string {
  const today = colomboYMD();
  const K_DATE = "pos_daily_code_date";
  const K_SEQ  = "pos_daily_code_seq";

  const lastDate = localStorage.getItem(K_DATE);
  let seq = Number(localStorage.getItem(K_SEQ) || "0");
  if (lastDate !== today) seq = 0;   // reset for a new day
  seq += 1;

  localStorage.setItem(K_DATE, today);
  localStorage.setItem(K_SEQ, String(seq));

  return `${today}-${String(seq).padStart(3, "0")}`;
}

type CartLine = {
  product: PublicProduct;
  qty: number;
  unit_price_cents: number;
  tax_rate_bps: number; // e.g. 1500 = 15%
  line_subtotal_cents: number;
  line_tax_cents: number;
  line_total_cents: number;
};

function makeLine(p: PublicProduct, qty: number): CartLine {
  const rate = p.taxRate?.rate_bps ?? 0;
  const unit = p.price_cents;
  const sub = unit * qty;
  const tax = Math.round((sub * rate) / 10000);
  return {
    product: p,
    qty,
    unit_price_cents: unit,
    tax_rate_bps: rate,
    line_subtotal_cents: sub,
    line_tax_cents: tax,
    line_total_cents: sub + tax,
  };
}

// ---- Print snapshots ----
type ReceiptLine = {
  name: string;
  qty: number;
  unit_cents: number;
  line_total_cents: number;
};

type ReceiptSnapshot = {
  sale_id: number;
  order_code: string; 
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  items: ReceiptLine[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_label: string;
  payment_amount_cents: number;
};

type KotLine = { name: string; qty: number; };
type KotSnapshot = { 
  sale_id: number; 
  order_code: string;
  date: string; 
  time: string; 
  items: KotLine[]; };

type PrintJobType = "RECEIPT" | "KOT";

export default function POSRegister() {
  // search
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<PublicProduct[]>([]);
  const [loading, setLoading] = React.useState(false);

  // cart + methods
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [methods, setMethods] = React.useState<PaymentMethod[]>([]);
  const [showPay, setShowPay] = React.useState(false);
  const [selectedMethodId, setSelectedMethodId] = React.useState<number | null>(null);
  const [lastSaleId, setLastSaleId] = React.useState<number | null>(null);
  const lastLineIndexRef = React.useRef<number | null>(null);

  // KOT manual date for pre-payment KOT
  const [kotDateInput, setKotDateInput] = React.useState<string>(fmtDate(new Date()));

  // Print snapshots
  const [receipt, setReceipt] = React.useState<ReceiptSnapshot | null>(null);
  const [kotSnap, setKotSnap] = React.useState<KotSnapshot | null>(null);

  // Simple print queue (RECEIPT -> KOT)
  const [printQueue, setPrintQueue] = React.useState<PrintJobType[]>([]);
  const [currentJob, setCurrentJob] = React.useState<PrintJobType | null>(null);
  const printingRef = React.useRef(false);

  // quick keys state
  const [quickBusy, setQuickBusy] = React.useState<number | null>(null);
  const [lastOrderCode, setLastOrderCode] = React.useState<string | null>(null);


  // Runner: if there's a job and we're not printing, start it; afterprint advances queue
  React.useEffect(() => {
    if (printingRef.current) return;
    if (currentJob) return;
    if (printQueue.length === 0) return;

    const job = printQueue[0];
    if (job === "RECEIPT" && !receipt) { setPrintQueue(q => q.slice(1)); return; }
    if (job === "KOT" && !kotSnap) { setPrintQueue(q => q.slice(1)); return; }

    printingRef.current = true;
    setCurrentJob(job);

    const cls = job === "RECEIPT" ? "print-receipt" : "print-kot";
    const after = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", after);
      printingRef.current = false;
      setCurrentJob(null);
      setPrintQueue((q) => q.slice(1));
    };

    window.addEventListener("afterprint", after);
    document.body.classList.add(cls);
    window.print();
  }, [printQueue, currentJob, receipt, kotSnap]);

  // load payment methods once
  React.useEffect(() => {
    PublicAPI.paymentMethods().then(setMethods).catch(console.error);
  }, []);

  // debounced text search
  React.useEffect(() => {
    const t = setTimeout(async () => {
      const q = term.trim();
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const items = await PublicAPI.searchProducts(q);
        setResults(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term]);

  // barcode submit
  const onBarcodeSubmit = async (code: string) => {
    try {
      const items = await PublicAPI.lookupBarcode(code);
      if (items[0]) addToCart(items[0]);
    } catch (e) {
      console.error(e);
    }
  };

  // quick key helpers
  async function fetchProductForQuick(qi: QuickItem): Promise<PublicProduct | null> {
    try {
      if (qi.barcode) {
        const items = await PublicAPI.lookupBarcode(qi.barcode);
        return items[0] ?? null;
      }
      if (qi.sku) {
        const items = await PublicAPI.searchProducts(qi.sku);
        return items.find(p => p.sku === qi.sku) ?? items[0] ?? null;
      }
      if (qi.query) {
        const items = await PublicAPI.searchProducts(qi.query);
        const exact = items.find(p => p.name.toLowerCase() === qi.query!.toLowerCase());
        return exact ?? items[0] ?? null;
      }
    } catch (e) {
      console.error("Quick select fetch failed", e);
    }
    return null;
  }

  const onQuickClick = async (idx: number) => {
    const qi = QUICK_ITEMS[idx];
    setQuickBusy(idx);
    const p = await fetchProductForQuick(qi);
    setQuickBusy(null);
    if (p) addToCart(p);
    else alert(`Not found: ${qi.label}`);
  };

  // cart ops
  const addToCart = (p: PublicProduct) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      if (idx >= 0) {
        const updated = [...prev];
        const l = updated[idx];
        const next = makeLine(l.product, l.qty + 1);
        updated[idx] = next;
        lastLineIndexRef.current = idx;
        return updated;
      }
      const next = [...prev, makeLine(p, 1)];
      lastLineIndexRef.current = next.length - 1;
      return next;
    });
  };

  const decQty = (productId: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === productId);
      if (idx < 0) return prev;
      const l = prev[idx];
      if (l.qty <= 1) return prev.filter((x, i) => i !== idx);
      const updated = [...prev];
      updated[idx] = makeLine(l.product, l.qty - 1);
      lastLineIndexRef.current = idx;
      return updated;
    });
  };

  const incQty = (productId: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === productId);
      if (idx < 0) return prev;
      const l = prev[idx];
      const updated = [...prev];
      updated[idx] = makeLine(l.product, l.qty + 1);
      lastLineIndexRef.current = idx;
      return updated;
    });
  };

  const removeLine = (productId: number) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  };

  // totals
  const totals = React.useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.line_subtotal_cents, 0);
    const tax = cart.reduce((s, l) => s + l.line_tax_cents, 0);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [cart]);

  // keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (cart.length > 0) {
          setShowPay(true);
          if (methods.length && selectedMethodId == null) setSelectedMethodId(methods[0].id);
        }
      }
      if (e.key === "F4") {
        e.preventDefault();
        if (!receipt) return alert("No last receipt to print.");
        setPrintQueue((q) => [...q, "RECEIPT"]);
      }
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        addToCart(results[0]);
      }
      const lastIdx = lastLineIndexRef.current;
      if (lastIdx != null && cart[lastIdx]) {
        const pid = cart[lastIdx].product.id;
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          incQty(pid);
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          decQty(pid);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, results, methods, selectedMethodId, receipt]);

  // Build a provisional KOT snapshot from current cart and print (manual)
  const printKOTFromCartNow = React.useCallback(() => {
    if (!cart.length) { alert("Cart is empty"); return; }
    const now = new Date();
    const snap: KotSnapshot = {
      sale_id: lastSaleId ?? 0,
      // OPTION A (doesn't consume the daily sequence):
      order_code: `DRAFT-${kotDateInput}`, 
      // If you prefer to consume a real daily code here too, swap the line above for:
      // order_code: nextDailyCode(),

      date: kotDateInput || fmtDate(now),
      time: fmtTime(now),
      items: cart.map((l) => ({ name: l.product.name, qty: l.qty })),
    };
    setKotSnap(snap);
    setPrintQueue((q) => [...q, "KOT"]);
  }, [cart, kotDateInput, lastSaleId]);

  // pay -> create snapshots -> queue prints -> clear for next order
  const onConfirmPay = async () => {
    if (!cart.length || selectedMethodId == null) return;
    try {
      const orderCode = nextDailyCode();
      const body = {
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.qty,
          unit_price_cents: l.unit_price_cents,
          tax_rate_bps: l.tax_rate_bps,
        })),
        payments: [{ methodId: selectedMethodId, amount_cents: totals.total }],
        totals: {
          subtotal_cents: totals.subtotal,
          tax_cents: totals.tax,
          total_cents: totals.total,
        },
        orderCode,
      };

      const resp = await apiPost<{ id: number }>("/sales", body);
      setLastOrderCode(orderCode);

      const now = new Date();
      const method = methods.find((m) => m.id === selectedMethodId);

      const receiptSnap: ReceiptSnapshot = {
        sale_id: resp.id,
        order_code: orderCode,                 // <-- add
        date: fmtDate(now),
        time: fmtTime(now),
        items: cart.map((l) => ({
          name: l.product.name,
          qty: l.qty,
          unit_cents: l.unit_price_cents,
          line_total_cents: l.line_total_cents,
        })),
        subtotal_cents: totals.subtotal,
        tax_cents: totals.tax,
        total_cents: totals.total,
        payment_label: method?.label ?? method?.code ?? "PAYMENT",
        payment_amount_cents: totals.total,
      };

      const kot: KotSnapshot = {
        sale_id: resp.id,
        order_code: orderCode,                // <-- add
        date: fmtDate(now),
        time: fmtTime(now),
        items: cart.map((l) => ({ name: l.product.name, qty: l.qty })),
      };

      setReceipt(receiptSnap);
      setKotSnap(kot);

      // Queue prints in sequence (Customer -> KOT) — you already do this:
      setPrintQueue((q) => [...q, "RECEIPT", "KOT"]);

      setLastSaleId(resp.id);
      setShowPay(false);
      setCart([]);
      setTerm("");
      setResults([]);
    } catch (e) {
      alert("Failed to post sale. Check console/network for details.");
      console.error(e);
    }
  };

  return (
    <>
      {/* Screen UI */}
      <div className="grid grid-cols-3 gap-4 print:hidden">
        {/* Left: Search + results */}
        <div className="col-span-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = term.trim();
              if (v) onBarcodeSubmit(v);
            }}
          >
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Scan barcode or type name/SKU"
              className="w-full border rounded-xl px-3 py-2 mb-2"
              autoFocus
            />
          </form>

          {/* Quick Keys */}
          <div className="mb-3">
            <div className="text-xs font-medium mb-1">Quick Keys</div>
            <div className="grid grid-cols-4 gap-2">
              {QUICK_ITEMS.map((qi, i) => (
                <button
                  key={i}
                  onClick={() => onQuickClick(i)}
                  className="h-16 rounded-xl border px-2 py-1 text-left hover:bg-gray-50 active:scale-[.99] disabled:opacity-60"
                  disabled={quickBusy === i}
                  title={qi.barcode || qi.sku || qi.query}
                >
                  <div className="font-semibold truncate">{qi.label}</div>
                  <div className="text-[11px] opacity-60 truncate">
                    {qi.barcode || qi.sku || qi.query}
                  </div>
                  {quickBusy === i && <div className="text-[10px] mt-1">Adding…</div>}
                </button>
              ))}
            </div>
          </div>

          {loading && <div>Searching…</div>}
          {!loading && term && results.length === 0 && <div>No matches</div>}

          <ul className="divide-y rounded-xl border">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs opacity-70">
                    {p.sku} {p.barcode ? `• ${p.barcode}` : ""} • {money(p.price_cents)}
                    {p.taxRate?.rate_bps != null ? ` (+${(p.taxRate.rate_bps / 100).toFixed(2)}%)` : ""}
                  </div>
                </div>
                <button className="px-2 py-1 border rounded" onClick={() => addToCart(p)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Cart + totals */}
        <div className="col-span-1">
          <div className="rounded-xl border overflow-hidden">
            <div className="px-3 py-2 font-semibold border-b">Cart</div>
            <ul className="divide-y max-h-[52vh] overflow-auto">
              {cart.map((l) => (
                <li key={l.product.id} className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{l.product.name}</div>
                      <div className="text-xs opacity-70">
                        {l.qty} × {money(l.unit_price_cents)}{" "}
                        {l.tax_rate_bps ? `(+${(l.tax_rate_bps / 100).toFixed(2)}%)` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 border rounded" onClick={() => decQty(l.product.id)}>-</button>
                      <span className="w-8 text-center">{l.qty}</span>
                      <button className="px-2 border rounded" onClick={() => incQty(l.product.id)}>+</button>
                      <button className="px-2 border rounded text-red-600" onClick={() => removeLine(l.product.id)}>
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm mt-1">
                    <span className="opacity-70">Line:</span> {money(l.line_total_cents)}
                  </div>
                </li>
              ))}
              {cart.length === 0 && <li className="px-3 py-6 text-center opacity-70">Empty</li>}
            </ul>

            {/* Totals */}
            <div className="px-3 py-2 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{money(totals.tax)}</span></div>
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span><span>{money(totals.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 border-t flex gap-2 items-center">
              {/* Manual KOT date (pre-payment) 
              <div className="text-xs">
                <label className="block">KOT Date</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={kotDateInput}
                  onChange={(e) => setKotDateInput(e.target.value)}
                />
              </div>
              */}    
              {/* Manual Print KOT from current cart
              <button
                className="px-3 py-2 rounded border"
                onClick={printKOTFromCartNow}
                title="Print KOT (cart only)"
              >
                Print KOT
              </button>
              */}

              {/* Pay */}
              <button
                className="flex-1 px-3 py-2 rounded bg-black text-white disabled:opacity-50"
                onClick={() => {
                  if (!cart.length) return;
                  setShowPay(true);
                  if (methods.length && selectedMethodId == null) setSelectedMethodId(methods[0].id);
                }}
                disabled={!cart.length}
                title="F2"
              >
                Pay (F2)
              </button>

              {/* Reprint Customer Copy (F4) */}
              <button
                className="px-3 py-2 rounded border disabled:opacity-50"
                onClick={() => {
                  if (!receipt) return alert("No last receipt to print.");
                  setPrintQueue((q) => [...q, "RECEIPT"]);
                }}
                title="F4"
                disabled={!receipt}
              >
                Print (F4)
              </button>
            </div>
          </div>

          {/* Last sale info */}
          {lastSaleId && (
            <div className="mt-3 text-xs">
              Last sale: <span className="font-mono">#{lastSaleId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Pay Modal */}
      {showPay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl min-w-[420px] p-4">
            <div className="text-lg font-semibold mb-3">Take Payment</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>Total</div>
                <div className="text-xl font-semibold">{money(totals.total)}</div>
              </div>
              <div>
                <label className="text-sm">Method</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={selectedMethodId ?? ""}
                  onChange={(e) => setSelectedMethodId(Number(e.target.value))}
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>{m.label ?? m.code}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button className="px-3 py-2 border rounded" onClick={() => setShowPay(false)}>Cancel</button>
              <button className="px-3 py-2 rounded bg-black text-white" onClick={onConfirmPay}>Confirm</button>
            </div>
          </div>

        </div>
      )}

      {/* PRINT — CUSTOMER RECEIPT (snapshot) */}
      <div className="print-area print-receipt" aria-hidden>
        <div className="kot">
          <div style={{ textAlign: "center", fontWeight: 800, marginBottom: 2 }}>
            {STORE_NAME}
          </div>
          <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 4 }}>
            CUSTOMER COPY
          </div>

          {receipt ? (
            <>
              <div className="row"><span>Date</span><span>{receipt.date}</span></div>
              <div className="row"><span>Time</span><span>{receipt.time}</span></div>
              <div className="row"><span>Sale #</span><span>#{receipt.sale_id}</span></div>
              <div className="row"><span>Order</span><span>{receipt.order_code}</span></div>  {/* <-- add */}
              <div className="dotted"></div>

              <div>
                {receipt.items.map((it, idx) => (
                  <div key={idx} style={{ margin: "6px 0" }}>
                    <div className="row">
                      <span style={{ flex: 1 }}>{it.name}</span>
                      <span>{(it.line_total_cents / 100).toFixed(2)}</span>
                    </div>
                    <div className="row" style={{ fontSize: 11, opacity: 0.8 }}>
                      <span>{it.qty} × {(it.unit_cents / 100).toFixed(2)}</span>
                      <span></span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dotted"></div>

              <div className="row"><span>Subtotal</span><span>{(receipt.subtotal_cents/100).toFixed(2)}</span></div>
              <div className="row"><span>Tax</span><span>{(receipt.tax_cents/100).toFixed(2)}</span></div>
              <div className="row" style={{ fontWeight: 700 }}>
                <span>Total</span><span>{(receipt.total_cents/100).toFixed(2)}</span>
              </div>

              <div className="dotted"></div>

              <div className="row">
                <span>Paid ({receipt.payment_label})</span>
                <span>{(receipt.payment_amount_cents/100).toFixed(2)}</span>
              </div>

              <div className="dotted"></div>
              <div style={{ textAlign: "center" }} className="text-xs">Thank you!</div>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>No receipt</div>
          )}
        </div>
      </div>

      {/* PRINT — KOT (snapshot) */}
      <div className="print-area print-kot" aria-hidden>
        <div className="kot">
          <div style={{ textAlign: "center", fontWeight: 800, marginBottom: 2 }}>
            {STORE_NAME}
          </div>
          <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 4 }}>
            KITCHEN ORDER TICKET
          </div>

          {kotSnap ? (
            <>
              <div className="row"><span>Date</span><span>{kotSnap.date}</span></div>
              <div className="row"><span>Time</span><span>{kotSnap.time}</span></div>
              <div className="row"><span>Order</span><span>{kotSnap.order_code}</span></div>   {/* <-- add */}
              {kotSnap.sale_id != null && (
                <div className="row"><span>Sale #</span><span>#{kotSnap.sale_id}</span></div>
              )}
              <div className="dotted"></div>
              <div>
                {kotSnap.items.map((l, idx) => (
                  <div key={idx} className="row" style={{ margin: "4px 0" }}>
                    <span style={{ whiteSpace: "nowrap" }}>{l.qty} ×</span>
                    <span style={{ flex: 1 }}>{l.name}</span>
                  </div>
                ))}
              </div>
              <div className="dotted"></div>
              <div style={{ textAlign: "center" }} className="text-xs">— send to kitchen —</div>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>No KOT</div>
          )}
        </div>
      </div>
    </>
  );
}
