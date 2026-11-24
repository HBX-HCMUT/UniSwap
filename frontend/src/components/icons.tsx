import type { SVGProps } from 'react';

const paths = {
  swap: 'M3 8h17m-4-4 4 4-4 4M21 16H4m4-4-4 4 4 4',
  shop: 'M3 10l2-6h14l2 6v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0v-2zm2 5v5h14v-5M3 10h18',
  plus: 'M12 5v14M5 12h14',
  chat: 'M20 11a7 7 0 0 1-7 7H4l1.5-3A7 7 0 0 1 4 11a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  bell: 'M5 17v-1l2-2v-4a5 5 0 0 1 10 0v4l2 2v1zM10 21h4',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zm5-2L21 21',
  filter: 'M3 6h18M6 12h12m-9 6h6',
  pin: 'M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  heart: 'M20.8 8.6c0 4-8.8 10.4-8.8 10.4S3.2 12.6 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  image: 'M3 4h18v16H3zM3 17l6-6 4 4 2-2 6 6M16 8h.01',
  calendar: 'M3 6h18v15H3zm5-3v6m8-6v6M3 11h18',
  check: 'm5 12 4 4L19 6',
} as const;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
