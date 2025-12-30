const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Shared: write & run a PowerShell script, then clean up.
 */
function getPromiseRunPSScript(scriptContent) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tempFilePath = path.join(outputDir, `temp_${Date.now()}.ps1`);

    fs.writeFile(tempFilePath, scriptContent, (err) => {
      if (err) return reject(err);

      const cmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFilePath}"`;
      exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
        fs.unlink(tempFilePath, () => {
          if (error) return reject(stderr || error?.message);
          resolve(stdout);
        });
      });
    });
  });
}

/**
 * Helper: PowerShell prelude (WinAPI + helpers).
 * - ClickAt x,y
 * - TypeText text
 * - Hotkey sequences (SendKeys)
 * - Activate/Move/Resize window for "xTool Creative Space"
 */
function psPrelude() {
  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# WinAPI helpers
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  public const int MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const int MOUSEEVENTF_LEFTUP   = 0x0004;

  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@

function Click-At([int]$x, [int]$y) {
  [Win]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 50
  [Win]::mouse_event([Win]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 50
  [Win]::mouse_event([Win]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
}

function Type-Text([string]$txt) {
  [System.Windows.Forms.SendKeys]::SendWait($txt)
}

function Press-Enter() { [System.Windows.Forms.SendKeys]::SendWait("~") }
function Press-Del()   { [System.Windows.Forms.SendKeys]::SendWait("{DEL}") }

function Focus-XCS {
  $proc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*xTool*" -or $_.ProcessName -like "*Creative*" -or $_.MainWindowTitle -like "*xTool Creative Space*")
  } | Select-Object -First 1

  if ($null -eq $proc) { return $false }
  [Win]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  return $proc.MainWindowHandle
}

function MoveResize-Window([IntPtr]$hWnd, [int]$x, [int]$y, [int]$w, [int]$h) {
  [Win]::MoveWindow($hWnd, $x, $y, $w, $h, $true) | Out-Null
}
`;
}

/**
 * Windows equivalent of: runAppleScriptForClosePrinting
 * Click at (3000,300), wait 1s.
 */
function runWindowsScriptForClosePrinting() {
  const scriptContent = `
${psPrelude()}

Click-At -x 3000 -y 300
Start-Sleep -Seconds 1
`;
  return getPromiseRunPSScript(scriptContent);
}

/**
 * Windows equivalent of: runAppleScriptForPreAction
 * Center and resize xTool Creative Space to 1440x900.
 */
function runWindowsScriptForPreAction() {
  const targetWidth = 1440;
  const targetHeight = 900;

  const scriptContent = `
${psPrelude()}

# Screen bounds
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$screenWidth  = $screen.Width
$screenHeight = $screen.Height

$posX = [int](($screenWidth  - ${targetWidth}) / 2)
$posY = [int](($screenHeight - ${targetHeight}) / 2)

$hWnd = Focus-XCS
if ($hWnd -ne $false) {
  Start-Sleep -Milliseconds 500
  MoveResize-Window -hWnd $hWnd -x $posX -y $posY -w ${targetWidth} -h ${targetHeight}
}
`;
  return getPromiseRunPSScript(scriptContent);
}

/**
 * Windows equivalent of: runAppleScriptForName(fileName, name, isFirstPrinting)
 * Mirrors your clicks, deletes, imports, parameter typing, etc.
 *
 * Adjust paths and coordinates as needed.
 */
function runWindowsScriptForName(fileName, name, isFirstPrinting) {
  // Compute your dynamic value like in your macOS template:
  const dynamicXSize = name.length > 4 ? 35 - (name.length - 4) * 7 : 35;

  // Update these paths to your actual Windows location.
  // Double backslashes are needed inside JS strings.
  const templatePath = "C:\\template.xcs";
  //const svgPath = `C:\\${name}.svg`;
  const svgPath = fileName;

  const scriptContent = `
${psPrelude()}

# Bring XCS to front
$hWnd = Focus-XCS
Start-Sleep -Milliseconds 500

# (Optional) New file shortcut if needed:
# [System.Windows.Forms.SendKeys]::SendWait("^n")
# Start-Sleep -Seconds 3

# Click "Center" of original image (adjust coords as needed)
Click-At -x 730 -y 571
Start-Sleep -Milliseconds 500

# Delete selection
Press-Del
Start-Sleep -Milliseconds 500

# Import dialog (Ctrl+I on Windows typically)
[System.Windows.Forms.SendKeys]::SendWait("^i")
Start-Sleep -Seconds 3

# Type the full path to the SVG and press Enter twice (dialog then confirm)
Type-Text "${svgPath}"
Click-At -x 1040 -y 588
Start-Sleep -Milliseconds 3000

# Click Scale Fit button
Click-At -x 1200 -y 595
Start-Sleep -Milliseconds 2000

# Open Material Dialog
Click-At -x 1656 -y 247
Start-Sleep -Milliseconds 1000

# Select Material button
Click-At -x 609 -y 688
Start-Sleep -Milliseconds 500

# Apply Material button
Click-At -x 1427 -y 457
Start-Sleep -Milliseconds 2000

# "Engrave" button
Click-At -x 1596 -y 347
Start-Sleep -Milliseconds 500

# Laser Type button
Click-At -x 1608 -y 470
Start-Sleep -Milliseconds 1000

# IR button
Click-At -x 1456 -y 524
Start-Sleep -Milliseconds 500

# Power button
Click-At -x 1505 -y 516
Start-Sleep -Milliseconds 500

# Speed field
Click-At -x 1638 -y 567
Start-Sleep -Milliseconds 300
Type-Text "1000"
Start-Sleep -Milliseconds 500

# LinesPerCM button
#Click-At -x 1521 -y 749
#Start-Sleep -Milliseconds 500

# "220" (adjust if this is a dropdown item position)
#Click-At -x 1424 -y 596
#Start-Sleep -Milliseconds 500

# Height field (X)
Click-At -x 670 -y 230
Start-Sleep -Milliseconds 300
Type-Text "15"
Start-Sleep -Milliseconds 500

# Close small dialog (X at top-left of panel)
Click-At -x 585 -y 207

Start-Sleep -Milliseconds 500

# Dynamic X size (based on name length)
Type-Text "${dynamicXSize}"


Start-Sleep -Milliseconds 500
Press-Enter
Start-Sleep -Milliseconds 500

# Y field
Click-At -x 677 -y 204
Start-Sleep -Milliseconds 300
Type-Text "50"
Start-Sleep -Milliseconds 500

# Frame button
Click-At -x 1432 -y 963
Start-Sleep -Seconds 1

# Process button
Click-At -x 1552 -y 958
Start-Sleep -Seconds 2

# Start button
Click-At -x 1558 -y 964
Start-Sleep -Seconds 1
`;

  return getPromiseRunPSScript(scriptContent);
}

module.exports = {
  runWindowsScriptForName,
  runWindowsScriptForPreAction: runWindowsScriptForPreAction,
  runWindowsScriptForClosePrinting: runWindowsScriptForClosePrinting
};
