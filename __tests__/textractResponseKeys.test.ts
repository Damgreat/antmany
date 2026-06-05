import {buildTextractResponseKeys} from '../src/utils/textractResponseKeys';

describe('buildTextractResponseKeys', () => {
  it('prefers stem.json over uploadedKey.json (no double extension)', () => {
    expect(buildTextractResponseKeys('pix-1780587087070-143981.jpg')).toEqual([
      'resps/pix-1780587087070-143981.json',
      'resps/pix-1780587087070-143981.jpg.json',
    ]);
  });

  it('handles keys without extension', () => {
    expect(buildTextractResponseKeys('pix-123-upload')).toEqual([
      'resps/pix-123-upload.json',
    ]);
  });
});
