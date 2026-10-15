import { describe, expect, it } from "vitest";
import { kgToLb,lbToKg,cmToFeet,feetToCm } from "@/lib/units";
describe("measurement units",()=>{
 it("round-trips canonical measurements",()=>{expect(lbToKg(kgToLb(75))).toBeCloseTo(75,8);expect(feetToCm(cmToFeet(180))).toBeCloseTo(180,8);});
});
