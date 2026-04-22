$port = 4040
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:${port}/")
$listener.Start()

Write-Host ""
Write-Host "========================================"
Write-Host "  延边朝鲜族自治州 · 数据可视化地图"
Write-Host "========================================"
Write-Host ""
Write-Host "  http://localhost:${port}"
Write-Host "  关闭此窗口即可停止服务"
Write-Host ""

Start-Process "http://localhost:${port}"

$mime = @{
    '.html' = 'text/html;charset=utf-8'
    '.js'   = 'application/javascript;charset=utf-8'
    '.css'  = 'text/css;charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.json' = 'application/json'
    '.ico'  = 'image/x-icon'
    '.woff2'= 'font/woff2'
    '.woff' = 'font/woff'
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.LocalPath
    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root $path.Replace('/', '\')
    if (Test-Path $file -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($file)
        if ($mime.ContainsKey($ext)) {
            $ctx.Response.ContentType = $mime[$ext]
        } else {
            $ctx.Response.ContentType = 'application/octet-stream'
        }
        $bytes = [IO.File]::ReadAllBytes($file)
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
}
