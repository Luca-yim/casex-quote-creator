import { describe, expect, it } from "vitest";
import { calculateB2cLineItem, selectB2cPack } from "./b2c-portal-packs";
import { TEST_CATALOG } from "./__test-fixtures__/catalog";

describe("selectB2cPack", () => {
  it("returns pack1 for 500 MAU", () => {
    expect(selectB2cPack(500, TEST_CATALOG)?.sku_id).toBe("b2c_pack1");
  });

  it("returns pack2 for 5,000 MAU", () => {
    expect(selectB2cPack(5000, TEST_CATALOG)?.sku_id).toBe("b2c_pack2");
  });

  it("returns pack3 for 25,000 MAU", () => {
    expect(selectB2cPack(25000, TEST_CATALOG)?.sku_id).toBe("b2c_pack3");
  });

  it("returns pack4 for 75,000 MAU", () => {
    expect(selectB2cPack(75000, TEST_CATALOG)?.sku_id).toBe("b2c_pack4");
  });

  it("returns pack5 for 150,000 MAU", () => {
    expect(selectB2cPack(150000, TEST_CATALOG)?.sku_id).toBe("b2c_pack5");
  });

  it("returns null for 0 MAU", () => {
    expect(selectB2cPack(0, TEST_CATALOG)).toBeNull();
  });

  describe("boundaries", () => {
    it("1,000 MAU stays in pack1", () => {
      expect(selectB2cPack(1000, TEST_CATALOG)?.sku_id).toBe("b2c_pack1");
    });

    it("1,001 MAU moves to pack2", () => {
      expect(selectB2cPack(1001, TEST_CATALOG)?.sku_id).toBe("b2c_pack2");
    });

    it("10,000 MAU stays in pack2", () => {
      expect(selectB2cPack(10000, TEST_CATALOG)?.sku_id).toBe("b2c_pack2");
    });

    it("10,001 MAU moves to pack3", () => {
      expect(selectB2cPack(10001, TEST_CATALOG)?.sku_id).toBe("b2c_pack3");
    });

    it("50,001 MAU moves to pack4", () => {
      expect(selectB2cPack(50001, TEST_CATALOG)?.sku_id).toBe("b2c_pack4");
    });

    it("above 200,000 MAU falls back to pack5", () => {
      expect(selectB2cPack(500000, TEST_CATALOG)?.sku_id).toBe("b2c_pack5");
    });
  });
});

describe("calculateB2cLineItem", () => {
  it("prices 500 MAU at $833 monthly", () => {
    const item = calculateB2cLineItem(500, TEST_CATALOG);
    expect(item?.subtotal).toBe(833);
    expect(item?.quantity).toBe(1);
    expect(item?.category).toBe("monthly");
  });

  it("prices 25,000 MAU at $4,167 monthly", () => {
    expect(calculateB2cLineItem(25000, TEST_CATALOG)?.subtotal).toBe(4167);
  });

  it("returns null for 0 MAU", () => {
    expect(calculateB2cLineItem(0, TEST_CATALOG)).toBeNull();
  });

  it("returns null when the catalog lacks packs", () => {
    expect(calculateB2cLineItem(500, [])).toBeNull();
  });
});
