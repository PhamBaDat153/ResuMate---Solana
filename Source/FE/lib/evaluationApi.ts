export type EvaluationResult = {
  score: number;
  summary: string;
  suitablePoints: string[];
  unsuitablePoints: string[];
  suggestions: string[];
};

const RESULT_COLLECTIONS = [
  "suitablePoints",
  "unsuitablePoints",
  "suggestions",
] as const;

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isEvaluationResult(value: unknown): value is EvaluationResult {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.score !== "number" ||
    !Number.isInteger(candidate.score) ||
    candidate.score < 0 ||
    candidate.score > 100 ||
    typeof candidate.summary !== "string"
  ) {
    return false;
  }

  return RESULT_COLLECTIONS.every((key) => isStringArray(candidate[key]));
}

export async function submitEvaluation(
  formData: FormData
): Promise<EvaluationResult> {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    body: formData,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại.");
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Không thể đánh giá CV. Vui lòng thử lại.";
    throw new Error(message);
  }

  if (!isEvaluationResult(body)) {
    throw new Error("Kết quả đánh giá không hợp lệ. Vui lòng thử lại.");
  }

  return body;
}
