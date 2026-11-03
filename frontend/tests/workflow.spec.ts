import { test, expect } from '@playwright/test';

test('DEMO: đăng nhập, CRUD, cắt ảnh, so sánh, chú thích và báo cáo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('admin');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByLabel('Mật khẩu hiện tại').fill('admin');
  await page.getByLabel('Mật khẩu mới (ít nhất 10 ký tự)').fill('E2E-password-2026');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('E2E-password-2026');
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await expect(
    page.getByText('Đã đổi mật khẩu. Bạn có thể tiếp tục sử dụng hệ thống.', { exact: true }),
  ).toBeVisible();
  await page.goto('/organizations');
  await page.getByRole('button', { name: 'Thêm tổ chức', exact: true }).click();
  await page.getByLabel('Tên tổ chức *').fill('Đơn vị E2E DEMO');
  await page.getByLabel('Mã đơn vị', { exact: true }).fill('E2E-DEMO');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByText('Đơn vị E2E DEMO', { exact: true })).toBeVisible();
  await page.goto('/seal-library');
  await page.getByRole('button', { name: 'Mẫu thiết kế', exact: true }).click();
  await page.getByRole('button', { name: 'Thêm mẫu thiết kế', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Tổ chức *', exact: true })
    .selectOption({ label: 'Đơn vị E2E DEMO' });
  await page.getByLabel('Tên mẫu thiết kế *').fill('Dấu thử nghiệm DEMO');
  await page.getByLabel('Mã mẫu', { exact: true }).fill('DEMO-E2E-01');
  await page.getByRole('combobox', { name: 'Loại dấu *', exact: true }).selectOption('round');
  await page.getByRole('combobox', { name: 'Trạng thái *', exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.getByText('Dấu thử nghiệm DEMO', { exact: true })).toBeVisible();
  const demo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 500, 400);
    ctx.strokeStyle = '#c02030';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(250, 200, 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c02030';
    ctx.font = '36px sans-serif';
    ctx.fillText('DEMO', 195, 212);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.goto('/documents');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'DEMO.png', mimeType: 'image/png', buffer: Buffer.from(demo, 'base64') });
  await page
    .locator('.document-card')
    .filter({ hasText: 'DEMO.png' })
    .getByRole('link', { name: 'Chọn con dấu để xử lý' })
    .click();
  await expect(page.getByRole('heading', { name: 'Xưởng xử lý ảnh', exact: true })).toBeVisible();
  const canvas = page.locator('.roi-svg');
  await expect(canvas).toBeVisible();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.15, bounds.y + bounds.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.9, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Gợi ý vùng mực đỏ', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Độ sáng', exact: true }).fill('12');
  await expect(page.getByAltText('Kết quả tiền xử lý xem trước')).toBeVisible();
  await page.getByLabel('Tôi xác nhận ROI đã chọn là vùng con dấu cần xử lý').check();
  await page.getByRole('button', { name: 'Áp dụng và lưu', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn làm Q', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn làm K', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/editor-1366.png', fullPage: true });
  await page.goto('/compare/new');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page
    .getByLabel('Tôi được phép chia sẻ các ảnh này và đồng ý gửi tới OpenAI trong phiên này.')
    .check();
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await page.getByRole('button', { name: 'Phân tích bằng OpenAI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tương đồng biểu kiến', exact: true })).toBeVisible();
  await expect(
    page.getByText('DEMO — không phải AI thật. Hai ảnh thử nghiệm có vòng tròn và chữ DEMO.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Khoanh vùng', exact: true }).click();
  const annotation = page.locator('.tab-content .roi-svg');
  const ab = (await annotation.boundingBox())!;
  await page.mouse.move(ab.x + ab.width * 0.2, ab.y + ab.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(ab.x + ab.width * 0.4, ab.y + ab.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await page.getByLabel('Ghi chú vùng').fill('Vùng DEMO do người dùng đánh dấu');
  await page.getByRole('button', { name: 'Lưu vùng', exact: true }).click();
  await expect(
    page.locator('.annotation-list').getByText('Vùng DEMO do người dùng đánh dấu', { exact: true }),
  ).toBeVisible();
  const reportHref = await page.getByRole('link', { name: 'Xuất HTML', exact: true }).getAttribute('href');
  const report = await page.request.get(reportHref!);
  expect(report.ok()).toBeTruthy();
  expect(await report.text()).toContain('DEMO — không phải AI thật');
  const normalized = await page.evaluate(() => localStorage.getItem('seal-Q'));
  await page.goto('/seal-library');
  await page.getByRole('button', { name: 'Thêm ảnh dấu tham chiếu', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Mẫu thiết kế *', exact: true })
    .selectOption({ label: 'Dấu thử nghiệm DEMO' });
  await page.getByRole('combobox', { name: 'Ảnh đã xử lý *', exact: true }).selectOption(normalized!);
  await page
    .getByRole('combobox', { name: 'Trạng thái tham chiếu *', exact: true })
    .selectOption('reference_only');
  await page.getByRole('combobox', { name: 'Trạng thái *', exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click();
  await expect(page.locator('.stamp-card')).toHaveCount(1);
  for (const [route, title] of [
    ['/dashboard', 'Tổng quan hệ thống'],
    ['/history', 'Lịch sử phân tích'],
    ['/reports', 'Báo cáo phân tích'],
    ['/settings', 'Cài đặt'],
    ['/users', 'Người dùng & phân quyền'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Phiên phân tích gần đây', exact: true })).toBeVisible();
  await expect(page.locator('.recharts-surface')).toBeVisible();
  await page.getByRole('button', { name: 'Thông báo phiên phân tích', exact: true }).click();
  await expect(
    page.locator('.notification-popover').getByText('Phiên đối chiếu con dấu', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Thông báo phiên phân tích', exact: true }).click();
  await page.screenshot({ path: 'test-results/dashboard-1366.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
  await page.screenshot({
    path: 'test-results/dashboard-tablet.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
