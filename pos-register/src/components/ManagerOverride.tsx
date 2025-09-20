import React, { useState, useEffect } from "react";
import { checkPin } from "../services/auth.service";


export default function ManagerOverride({ open, onClose, onApproved }: { open: boolean; onClose: ()=>void; onApproved: (approver: { name: string; role: "MANAGER"|"ADMIN" })=>void }){
const [pin, setPin] = useState("");
const [err, setErr] = useState<string | null>(null);
useEffect(()=>{ if(open){ setPin(""); setErr(null);} },[open]);
if(!open) return null;
return (
<div className="fixed inset-0 bg-black/40 grid place-items-center p-4">
<div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3">
<div className="text-lg font-semibold">Manager override</div>
<input autoFocus className="border rounded-xl px-3 py-2 w-full" type="password" inputMode="numeric" placeholder="Manager PIN" value={pin} onChange={e=>setPin(e.target.value)} />
{err && <div className="text-red-600 text-sm">{err}</div>}
<div className="flex justify-end gap-2">
<button className="px-3 py-2 rounded-xl bg-gray-100" onClick={onClose}>Cancel</button>
<button className="px-3 py-2 rounded-xl bg-blue-600 text-white" onClick={async()=>{
try{
const res = await checkPin(pin);
if(res.ok && res.user && (res.user.role === "MANAGER" || res.user.role === "ADMIN")) { onApproved({ name: res.user.name, role: res.user.role }); onClose(); }
else setErr("Requires manager/admin PIN");
}catch{ setErr("Invalid PIN"); }
}}>Approve</button>
</div>
</div>
</div>
);
}


// Example usage in Register (restrict price override):
/*
const [overrideOpen, setOverrideOpen] = useState(false);
function onPriceOverrideRequest(){ setOverrideOpen(true); }
<ManagerOverride open={overrideOpen} onClose={()=>setOverrideOpen(false)} onApproved={({name})=>{
const nv = prompt("New unit price (LKR)");
if(nv){ /* set line unit_cents = Math.round(parseFloat(nv)*100) *\/ }
}} />
*/