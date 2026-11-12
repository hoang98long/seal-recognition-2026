import { test, expect } from '@playwright/test';

test('Tổ chức → nhiều tài liệu → khoanh dấu đen bằng chuột → đổi tên → Top 3 toàn thư viện qua SDK mock', async ({
  page,
}) => {
  const errors: string[] = [];
  let searches = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('/api/v1/library-searches') && r.method() === 'POST') searches++;
  });
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('demo_e2e');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Demo-e2e-password-2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống', exact: true })).toBeVisible();
  const csrf = decodeURIComponent(
    (await page.context().cookies()).find((c) => c.name === 'seal_csrf')!.value,
  );
  const headers = { 'X-CSRF-Token': csrf };
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const files = await page.evaluate(() => {
    return ['#be2438', '#222222'].map((color) => {
      const c = document.createElement('canvas');
      c.width = 300;
      c.height = 300;
      const x = c.getContext('2d')!;
      x.fillStyle = 'white';
      x.fillRect(0, 0, 300, 300);
      x.strokeStyle = color;
      x.lineWidth = 5;
      x.beginPath();
      x.arc(150, 150, 95, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = color;
      x.font = '24px sans-serif';
      x.fillText('TEST', 116, 157);
      return c.toDataURL('image/png').split(',')[1];
    });
  });
  const owner = await post('/organizations', { name: 'Tổ chức luồng tài liệu E2E' });
  await page.goto('/organizations');
  await page.getByRole('link', { name: 'Tổ chức luồng tài liệu E2E', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổ chức luồng tài liệu E2E', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Tải tài liệu & tách dấu', exact: true }).click();
  await page.getByLabel('Tải ảnh con dấu tổ chức').setInputFiles([
    { name: 'organization-red.png', mimeType: 'image/png', buffer: Buffer.from(files[0], 'base64') },
    { name: 'organization-black.png', mimeType: 'image/png', buffer: Buffer.from(files[1], 'base64') },
  ]);
  await expect(
    page.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true }).getByText(/organization-black\.png/),
  ).toBeVisible();
  const k = page.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true });
  const canvas = k.locator('.roi-svg');
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height * 0.9, { steps: 12 });
  await page.mouse.up();
  await expect(k.getByAltText('Xem trước ảnh K')).toBeVisible();
  await k.getByText('Chỉnh tọa độ và chất lượng ảnh', { exact: true }).click();
  expect(
    Number(await k.getByRole('spinbutton', { name: 'Rộng K', exact: true }).inputValue()),
  ).toBeGreaterThan(230);
  expect(Number(await k.getByRole('spinbutton', { name: 'Rộng K', exact: true }).inputValue())).toBeLessThan(
    250,
  );
  await k.getByRole('button', { name: 'Xác nhận vùng dấu K', exact: true }).click();
  await expect(k.getByRole('button', { name: 'Ảnh K đã sẵn sàng', exact: true })).toBeDisabled();
  await k.getByRole('button', { name: 'Đổi tên ảnh đã xử lý', exact: true }).click();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Dấu đen của tổ chức (E2E)');
  await page.getByRole('button', { name: 'Lưu tên', exact: true }).click();
  await expect(k.getByText('Dấu đen của tổ chức (E2E)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu vào thư viện', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã lưu con dấu', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Xem trong thư viện', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Con dấu (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tài liệu nguồn', exact: true }).click();
  await expect(page.locator('.document-card')).toHaveCount(2);
  const originals = await (await page.request.get(`/api/v1/documents?organization_id=${owner.id}`)).json();
  const source = originals.items.find(
    (d: { display_name: string }) => d.display_name === 'organization-red.png',
  ).file_asset_id;
  const profile = await post('/preprocessing/profiles', {
    name: 'Cấu hình đơn vị E2E',
    organization_id: owner.id,
    parameters: { brightness: 7 },
  });
  await post('/preprocessing/profiles', {
    name: 'Cấu hình cũ chuyển sang đơn vị E2E',
    parameters: { contrast: 1.1 },
  });
  await page.goto(`/organizations/${owner.id}`);
  await page.getByRole('button', { name: /Cấu hình xử lý/ }).click();
  await expect(page.getByText('Cấu hình đơn vị E2E', { exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Gắn cấu hình cũ chưa thuộc tổ chức', exact: true })
    .selectOption({ label: 'Cấu hình cũ chuyển sang đơn vị E2E' });
  await page.getByRole('button', { name: 'Gắn vào tổ chức', exact: true }).click();
  await expect(
    page.locator('.profile-row').filter({ hasText: 'Cấu hình cũ chuyển sang đơn vị E2E' }),
  ).toBeVisible();
  await page.goto(`/preprocessing?organization=${owner.id}&profile=${profile.id}&asset=${source}`);
  await expect(page.getByRole('combobox', { name: 'Cấu hình xử lý của tổ chức', exact: true })).toHaveValue(
    profile.id,
  );
  await expect(page.getByRole('spinbutton', { name: 'Độ sáng', exact: true })).toHaveValue('7');
  for (const [i, code] of ['VPCP', 'TTCP', 'BCA', 'BQP'].entries()) {
    const org = await post('/organizations', { name: `Ranking ${code} E2E`, code: `R-${code}` });
    for (let copy = 0; copy < (i === 0 ? 2 : 1); copy++) {
      const processed = await post('/preprocessing/apply', {
        source_asset_id: source,
        roi: { x: 25, y: 25, width: 250, height: 250 },
        roi_confirmed: true,
        organization_id: org.id,
        parameters: { brightness: (i + 1) * 11 },
      });
      await post('/reference-intake', {
        organization_id: org.id,
        name: `${code} mẫu ${copy + 1}`,
        image_asset_id: processed.asset.id,
      });
    }
  }
  const q = await post('/preprocessing/apply', {
    source_asset_id: source,
    roi: { x: 25, y: 25, width: 250, height: 250 },
    roi_confirmed: true,
    parameters: { gamma: 1.77 },
  });
  const inventory = await (await page.request.get('/api/v1/library-searches/inventory')).json();
  expect(inventory.reference_count).toBeGreaterThan(5);
  await page.goto(`/compare/library?q=${q.asset.id}`);
  await expect(page.getByRole('heading', { name: 'Dấu Q đã chuẩn bị', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tra cứu Top 3', exact: true })).toBeEnabled();
  await expect(page.locator('.lookup-confirm input[type=checkbox]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/bên ngoài|chia sẻ|gửi tới/i);
  expect(searches).toBe(0);
  await page.getByRole('button', { name: 'Tra cứu Top 3', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kết quả xếp hạng tổ chức', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('.ranking-card')).toHaveCount(3);
  await expect(page.locator('.ranking-card .match-explanation')).toHaveCount(3);
  await expect(page.getByText('96%', { exact: true })).toHaveClass(/score-green/);
  await expect(page.getByText('90%', { exact: true })).toHaveClass(/score-yellow/);
  await expect(page.getByText('65%', { exact: true })).toHaveClass(/score-red/);
  await expect(page.locator('.ranking-card').first()).toContainText('Ranking VPCP E2E');
  expect(searches).toBe(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/top3-organizations-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  const session = new URL(page.url()).searchParams.get('session');
  const state = await (await page.request.get(`/api/v1/library-searches/${session}`)).json();
  expect(state.total).toBe(inventory.reference_count);
  expect(state.processed).toBe(inventory.reference_count);
  const firstReference = state.rankings[0].reference_asset_id;
  await page.goto(`/compare/new?q=${q.asset.id}&k=${firstReference}`);
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await expect(page.getByAltText('Dấu đối chiếu K đã chọn', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/compare/library?session=${session}`);
  await expect(page.getByRole('heading', { name: 'Kết quả xếp hạng tổ chức', exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/top3-organizations-phone.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
