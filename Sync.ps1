cd "C:\Users\david\OneDrive\My Pet Projects\AI\Web-Designer"

# Set GitHub repo URL (just in case)
git remote set-url origin https://github.com/thomad99/LAB007-WebDesigner.git

# Stage all local changes
git add .

# Check for changes
$changes = git status --porcelain

if ($changes) {
    Write-Output "Files to be committed:"
    $changes

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # Commit with error handling
    try {
        git commit -m "Auto-sync $timestamp"
        Write-Output "Commit successful"
    }
    catch {
        Write-Output "Commit failed: $_"
        exit 1
    }

    Write-Output "Pushing local changes to GitHub..."
    
    # Use force-with-lease for safety
    try {
        git push origin main --force-with-lease
        Write-Output "Sync complete at $timestamp"
    }
    catch {
        Write-Output "Push failed: $_"
        Write-Output "Try: git pull origin main first, then run sync again"
        exit 1
    }
}
else {
    Write-Output "No changes to sync."
}