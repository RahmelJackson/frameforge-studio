// Small, contextual connections. This does not create another primary navigation destination.
const root=document.querySelector('main'),page=document.body.dataset.page;
if(root&&['images','create','video-tools','short-film','recipes','workflows','library'].includes(page)){
 const nav=document.createElement('nav');nav.className='creator-context-links';nav.setAttribute('aria-label','Connected production tools');
 const image=page==='images',library=['recipes','workflows','library'].includes(page);
 const links=image?[['Creative canvas','/creator?tab=canvas'],['Your cast & training prep','/creator?tab=characters']]:library?[['Creative canvas','/creator?tab=canvas'],['Story formats','/creator?tab=stories'],['Effects & loops','/creator?tab=effects']]:[['Story formats','/creator?tab=stories'],['Effects & transitions','/creator?tab=effects'],['Looping GIF','/creator?tab=effects&recipe=loop']];
 for(const [title,url]of links){const a=document.createElement('a');a.href=url;a.textContent=title+' →';nav.append(a);}const opening=root.querySelector('.workspace-overview');if(opening)opening.after(nav);else root.prepend(nav);
}
