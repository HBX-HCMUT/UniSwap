'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/icons';
import { Field, Notice } from '../components/ui';
import { conditionNames, type Category, type School } from '../lib/model';
import { clearMarketFilters, formData, getParam, href, value, type SearchParams } from '../lib/query';
import { Toggle } from './toggle';

export function SearchBox({ query }: { query: SearchParams }) {
  return <form action="/" className="search" aria-label="Tìm tin">
    <label><Icon name="search"/><input name="q" aria-label="Tìm món đồ" placeholder="Tìm giáo trình, đèn bàn…" defaultValue={getParam(query, 'q')} /></label>
    {Object.keys(query).filter((key) => !['q', 'page'].includes(key)).map((key) => <input key={key} type="hidden" name={key} value={getParam(query, key)} />)}
    <button type="submit">Tìm</button>
  </form>;
}

export function Filters({ query, schools, categories, followed }: { query: SearchParams; schools: School[]; categories: Category[]; followed?: string[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState(getParam(query, 'categoryId'));
  useEffect(() => {
    const media = window.matchMedia('(min-width: 721px)');
    function update() { setExpanded(media.matches); }
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function apply(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const minimum = value(data, 'minPrice');
    const maximum = value(data, 'maxPrice');
    if (minimum && maximum && Number(minimum) > Number(maximum)) {
      setError('Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.');
      return;
    }
    setError('');
    const filters = Object.fromEntries([...data.entries()].map(([key, entry]) => [key, String(entry).trim()]));
    router.push(href('/', { ...query, ...filters, page: '' }));
  }
  return <details className="filters panel" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><Icon name="filter" />Bộ lọc</summary>
    <form className="stack compact" onSubmit={apply}>
      <Field name="categoryId" label="Danh mục"><select id="categoryId" name="categoryId" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Field>
      <Field name="schoolId" label="Trường"><select id="schoolId" name="schoolId" defaultValue={getParam(query, 'schoolId')}><option value="">Tất cả trường</option>{schools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field name="area" label="Khu vực"><input id="area" name="area" maxLength={120} placeholder="Ví dụ KTX A" defaultValue={getParam(query, 'area')} /></Field>
      <Field name="condition" label="Tình trạng"><select id="condition" name="condition" defaultValue={getParam(query, 'condition')}><option value="">Mọi tình trạng</option>{Object.entries(conditionNames).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></Field>
      <Field name="minPrice" label="Giá tối thiểu"><input id="minPrice" name="minPrice" type="number" min={0} max={2000000000} step={1} defaultValue={getParam(query, 'minPrice')} aria-describedby={error ? 'price-error' : undefined} /></Field>
      <Field name="maxPrice" label="Giá tối đa"><input id="maxPrice" name="maxPrice" type="number" min={0} max={2000000000} step={1} defaultValue={getParam(query, 'maxPrice')} aria-describedby={error ? 'price-error' : undefined} /></Field>
      <div id="price-error"><Notice text={error} error /></div>
      <button type="submit">Áp dụng bộ lọc</button>
      <Link href={clearMarketFilters(query)}>Xóa bộ lọc</Link>
    </form>
    {category && <div className="detail-body">
      {followed ? <Toggle key={category} endpoint={`/me/category-follows/${category}`} active={followed.includes(category)} add="Theo dõi danh mục" remove="Bỏ theo dõi danh mục" /> : <Link href={href('/login', { returnTo: href('/', { ...query, categoryId: category }) })}>Đăng nhập để theo dõi</Link>}
    </div>}
  </details>;
}

export function Sort({ query }: { query: SearchParams }) {
  const router = useRouter();
  return <select aria-label="Sắp xếp" value={getParam(query, 'sort') || 'NEWEST'} onChange={(event) => router.push(href('/', { ...query, sort: event.target.value, page: '' }))}>
    <option value="NEWEST">Mới nhất</option><option value="PRICE_ASC">Giá thấp đến cao</option><option value="PRICE_DESC">Giá cao đến thấp</option>
  </select>;
}
