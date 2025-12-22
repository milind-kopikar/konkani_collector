# PowerShell script to import all stories into the database
# Usage: Open PowerShell in project folder and run: .\scripts\import-stories.ps1
# Make sure you have a valid DATABASE_URL in environment or via a .env file

Write-Host "Importing all Konkani stories..." -ForegroundColor Cyan
Write-Host ""

# Optional: run previews to verify sentence splitting
Write-Host "Preview stories (optional):" -ForegroundColor Yellow
Write-Host "  node .\scripts\preview-story.js --file .\story1.txt --title 'चल रे भोपळा टुनुक टुनुक'" -ForegroundColor Gray
Write-Host "  node .\scripts\preview-story.js --file .\story2.txt --title 'दक्ष प्रजापतिंगले यज्ञ'" -ForegroundColor Gray
Write-Host "  node .\scripts\preview-story.js --file .\story3.txt --title 'बब्रुलिंगप्पागले समर्पण'" -ForegroundColor Gray
Write-Host "  node .\scripts\preview-story.js --file .\story4.txt --title 'भोलागली रेलयात्रा'" -ForegroundColor Gray
Write-Host "  node .\scripts\preview-story.js --file .\story5.txt --title 'रोहन होड ज़ाल्लो!'" -ForegroundColor Gray
Write-Host ""

# Import all stories with correct titles
# Make sure DATABASE_URL is set in your environment or a .env file in this folder

Write-Host "Importing Story 1..." -ForegroundColor Green
node .\scripts\import-story.js --file .\story1.txt --title "चल रे भोपळा टुनुक टुनुक" --replace

Write-Host "Importing Story 2..." -ForegroundColor Green
node .\scripts\import-story.js --file .\story2.txt --title "दक्ष प्रजापतिंगले यज्ञ" --replace

Write-Host "Importing Story 3..." -ForegroundColor Green
node .\scripts\import-story.js --file .\story3.txt --title "बब्रुलिंगप्पागले समर्पण" --replace

Write-Host "Importing Story 4..." -ForegroundColor Green
node .\scripts\import-story.js --file .\story4.txt --title "भोलागली रेलयात्रा" --replace

Write-Host "Importing Story 5..." -ForegroundColor Green
node .\scripts\import-story.js --file .\story5.txt --title "रोहन होड ज़ाल्लो!" --replace

Write-Host ""
Write-Host "✓ All stories imported!" -ForegroundColor Green
Write-Host ""
Write-Host "Verify with: node scripts\list-stories.js" -ForegroundColor Cyan
