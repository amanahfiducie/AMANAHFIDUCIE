import type { FaraidFraction } from "@/lib/faraid/types";

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  if (!a || !b) return a || b || 1;
  return Math.abs((a * b) / gcd(a, b));
}

export function simplify({ numerator, denominator }: FaraidFraction): FaraidFraction {
  if (denominator === 0) return { numerator: 0, denominator: 1 };
  const g = gcd(numerator, denominator);
  return { numerator: numerator / g, denominator: denominator / g };
}

export function frac(n: number, d: number): FaraidFraction {
  return simplify({ numerator: n, denominator: d });
}

export function addFractions(a: FaraidFraction, b: FaraidFraction): FaraidFraction {
  const d = lcm(a.denominator, b.denominator);
  const n =
    a.numerator * (d / a.denominator) + b.numerator * (d / b.denominator);
  return simplify({ numerator: n, denominator: d });
}

export function fractionToDecimal(f: FaraidFraction): number {
  if (f.denominator === 0) return 0;
  return f.numerator / f.denominator;
}

export function formatFraction(f: FaraidFraction): string {
  const s = simplify(f);
  if (s.denominator === 1) return String(s.numerator);
  return `${s.numerator}/${s.denominator}`;
}
