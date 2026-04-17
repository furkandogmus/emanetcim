/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PrintButton from "./PrintButton";

describe("PrintButton", () => {
  it("should render with correct label", () => {
    render(<PrintButton label="Bilet Yazdır" />);
    expect(screen.getByText("Bilet Yazdır")).toBeInTheDocument();
  });

  it("should call window.print when clicked", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    
    render(<PrintButton label="Print" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});
