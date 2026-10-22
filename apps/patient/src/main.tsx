import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import { App } from "./App";

// Phone testing: add ?debug to the address to get an on-screen console (development only).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) {
  void import("eruda").then(({ default: eruda }) => eruda.init());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
