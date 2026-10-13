# Mini serveur statique PowerShell (aucune dépendance) pour tester le jeu
param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 8123
)

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Serveur sur http://localhost:$Port/  ( racine : $Root )"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $req = $reader.ReadLine()
    while ($reader.ReadLine() -ne '') { }

    $path = '/'
    if ($req -match '^\s*GET\s+(\S+)\s+HTTP') { $path = $Matches[1] }
    $path = [System.Uri]::UnescapeDataString($path)
    if ($path -eq '/') { $path = '/index.html' }

    $full = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
    if (-not $full.StartsWith($Root)) { $full = Join-Path $Root 'index.html' }

    $bytes = $null
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
    }

    $ext = [System.IO.Path]::GetExtension($full).ToLower()
    $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }

    $head = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $out = New-Object System.IO.MemoryStream
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $out.Write($hb, 0, $hb.Length)
    if ($bytes) { $out.Write($bytes, 0, $bytes.Length) }
    $resp = $out.ToArray()
    $stream.Write($resp, 0, $resp.Length)
    $stream.Flush()
    $client.Close()
  }
} finally {
  $listener.Stop()
}