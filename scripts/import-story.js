#!/usr/bin/env node
/**
 * Story Import Script
 * Parses .txt story files and imports sentences to database
 * 
 * Usage:
 *   node scripts/import-story.js --file story1.txt --title "पाव वाट"
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const { query, queryOne } = require('../backend/db');

// Parse command line arguments
program
    .requiredOption('-f, --file <path>', 'Path to story .txt file')
    .option('-t, --title <title>', 'Story title (use --title-from-file to use first line of file, avoids encoding issues)')
    .option('--title-from-file', 'Use first non-empty line of story file as title')
    .option('-l, --language <lang>', 'Language', 'konkani')
    .option('-r, --replace', 'Replace existing story with same source_file or title (deletes existing story and related sentences/recordings)')
    .parse();

let options = program.opts();

/**
 * Split text into sentences.
 *
 * Rules:
 * 1. Devanagari danda (।), double danda (॥), newlines: always sentence boundaries.
 * 2. Periods (.), ! and ?: sentence boundaries when outside quoted dialogue.
 * 3. When one speaker's quote ends (closing "), that ends the sentence. The next speaker's
 *    quote starts a new sentence.
 *
 * Inside "...", . ! ? are NOT boundaries (whole quote is one utterance).
 *
 * @param {string} text - Story text in Devanagari script
 * @returns {string[]} Array of sentence strings
 */
function splitIntoSentences(text) {
    const sentences = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (c === '"') {
            current += c;
            inQuote = !inQuote;
            if (!inQuote) {
                const trimmed = current.trim();
                if (trimmed) sentences.push(trimmed);
                current = '';
            }
            continue;
        }

        if (inQuote) {
            current += c;
            continue;
        }

        if (/[।॥]/.test(c)) {
            current += c;
            const trimmed = current.trim();
            if (trimmed) sentences.push(trimmed);
            current = '';
            continue;
        }

        if (c === '\n') {
            const trimmed = current.trim();
            if (trimmed) sentences.push(trimmed);
            current = '';
            continue;
        }

        if (/[.!?]/.test(c)) {
            current += c;
            const trimmed = current.trim();
            if (trimmed) sentences.push(trimmed);
            current = '';
            continue;
        }

        current += c;
    }

    const trimmed = current.trim();
    if (trimmed) sentences.push(trimmed);

    const isStandalonePunc = (s) => {
        if (!s || s.trim().length === 0) return false;
        const hasLetter = /[\p{L}\u0900-\u097F]/u.test(s);
        return !hasLetter;
    };

    const result = [];
    for (let i = 0; i < sentences.length; i++) {
        const seg = sentences[i];
        if (!seg) continue;
        if (isStandalonePunc(seg)) {
            if (result.length > 0) {
                result[result.length - 1] = (result[result.length - 1] + ' ' + seg).trim();
            } else if (i + 1 < sentences.length) {
                sentences[i + 1] = (seg + ' ' + sentences[i + 1]).trim();
            } else {
                result.push(seg);
            }
        } else {
            result.push(seg);
        }
    }

    return result.filter(s => s && s.length > 0);
}

const { devanagariToIAST } = require('../backend/utils/transliterate-canonical');
/**
 * Transliterate to IAST using our helper
 */
function transliterateToIAST(devanagari) {
    try {
        return devanagariToIAST(devanagari);
    } catch (err) {
        console.error('Transliteration failed for text:', devanagari, err);
        return '';
    }
}

async function importStory() {
    try {
        console.log('='.repeat(50));
        console.log('📚 Konkani Story Importer');
        console.log('='.repeat(50));
        
        // 1. Read file
        const filePath = path.resolve(options.file);
        console.log(`Reading file: ${filePath}`);
        
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (!content || content.trim().length === 0) {
            throw new Error('File is empty');
        }

        const title = options.titleFromFile
            ? content.split('\n').map(l => l.trim()).find(l => l.length > 0) || 'Untitled'
            : (options.title || 'Untitled');

        // 2. Split into sentences
        const sentences = splitIntoSentences(content);
        console.log(`Found ${sentences.length} sentences`);

        if (sentences.length === 0) {
            throw new Error('No sentences found in file');
        }

        // 3. If replace was requested, delete any existing story with the same source_file or title
        if (options.replace) {
            console.log('⚠️ Replace flag detected — searching for existing stories to delete');
            const existingByFile = await queryOne('SELECT id, title, source_file FROM stories WHERE source_file = $1', [path.basename(filePath)]);
            const existingByTitle = await queryOne('SELECT id, title, source_file FROM stories WHERE title = $1', [title]);
            const toDelete = existingByFile || (existingByTitle && existingByTitle.source_file !== path.basename(filePath) ? existingByTitle : null);
            if (toDelete) {
                let delId = toDelete.id;
                console.log(`Deleting existing story entry (id=${delId}) to replace it`);
                await query('DELETE FROM stories WHERE id = $1', [delId]);
                console.log('✓ Existing story (and its sentences/recordings) deleted');
            }
        }

        // 4. Insert story
        console.log(`Creating story: "${title}"`);
        
        const story = await queryOne(
            `INSERT INTO stories (title, source_file, language, total_sentences)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [title, path.basename(filePath), options.language, sentences.length]
        );

        console.log(`✓ Story created with ID: ${story.id}`);

        // 5. Insert sentences
        console.log('Importing sentences...');
        
        for (let i = 0; i < sentences.length; i++) {
            const text = sentences[i];
            const iast = transliterateToIAST(text);
            const charCount = text.length;

            await query(
                `INSERT INTO sentences (story_id, order_in_story, text_devanagari, text_iast, char_count)
                 VALUES ($1, $2, $3, $4, $5)`,
                [story.id, i + 1, text, iast, charCount]
            );

            // Progress indicator
            if ((i + 1) % 10 === 0 || (i + 1) === sentences.length) {
                process.stdout.write(`\r  Imported: ${i + 1}/${sentences.length} sentences`);
            }
        }
        console.log('\n');

        // 5. Summary
        console.log('='.repeat(50));
        console.log('✅ Import Complete!');
        console.log('='.repeat(50));
        console.log(`Story ID: ${story.id}`);
        console.log(`Title: ${title}`);
        console.log(`Total Sentences: ${sentences.length}`);
        console.log(`Language: ${options.language}`);
        console.log('\nNext steps:');
        console.log(`  1. Open http://localhost:3000/recorder.html`);
        console.log(`  2. Select story: ${title}`);
        console.log(`  3. Start recording!`);
        console.log('='.repeat(50));

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Import failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run import
importStory();
