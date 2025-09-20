import React, { useState } from "react";
import { useAuth } from "../app/auth";


export default function LoginPage(){
const { login } = useAuth();
const [pin, setPin] = useState("");
const [err, setErr] = useState<string| null>(null);


const submit = async (e: React.FormEvent)=>{
e.preventDefault(); setErr(null);
try{ await login(pin); }catch(e:any){ setErr("Invalid PIN"); }
};


return (
<div className="min-h-screen grid place-items-center">
<form onSubmit={submit} className="bg-white rounded-2xl shadow p-6 w-80 space-y-3">
<div className="text-lg font-semibold">Sign in</div>
<input autoFocus className="border rounded-xl px-3 py-2 w-full" type="password" inputMode="numeric" placeholder="Enter PIN" value={pin} onChange={e=>setPin(e.target.value)} />
{err && <div className="text-red-600 text-sm">{err}</div>}
<button className="w-full px-3 py-2 rounded-xl bg-blue-600 text-white">Login</button>
</form>
</div>
);
}