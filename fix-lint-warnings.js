import fs from 'fs';
import path from 'path';

const fixes = [
  {
    path: 'src/__tests__/BookingService.test.ts',
    replace: /const mockTx = {[^}]*};\n/g,
    with: ''
  },
  {
    path: 'src/__tests__/PartnerActions.test.ts',
    replace: /BookingStatus,\s*/g,
    with: ''
  },
  {
    path: 'src/__tests__/PaymentService.test.ts',
    replace: /isPaymentSuccess,\s*/g,
    with: ''
  }
];

for (const fix of fixes) {
  const fullPath = path.join(process.cwd(), fix.path);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    content = content.replace(fix.replace, fix.with);
    fs.writeFileSync(fullPath, content);
  }
}
