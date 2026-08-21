import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processBrainScan } from './classifier';

describe('classifierService (Local TFLite Web Interface)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should run mock simulation mode and correctly reject non-brain CT scans', async () => {
    // Mock image load element to avoid DOM exceptions in test env
    vi.stubGlobal('Image', vi.fn().mockImplementation(function() {
      const img = {
        set onload(cb: any) {
          setTimeout(cb, 1);
        },
        set onerror(_: any) {},
        src: ''
      };
      return img;
    }));

    const file = new File([''], 'non_brain.jpg', { type: 'image/jpeg' });
    const res = await processBrainScan('data:image/jpeg;base64,', file);

    expect(res.validationFailed).toBe(true);
    expect(res.validationError).toBe('Input rejected: not a brain CT image');
    expect(res.hasHemorrhage).toBe(false);
  });

  it('should run mock simulation mode and successfully classify normal brain scans', async () => {
    vi.stubGlobal('Image', vi.fn().mockImplementation(function() {
      const img = {
        set onload(cb: any) {
          setTimeout(cb, 1);
        },
        set onerror(_: any) {},
        src: ''
      };
      return img;
    }));

    // Choose size and name that deterministic mock generator will treat as normal brain CT
    const file = new File(['a'.repeat(20)], 'normal_brain_ct.jpg', { type: 'image/jpeg' });
    const res = await processBrainScan('data:image/jpeg;base64,', file);

    expect(res.validationFailed).toBe(false);
    expect(res.hasHemorrhage).toBe(false);
    expect(res.highestConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should run mock simulation mode and successfully detect abnormal scans with subtype distributions', async () => {
    // Mock Canvas context so that bounding box drawing overlay succeeds in jsdom environment
    const mockCanvas = {
      getContext: () => ({
        drawImage: () => {},
        strokeRect: () => {},
        fillRect: () => {},
        fillText: () => {},
        measureText: () => ({ width: 100 }),
      }),
      toDataURL: () => 'data:image/jpeg;base64,bW9ja2VkX2ltYWdlX2RhdGE=',
      width: 500,
      height: 500,
    };
    
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') return mockCanvas;
        return {};
      }
    });

    vi.stubGlobal('Image', vi.fn().mockImplementation(function() {
      const img = {
        set onload(cb: any) {
          setTimeout(cb, 1);
        },
        set onerror(_: any) {},
        src: '',
        naturalWidth: 500,
        naturalHeight: 500
      };
      return img;
    }));

    // Choose name that deterministic mock generator treats as abnormal
    const file = new File(['a'.repeat(50)], 'hemorrhage_patient.jpg', { type: 'image/jpeg' });
    const res = await processBrainScan('data:image/jpeg;base64,', file);

    expect(res.validationFailed).toBe(false);
    expect(res.hasHemorrhage).toBe(true);
    expect(res.highestConfidence).toBeGreaterThan(0.6);
    expect(res.processedImageUrl).toBeDefined();
    expect(res.processedImageBlob).toBeDefined();
    
    // Ensure subtype probabilities sum up to active ranges
    expect(res.intraventricular).toBeGreaterThan(0.0);
    expect(res.topSubtype).toBeDefined();
  });
});
