import React from "react";
import ReactDOM from "react-dom/client";
import MensaCheck from "./MensaCheck.jsx";
import { registerServiceWorker } from "./Push.jsx";

registerServiceWorker();   // für Push-Nachrichten

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MensaCheck />
  </React.StrictMode>
);
