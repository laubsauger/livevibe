export const STRUDEL_PATTERNS = {
  'techno-drums': `// Basic techno drum pattern
// Classic 4/4 kick with offbeat hi-hats and syncopated snare

stack(
  s("bd(3,8)"),                    // Euclidean kick pattern
  s("sd:[~ <sd!3 sd(3,4,2)>]"),   // Syncopated snare
  s("hh*8")                        // Hi-hat on every 8th
    .speed(perlin.range(.9, 1.1)) // Subtle speed variation
    .gain(perlin.range(.3, .5)),  // Dynamic variation
  s("oh").euclid(3, 16)            // Open hi-hat accents
    .gain(.4)
).cpm(128)`,

  'acid-bass': `// Classic acid bassline with TB-303 style filter modulation

note("[<g1 f1>/8](<3 5>,8)")
  .clip(perlin.range(.15, 1.5))
  .release(.1)
  .s("sawtooth")
  .lpf(sine.range(400, 800).slow(16))    // Sweeping filter
  .lpq(cosine.range(6, 14).slow(3))      // Moving resonance
  .lpenv(sine.mul(4).slow(4))            // Filter envelope
  .lpd(.2).lpa(.02)
  .ftype('24db')
  .rarely(add(note(12)))                 // Occasional octave jump
  .room(.2).shape(.3)`,

  'ambient-pad': `// Lush ambient pad with slow chord progression

note("<[c,e,g]!3 [d,f,a] [e,g,b]!2 [f,a,c]>")
  .slow(8)                               // Very slow changes
  .superimpose(x => x.add(.04))          // Slight detuning
  .add(perlin.range(0, .2))              // Subtle pitch drift
  .s("triangle")
  .attack(2)                             // Slow fade in
  .release(3)                            // Slow fade out
  .lpf(sine.range(800, 2000).slow(32))   // Gentle filter movement
  .room(.8)                              // Heavy reverb
  .gain(.3)`,

  'generative-melody': `// Generative melody using Euclidean rhythms and scale

note("<0 2 4 6>*8")
  .scale("C:minor")
  .euclid(5, 8)                          // Euclidean distribution
  .fast("<1 2 4>")                       // Variable speed
  .every(4, rev)                         // Reverse every 4 cycles
  .sometimes(add(12))                    // Random octave jumps
  .off(1/8, x => x.add(7).degradeBy(.3)) // Echo with fifth
  .s("sawtooth")
  .lpf(sine.range(300, 2000).slow(8))
  .room(.3)
  .gain(.5)`,

  'breakbeat': `// Amen break-style pattern
// NOTE: Run the samples() line first and wait for it to load!
samples('github:tidalcycles/dirt-samples');

s("breaks165")
  .slice(8, "0 1 <2 2*2> 3 [4 0] 5 6 7".every(3, rev))
  .slow(0.75)
  .sometimes(x => x.speed("<1 0.5 2>"))
  .room(.2)
  .hpf(100)
  .gain(.7)`,

  'jazz-chords': `// Jazz chord progression using chord()
// Use chord() for complex voicings
note("c eb f ab").chord("min9")
  .s("sawtooth")
  .lpf(800)
  .room(0.5)`,

  'polyrhythm': `// Polyrhythmic pattern with multiple time signatures

stack(
  s("bd(3,8)"),                          // 3 against 8
  s("sd(5,8,2)"),                        // 5 against 8, offset by 2
  s("hh*8").speed(perlin.range(.9, 1.1)),
  s("metal(7,16)").gain(.5)              // 7 against 16
).cpm(130)`
};

export const STRUDEL_GENRES = `
## Genre Styles

### Dark Ambient Hip-Hop (Lorn, Clams Casino)
- **Characteristics**: Pitched-down vocals (.speed(0.5)), deep sub bass (sine, lpf), glitchy textures, heavy reverb/delay.
- **Techniques**: Use .speed() on vocals, .scrub() for glitches, .room() > 0.6.

### Techno (General, Dub)
- **Characteristics**: 4/4 kick (120-140 BPM), Euclidean hats, filter sweeps, dub chords with delay.
- **Techniques**: s("bd(4,4)"), s("hh").struct("x(5,8)"), .lpf(sine.range(300, 2000)), .delay(.75).

### Drum & Bass / Jungle
- **Characteristics**: Fast (160-180 BPM), Amen breaks, deep sine subs, reeces.
- **Techniques**: s("breaks").slice(), .fast(2), .lpf(80) on subs.

### Trap / Hip-Hop
- **Characteristics**: Hi-hat rolls (*8, *16), 808 glides, snare variation.
- **Techniques**: s("hh*8").sometimes(fast(2)), .dist() on drums.

### Ambient / Experimental
- **Characteristics**: Long textures, drones, no fixed rhythm, heavy reverb.
- **Techniques**: .attack(4).release(8), .room(.9), .degradeBy().
`;
