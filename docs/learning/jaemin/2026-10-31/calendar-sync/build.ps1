$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
go run github.com/akavel/rsrc@v0.10.2 -manifest cmd/calendarhub/app.manifest -arch amd64 -o cmd/calendarhub/rsrc_windows_amd64.syso
if ($LASTEXITCODE -ne 0) { throw 'Manifest generation failed' }
go build -trimpath -ldflags '-H windowsgui' -o calendarhub-native.exe ./cmd/calendarhub
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
