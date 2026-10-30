export interface SamplePhoto {
  id: string;
  label: string;
  /** Message prefilled in the composer when the sample is picked. */
  prompt: string;
  src: string;
}

// Served from client/public/samples. The server recognises these by the SHA-256 of their
// bytes, so they must be uploaded exactly as fetched (never resized or re-encoded).
export const SAMPLE_PHOTOS: SamplePhoto[] = [
  { id: 'cracked-phone', label: 'Cracked phone', prompt: 'What can I do with this?', src: '/samples/cracked-phone.jpg' },
  {
    id: 'swollen-battery',
    label: 'Swollen battery',
    prompt: 'Is this safe to keep using?',
    src: '/samples/swollen-battery.jpg',
  },
  { id: 'old-tablet', label: 'Old tablet', prompt: 'Still works, I just upgraded.', src: '/samples/old-tablet.jpg' },
];
