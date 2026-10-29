// Links use normal navigation so browser history, keyboard use and the embedded
// ComfyUI workspace retain the same behavior as the rest of Studio.
import {advancedSection} from './advanced-workspaces.js';
document.title='Frameforge | Advanced | '+advancedSection(new URLSearchParams(location.search).get('section')).label;
