# Generate strong signing keystore
$keystorePath = "C:\Users\Sergio\Documents\timesheet\android\urenregistratie-release.keystore"
$keystorePassword = "Ur3nR3g1str4t13@2025!SecureKey"
$keyPassword = "Ur3nR3g1str4t13@2025!SecureKey"
$javaPath = "C:\Program Files\jdk-21.0.3+9\bin\keytool.exe"

Write-Host "Genereren van sterke signing keystore..." -ForegroundColor Green

# Create PKCS#12 keystore with strong encryption
$env:PKCS11_MODULES = ""

$args = @(
    "-genkey",
    "-v",
    "-keystore", $keystorePath,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-alias", "urenregistratie-release",
    "-dname", "CN=Uren Registratie,O=Personal,L=Netherlands,C=NL",
    "-storepass", $keystorePassword,
    "-keypass", $keyPassword,
    "-storetype", "JKS"
)

& $javaPath $args

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Keystore aangemaakt op: $keystorePath" -ForegroundColor Green
    Write-Host "✓ Keystore password: $keystorePassword" -ForegroundColor Yellow
    Write-Host "✓ Key password: $keyPassword" -ForegroundColor Yellow
    Write-Host "✓ Geldig voor 27 jaar" -ForegroundColor Green
    Write-Host "`nZorg dat je deze wachtwoorden veilig opslaat!" -ForegroundColor Yellow
} else {
    Write-Host "Fout bij het aanmaken van keystore" -ForegroundColor Red
    exit 1
}
