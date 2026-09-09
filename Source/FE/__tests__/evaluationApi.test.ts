import { describe, expect, it, vi } from "vitest";
import { isEvaluationResult, submitEvaluation } from "@/lib/evaluationApi";

const validResult = {
  score: 80,
  summary: "Phù hợp",
  suitablePoints: ["Kinh nghiệm liên quan"],
  unsuitablePoints: [],
  suggestions: ["Bổ sung số liệu"],
};

describe("evaluation API contract", () => {
  it("accepts a valid evaluation result", () => {
    expect(isEvaluationResult(validResult)).toBe(true);
  });

  it.each([
    ["a score outside 0-100", { ...validResult, score: 101 }],
    ["a non-integer score", { ...validResult, score: 80.5 }],
    ["a missing summary", { ...validResult, summary: undefined }],
    ["a non-array collection", { ...validResult, suggestions: "none" }],
  ])("rejects %s", (_, value) => {
    expect(isEvaluationResult(value)).toBe(false);
  });

  it("returns the validated response and sends FormData without a manual content type", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(validResult), { status: 200 })
      );
    const formData = new FormData();
    formData.append("cv", new File(["cv"], "cv.pdf"));

    await expect(submitEvaluation(formData)).resolves.toEqual(validResult);
    expect(fetchMock).toHaveBeenCalledWith("/api/evaluate", {
      method: "POST",
      body: formData,
    });
    fetchMock.mockRestore();
  });

  it("surfaces backend error messages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Vui lòng chọn file CV." }), {
        status: 400,
      })
    );

    await expect(submitEvaluation(new FormData())).rejects.toThrow(
      "Vui lòng chọn file CV."
    );
    fetchMock.mockRestore();
  });

  it("surfaces network failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));

    await expect(submitEvaluation(new FormData())).rejects.toThrow("offline");
    fetchMock.mockRestore();
  });
});
