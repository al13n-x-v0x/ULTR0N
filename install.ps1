<#
.SYNOPSIS
  U.L.T.R.0.N. - one-line installer for Windows.

.DESCRIPTION
  Standard install (paste into any shell: cmd, PowerShell, Run dialog):

    powershell -ExecutionPolicy ByPass -c "irm https://raw.githubusercontent.com/al13n-x-v0x/ULTR0N/main/install.ps1 | iex"

  Installs the `ultr0n` CLI globally (bins: ultr0n, ultron, ultron-cli, ultra0n),
  adds npm's global bin dir to the user PATH when missing, and falls back to
  the GitHub repo if the npm registry misses.

  Read before running:  Get-Content install.ps1
#>

$ErrorActionPreference = 'Stop'

function Say($t)   { Write-Host $t }
function Die($m, $h) {
  Write-Host "  x $m" -ForegroundColor Red
  if ($h) { Write-Host "    $h" -ForegroundColor DarkGray }
  exit 1
}

$Pkg  = 'ultr0n'
$Repo = 'al13n-x-v0x/ULTR0N'

Say ''
Say '   +U.L.T.R.0.N. installer' -NoNewline
Say ' (windows)' -ForegroundColor Cyan
Say "   by al13n-x-v0x - https://github.com/$Repo" -ForegroundColor DarkGray
Say ''

# ---------- 1. Node.js ----------
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeOk = $false
if ($node) {
  try { $major = [int]((node -p 'process.versions.node.split(".")[0]')) } catch { $major = 0 }
  if ($major -ge 18) {
    $nodeOk = $true
    Say "  v node $(node --version)" -ForegroundColor Green
  } else {
    Say "  o node $(node --version) is too old (need >=18)" -ForegroundColor Yellow
  }
} else {
  Say '  o node not found' -ForegroundColor Yellow
}

if (-not $nodeOk) {
  Say '  > installing Node.js 22 (winget)...' -ForegroundColor DarkGray
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
    # refresh PATH for the current session
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Die 'winget installed Node but node is still not on PATH' 'open a new terminal and re-run the installer' }
    Say "  v node $(node --version) installed" -ForegroundColor Green
  } else {
    Die 'no winget available' "install Node 18+ from https://nodejs.org, then re-run"
  }
}

# ---------- 2. npm on PATH + global bin dir ----------
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
  $npmCmd = Join-Path (Split-Path (Get-Command node).Source) 'npm.cmd'
  if (Test-Path $npmCmd) { $npmCmd_ = $npmCmd } else { Die 'npm not found next to node' 'reinstall Node from https://nodejs.org' }
} else {
  $npmCmd_ = $npm.Source
}

$globalBin = & $npmCmd_ config get prefix 2>$null
if ($globalBin -and (Test-Path $globalBin)) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if ($userPath -notlike "*$globalBin*") {
    Say '  o npm global dir not on PATH - adding it (user PATH)' -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$globalBin", 'User')
    $env:Path += ";$globalBin"
  }
}

# ---------- 3. install the CLI ----------
Say "  > installing $Pkg..." -ForegroundColor DarkGray
$installed = $false
try { & $npmCmd_ install -g $Pkg --silent 2>$null; if ($LASTEXITCODE -eq 0) { $installed = $true } } catch { $installed = $false }
if ($installed) {
  Say "  v $Pkg installed from npm" -ForegroundColor Green
} else {
  Say '  o npm registry miss - falling back to the GitHub repo' -ForegroundColor Yellow
  & $npmCmd_ install -g "github:$Repo#main" --silent 2>$null
  if ($LASTEXITCODE -ne 0) { Die 'install failed (npm and GitHub fallback)' 'check your connection, then retry' }
  Say "  v $Pkg installed from github:$Repo" -ForegroundColor Green
}

# ---------- 4. verify ----------
$bin = $null
foreach ($c in 'ultr0n', 'ultron', 'ultra0n', 'ultron-cli') {
  if (Get-Command $c -ErrorAction SilentlyContinue) { $bin = $c; break }
}
if (-not $bin) { Die 'installed but binaries not found on PATH' 'open a new terminal and try: ultron version' }

$ver = & $bin version 2>$null
Say ''
Say "  = $ver - ready" -ForegroundColor Green
Say ''
Say '  Next steps' 
Say "    $bin start      bridge + web UI + browser, one shot" 
Say "    $bin doctor     environment check + exact fixes"
Say "    $bin help       all commands"
Say ''
Say '  aliases: ultr0n - ultron - ultra0n - ultron-cli' -ForegroundColor DarkGray
Say ''
