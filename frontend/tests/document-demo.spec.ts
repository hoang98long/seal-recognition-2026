import { test, expect, type Page } from '@playwright/test';

// Small synthetic PDF: first page is a document cover, second page contains a DEMO circle.
function demoPdf(): Buffer {
  const cover = 'BT /F1 20 Tf 40 440 Td (DEMO DOCUMENT - PAGE 1) Tj ET';
  const stamp =
    'BT /F1 18 Tf 40 450 Td (DEMO DOCUMENT - PAGE 2) Tj ET 0.75 0.1 0.16 RG 4 w 270 200 m 270 238.66 238.66 270 200 270 c 161.34 270 130 238.66 130 200 c 130 161.34 161.34 130 200 130 c 238.66 130 270 161.34 270 200 c S 0.75 0.1 0.16 rg BT /F1 20 Tf 169 195 Td (DEMO) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(cover)} >>\nstream\n${cover}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${Buffer.byteLength(stamp)} >>\nstream\n${stamp}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(
    pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`,
  );
}
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill('demo_e2e');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Demo-e2e-password-2026');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Văn bản & ảnh dấu', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'So khớp văn bản & ảnh dấu', exact: true })).toBeVisible();
}
async function preparePair(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 240;
    const x = c.getContext('2d')!;
    x.fillStyle = 'white';
    x.fillRect(0, 0, 240, 240);
    x.strokeStyle = '#bf1929';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(120, 120, 85, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = '#bf1929';
    x.font = '22px sans-serif';
    x.fillText('DEMO', 86, 126);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page
    .getByLabel('Tải văn bản có con dấu', { exact: true })
    .setInputFiles({ name: 'demo-document.pdf', mimeType: 'application/pdf', buffer: demoPdf() });
  await page
    .getByLabel('Tải ảnh dấu đối chiếu', { exact: true })
    .setInputFiles({ name: 'reference-DEMO.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Chọn vùng con dấu', exact: true }).click();
  const q = page.getByRole('region', { name: 'Chuẩn bị ảnh Q', exact: true });
  const k = page.getByRole('region', { name: 'Chuẩn bị ảnh K', exact: true });
  await q.getByRole('combobox', { name: 'Trang / khung ảnh Q', exact: true }).selectOption('2');
  await q.getByRole('button', { name: 'Gợi ý vùng mực đỏ Q', exact: true }).click();
  await q.getByText('Chỉnh tọa độ và chất lượng ảnh', { exact: true }).click();
  await q.getByRole('spinbutton', { name: 'Độ sáng Q', exact: true }).fill('12');
  await q.getByRole('button', { name: 'Xác nhận vùng dấu Q', exact: true }).click();
  await expect(q.getByRole('button', { name: 'Ảnh Q đã sẵn sàng', exact: true })).toBeDisabled();
  await k.getByRole('button', { name: 'Dùng toàn ảnh K', exact: true }).click();
  await expect(k.getByRole('button', { name: 'Xác nhận vùng dấu K', exact: true })).toBeDisabled();
  await k.getByRole('checkbox', { name: 'Chọn toàn ảnh K', exact: true }).check();
  await k.getByRole('button', { name: 'Xác nhận vùng dấu K', exact: true }).click();
  await expect(k.getByRole('button', { name: 'Ảnh K đã sẵn sàng', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Tiếp tục so khớp', exact: true }).click();
  await expect(page.getByAltText('Ảnh Q dùng để so khớp', { exact: true })).toBeVisible();
  await expect(page.getByAltText('Ảnh K dùng để đối chiếu', { exact: true })).toBeVisible();
}

test('Demo riêng: PDF hai trang + ảnh tải lên → ROI → OpenAI SDK mock → báo cáo và chạy lại', async ({
  page,
}) => {
  const errors: string[] = [];
  let calls = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().endsWith('/compare-openai')) calls++;
  });
  await login(page);
  await preparePair(page);
  expect(calls).toBe(0);
  await expect(page.getByRole('button', { name: 'So khớp con dấu', exact: true })).toBeEnabled();
  await expect(page.locator('.demo-review input[type=checkbox]')).toHaveCount(0);
  await page.getByLabel('Tên phiên so khớp', { exact: true }).fill('Demo PDF hai trang');
  await page.getByRole('button', { name: 'So khớp con dấu', exact: true }).click();
  const result = page.getByRole('region', { name: 'Kết quả so khớp', exact: true });
  await expect(result.getByRole('heading', { name: 'Cần xem xét', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('DEMO — không phải AI thật');
  await expect(page.locator('body')).not.toContainText(/OpenAI|bên ngoài|chia sẻ|gửi tới/i);
  await expect(page.locator('.score-circle strong')).toHaveText('80');
  await expect(result.locator('.match-conclusion')).toContainText('Hai ảnh có một số đặc điểm tương đồng');
  await expect(result.getByRole('list', { name: 'Căn cứ đối chiếu' }).locator('li')).toHaveCount(3);
  await expect(result.locator('.match-reasons')).toContainText('DEMO: khoảng cách chữ có khác biệt.');
  await expect(result.locator('.match-limitation')).toContainText('DEMO: một phần chi tiết chưa rõ.');
  expect(calls).toBe(1);
  const link = await page.getByRole('link', { name: /Mở phiên đã lưu/ }).getAttribute('href');
  const id = link!.split('/')[2];
  const session = await (await page.request.get(`/api/v1/analyses/${id}`)).json();
  expect(session.source_document_id).toBeTruthy();
  const results = await (await page.request.get(`/api/v1/analyses/${id}/results`)).json();
  expect(results[0].prompt_version).toBe('seal-brief-vi-v3');
  expect(results[0].input_metadata.query.preprocessing.source_page).toBe(2);
  expect(results[0].input_metadata.query.preprocessing.parameters.brightness).toBe(12);
  expect(results[0].input_metadata.reference.source_metadata.whole_source_confirmed).toBe(true);
  expect(results[0].structured_result.summary_vi).toContain('DEMO — không phải AI thật');
  const report = await page.request.get(`/api/v1/reports/${id}/export?download=true`);
  expect(report.ok()).toBeTruthy();
  expect(await report.text()).toContain('Điểm tương đồng');
  expect(await report.text()).toContain('Căn cứ đối chiếu');
  expect(await report.text()).toContain('DEMO: khoảng cách chữ có khác biệt.');
  expect(await report.text()).not.toMatch(
    /OpenAI|gpt-|seal-only-vi|SDK|Quan sát Q|Khuyến nghị|bên ngoài|gửi tới|chia sẻ/,
  );
  await expect(page.getByRole('button', { name: 'So khớp lại', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'So khớp lại', exact: true }).click();
  await expect(result.getByText(/2 phiên bản kết quả/)).toBeVisible();
  expect(calls).toBe(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/document-demo-results.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect
    .poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(820);
  await page.getByRole('link', { name: 'Xem ảnh đối chiếu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cần xem xét', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thông tin ảnh', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chi tiết kỹ thuật', exact: true })).toHaveCount(0);
  await expect(page.getByText('Quan sát ảnh Q', { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/OpenAI|bên ngoài|chia sẻ|gửi tới/i);
  await expect(page.locator('body')).not.toContainText('gpt-');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const figure of await page.locator('.result-images-panel figure').all()) {
    const bounds = (await figure.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({
    path: 'test-results/compact-results-phone.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: 'test-results/compact-results-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  for (const path of ['/dashboard', '/settings', '/settings?tab=algorithms', '/history']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText(/OpenAI|bên ngoài|chia sẻ|gửi tới/i);
    await expect(page.locator('body')).not.toContainText('gpt-');
  }
  await page.route('**/api/v1/auth/me', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), role: 'admin' } });
  });
  await page.route('**/api/v1/audit-logs', async (route) =>
    route.fulfill({
      json: [
        {
          id: 'audit-1',
          action: 'external_consent',
          entity_type: 'analysis',
          created_at: new Date().toISOString(),
        },
        {
          id: 'audit-2',
          action: 'library_search_consent',
          entity_type: 'analysis',
          created_at: new Date().toISOString(),
        },
        {
          id: 'audit-3',
          action: 'openai_connection_test',
          entity_type: 'settings',
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );
  await page.goto('/settings?tab=system');
  await expect(page.getByText('Bắt đầu so khớp', { exact: true })).toBeVisible();
  await expect(page.getByText('Bắt đầu tra cứu thư viện', { exact: true })).toBeVisible();
  await expect(page.getByText('Kiểm tra kết nối so khớp', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /OpenAI|external_consent|library_search_consent|bên ngoài|chia sẻ|gửi tới/i,
  );
  expect(errors).toEqual([]);
});

test('Thiếu key: vẫn chuẩn bị Q/K nhưng không tự gửi hoặc tạo điểm', async ({ page }) => {
  await page.route('**/api/v1/settings/openai/status', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, is_configured: false } });
  });
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/compare-openai')) calls++;
  });
  await login(page);
  await preparePair(page);
  await expect(page.getByRole('button', { name: 'So khớp con dấu', exact: true })).toBeDisabled();
  await expect(page.getByText(/Dịch vụ so khớp chưa sẵn sàng/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kết quả so khớp', exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
});

test('Lỗi upstream: hiển thị lỗi, không có điểm giả; bấm chạy lại cùng phiên', async ({ page }) => {
  let createCount = 0;
  let attempts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/v1/analyses')) createCount++;
  });
  await page.route('**/api/v1/analyses/*/compare-openai', async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'provider_rate_limit',
            message: 'DEMO: OpenAI đang giới hạn tần suất. Thử lại sau.',
          },
        }),
      });
    else await route.continue();
  });
  await login(page);
  await preparePair(page);
  await page.getByRole('button', { name: 'So khớp con dấu', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Dịch vụ so khớp đang giới hạn lượt xử lý hoặc hết hạn mức.' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kết quả so khớp', exact: true })).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'So khớp con dấu', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Kết quả so khớp', exact: true })
      .getByRole('heading', { name: 'Cần xem xét', exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(createCount).toBe(1);
});
