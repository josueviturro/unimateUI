import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StudioProvider } from "./state/StudioContext";
import "./styles/design_tokens.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <StudioProvider>
      <App />
    </StudioProvider>
  </StrictMode>,
);
