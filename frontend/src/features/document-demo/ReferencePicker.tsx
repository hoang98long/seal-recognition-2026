import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Search } from 'lucide-react';
import { api, previewUrl } from '../../lib/api';
import type { Impression, Organization, Page } from '../../types';
import { Empty, ErrorBox, Loading, Pagination } from '../../components/shared';

export function ReferencePicker({
  selected,
  disabled,
  onSelect,
}: {
  selected: string;
  disabled: boolean;
  onSelect: (item: Impression) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [org, setOrg] = useState('');
  const [page, setPage] = useState(1);
  const [choosing, setChoosing] = useState('');
  const [error, setError] = useState('');
  const organizations = useQuery({
    queryKey: ['org-options'],
    queryFn: () => api<Page<Organization>>('/organizations?page_size=100'),
  });
  const references = useQuery({
    queryKey: ['reference-options', q, org, page],
    queryFn: () =>
      api<Page<Impression>>(
        `/seal-impressions?q=${encodeURIComponent(q)}${org ? `&organization_id=${org}` : ''}&page=${page}&page_size=6`,
      ),
  });
  return (
    <div className="reference-picker">
      <div className="search-field">
        <Search size={17} />
        <input
          aria-label="Tìm dấu trong thư viện"
          placeholder="Tìm tên dấu hoặc tổ chức…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <label className="sr-only" htmlFor="reference-organization">
        Lọc tổ chức
      </label>
      <select
        id="reference-organization"
        value={org}
        onChange={(e) => {
          setOrg(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Tất cả tổ chức</option>
        {organizations.data?.items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {organizations.error && <ErrorBox error={organizations.error} />}
      {error && <ErrorBox error={new Error(error)} />}
      {references.isPending ? (
        <Loading />
      ) : references.error ? (
        <ErrorBox error={references.error} />
      ) : !references.data.items.length ? (
        <Empty
          title="Chưa có con dấu phù hợp"
          description="Tải ảnh trực tiếp hoặc thêm con dấu tổ chức vào thư viện."
        >
          <Link className="text-link" to="/seal-library/add">
            Thêm con dấu tổ chức
          </Link>
        </Empty>
      ) : (
        <>
          <div className="reference-options">
            {references.data.items.map((item) => (
              <button
                key={item.id}
                className={`reference-option ${selected === item.id ? 'selected' : ''}`}
                disabled={disabled || !!choosing}
                onClick={async () => {
                  setChoosing(item.id);
                  setError('');
                  try {
                    await onSelect(item);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setChoosing('');
                  }
                }}
              >
                <img src={previewUrl(item.image_asset_id)} alt="" loading="lazy" />
                <span>
                  <strong>{item.design_name}</strong>
                  <small>{item.organization_name}</small>
                </span>
                {selected === item.id && <Check size={18} />}
                {choosing === item.id && <span>Đang chọn…</span>}
              </button>
            ))}
          </div>
          <Pagination page={page} size={6} total={references.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
