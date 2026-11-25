"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { formatCurrency } from "@/lib/utils";

type Item = {
  id: string;
  room: string;
  quantity: number;
  itemName: string;
  brand: string | null;
  modelNumber: string | null;
  description: string | null;
  condition: string | null;
  matchKind: string;
  productTitle: string | null;
  productUrl: string | null;
  listedPrice: string | null;
  priceNote: string | null;
  confirmedUnitCost: string | null;
  confirmed: boolean;
  notes: string | null;
  sourceApp: string;
  photoHref: string | null;
  createdByName: string;
};

const MATCH: Record<string, string> = {
  SAME: "Same product",
  SIMILAR: "Similar product",
  UNIDENTIFIED: "Not identified",
};

export function ContentsTab({ claimId, editable }: { claimId: string; editable: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [room, setRoom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/claims/${claimId}/contents`);
    if (!res.ok) {
      setError("The contents inventory could not be loaded.");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items);
    setLoading(false);
  }, [claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmedTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!item.confirmed) return sum;
        const unit = Number(item.confirmedUnitCost ?? item.listedPrice);
        return Number.isFinite(unit) ? sum + unit * item.quantity : sum;
      }, 0),
    [items]
  );

  async function price(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("room", room);
      form.set("file", file);
      const res = await fetch(`/api/claims/${claimId}/contents`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: Item };
      if (!res.ok || !data.item) throw new Error(data.error || "The product search did not finish.");
      setItems((current) => [data.item!, ...current]);
      setFile(null);
      setRoom("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The product search did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(item: Item, quantity: number, unitCost: string) {
    setError("");
    const res = await fetch(`/api/claims/${claimId}/contents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        quantity,
        unitCost: unitCost === "" ? null : Number(unitCost),
        confirmed: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; item?: Item };
    if (!res.ok || !data.item) {
      setError(data.error || "The line could not be confirmed.");
      return;
    }
    setItems((current) => current.map((row) => (row.id === data.item!.id ? data.item! : row)));
  }

  async function remove(id: string) {
    const res = await fetch(`/api/claims/${claimId}/contents?itemId=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("The line could not be removed. The photo stays in the document vault.");
      return;
    }
    setItems((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Coverage C</p>
        <h2 className="mt-1 font-serif text-2xl text-brand-white">Contents inventory</h2>
        <p className="mt-2 max-w-2xl text-sm text-brand-slate">
          Photograph a household item. A low-cost model finds the same product, or the closest
          similar one, and starts the replacement cost. Confirmed lines are the inventory. They
          are not a coverage decision.
        </p>
        <p className="mt-3 text-sm text-brand-white">
          Confirmed replacement total {formatCurrency(confirmedTotal)}
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {editable ? (
        <form onSubmit={price} className="grid gap-4 rounded-2xl border border-brand-gold/15 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="contents-room">Room or area</Label>
            <Input id="contents-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Kitchen" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contents-photo">Photo</Label>
            <Input
              id="contents-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <Button type="submit" disabled={busy || room.trim().length < 2 || !file}>
            {busy ? "Searching…" : "Price this item"}
          </Button>
        </form>
      ) : null}

      {loading ? <p className="text-sm text-brand-slate">Loading inventory…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-brand-slate">No contents lines yet. Field photos from BLACKMIRROR land here too.</p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => (
          <ContentsLine key={item.id} item={item} editable={editable} onConfirm={confirm} onRemove={remove} />
        ))}
      </ul>
    </div>
  );
}

function ContentsLine({
  item,
  editable,
  onConfirm,
  onRemove,
}: {
  item: Item;
  editable: boolean;
  onConfirm: (item: Item, quantity: number, unitCost: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitCost, setUnitCost] = useState(item.confirmedUnitCost ?? item.listedPrice ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <li className="grid gap-4 rounded-2xl border border-brand-gold/15 p-4 sm:grid-cols-[120px_1fr]">
      {item.photoHref ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoHref} alt="" className="h-28 w-full rounded-lg object-cover sm:w-[120px]" />
      ) : (
        <div className="h-28 rounded-lg bg-brand-navy" />
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-serif text-lg text-brand-white">{item.itemName}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
            {MATCH[item.matchKind] ?? item.matchKind}
            {item.confirmed ? " · Confirmed" : " · Draft"}
          </p>
        </div>
        <p className="text-xs text-brand-slate">
          {item.room}
          {item.brand ? ` · ${item.brand}` : ""}
          {item.modelNumber ? ` · ${item.modelNumber}` : ""}
          {item.condition ? ` · ${item.condition}` : ""} · {item.sourceApp === "BLACKMIRROR" ? "Field" : "Office"} · {item.createdByName}
        </p>
        {item.description ? <p className="text-sm text-brand-white/80">{item.description}</p> : null}
        {item.productTitle ? (
          <p className="text-sm">
            {item.productUrl ? (
              <a href={item.productUrl} target="_blank" rel="noreferrer" className="text-brand-gold underline underline-offset-4">
                {item.productTitle}
              </a>
            ) : (
              item.productTitle
            )}
          </p>
        ) : null}
        <p className="text-xs text-brand-slate">
          {item.priceNote}
          {item.listedPrice ? ` Listed ${formatCurrency(item.listedPrice)}.` : ""}
        </p>
        {editable ? (
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="space-y-1">
              <Label htmlFor={`qty-${item.id}`}>Qty</Label>
              <Input id={`qty-${item.id}`} inputMode="numeric" className="w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cost-${item.id}`}>Unit cost</Label>
              <Input id={`cost-${item.id}`} inputMode="decimal" className="w-32" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onConfirm(item, Number(quantity) || 1, unitCost).finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Confirm line"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void onRemove(item.id)}>
              Remove line
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
