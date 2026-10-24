/**
 * @react-three/fiber still instantiates THREE.Clock (deprecated in three r183+).
 * Replace with a Timer-backed shim until upstream updates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/@react-three/fiber/dist');
const shim =
  '(()=>{const t=new THREE.Timer();return{autoStart:true,startTime:0,oldTime:0,elapsedTime:0,running:false,start(){this.running=true;t.reset()},stop(){this.running=false},getDelta(){return t.getDelta()},getElapsedTime(){return t.getElapsed()}}})()';
const shimNs =
  '(()=>{const t=new THREE__namespace.Timer();return{autoStart:true,startTime:0,oldTime:0,elapsedTime:0,running:false,start(){this.running=true;t.reset()},stop(){this.running=false},getDelta(){return t.getDelta()},getElapsedTime(){return t.getElapsed()}}})()';

for (const file of fs.readdirSync(dist)) {
  if (!file.endsWith('.js')) continue;
  const p = path.join(dist, file);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('.Clock()')) continue;
  s = s.replace(/new THREE\.Clock\(\)/g, shim).replace(/new THREE__namespace\.Clock\(\)/g, shimNs);
  fs.writeFileSync(p, s);
  console.log('patched', file);
}
