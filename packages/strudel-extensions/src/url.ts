
/**
 * Strudel URL Encoder/Decoder
 * based on the python script logic
 */

export function encodeStrudel(code: string): string {
    // Simple Base64 encoding compatible with btoa
    // Note: Strudel actually uses lz-string for compression often, 
    // but the python script used simple base64, so we stick to that for compatibility 
    // with the definition provided in the prompt.
    // We need to handle UTF-8 properly for btoa.

    const utf8Bytes = new TextEncoder().encode(code);
    const binaryString = Array.from(utf8Bytes, byte => String.fromCodePoint(byte)).join("");
    const base64 = btoa(binaryString);
    const urlEncoded = encodeURIComponent(base64);

    return `https://strudel.cc/#${urlEncoded}`;
}

export function decodeStrudel(url: string): string {
    let encodedStr = url;
    if (url.includes('#')) {
        encodedStr = url.split('#')[1];
    }

    const base64 = decodeURIComponent(encodedStr);
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return new TextDecoder().decode(bytes);
}
