import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./app/auth";
import AppShell from "./app/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </React.StrictMode>
);
