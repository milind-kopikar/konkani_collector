#!/usr/bin/env node
/**
 * Fix story titles corrupted by PowerShell encoding.
 * Uses source_file to target stories (avoids ID assumptions).
 * Titles are hardcoded in JS to preserve UTF-8/Devanagari.
 */

require('dotenv').config();
const { query, queryAll } = require('../backend/db');

const TITLE_FIXES = [
  { source_file: 'story4.txt', title: 'भोलागली रेलयात्रा' },
  { source_file: 'story5.txt', title: 'रोहन होड ज़ाल्लो!' },
  { source_file: 'story6.txt', title: 'काय्ळो आनी गुब्ची' },
];

async function fixTitles() {
  try {
    console.log('Updating story titles (Devanagari)...');
    
    for (const { source_file, title } of TITLE_FIXES) {
      const res = await query(
        'UPDATE stories SET title = $1 WHERE source_file = $2 RETURNING id',
        [title, source_file]
      );
      if (res.rowCount > 0) {
        console.log(`✓ Updated ${source_file}: ${title}`);
      } else {
        console.log(`  (skipped ${source_file} - not in DB)`);
      }
    }
    
    // Verify the updates
    console.log('\nVerifying updates...');
    const stories = await queryAll(
      'SELECT id, title, source_file FROM stories ORDER BY id'
    );
    
    console.log('\nAll stories:');
    stories.forEach(s => {
      console.log(`  ID ${s.id}: ${s.title} (${s.source_file})`);
    });
    
    console.log('\n✅ Titles updated successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error updating titles:', error);
    process.exit(1);
  }
}

fixTitles();
