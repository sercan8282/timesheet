$pdfPath = "C:\Temp\93039812509.pdf"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjc0MzIxNjAwLCJleHAiOjk5OTk5OTk5OTl9.test"

Write-Host "Testing auto-detect with curl..."

$curlCmd = @(
    'curl', 
    '-X', 'POST',
    'http://localhost:3000/api/admin/invoices/import-templates/auto-detect',
    '-H', "Authorization: Bearer $token",
    '-F', "pdf=@$pdfPath"
)

& $curlCmd
