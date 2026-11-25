import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import campusLamp from '../../../backend/demo-media/lamp.webp';
import { Empty, ListingGrid, Notice, Pagination } from '../components/ui';
import { Filters, SearchBox, Sort } from '../features/market';
import { ApiError, connectionError } from '../lib/api';
import { money } from '../lib/format';
import { conditionNames, type Category, type Listing, type Page, type Saved, type School } from '../lib/model';
import { clearMarketFilters, getParam, href, marketFilterKeys, type SearchParams } from '../lib/query';
import { serverGet, sessionUser } from '../lib/server';

const searchKeys = ['q', ...marketFilterKeys, 'sort', 'page'];

function AppliedFilters({ query, categories, schools }: { query: SearchParams; categories: Category[]; schools: School[] }) {
  const get = (key: string) => getParam(query, key);
  const price = (raw: string) => /^\d+$/.test(raw) ? money(Number(raw)) : raw;
  const condition = Object.entries(conditionNames).find(([key]) => key === get('condition'))?.[1];
  const filters = [
    ['categoryId', categories.find(({ id }) => id === get('categoryId'))?.name ?? 'Danh mục'],
    ['schoolId', schools.find(({ id }) => id === get('schoolId'))?.name ?? 'Trường'],
    ['sellerId', 'Người bán'],
    ['area', get('area')],
    ['condition', condition ?? 'Tình trạng'],
    ['minPrice', `Từ ${price(get('minPrice'))}`],
    ['maxPrice', `Đến ${price(get('maxPrice'))}`],
  ].filter(([key]) => get(key));

  if (!filters.length) return null;
  return <ul className="applied-filters" aria-label="Bộ lọc đang áp dụng">
    {filters.map(([key, label]) => <li key={key}>
      <Link href={href('/', { ...query, [key]: '', page: '' })} aria-label={`Bỏ bộ lọc ${label}`}>
        {label} <span aria-hidden="true">×</span>
      </Link>
    </li>)}
  </ul>;
}

async function MarketResults({ query }: { query: SearchParams }) {
  const path = href('/listings', query);
  const marketUrl = href('/', query);
  const keyword = getParam(query, 'q');
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
      {categories.length > 0 && <nav className="market-categories" aria-label="Lọc nhanh theo danh mục">
        <Link href={href('/', { ...query, categoryId: '', page: '' })} aria-current={!getParam(query, 'categoryId') ? 'true' : undefined}>Tất cả</Link>
        {categories.map((category) => <Link key={category.id}
          href={href('/', { ...query, categoryId: category.id, page: '' })}
          aria-current={getParam(query, 'categoryId') === category.id ? 'true' : undefined}>{category.name}</Link>)}
      </nav>}
      <header className="results-header">
        <div>
          <h2 id="results">{keyword ? 'Kết quả tìm kiếm' : 'Tin mới trên chợ'}</h2>
          {data && <p>{data.total} tin đăng{keyword && <> cho <strong>“{keyword}”</strong></>}</p>}
        </div>
        <Sort query={query} />
      </header>
      <AppliedFilters query={query} categories={categories} schools={schools} />
      {error && <div className="panel stack"><Notice text={error} error /><div><a className="button secondary" href={marketUrl}>Thử lại</a> <Link href="/">Về chợ</Link></div></div>}
      {data && (data.items.length ? <>
        <ListingGrid listings={data.items} returnTo={marketUrl === '/' ? undefined : marketUrl + '#results'} />
        <Pagination data={data} to="/" params={query} />
      </> : <Empty title="Không tìm thấy món phù hợp">
        <p>Thử một từ khóa khác hoặc thay đổi bộ lọc.</p>
        {marketFilterKeys.some((key) => getParam(query, key)) && <Link className="button secondary" href={clearMarketFilters(query)}>{keyword ? 'Bỏ bộ lọc, giữ từ khóa' : 'Bỏ bộ lọc'}</Link>}
        <Link className="button secondary" href="/">Xem tất cả tin</Link>
        {data.page > 1 && <Pagination data={data} to="/" params={query} />}
      </Empty>)}
    </section>
  </div>;
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = Object.fromEntries(searchKeys.map((key) => [key, getParam(params, key)]));
  const marketUrl = href('/', query);
  const isBrowsing = marketUrl === '/';
  return <>
    <section className={isBrowsing ? 'hero' : 'hero hero-compact'}>
      <div className="hero-copy">
        <h1>Chợ đồ cũ sinh viên</h1>
        {isBrowsing && <p>Tìm giáo trình, đồ ký túc xá và đồ dùng học tập từ sinh viên quanh trường.</p>}
        <SearchBox key={marketUrl} query={query} />
      </div>
      {isBrowsing && <div className="hero-photo">
        <Image src={campusLamp} alt="" loading="eager" sizes="(max-width: 720px) 94vw, 40vw" />
      </div>}
    </section>
    <Suspense key={marketUrl} fallback={<div className="panel loading detail-body" role="status"><span className="spinner" />Đang tải tin…</div>}><MarketResults query={query} /></Suspense>
  </>;
}
