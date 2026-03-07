# ULU MALU Nexus

Command-and-control dashboard for ULU MALU Systems — built with React + Vite and backed by Azure & SharePoint.

## SharePoint Lists Setup

The dashboard reads live data from SharePoint lists. Run the included PowerShell script once to provision all required lists in your SharePoint site.

### Prerequisites

- [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
  - macOS: `brew install powershell`
  - Windows: available from the Microsoft Store or via `winget install Microsoft.PowerShell`
- A Microsoft 365 account with permission to create lists on the target site

### Provision lists

```powershell
pwsh ~/create-sharepoint-lists.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/UluMalu"
```

The script:
1. Installs **PnP.PowerShell** automatically if it is not already present.
2. Opens an interactive browser login to your Microsoft 365 tenant.
3. Creates the following lists (skips any that already exist):

| List | Purpose |
|---|---|
| **Clients** | Client security-posture records |
| **PentestEngagements** | Penetration-test engagement tracking |
| **Threats** | Threat-intelligence log |
| **AgentActivity** | AI-agent run history |
| **Invoices** | Billing and invoice management |

---

## Frontend Development

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
