# PowerShell script to fix missing TestcordDevs imports in testcordplugins

$testcordPluginsDir = "src/testcordplugins"
$importLine = 'import { TestcordDevs } from "@utils/constants";'

# Get all .ts and .tsx files in testcordplugins
$files = Get-ChildItem -Path $testcordPluginsDir -Recurse -Include *.ts,*.tsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw

    # Check if file contains TestcordDevs but not the import
    if ($content -match "TestcordDevs" -and $content -notmatch "import.*TestcordDevs") {
        Write-Host "Fixing $($file.FullName)"

        # Find the last import line and add the TestcordDevs import after it
        $lines = Get-Content $file.FullName
        $lastImportIndex = -1

        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^import") {
                $lastImportIndex = $i
            }
        }

        if ($lastImportIndex -ge 0) {
            # Insert after the last import
            $lines = $lines[0..$lastImportIndex] + $importLine + $lines[($lastImportIndex + 1)..($lines.Count - 1)]
        } else {
            # No imports found, add at the beginning after comments
            $insertIndex = 0
            while ($insertIndex -lt $lines.Count -and $lines[$insertIndex] -match "^\s*//") {
                $insertIndex++
            }
            $lines = $lines[0..($insertIndex - 1)] + $importLine + "" + $lines[$insertIndex..($lines.Count - 1)]
        }

        # Write back to file
        $lines | Set-Content $file.FullName
    }
}

Write-Host "Import fixing complete."
