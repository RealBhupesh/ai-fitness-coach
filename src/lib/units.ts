export type Units = "metric" | "imperial";
export const kgToLb = (kg: number) => kg * 2.2046226218;
export const lbToKg = (lb: number) => lb / 2.2046226218;
export const cmToFeet = (cm: number) => cm / 30.48;
export const feetToCm = (feet: number) => feet * 30.48;
export function displayMeasurement(value: string, units: Units, kind: "height" | "weight") {
  if (!value || units === "metric") return value;
  return Number((kind === "height" ? cmToFeet(Number(value)) : kgToLb(Number(value))).toFixed(3)).toString();
}
export function canonicalMeasurement(value: string, units: Units, kind: "height" | "weight") {
  if (!value || units === "metric") return value;
  return (kind === "height" ? feetToCm(Number(value)) : lbToKg(Number(value))).toString();
}
