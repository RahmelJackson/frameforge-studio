// Small, contextual connections. This does not create another primary navigation destination.
const root=document.querySelector('main'),page=document.body.dataset.page;
// Only the one destination that has no tab of its own: finishing effects, transitions and loops.
if(root&&['create','video-tools'].includes(page)){
 const nav=document.createElement('nav');nav.className='creator-context-links';nav.setAttribute('aria-label','Connected production tools');
 const image=page==='images',library=['recipes','workflows','library'].includes(page);
 const links=[['Effects, transitions & looping GIFs','/creator?tab=effects']];void image;void library;
 for(const [title,url]of links){const a=document.createElement('a');a.href=url;a.textContent=title+' →';nav.append(a);}const opening=root.querySelector('.workspace-overview');if(opening)opening.after(nav);else root.prepend(nav);
}
