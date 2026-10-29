// Original outline icons shared by Studio navigation and actions; bundled offline.
const paths={
 search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 lock:'M6 11h12v10H6V11zm3 0V7a3 3 0 0 1 6 0v4m-3 4v2',
 folder:'M3 6h6l2 2h10v12H3V6z',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-2-5h4l1 3 3 1 3 2v4l-3 2-1 3-3 3h-4l-2-3-3-1-2-3V9l3-2 3-1 1-3z',
 menu:'M4 6h16M4 12h16M4 18h16',close:'M6 6l12 12M18 6 6 18',
 home:'M3 10 12 3l9 7v10H3V10zm6 10v-7h6v7',
 library:'M4 4h16v16H4V4zm0 5h16M9 9v11',
 images:'M3 4h18v16H3V4zm0 12 6-6 4 4 3-3 5 5M16 8h.01',
 video:'M3 5h18v14H3V5zm6 3 7 4-7 4V8',
 audio:'M9 18V5l11-2v13M9 8l11-2M9 18c0 2-6 3-6 0s6-3 6 0zm11-2c0 2-6 3-6 0s6-3 6 0z',
 advanced:'M12 3 21 8v9l-9 5-9-5V8l9-5zm0 9 9-4M12 12 3 8m9 4v10',
 check:'m5 12 4 4L19 6',arrow:'M5 12h14m-6-6 6 6-6 6'
};
export function iconSVG(name,size=16){const path=paths[name];if(!path)throw Error('Unknown Studio icon.');if(!Number.isInteger(size)||size<12||size>32)size=16;return '<svg class="studio-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>';}
