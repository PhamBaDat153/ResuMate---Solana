import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import ResultPage from "./ResultPage";

const result = {
  score: 91,
  summary: "Kết quả từ backend",
  matchedKeywords: ["React"],
  missingKeywords: [],
  suitablePoints: ["Có kinh nghiệm phù hợp"],
  unsuitablePoints: [],
  suggestions: ["Bổ sung thành tựu"],
};

describe("ResultPage", () => {
  it("renders an empty state without route result data", () => {
    render(
      <MemoryRouter initialEntries={["/result"]}>
        <ResultPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Chưa có kết quả đánh giá")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Bắt đầu đánh giá" })
    ).toHaveAttribute("href", "/evaluate");
  });

  it("renders backend values and empty collection messages", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/result", state: result }]}>
        <ResultPage />
      </MemoryRouter>
    );

    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("Kết quả từ backend")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Không có từ khóa còn thiếu.")).toBeInTheDocument();
    expect(
      screen.getByText("Không có điểm cần cải thiện nào.")
    ).toBeInTheDocument();
  });
});
