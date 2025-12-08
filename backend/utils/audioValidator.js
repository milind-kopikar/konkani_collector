/**
 * Audio quality validator
 * Validates audio files meet ASR training requirements
 */

const { getAudioMetadata } = require('./audioConverter');
const fs = require('fs').promises;

/**
 * Validate audio file quality
 * @param {string} filePath - Path to audio file
 * @param {string} expectedText - Expected transcript (for duration estimation)
 * @returns {Promise<object>} Validation result
 */
async function validateAudio(filePath, expectedText = '') {
    const checks = {
        file_exists: false,
        format: null,
        sample_rate: null,
        channels: null,
        duration: null,
        file_size: null,
        expected_duration: null,
        duration_reasonable: false,
        size_reasonable: false,
    };
    
    const errors = [];

    // 1. Check file exists
    try {
        await fs.access(filePath);
        checks.file_exists = true;
    } catch {
        errors.push('File does not exist');
        return { valid: false, errors, checks };
    }

    // 2. Get audio metadata
    let metadata;
    try {
        metadata = await getAudioMetadata(filePath);
        checks.format = metadata.format;
        checks.sample_rate = metadata.sample_rate;
        checks.channels = metadata.channels;
        checks.duration = metadata.duration;
        checks.file_size = metadata.file_size;
    } catch (error) {
        errors.push(`Failed to read audio metadata: ${error.message}`);
        return { valid: false, errors, checks };
    }

    // 3. Validate format
    if (checks.format !== 'wav') {
        errors.push(`Invalid format: ${checks.format} (expected wav)`);
    }

    // 4. Validate sample rate
    const requiredSampleRate = parseInt(process.env.REQUIRED_SAMPLE_RATE) || 16000;
    if (checks.sample_rate !== requiredSampleRate) {
        errors.push(`Invalid sample rate: ${checks.sample_rate}Hz (expected ${requiredSampleRate}Hz)`);
    }

    // 5. Validate channels
    const requiredChannels = parseInt(process.env.REQUIRED_CHANNELS) || 1;
    if (checks.channels !== requiredChannels) {
        errors.push(`Invalid channels: ${checks.channels} (expected ${requiredChannels} for mono)`);
    }

    // 6. Validate duration
    if (checks.duration === 0) {
        errors.push('Audio file is empty (0 seconds)');
    } else if (checks.duration < 0.5) {
        errors.push(`Audio too short: ${checks.duration.toFixed(2)}s (minimum 0.5s)`);
    } else if (checks.duration > 30) {
        errors.push(`Audio too long: ${checks.duration.toFixed(2)}s (maximum 30s)`);
    }

    // 7. Estimate expected duration from text (if provided)
    if (expectedText) {
        // Estimate duration from word count
        const words = expectedText.trim().split(/\s+/).filter(Boolean).length || 0;
        const secondsPerWord = parseFloat(process.env.SECONDS_PER_WORD) || 0.45; // ~0.45s per word
        checks.expected_duration = words * secondsPerWord;
        // Allow variance (50% to 300% of expected)
        const minDuration = checks.expected_duration * 0.5;
        const maxDuration = checks.expected_duration * 3.0;
        
        if (checks.duration >= minDuration && checks.duration <= maxDuration) {
            checks.duration_reasonable = true;
        } else {
            // This is an error: recording length mismatch suggests re-record
            errors.push(`Duration ${checks.duration.toFixed(1)}s outside expected range [${minDuration.toFixed(1)}, ${maxDuration.toFixed(1)}]s for ${words} words`);
        }
    }

    // 8. Validate file size
    // Expected: sample_rate * bytes_per_sample * channels * duration + WAV header (44 bytes)
    const expectedSize = checks.sample_rate * 2 * checks.channels * checks.duration + 44;
    const minSize = expectedSize * 0.9;  // Allow 10% variance
    const maxSize = expectedSize * 1.1;
    
    if (checks.file_size >= minSize && checks.file_size <= maxSize) {
        checks.size_reasonable = true;
    } else if (checks.file_size < minSize) {
        errors.push(`File size too small: ${checks.file_size} bytes (expected ~${expectedSize.toFixed(0)} bytes)`);
    } else {
        errors.push(`File size too large: ${checks.file_size} bytes (expected ~${expectedSize.toFixed(0)} bytes)`);
    }

    // 9. Check for silence (basic heuristic)
    const expectedMinSize = checks.sample_rate * 2 * checks.duration * 0.1; // At least 10% of theoretical size
    if (checks.file_size < expectedMinSize) {
        errors.push('Audio may be silent or very quiet');
    }

    return {
        valid: errors.length === 0,
        errors,
        checks,
        metadata,
    };
}

/**
 * Quick validation (format and basic properties only)
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function quickValidate(filePath) {
    try {
        const metadata = await getAudioMetadata(filePath);
        return (
            metadata.format === 'wav' &&
            metadata.sample_rate === 16000 &&
            metadata.channels === 1 &&
            metadata.duration > 0.5 &&
            metadata.duration < 30
        );
    } catch {
        return false;
    }
}

module.exports = {
    validateAudio,
    quickValidate,
};
