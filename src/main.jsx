import React from "react";
import ReactDOM from "react-dom/client";
import MensaCheck from "./MensaCheck.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { registerServiceWorker } from "./Push.jsx";

registerServiceWorker();   // für Push-Nachrichten und damit die App auch ohne Netz öffnet

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary full>
      <MensaCheck />
    </ErrorBoundary>
  </React.StrictMode>
);
