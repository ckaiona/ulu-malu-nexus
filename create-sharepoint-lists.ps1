<#
.SYNOPSIS
    Provisions SharePoint lists required by the ULU MALU Nexus platform.

.DESCRIPTION
    Installs PnP.PowerShell if needed, connects to the target SharePoint site,
    and creates the lists used by the ULU MALU Nexus dashboard:
      - Clients           (client security posture)
      - PentestEngagements (pentest tracking)
      - Threats            (threat intelligence)
      - AgentActivity      (AI-agent activity log)
      - Invoices           (finance / billing)

.PARAMETER SiteUrl
    Full URL of the SharePoint site to provision (e.g. https://contoso.sharepoint.com/sites/UluMalu).

.EXAMPLE
    pwsh ~/create-sharepoint-lists.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/UluMalu"
#>

[CmdletBinding()]
param(
    [string]$SiteUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 1. Ensure PnP.PowerShell is installed
# ---------------------------------------------------------------------------
if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell")) {
    Write-Host "PnP.PowerShell not found. Installing for current user..." -ForegroundColor Cyan
    Install-Module -Name PnP.PowerShell -Scope CurrentUser -Force -AllowClobber
    Write-Host "PnP.PowerShell installed." -ForegroundColor Green
} else {
    Write-Host "PnP.PowerShell is already installed." -ForegroundColor Green
}

Import-Module PnP.PowerShell -ErrorAction Stop

# ---------------------------------------------------------------------------
# 2. Prompt for site URL if not provided
# ---------------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($SiteUrl)) {
    $SiteUrl = Read-Host "Enter SharePoint site URL (e.g. https://contoso.sharepoint.com/sites/UluMalu)"
}

# ---------------------------------------------------------------------------
# 3. Connect (interactive browser login)
# ---------------------------------------------------------------------------
Write-Host "`nConnecting to $SiteUrl ..." -ForegroundColor Cyan
Connect-PnPOnline -Url $SiteUrl -Interactive
Write-Host "Connected." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. Helper – create list only if it does not already exist
# ---------------------------------------------------------------------------
function New-ListIfNotExists {
    param(
        [string]$ListName,
        [string]$Template = "GenericList"
    )
    $existing = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  List '$ListName' already exists – skipping creation." -ForegroundColor Yellow
        return $existing
    }
    $list = New-PnPList -Title $ListName -Template $Template -OnQuickLaunch
    Write-Host "  Created list: $ListName" -ForegroundColor Green
    return $list
}

# ---------------------------------------------------------------------------
# 5. Clients list
# ---------------------------------------------------------------------------
Write-Host "`n[1/5] Provisioning 'Clients' list..." -ForegroundColor Cyan
New-ListIfNotExists -ListName "Clients" | Out-Null

$clientFields = @(
    @{ Name = "ClientName";   Type = "Text";   DisplayName = "Client Name" },
    @{ Name = "RiskScore";    Type = "Number"; DisplayName = "Risk Score"  },
    @{ Name = "SecurityStatus"; Type = "Choice"; DisplayName = "Security Status";
       Choices = "secure|warning|critical" },
    @{ Name = "ChurnRisk";    Type = "Number"; DisplayName = "Churn Risk %" },
    @{ Name = "LastActivity"; Type = "DateTime"; DisplayName = "Last Activity" }
)

foreach ($f in $clientFields) {
    $existing = Get-PnPField -List "Clients" -Identity $f.Name -ErrorAction SilentlyContinue
    if ($existing) { continue }

    switch ($f.Type) {
        "Choice" {
            $choiceValues = $f.Choices -split "\|"
            Add-PnPField -List "Clients" -InternalName $f.Name -DisplayName $f.DisplayName `
                         -Type Choice -Choices $choiceValues | Out-Null
        }
        default {
            Add-PnPField -List "Clients" -InternalName $f.Name -DisplayName $f.DisplayName `
                         -Type $f.Type | Out-Null
        }
    }
    Write-Host "    Added field: $($f.DisplayName)" -ForegroundColor DarkGreen
}

# ---------------------------------------------------------------------------
# 6. PentestEngagements list
# ---------------------------------------------------------------------------
Write-Host "`n[2/5] Provisioning 'PentestEngagements' list..." -ForegroundColor Cyan
New-ListIfNotExists -ListName "PentestEngagements" | Out-Null

$pentestFields = @(
    @{ Name = "EngagementName"; Type = "Text";   DisplayName = "Engagement Name" },
    @{ Name = "ClientRef";      Type = "Text";   DisplayName = "Client"          },
    @{ Name = "Scope";          Type = "Note";   DisplayName = "Scope"           },
    @{ Name = "StartDate";      Type = "DateTime"; DisplayName = "Start Date"    },
    @{ Name = "EndDate";        Type = "DateTime"; DisplayName = "End Date"      },
    @{ Name = "EngagementStatus"; Type = "Choice"; DisplayName = "Status";
       Choices = "planned|in-progress|complete|on-hold" },
    @{ Name = "Soc2Checklist";  Type = "Boolean"; DisplayName = "SOC2 Checklist Loaded" },
    @{ Name = "Progress";       Type = "Number";  DisplayName = "Progress %"    }
)

foreach ($f in $pentestFields) {
    $existing = Get-PnPField -List "PentestEngagements" -Identity $f.Name -ErrorAction SilentlyContinue
    if ($existing) { continue }

    switch ($f.Type) {
        "Choice" {
            $choiceValues = $f.Choices -split "\|"
            Add-PnPField -List "PentestEngagements" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type Choice -Choices $choiceValues | Out-Null
        }
        default {
            Add-PnPField -List "PentestEngagements" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type $f.Type | Out-Null
        }
    }
    Write-Host "    Added field: $($f.DisplayName)" -ForegroundColor DarkGreen
}

