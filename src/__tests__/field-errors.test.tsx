/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useFieldErrors } from "@/lib/hooks/useFieldErrors";
import FieldError from "@/components/common/FieldError";

/**
 * Alan düzeyi hata sözleşmesi: geçersiz alan aria-invalid + kendi hata metnine
 * aria-describedby taşır, başarısız gönderimde odak İLK geçersiz alana gider.
 */
function Probe({ invalid }: { invalid: Array<"a" | "b"> }) {
  const { attachForm, errors, setErrors, fieldProps, errorId } =
    useFieldErrors<"a" | "b">("probe");
  return (
    <form
      ref={attachForm}
      onSubmit={(e) => {
        e.preventDefault();
        setErrors(Object.fromEntries(invalid.map((f) => [f, `${f} hatali`])));
      }}
    >
      <label htmlFor="a">A</label>
      <input id="a" {...fieldProps("a", "a-hint")} />
      <span id="a-hint">ipucu</span>
      <FieldError id={errorId("a")} message={errors.a} />
      <label htmlFor="b">B</label>
      <input id="b" {...fieldProps("b")} />
      <FieldError id={errorId("b")} message={errors.b} />
      <button type="submit">gonder</button>
    </form>
  );
}

describe("useFieldErrors", () => {
  it("hata yokken aria-invalid yok, describedby yalnızca ipucu", () => {
    render(<Probe invalid={[]} />);
    const a = screen.getByLabelText("A");
    expect(a).not.toHaveAttribute("aria-invalid");
    expect(a).toHaveAttribute("aria-describedby", "a-hint");
    expect(screen.getByLabelText("B")).not.toHaveAttribute("aria-describedby");
  });

  it("geçersiz alan aria-invalid ve hata metnine bağlı describedby taşır", () => {
    render(<Probe invalid={["b"]} />);
    fireEvent.click(screen.getByText("gonder"));
    const b = screen.getByLabelText("B");
    expect(b).toHaveAttribute("aria-invalid", "true");
    expect(b).toHaveAccessibleDescription("b hatali");
    expect(screen.getByLabelText("A")).not.toHaveAttribute("aria-invalid");
  });

  it("odak DOM sırasında ilk geçersiz alana gider", () => {
    render(<Probe invalid={["b", "a"]} />);
    fireEvent.click(screen.getByText("gonder"));
    expect(document.activeElement).toBe(screen.getByLabelText("A"));
    expect(screen.getByLabelText("A")).toHaveAccessibleDescription("ipucu a hatali");
  });

  it("yalnızca ikinci alan geçersizse odak oraya gider", () => {
    render(<Probe invalid={["b"]} />);
    fireEvent.click(screen.getByText("gonder"));
    expect(document.activeElement).toBe(screen.getByLabelText("B"));
  });
});
