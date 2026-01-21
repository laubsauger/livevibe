/**
 * PatternValidator - Validate Strudel patterns before applying
 */

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// Known invalid function names that LLMs hallucinate
const INVALID_FUNCTIONS = [
    'stutter', 'supersaw', 'wobble', 'spread', 'randcat',
    'lowpass', 'highpass', 'bandpass' // Use lpf, hpf, bpf
];

// Valid Strudel synth names
const VALID_SYNTHS = [
    'sawtooth', 'square', 'triangle', 'sine',
    'white', 'pink', 'brown', 'crackle'
];

/**
 * Validate a Strudel pattern
 */
export function validatePattern(pattern: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check for empty pattern
    if (!pattern.trim()) {
        return { valid: false, errors: ['Pattern is empty'], warnings: [] };
    }

    // 2. Check balanced parentheses
    let parenCount = 0;
    let bracketCount = 0;
    let braceCount = 0;

    for (const char of pattern) {
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
        else if (char === '{') braceCount++;
        else if (char === '}') braceCount--;

        if (parenCount < 0) errors.push('Unmatched closing parenthesis');
        if (bracketCount < 0) errors.push('Unmatched closing bracket');
        if (braceCount < 0) errors.push('Unmatched closing brace');
    }

    if (parenCount !== 0) errors.push('Unmatched parentheses');
    if (bracketCount !== 0) errors.push('Unmatched brackets');
    if (braceCount !== 0) errors.push('Unmatched braces');

    // 3. Check for unmatched quotes
    const singleQuotes = (pattern.match(/'/g) || []).length;
    const doubleQuotes = (pattern.match(/"/g) || []).length;
    const backticks = (pattern.match(/`/g) || []).length;

    if (singleQuotes % 2 !== 0) errors.push('Unmatched single quotes');
    if (doubleQuotes % 2 !== 0) errors.push('Unmatched double quotes');
    if (backticks % 2 !== 0) errors.push('Unmatched backticks');

    // 4. Check for TidalCycles/Haskell syntax (common LLM mistake)
    if (/\bd[1-9]\s*\$/.test(pattern)) {
        errors.push('Invalid Haskell syntax: "d1 $" is not valid in Strudel. Use note() or s() directly.');
    }

    if (/\s#\s/.test(pattern) && !pattern.includes('//')) {
        warnings.push('The "#" operator is Haskell syntax. In Strudel, chain effects with dots.');
    }

    // 5. Check for hallucinated functions
    for (const fn of INVALID_FUNCTIONS) {
        const regex = new RegExp(`\\.${fn}\\s*\\(`, 'i');
        if (regex.test(pattern)) {
            errors.push(`Invalid function ".${fn}()" does not exist in Strudel.`);
        }
    }

    // 6. Check for invalid synth names (only warn)
    const synthMatch = pattern.match(/\.s\(["']([^"']+)["']\)/g);
    if (synthMatch) {
        for (const match of synthMatch) {
            const synthName = match.match(/["']([^"']+)["']/)?.[1];
            if (synthName && !VALID_SYNTHS.includes(synthName) && !synthName.includes(':')) {
                // Only warn - it might be a sample name
                warnings.push(`Unknown synth "${synthName}". Ensure it's a valid sample or waveform.`);
            }
        }
    }

    // 7. Check for .speed() on synths (common mistake)
    if (/\.s\(["'](sawtooth|square|triangle|sine)["']\).*\.speed\(/.test(pattern)) {
        warnings.push('".speed()" only affects samples, not synth waveforms.');
    }

    return {
        valid: errors.length === 0,
        errors: [...new Set(errors)], // Dedupe
        warnings: [...new Set(warnings)]
    };
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
    if (result.valid && result.warnings.length === 0) {
        return '';
    }

    const parts: string[] = [];

    if (result.errors.length > 0) {
        parts.push('❌ ' + result.errors.join('\n❌ '));
    }

    if (result.warnings.length > 0) {
        parts.push('⚠️ ' + result.warnings.join('\n⚠️ '));
    }

    return parts.join('\n');
}
