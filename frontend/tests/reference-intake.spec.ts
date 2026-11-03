import { test, expect } from '@playwright/test';

test('Thêm dấu cùng tổ chức mới, chọn lại từ thư viện và so khớp không cần xử lý K lần nữa', async ({
  page,
}) => {
  const errors: string[] = [];
  let compareCalls = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('/compare-openai')) compareCalls++;
  });
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('demo_e2e');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Demo-e2e-password-2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
  await page.getByRole('link', { name: /^Thêm con dấu tổ chức/ }).click();
  await page.getByRole('button', { name: 'Tạo tổ chức mới', exact: true }).click();
  const organizationName = `Tổ chức thử ${Date.now()}`;
  await page.getByLabel('Tên tổ chức mới', { exact: true }).fill(organizationName);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 300;
    const x = c.getContext('2d')!;
    x.fillStyle = 'white';
    x.fillRect(0, 0, 300, 300);
    x.strokeStyle = '#be2438';
    x.lineWidth = 5;
    x.beginPath();
    x.arc(150, 150, 100, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = '#be2438';
    x.font = '24px sans-serif';
    x.fillText('DEMO', 110, 157);
    return c.toDataURL('image/png').split(',')[1];
  });
  const image = { name: 'Dấu thử nghiệm mới.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  await page.getByLabel('Tải ảnh con dấu tổ chức').setInputFiles(image);
  await expect(page.getByLabel('Tên con dấu', { exact: true })).toHaveValue('Dấu thử nghiệm mới');
  const k = page.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true });
  await expect(k.getByAltText('Xem trước ảnh K')).toBeVisible();
  await expect(k.getByRole('spinbutton', { name: 'Độ sáng K', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu vào thư viện', exact: true })).toBeDisabled();
  await k.getByRole('button', { name: 'Xác nhận vùng dấu K', exact: true }).click();
  await expect(k.getByRole('button', { name: 'Ảnh K đã sẵn sàng', exact: true })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/reference-intake.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Lưu vào thư viện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã lưu con dấu', exact: true })).toBeVisible();
  expect(compareCalls).toBe(0);
  const preselected = await page
    .getByRole('link', { name: 'So khớp văn bản với dấu này', exact: true })
    .getAttribute('href');
  await page.goto(preselected!);
  await expect(
    page.getByText(`Đã chọn: ${organizationName} · Dấu thử nghiệm mới`, { exact: true }),
  ).toBeVisible();
  await page.goto('/compare/document-stamp');
  await expect(page.getByRole('heading', { name: 'So khớp văn bản & ảnh dấu', exact: true })).toBeVisible();
  await expect(page.locator('.page-header')).not.toContainText(/demo/i);
  await page.getByRole('button', { name: 'Chọn từ thư viện', exact: true }).click();
  await page.getByLabel('Tìm dấu trong thư viện').fill(organizationName);
  await page.getByRole('button', { name: new RegExp(`Dấu thử nghiệm mới.*${organizationName}`) }).click();
  await page.getByLabel('Tải văn bản có con dấu').setInputFiles(image);
  await page.getByRole('button', { name: 'Chọn vùng con dấu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Dấu thư viện đã sẵn sàng' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true })).toHaveCount(0);
  const q = page.getByRole('region', { name: 'Chuẩn bị ảnh Q', exact: true });
  await q.getByRole('button', { name: 'Xác nhận vùng dấu Q', exact: true }).click();
  await expect(q.getByRole('button', { name: 'Ảnh Q đã sẵn sàng', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Tiếp tục so khớp', exact: true }).click();
  await page
    .getByLabel('Tôi được phép chia sẻ hai ảnh Q/K này và đồng ý gửi tới OpenAI để phân tích.', {
      exact: true,
    })
    .check();
  await page.getByRole('button', { name: 'So khớp bằng OpenAI', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Kết quả so khớp', exact: true })
      .getByRole('heading', { name: 'Tương đồng biểu kiến', exact: true }),
  ).toBeVisible();
  const sessionLink = await page.getByRole('link', { name: /Mở phiên đã lưu/ }).getAttribute('href');
  const session = await (await page.request.get(`/api/v1/analyses/${sessionLink!.split('/')[2]}`)).json();
  expect(session.candidates[0].reference_impression_id).toBeTruthy();
  expect(compareCalls).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: 'test-results/comparison-phone.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/seal-library/add');
  await expect(page.getByRole('heading', { name: 'Thêm con dấu tổ chức' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  expect(errors).toEqual([]);
});
