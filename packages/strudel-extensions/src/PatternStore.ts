/**
 * PatternStore - Save and load pattern favorites to localStorage
 */

export interface SavedPattern {
    id: string;
    name: string;
    content: string;
    tags: string[];
    timestamp: string;
}

const STORAGE_KEY = 'livevibe-patterns';

/**
 * Generate a unique ID
 */
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Get all saved patterns
 */
export function getPatterns(): SavedPattern[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Save a pattern
 */
export function savePattern(name: string, content: string, tags: string[] = []): SavedPattern {
    const patterns = getPatterns();

    const pattern: SavedPattern = {
        id: generateId(),
        name: name.trim() || `Pattern ${patterns.length + 1}`,
        content,
        tags,
        timestamp: new Date().toISOString()
    };

    patterns.unshift(pattern); // Add to beginning

    // Limit to 500 patterns
    if (patterns.length > 500) {
        patterns.pop();
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    return pattern;
}

/**
 * Load a pattern by ID
 */
export function loadPattern(id: string): SavedPattern | null {
    const patterns = getPatterns();
    return patterns.find(p => p.id === id) || null;
}

/**
 * Delete a pattern by ID
 */
export function deletePattern(id: string): boolean {
    const patterns = getPatterns();
    const filtered = patterns.filter(p => p.id !== id);

    if (filtered.length === patterns.length) return false;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
}

/**
 * Update a pattern
 */
export function updatePattern(id: string, updates: Partial<Omit<SavedPattern, 'id' | 'timestamp'>>): boolean {
    const patterns = getPatterns();
    const index = patterns.findIndex(p => p.id === id);

    if (index === -1) return false;

    patterns[index] = { ...patterns[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    return true;
}

/**
 * Export all patterns as JSON
 */
export function exportPatterns(): string {
    return JSON.stringify(getPatterns(), null, 2);
}

/**
 * Import patterns from JSON
 */
export function importPatterns(json: string): number {
    try {
        const imported = JSON.parse(json) as SavedPattern[];
        if (!Array.isArray(imported)) return 0;

        const existing = getPatterns();
        const existingIds = new Set(existing.map(p => p.id));

        // Add only non-duplicate patterns
        let added = 0;
        for (const p of imported) {
            if (!existingIds.has(p.id) && p.content) {
                existing.push(p);
                added++;
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        return added;
    } catch {
        return 0;
    }
}
