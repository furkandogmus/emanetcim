/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BagSelector from "@/components/guest/BagSelector";

/**
 * "+" hicbir zaman disabled olmuyordu -- misafir art art tiklayip sunucunun
 * `clampBagCount` ile sessizce kirptigi (varsayilan 50) tutarin cok uzerine
 * cikabiliyordu. Bu test `max` sinirinin gercekten dugmeyi pasif yaptigini
 * kilitliyor (bkz. CheckoutClient.tsx / BookingModifyModal.tsx cagiran taraf).
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: { label?: string }) =>
    ({ increase: `${vars?.label} artir`, decrease: `${vars?.label} azalt` })[key] ?? key,
}));

describe("BagSelector", () => {
  it("max verilmezse '+' hep aktiftir", () => {
    render(
      <BagSelector label="S" sublabel="" count={999} onIncrease={() => {}} onDecrease={() => {}} />,
    );
    expect(screen.getByLabelText("S artir")).not.toBeDisabled();
  });

  it("count max'a esitse '+' pasif olur", () => {
    render(
      <BagSelector label="S" sublabel="" count={5} max={5} onIncrease={() => {}} onDecrease={() => {}} />,
    );
    expect(screen.getByLabelText("S artir")).toBeDisabled();
  });

  it("count max'in altindaysa '+' aktif kalir ve tiklaninca onIncrease cagirilir", () => {
    const onIncrease = vi.fn();
    render(
      <BagSelector label="S" sublabel="" count={4} max={5} onIncrease={onIncrease} onDecrease={() => {}} />,
    );
    const btn = screen.getByLabelText("S artir");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onIncrease).toHaveBeenCalledTimes(1);
  });

  it("disabled '+' tiklamayi engeller", () => {
    const onIncrease = vi.fn();
    render(
      <BagSelector label="S" sublabel="" count={5} max={5} onIncrease={onIncrease} onDecrease={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText("S artir"));
    expect(onIncrease).not.toHaveBeenCalled();
  });
});
