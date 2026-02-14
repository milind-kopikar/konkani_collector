# Railway Production Deployment - Story Import Guide

This guide ensures that all stories are imported to Railway production database with **correct titles**.

## ⚠️ Important: Title Encoding

When importing stories, ensure titles are preserved **exactly** as they appear in the story files:
- Story 1: `चल रे भोपळा टुनुक टुनुक`
- Story 2: `दक्ष प्रजापतिंगले यज्ञ`
- Story 3: `बब्रुलिंगप्पागले समर्पण`
- Story 4: `भोलागली रेलयात्रा`
- Story 5: `रोहन होड ज़ाल्लो!`
- Story 6: `काय्ळो आनी गुब्ची`

Unicode characters can get corrupted if titles are copied incorrectly. Always use the automated import scripts.

---

## Method 1: Automated Import (Recommended)

Use the comprehensive import script that handles all 5 stories:

### Step 1: Set Railway DATABASE_URL

```powershell
# Get your Railway PostgreSQL connection string
# From Railway dashboard: PostgreSQL service → Connect → Connection String

$env:DATABASE_URL = "postgresql://postgres:password@host:5432/railway"
```

### Step 2: Preview Stories (Optional)

Preview how stories will be split without making changes:

```bash
node scripts/import-all-stories-to-railway.js --dry-run
```

This shows:
- Number of sentences per story
- Sample sentences with IAST transliteration
- Verifies all 5 stories can be read

### Step 3: Import All Stories

```bash
# Import all 5 stories at once
node scripts/import-all-stories-to-railway.js --replace
```

The `--replace` flag ensures that if you run this multiple times, it will replace existing stories instead of creating duplicates.

### Step 4: Verify Import

```bash
# List all imported stories
node scripts/list-stories.js

# Check specific story sentences
node scripts/dump-sentences.js
```

---

## Method 2: PowerShell Batch Import

Use the PowerShell script for manual control:

```powershell
# Set DATABASE_URL first
$env:DATABASE_URL = "postgresql://postgres:password@host:5432/railway"

# Run import script
.\scripts\import-stories.ps1
```

This script imports all 5 stories sequentially with the correct titles.

---

## Method 3: Individual Story Import

Import stories one at a time:

```bash
# Story 1
node scripts/import-story.js --file story1.txt --title "चल रे भोपळा टुनुक टुनुक" --replace

# Story 2
node scripts/import-story.js --file story2.txt --title "दक्ष प्रजापतिंगले यज्ञ" --replace

# Story 3
node scripts/import-story.js --file story3.txt --title "बब्रुलिंगप्पागले समर्पण" --replace

# Story 4
node scripts/import-story.js --file story4.txt --title "भोलागली रेलयात्रा" --replace

# Story 5
node scripts/import-story.js --file story5.txt --title "रोहन होड ज़ाल्लो!" --replace

# Story 6
node scripts/import-story.js --file story6.txt --title "काय्ळो आनी गुब्ची" --replace
```

---

## Troubleshooting

### Problem: Titles Display Incorrectly

If titles show corrupted characters (e.g., "भलगल रलयतर" instead of "भोलागली रेलयात्रा"):

**Solution:** Run the fix script:

```bash
node scripts/fix-story-titles.js
```

This script updates all story titles to their correct values.

### Problem: PowerShell Corrupts Unicode

PowerShell may corrupt Unicode characters when passing them as arguments.

**Solution:** Use the Node.js import script instead:

```bash
node scripts/import-all-stories-to-railway.js --replace
```

This script has titles **hardcoded** in JavaScript, avoiding encoding issues.

### Verify Correct Titles

After import, verify titles are correct:

```bash
node scripts/list-stories.js
```

Expected output:
```
1  चल रे भोपळा टुनुक टुनुक   story1.txt   43 sentences
2  दक्ष प्रजापतिंगले यज्ञ   story2.txt   41 sentences
3  बब्रुलिंगप्पागले समर्पण  story3.txt   41 sentences
4  भोलागली रेलयात्रा        story4.txt   38 sentences
5  रोहन होड ज़ाल्लो!        story5.txt   35 sentences
6  काय्ळो आनी गुब्ची        story6.txt   70 sentences
```

---

## Complete Railway Deployment Checklist

- [ ] Railway PostgreSQL service created
- [ ] Schema imported (`scripts/setup-railway-db.js`)
- [ ] DATABASE_URL environment variable set
- [ ] All 6 stories imported with correct titles
- [ ] Story titles verified with `list-stories.js`
- [ ] Sample sentences checked
- [ ] Web application deployed and tested
- [ ] Recording functionality verified

---

## Quick Reference

### Import Scripts

| Script | Purpose |
|--------|---------|
| `import-all-stories-to-railway.js` | Import all 6 stories (recommended) |
| `import-stories.ps1` | PowerShell batch import |
| `import-story.js` | Import individual story |
| `fix-story-titles.js` | Fix corrupted titles |
| `list-stories.js` | List all stories |
| `preview-story.js` | Preview sentence splitting |

### Environment Setup

```powershell
# Set Railway database URL
$env:DATABASE_URL = "your-railway-connection-string"

# Verify connection
node scripts/query-db.js "SELECT NOW()"
```

---

## Notes

1. **Always use `--replace` flag** when re-importing to avoid duplicates
2. **Verify titles** after each import using `list-stories.js`
3. **Test locally first** before deploying to production
4. Keep story files (`story1.txt` - `story6.txt`) as the source of truth for titles
5. The first sentence of each story file **is the title**
