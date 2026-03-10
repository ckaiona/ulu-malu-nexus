import ReactDOM from 'react-dom/client'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import App from './App'
import { msalConfig, MSAL_ENABLED } from './lib/msalConfig'

const msalInstance = MSAL_ENABLED ? new PublicClientApplication(msalConfig) : null

// Handle redirect promise (needed for redirect flow)
if (msalInstance) {
  msalInstance.initialize().then(() => {
    msalInstance.handleRedirectPromise().catch(console.error)
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))

if (msalInstance) {
  root.render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  )
} else {
  // MSAL not configured yet — app runs in read-only/mock mode
  root.render(<App />)
}
