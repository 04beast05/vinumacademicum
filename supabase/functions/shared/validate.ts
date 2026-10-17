export const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// Kontrolna znamenka hrvatskog OIB-a (ISO 7064, MOD 11,10)
export function oibOk(o: string): boolean {
  if (!/^\d{11}$/.test(o)) return false;
  let a = 10;
  for (let i = 0; i < 10; i++) { a = (a + Number(o[i])) % 10; if (a === 0) a = 10; a = (a * 2) % 11; }
  let k = 11 - a; if (k === 10) k = 0;
  return k === Number(o[10]);
}
export const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) && e.length <= 120;
export function phoneOk(p: string): boolean {
  if (!/^\+?[\d\s()./-]+$/.test(p)) return false;
  const d = p.replace(/\D/g, "").length;
  return d >= 8 && d <= 15;
}
export const postalOk = (p: string) => /^\d{5}$/.test(p);
