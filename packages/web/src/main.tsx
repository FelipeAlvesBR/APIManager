import React from "react";
import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// Use the locally bundled Monaco instance (offline-friendly, no CDN fetch).
loader.config({ monaco });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);