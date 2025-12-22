#!/usr/bin/env node
/**
 * Fix story titles for story4 and story5
 */

require('dotenv').config();
const { query } = require('../backend/db');

async function fixTitles() {
  try {
    console.log('Updating story titles...');
    
    // Update story 5 (story4.txt)
    await query(
      'UPDATE stories SET title = $1 WHERE id = 5',
      ['भोलागली रेलयात्रा']
    );
    console.log('✓ Updated story 5: भोलागली रेलयात्रा');
    
    // Update story 6 (story5.txt)
    await query(
      'UPDATE stories SET title = $1 WHERE id = 6',
      ['रोहन होड ज़ाल्लो!']
    );
    console.log('✓ Updated story 6: रोहन होड ज़ाल्लो!');
    
    // Verify the updates
    console.log('\nVerifying updates...');
    const { queryAll } = require('../backend/db');
    const stories = await queryAll(
      'SELECT id, title, source_file FROM stories WHERE id IN (5, 6) ORDER BY id'
    );
    
    console.log('\nUpdated stories:');
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
