# Story Import - Title Integrity Protection

## Issue Identified
When importing stories to the database, Unicode characters in Devanagari titles were getting corrupted due to PowerShell encoding issues. For example:
- ❌ Wrong: "भलगल रलयतर" 
- ✅ Correct: "भोलागली रेलयात्रा"

## Solution Implemented

### 1. Automated Import Script
**File:** `scripts/import-all-stories-to-railway.js`

This Node.js script has all story titles **hardcoded in JavaScript** to avoid any encoding issues:

```javascript
const STORIES = [
  { file: 'story1.txt', title: 'चल रे भोपळा टुनुक टुनुक', language: 'konkani' },
  { file: 'story2.txt', title: 'दक्ष प्रजापतिंगले यज्ञ', language: 'konkani' },
  { file: 'story3.txt', title: 'बब्रुलिंगप्पागले समर्पण', language: 'konkani' },
  { file: 'story4.txt', title: 'भोलागली रेलयात्रा', language: 'konkani' },
  { file: 'story5.txt', title: 'रोहन होड ज़ाल्लो!', language: 'konkani' },
  { file: 'story6.txt', title: 'काय्ळो आनी गुब्ची', language: 'konkani' }
];
```

**Features:**
- ✅ Preserves Unicode characters perfectly
- ✅ Imports all 6 stories with correct titles
- ✅ Includes `--dry-run` mode to preview before importing
- ✅ Includes `--replace` flag to avoid duplicates
- ✅ Shows progress and summary
- ✅ Verifies IAST transliteration

### 2. Title Fix Script
**File:** `scripts/fix-story-titles.js`

Emergency fix script to correct titles if they get corrupted:

```bash
node scripts/fix-story-titles.js
```

This script updates titles by `source_file` with hardcoded Devanagari values, fixing story4, story5, and story6.

### 3. Updated PowerShell Script
**File:** `scripts/import-stories.ps1`

Updated to include all 5 stories with correct titles and proper flags.

### 4. Comprehensive Guide
**File:** `RAILWAY_STORY_IMPORT_GUIDE.md`

Complete documentation for Railway production deployment with:
- Step-by-step import instructions
- Troubleshooting guide
- Verification checklist
- All correct story titles listed

## Usage for Railway Production

### Option 1: Automated (Recommended)

```bash
# Set Railway DATABASE_URL
$env:DATABASE_URL = "postgresql://user:pass@host:5432/railway"

# Preview first (optional)
node scripts/import-all-stories-to-railway.js --dry-run

# Import all stories
node scripts/import-all-stories-to-railway.js --replace

# Verify
node scripts/list-stories.js
```

### Option 2: PowerShell Batch

```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:5432/railway"
.\scripts\import-stories.ps1
```

### Option 3: Individual Import

```bash
node scripts/import-story.js --file story4.txt --title "भोलागली रेलयात्रा" --replace
node scripts/import-story.js --file story5.txt --title "रोहन होड ज़ाल्लो!" --replace
node scripts/import-story.js --file story6.txt --title "काय्ळो आनी गुब्ची" --replace
```

## Verification

After import, always verify titles are correct:

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
6  काय्ळो आनी गुब्ची        story6.txt   48 sentences
```

## Files Created/Modified

1. ✅ `scripts/import-all-stories-to-railway.js` - New automated import script
2. ✅ `scripts/fix-story-titles.js` - New title correction script
3. ✅ `scripts/import-stories.ps1` - Updated with all 5 stories
4. ✅ `RAILWAY_STORY_IMPORT_GUIDE.md` - Comprehensive deployment guide
5. ✅ `STORY_IMPORT_PROTECTION.md` - This document

## Best Practices

1. **Always use the automated import script** for Railway deployments
2. **Never copy/paste titles manually** - use the scripts
3. **Verify titles** after every import
4. **Use `--replace` flag** when re-importing to avoid duplicates
5. **Test locally first** before deploying to production
6. **Keep story .txt files** as the source of truth

## Title Fix Script (fix-story-titles.js)

The `fix-story-titles.js` script targets stories by `source_file` and updates titles to correct Devanagari:
- story4.txt: भोलागली रेलयात्रा
- story5.txt: रोहन होड ज़ाल्लो!
- story6.txt: काय्ळो आनी गुब्ची

Run after import if PowerShell corrupted titles: `node scripts/fix-story-titles.js`

## Ready for Production

All tools and documentation are now in place to ensure story titles remain correct when migrating to Railway production database.
