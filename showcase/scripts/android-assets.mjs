// Builds the source images for @capacitor/assets from the FireCam flame logo:
// resources/icon-only.png (1024²), icon-foreground.png, icon-background.png and splash.png (2732²).
// Run `npm run android:assets` afterwards (or this script runs it for you with --generate).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const BG = '#f5f4ef', logo = 'assets/firecam-logo.png';
await mkdir('resources', { recursive: true });
const centred = async (size, logoSize, file, bg = BG) => {
  const flame = await sharp(logo).resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).composite([{ input: flame, gravity: 'centre' }]).png().toFile(file);
};
await centred(1024, 700, 'resources/icon-only.png');
// Adaptive icon: the foreground must sit inside the inner 66% safe zone.
await centred(1024, 560, 'resources/icon-foreground.png', { r: 0, g: 0, b: 0, alpha: 0 });
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile('resources/icon-background.png');
await centred(2732, 560, 'resources/splash.png');
await centred(2732, 560, 'resources/splash-dark.png', '#171d1b');
console.log('resources/ written');
if (process.argv.includes('--generate')) {
  execSync('npx capacitor-assets generate --android --assetPath resources --iconBackgroundColor "#f5f4ef" --iconBackgroundColorDark "#171d1b" --splashBackgroundColor "#f5f4ef" --splashBackgroundColorDark "#171d1b"', { stdio: 'inherit' });
}
