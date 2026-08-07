param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height
)

$ErrorActionPreference = 'Stop'
$powerPoint = $null
$presentation = $null

try {
  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $powerPoint.AutomationSecurity = 3
  $powerPoint.DisplayAlerts = 1
  $presentation = $powerPoint.Presentations.Open($InputPath, $true, $true, $false)
  foreach ($slide in $presentation.Slides) {
    $target = Join-Path $OutputDirectory ("slide-{0}.png" -f $slide.SlideIndex)
    $slide.Export($target, 'PNG', $Width, $Height)
  }
}
finally {
  if ($presentation -ne $null) {
    $presentation.Close()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation)
  }
  if ($powerPoint -ne $null) {
    $powerPoint.Quit()
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($powerPoint)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
