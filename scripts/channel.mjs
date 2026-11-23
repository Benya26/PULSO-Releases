import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename,join} from 'node:path';

const tag=process.env.RELEASE_TAG;
if(!/^v\d+\.\d+\.\d+$/.test(tag||''))throw Error('Etiqueta inválida: se espera v0.57.1');
const version=tag.slice(1);
const folder='release-assets';
const names=(await readdir(folder)).sort();
const pick=(predicate,description)=>{
 const found=names.filter(predicate);
 if(found.length!==1)throw Error('Se necesita exactamente un '+description+'; encontrados '+found.length);
 return found[0];
};
const exe=pick(n=>n.endsWith('-setup.exe'),'.exe de Windows');
const sigName=pick(n=>n===exe+'.sig','archivo .exe.sig de Windows');
const universal=pick(n=>n.endsWith('.apk')&&/universal/i.test(n),'APK universal ARMv7/ARM64');
for(const n of [exe,sigName,universal]){
 const size=(await stat(join(folder,n))).size;
 if(size<(n.endsWith('.sig')?50:100_000))throw Error('Archivo incompleto: '+n);
}
const sig=(await readFile(join(folder,sigName),'utf8')).trim();
if(sig.length<60||/\s/.test(sig))throw Error('Firma Windows inválida');
const sha256=path=>new Promise((resolve,reject)=>{
 const hash=createHash('sha256');
 createReadStream(path).on('data',x=>hash.update(x)).on('error',reject).on('end',()=>resolve(hash.digest('hex')));
});
const base='https://github.com/Benya26/PULSO-Releases/releases/download/'+tag+'/';
const url=name=>base+encodeURIComponent(basename(name));
const latest={
 version,
 notes:'Nueva versión de PULSO disponible.',
 platforms:{'windows-x86_64':{url:url(exe),signature:sig}}
};
const android={
 version,
 package:'cl.maniatic.pulso',
 notes:'Nueva versión de PULSO disponible.',
 apks:{
  universal:{url:url(universal),sha256:await sha256(join(folder,universal))}
 }

};
try{
 const before=JSON.parse(await readFile('latest.json','utf8')).version;
 const a=before.split('.').map(Number), b=version.split('.').map(Number);
 if(a.length!==3||a.some(n=>!Number.isSafeInteger(n)))throw Error('Canal existente inválido');
 for(let i=0;i<3;i++){
   if(b[i]<a[i])throw Error('No se permite publicar una versión anterior: '+before);
   if(b[i]>a[i])break;
 }
}catch(e){if(e?.code!=='ENOENT')throw e}
await writeFile('latest.json',JSON.stringify(latest,null,2)+'\n');
await writeFile('android.json',JSON.stringify(android,null,2)+'\n');
console.log('Canal '+tag+' verificado. No se mostraron claves ni firmas.');
