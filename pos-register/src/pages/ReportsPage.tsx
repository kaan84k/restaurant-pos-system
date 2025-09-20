import React from "react";
import { apiGet, apiPost } from "../services/api";

type Totals = {
  subtotal_cents: number; tax_cents: number; total_cents: number;
  paid_cents: number; change_cents: number; sales_count: number;
  payments_by_method: { method: string; amount_cents: number }[];
};

function money(c: number) { return (c/100).toFixed(2); }

export default function ReportsPage() {
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0,10));
  const [terminalId, setTerminalId] = React.useState<string>("");
  const [x, setX] = React.useState<Totals | null>(null);
  const [z, setZ] = React.useState<any | null>(null);
  const [busy, setBusy] = React.useState(false);

  const loadX = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ date, ...(terminalId ? { terminalId } : {}) }).toString();
      const data = await apiGet<any>(`/reports/x?${q}`);
      setX(data);
    } catch(e){ console.error(e); alert("Failed to load X report"); }
    finally{ setBusy(false); }
  };

  const closeZ = async () => {
    if (!confirm("Close the day? This will lock all open sales for the date.")) return;
    setBusy(true);
    try {
      const data = await apiPost<any>("/reports/z", { date, ...(terminalId ? { terminalId } : {}) });
      setZ(data);
      await loadX(); // should show zero open after closing
    } catch(e){ console.error(e); alert(String(e)); }
    finally{ setBusy(false); }
  };

  return (
    <div className="grid gap-4 max-w-2xl">
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm">Business Date</label>
          <input type="date" className="block border rounded px-2 py-1" value={date}
                 onChange={(e)=>setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Terminal (optional)</label>
          <input className="block border rounded px-2 py-1" placeholder="T-1"
                 value={terminalId} onChange={(e)=>setTerminalId(e.target.value)} />
        </div>
        <button className="px-3 py-2 border rounded" onClick={loadX} disabled={busy}>Preview X</button>
        <button className="px-3 py-2 bg-black text-white rounded disabled:opacity-50" onClick={closeZ} disabled={busy}>
          Close Day (Z)
        </button>
      </div>

      {x && (
        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">X Report — {date}{terminalId ? ` • ${terminalId}` : ""}</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Sales count</span><span>{x.sales_count}</span></div>
            <div className="flex justify-between"><span>Subtotal</span><span>{money(x.subtotal_cents)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(x.tax_cents)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{money(x.total_cents)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{money(x.paid_cents)}</span></div>
            <div className="flex justify-between"><span>Change</span><span>{money(x.change_cents)}</span></div>
          </div>
          <div className="mt-3 text-sm">
            <div className="font-medium">Payments by method</div>
            <ul className="mt-1">
              {x.payments_by_method.map((p)=>(
                <li key={p.method} className="flex justify-between">
                  <span>{p.method}</span><span>{money(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          <button className="mt-3 px-3 py-2 border rounded print:hidden" onClick={()=>window.print()}>Print</button>
        </div>
      )}

      {/* Optional: show the just-created Z summary */}
      {z && (
        <div className="border rounded p-3 bg-white">
          <div className="font-semibold mb-2">Z Report Saved (id {z.id})</div>
          <div className="text-sm">Subtotal {money(z.subtotal_cents)} • Tax {money(z.tax_cents)} • Total {money(z.total_cents)}</div>
        </div>
      )}

      {/* 80mm print CSS (add once globally in index.css ideally)
      @media print {
        @page { size: 80mm auto; margin: 4mm; }
        body { background: white !important; }
        .print\:hidden { display: none !important; }
      }
      */}
    </div>
  );
}
