import { BrowserRouter, Route, Routes } from "react-router";
import EvaluatePage from "./CV_Evaluate/EvaluatePage";
import HomePage from "./HomePage";
import ResultPage from "./CV_Evaluate/ResultPage";
import { Sidebar } from "./Sidebar";

export default function App() {
  return (
    <BrowserRouter>
      <Sidebar>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/evaluate" element={<EvaluatePage />} />
          <Route path="/result" element={<ResultPage />} />
        </Routes>
      </Sidebar>
    </BrowserRouter>
  );
}
