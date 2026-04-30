$port = 7777
$dir  = "C:\Users\JosephSchmidt\Downloads\rushtownmaintenancehub-main (1)\rushtownmaintenancehub-main"

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.ico'  = 'image/x-icon'
    '.svg'  = 'image/svg+xml'
    '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "Serving $dir on http://localhost:$port"
Write-Output "Server started"
[Console]::Out.Flush()

while ($true) {
    try {
        $ctx  = $listener.GetContext()
        $path = $ctx.Request.Url.LocalPath
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
        $file = Join-Path $dir $path.TrimStart('/')
        if (Test-Path $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ct  = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.StatusCode = 200
            $ctx.Response.ContentType = $ct
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found")
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $ctx.Response.Close()
    } catch [System.Net.HttpListenerException] {
        # listener closed externally — stop
        break
    } catch {
        # ignore individual request errors, keep serving
        try { $ctx.Response.Abort() } catch { }
    }
}
