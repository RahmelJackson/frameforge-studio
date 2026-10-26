import {createHash} from 'node:crypto';

// Review applies only to these exact, bundled local graphs. Arbitrary imports
// still go through the normal node/model policy, including in strict mode.
const reviewed={
 'ltx-vfx:default':'3d3350458ac34bdc6f82a20ab3b4ae3525d13c375e5f9dabb41d82ac82d99ff3',
 'flux3-video:local':'3941baa6a4007164972d9867cf26ff98d723751db98e722eb99ebcbe63c0fd94',
 'minimax-h3:local':'a0c40e6256a16f591380980e9f785b806a1327ce200cf8228947632d391c6e6b'
};
export function assertOpenProvider(packet){
 const hash=createHash('sha256').update(JSON.stringify(packet.graph)).digest('hex');
 if(packet.execution!=='local'||reviewed[packet.id+':'+packet.variant]!==hash)
  throw Object.assign(Error('This exact graph has not been reviewed for the open-weights profile.'),{statusCode:403});
 return true;
}
