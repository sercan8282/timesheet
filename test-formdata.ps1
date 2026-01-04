$pdfPath = "C:\Temp\93039812509.pdf"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNjc0MzIxNjAwLCJleHAiOjk5OTk5OTk5OTl9.test"
$url = "http://localhost:3000/api/admin/invoices/import-templates/auto-detect"

Write-Host "Testing auto-detect endpoint..."
Write-Host "PDF Path: $pdfPath"
Write-Host "URL: $url"
Write-Host ""

try {
    $fileBytes = [System.IO.File]::ReadAllBytes($pdfPath)
    Write-Host "File size: $($fileBytes.Length) bytes"
    
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $body = @()
    
    # Add file to multipart form
    $body += "--$boundary"
    $body += 'Content-Disposition: form-data; name="pdf"; filename="93039812509.pdf"'
    $body += "Content-Type: application/pdf"
    $body += ""
    
    # Convert to byte array
    $bodyText = $body -join "`r`n"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyText)
    $fileBytes = [System.IO.File]::ReadAllBytes($pdfPath)
    $endBoundary = "--$boundary--" | System.Text.Encoding]::UTF8.GetBytes()
    
    $finalBody = $bodyBytes + $fileBytes + "`r`n$endBoundary" | System.Text.Encoding]::UTF8.GetBytes()
    
    $response = Invoke-WebRequest -Uri $url `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "multipart/form-data; boundary=$boundary"
        } `
        -Body $finalBody `
        -ErrorAction Continue
    
    Write-Host "Response status: $($response.StatusCode)"
    Write-Host "Response body:"
    Write-Host $response.Content
    
} catch {
    Write-Host "ERROR: $_"
    Write-Host "Exception: $($_.Exception.Message)"
}
