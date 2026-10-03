param([string]$BaseUrl = 'http://127.0.0.1:8001')
$ErrorActionPreference = 'Stop'
# This example creates one new sample profile in the configured Qdrant database.
$ProfilePayload = @{
  studentType = '대학원'
  college = '소프트웨어융합대학원'
  major = 'AI'
  grade = 1
  interests = @('취업', '인턴', 'AI/데이터', '공모전')
  customInterests = @()
  keywords = @('AI', '데이터', '해커톤')
} | ConvertTo-Json -Depth 5
$ProfileBytes = [System.Text.Encoding]::UTF8.GetBytes($ProfilePayload)
$SavedProfile = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/db/profiles" -ContentType 'application/json; charset=utf-8' -Body $ProfileBytes
Write-Host "Saved profile ID: $($SavedProfile.id)"
Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/db/profiles/$($SavedProfile.id)"
