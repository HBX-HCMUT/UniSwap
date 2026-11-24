import Link from 'next/link';
import { Suspense } from 'react';
import { Empty, ListingGrid, Notice, Pagination } from '../components/ui';
import { Filters, SearchBox, Sort } from '../features/market';
import { ApiError, connectionError } from '../lib/api';
import type { Category, Listing, Page, Saved, School } from '../lib/model';
import { getParam, href, type SearchParams } from '../lib/query';
import { serverGet, sessionUser } from '../lib/server';

const filterKeys = ['q', 'categoryId', 'schoolId', 'sellerId', 'area', 'condition', 'minPrice', 'maxPrice', 'sort', 'page'];

async function MarketResults({ query }: { query: SearchParams }) {
  const path = href('/listings', query);
  const user = await sessionUser();
  let data: Page<Listing> | undefined;
  let error = '';
  let schools: School[] = [];
  let categories: Category[] = [];
  let followed: string[] | undefined;
  const results = await Promise.allSettled([
    serverGet<Page<Listing>>(path),
    serverGet<School[]>('/schools'),
    serverGet<Category[]>('/categories'),
    user?.role === 'STUDENT' ? serverGet<Saved>('/me/saved') : Promise.resolve(undefined),
  ]);
  const [listings, schoolList, categoryList, saved] = results;
  if (listings.status === 'fulfilled') data = listings.value;
  else error = listings.reason instanceof ApiError ? listings.reason.message : connectionError;
  if (schoolList.status === 'fulfilled') schools = schoolList.value;
  if (categoryList.status === 'fulfilled') categories = categoryList.value;
  if (saved.status === 'fulfilled') followed = saved.value?.categories.map((item) => item.id);
  return <div className="market">
    <Filters key={path} query={query} schools={schools} categories={categories} followed={followed} />
    <section aria-labelledby="results">
      <header className="results-header"><div><h2 id="results">{getParam(query, 'q') ? 'Kết quả tìm kiếm' : 'Tin mới trên chợ'}</h2>{data && <p>{data.total} tin đăng</p>}</div><Sort query={query} /></header>
      {error && <div className="panel stack"><Notice text={error} error /><div><a className="button secondary" href={href('/', query)}>Thử lại</a> <Link href="/">Xóa bộ lọc</Link></div></div>}
      {data && (data.items.length ? <><ListingGrid listings={data.items} /><Pagination data={data} to="/" params={query} /></> : <Empty title="Không tìm thấy món phù hợp"><p>Thử một từ khóa khác hoặc thay đổi bộ lọc.</p><Link className="button secondary" href="/">Xóa bộ lọc</Link>{data.page > 1 && <Pagination data={data} to="/" params={query} />}</Empty>)}
    </section>
  </div>;
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = Object.fromEntries(filterKeys.map((key) => [key, getParam(params, key)]));
  return <>
    <section className="hero"><h1>Chợ đồ cũ sinh viên</h1><p>Tìm giáo trình, đồ ký túc xá và đồ dùng học tập từ sinh viên quanh trường.</p><SearchBox key={href('/', query)} query={query} /></section>
    <Suspense key={href('/', query)} fallback={<div className="panel loading detail-body" role="status"><span className="spinner" />Đang tải tin…</div>}><MarketResults query={query} /></Suspense>
  </>;
}
