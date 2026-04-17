import fs from 'fs';
import path from 'path';

const filesToFix = [
  'src/__tests__/AuditFixes.test.ts',
  'src/__tests__/BookingService.test.ts',
  'src/__tests__/NotificationService.test.ts',
  'src/__tests__/PartnerActions.test.ts',
  'src/__tests__/PaymentService.test.ts',
  'src/__tests__/setup.tsx',
  'src/app/[locale]/register/RegisterClient.test.tsx',
  'src/components/layout/VerificationBanner.test.tsx',
];

for (const p of filesToFix) {
  const fullPath = path.join(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Replace `: any` with `: unknown` or `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
    // Alternatively, just globally replace `: any` with `: unknown` if it's safe for tests.
    content = content.replace(/: any\b/g, ': unknown');
    content = content.replace(/as any\b/g, 'as unknown');
    
    // Unused vars
    content = content.replace(/import\s+{\s*BookingStatus\s*}\s*from\s*'@prisma\/client';/, '');
    content = content.replace(/import\s+{\s*isPaymentSuccess\s*}\s*from\s*'@\/lib\/payment-status';/, '');
    content = content.replace(/const mockTx = {[^}]*};/g, '/* unused mockTx */'); // For BookingService.test.ts
    
    fs.writeFileSync(fullPath, content);
  }
}
