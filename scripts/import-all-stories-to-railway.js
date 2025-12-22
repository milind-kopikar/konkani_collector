#!/usr/bin/env node
/**
 * Import All Stories to Railway Database
 * This script imports all 5 stories with correct titles to Railway production database
 * 
 * Prerequisites:
 * - Railway PostgreSQL service created with schema
 * - DATABASE_URL env var set to Railway's connection string
 * 
 * Usage:
 *   # Set Railway DATABASE_URL
 *   $env:DATABASE_URL='<railway-database-url>'
 *   node scripts/import-all-stories-to-railway.js
 * 
 * Or use --dry-run to preview without importing:
 *   node scripts/import-all-stories-to-railway.js --dry-run
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const { query, queryOne } = require('../backend/db');
const { devanagariToIAST } = require('../backend/utils/transliterate-canonical');

program
  .option('--dry-run', 'Preview stories without importing')
  .option('--replace', 'Replace existing stories with same source_file')
  .parse();

const options = program.opts();

// Story configurations with EXACT titles from story files
const STORIES = [
  {
    file: 'story1.txt',
    title: 'चल रे भोपळा टुनुक टुनुक',
    language: 'konkani'
  },
  {
    file: 'story2.txt',
    title: 'दक्ष प्रजापतिंगले यज्ञ',
    language: 'konkani'
  },
  {
    file: 'story3.txt',
    title: 'बब्रुलिंगप्पागले समर्पण',
    language: 'konkani'
  },
  {
    file: 'story4.txt',
    title: 'भोलागली रेलयात्रा',
    language: 'konkani'
  },
  {
    file: 'story5.txt',
    title: 'रोहन होड ज़ाल्लो!',
    language: 'konkani'
  }
];

/**
 * Split text into sentences (same logic as import-story.js)
 */
function splitIntoSentences(text) {
  let raw = text.split(/[।॥\n]+/).map(s => s.trim());
  const isStandalonePunc = (s) => {
    if (!s || s.trim().length === 0) return false;
    const hasLetter = /[\p{L}\u0900-\u097F]/u.test(s);
    if (hasLetter) return false;
    return true;
  };

  const sentences = [];
  for (let i = 0; i < raw.length; i++) {
    const segment = raw[i];
    if (!segment || segment.length === 0) continue;
    if (isStandalonePunc(segment)) {
      if (sentences.length > 0) {
        sentences[sentences.length - 1] = (sentences[sentences.length - 1] + ' ' + segment).trim();
      } else if (i + 1 < raw.length && raw[i + 1] && raw[i + 1].length > 0) {
        raw[i + 1] = (segment + ' ' + raw[i + 1]).trim();
      } else {
        sentences.push(segment);
      }
    } else {
      sentences.push(segment);
    }
  }

  return sentences.filter(s => s && s.length > 0);
}

async function importStory(storyConfig) {
  const { file, title, language } = storyConfig;
  
  console.log('─'.repeat(60));
  console.log(`📖 Processing: ${title}`);
  console.log(`   File: ${file}`);
  console.log('─'.repeat(60));

  // 1. Read file
  const filePath = path.resolve(file);
  const content = await fs.readFile(filePath, 'utf-8');
  
  if (!content || content.trim().length === 0) {
    throw new Error(`File ${file} is empty`);
  }

  // 2. Split into sentences
  const sentences = splitIntoSentences(content);
  console.log(`Found ${sentences.length} sentences`);

  if (options.dryRun) {
    console.log('Preview (first 3 sentences):');
    sentences.slice(0, 3).forEach((s, idx) => {
      const iast = devanagariToIAST(s);
      console.log(`  ${idx + 1}. ${s}`);
      console.log(`     → ${iast}`);
    });
    console.log('');
    return { skipped: true, title, sentences: sentences.length };
  }

  // 3. Check for existing story
  if (options.replace) {
    const existing = await queryOne(
      'SELECT id FROM stories WHERE source_file = $1',
      [path.basename(filePath)]
    );
    if (existing) {
      console.log(`⚠️  Deleting existing story (id=${existing.id})`);
      await query('DELETE FROM stories WHERE id = $1', [existing.id]);
    }
  }

  // 4. Insert story
  console.log(`Creating story: "${title}"`);
  const story = await queryOne(
    `INSERT INTO stories (title, source_file, language, total_sentences)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [title, path.basename(filePath), language, sentences.length]
  );

  console.log(`✓ Story created with ID: ${story.id}`);

  // 5. Insert sentences
  console.log('Importing sentences...');
  for (let i = 0; i < sentences.length; i++) {
    const text = sentences[i];
    const iast = devanagariToIAST(text);
    const charCount = text.length;

    await query(
      `INSERT INTO sentences (story_id, order_in_story, text_devanagari, text_iast, char_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [story.id, i + 1, text, iast, charCount]
    );

    if ((i + 1) % 10 === 0 || (i + 1) === sentences.length) {
      process.stdout.write(`\r  Imported: ${i + 1}/${sentences.length} sentences`);
    }
  }
  console.log('\n✓ Import complete\n');

  return { id: story.id, title, sentences: sentences.length };
}

async function main() {
  try {
    console.log('═'.repeat(60));
    console.log('🚂 Railway Database - Story Import');
    console.log('═'.repeat(60));
    console.log(`Mode: ${options.dryRun ? 'DRY RUN (preview only)' : 'IMPORT'}`);
    console.log(`Replace: ${options.replace ? 'Yes' : 'No'}`);
    console.log(`Total stories: ${STORIES.length}`);
    console.log('═'.repeat(60));
    console.log('');

    const results = [];

    for (const story of STORIES) {
      try {
        const result = await importStory(story);
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to import ${story.file}:`, error.message);
        results.push({ error: error.message, title: story.title });
      }
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('📊 Import Summary');
    console.log('═'.repeat(60));
    
    const successful = results.filter(r => !r.error && !r.skipped);
    const failed = results.filter(r => r.error);
    const skipped = results.filter(r => r.skipped);

    if (skipped.length > 0) {
      console.log('\n📋 Preview:');
      skipped.forEach(r => {
        console.log(`  ✓ ${r.title} (${r.sentences} sentences)`);
      });
    }

    if (successful.length > 0) {
      console.log('\n✅ Imported:');
      successful.forEach(r => {
        console.log(`  ${r.id}. ${r.title} (${r.sentences} sentences)`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed:');
      failed.forEach(r => {
        console.log(`  ${r.title}: ${r.error}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    
    if (options.dryRun) {
      console.log('✓ Dry run complete - no changes made');
      console.log('\nTo import, run without --dry-run:');
      console.log('  node scripts/import-all-stories-to-railway.js');
    } else {
      console.log(`✅ Import complete! ${successful.length}/${STORIES.length} stories imported`);
      console.log('\nNext steps:');
      console.log('  1. Verify: node scripts/list-stories.js');
      console.log('  2. Test app at your Railway URL');
    }
    
    console.log('═'.repeat(60));

    process.exit(failed.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
