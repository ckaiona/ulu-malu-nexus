import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./config/auth";
import App from "./App.jsx";

const msalInstance = new PublicClientApplication(msalConfig);

// Handle redirect promise on load
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(console.error);
  
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>
  );
});
