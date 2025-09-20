export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => (c / 100);
export const sumCents = (vals: number[]) => vals.reduce((a,b)=>a+b,0);