# ---------------------------------------------------------------------------
# 7. Threats list
# ---------------------------------------------------------------------------
Write-Host "`n[3/5] Provisioning 'Threats' list..." -ForegroundColor Cyan
New-ListIfNotExists -ListName "Threats" | Out-Null

$threatFields = @(
    @{ Name = "ThreatTitle";    Type = "Text";   DisplayName = "Threat Title"  },
    @{ Name = "AffectedClient"; Type = "Text";   DisplayName = "Affected Client" },
    @{ Name = "Severity";       Type = "Choice"; DisplayName = "Severity";
       Choices = "critical|high|medium|low" },
    @{ Name = "ThreatStatus";   Type = "Choice"; DisplayName = "Status";
       Choices = "active|investigating|mitigated|closed" },
    @{ Name = "DetectedDate";   Type = "DateTime"; DisplayName = "Detected Date" },
    @{ Name = "Description";    Type = "Note";   DisplayName = "Description"   }
)

foreach ($f in $threatFields) {
    $existing = Get-PnPField -List "Threats" -Identity $f.Name -ErrorAction SilentlyContinue
    if ($existing) { continue }

    switch ($f.Type) {
        "Choice" {
            $choiceValues = $f.Choices -split "\|"
            Add-PnPField -List "Threats" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type Choice -Choices $choiceValues | Out-Null
        }
        default {
            Add-PnPField -List "Threats" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type $f.Type | Out-Null
        }
    }
    Write-Host "    Added field: $($f.DisplayName)" -ForegroundColor DarkGreen
}

# ---------------------------------------------------------------------------
# 8. AgentActivity list
# ---------------------------------------------------------------------------
Write-Host "`n[4/5] Provisioning 'AgentActivity' list..." -ForegroundColor Cyan
New-ListIfNotExists -ListName "AgentActivity" | Out-Null

$agentFields = @(
    @{ Name = "AgentName";    Type = "Text";   DisplayName = "Agent Name"    },
    @{ Name = "AgentStatus";  Type = "Choice"; DisplayName = "Status";
       Choices = "running|idle|complete|alert" },
    @{ Name = "AssignedTo";   Type = "Text";   DisplayName = "Assigned To"   },
    @{ Name = "ProgressPct";  Type = "Number"; DisplayName = "Progress %"    },
    @{ Name = "LastRunDate";  Type = "DateTime"; DisplayName = "Last Run"    },
    @{ Name = "Notes";        Type = "Note";   DisplayName = "Notes"         }
)

foreach ($f in $agentFields) {
    $existing = Get-PnPField -List "AgentActivity" -Identity $f.Name -ErrorAction SilentlyContinue
    if ($existing) { continue }

    switch ($f.Type) {
        "Choice" {
            $choiceValues = $f.Choices -split "\|"
            Add-PnPField -List "AgentActivity" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type Choice -Choices $choiceValues | Out-Null
        }
        default {
            Add-PnPField -List "AgentActivity" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type $f.Type | Out-Null
        }
    }
    Write-Host "    Added field: $($f.DisplayName)" -ForegroundColor DarkGreen
}

# ---------------------------------------------------------------------------
# 9. Invoices list
# ---------------------------------------------------------------------------
Write-Host "`n[5/5] Provisioning 'Invoices' list..." -ForegroundColor Cyan
New-ListIfNotExists -ListName "Invoices" | Out-Null

$invoiceFields = @(
    @{ Name = "InvoiceNumber"; Type = "Text";     DisplayName = "Invoice Number" },
    @{ Name = "ClientRef";     Type = "Text";     DisplayName = "Client"         },
    @{ Name = "Amount";        Type = "Currency"; DisplayName = "Amount"         },
    @{ Name = "InvoiceDate";   Type = "DateTime"; DisplayName = "Invoice Date"   },
    @{ Name = "DueDate";       Type = "DateTime"; DisplayName = "Due Date"       },
    @{ Name = "InvoiceStatus"; Type = "Choice";   DisplayName = "Status";
       Choices = "draft|sent|paid|overdue" },
    @{ Name = "Notes";         Type = "Note";     DisplayName = "Notes"          }
)

foreach ($f in $invoiceFields) {
    $existing = Get-PnPField -List "Invoices" -Identity $f.Name -ErrorAction SilentlyContinue
    if ($existing) { continue }

    switch ($f.Type) {
        "Choice" {
            $choiceValues = $f.Choices -split "\|"
            Add-PnPField -List "Invoices" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type Choice -Choices $choiceValues | Out-Null
        }
        default {
            Add-PnPField -List "Invoices" -InternalName $f.Name `
                         -DisplayName $f.DisplayName -Type $f.Type | Out-Null
        }
    }
    Write-Host "    Added field: $($f.DisplayName)" -ForegroundColor DarkGreen
}

# ---------------------------------------------------------------------------
# 10. Done
# ---------------------------------------------------------------------------
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " SharePoint lists provisioned successfully!" -ForegroundColor Green
Write-Host "  Site   : $SiteUrl" -ForegroundColor White
Write-Host "  Lists  :" -ForegroundColor White
Write-Host "    - Clients" -ForegroundColor White
Write-Host "    - PentestEngagements" -ForegroundColor White
Write-Host "    - Threats" -ForegroundColor White
Write-Host "    - AgentActivity" -ForegroundColor White
Write-Host "    - Invoices" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

Disconnect-PnPOnline
