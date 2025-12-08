/**
 * Recording upload API (web interface)
 * POST /api/recordings - Upload recording from web form
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { query, queryOne } = require('../db');
const storage = require('../storage');
const { convertToWav, isValidWav } = require('../utils/audioConverter');
const { validateAudio } = require('../utils/audioValidator');
const { validateRecordingUpload } = require('../middleware/validator');

// Configure multer for temporary file uploads
const upload = multer({
    dest: '/tmp/uploads/',
    limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        // Accept any audio format
        const allowedMimes = [
            'audio/wav', 'audio/wave', 'audio/x-wav',
            'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
            'audio/ogg', 'audio/opus', 'audio/webm',
        ];
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|m4a|ogg|opus|webm)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid audio format'));
        }
    },
});

// POST /api/recordings
router.post('/', upload.single('audio'), validateRecordingUpload, async (req, res, next) => {
    console.log('POST /api/recordings received');
    console.log('File info:', req.file && { originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size });
    console.log('Body:', { sentence_id: req.body.sentence_id, user_id: req.body.user_id });
    const { sentence_id, user_id } = req.body;
    const tempFilePath = req.file.path;

    try {
        // 1. Get sentence details
        const sentence = await queryOne(
            'SELECT text_devanagari, story_id FROM sentences WHERE id = $1',
            [sentence_id]
        );

        if (!sentence) {
            await fs.unlink(tempFilePath);
            return res.status(404).json({ error: 'Sentence not found' });
        }

        // 2. Convert to WAV if needed; gracefully fall back when ffmpeg is missing
        let wavPath = tempFilePath;
        let shouldConvert = false;
        try {
            shouldConvert = !(await isValidWav(tempFilePath));
            console.log('isValidWav result:', !shouldConvert);
        } catch (e) {
            // If isValidWav throws (e.g., ffprobe not found), consider fallback behavior:
            console.warn('isValidWav failed:', e.message);
            // If file extension is not .wav, we'll attempt to convert and may fail if ffmpeg is missing.
            // If extension is .wav, we'll skip conversion and hope it's acceptable.
            // Use original filename to decide; multer temp path may not have extension
            const originalExt = path.extname(req.file.originalname || '').toLowerCase();
            console.warn('isValidWav check failed:', e.message, '-> originalExt', originalExt, 'originalname', req.file.originalname);
            shouldConvert = originalExt !== '.wav';
        }

        // Check if ffmpeg is available in the environment.
        const { isFfmpegAvailable } = require('../utils/audioConverter');
        let ffmpegAvailable = isFfmpegAvailable();
        console.log('ffmpegAvailable:', ffmpegAvailable);

        if (shouldConvert && !ffmpegAvailable) {
            console.warn('ffmpeg not present — skipping conversion for', req.file.originalname);
            shouldConvert = false;
        }

        if (shouldConvert) {
            try {
                console.log('Converting audio to WAV format...');
                wavPath = path.join('/tmp', `${uuidv4()}.wav`);
                await convertToWav(tempFilePath, wavPath);
                await fs.unlink(tempFilePath); // Clean up original
                console.log('Conversion completed, wavPath:', wavPath);
            } catch (conversionErr) {
                // If conversion fails because ffmpeg is missing, return a helpful error
                console.error('Audio conversion error:', conversionErr);
                await fs.unlink(tempFilePath).catch(() => {});
                return res.status(500).json({ error: `Audio conversion failed: ${conversionErr.message}` });
            }
        }

        // 3. Trim silence using ffmpeg (if available) and then validate audio
        const { trimSilence } = require('../utils/audioConverter');
        let validation;
        try {
            if (ffmpegAvailable) {
                try {
                    const trimmedPath = path.join('/tmp', `${uuidv4()}-trimmed.wav`);
                    await trimSilence(wavPath, trimmedPath);
                    // if trimming created a new file, replace wavPath
                    if (trimmedPath && trimmedPath !== wavPath) {
                        try { await fs.unlink(wavPath).catch(() => {}); } catch {}
                        wavPath = trimmedPath;
                    }
                } catch (te) {
                    console.warn('trimSilence failed; proceeding with original audio:', te.message);
                }
            }
            validation = await validateAudio(wavPath, sentence.text_devanagari);
            console.log('Post-validation: valid=', validation.valid, 'errors=', validation.errors, 'checks=', validation.checks);
            // If validation returned with errors, respond with 422 and do not save
            if (!validation.valid) {
                console.warn('Validation returned invalid; returning 422 to client', validation.errors);
                try { if (tempFilePath) await fs.unlink(tempFilePath); if (wavPath && wavPath !== tempFilePath) await fs.unlink(wavPath); } catch (cleanupErr) {}
                return res.status(422).json({ error: 'Validation failed', validation });
            }
        } catch (e) {
            console.warn('validateAudio failed; sending validation error to client:', e.message);
            try { if (tempFilePath) await fs.unlink(tempFilePath); if (wavPath && wavPath !== tempFilePath) await fs.unlink(wavPath); } catch {}
            return res.status(422).json({ error: 'Validation failed', validation: { valid: false, errors: [e.message] } });
        }

        // 4. Generate storage filename
        const filename = `recordings/${user_id.replace(/[^a-z0-9]/gi, '_')}_${sentence_id}_${uuidv4()}.wav`;

        // 5. Save to storage
        const storedPath = await storage.save(wavPath, filename);

        // 6. Get file size
        const fileSize = await storage.getSize(storedPath);
        console.log('Saved to storage:', storedPath, 'size:', fileSize);

        // 7. Insert database record
        const result = await queryOne(
            `INSERT INTO recordings (
                sentence_id, user_id, audio_filepath,
                file_size_bytes, duration_seconds, sample_rate, channels, format,
                validation_status, validation_errors, audio_metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`,
            [
                sentence_id,
                user_id,
                storedPath,
                fileSize,
                validation.checks.duration,
                validation.checks.sample_rate,
                validation.checks.channels,
                'wav',
                (function () {
                    if (validation.valid) return 'passed';
                    if (!ffmpegAvailable) return 'warning';
                    return 'failed';
                })(),
                JSON.stringify(validation.errors),
                JSON.stringify(validation.metadata),
            ]
        );

        // 8. Clean up temp file
        await fs.unlink(wavPath);

        // 9. Return response
        console.log('Inserting DB record for path:', storedPath);
        res.json({
            recording_id: result.id,
            status: 'success',
            message: 'Recording saved successfully',
            validation: {
                valid: validation.valid,
                errors: validation.errors,
                duration: validation.checks.duration,
            },
        });

    } catch (error) {
        console.error('Error in POST /api/recordings:', error);
        // Clean up temp files on error
        try {
            if (tempFilePath) await fs.unlink(tempFilePath);
            if (wavPath && wavPath !== tempFilePath) await fs.unlink(wavPath);
        } catch {}
        
        next(error);
    }
});

module.exports = router;
