import { expect, test } from '@playwright/test';

test('Hồ sơ tổ chức: đổi tên, thay ảnh tại chỗ, hủy/xóa và giữ lịch sử đối chiếu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('demo_e2e');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Demo-e2e-password-2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống', exact: true })).toBeVisible();
  const headers = {
    'X-CSRF-Token': decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'seal_csrf')!.value,
    ),
  };
  async function post(path: string, data: unknown) {
    const response = await page.request.post(`/api/v1${path}`, { headers, data });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const images = await page.evaluate(() =>
    ['#ac2935', '#b92937'].map((color, index) => {
      const c = document.createElement('canvas');
      c.width = c.height = 300;
      const x = c.getContext('2d')!;
      x.fillStyle = 'white';
      x.fillRect(0, 0, 300, 300);
      x.strokeStyle = color;
      x.lineWidth = 5 + index;
      x.beginPath();
      x.arc(150, 150, 95, 0, 2 * Math.PI);
      x.stroke();
      x.font = '24px sans-serif';
      x.fillStyle = color;
      x.fillText(index ? 'NEW' : 'OLD', 120, 157);
      return c.toDataURL('image/png').split(',')[1];
    }),
  );
  const uploaded = await page.request.post('/api/v1/assets/upload', {
    headers,
    multipart: {
      file: { name: 'reference-old.png', mimeType: 'image/png', buffer: Buffer.from(images[0], 'base64') },
    },
  });
  expect(uploaded.ok()).toBeTruthy();
  const source = await uploaded.json();
  const prepared = await post('/preprocessing/apply', {
    source_asset_id: source.id,
    roi: { x: 30, y: 30, width: 240, height: 240 },
    roi_confirmed: true,
  });
  const reference = await post('/reference-intake', {
    organization_name: 'Quản lý con dấu E2E',
    name: 'Con dấu trước chỉnh sửa',
    image_asset_id: prepared.asset.id,
  });
  const analysis = await post('/analyses', {
    title: 'Đối chiếu trước khi thay và xóa dấu',
    query_asset_id: prepared.asset.id,
    candidates: [{ reference_asset_id: prepared.asset.id, reference_impression_id: reference.id }],
  });
  await post(`/analyses/${analysis.id}/compare-openai`, { consent: true });
  const resultsBefore = await (await page.request.get(`/api/v1/analyses/${analysis.id}/results`)).json();

  await page.goto(`/organizations/${reference.organization_id}`);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Chỉnh sửa con dấu', exact: true });
  await dialog.getByLabel('Tên mẫu dấu', { exact: true }).fill('Con dấu đã chỉnh sửa E2E');
  await dialog.getByLabel('Ghi chú con dấu', { exact: true }).fill('Mẫu lưu cho tổ chức');
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Con dấu đã chỉnh sửa E2E', exact: true })).toBeVisible();
  await expect(page.locator('.stamp-card')).toContainText('Mẫu lưu cho tổ chức');

  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Chỉnh sửa con dấu', exact: true });
  await dialog.getByRole('button', { name: 'Thay ảnh con dấu', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled();
  await dialog
    .getByLabel('Tải ảnh thay thế con dấu', { exact: true })
    .setInputFiles({
      name: 'reference-new.png',
      mimeType: 'image/png',
      buffer: Buffer.from(images[1], 'base64'),
    });
  const preparation = dialog.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true });
  await expect(preparation.getByAltText('Xem trước ảnh K', { exact: true })).toBeVisible();
  await preparation.getByRole('button', { name: 'Xác nhận vùng dấu K', exact: true }).click();
  await expect(dialog.getByAltText('Con dấu thay thế đã chuẩn bị', { exact: true })).toBeVisible();
  const current = await (await page.request.get(`/api/v1/seal-impressions/${reference.id}`)).json();
  expect(current.image_asset_id).toBe(prepared.asset.id); // No replacement before save.
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: 'test-results/reference-edit-desktop.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: 'test-results/reference-edit-phone.png', animations: 'disabled' });
  await page.setViewportSize({ width: 1366, height: 768 });
  const patch = page.waitForResponse(
    (r) => r.url().endsWith(`/reference-intake/${reference.id}`) && r.request().method() === 'PATCH',
  );
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  const response = await patch;
  expect(response.ok(), await response.text()).toBeTruthy();
  const replacement = await response.json();
  expect(replacement.image_asset_id).not.toBe(prepared.asset.id);
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Con dấu (1)', exact: true })).toBeVisible();
  await expect(page.locator('.stamp-card img')).toHaveAttribute(
    'src',
    new RegExp(replacement.image_asset_id),
  );
  await page.getByRole('button', { name: 'Tài liệu nguồn', exact: true }).click();
  await expect(page.locator('.document-card')).toContainText('reference-new.png');
  await page.getByRole('button', { name: 'Con dấu (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Chỉnh sửa con dấu', exact: true });
  await dialog.getByLabel('Tên mẫu dấu', { exact: true }).fill('Tên hủy không được lưu');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Con dấu đã chỉnh sửa E2E', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Xóa con dấu khỏi thư viện?', exact: true });
  await confirm.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.locator('.stamp-card')).toHaveCount(1);
  const inventory = await (await page.request.get('/api/v1/library-searches/inventory')).json();
  await page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await confirm.getByRole('button', { name: 'Xóa con dấu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đơn vị chưa có con dấu', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Con dấu (0)', exact: true })).toBeVisible();
  const inventoryAfter = await (await page.request.get('/api/v1/library-searches/inventory')).json();
  expect(inventoryAfter.reference_count).toBe(inventory.reference_count - 1);
  expect(await (await page.request.get(`/api/v1/analyses/${analysis.id}/results`)).json()).toEqual(
    resultsBefore,
  );
  expect((await page.request.get(`/api/v1/assets/${prepared.asset.id}/preview`)).ok()).toBeTruthy();
  expect((await page.request.get(`/api/v1/reports/${analysis.id}`)).ok()).toBeTruthy();
  expect(errors).toEqual([]);
});
