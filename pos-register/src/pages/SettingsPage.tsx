// pos-register/src/pages/SettingsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AdminPM,
  AdminProducts,
  AdminTax,
  type PaymentMethod,
  type Product,
  type TaxRate,
} from "../services/admin.service";

export default function SettingsPage() {
  const [tab, setTab] = useState<"products" | "tax" | "payments">("products");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="flex gap-2">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Products
        </TabButton>
        <TabButton active={tab === "tax"} onClick={() => setTab("tax")}>
          Tax Rates
        </TabButton>
        <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
          Payment Methods
        </TabButton>
      </div>
      {tab === "products" && <ProductsPanel />}
      {tab === "tax" && <TaxPanel />}
      {tab === "payments" && <PaymentsPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl border ${
        active ? "bg-black text-white border-black" : "bg-white text-black"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------- Products
function ProductsPanel() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setList(await AdminProducts.list(q, showArchived));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name/SKU/barcode"
          className="border rounded-xl px-3 py-2 min-w-[300px]"
        />
        <button className="px-3 py-2 rounded-xl border" onClick={refresh}>
          Search
        </button>

        <label className="ml-2 text-sm inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              // after toggle, re-query
              setTimeout(refresh, 0);
            }}
          />
          Show archived
        </label>

        <div className="ml-auto" />

        <ImportCsv onImported={refresh} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProductForm onSaved={refresh} />
        <div className="overflow-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>SKU</Th>
                <Th>Name</Th>
                <Th>Barcode</Th>
                <Th className="text-right">Price</Th>
                <Th>Tax</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4">
                    Loading…
                  </td>
                </tr>
              ) : (
                list.map((p) => (
                  <ProductRow key={p.id} p={p} onSaved={refresh} onChanged={refresh} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function ProductRow({
  p,
  onSaved,
  onChanged,
}: {
  p: Product;
  onSaved: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <tr>
        <td colSpan={7}>
          <ProductForm
            existing={p}
            onSaved={() => {
              setEditing(false);
              onSaved();
            }}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    );

  const taxLabel = p.taxRate
    ? `${p.taxRate.name} (${(p.taxRate.rate_bps / 100).toFixed(2)}%)`
    : "—";

  return (
    <tr className="odd:bg-white even:bg-gray-50">
      <Td>{p.sku}</Td>
      <Td>{p.name}</Td>
      <Td>{p.barcode || "—"}</Td>
      <Td className="text-right">{(p.price_cents / 100).toFixed(2)}</Td>
      <Td>{taxLabel}</Td>
      <Td>{p.is_active ? "Yes" : "No"}</Td>
      <Td className="text-right space-x-2">
        <button className="px-2 py-1 rounded border" onClick={() => setEditing(true)}>
          Edit
        </button>

        {p.is_active ? (
          <button
            className="px-2 py-1 rounded border"
            onClick={async () => {
              await AdminProducts.archive(p.id);
              onChanged();
            }}
            title="Archive (soft delete)"
          >
            Archive
          </button>
        ) : (
          <>
            <button
              className="px-2 py-1 rounded border"
              onClick={async () => {
                await AdminProducts.restore(p.id);
                onChanged();
              }}
            >
              Restore
            </button>
            <button
              className="px-2 py-1 rounded border text-red-600"
              onClick={async () => {
                if (!confirm("Hard delete permanently (only if no sales)?")) return;
                try {
                  await AdminProducts.hardDelete(p.id);
                  onChanged();
                } catch (e) {
                  alert("Cannot hard delete: product has sales history. Use Archive instead.");
                  console.error(e);
                }
              }}
            >
              Hard delete
            </button>
          </>
        )}
      </Td>
    </tr>
  );
}

function ProductForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: Partial<Product>;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [name, setName] = useState(existing?.name ?? "");
  const [barcode, setBarcode] = useState(existing?.barcode ?? "");
  const [price, setPrice] = useState(existing ? (existing.price_cents! / 100).toFixed(2) : "");
  const [taxRateId, setTaxRateId] = useState<string>(
    existing?.taxRateId ? String(existing.taxRateId) : ""
  );
  const [active, setActive] = useState(existing?.is_active ?? true);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    AdminTax.list().then(setTaxRates);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const payload: any = {
        sku,
        name,
        barcode: barcode || null,
        price_cents: Math.round(parseFloat(price || "0") * 100),
        taxRateId: taxRateId ? Number(taxRateId) : null,
        is_active: active,
      };
      if (existing?.id) await AdminProducts.update(existing.id, payload);
      else await AdminProducts.create(payload);
      onSaved();
      setSku("");
      setName("");
      setBarcode("");
      setPrice("");
      setTaxRateId("");
      setActive(true);
      onCancel?.();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    }
  };

  return (
    <form onSubmit={submit} className="border rounded-2xl p-3 space-y-2">
      <div className="font-semibold">{existing?.id ? "Edit product" : "New product"}</div>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <div className="grid grid-cols-2 gap-2">
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Barcode"
          value={barcode ?? ""}
          onChange={(e) => setBarcode(e.target.value)}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Price e.g. 25.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        <select
          className="border rounded-xl px-3 py-2"
          value={taxRateId}
          onChange={(e) => setTaxRateId(e.target.value)}
        >
          <option value="">No tax</option>
          {taxRates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({(t.rate_bps / 100).toFixed(2)}%)
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{" "}
          Active
        </label>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        {onCancel && (
          <button type="button" className="px-3 py-2 rounded-xl border" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="px-3 py-2 rounded-xl bg-black text-white">Save</button>
      </div>
    </form>
  );
}

function ImportCsv({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    created: number;
    updated: number;
    errors: { row: number; sku?: string; error: string }[];
  }>(null);
  const templateHref = useMemo(() => {
    const header = "sku,name,barcode,price,tax_rate_name,is_active\n";
    return "data:text/csv;charset=utf-8," + encodeURIComponent(header);
  }, []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await AdminProducts.importProducts(file);
      setResult({ created: r.created, updated: r.updated, errors: r.errors });
      onImported();
      alert(`Import complete.\nCreated: ${r.created}\nUpdated: ${r.updated}\nErrors: ${r.errors.length}`);
      setFile(null);
    } catch (e: any) {
      alert(`Import failed: ${e?.message || e}`);
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        className="px-3 py-2 rounded-xl border disabled:opacity-50"
        onClick={upload}
        disabled={!file || busy}
      >
        {busy ? "Importing…" : file ? `Import "${file.name}"` : "Import CSV"}
      </button>
      <a className="px-3 py-2 rounded-xl border" href={templateHref} download="products-template.csv">
        Download template
      </a>
      {result && result.errors.length > 0 && (
        <span className="text-sm text-amber-700">
          Errors: {result.errors.length} (see console)
        </span>
      )}
    </div>
  );
}

// ---------------- Tax Rates
function TaxPanel() {
  const [list, setList] = useState<TaxRate[]>([]);
  const [name, setName] = useState("");
  const [rate, setRate] = useState(""); // percent
  const refresh = async () => setList(await AdminTax.list());
  useEffect(() => {
    refresh();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await AdminTax.create({ name, rate_bps: Math.round(parseFloat(rate || "0") * 100) });
    setName("");
    setRate("");
    refresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <form onSubmit={add} className="border rounded-2xl p-3 space-y-2">
        <div className="font-semibold">New tax rate</div>
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Rate % e.g. 15"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <button className="px-3 py-2 rounded-xl bg-black text-white">Add</button>
        </div>
      </form>
      <div className="overflow-auto border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>ID</Th>
              <Th>Name</Th>
              <Th>Rate %</Th>
              
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="odd:bg-white even:bg-gray-50">
                <Td>{t.id}</Td>
                <Td>{t.name}</Td>
                <Td>{(t.rate_bps / 100).toFixed(2)}</Td>
                <Td className="text-right">
                  <button
                    className="px-2 py-1 rounded border"
                    onClick={async () => {
                      if (confirm("Delete tax rate?")) {
                        await AdminTax.remove(t.id);
                        refresh();
                      }
                    }}
                  >
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Payment Methods
function PaymentsPanel() {
  const [list, setList] = useState<PaymentMethod[]>([]);
  const [form, setForm] = useState<Partial<PaymentMethod>>({
    code: "",
    label: "",
    is_active: true,
    opens_drawer: false,
    sort: 0,
  });
  const refresh = async () => setList(await AdminPM.list());
  useEffect(() => {
    refresh();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await AdminPM.create(form);
    setForm({ code: "", label: "", is_active: true, opens_drawer: false, sort: 0 });
    refresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <form onSubmit={submit} className="border rounded-2xl p-3 space-y-2">
        <div className="font-semibold">New payment method</div>
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Code (e.g. CASH)"
          value={form.code || ""}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          required
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Label"
          value={form.label || ""}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          required
        />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />{" "}
            Active
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.opens_drawer}
              onChange={(e) =>
                setForm((f) => ({ ...f, opens_drawer: e.target.checked }))
              }
            />{" "}
            Opens drawer
          </label>
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Sort"
            value={form.sort || 0}
            onChange={(e) =>
              setForm((f) => ({ ...f, sort: Number(e.target.value || 0) }))
            }
          />
        </div>
        <div className="flex justify-end">
          <button className="px-3 py-2 rounded-xl bg-black text-white">Add</button>
        </div>
      </form>
      <div className="overflow-auto border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Code</Th>
              <Th>Label</Th>
              <Th>Active</Th>
              <Th>Opens</Th>
              <Th>Sort</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((pm) => (
              <tr key={pm.id} className="odd:bg-white even:bg-gray-50">
                <Td>{pm.code}</Td>
                <Td>{pm.label}</Td>
                <Td>{pm.is_active ? "Yes" : "No"}</Td>
                <Td>{pm.opens_drawer ? "Yes" : "No"}</Td>
                <Td>{pm.sort}</Td>
                <Td className="text-right">
                  <button
                    className="px-2 py-1 rounded border"
                    onClick={async () => {
                      if (confirm("Delete payment method?")) {
                        await AdminPM.remove(pm.id);
                        refresh();
                      }
                    }}
                  >
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
