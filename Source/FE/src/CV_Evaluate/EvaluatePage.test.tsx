import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvaluatePage from "./EvaluatePage";

const navigateMock = vi.fn();

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/evaluate"]}>
      <EvaluatePage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigateMock.mockReset();
});

describe("EvaluatePage", () => {
  it("validates missing CV and JD without sending a request", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Vui lòng chọn file CV"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends pasted JD fields and navigates with a successful result", async () => {
    const result = {
      score: 75,
      summary: "Tốt",
      matchedKeywords: [],
      missingKeywords: [],
      suitablePoints: [],
      unsuitablePoints: [],
      suggestions: [],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    renderPage();
    fireEvent.change(document.querySelector('input[name="cv"]')!, {
      target: {
        files: [new File(["cv"], "cv.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.change(document.querySelector("textarea")!, {
      target: { value: "Frontend Developer" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/result", { state: result })
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("cv")).toBeInstanceOf(File);
    expect(body.get("jobDescription")).toBe("Frontend Developer");
    expect(body.get("jobDescriptionFile")).toBeNull();
  });

  it("shows a pending state and prevents a duplicate submission", async () => {
    let resolveRequest: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    renderPage();
    fireEvent.change(document.querySelector('input[name="cv"]')!, {
      target: { files: [new File(["cv"], "cv.pdf")] },
    });
    fireEvent.change(document.querySelector("textarea")!, {
      target: { value: "JD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));

    expect(screen.getByRole("status")).toHaveTextContent("Đang phân tích CV");
    expect(
      screen.getByRole("button", { name: "Đang đánh giá..." })
    ).toBeDisabled();
    resolveRequest(new Response(JSON.stringify({}), { status: 500 }));
  });

  it("sends the uploaded JD field when file mode is active", async () => {
    const result = {
      score: 70,
      summary: "Đạt",
      matchedKeywords: [],
      missingKeywords: [],
      suitablePoints: [],
      unsuitablePoints: [],
      suggestions: [],
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    renderPage();
    fireEvent.change(document.querySelector('input[name="cv"]')!, {
      target: { files: [new File(["cv"], "cv.pdf")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tải file" }));
    fireEvent.change(
      document.querySelector('input[name="jobDescriptionFile"]')!,
      {
        target: { files: [new File(["jd"], "job-description.pdf")] },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("jobDescriptionFile")).toBeInstanceOf(File);
    expect(body.get("jobDescription")).toBeNull();
  });
});
