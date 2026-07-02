(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.freeze({kind:`empty`});function t(e){return e.kind===`linked`?e.targetId:null}function n(e,t){switch(e.kind){case`linked`:return t.has(e.targetId)?`linked`:`broken`;case`unresolved`:return`unresolved`;case`taxon`:return`taxon`;case`taxonDraft`:return`taxon`;case`empty`:return`empty`}}var r={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`};function i(e){return e?e.replace(/[&<>"']/g,e=>r[e]):``}function a(e,t,n){let r=null,i=null;try{try{let t=new Blob([e],{type:n});r=URL.createObjectURL(t)}catch(t){console.warn(`Blob URL creation blocked by environment security constraints. Attempting standard Base64 encoding fallback.`,t);let i=new TextEncoder().encode(e),a=``,o=8192;for(let e=0;e<i.length;e+=o){let t=i.subarray(e,e+o);a+=String.fromCharCode(...t)}let s=btoa(a);r=`data:${n.toLowerCase().includes(`charset=`)?n:`${n};charset=utf-8`};base64,${s}`}i=document.createElement(`a`),i.href=r,i.download=t,i.style.display=`none`,i.style.pointerEvents=`none`,document.body.appendChild(i),i.click();let a=i,o=r;setTimeout(()=>{a&&document.body.contains(a)&&document.body.removeChild(a),o&&o.startsWith(`blob:`)&&URL.revokeObjectURL(o)},200)}catch(e){console.error(`An unhandled exception occurred during file synthesis/download processing:`,e),i&&document.body.contains(i)&&document.body.removeChild(i),r&&r.startsWith(`blob:`)&&URL.revokeObjectURL(r)}}var o=(()=>{let e=navigator.userAgentData;if(e?.platform)return e.platform.toLowerCase().includes(`mac`);let t=(navigator.platform||``).toLowerCase();if(t.includes(`mac`)||t.includes(`iphone`)||t.includes(`ipad`)||t.includes(`ipod`))return!0;let n=navigator.userAgent.toLowerCase();return n.includes(`macintosh`)||n.includes(`mac os x`)})();function s(e){if(!e||typeof e!=`object`)return!1;let t=e;switch(t.kind){case`linked`:return typeof t.targetId==`number`;case`unresolved`:return typeof t.couplet==`number`;case`taxon`:return typeof t.taxonId==`number`||typeof t.name==`string`;case`taxonDraft`:return typeof t.name==`string`;case`empty`:return!0;default:return!1}}function c(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.alt1==`string`&&typeof e.alt2==`string`&&s(e.branch1)&&s(e.branch2))||t.has(e.id)?!1:(t.add(e.id),!0))}function l(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.filename==`string`&&typeof e.caption==`string`)||t.has(e.id)?!1:(t.add(e.id),!0))}function u(e){let t=new Map;return e.forEach((e,n)=>t.set(e.id,n)),t}function d(e){let t=new Map;return e.forEach((e,n)=>{t.set(e.id,n+1)}),t}var f=`scientific`;function p(e){return e===`scientific`||e===`vernacular`}function m(e,t){let n=new Map;return e.forEach(e=>n.set(e.id,e)),{byId:n,nameMode:t}}function h(e,t){return t===`vernacular`&&e.vernacularName.trim()!==``?e.vernacularName:e.scientificName}function g(e,t,n){switch(e.kind){case`linked`:{let n=t.get(e.targetId);if(n!==void 0){let e=(n+1).toString();return{inputValue:e,printText:e,printClass:`print-dest-strong`,isUnresolved:!1}}return{inputValue:`?`,printText:`?`,printClass:`error-text`,isUnresolved:!0}}case`unresolved`:{let t=e.couplet.toString();return{inputValue:t,printText:t,printClass:`error-text`,isUnresolved:!0}}case`taxon`:{let t=n?.byId.get(e.taxonId);return t?{inputValue:t.scientificName,printText:h(t,n.nameMode),printClass:`print-dest-taxon`,isUnresolved:!1}:{inputValue:``,printText:`[missing taxon]`,printClass:`error-text`,isUnresolved:!0}}case`taxonDraft`:return{inputValue:e.name,printText:e.name,printClass:`print-dest-taxon-unlinked`,isUnresolved:!1,isUnlinkedTaxon:!0};case`empty`:return{inputValue:``,printText:`...`,printClass:``,isUnresolved:!1}}}var _=`classic`;function v(e){return e===`classic`||e===`lettered`||e===`minimal`}function y(e){let n=new Map;e.forEach((e,r)=>{let i=r+1;for(let r of[e.branch1,e.branch2]){let e=t(r);if(e===null)continue;let a=n.get(e);a||n.set(e,a=new Set),a.add(i)}});let r=new Map;for(let[e,t]of n)r.set(e,[...t].sort((e,t)=>e-t));return r}function b(e,t,n){let r;switch(e){case`lettered`:r={lead1:`${t}a`,lead2:`${t}b`};break;case`minimal`:r={lead1:`${t}`,lead2:`-`};break;default:r={lead1:`${t}.`,lead2:`—`};break}return n&&n.length>0&&(r.lead1+=` (${n.join(`, `)})`),r}function x(e,t){let n=e.trim();if(n===``)return{kind:`empty`};if(/^\d+$/.test(n)){let e=parseInt(n,10),r=e-1;return r>=0&&r<t.length?{kind:`linked`,targetId:t[r].id}:{kind:`unresolved`,couplet:e}}return{kind:`taxonDraft`,name:n}}function S(e,t=`.tskey`){return`${e.toLowerCase().trim().replace(/[^a-z0-9_\-]/gi,`_`).replace(/_+/g,`_`).replace(/_$/,``)||`untitled_key`}${t}`}function C(e){return typeof e==`object`&&!!e}var w=()=>/\[figID:\s*(\d+)\s*\]/gi,T=()=>/\[fig:\s*([^\]]+?)\s*\]/gi;function E(e){let t=new Map,n=new Map,r=new Map,i=new Map;return e.forEach((e,a)=>{let o=a+1;t.set(e.id,o),n.set(o,e),i.set(e.id,e);let s=e.filename.trim().toLowerCase();s&&r.set(s,e)}),{idToDisplayNum:t,displayNumToFig:n,filenameToFig:r,idToFig:i}}function D(e,t){return new Promise((n,r)=>{e.oncomplete=()=>n(),e.onerror=()=>r(e.error),e.onabort=()=>r(Error(t))})}function O(e){return new Promise((t,n)=>{e.onsuccess=()=>t(e.result),e.onerror=()=>n(e.error)})}var k=class{dbName=`TSKey_Workspace_DB`;projectsStoreName=`projects`;figuresStoreName=`figures`;dbPromise=null;getDB(){return this.dbPromise?this.dbPromise:(this.dbPromise=new Promise((e,t)=>{let n=indexedDB.open(this.dbName,2);n.onupgradeneeded=()=>{let e=n.result;e.objectStoreNames.contains(this.projectsStoreName)||e.createObjectStore(this.projectsStoreName,{keyPath:`title`}),e.objectStoreNames.contains(this.figuresStoreName)||e.createObjectStore(this.figuresStoreName)},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error),n.onblocked=()=>{alert(`⚠️ TSKey could not open its database because another tab still has an older version open. Please close other TSKey tabs and reload.`),t(Error(`IndexedDB open blocked by another open connection.`))}}),this.dbPromise.catch(()=>{this.dbPromise=null}),this.dbPromise)}getFigureKey(e,t){return`${e}::${t}`}parseFigureId(e){return parseInt(e.substring(e.lastIndexOf(`::`)+2),10)}getProjectKeyRange(e){let t=`${e}::`,n=t.substring(0,t.length-1)+String.fromCharCode(t.charCodeAt(t.length-1)+1);return IDBKeyRange.bound(t,n,!1,!0)}async getProjectList(){return(await O((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).getAll())).map(e=>({name:e.title,lastModified:e.lastModified})).sort((e,t)=>t.lastModified-e.lastModified)}async saveProject(e,t,n){let r=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`),i={title:e,projectUid:t,schemaVersion:2,dichotomousKey:n.dichotomousKey,figures:n.figures,taxa:n.taxa,lastModified:Date.now()};return r.objectStore(this.projectsStoreName).put(i),D(r,`Transaction aborted while saving project: ${e}`)}async loadProject(e){let t=await O((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).get(e));return t?(t.dichotomousKey=t.dichotomousKey||[],t.figures=t.figures||[],t.taxa=t.taxa||[],t):null}async deleteProject(e,t){let n=(await this.getDB()).transaction([this.projectsStoreName,this.figuresStoreName],`readwrite`);n.objectStore(this.projectsStoreName).delete(e);let r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(t));return r.onsuccess=e=>{let t=e.target.result;t&&(t.delete(),t.continue())},D(n,`Project deletion aborted for: ${e}`)}async deleteProjectRecordOnly(e){let t=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`);return t.objectStore(this.projectsStoreName).delete(e),D(t,`Project record deletion aborted for: ${e}`)}async saveFigure(e,t,n){let r=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return r.objectStore(this.figuresStoreName).put(n,this.getFigureKey(e,t)),D(r,`Transaction aborted while saving figure ID ${t}`)}async deleteFigure(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return n.objectStore(this.figuresStoreName).delete(this.getFigureKey(e,t)),D(n,`Transaction aborted while deleting figure ID ${t}`)}async cleanupOrphanFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(e));return r.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key);t.has(e)||n.delete(),n.continue()}},D(n,`Orphan cleanup transaction aborted for project: ${e}`)}async getFigure(e,t){return await O((await this.getDB()).transaction(this.figuresStoreName,`readonly`).objectStore(this.figuresStoreName).get(this.getFigureKey(e,t)))||null}async cloneProjectFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName),i=r.openCursor(this.getProjectKeyRange(e));return i.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key),i=n.value;r.put(i,this.getFigureKey(t,e)),n.continue()}},D(n,`Cloning figures transaction aborted from "${e}" to "${t}"`)}},A=new class{storage=new k;pendingUploads=new Map;pendingDeletes=new Set;commitPromise=null;async getProjectList(){return this.storage.getProjectList()}async saveProject(e,t,n){await this.storage.saveProject(e,t,n),await this.commitStagedChanges(t,n.figures)}async loadProject(e){this.resetActiveImageCache();let t=await this.storage.loadProject(e);return t?.projectUid&&await this.storage.cleanupOrphanFigures(t.projectUid,new Set(t.figures.map(e=>e.id))),t}async deleteProject(e){let t=await this.storage.loadProject(e);if(t)return this.storage.deleteProject(e,t.projectUid)}async deleteProjectRecord(e){return this.storage.deleteProjectRecordOnly(e)}async cloneProjectFigures(e,t){return this.storage.cloneProjectFigures(e,t)}clearStagedChanges(){this.pendingUploads.clear(),this.pendingDeletes.clear()}getStagingSnapshot(){return{uploads:new Map(this.pendingUploads),deletes:new Set(this.pendingDeletes)}}restoreStagingSnapshot(e){let t=new Set([...this.pendingUploads.keys(),...this.pendingDeletes,...e.uploads.keys(),...e.deletes]);for(let n of t){let t=this.pendingUploads.get(n)===e.uploads.get(n),r=this.pendingDeletes.has(n)===e.deletes.has(n);if(t&&r)continue;let i=j.get(n);i&&(URL.revokeObjectURL(i),j.delete(n))}this.pendingUploads=new Map(e.uploads),this.pendingDeletes=new Set(e.deletes)}resetActiveImageCache(){te(),this.clearStagedChanges()}deleteFigureBinary(e){this.pendingUploads.delete(e),this.pendingDeletes.add(e)}uploadFigureBinary(e,t){this.pendingDeletes.delete(e),this.pendingUploads.set(e,t)}async getFigureBinary(e,t){return this.pendingUploads.has(t)?this.pendingUploads.get(t):this.pendingDeletes.has(t)?null:this.storage.getFigure(e,t)}async commitStagedChanges(e,t){let n=this.commitPromise??Promise.resolve(),r=new Map(this.pendingUploads),i=new Set(this.pendingDeletes),a=(async()=>{await n.catch(()=>{});try{let n=new Set(t.map(e=>e.id));for(let[t,i]of r)n.has(t)&&await this.storage.saveFigure(e,t,i);for(let t of i)await this.storage.deleteFigure(e,t);await this.storage.cleanupOrphanFigures(e,n);for(let[e,t]of r)this.pendingUploads.get(e)===t&&this.pendingUploads.delete(e);for(let e of i)this.pendingDeletes.delete(e)}catch(e){throw e instanceof Error&&e.name===`QuotaExceededError`&&alert(`⚠️ Browser storage is full! Could not save the latest images. Please delete old workspaces to free up space.`),e}})().finally(()=>{this.commitPromise===a&&(this.commitPromise=null)});return this.commitPromise=a,a}},j=new Map;function ee(e){return new Promise((t,n)=>{let r=new FileReader;r.onloadend=()=>t(r.result),r.onerror=n,r.readAsDataURL(e)})}function te(){for(let e of j.values())URL.revokeObjectURL(e);j.clear()}function M(e){return e.reduce((e,t)=>{let n=Number(t?.id);return isNaN(n)?e:Math.max(e,n)},0)+1}function ne(e,t,n){let r=e.findIndex(e=>e.id===t);if(r===-1)return null;let i={...e[r],...n},a=[...e];return a[r]=i,a}function re(e,t){return e.filter(e=>!t.has(e.id))}function ie(e,t,n){let r=[...e],[i]=r.splice(t,1);return r.splice(n,0,i),r}function ae(t){let n=M(t),r=t.length+1,i=-1,a=null;for(let e=t.length-1;e>=0;e--){let n=t[e];if(n.branch1.kind===`empty`){i=e,a=`branch1`;break}else if(n.branch2.kind===`empty`){i=e,a=`branch2`;break}}let o={kind:`linked`,targetId:n},s=e=>e.kind===`unresolved`&&e.couplet===r?o:e;return{key:[...t.map((e,t)=>{let n={...e};return n.branch1=s(n.branch1),n.branch2=s(n.branch2),t===i&&a&&(n[a]=o),n}),{id:n,alt1:``,alt2:``,branch1:e,branch2:e}],newId:n}}function oe(e,t,n,r,i,a){let o=e.length;if(n!==void 0){let t=e.findIndex(e=>e.id===n);t!==-1&&(o=r===`above`?t:t+1)}let s=e.reduce((e,t)=>Math.max(e,t.id),0),c=new Map;t.forEach((e,t)=>{c.set(e.id,s+t+1)});let l=e=>e.kind===`linked`&&c.has(e.targetId)?{kind:`linked`,targetId:c.get(e.targetId)}:e,u=t.map(e=>({...e,id:c.get(e.id),branch1:l(e.branch1),branch2:l(e.branch2)})),d=[...e];return d.splice(o,0,...u),i&&a.length>0&&(d=d.map(e=>{let t=a.filter(t=>t.sourceId===e.id);if(t.length===0)return e;let n={...e};return t.forEach(e=>{let t=c.get(e.targetOldId);t!==void 0&&(n[e.field]={kind:`linked`,targetId:t})}),n})),{key:d,newIds:u.map(e=>e.id)}}function se(n,r){let i=[];return{key:n.filter(e=>!r.has(e.id)).map(n=>{let a={...n},o=t(n.branch1);o!==null&&r.has(o)&&(i.push({sourceId:n.id,field:`branch1`,targetOldId:o}),a.branch1=e);let s=t(n.branch2);return s!==null&&r.has(s)&&(i.push({sourceId:n.id,field:`branch2`,targetOldId:s}),a.branch2=e),a}),severedLinks:i}}function ce(n,r){let i=n=>{let i=t(n);return i!==null&&r.has(i)?e:n};return n.filter(e=>!r.has(e.id)).map(e=>({...e,branch1:i(e.branch1),branch2:i(e.branch2)}))}function le(e,t){let n=!1;return{key:e.map(e=>t.has(e.id)?(n=!0,{...e,alt1:e.alt2,alt2:e.alt1,branch1:e.branch2,branch2:e.branch1}):e),modified:n}}function ue(e,t,n,r){if(t===n)return null;let i=[...e],a=i.findIndex(e=>e.id===t),o=i.findIndex(e=>e.id===n);if(a===-1||o===-1)return console.warn(`Aborted reordering: srcIdx (${a}) or targetIdx (${o}) was invalid.`),null;let[s]=i.splice(a,1),c=o;return r===`above`&&a<o?c--:r===`below`&&a>o&&c++,i.splice(c,0,s),i}function de(e){let r=new Map(e.map(e=>[e.id,e])),i=e=>{let n=t(e);return n!==null&&r.has(n)?n:null},a={taxon:1,linked:2,unresolved:2,broken:3,empty:3},o=new Map,s=new Set,c=e=>{switch(n(e,r)){case`taxon`:return 0;case`linked`:return l(e.targetId);case`unresolved`:return e.couplet||0;default:return 1e4}},l=e=>{if(!r.has(e))return 0;if(o.has(e))return o.get(e);if(s.has(e))return 0;s.add(e);let t=r.get(e),n=c(t.branch1),i=c(t.branch2);s.delete(e);let a=1+Math.max(n,i);return o.set(e,a),a};e.forEach(e=>l(e.id));let u=e.map(e=>{let t=n(e.branch1,r),i=n(e.branch2,r),o=a[t],s=a[i],l=!1;if(o>s)l=!0;else if(o===s&&o===2){let n=c(e.branch1),r=c(e.branch2);(r<n||r===n&&t!==i&&i===`linked`)&&(l=!0)}return l?{...e,alt1:e.alt2,alt2:e.alt1,branch1:e.branch2,branch2:e.branch1}:{...e}}),d=new Map(u.map(e=>[e.id,e])),f=new Map;u.forEach(e=>{let t=i(e.branch1);t!==null&&f.set(t,(f.get(t)||0)+1);let n=i(e.branch2);n!==null&&f.set(n,(f.get(n)||0)+1)});let p=u.filter(e=>!f.has(e.id));p.length===0&&u.length>0&&p.push(u[0]);let m=new Set,h=[],g=e=>{let t=[e];for(;t.length>0;){let e=t.pop();if(e===0||m.has(e))continue;let n=d.get(e);if(!n)continue;m.add(e),h.push(n);let r=i(n.branch2);r!==null&&!m.has(r)&&t.push(r);let a=i(n.branch1);a!==null&&!m.has(a)&&t.push(a)}};return p.forEach(e=>g(e.id)),u.forEach(e=>{m.has(e.id)||g(e.id)}),h}function fe(e,t){let{idToFig:n,displayNumToFig:r,filenameToFig:i}=E(e),a=[],o=new Set;for(let e of t){let t=[e.alt1,e.alt2];for(let e of t){if(!e)continue;let t,s=w();for(;(t=s.exec(e))!==null;){let e=parseInt(t[1].trim(),10),r=n.get(e);r&&!o.has(r.id)&&(o.add(r.id),a.push(r))}let c=T();for(;(t=c.exec(e))!==null;){let e=t[1].trim(),n,s=parseInt(e,10);if(!isNaN(s)&&String(s)===e&&r.has(s))n=r.get(s);else{let t=e.toLowerCase();i.has(t)&&(n=i.get(t))}n&&!o.has(n.id)&&(o.add(n.id),a.push(n))}}}for(let t of e)o.has(t.id)||a.push(t);return a}function pe(e,t,n){if(!e)return e;let r=t.length,{filenameToFig:i}=E(t);return e=e.replace(w(),(e,t)=>{let r=parseInt(t.trim(),10),i=n.get(r);return i===void 0?`[Broken Fig: ID ${r}]`:`(Fig. ${i})`}),e=e.replace(T(),(e,t)=>{let a=t.trim(),o=parseInt(a,10);if(!isNaN(o)&&String(o)===a&&o>=1&&o<=r)return`(Fig. ${o})`;let s=i.get(a.toLowerCase());if(s){let e=n.get(s.id);if(e!==void 0)return`(Fig. ${e})`}return`[Broken Fig: ${a}]`}),e}function me(e,t){if(!e)return``;let{displayNumToFig:n,filenameToFig:r}=E(t);return e.replace(T(),(e,t)=>{let i=t.trim(),a=parseInt(i,10);if(!isNaN(a)&&String(a)===i&&n.has(a))return`[figID: ${n.get(a).id}]`;let o=r.get(i.toLowerCase());return o?`[figID: ${o.id}]`:e})}function he(e,t){if(!e)return``;let{idToDisplayNum:n}=E(t);return e.replace(w(),(e,t)=>{let r=parseInt(t.trim(),10),i=n.get(r);return i===void 0?e:`[fig: ${i}]`})}function N(e){return e.trim().toLowerCase()}function ge(e,t){let n=N(t);if(n!==``)return e.find(e=>N(e.scientificName)===n)}function _e(e,t=``){return{id:e,scientificName:t.trim(),auctor:``,vernacularName:``,synonyms:[],description:``,biology:``,distribution:``,confusables:[]}}function ve(e){let t=new Map;return e.forEach(e=>{let n=N(e.scientificName);n&&!t.has(n)&&t.set(n,e.id)}),t}function ye(e,t){return e.map(e=>{let n=t(e.branch1),r=t(e.branch2);return n===e.branch1&&r===e.branch2?e:{...e,branch1:n,branch2:r}})}function be(t,n,r){let i=ve(n),a=[...n],o=M(a),s=!1;return{key:ye(t,t=>{let n=r(t);if(n===null)return t;s=!0;let c=n.trim();if(c===``)return e;let l=N(c),u=i.get(l);if(u!==void 0)return{kind:`taxon`,taxonId:u};let d=o++;return a.push(_e(d,c)),i.set(l,d),{kind:`taxon`,taxonId:d}}),taxa:a,changed:s}}function xe(e,t){return be(e,t,e=>e.kind===`taxonDraft`?e.name:null)}function Se(e,t){let n=be(e,t,e=>{let t=e;return e.kind===`taxon`&&typeof t.taxonId!=`number`&&typeof t.name==`string`?t.name:null});return{key:n.key,taxa:n.taxa}}function Ce(e,t){let n=ve(t),r=!1;return{key:ye(e,e=>{if(e.kind!==`taxonDraft`)return e;let t=n.get(N(e.name));return t===void 0?e:(r=!0,{kind:`taxon`,taxonId:t})}),changed:r}}function we(t,n){return{key:ye(t,t=>t.kind===`taxon`&&n.has(t.taxonId)?e:t)}}var P=`TSKey`,Te=`0.0.2`;function F(){return crypto.randomUUID()}var Ee=[`dichotomousKey`,`figures`,`taxa`];function De(e,n){let r=new Set;if(e.length===0)return r;let i=n||new Map(e.map(e=>[e.id,e])),a=[e[0].id];for(;a.length>0;){let e=a.pop();if(!r.has(e)){r.add(e);let n=i.get(e);if(n){let e=t(n.branch2);e!==null&&a.push(e);let r=t(n.branch1);r!==null&&a.push(r)}}}return r}function Oe(e,n){let r={steps:[],reachable:!1};if(e.length===0)return r;let i=new Map(e.map(e=>[e.id,e])),a=new Map;if(e.forEach((e,t)=>a.set(e.id,t)),!i.has(n))return r;let o=e[0].id,s=new Map,c=new Set([o]),l=[o];for(;l.length>0;){let e=l.shift();if(e===n)break;let r=i.get(e);if(!r)continue;let a=[[r.branch1,`a`],[r.branch2,`b`]];for(let[n,r]of a){let a=t(n);a!==null&&i.has(a)&&!c.has(a)&&(c.add(a),s.set(a,{parentId:e,choice:r}),l.push(a))}}if(!c.has(n))return r;let u=[],d=n,f;for(;d!==void 0;){u.push({id:d,choice:f});let e=s.get(d);f=e?.choice,d=e?.parentId}return u.reverse(),{steps:u.map(e=>({id:e.id,stepNum:(a.get(e.id)??0)+1,choice:e.choice})),reachable:!0}}function ke(e,n){let r=new Map;if(e.length===0)return r;let i=new Map,a=new Map,o=new Map,s=new Set(n.map(e=>e.id)),{displayNumToFig:c,filenameToFig:l}=E(n),u=e=>{let t=e.trim();if(t===``)return!1;let n=parseInt(t,10);return!isNaN(n)&&String(n)===t?c.has(n):l.has(t.toLowerCase())};e.forEach((e,n)=>{i.set(e.id,e),a.set(e.id,n);let r=t(e.branch1);if(r!==null){let t=o.get(r);t||o.set(r,t=new Set),t.add(e.id)}let s=t(e.branch2);if(s!==null){let t=o.get(s);t||o.set(s,t=new Set),t.add(e.id)}});let d=De(e,i),f=w(),p=T(),m=(e,t)=>{let n=[];if(!e)return n;let r=[];for(let t of e.matchAll(f)){let e=parseInt(t[1],10);!s.has(e)&&!r.includes(e)&&r.push(e)}r.forEach(e=>{n.push({severity:`warning`,message:`Choice ${t} references a missing or deleted figure (Internal ID: ${e}).`})});let i=[];for(let t of e.matchAll(p)){let e=t[1].trim();!u(e)&&!i.includes(e)&&i.push(e)}return i.forEach(e=>{n.push({severity:`warning`,message:`Choice ${t} references an unresolved figure reference '[fig: ${e}]'.`})}),n};return e.forEach((e,t)=>{let n=[];e.branch1.kind===`unresolved`?n.push({severity:`error`,message:`Choice A points to step '${e.branch1.couplet}' which does not exist yet.`}):e.branch1.kind===`empty`&&n.push({severity:`warning`,message:`Choice A is incomplete. Assign a Taxa or destination step.`}),e.branch2.kind===`unresolved`?n.push({severity:`error`,message:`Choice B points to step '${e.branch2.couplet}' which does not exist yet.`}):e.branch2.kind===`empty`&&n.push({severity:`warning`,message:`Choice B is incomplete. Assign a Taxa or destination step.`}),n.push(...m(e.alt1,`A`)),n.push(...m(e.alt2,`B`)),t>0&&!d.has(e.id)&&n.push({severity:`warning`,message:`Orphaned: This step is unreachable from Step #1.`}),t===0&&o.has(e.id)&&n.push({severity:`warning`,message:`Step #1 should be the key's starting point, but other steps link here.`}),e.branch1.kind===`linked`&&(e.branch1.targetId===e.id?n.push({severity:`error`,message:`Choice A loops directly into its own key step.`}):i.has(e.branch1.targetId)||n.push({severity:`error`,message:`Choice A points to an invalid or deleted step.`})),e.branch2.kind===`linked`&&(e.branch2.targetId===e.id?n.push({severity:`error`,message:`Choice B loops directly into its own key step.`}):i.has(e.branch2.targetId)||n.push({severity:`error`,message:`Choice B points to an invalid or deleted step.`}));let s=o.get(e.id);if(s&&s.size>1){let e=[];s.forEach(t=>{let n=a.get(t);n!==void 0&&n!==-1&&e.push(`#${n+1}`)}),n.push({severity:`warning`,message:`Convergence: Multiple steps (${e.join(`, `)}) link here.`})}n.length>0&&r.set(e.id,n)}),r}var Ae=class{state;hasUncommittedChanges=!1;editScope=null;persistedTitle=``;activeProjectUid=F();onProjectPersisted;undoStack=[];redoStack=[];maxHistoryLimit;savedDepth=0;selectedCoupletIds=new Set;_draggedId=null;activeCoupletId=null;clipboardBuffer=[];clipboardMode=`copy`;cutIncomingLinksBuffer=[];selectedFigureIds=new Set;selectedTaxonIds=new Set;constructor(e,t=[],n=`Untitled Key`,r=100,i=[]){this.state={title:n,dichotomousKey:e,figures:t,taxa:i},this.maxHistoryLimit=r,this.hasUncommittedChanges=!1,this.persistedTitle=n}getTitle(){return this.state.title}getPersistedTitle(){return this.persistedTitle}getActiveProjectUid(){return this.activeProjectUid}setTitle(e){let t=e.trim();this.state.title!==t&&(this.saveCheckpoint(),this.state.title=t||`Untitled Key`,this.hasUncommittedChanges=!0)}getKey(){return this.state.dichotomousKey}getFigures(){return this.state.figures||[]}getTaxa(){return this.state.taxa||[]}getSelectedCoupletIds(){return this.selectedCoupletIds}setActiveCouplet(e){this.activeCoupletId=e}getActiveCoupletId(){return this.activeCoupletId}clearActiveCouplet(){this.activeCoupletId=null}get draggedCoupletId(){return this._draggedId}startDraggingCouplet(e){this._draggedId=e}stopDraggingCouplet(){this._draggedId=null}markSaved(){this.savedDepth=this.undoStack.length,this.hasUncommittedChanges=!1,this.editScope=null}hasUnsavedChanges(){return this.undoStack.length!==this.savedDepth||this.hasUncommittedChanges}resetTrackingContext(){this.undoStack=[],this.redoStack=[],this.savedDepth=0,this.hasUncommittedChanges=!1,this.editScope=null,this.selectedCoupletIds.clear(),this.selectedFigureIds.clear(),this.selectedTaxonIds.clear(),this.activeCoupletId=null,this._draggedId=null}captureState(){let e={title:this.state.title};for(let t of Ee)e[t]=(this.state[t]||[]).map(e=>({...e}));return e}captureHistoryEntry(){return{state:this.captureState(),staging:A.getStagingSnapshot()}}saveCheckpoint(){this.savedDepth!==null&&this.savedDepth>this.undoStack.length&&(this.savedDepth=null),this.redoStack=[],this.undoStack.push(this.captureHistoryEntry()),this.undoStack.length>this.maxHistoryLimit&&(this.undoStack.shift(),this.savedDepth!==null&&(this.savedDepth=this.savedDepth>0?this.savedDepth-1:null)),this.hasUncommittedChanges=!1,this.editScope=null}discardCutBuffer(){this.clipboardMode===`cut`&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[])}undo(){if(this.undoStack.length===0)return!1;this.redoStack.push(this.captureHistoryEntry());let e=this.undoStack.pop();return this.state=e.state,A.restoreStagingSnapshot(e.staging),this.hasUncommittedChanges=!1,this.editScope=null,this.discardCutBuffer(),!0}redo(){if(this.redoStack.length===0)return!1;this.undoStack.push(this.captureHistoryEntry());let e=this.redoStack.pop();return this.state=e.state,A.restoreStagingSnapshot(e.staging),this.hasUncommittedChanges=!1,this.editScope=null,this.discardCutBuffer(),!0}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}copySelectedCouplets(){let e=this.getSelectedCoupletIds();e.size!==0&&(this.clipboardBuffer=this.state.dichotomousKey.filter(t=>e.has(t.id)).map(e=>({...e})),this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[])}hasClipboardData(){return this.clipboardBuffer.length>0}generateInboundLinksMap(){let e=new Map;return this.state.dichotomousKey.forEach((n,r)=>{let i=r+1,a=t(n.branch1);a!==null&&(e.has(a)||e.set(a,[]),e.get(a).push(`${i}a`));let o=t(n.branch2);o!==null&&(e.has(o)||e.set(o,[]),e.get(o).push(`${i}b`))}),e}endTypingSession(){this.hasUncommittedChanges&&(this.hasUncommittedChanges=!1,this.editScope=null)}updateCouplet(e,t){this.editScope!==`key`&&this.saveCheckpoint(),this.editScope=`key`;let n=ne(this.state.dichotomousKey,e,t);n&&(this.state.dichotomousKey=n,this.hasUncommittedChanges=!0)}addCouplet(){this.saveCheckpoint();let{key:e,newId:t}=ae(this.state.dichotomousKey);return this.state.dichotomousKey=e,this.hasUncommittedChanges=!0,t}pasteCouplets(e,t=`below`){if(this.clipboardBuffer.length===0)return!1;this.saveCheckpoint();let{key:n,newIds:r}=oe(this.state.dichotomousKey,this.clipboardBuffer,e,t,this.clipboardMode===`cut`,this.cutIncomingLinksBuffer);return this.clipboardMode===`cut`&&this.cutIncomingLinksBuffer.length>0&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[]),this.state.dichotomousKey=n,this.setSelectionBatch(r),this.hasUncommittedChanges=!0,!0}cutSelectedCouplets(){let e=this.getSelectedCoupletIds();if(e.size===0)return;this.saveCheckpoint(),this.activeCoupletId!==null&&e.has(this.activeCoupletId)&&(this.activeCoupletId=null),this.clipboardBuffer=this.state.dichotomousKey.filter(t=>e.has(t.id)).map(e=>({...e})),this.clipboardMode=`cut`;let{key:t,severedLinks:n}=se(this.state.dichotomousKey,e);this.state.dichotomousKey=t,this.cutIncomingLinksBuffer=n,this.selectedCoupletIds=new Set,this.hasUncommittedChanges=!0}deleteSelectedCouplets(){if(this.selectedCoupletIds.size===0)return;this.saveCheckpoint();let e=this.selectedCoupletIds;this.activeCoupletId!==null&&e.has(this.activeCoupletId)&&(this.activeCoupletId=null),this.state.dichotomousKey=ce(this.state.dichotomousKey,e),this.selectedCoupletIds=new Set,this.hasUncommittedChanges=!0}swapSelectedCouplets(){if(this.selectedCoupletIds.size===0)return!1;this.saveCheckpoint();let{key:e,modified:t}=le(this.state.dichotomousKey,this.selectedCoupletIds);return this.state.dichotomousKey=e,t?(this.hasUncommittedChanges=!0,!0):!1}reorderCouplets(e,t,n=`above`){let r=ue(this.state.dichotomousKey,e,t,n);return r===null?!1:(this.saveCheckpoint(),this.state.dichotomousKey=r,this.hasUncommittedChanges=!0,!0)}autoOrderCouplets(){this.state.dichotomousKey.length!==0&&(this.saveCheckpoint(),this.state.dichotomousKey=de(this.state.dichotomousKey),this.hasUncommittedChanges=!0)}getSelectedFigureIds(){return this.selectedFigureIds}toggleFigureSelection(e,t){t?this.selectedFigureIds.has(e)?this.selectedFigureIds.delete(e):this.selectedFigureIds.add(e):this.selectedFigureIds=new Set([e])}clearFigureSelection(){this.selectedFigureIds.clear()}deleteSelectedFigures(){this.selectedFigureIds.size!==0&&(this.saveCheckpoint(),this.state.figures=re(this.state.figures,this.selectedFigureIds),this.selectedFigureIds=new Set,this.hasUncommittedChanges=!0)}addFigure(e,t){this.saveCheckpoint();let n=this.state.figures||[],r=M(n);return this.state.figures=[...n,{id:r,filename:e,caption:t}],this.hasUncommittedChanges=!0,r}updateFigure(e,t){this.editScope!==`figures`&&this.saveCheckpoint(),this.editScope=`figures`;let n=ne(this.state.figures,e,t);n&&(this.state.figures=n,this.hasUncommittedChanges=!0)}reorderFigures(e,t){!this.state.figures||e===t||(this.saveCheckpoint(),this.state.figures=ie(this.state.figures,e,t),this.hasUncommittedChanges=!0)}autoOrderFigures(){let e=this.state.figures||[];e.length===0||this.state.dichotomousKey.length===0||(this.saveCheckpoint(),this.state.figures=fe(e,this.state.dichotomousKey),this.hasUncommittedChanges=!0)}getSelectedTaxonIds(){return this.selectedTaxonIds}toggleTaxonSelection(e,t){t?this.selectedTaxonIds.has(e)?this.selectedTaxonIds.delete(e):this.selectedTaxonIds.add(e):this.selectedTaxonIds=new Set([e])}clearTaxonSelection(){this.selectedTaxonIds.clear()}deleteSelectedTaxa(){if(this.selectedTaxonIds.size===0)return;this.saveCheckpoint();let e=this.selectedTaxonIds;this.state.taxa=re(this.state.taxa,e),this.state.dichotomousKey=we(this.state.dichotomousKey,e).key,this.selectedTaxonIds=new Set,this.hasUncommittedChanges=!0}addTaxon(e=``){this.saveCheckpoint();let t=this.state.taxa||[],n=M(t);return this.state.taxa=[...t,_e(n,e)],this.hasUncommittedChanges=!0,n}updateTaxon(e,t){this.editScope!==`taxa`&&this.saveCheckpoint(),this.editScope=`taxa`;let n=ne(this.state.taxa,e,t);if(n){if(this.state.taxa=n,`scientificName`in t){let e=Ce(this.state.dichotomousKey,this.state.taxa);e.changed&&(this.state.dichotomousKey=e.key)}this.hasUncommittedChanges=!0}}reorderTaxa(e,t){!this.state.taxa||e===t||(this.saveCheckpoint(),this.state.taxa=ie(this.state.taxa,e,t),this.hasUncommittedChanges=!0)}createTaxonForBranch(e,t){let n=this.state.dichotomousKey.find(t=>t.id===e);if(!n)return null;let r=n[t];if(r.kind!==`taxonDraft`)return null;this.saveCheckpoint();let i=ge(this.state.taxa,r.name),a;return i?a=i.id:(a=M(this.state.taxa),this.state.taxa=[...this.state.taxa,_e(a,r.name)]),this.state.dichotomousKey=ne(this.state.dichotomousKey,e,{[t]:{kind:`taxon`,taxonId:a}})??this.state.dichotomousKey,this.hasUncommittedChanges=!0,a}importJsonData(e){try{let t=null,n=[],r=[],i=`Untitled Key`;if(C(e)&&C(e.data)){let a=e.data;c(a.key)&&(t=a.key,l(a.figures)&&(n=a.figures),Array.isArray(a.taxa)&&(r=a.taxa)),typeof a.title==`string`?i=a.title:typeof e.title==`string`&&(i=e.title)}if(!t&&c(e)&&(t=e),!t)return{success:!1,errors:[`The uploaded file does not match the required schema structure.`]};let a=[];n.length>0&&(a=[...n],n=n.map(e=>{let{binaryData:t,...n}=e;return n}));let o=Se(t,r),s=xe(o.key,o.taxa);return this.saveCheckpoint(),this.state.title=i,this.activeProjectUid=F(),this.persistedTitle=i,this.state.dichotomousKey=s.key,this.state.figures=n,this.state.taxa=s.taxa,A.resetActiveImageCache(),this.clearSelection(),this.activeCoupletId=null,this.hasUncommittedChanges=!0,{success:!0,errors:[],importedFigures:a}}catch(e){return{success:!1,errors:[e instanceof Error?e.message:`Unknown engine exception during parsing the json file.`]}}}setProjectPersistedListener(e){this.onProjectPersisted=e}commitPersistedTitle(e){this.persistedTitle=e,this.onProjectPersisted?.(e)}async createNewProject(e){this.state.title=e,this.activeProjectUid=F(),this.commitPersistedTitle(e),this.state.dichotomousKey=[],this.state.figures=[],this.state.taxa=[],this.resetTrackingContext(),A.resetActiveImageCache(),await this.saveToStorage()}async loadProject(e){let t=await A.loadProject(e);if(t){this.state.title=t.title,this.activeProjectUid=t.projectUid||F(),this.commitPersistedTitle(t.title);let e=Se(t.dichotomousKey,t.taxa),n=Ce(e.key,e.taxa);return this.state.dichotomousKey=n.key,this.state.taxa=e.taxa,this.state.figures=t.figures,this.resetTrackingContext(),!0}return!1}getProjectData(){return{dichotomousKey:this.state.dichotomousKey,figures:this.state.figures,taxa:this.state.taxa}}async saveToStorage(){let e=this.persistedTitle&&this.persistedTitle!==this.state.title,t=this.persistedTitle;try{await A.saveProject(this.state.title,this.activeProjectUid,this.getProjectData()),e&&t&&await A.deleteProjectRecord(t),this.commitPersistedTitle(this.state.title),this.markSaved()}catch(n){throw console.error(`Failed to save or rename project workspace:`,n),e&&t&&(this.state.title=t,A.clearStagedChanges()),n}}async saveAsProject(e){let t=this.persistedTitle,n=this.activeProjectUid,r=F();try{await A.cloneProjectFigures(n,r),this.state.title=e,this.activeProjectUid=r,await A.saveProject(e,r,this.getProjectData()),this.commitPersistedTitle(e),this.markSaved()}catch(e){throw console.error(`Save As Operation Failed:`,e),this.state.title=t,this.activeProjectUid=n,e}}async loadFromStorage(e=[],t=[],n=`Untitled Key`,r=[]){let i=n,a=await this.loadProject(i);if(!a){let n=Se(e,r),a=xe(n.key,n.taxa);this.state={title:i,dichotomousKey:a.key,figures:t,taxa:a.taxa},this.persistedTitle=i,this.activeProjectUid=F(),A.resetActiveImageCache(),this.resetTrackingContext()}return a}toggleSelection(e,t){t?this.selectedCoupletIds.has(e)?this.selectedCoupletIds.delete(e):this.selectedCoupletIds.add(e):this.selectedCoupletIds=new Set([e])}clearSelection(){this.selectedCoupletIds.size!==0&&this.selectedCoupletIds.clear()}setSelectionBatch(e){this.selectedCoupletIds=new Set(e)}selectAll(){this.selectedCoupletIds=new Set(this.state.dichotomousKey.map(e=>e.id))}runDiagnostics(){return ke(this.state.dichotomousKey,this.state.figures)}resolveTextReferences(e,t){return pe(e,this.state.figures,t)}encodeFigureTokens(e){return me(e,this.state.figures)}decodeTextReferencesForEditor(e){return he(e,this.state.figures)}},je=`dichotomous_key_ui`,Me={isFiguresHidden:!1,isPrintHidden:!1,isImagesHidden:!1,isTaxaHidden:!1,activeProjectTitle:`Untitled Key`,leadFormat:_,showBackReference:!1,nameDisplayMode:f},Ne=class{active=!1;fieldKey=null;timeoutId=null;isActive(){return this.active}getFieldKey(){return this.fieldKey}start(e,t){(!this.active||this.fieldKey!==e)&&(this.clearTimer(),t(),this.active=!0,this.fieldKey=e)}extendTimeout(e,t){this.clearTimer(),this.timeoutId=window.setTimeout(()=>{this.timeoutId=null,this.active=!1,this.fieldKey=null,t()},e)}clearTimer(){this.timeoutId!==null&&(clearTimeout(this.timeoutId),this.timeoutId=null)}end(e,t){return!this.active&&this.fieldKey===null?!1:e===null||this.fieldKey===e?(this.active=!1,this.fieldKey=null,this.clearTimer(),t(),!0):!1}},Pe=class{couplets=new Ne;figures=new Ne;taxa=new Ne;clearAll(){this.couplets.clearTimer(),this.figures.clearTimer(),this.taxa.clearTimer()}},Fe=class{state;typing=new Pe;constructor(){this.state=this.loadFromStorage()}get isFiguresHidden(){return this.state.isFiguresHidden}get isImagesHidden(){return this.state.isImagesHidden}get isTaxaHidden(){return this.state.isTaxaHidden}get nameDisplayMode(){return this.state.nameDisplayMode}get isPrintHidden(){return this.state.isPrintHidden}get activeProjectTitle(){return this.state.activeProjectTitle||`Untitled Key`}get leadFormat(){return this.state.leadFormat}get showBackReference(){return this.state.showBackReference}setActiveProjectTitle(e){this.state={...this.state,activeProjectTitle:e.trim()},this.persist()}toggleFigures(){this.state={...this.state,isFiguresHidden:!this.state.isFiguresHidden},this.persist()}togglePrint(){this.state={...this.state,isPrintHidden:!this.state.isPrintHidden},this.persist()}toggleImages(){this.state={...this.state,isImagesHidden:!this.state.isImagesHidden},this.persist()}toggleTaxa(){this.state={...this.state,isTaxaHidden:!this.state.isTaxaHidden},this.persist()}setNameDisplayMode(e){!p(e)||this.state.nameDisplayMode===e||(this.state={...this.state,nameDisplayMode:e},this.persist())}setLeadFormat(e){!v(e)||this.state.leadFormat===e||(this.state={...this.state,leadFormat:e},this.persist())}setShowBackReference(e){this.state.showBackReference!==e&&(this.state={...this.state,showBackReference:e},this.persist())}loadFromStorage(){try{let e=localStorage.getItem(je);if(!e)return{...Me};let t={...Me,...JSON.parse(e)};return v(t.leadFormat)||(t.leadFormat=_),p(t.nameDisplayMode)||(t.nameDisplayMode=f),t}catch{return{...Me}}}persist(){try{localStorage.setItem(je,JSON.stringify(this.state))}catch(e){console.warn(`UIStateStore: Failed to persist UI preferences to localStorage.`,e)}}};function Ie(e){e.innerHTML=`
    <div class="app-shell">
      <div class="app-menu-bar" role="menubar" aria-label="Application Menu">

        <div class="menu-item" role="none">
          <button id="menu-file-trigger" class="menu-trigger"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded="false">File</button>

          <div class="menu-dropdown" role="menu" aria-labelledby="menu-file-trigger">
            <button id="cmd-new" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📄 New Key</span>
              <span class="menu-shortcut">${o?`⌘⌥N`:`Ctrl+Alt+N`}</span>
            </button>
            <button id="cmd-open-dialog" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📂 Open Key Workspace...</span>
              <span class="menu-shortcut">${o?`⌘O`:`Ctrl+O`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-save" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>💾 Save</span>
              <span class="menu-shortcut">${o?`⌘S`:`Ctrl+S`}</span>
            </button>
            <button id="cmd-save-as" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>💾 Save As...</span>
              <span class="menu-shortcut">${o?`⇧⌘S`:`Ctrl+Shift+S`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-trigger-import" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📤 Import Native File (.tskey)...</span>
            </button>
            <button id="cmd-export-json" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Export Native File (.tskey)</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-import-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📋 Import from Plain Text...</span>
            </button>
            <button id="cmd-export-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📄 Export to Plain Text (.txt)</span>
            </button>
            <button id="cmd-export-html" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🌐 Export to Web Page (.html)</span>
            </button>
            <button id="cmd-export-latex" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔏 Export to LaTeX Document (.tex)</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-edit-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Edit</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-edit-trigger">
            <button id="cmd-undo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Undo</span>
              <span class="menu-shortcut">${o?`⌘Z`:`Ctrl+Z`}</span>
            </button>
            <button id="cmd-redo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔁 Redo</span>
              <span class="menu-shortcut">${o?`⌘Y / ⌘⇧Z`:`Ctrl+Y / Ctrl+Shift+Z`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-cut" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>✂️ Cut Selected Steps</span>
              <span class="menu-shortcut">${o?`⌘X`:`Ctrl+X`}</span>
            </button>
            <button id="cmd-copy" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📋 Copy Selected Steps</span>
              <span class="menu-shortcut">${o?`⌘C`:`Ctrl+C`}</span>
            </button>
            <button id="cmd-paste-below" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Paste steps below selection</span>
              <span class="menu-shortcut">${o?`⌘V`:`Ctrl+V`}</span>
            </button>
            <button id="cmd-paste-above" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Paste above selections</span>
              <span class="menu-shortcut">${o?`Shift+⌘V`:`Shift+Ctrl+V`}</span>
            </button>
            <button id="cmd-delete" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🗑️ Delete Selected steps and figures</span>
              <span class="menu-shortcut">Delete</span>
            </button>
            <button id="cmd-swap" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Swap place for Alternatives</span>
              <span class="menu-shortcut">${o?`Option+S`:`Alt+S`}</span>
            </button>
            <button id="cmd-add" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>➕ Append New Step</span>
              <span class="menu-shortcut">Alt+N</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-insert-figref" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Insert Figure Reference</span>
              <span class="menu-shortcut">${o?`Option+F`:`Alt+F`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-clear" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🧼 Clear Selections</span>
              <span class="menu-shortcut">Esc</span>
            </button>
            <button id="cmd-select-all" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>☑️ Select all steps</span>
              <span class="menu-shortcut">${o?`⌘A`:`Ctrl+A`}</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-view-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">View</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-view-trigger">
            <button id="cmd-toggle-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Hide Figures Panel</span>
              <span class="menu-shortcut">Ctrl+Shift+F</span>
            </button>
            <button id="cmd-toggle-images" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Hide Images in Figures Panel</span>
            </button>
            <button id="cmd-toggle-taxa" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🦋 Hide Taxa Panel</span>
            </button>
            <button id="cmd-toggle-print" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖨️ Hide Print Preview</span>
              <span class="menu-shortcut">Ctrl+Shift+P</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-tools-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Tools</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-tools-trigger">
            <button id="cmd-reorder-couplets" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Steps</span>
            </button>
            <button id="cmd-reorder-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Figures</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-window-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Window</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-window-trigger">
            <button id="cmd-open-shortcuts" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>⌨️ Keyboard Shortcuts...</span>
            </button>
            <button id="cmd-open-options" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔧 Options & Settings...</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-open-about" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>ℹ️ About ${P}...</span>
            </button>
          </div>
        </div>

        <div class="menu-title-container">
          <label for="key-title-input" class="menu-title-label">Title:</label>
          <input type="text" id="key-title-input" class="key-title-input" placeholder="Untitled Key" />
        </div>

        <input type="file" id="file-import-hidden" accept=".tskey,.json" />
      </div>

      <div class="main-layout">
        <div class="editor-column">
          <h2>Key Editor: <span id="active-project-title">Untitled Key</span></h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step (Alt+N)</button>
        </div>

        <div class="figure-column">
          <h2>Figure References</h2>
          <div id="figure-container"></div>
          <button id="add-figure-btn" class="btn-add-block">+ Add New Figure</button>
        </div>

        <div class="taxa-column">
          <h2>Taxa</h2>
          <div id="taxa-container"></div>
          <button id="add-taxon-btn" class="btn-add-block">+ Add New Taxon</button>
        </div>

        <div class="print-column">
          <h2>Live Publication View</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>

      </div>
    </div>

    <div id="modal-open-project" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-open-project-title">
      <div class="modal-window hub-modal-window">
        <div class="modal-header">
          <h3 id="modal-open-project-title">📂 Open Key Workspace</h3>
          <button id="modal-project-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hub-toolbar">
            <span class="hub-toolbar-label">Stored browser keys:</span>
            <button id="btn-hub-import" class="btn btn-secondary btn-hub-import">+ Import File</button>
          </div>
          <div id="project-hub-list"></div>
        </div>
      </div>
    </div>

    <div id="modal-shortcuts" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-shortcuts-title">
      <div class="modal-window">
        <div class="modal-header">
          <h3 id="modal-shortcuts-title">⌨️ Keyboard Shortcuts</h3>
          <button id="modal-shortcuts-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <table class="shortcuts-table">
            <thead>
              <tr><th>Action</th><th>Shortcut Command</th></tr>
            </thead>
            <tbody>
              <tr><td>Create Brand New Project Workspace</td><td><code>${o?`⌘ + Option + N`:`Ctrl + Alt + N`}</code></td></tr>
              <tr><td>Open Local Workspace Hub Window</td><td><code>${o?`⌘ + O`:`Ctrl + O`}</code></td></tr>
              <tr><td>Save Current Key changes</td><td><code>${o?`⌘ + S`:`Ctrl + S`}</code></td></tr>
              <tr><td>Save Current Key under alternative title</td><td><code>Shift + ${o?`⌘ + S`:`Ctrl + S`}</code></td></tr>
              <tr><td>Select All Key  Steps</td><td><code>${o?`⌘ + A`:`Ctrl + A`}</code></td></tr>
              <tr><td>Cut Selected Key Step</td><td><code>${o?`⌘ + X`:`Ctrl + X`}</code></td></tr>
              <tr><td>Copy Selected Key Steps</td><td><code>${o?`⌘ + C`:`Ctrl + C`}</code></td></tr>
              <tr><td>Paste Key Step Below selected steps</td><td><code>${o?`⌘ + V`:`Ctrl + V`}</code></td></tr>
              <tr><td>Paste Key Step Above selected steps</td><td><code>${o?`Shift + ⌘ + V`:`Shift + Ctrl + V`}</code></td></tr>
              <tr><td>Append New Key Step</td><td><code>Alt + N</code></td></tr>
              <tr><td>Insert figure reference <code>[fig: ]</code> (while editing a step's text)</td><td><code>${o?`Option + F`:`Alt + F`}</code></td></tr>
              <tr><td>Swap Alternative Rows in selected key steps</td><td><code>Alt + S</code></td></tr>
              <tr><td>Undo Last Action</td><td><code>${o?`⌘ + Z`:`Ctrl + Z`}</code></td></tr>
              <tr><td>Redo Action</td><td><code>${o?`⌘ + Y`:`Ctrl + Y`}</code></td></tr>
              <tr><td>Delete Selected Key Steps</td><td><code>Delete</code> / <code>Backspace</code></td></tr>
              <tr><td>Deselect all key step and figure references</td><td><code>Escape</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="modal-options" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-options-title">
      <div class="modal-window">
        <div class="modal-header">
          <h3 id="modal-options-title">🔧 Options & Settings</h3>
          <button id="modal-options-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-group">
            <h4>Key labelling format</h4>
            <p class="settings-hint">Choose how the two alternatives of every step are labelled. This applies to the Live Publication View and to the plain-text, HTML, and LaTeX exports.</p>
            <div class="settings-options" id="opt-lead-format" role="radiogroup" aria-label="Key labelling format">
              <label class="settings-option">
                <input type="radio" name="lead-format" value="classic" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Number &amp; em-dash</span>
                  <span class="settings-option-sample"><span>1.</span>diagnose … Homo habilis<br><span>—</span>diagnose … 2</span>
                </span>
              </label>
              <label class="settings-option">
                <input type="radio" name="lead-format" value="lettered" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Lettered</span>
                  <span class="settings-option-sample"><span>1a</span>diagnose … Homo habilis<br><span>1b</span>diagnose … 2</span>
                </span>
              </label>
              <label class="settings-option">
                <input type="radio" name="lead-format" value="minimal" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Number &amp; hyphen</span>
                  <span class="settings-option-sample"><span>1</span>diagnose … Homo habilis<br><span>-</span>diagnose … 2</span>
                </span>
              </label>
            </div>

            <label class="setting-item settings-checkbox">
              <input type="checkbox" id="opt-backref" />
              <span class="settings-option-main">
                <span class="settings-option-title">Show back-reference</span>
                <span class="settings-hint settings-checkbox-hint">Append the step this couplet is reached from, in parentheses — e.g. <strong>2&nbsp;(1)</strong>. Handy for navigating a printed key upwards.</span>
              </span>
            </label>
          </div>

          <div class="settings-group">
            <h4>Taxon names in the key</h4>
            <p class="settings-hint">Choose which name terminal taxa show in the Live Publication View and exports. Vernacular falls back to the scientific name when a taxon has no common name.</p>
            <div class="settings-options" id="opt-name-display" role="radiogroup" aria-label="Taxon names in the key">
              <label class="settings-option">
                <input type="radio" name="name-display" value="scientific" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Scientific name</span>
                  <span class="settings-option-sample"><em>Bufo bufo</em></span>
                </span>
              </label>
              <label class="settings-option">
                <input type="radio" name="name-display" value="vernacular" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Vernacular name</span>
                  <span class="settings-option-sample">Common toad</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="modal-about" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-about-title">
      <div class="modal-window about-modal-window">
        <div class="modal-header">
          <h3 id="modal-about-title">ℹ️ About</h3>
          <button id="modal-about-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body about-modal-body">
          <h4 class="about-title">${P}</h4>
          <p class="about-version">
            Version ${Te} (2026 Engine Core)
          </p>
          <p class="about-description">
            An interactive editor for writing classical biological dichotomous keys used to identify biological taxonomic units on morphological characters.
          </p>
          <div class="menu-divider about-divider"></div>
          <p class="about-credits">
            Written by Nils Ericson 2026<br>Released under the zlib license
          </p>
        </div>
      </div>
    </div>

    <div id="plain-text-import-view" class="fullscreen-view" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="pt-import-title-label" tabindex="-1">
      <div class="fullscreen-view-header">
        <h3 id="pt-import-title-label">📋 Import Key from Plain Text</h3>
        <button id="pt-import-close" class="modal-close-x" aria-label="Close import view">&times;</button>
      </div>

      <div class="import-options-bar" role="group" aria-label="Parsing options">
        <span class="import-options-title">Parsing options</span>
        <label class="import-option"><input type="checkbox" id="pt-opt-join" checked /> Join wrapped lines</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-dehyphen" checked /> De-hyphenate breaks</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-ws" checked /> Spaces/Tab separator</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-lettered" checked /> Lettered (1a/1b)</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-dash" checked /> Dash second line</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-backref" checked /> Back-refs "2 (1)"</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-fill" checked /> Fill missing key steps</label>
        <label class="import-option import-option-num">Min leader dots
          <input type="number" id="pt-opt-min-dots" min="2" max="10" step="1" value="3" />
        </label>
      </div>

      <div class="fullscreen-view-body import-view-body">
        <section class="import-input-pane">
          <div class="import-pane-toolbar">
            <label for="pt-import-source" class="import-pane-label">Paste your key, or load a text file</label>
            <div class="import-toolbar-actions">
              <label class="import-encoding-field" for="pt-import-encoding">Encoding
                <select id="pt-import-encoding">
                  <option value="auto" selected>Auto-detect</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                  <option value="windows-1252">Windows-1252 / Latin-1</option>
                </select>
              </label>
              <button id="pt-import-load-file" class="btn btn-secondary">📂 Load .txt File...</button>
              <button id="pt-import-clear" class="btn btn-outline">Clear</button>
            </div>
          </div>
          <textarea id="pt-import-source" class="import-source-textarea" spellcheck="false"
            placeholder="1.&#9;Has feathers&#9;Bird&#10;&#8212;&#9;Lacks feathers&#9;2&#10;&#10;2.&#9;Has fur&#9;Mammal&#10;&#8212;&#9;Has scales&#9;Reptile"></textarea>
          <input type="file" id="pt-import-file-hidden" accept=".txt,text/plain" style="display: none;" />
          <p class="import-hint">
            Paste a key in almost any layout. Each step starts with a number (<code>1</code>, <code>1.</code>, <code>1a</code>/<code>1b</code>)
            and the second alternative may start with a dash (<code>-</code> <code>–</code> <code>—</code>). The destination — a step number
            or a taxon name — is whatever follows a dotted leader (<code>……</code>), a tab, or wide spacing at the end of the lead.
            Lines wrapped across a page (common in PDFs) are stitched back together. Tune the options above and watch the preview.
            File encoding is auto-detected (UTF-8, UTF-16, and legacy Windows-1252/Latin-1); pick it manually if accented characters look wrong.
            The result is best-effort and may need a little manual cleanup.
          </p>
        </section>

        <section class="import-preview-pane">
          <div class="import-pane-toolbar">
            <span class="import-pane-label">Preview</span>
            <span id="pt-import-status" class="import-status"></span>
          </div>
          <div id="pt-import-preview" class="import-preview-content"></div>
        </section>
      </div>

      <div class="fullscreen-view-footer">
        <label class="import-title-field">
          Import as:
          <input type="text" id="pt-import-title" placeholder="Imported Key" />
        </label>
        <div class="import-footer-actions">
          <button id="pt-import-cancel" class="btn btn-secondary">Cancel</button>
          <button id="pt-import-confirm" class="btn btn-primary" disabled>Import into Workspace</button>
        </div>
      </div>
    </div>
    `}function Le(e){document.querySelector(`.figure-column`)?.classList.toggle(`is-hidden`,e.isFiguresHidden),document.querySelector(`.taxa-column`)?.classList.toggle(`is-hidden`,e.isTaxaHidden),document.querySelector(`.print-column`)?.classList.toggle(`is-hidden`,e.isPrintHidden)}function I(e,t,n,r=!1){let i=e.querySelector(t);return i?((r||document.activeElement!==i)&&i.value!==n&&(i.value=n),i):null}function L(e,t=`success`){let n=document.querySelector(`.toast-container`);n||(n=document.createElement(`div`),n.className=`toast-container`,n.setAttribute(`aria-live`,`polite`),document.body.appendChild(n));let r=document.createElement(`div`);r.className=`toast toast-${t}`,r.textContent=e,t===`error`?r.setAttribute(`role`,`alert`):r.setAttribute(`role`,`status`),n.appendChild(r),setTimeout(()=>{r.remove(),n&&n.childElementCount===0&&n.remove()},3e3)}function Re(e,t){if(!document.querySelector(`.app-menu-bar`))return;let n=e=>document.getElementById(e),r=e.getSelectedCoupletIds().size,i=e.getSelectedFigureIds().size,a=e.getSelectedTaxonIds().size,o=r>0||i>0||a>0,s=r>0,c=e.getKey().length>0,l=e.hasClipboardData(),u=e.getTitle(),d=e.hasUnsavedChanges(),f=`${u}${d?` *`:``}`;document.title=`${f} - ${P}`;let p=document.getElementById(`active-project-title`);p&&p.textContent!==f&&(p.textContent=f);let m=n(`cmd-save`),h=n(`cmd-export-json`),g=n(`cmd-export-text`),_=n(`cmd-export-html`),v=n(`cmd-export-latex`),y=n(`cmd-undo`),b=n(`cmd-redo`),x=n(`cmd-cut`),S=n(`cmd-copy`),C=n(`cmd-paste-below`),w=n(`cmd-paste-above`),T=n(`cmd-delete`),E=n(`cmd-swap`),D=n(`cmd-clear`),O=n(`cmd-reorder-couplets`),k=n(`cmd-reorder-figures`);m&&m.classList.toggle(`has-unsaved-changes`,d),h&&(h.disabled=!c),g&&(g.disabled=!c),_&&(_.disabled=!c),v&&(v.disabled=!c),y&&(y.disabled=!e.canUndo),b&&(b.disabled=!e.canRedo),x&&(x.disabled=!s),S&&(S.disabled=!s),T&&(T.disabled=!o),E&&(E.disabled=!s),D&&(D.disabled=!o),C&&(C.disabled=!l),w&&(w.disabled=!l),O&&(O.disabled=!c),k&&(k.disabled=!c||e.getFigures().length===0);let A=n(`cmd-toggle-figures`),j=n(`cmd-toggle-images`),ee=n(`cmd-toggle-taxa`),te=n(`cmd-toggle-print`);if(A){let e=A.querySelector(`span`);e&&(e.textContent=t.isFiguresHidden?`🖼️ Show Figures Panel`:`🖼️ Hide Figures Panel`)}if(j){let e=j.querySelector(`span`);e&&(e.textContent=t.isImagesHidden?`🖼️ Show Images in Figures Panel`:`🖼️ Hide Images in Figures Panel`)}if(ee){let e=ee.querySelector(`span`);e&&(e.textContent=t.isTaxaHidden?`🦋 Show Taxa Panel`:`🦋 Hide Taxa Panel`)}if(te){let e=te.querySelector(`span`);e&&(e.textContent=t.isPrintHidden?`🖨️ Show Print Preview`:`🖨️ Hide Print Preview`)}let M=document.querySelector(`.app-shell`);M&&I(M,`#key-title-input`,e.getTitle())}function ze(e,t){let n=document.getElementById(`project-hub-list`);if(n){if(e.length===0){n.innerHTML=`<div class="hub-empty">No keys saved inside local browser memory yet.</div>`;return}n.innerHTML=e.map(e=>{let n=e.name===t,r=new Date(e.lastModified).toLocaleString(),a=i(e.name);return`
            <div class="project-hub-item${n?` is-current`:``}" data-name="${a}">
                <div class="hub-item-clickable-zone" data-action="load" data-name="${a}">
                    <span class="hub-item-name">${a}${n?` <small class="hub-item-active-tag">(active)</small>`:``}</span>
                    <span class="hub-item-date">Last saved: ${r}</span>
                </div>
                <button class="btn-hub-delete" data-action="delete" data-name="${a}" title="Delete from local database">&times;</button>
            </div>
        `}).join(``)}}function Be(e,t,n){let r=e.querySelector(`.btn-create-taxon[data-for="${t}"]`);r&&(r.hidden=!n)}function Ve(e){let n=document.getElementById(`editor-container`);if(!n)return;let r=e.getKey(),a=e.getSelectedCoupletIds(),o=e.runDiagnostics(),s=u(r),c=e.generateInboundLinksMap(),l=m(e.getTaxa(),`scientific`),d=a.size===1?[...a][0]:a.size===0?e.getActiveCoupletId():null,f=new Set,p=new Set;if(d!==null){let e=r.find(e=>e.id===d);if(e){let n=t(e.branch1);n!==null&&f.add(n);let r=t(e.branch2);r!==null&&f.add(r)}r.forEach(e=>{(t(e.branch1)===d||t(e.branch2)===d)&&p.add(e.id)})}let h=Array.from(n.querySelectorAll(`.key-card`)),_=new Map;h.forEach(e=>{let t=e.getAttribute(`data-id`);t&&_.set(Number(t),e)}),r.forEach((t,u)=>{let m=u+1,h=a.has(t.id),v=c.get(t.id)||[],y=g(t.branch1,s,l),b=g(t.branch2,s,l),x=o.get(t.id)||[],S=`${m}.`,C=v.length||u===0?`badge badge-linked`:`badge badge-isolated`,w=v.length?`← ${v.map(e=>{let t=r[parseInt(e,10)-1]?.id;return t===void 0?i(e):`<span class="badge-link" data-step-id="${t}">${i(e)}</span>`}).join(`, `)}`:u===0?`🏁 root`:`⚠️ isolated`,T=``;x.forEach(e=>{let t=e.severity===`error`?`error-text`:`warning-text`;T+=`<div class="${t}">⚠️ ${i(e.message)}</div>`});let E=x.length>0?`<div class="warning-block">${T}</div>`:``,D=t.id!==d&&f.has(t.id),O=t.id!==d&&p.has(t.id),k=_.get(t.id);if(k){_.delete(t.id),k.classList.toggle(`is-selected`,h),k.classList.toggle(`is-link-out`,D),k.classList.toggle(`is-link-in`,O);let r=k.querySelector(`.card-title`);r&&r.textContent!==S&&(r.textContent=S);let i=k.querySelector(`.badge`);i&&(i.className=C,i.innerHTML!==w&&(i.innerHTML=w)),I(k,`textarea[data-field="alt1"]`,e.decodeTextReferencesForEditor(t.alt1));let a=I(k,`input[data-field="dest1"]`,y.inputValue);a?.classList.toggle(`input-error`,y.isUnresolved),a?.classList.toggle(`input-taxon-unlinked`,!!y.isUnlinkedTaxon),Be(k,`dest1`,y.isUnlinkedTaxon),I(k,`textarea[data-field="alt2"]`,e.decodeTextReferencesForEditor(t.alt2));let o=I(k,`input[data-field="dest2"]`,b.inputValue);o?.classList.toggle(`input-error`,b.isUnresolved),o?.classList.toggle(`input-taxon-unlinked`,!!b.isUnlinkedTaxon),Be(k,`dest2`,b.isUnlinkedTaxon);let s=k.querySelector(`.warning-block`);x.length>0?s?s.innerHTML!==T&&(s.innerHTML=T):k.insertAdjacentHTML(`beforeend`,E):s&&s.remove(),n.children[u]!==k&&n.insertBefore(k,n.children[u]||null)}else k=document.createElement(`div`),k.draggable=!0,k.setAttribute(`data-id`,t.id.toString()),k.className=`key-card`,h&&k.classList.add(`is-selected`),D&&k.classList.add(`is-link-out`),O&&k.classList.add(`is-link-in`),k.innerHTML=`
                <div class="card-header">
                  <div class="card-header-left">
                    <h4 class="card-title">${S}</h4>
                    <span class="${C}">${w}</span>
                  </div>
                  <span class="drag-handle">☰</span>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt1" placeholder="Enter diagnostic trait details [fig: 1]...">${i(e.decodeTextReferencesForEditor(t.alt1))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${y.isUnresolved?`input-error`:``} ${y.isUnlinkedTaxon?`input-taxon-unlinked`:``}" data-field="dest1" placeholder="Taxon or Step #" value="${i(y.inputValue)}" />
                    </label>
                    <button type="button" class="btn-create-taxon" data-for="dest1" title="Create a Taxa card for this name"${y.isUnlinkedTaxon?``:` hidden`}>＋ taxon</button>
                  </div>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${i(e.decodeTextReferencesForEditor(t.alt2))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${b.isUnresolved?`input-error`:``} ${b.isUnlinkedTaxon?`input-taxon-unlinked`:``}" data-field="dest2" placeholder="Taxon or Step #" value="${i(b.inputValue)}" />
                    </label>
                    <button type="button" class="btn-create-taxon" data-for="dest2" title="Create a Taxa card for this name"${b.isUnlinkedTaxon?``:` hidden`}>＋ taxon</button>
                  </div>
                </div>
                ${E}
            `,n.insertBefore(k,n.children[u]||null)}),_.forEach(e=>e.remove())}var He=null;function Ue(e,t,n){if(t.isFiguresHidden)return;let r=document.getElementById(`figure-container`);if(!r)return;let i=e.getFigures(),a=Array.from(r.children),o=new Map;a.forEach(e=>{let t=Number(e.getAttribute(`data-id`));isNaN(t)||o.set(t,e)}),i.forEach((i,a)=>{let s=a+1,c=e.getSelectedFigureIds().has(i.id),l=o.get(i.id);if(!l)l=document.createElement(`div`),l.className=`figure-card`,l.setAttribute(`data-id`,i.id.toString()),l.draggable=!0,l.innerHTML=`
                <div class="figure-card-header">
                    <span class="figure-card-title">${s}.</span>
                </div>

                <div class="figure-preview-wrapper">
                    <img class="figure-preview-img" alt="Figure view" style="display: none;" />
                    <div class="figure-upload-overlay">
                        <button type="button" class="btn-trigger-upload">Choose Image</button>
                        <button type="button" class="btn-remove-image" style="display: none;">Remove Image</button>
                        <input type="file" class="hidden-file-picker" accept="image/*" style="display: none;" />
                    </div>
                </div>

                <div class="figure-field-row">
                    <label>Filename:</label>
                    <input type="text" class="input-sync figure-input-filename" data-field="filename" />
                </div>

                <div class="figure-field-row">
                    <label>Caption:</label>
                    <textarea class="input-sync figure-input-caption" data-field="caption" rows="2"></textarea>
                </div>
            `;else{let e=l.querySelector(`.figure-card-title`);e&&(e.textContent=`${s}.`),o.delete(i.id)}r.children[a]!==l&&r.insertBefore(l,r.children[a]||null),l.classList.toggle(`is-selected`,c);let u=l.querySelector(`.figure-preview-wrapper`),d=l.querySelector(`.figure-preview-img`);if(t.isImagesHidden)u&&(u.style.display=`none`),d&&(d.style.display=`none`);else{u&&(u.style.display=``);let t=j.get(i.id),r=l.querySelector(`.btn-remove-image`);if(t)d.src!==t&&(d.src=t),d.style.display=`block`,r&&(r.style.display=`inline-block`);else if(!d.hasAttribute(`data-loading-state`)){d.setAttribute(`data-loading-state`,`pending`);let t=e.getActiveProjectUid();A.getFigureBinary(t,i.id).then(a=>{if(d.removeAttribute(`data-loading-state`),e.getActiveProjectUid()===t)if(a){let e=URL.createObjectURL(a);j.set(i.id,e),He===null&&(He=requestAnimationFrame(()=>{He=null,n()}))}else d.style.display=`none`,r&&(r.style.display=`none`)}).catch(e=>{console.error(`Failed to load binary thumbnail:`,e),d.removeAttribute(`data-loading-state`),r&&(r.style.display=`none`)})}}let f=l.querySelector(`.figure-input-filename`);f&&document.activeElement!==f&&f.value!==i.filename&&(f.value=i.filename);let p=l.querySelector(`.figure-input-caption`);p&&document.activeElement!==p&&p.value!==i.caption&&(p.value=i.caption)}),o.forEach(e=>e.remove());let s=new Set(i.map(e=>e.id));for(let[e,t]of j.entries())s.has(e)||(URL.revokeObjectURL(t),j.delete(e))}function We(e){return e.join(`
`)}function Ge(e){return e.map(e=>e.distinction?`${e.name} | ${e.distinction}`:e.name).join(`
`)}function Ke(){return`
        <div class="taxon-card-header">
            <span class="taxon-card-title"></span>
        </div>
        <div class="taxon-field-row">
            <label>Scientific name:</label>
            <input type="text" class="input-sync taxon-input" data-field="scientificName" />
        </div>
        <div class="taxon-field-row">
            <label>Auctor:</label>
            <input type="text" class="input-sync taxon-input" data-field="auctor" />
        </div>
        <div class="taxon-field-row">
            <label>Vernacular name:</label>
            <input type="text" class="input-sync taxon-input" data-field="vernacularName" placeholder="Vernacular name" />
        </div>
        <div class="taxon-field-row">
            <label>Synonyms (one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="synonyms" rows="2"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Description:</label>
            <textarea class="input-sync taxon-textarea" data-field="description" rows="3"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Biology:</label>
            <textarea class="input-sync taxon-textarea" data-field="biology" rows="3"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Distribution:</label>
            <textarea class="input-sync taxon-textarea" data-field="distribution" rows="2"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Confusable species (name | how to distinguish, one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="confusables" rows="3"></textarea>
        </div>
    `}function qe(e,t,n){let r=e.querySelector(`.taxon-card-title`),i=`${n}.`;r&&r.textContent!==i&&(r.textContent=i),I(e,`input[data-field="scientificName"]`,t.scientificName),I(e,`input[data-field="auctor"]`,t.auctor),I(e,`input[data-field="vernacularName"]`,t.vernacularName),I(e,`textarea[data-field="synonyms"]`,We(t.synonyms)),I(e,`textarea[data-field="description"]`,t.description),I(e,`textarea[data-field="biology"]`,t.biology),I(e,`textarea[data-field="distribution"]`,t.distribution),I(e,`textarea[data-field="confusables"]`,Ge(t.confusables))}function Je(e,t){if(t.isTaxaHidden)return;let n=document.getElementById(`taxa-container`);if(!n)return;let r=e.getTaxa(),i=e.getSelectedTaxonIds(),a=Array.from(n.children),o=new Map;a.forEach(e=>{let t=Number(e.getAttribute(`data-id`));isNaN(t)||o.set(t,e)}),r.forEach((e,t)=>{let r=t+1,a=o.get(e.id);a?o.delete(e.id):(a=document.createElement(`div`),a.className=`taxon-card`,a.setAttribute(`data-id`,e.id.toString()),a.draggable=!0,a.innerHTML=Ke()),n.children[t]!==a&&n.insertBefore(a,n.children[t]||null),a.classList.toggle(`is-selected`,i.has(e.id)),qe(a,e,r)}),o.forEach(e=>e.remove())}var Ye=/\[figID:\s*(\d+)\s*\]|\[fig:\s*([^\]]+?)\s*\]/gi;function Xe(e,t){return`<span class="fig-ref" data-fig-id="${e}">(Fig. ${t})</span>`}function Ze(e,t,n){if(!e)return``;let{displayNumToFig:r,filenameToFig:a}=E(t),o=t.length,s=``,c=0,l=new RegExp(Ye.source,Ye.flags),u;for(;(u=l.exec(e))!==null;)if(s+=i(e.slice(c,u.index)),c=u.index+u[0].length,u[1]!==void 0){let e=parseInt(u[1],10),t=n.get(e);s+=t===void 0?`<span class="error-text">[Fig: ID ${e}]</span>`:Xe(e,t)}else{let e=(u[2]??``).trim(),t=null,c=parseInt(e,10);if(!isNaN(c)&&String(c)===e&&c>=1&&c<=o){let e=r.get(c);e&&(t={figId:e.id,displayNum:c})}else{let r=a.get(e.toLowerCase()),i=r?n.get(r.id):void 0;r&&i!==void 0&&(t={figId:r.id,displayNum:i})}s+=t?Xe(t.figId,t.displayNum):`<span class="error-text">[Fig: ${i(e)}]</span>`}return s+=i(e.slice(c)),s}function Qe(e,t){if(t.isPrintHidden)return;let n=document.getElementById(`print-view-container`);if(!n)return;let r=e.getKey(),i=t.leadFormat,a=u(r),o=e.getFigures(),s=d(o),c=t.showBackReference?y(r):null,l=m(e.getTaxa(),t.nameDisplayMode);n.dataset.leadFormat=i;let f=Array.from(n.querySelectorAll(`.print-step-block`)),p=new Map;f.forEach(e=>{let t=e.getAttribute(`data-id`);t&&p.set(Number(t),e)}),r.forEach((e,t)=>{let{lead1:r,lead2:u}=b(i,t+1,c?.get(e.id)),d=g(e.branch1,a,l),f=g(e.branch2,a,l),m=Ze(e.alt1,o,s)||`___`,h=Ze(e.alt2,o,s)||`___`,_=p.get(e.id);if(_){p.delete(e.id);let i=_.querySelector(`.print-step-num`);i&&i.textContent!==r&&(i.textContent=r);let a=_.querySelector(`.print-dash`);a&&a.textContent!==u&&(a.textContent=u);let o=_.querySelector(`.print-row[data-choice="1"] .print-text`);o&&o.innerHTML!==m&&(o.innerHTML=m);let s=_.querySelector(`.print-row[data-choice="1"] .print-dest`);if(s){s.textContent!==d.printText&&(s.textContent=d.printText);let e=`print-dest ${d.printClass}`.trim();s.className!==e&&(s.className=e)}let c=_.querySelector(`.print-row[data-choice="2"] .print-text`);c&&c.innerHTML!==h&&(c.innerHTML=h);let l=_.querySelector(`.print-row[data-choice="2"] .print-dest`);if(l){l.textContent!==f.printText&&(l.textContent=f.printText);let e=`print-dest ${f.printClass}`.trim();l.className!==e&&(l.className=e)}n.children[t]!==_&&n.insertBefore(_,n.children[t]||null)}else{_=document.createElement(`div`),_.className=`print-step-block`,_.setAttribute(`data-id`,e.id.toString()),_.innerHTML=`
              <div class="print-step-num"></div>
                <div class="print-row" data-choice="1">
                  <span class="print-text"></span>
                  <span class="print-dest"></span>
                </div>
                <div class="print-dash"></div>
                <div class="print-row" data-choice="2">
                  <span class="print-text"></span>
                  <span class="print-dest"></span>
                </div>
              <div class="print-spacer"></div>
            `;let t=_.querySelector(`.print-step-num`);t&&(t.textContent=r);let i=_.querySelector(`.print-dash`);i&&(i.textContent=u);let a=_.querySelector(`.print-row[data-choice="1"] .print-text`);a&&(a.innerHTML=m);let o=_.querySelector(`.print-row[data-choice="1"] .print-dest`);o&&(o.textContent=d.printText,d.printClass&&(o.className=`print-dest ${d.printClass}`.trim()));let s=_.querySelector(`.print-row[data-choice="2"] .print-text`);s&&(s.innerHTML=h);let c=_.querySelector(`.print-row[data-choice="2"] .print-dest`);c&&(c.textContent=f.printText,f.printClass&&(c.className=`print-dest ${f.printClass}`.trim())),n.appendChild(_)}}),p.forEach(e=>e.remove())}var $e=`___`;function et(e){switch(e){case`auto`:return`Auto-detect`;case`utf-8`:return`UTF-8`;case`utf-16le`:return`UTF-16 LE`;case`utf-16be`:return`UTF-16 BE`;case`windows-1252`:return`Windows-1252 / Latin-1`}}function tt(e){return e.length>=3&&e[0]===239&&e[1]===187&&e[2]===191?`utf-8`:e.length>=2&&e[0]===255&&e[1]===254?`utf-16le`:e.length>=2&&e[0]===254&&e[1]===255?`utf-16be`:null}function nt(e){let t=tt(e);if(t)return t;let n=Math.min(e.length,4096),r=0,i=0;for(let t=0;t<n;t++)e[t]===0&&(t%2==0?r++:i++);if(n>0&&(r+i)/n>.2)return i>r?`utf-16le`:`utf-16be`;try{return new TextDecoder(`utf-8`,{fatal:!0}).decode(e),`utf-8`}catch{return`windows-1252`}}function rt(e,t){let n=new Uint8Array(e),r=t===`auto`?nt(n):t;return{text:new TextDecoder(r).decode(e),encoding:r,autoDetected:t===`auto`}}var it=500,R={minLeaderDots:3,useWhitespaceSeparator:!0,joinWrappedLines:!0,dehyphenate:!0,recognizeLetteredCouplets:!0,recognizeDashSecondLead:!0,recognizeBackReferences:!0,fillMissingCouplets:!0};function at(e){let t=(e??``).replace(/\s+/g,` `).trim();return t===$e?``:t}function ot(e){let t=e.findIndex(e=>e.trim().toUpperCase()===`FIGURES DATA`);return t===-1?e:e.slice(0,t).filter(e=>!/^=+$/.test(e.trim()))}function st(e,t){let n=t.recognizeLetteredCouplets?`([a-bA-B])?`:`()?`,r=t.recognizeBackReferences?`(?:\\s*\\(\\s*\\d[\\d\\s,.–-]*\\))?`:``,i=e.match(RegExp(`^\\s*(\\d{1,4})\\s*${n}\\s*[.)]?${r}\\s+(\\S.*)$`));if(i){let e=parseInt(i[1],10),n=(i[2]||``).toLowerCase(),r=i[3];return t.recognizeLetteredCouplets&&n===`b`?{kind:`second`,coupletNum:e,rest:r}:{kind:`first`,coupletNum:e,rest:r}}if(t.recognizeDashSecondLead){let t=e.match(/^\s*[-–—]\s+(\S.*)$/);if(t)return{kind:`second`,coupletNum:null,rest:t[1]}}return null}function ct(e,t,n){let r=e.replace(/\s+$/,``),i=t.trim();return n.dehyphenate&&/[A-Za-zÀ-ÿ]-$/.test(r)?r.slice(0,-1)+i:`${r} ${i}`}function lt(e,t){let n=null,r;for(;(r=e.exec(t))!==null;)n=r;return n}function ut(e,t){let n=e.lastIndexOf(`	`);if(n!==-1)return{text:e.slice(0,n),dest:e.slice(n+1)};let r=Math.max(2,Math.floor(t.minLeaderDots)||2),i=lt(RegExp(`\\.(?:\\s?\\.){${r-1},}`,`g`),e);if(i)return{text:e.slice(0,i.index),dest:e.slice(i.index+i[0].length)};if(t.useWhitespaceSeparator){let t=lt(/\s{2,}/g,e);if(t)return{text:e.slice(0,t.index),dest:e.slice(t.index+t[0].length)}}let a=e.match(/^(.*\S)\s+(\d{1,4})\.?\s*$/);return a?{text:a[1],dest:a[2]}:{text:e,dest:``}}function dt(e){let t=e.trim();if(t===``||/^[.\s]+$/.test(t))return{linkNum:0,taxa:``};let n=t.match(/^(\d{1,4})\.?$/);return n?{linkNum:parseInt(n[1],10),taxa:``}:{linkNum:0,taxa:t}}function ft(){return{alt1:``,link1:0,taxa1:``,alt2:``,link2:0,taxa2:``}}function pt(e,t,n){if(e)return n.has(e)?{kind:`linked`,targetId:e}:{kind:`unresolved`,couplet:e};let r=t.trim();return r===``?{kind:`empty`}:{kind:`taxonDraft`,name:r}}function mt(e,t={}){let n={...R,...t},r=[],i=[],a=ot((e??``).replace(/\r\n?/g,`
`).split(`
`)),o=[],s=null,c=0,l=0,u=()=>{s&&=(o.push(s),null)};for(let e of a){if(e.trim()===``)continue;let t=st(e,n);if(t){if(u(),t.kind===`first`)c=t.coupletNum,s={num:t.coupletNum,isSecond:!1,body:t.rest};else{let n=t.coupletNum??c;if(n===0){r.push(`Ignored a second-alternative line before any numbered step: "${e.trim().slice(0,50)}"`);continue}t.coupletNum!==null&&(c=t.coupletNum),s={num:n,isSecond:!0,body:t.rest}}continue}s&&n.joinWrappedLines?s.body=ct(s.body,e,n):s&&l++}if(u(),o.length===0)return i.push(`No key steps were recognized. Each step should start with a number (e.g. "1." or "1a") or a dash for the second alternative.`),{couplets:[],figures:[],warnings:r,errors:i,stepCount:0};l>0&&r.push(`${l} wrapped line(s) were dropped because "Join wrapped lines" is off.`);let d=new Map,f=e=>{let t=d.get(e);return t||(t=ft(),d.set(e,t)),t},p=0,m=!1;for(let e of o){if(e.num>it){r.push(`Step number ${e.num} exceeds the safety ceiling of ${it} and was skipped.`);continue}p=Math.max(p,e.num);let{text:t,dest:i}=ut(e.body,n),{linkNum:a,taxa:o}=dt(i);a>it&&(o=String(a),a=0,m=!0),p=Math.max(p,a);let s=f(e.num);e.isSecond?(s.alt2=at(t),s.link2=a,s.taxa2=o):((s.alt1||s.taxa1||s.link1)&&r.push(`Couplet ${e.num} has more than one first alternative; the later one overwrote the earlier.`),s.alt1=at(t),s.link1=a,s.taxa1=o)}if(m&&r.push(`One or more destination numbers were too large to be real step links and were kept as text.`),p=Math.min(p,it),n.fillMissingCouplets){let e=0;for(let t=1;t<=p;t++)d.has(t)||(f(t),e++);e>0&&r.push(`Generated ${e} empty key step(s) to fill gaps so links resolve.`)}let h=[...d.keys()].sort((e,t)=>e-t),g=new Set(h),_=h.map(e=>{let t=d.get(e);return{id:e,alt1:t.alt1,alt2:t.alt2,branch1:pt(t.link1,t.taxa1,g),branch2:pt(t.link2,t.taxa2,g)}});return{couplets:_,figures:[],warnings:r,errors:i,stepCount:_.length}}var z=`plain-text-import-view`,B=null,V=null;function H(e){return document.getElementById(e)}function ht(){let e=(e,t)=>{let n=H(e);return n?n.checked:t},t=H(`pt-opt-min-dots`),n=t&&t.value!==``?parseInt(t.value,10):R.minLeaderDots;return{minLeaderDots:Number.isFinite(n)?n:R.minLeaderDots,useWhitespaceSeparator:e(`pt-opt-ws`,R.useWhitespaceSeparator),joinWrappedLines:e(`pt-opt-join`,R.joinWrappedLines),dehyphenate:e(`pt-opt-dehyphen`,R.dehyphenate),recognizeLetteredCouplets:e(`pt-opt-lettered`,R.recognizeLetteredCouplets),recognizeDashSecondLead:e(`pt-opt-dash`,R.recognizeDashSecondLead),recognizeBackReferences:e(`pt-opt-backref`,R.recognizeBackReferences),fillMissingCouplets:e(`pt-opt-fill`,R.fillMissingCouplets)}}function gt(){return H(`pt-import-encoding`)?.value||`auto`}function _t(){let e=H(z);e&&(e.style.display=`flex`,H(`pt-import-source`)?.focus(),U())}function vt(){let e=H(z);e&&(e.style.display=`none`)}function yt(){let e=H(z);return!!e&&e.style.display!==`none`}function U(){let e=H(`pt-import-source`),t=H(`pt-import-preview`),n=H(`pt-import-status`),r=H(`pt-import-confirm`);if(!e||!t)return;let i=e.value;if(i.trim()===``){B=null,t.innerHTML=`<div class="import-preview-empty">Paste or load a key to see a live preview here.</div>`,n&&(n.textContent=``),r&&(r.disabled=!0);return}let a=mt(i,ht());B=a;let o=a.couplets.length>0&&a.errors.length===0;r&&(r.disabled=!o),n&&(a.errors.length>0?(n.textContent=`⚠️ Could not parse`,n.className=`import-status import-status-error`):(n.textContent=`✓ ${a.stepCount} step(s)`,n.className=`import-status import-status-ok`)),t.innerHTML=bt(a)}function bt(e){let t=``;if(e.errors.length>0)return t+=`<div class="import-messages">`,e.errors.forEach(e=>{t+=`<div class="import-msg import-msg-error">⛔ ${i(e)}</div>`}),t+=`</div>`,t;e.warnings.length>0&&(t+=`<div class="import-messages">`,e.warnings.forEach(e=>{t+=`<div class="import-msg import-msg-warning">⚠️ ${i(e)}</div>`}),t+=`</div>`);let n=ke(e.couplets,e.figures),r=0,a=0;if(n.forEach(e=>e.forEach(e=>{e.severity===`error`?r++:a++})),r>0||a>0){let e=[];r>0&&e.push(`${r} error${r===1?``:`s`}`),a>0&&e.push(`${a} warning${a===1?``:`s`}`),t+=`<div class="import-diagnostics-summary">🩺 Key check: ${e.join(`, `)}. Fixable after import in the editor.</div>`}let o=new Map;e.couplets.forEach((e,t)=>o.set(e.id,t+1));let s=e=>{switch(e.kind){case`linked`:{let t=o.get(e.targetId);return t===void 0?`→ ?`:`→ ${t}`}case`unresolved`:return`→ ${e.couplet}`;case`taxonDraft`:return i(e.name);case`taxon`:return`→ taxon`;case`empty`:return`<span class="import-preview-muted">(empty)</span>`}},c=e=>{let t=n.get(e);return!t||t.length===0?``:`<div class="import-preview-diagnostics warning-block">${t.map(e=>`<div class="${e.severity===`error`?`error-text`:`warning-text`}">${e.severity===`error`?`⛔`:`⚠️`} ${i(e.message)}</div>`).join(``)}</div>`};return t+=`<ol class="import-preview-list">`,e.couplets.forEach((e,r)=>{let a=n.has(e.id);t+=`
            <li class="import-preview-step${a?` has-issues`:``}">
                <div class="import-preview-rows">
                    <div class="import-preview-row">
                        <span class="import-preview-lead">${r+1}.</span>
                        <span class="import-preview-text">${i(e.alt1)||`<span class="import-preview-muted">(blank)</span>`}</span>
                        <span class="import-preview-dest">${s(e.branch1)}</span>
                    </div>
                    <div class="import-preview-row">
                        <span class="import-preview-lead">-</span>
                        <span class="import-preview-text">${i(e.alt2)||`<span class="import-preview-muted">(blank)</span>`}</span>
                        <span class="import-preview-dest">${s(e.branch2)}</span>
                    </div>
                    ${c(e.id)}
                </div>
            </li>`}),t+=`</ol>`,t}async function xt(e,t,n){if(!B||B.couplets.length===0||B.errors.length>0){L(`⚠️ There is nothing valid to import yet.`,`error`);return}let r=H(`pt-import-title`)?.value.trim()||`Imported Key`;if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`))return;let i=e.getPersistedTitle();try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A local project named "${r}" already exists. Overwrite it with this import?`))return;let i={type:P,version:Te,title:r,data:{title:r,key:B.couplets,figures:B.figures}},a=e.importJsonData(i);if(!a.success){alert(`Failed to import parsed key:\n• ${a.errors.join(`
• `)}`);return}e.setTitle(r),t.setActiveProjectTitle(r),await e.saveToStorage(),L(`📥 Imported "${r}" from plain text (${B.stepCount} step(s)).`,`success`),vt(),n()}catch(n){console.error(`Plain text import failed:`,n),i&&(e.setTitle(i),t.setActiveProjectTitle(i)),A.clearStagedChanges(),L(`⚠️ The plain text import could not be completed.`,`error`)}}function St(e,t,n,r){let i=H(`pt-import-source`),a=H(`pt-import-file-hidden`);i?.addEventListener(`input`,()=>{V=null,U()},{signal:r}),[`pt-opt-min-dots`,`pt-opt-ws`,`pt-opt-join`,`pt-opt-dehyphen`,`pt-opt-lettered`,`pt-opt-dash`,`pt-opt-backref`,`pt-opt-fill`].forEach(e=>{let t=H(e);t?.addEventListener(`change`,()=>U(),{signal:r}),t?.addEventListener(`input`,()=>U(),{signal:r})}),H(`pt-import-load-file`)?.addEventListener(`click`,()=>{a?.click()},{signal:r}),a?.addEventListener(`change`,async e=>{let t=e.target.files?.[0];if(t)try{let e=await t.arrayBuffer();V=e;let{text:n,encoding:r,autoDetected:a}=rt(e,gt());i&&(i.value=n,U()),a&&L(`📥 Loaded "${t.name}" — detected ${et(r)} encoding.`,`success`);let o=H(`pt-import-title`);o&&!o.value.trim()&&(o.value=t.name.replace(/\.txt$/i,``).trim())}catch(e){console.error(`Failed to read plain text file:`,e),L(`⚠️ Could not read the selected file.`,`error`)}finally{e.target.value=``}},{signal:r}),H(`pt-import-encoding`)?.addEventListener(`change`,()=>{if(!V)return;let{text:e}=rt(V,gt());i&&(i.value=e,U())},{signal:r}),H(`pt-import-clear`)?.addEventListener(`click`,()=>{i&&(i.value=``),V=null,U(),i?.focus()},{signal:r}),H(`pt-import-close`)?.addEventListener(`click`,()=>vt(),{signal:r}),H(`pt-import-cancel`)?.addEventListener(`click`,()=>vt(),{signal:r}),H(`pt-import-confirm`)?.addEventListener(`click`,()=>{xt(e,t,n)},{signal:r}),H(z)?.addEventListener(`keydown`,e=>{e.key===`Escape`&&yt()&&(e.stopPropagation(),vt())},{signal:r})}var Ct=!1;function W(e){Ct||(Ct=!0,requestAnimationFrame(()=>{Ct=!1,e()}))}async function wt(e){let t=e.getTitle();ze(await A.getProjectList(),t)}function Tt(e){let{container:t,cardSelector:n,getDraggedId:r,setDraggedId:i,onDrop:a,signal:o}=e,s=null,c=null,l=null,u=0,d=()=>{s&&(s.classList.remove(`drag-drop-above`,`drag-drop-below`),s=null,c=null,l=null)},f=(e,r)=>{let i=r.closest(n);if(!i){d();return}let a=t.scrollTop;(s!==i||!l||u!==a)&&(l=i.getBoundingClientRect(),u=a);let o=e-l.top<l.height/2?`drag-drop-above`:`drag-drop-below`;if(s!==i||c!==o){let e=l;d(),i.classList.add(o),s=i,c=o,l=e}};t.addEventListener(`dragstart`,e=>{let t=e.target.closest(n);t&&(i(Number(t.getAttribute(`data-id`))),requestAnimationFrame(()=>{t.style.opacity=`0.4`}))},{signal:o}),t.addEventListener(`dragend`,e=>{let t=e.target.closest(n);t&&(t.style.opacity=`1`),i(null),d()},{signal:o}),t.addEventListener(`dragover`,e=>{if(r()===null)return;e.preventDefault();let n=t.getBoundingClientRect();e.clientY-n.top<80?t.scrollBy(0,-15):n.bottom-e.clientY<80&&t.scrollBy(0,15),f(e.clientY,e.target)},{signal:o}),t.addEventListener(`dragleave`,e=>{let n=e.relatedTarget;(!n||!t.contains(n))&&d()},{signal:o}),t.addEventListener(`drop`,e=>{e.preventDefault();let t=e.target.closest(n);if(!t)return;let i=r(),o=Number(t.getAttribute(`data-id`));i===null||i===o||a(i,o,t.classList.contains(`drag-drop-above`)?`above`:`below`)},{signal:o})}var Et=null;function Dt(){Et?.()}function Ot(e){Dt();let t=document.createElement(`div`);t.className=`popover`,t.setAttribute(`role`,`menu`);let n=e.items.map((e,t)=>`<button type="button" class="popover-action ${e.className??``}" data-item-index="${t}">${i(e.label)}</button>`).join(``);t.innerHTML=(e.headerHtml??``)+n,document.body.appendChild(t);let r=t.getBoundingClientRect(),a=Math.max(8,Math.min(e.x,window.innerWidth-r.width-8)),o=Math.max(8,Math.min(e.y,window.innerHeight-r.height-8));t.style.left=`${a}px`,t.style.top=`${o}px`;let s=new AbortController,{signal:c}=s,l=()=>{s.abort(),t.remove(),Et===l&&(Et=null),e.onClose?.()};return Et=l,document.addEventListener(`mousedown`,e=>{t.contains(e.target)||l()},{signal:c}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&(e.preventDefault(),l())},{signal:c}),window.addEventListener(`scroll`,l,{signal:c,capture:!0}),window.addEventListener(`resize`,l,{signal:c}),e.signal.addEventListener(`abort`,l,{signal:c}),t.addEventListener(`click`,t=>{let n=t.target,r=n.closest(`[data-step-id]`);if(r&&e.onCrumbSelect){let t=Number(r.getAttribute(`data-step-id`));l(),e.onCrumbSelect(t);return}let i=n.closest(`[data-item-index]`);if(i){let t=Number(i.getAttribute(`data-item-index`)),n=e.items[t];l(),n?.onSelect()}},{signal:c}),l}function kt(e){e.classList.remove(`nav-flash`),e.offsetWidth,e.classList.add(`nav-flash`);let t=()=>e.classList.remove(`nav-flash`);e.addEventListener(`animationend`,t,{once:!0}),window.setTimeout(t,1200)}function At(e){let t=document.querySelector(e);return t?(t.scrollIntoView({behavior:`smooth`,block:`center`}),kt(t),!0):!1}function jt(e,t){for(let n of[T(),w()]){let r;for(;(r=n.exec(e))!==null;){let e=r.index,n=r.index+r[0].length;if(t>=e&&t<=n)return{start:e,end:n,value:r[1].trim()}}}return null}function G(e){return At(`.key-card[data-id="${e}"]`)}function Mt(e,t){let{displayNumToFig:n,filenameToFig:r}=E(t.getFigures()),i=parseInt(e,10);return!isNaN(i)&&String(i)===e?n.get(i)?.id??null:r.get(e.toLowerCase())?.id??null}async function Nt(e,t,n,r,a,o){if(!n.isFiguresHidden&&At(`.figure-card[data-id="${e}"]`))return;let s=t.getFigures(),c=s.findIndex(t=>t.id===e);if(c===-1)return;let l=s[c],u=c+1,d=j.get(e)??null,f=null;if(!d){let n=await A.getFigureBinary(t.getActiveProjectUid(),e);n&&(d=URL.createObjectURL(n),f=d)}Ot({x:r,y:a,headerHtml:`<div class="popover-fig-title">Fig. ${u}</div>${d?`<img class="popover-fig-img" src="${d}" alt="${i(l.filename||`Figure ${u}`)}" />`:`<div class="popover-note">No image uploaded for this figure.</div>`}<div class="popover-fig-caption">${i(l.caption||l.filename||`Untitled figure`)}</div>`,items:[],signal:o,onClose:()=>{f&&URL.revokeObjectURL(f)}})}function Pt(e,n,r){document.addEventListener(`click`,i=>{if(!(i.ctrlKey||i.metaKey))return;let a=i.target,o=()=>{i.preventDefault(),i.stopPropagation()},s=a.closest(`.badge-link[data-step-id]`);if(s){o(),G(Number(s.getAttribute(`data-step-id`)));return}let c=a.closest(`.fig-ref[data-fig-id]`);if(c){o(),Nt(Number(c.getAttribute(`data-fig-id`)),e,n,i.clientX,i.clientY,r);return}let l=t=>t?e.getKey().find(e=>e.id===Number(t.getAttribute(`data-id`))):void 0,u=a.closest(`.input-destination`);if(u){let e=l(u.closest(`.key-card`)),n=e&&(u.dataset.field===`dest1`?e.branch1:e.branch2),r=n?t(n):null;r!==null&&(o(),G(r));return}let d=a.closest(`.print-dest`);if(d){let e=d.closest(`.print-row`),n=l(d.closest(`.print-step-block`)),r=n&&e&&(e.getAttribute(`data-choice`)===`1`?n.branch1:n.branch2),i=r?t(r):null;i!==null&&(o(),G(i));return}if(a instanceof HTMLTextAreaElement&&a.classList.contains(`card-textarea`)){let t=jt(a.value,a.selectionStart??-1);if(t){let a=Mt(t.value,e);a!==null&&(o(),Nt(a,e,n,i.clientX,i.clientY,r))}}},{signal:r,capture:!0})}function Ft(e,t,n){document.addEventListener(`contextmenu`,r=>{let a=r.target;if(a.closest(`input, textarea`))return;let o=a.closest(`.key-card`)||a.closest(`.print-step-block`);if(!o)return;let s=Number(o.getAttribute(`data-id`));if(!Number.isFinite(s))return;r.preventDefault();let c=e.getKey(),l=Oe(c,s),f=(u(c).get(s)??0)+1,p;if(!l.reachable)p=`<div class="popover-note">Step ${f} is unreachable from step 1.</div>`;else{let t=d(e.getFigures());p=`<div class="popover-path">${l.steps.map(n=>{let r=`${n.stepNum}${n.choice??``}`;if(n.choice===void 0)return`<div class="popover-path-row is-target"><span class="popover-path-num">${r}</span><span class="popover-path-text">(this step)</span></div>`;let a=c.find(e=>e.id===n.id),o=a?n.choice===`a`?a.alt1:a.alt2:``,s=e.resolveTextReferences(o,t).trim()||`(no description)`;return`<button type="button" class="popover-path-row" data-step-id="${n.id}"><span class="popover-path-num">${i(r)}</span><span class="popover-path-text">${i(s)}</span></button>`}).join(``)}</div>`}let m=[{label:`Go to step ${f}`,onSelect:()=>G(s)}];l.reachable&&l.steps.length>1&&m.push({label:`Select whole path`,onSelect:()=>{e.setSelectionBatch(l.steps.map(e=>e.id)),W(t)}}),Ot({x:r.clientX,y:r.clientY,headerHtml:p,items:m,onCrumbSelect:e=>G(e),signal:n})},{signal:n})}var It=null;function Lt(e,t,n){let r=document.getElementById(`key-title-input`);r&&r.addEventListener(`blur`,()=>{e.endTypingSession();let n=r.value.trim();if(!n){r.value=e.getTitle();return}e.setTitle(n),W(t)},{signal:n})}function Rt(e,t,n,r){e.addEventListener(`click`,e=>{let r=e.target,i=r.closest(`.btn-create-taxon`);if(i){let e=i.closest(`.key-card`),r=i.getAttribute(`data-for`);if(e&&(r===`dest1`||r===`dest2`)){let i=Number(e.getAttribute(`data-id`)),a=r===`dest1`?`branch1`:`branch2`,o=t.createTaxonForBranch(i,a);if(n(),o!==null){let e=`.taxon-card[data-id="${o}"]`;At(e),document.querySelector(`${e} input[data-field="scientificName"]`)?.focus()}}return}if(r.id===`editor-container`){t.clearSelection(),W(n);return}if(r.closest(`input, textarea`))return;let a=r.closest(`.key-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=e.ctrlKey||e.metaKey||e.shiftKey;t.toggleSelection(o,s),W(n)},{signal:r})}function zt(e,t,n,r,i){e.addEventListener(`input`,e=>{let i=e.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.key-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=i.getAttribute(`data-field`),c=`${o}-${s}`;t.setActiveCouplet(o),n.typing.couplets.start(c,()=>{t.endTypingSession()});let l={},d=i.value;if(s===`dest1`||s===`dest2`){let e=s===`dest1`?`branch1`:`branch2`,n=x(d,t.getKey());if(n.kind===`taxonDraft`){let e=ge(t.getTaxa(),n.name);e&&(n={kind:`taxon`,taxonId:e.id})}l[e]=n}else l[s]=d;t.updateCouplet(o,l),n.typing.couplets.extendTimeout(800,()=>{if(s!==`dest1`&&s!==`dest2`){let e=t.getKey().find(e=>e.id===o);if(e){let n=e[s],r=t.encodeFigureTokens(n);r!==n&&t.updateCouplet(o,{[s]:r})}}if(s===`dest1`||s===`dest2`){let e=t.getKey(),n=e.find(e=>e.id===o);if(n){let r=g(s===`dest1`?n.branch1:n.branch2,u(e),m(t.getTaxa(),`scientific`));i.classList.toggle(`input-error`,r.isUnresolved)}}W(r)})},{signal:i})}function Bt(e,t,n,r,i){e.addEventListener(`focusin`,e=>{let n=e.target;if(n.matches(`input, textarea`)){let e=n.closest(`.key-card`);if(!e)return;e.draggable=!1;let i=Number(e.getAttribute(`data-id`));t.setActiveCouplet(i),i!==It&&(It=i,W(r)),n.classList.contains(`input-destination`)&&n instanceof HTMLInputElement&&queueMicrotask(()=>{document.activeElement===n&&n.select()})}},{signal:i}),e.addEventListener(`focusout`,e=>{let i=e.target;if(i.matches(`input, textarea`)){let a=i.closest(`.key-card`);a&&(a.draggable=!0);let o=a?Number(a.getAttribute(`data-id`)):null,s=i.getAttribute(`data-field`),c=o&&s?`${o}-${s}`:null;n.typing.couplets.end(c,()=>{if(t.clearActiveCouplet(),s&&s!==`dest1`&&s!==`dest2`&&o!==null){let e=t.getKey().find(e=>e.id===o);if(e){let n=e[s],r=t.encodeFigureTokens(n);r!==n&&t.updateCouplet(o,{[s]:r})}}if(i.classList.contains(`input-error`)&&(i instanceof HTMLInputElement||i instanceof HTMLTextAreaElement)&&a){let e=i.value;L(`⚠️ Step "${e}" doesn't exist yet — kept as a pending link.`,`error`)}let n=e.relatedTarget,c=n instanceof Element&&n.closest(`.key-card`),l=c||n instanceof Element&&(n.closest(`.app-menu-bar`)||n.closest(`#add-couplet-btn`));c||(It=null),l||W(r)})}},{signal:i})}function Vt(e,t,n,r){Tt({container:e,cardSelector:`.key-card`,getDraggedId:()=>t.draggedCoupletId,setDraggedId:e=>e===null?t.stopDraggingCouplet():t.startDraggingCouplet(e),signal:r,onDrop:(e,r,i)=>{t.reorderCouplets(e,r,i),W(n)}})}function Ht(e,t){let n=e.addCouplet();t();let r=document.querySelector(`.key-card[data-id="${n}"]`)?.querySelector(`textarea[data-field="alt1"]`);r&&r.focus()}function Ut(e,t,n){let r,i=e.getSelectedCoupletIds(),a=e.getKey(),o=a.filter(e=>i.has(e.id));o.length>0?r=n===`below`?o[o.length-1].id:o[0].id:a.length>0&&(r=n===`above`?a[0].id:a[a.length-1].id),e.pasteCouplets(r,n)&&(L(`Pasted steps ${o.length>0?`${n} selection`:n===`above`?`at the beginning`:`at the end`}.`,`success`),W(t))}var K=null,q,Wt,Gt,J=1,Y=0,X=0,Kt=``,qt=null,Z=1,Jt=8,Yt=(e,t,n)=>Math.min(n,Math.max(t,e));function Xt(){let e=q.parentElement,t=Math.max(0,(q.offsetWidth*J-e.clientWidth)/2),n=Math.max(0,(q.offsetHeight*J-e.clientHeight)/2);Y=Yt(Y,-t,t),X=Yt(X,-n,n)}function Zt(){J<Z&&(J=Z),Xt(),q.style.transform=`translate(${Y}px, ${X}px) scale(${J})`,q.style.cursor=J>Z?`grab`:`default`,Gt.textContent=`${Math.round(J*100)}%`}function Qt(){J=1,Y=0,X=0,Zt()}function $t(e,t,n){let r=q.parentElement.getBoundingClientRect(),i=e-(r.left+r.width/2),a=t-(r.top+r.height/2),o=Yt(J*n,Z,Jt),s=o/J;Y=i*(1-s)+Y*s,X=a*(1-s)+X*s,J=o,Zt()}function en(){!K||K.style.display===`none`||(K.style.display=`none`,q.removeAttribute(`src`),document.body.style.overflow=Kt,qt?.focus?.(),qt=null)}function tn(){if(K)return;document.getElementById(`image-lightbox`)?.remove(),K=document.createElement(`div`),K.id=`image-lightbox`,K.className=`image-lightbox-overlay`,K.setAttribute(`role`,`dialog`),K.setAttribute(`aria-modal`,`true`),K.style.display=`none`,K.innerHTML=`
        <div class="image-lightbox-toolbar">
            <span class="image-lightbox-caption"></span>
            <span class="image-lightbox-spacer"></span>
            <button type="button" class="image-lightbox-btn" data-act="out" title="Zoom out">−</button>
            <span class="image-lightbox-zoom">100%</span>
            <button type="button" class="image-lightbox-btn" data-act="in" title="Zoom in">+</button>
            <button type="button" class="image-lightbox-btn" data-act="reset" title="Reset zoom">Reset</button>
            <button type="button" class="image-lightbox-btn image-lightbox-close" data-act="close" title="Close (Esc)">✕</button>
        </div>
        <div class="image-lightbox-stage">
            <img class="image-lightbox-img" alt="Figure" draggable="false" />
        </div>`,document.body.appendChild(K),q=K.querySelector(`.image-lightbox-img`),Wt=K.querySelector(`.image-lightbox-caption`),Gt=K.querySelector(`.image-lightbox-zoom`);let e=K.querySelector(`.image-lightbox-stage`);K.querySelector(`.image-lightbox-toolbar`).addEventListener(`click`,t=>{let n=t.target.closest(`button`)?.dataset.act;if(!n)return;let r=e.getBoundingClientRect(),i=r.left+r.width/2,a=r.top+r.height/2;n===`in`?$t(i,a,1.3):n===`out`?$t(i,a,1/1.3):n===`reset`?Qt():n===`close`&&en()}),e.addEventListener(`wheel`,e=>{e.preventDefault(),$t(e.clientX,e.clientY,e.deltaY<0?1.15:1/1.15)},{passive:!1}),e.addEventListener(`click`,t=>{t.target===e&&en()}),q.addEventListener(`dblclick`,e=>{J>Z?Qt():$t(e.clientX,e.clientY,2.5)});let t=!1,n=0,r=0;q.addEventListener(`pointerdown`,e=>{J<=Z||(t=!0,n=e.clientX,r=e.clientY,q.setPointerCapture(e.pointerId),q.style.cursor=`grabbing`)}),q.addEventListener(`pointermove`,e=>{t&&(Y+=e.clientX-n,X+=e.clientY-r,n=e.clientX,r=e.clientY,Zt())});let i=e=>{if(t){t=!1;try{q.releasePointerCapture(e.pointerId)}catch{}q.style.cursor=J>Z?`grab`:`default`}};q.addEventListener(`pointerup`,i),q.addEventListener(`pointercancel`,i),document.addEventListener(`keydown`,e=>{K&&K.style.display!==`none`&&e.key===`Escape`&&(e.stopPropagation(),en())})}function nn(e,t=``){tn(),K.style.display===`none`&&(Kt=document.body.style.overflow,document.body.style.overflow=`hidden`,qt=document.activeElement),K.setAttribute(`aria-label`,t||`Figure image viewer`),Wt.textContent=t,q.src=e,Qt(),K.style.display=`flex`,K.querySelector(`.image-lightbox-close`)?.focus()}var rn=`[fig: ]`,an=6,Q=null;function on(e){return e instanceof HTMLTextAreaElement&&(e.dataset.field===`alt1`||e.dataset.field===`alt2`)&&e.closest(`.key-card`)!==null}function sn(){let e=document.activeElement;return on(e)?{el:e,start:e.selectionStart??0,end:e.selectionEnd??0}:Q&&document.body.contains(Q.el)?Q:null}function cn(e,t,n){let r=e.value,i=Math.min(Math.max(t,0),r.length),a=Math.min(Math.max(n,i),r.length);e.value=r.slice(0,i)+rn+r.slice(a);let o=i+an;e.focus(),e.setSelectionRange(o,o),e.dispatchEvent(new Event(`input`,{bubbles:!0}))}function ln(e,t,n,r){let i=document.getElementById(`add-figure-btn`);i&&i.addEventListener(`click`,()=>{e.addFigure(``,``),W(n)},{signal:r});let a=document.getElementById(`figure-container`);if(!a)return;a.addEventListener(`input`,r=>{let i=r.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.figure-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=i.getAttribute(`data-field`),c=`fig-${o}-${s}`;t.typing.figures.start(c,()=>{e.endTypingSession()});let l={[s]:i.value};e.updateFigure(o,l),t.typing.figures.extendTimeout(800,()=>{W(n)})},{signal:r}),a.addEventListener(`click`,t=>{let r=t.target;if(r.classList.contains(`btn-trigger-upload`)){(r.closest(`.figure-card`)?.querySelector(`.hidden-file-picker`))?.click();return}if(r.classList.contains(`btn-remove-image`)){let t=r.closest(`.figure-card`);if(!t)return;let i=Number(t.getAttribute(`data-id`));e.updateFigure(i,{filename:``}),A.deleteFigureBinary(i);let a=j.get(i);a&&URL.revokeObjectURL(a),j.delete(i),W(n);return}if(r.classList.contains(`figure-preview-img`)&&!(t.ctrlKey||t.metaKey||t.shiftKey)){let e=r,t=e.currentSrc||e.getAttribute(`src`)||``;if(e.style.display!==`none`&&t){let n=e.closest(`.figure-card`);nn(t,[n?.querySelector(`.figure-card-title`)?.textContent?.trim()??``,n?.querySelector(`.figure-input-caption`)?.value??``].filter(Boolean).join(`  `));return}}if(r===a){e.clearFigureSelection(),W(n);return}let i=r.closest(`.figure-card`);if(!i)return;let o=Number(i.getAttribute(`data-id`)),s=t.ctrlKey||t.metaKey||t.shiftKey;if(r.closest(`input, textarea`)){i.classList.contains(`is-selected`)||(e.toggleFigureSelection(o,s),W(n));return}e.toggleFigureSelection(o,s),W(n)},{signal:r}),a.addEventListener(`focusout`,e=>{let r=e.target;if(r.matches(`input, textarea`)){let i=r.closest(`.figure-card`);if(!i)return;let a=Number(i.getAttribute(`data-id`)),o=r.getAttribute(`data-field`),s=a&&o?`fig-${a}-${o}`:null;t.typing.figures.end(s,()=>{let t=e.relatedTarget;t instanceof Element&&(t.closest(`.figure-card`)||t.closest(`.key-card`)||t.closest(`.app-menu-bar`)||t.closest(`#add-figure-btn`))||W(n)})}},{signal:r}),a.addEventListener(`change`,async t=>{let r=t.target;if(r.classList.contains(`hidden-file-picker`)){let t=r.files?.[0];if(!t)return;if(!t.type.startsWith(`image/`)){L(`⚠️ Only image files are supported.`,`error`),r.value=``;return}let i=r.closest(`.figure-card`),a=Number(i?.getAttribute(`data-id`));if(isNaN(a))return;e.updateFigure(a,{filename:t.name}),A.uploadFigureBinary(a,t);let o=j.get(a);o&&URL.revokeObjectURL(o);let s=URL.createObjectURL(t);j.set(a,s),r.value=``,W(n)}},{signal:r});let o=null;Tt({container:a,cardSelector:`.figure-card`,getDraggedId:()=>o,setDraggedId:e=>{o=e},signal:r,onDrop:(t,r,i)=>{let a=e.getFigures(),o=a.findIndex(e=>e.id===t),s=a.findIndex(e=>e.id===r);o===-1||s===-1||(s=i===`below`?o<s?s:s+1:o<s?s-1:s,o!==s&&(e.reorderFigures(o,s),W(n)))}})}function un(e,t){let n=e=>{if(on(e.target)){let t=e.target;Q={el:t,start:t.selectionStart??0,end:t.selectionEnd??0}}};[`focusout`,`keyup`,`mouseup`,`input`,`select`].forEach(r=>e.addEventListener(r,n,{signal:t})),document.querySelector(`#cmd-insert-figref`)?.addEventListener(`click`,()=>{let e=sn();if(!e){L(`Click into a key step description first, then insert a figure reference.`,`error`);return}cn(e.el,e.start,e.end)},{signal:t})}var dn=new Set([`scientificName`,`auctor`,`vernacularName`,`description`,`biology`,`distribution`]);function fn(e){return e.split(`
`).map(e=>e.trim()).filter(e=>e!==``)}function pn(e){return e.split(`
`).map(e=>{let t=e.indexOf(`|`);return{name:(t===-1?e:e.slice(0,t)).trim(),distinction:t===-1?``:e.slice(t+1).trim()}}).filter(e=>e.name!==``||e.distinction!==``)}function mn(e,t){return dn.has(e)?{[e]:t}:e===`synonyms`?{synonyms:fn(t)}:e===`confusables`?{confusables:pn(t)}:null}function hn(e,t,n,r){document.getElementById(`add-taxon-btn`)?.addEventListener(`click`,()=>{e.addTaxon(``),W(n)},{signal:r});let i=document.getElementById(`taxa-container`);if(!i)return;i.addEventListener(`input`,r=>{let i=r.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.taxon-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=i.getAttribute(`data-field`),c=`taxon-${o}-${s}`;t.typing.taxa.start(c,()=>e.endTypingSession());let l=mn(s,i.value);l&&e.updateTaxon(o,l),t.typing.taxa.extendTimeout(800,()=>{W(n)})},{signal:r}),i.addEventListener(`click`,t=>{let r=t.target;if(r===i){e.clearTaxonSelection(),W(n);return}let a=r.closest(`.taxon-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=t.ctrlKey||t.metaKey||t.shiftKey;if(r.closest(`input, textarea`)){a.classList.contains(`is-selected`)||(e.toggleTaxonSelection(o,s),W(n));return}e.toggleTaxonSelection(o,s),W(n)},{signal:r}),i.addEventListener(`focusout`,e=>{let r=e.target;if(!r.matches(`input, textarea`))return;let i=r.closest(`.taxon-card`);if(!i)return;let a=Number(i.getAttribute(`data-id`)),o=r.getAttribute(`data-field`),s=a&&o?`taxon-${a}-${o}`:null;t.typing.taxa.end(s,()=>{let t=e.relatedTarget;t instanceof Element&&(t.closest(`.taxon-card`)||t.closest(`.app-menu-bar`)||t.closest(`#add-taxon-btn`))||W(n)})},{signal:r});let a=null;Tt({container:i,cardSelector:`.taxon-card`,getDraggedId:()=>a,setDraggedId:e=>{a=e},signal:r,onDrop:(t,r,i)=>{let a=e.getTaxa(),o=a.findIndex(e=>e.id===t),s=a.findIndex(e=>e.id===r);o===-1||s===-1||(s=i===`below`?o<s?s:s+1:o<s?s-1:s,o!==s&&(e.reorderTaxa(o,s),W(n)))}})}function gn(e,t,n,r){let i=document.getElementById(`modal-shortcuts`),a=document.getElementById(`modal-options`),o=document.getElementById(`modal-about`),s=document.getElementById(`modal-open-project`),c=document.getElementById(`opt-lead-format`),l=document.getElementById(`opt-backref`),u=document.getElementById(`opt-name-display`),d=()=>{c?.querySelectorAll(`input[name="lead-format"]`).forEach(e=>{e.checked=e.value===t.leadFormat}),l&&(l.checked=t.showBackReference),u?.querySelectorAll(`input[name="name-display"]`).forEach(e=>{e.checked=e.value===t.nameDisplayMode})};c?.addEventListener(`change`,e=>{let r=e.target;r.name!==`lead-format`||!v(r.value)||(t.setLeadFormat(r.value),W(n))},{signal:r}),l?.addEventListener(`change`,()=>{t.setShowBackReference(l.checked),W(n)},{signal:r}),u?.addEventListener(`change`,e=>{let r=e.target;r.name!==`name-display`||!p(r.value)||(t.setNameDisplayMode(r.value),W(n))},{signal:r});let f=e=>{e.style.display=`flex`,e.querySelector(`button, input:not([disabled]), [tabindex]:not([tabindex="-1"])`)?.focus()};document.getElementById(`cmd-open-shortcuts`)?.addEventListener(`click`,()=>{f(i)},{signal:r}),document.getElementById(`cmd-open-options`)?.addEventListener(`click`,()=>{d(),f(a)},{signal:r}),document.getElementById(`cmd-open-about`)?.addEventListener(`click`,()=>{f(o)},{signal:r}),document.getElementById(`cmd-open-dialog`)?.addEventListener(`click`,async()=>{f(s),await wt(e)},{signal:r}),document.getElementById(`modal-shortcuts-close`)?.addEventListener(`click`,()=>{i.style.display=`none`},{signal:r}),document.getElementById(`modal-options-close`)?.addEventListener(`click`,()=>{a.style.display=`none`},{signal:r}),document.getElementById(`modal-about-close`)?.addEventListener(`click`,()=>{o.style.display=`none`},{signal:r}),document.getElementById(`modal-project-close`)?.addEventListener(`click`,()=>{s.style.display=`none`},{signal:r}),document.getElementById(`project-hub-list`)?.addEventListener(`click`,async t=>{let r=t.target,i=r.closest(`.hub-item-clickable-zone`),a=r.closest(`.btn-hub-delete`);if(i){let t=i.getAttribute(`data-name`);if(!t||e.hasUnsavedChanges()&&!confirm(`Your current key has unsaved tracking changes. Are you sure you want to discard them to switch workspaces?`))return;try{await e.loadProject(t),s.style.display=`none`,L(`📂 Swapped to workspace: "${t}"`,`success`),W(n)}catch(e){console.error(`Failed to load workspace safely:`,e),L(`⚠️ Could not open selected project database entries.`,`error`)}return}if(a){t.stopPropagation();let r=a.getAttribute(`data-name`);if(!r)return;let i=`Are you sure you want to permanently delete the workspace "${r}"?\nThis wipes it from your browser database.`;if(confirm(i))try{if(await A.deleteProject(r),L(`🗑️ Workspace "${r}" deleted.`,`success`),e.getTitle()===r){let t=await A.getProjectList();t.length>0?await e.loadProject(t[0].name):await e.createNewProject(`Untitled Key`)}await wt(e),W(n)}catch(e){console.error(`Failed to execute database deletion sequence:`,e),L(`⚠️ Failed to delete workspace from database.`,`error`)}}},{signal:r}),document.getElementById(`btn-hub-import`)?.addEventListener(`click`,()=>{document.querySelector(`#file-import-hidden`)?.click()},{signal:r})}var _n=`
    /* FIGURE ZOOM LIGHTBOX (on-screen only) */
    .print-fig-img { cursor: zoom-in; }
    .image-lightbox-overlay {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: none;
      flex-direction: column;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(4px);
    }
    .image-lightbox-toolbar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border-light);
    }
    .image-lightbox-caption { font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .image-lightbox-spacer { flex: 1 1 auto; }
    .image-lightbox-zoom { min-width: 3.5em; text-align: center; font-variant-numeric: tabular-nums; font-size: 12px; color: var(--color-text-muted); }
    .image-lightbox-btn {
      background: var(--color-bg-muted);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }
    .image-lightbox-btn:hover { background: var(--color-border-light); }
    .image-lightbox-close { font-weight: 700; }
    .image-lightbox-stage { flex: 1 1 auto; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .image-lightbox-img { max-width: 100%; max-height: 100%; user-select: none; transform-origin: center center; will-change: transform; }

    @media print {
      .image-lightbox-overlay { display: none !important; }
      .print-fig-img { cursor: auto; }
    }`,vn=`
(function () {
  var MIN_SCALE = 1, MAX_SCALE = 8;
  var overlay = null, imgEl = null, captionEl = null, zoomLabel = null, stage = null;
  var scale = 1, tx = 0, ty = 0;
  var prevBodyOverflow = '';

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function clampTranslate() {
    var overflowX = Math.max(0, (imgEl.offsetWidth * scale - stage.clientWidth) / 2);
    var overflowY = Math.max(0, (imgEl.offsetHeight * scale - stage.clientHeight) / 2);
    tx = clamp(tx, -overflowX, overflowX);
    ty = clamp(ty, -overflowY, overflowY);
  }

  function apply() {
    if (scale < MIN_SCALE) scale = MIN_SCALE;
    clampTranslate();
    imgEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
    imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  }

  function reset() { scale = 1; tx = 0; ty = 0; apply(); }

  function zoomAt(clientX, clientY, factor) {
    var rect = stage.getBoundingClientRect();
    var cx = clientX - (rect.left + rect.width / 2);
    var cy = clientY - (rect.top + rect.height / 2);
    var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    var ratio = newScale / scale;
    tx = cx * (1 - ratio) + tx * ratio;
    ty = cy * (1 - ratio) + ty * ratio;
    scale = newScale;
    apply();
  }

  function close() {
    if (!overlay || overlay.style.display === 'none') return;
    overlay.style.display = 'none';
    imgEl.removeAttribute('src');
    document.body.style.overflow = prevBodyOverflow;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'image-lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="image-lightbox-toolbar">' +
        '<span class="image-lightbox-caption"></span>' +
        '<span class="image-lightbox-spacer"></span>' +
        '<button type="button" class="image-lightbox-btn" data-act="out" title="Zoom out">&#8722;</button>' +
        '<span class="image-lightbox-zoom">100%</span>' +
        '<button type="button" class="image-lightbox-btn" data-act="in" title="Zoom in">+</button>' +
        '<button type="button" class="image-lightbox-btn" data-act="reset" title="Reset zoom">Reset</button>' +
        '<button type="button" class="image-lightbox-btn image-lightbox-close" data-act="close" title="Close (Esc)">&#10005;</button>' +
      '</div>' +
      '<div class="image-lightbox-stage">' +
        '<img class="image-lightbox-img" alt="Figure" draggable="false" />' +
      '</div>';
    document.body.appendChild(overlay);

    imgEl = overlay.querySelector('.image-lightbox-img');
    captionEl = overlay.querySelector('.image-lightbox-caption');
    zoomLabel = overlay.querySelector('.image-lightbox-zoom');
    stage = overlay.querySelector('.image-lightbox-stage');

    overlay.querySelector('.image-lightbox-toolbar').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      var act = btn && btn.dataset.act;
      if (!act) return;
      var r = stage.getBoundingClientRect();
      var midX = r.left + r.width / 2, midY = r.top + r.height / 2;
      if (act === 'in') zoomAt(midX, midY, 1.3);
      else if (act === 'out') zoomAt(midX, midY, 1 / 1.3);
      else if (act === 'reset') reset();
      else if (act === 'close') close();
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });

    imgEl.addEventListener('dblclick', function (e) {
      if (scale > MIN_SCALE) reset(); else zoomAt(e.clientX, e.clientY, 2.5);
    });

    var dragging = false, lastX = 0, lastY = 0;
    imgEl.addEventListener('pointerdown', function (e) {
      if (scale <= MIN_SCALE) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      imgEl.setPointerCapture(e.pointerId);
      imgEl.style.cursor = 'grabbing';
    });
    imgEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      tx += e.clientX - lastX; ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      apply();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { imgEl.releasePointerCapture(e.pointerId); } catch (err) {}
      imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    }
    imgEl.addEventListener('pointerup', endDrag);
    imgEl.addEventListener('pointercancel', endDrag);

    document.addEventListener('keydown', function (e) {
      if (overlay && overlay.style.display !== 'none' && e.key === 'Escape') { e.stopPropagation(); close(); }
    });
  }

  function open(src, caption) {
    ensureOverlay();
    if (overlay.style.display === 'none' || !overlay.style.display) {
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    overlay.setAttribute('aria-label', caption || 'Figure image viewer');
    captionEl.textContent = caption || '';
    imgEl.src = src;
    reset();
    overlay.style.display = 'flex';
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest('.print-fig-img');
    if (!img || !img.getAttribute('src')) return;
    open(img.getAttribute('src'), img.getAttribute('data-caption') || '');
  });
})();`;function yn(e){let t=i(e.printText);return e.printClass===`print-dest-taxon`||e.printClass===`print-dest-taxon-unlinked`?`<strong class="print-dest-taxon">${t}</strong>`:e.printClass===`print-dest-strong`?`<strong class="print-dest-strong">${t}</strong>`:e.printClass===`error-text`?`<span class="error-text">${t}</span>`:`<span>${t}</span>`}async function bn(e,t,n,r){try{let o=e.getActiveProjectUid(),s=e.getKey(),c=e.getFigures(),l=e.getTitle(),f=u(s),p=d(c),h=n?y(s):null,_=e.getTaxa(),v=m(_,r),x=(await Promise.all(c.map(async(e,t)=>{let n=t+1,r=``;try{let t=await A.getFigureBinary(o,e.id);t&&(r=`<img class="print-fig-img" src="${await ee(t)}" alt="Figure ${n}" data-caption="${i(`Fig. ${n}${e.caption?`: ${e.caption}`:``}`)}" />`)}catch(t){console.warn(`Could not resolve binary payload stream for figure ID ${e.id}:`,t)}let a=i(e.caption||e.filename||`Untitled Asset`);return`
                    <div class="print-fig-card">
                        ${r}
                        <div class="print-fig-caption">
                            <strong>Fig. ${n}:</strong> ${a}
                        </div>
                    </div>
                `}))).join(``),C=``,w=0;s.length===0&&(C=`<p class="print-empty-notice">[The identification key is currently empty. Add couplets in the editor to populate this document.]</p>`);for(let n=0;n<s.length;n++){let r=s[n],a=n+1,o=g(r.branch1,f,v),c=g(r.branch2,f,v),l=yn(o),u=yn(c),d=e.resolveTextReferences(r.alt1,p)||`___`,m=e.resolveTextReferences(r.alt2,p)||`___`,{lead1:_,lead2:y}=b(t,a,h?.get(r.id));w=Math.max(w,_.length,y.length),C+=`
            <div class="print-couplet" role="group" aria-label="Couplet ${a}">
                <div class="print-step-num">${i(_)}</div>
                <div class="print-row">
                  <span class="print-text">${i(d)}</span>
                  <span class="print-dest">${l}</span>
                </div>
                <div class="print-dash">${i(y)}</div>
                <div class="print-row">
                  <span class="print-text">${i(m)}</span>
                  <span class="print-dest">${u}</span>
                </div>
            </div>
            `}let T=``;if(_.length>0){let e=e=>i(e).replace(/\n/g,`<br>`),t=(e,t)=>`<p class="print-taxon-field"><strong>${e}:</strong> ${t}</p>`;T=`<h2 class="print-taxa-heading">Taxa</h2>${_.map(n=>{let r=`<div class="print-taxon"><h3 class="print-taxon-name"><em>${i(n.scientificName||`Untitled taxon`)}</em>${n.auctor?` <span class="print-taxon-auctor">${i(n.auctor)}</span>`:``}</h3>`;if(n.vernacularName&&(r+=`<p class="print-taxon-field">${i(n.vernacularName)}</p>`),n.synonyms.length>0&&(r+=t(`Synonyms`,n.synonyms.map(e=>`<em>${i(e)}</em>`).join(`; `))),n.description&&(r+=t(`Description`,e(n.description))),n.biology&&(r+=t(`Biology`,e(n.biology))),n.distribution&&(r+=t(`Distribution`,e(n.distribution))),n.confusables.length>0){let e=n.confusables.map(e=>`<li><em>${i(e.name)}</em>${e.distinction?` — ${i(e.distinction)}`:``}</li>`).join(``);r+=`<div class="print-taxon-field"><strong>Confusable species:</strong><ul class="print-confusables">${e}</ul></div>`}return r+`</div>`}).join(``)}`}let E=c.length>0?` layout-has-figures`:``,D=`${Math.max(w,3)}ch`;a(xn(l,C,T,x,E,t,D),S(l,`.html`),`text/html;charset=utf-8;`)}catch(e){console.error(`HTML Export layout compilation system failure:`,e),L(`❌ An unexpected error disrupted the HTML file compilation pipeline.`,`error`)}}function xn(e,t,n,r,a,o,s){let c=i(e);return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${c}</title>
  <style>
    :root {
      --color-bg: #ffffff;
      --color-bg-muted: #f8fafc;
      --color-text: #0f172a;
      --color-text-muted: #475569;
      --color-border: #cbd5e1;
      --color-border-light: #e2e8f0;
      --color-primary: #4f46e5;
      --radius-md: 6px;
      --radius-lg: 8px;
    }

    html, body { 
      margin: 0;
      padding: 0;
      min-height: 100vh;
      overflow: auto;
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: inherit;
    }

    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      color: var(--color-text); 
      background: var(--color-bg-muted);
    }

    .print-page-layout { 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 24px;
      height: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .print-key-column { 
      width: 100%; 
      display: flex;
      flex-direction: column;
    }
    
    .print-figures-column { 
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    @media (min-width: 768px) {
      html, body {
        height: 100vh;
        overflow: hidden;
      }
      .print-page-layout {
        height: 100vh;
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        align-items: stretch;
      }
      .print-key-column,
      .print-figures-column {
        height: 100%;
        overflow-y: auto;
      }
    }
    
    .print-key-container { 
      flex: 1;
      display: flex; 
      flex-direction: column; 
      gap: 6px; 
      background: var(--color-bg);
      border: 1px solid var(--color-border); 
      border-radius: var(--radius-lg);
      padding: 25px;
      font-family: serif;
      font-size: 15px;
      line-height: 1.6;
    }

    @media (min-width: 768px) {
      .print-key-container {
        overflow-y: auto;
        min-height: 0;
      }
    }

    /* Phones: reclaim the heavy padding so the single column fills the screen. */
    @media (max-width: 767px) {
      .print-page-layout { padding: 12px; gap: 12px; }
      .print-key-container { padding: 16px; }
    }

    .print-couplet {
      display: grid;
      grid-template-columns: var(--lead-col, 2.5em) 1fr;
      gap: 6px 10px;
      align-items: start; 
      break-inside: avoid; 
      page-break-inside: avoid; 
      padding-bottom: 8px;
    }
    .print-couplet:last-child { padding-bottom: 0; }
    
    .print-step-num { font-weight: bold; color: var(--color-text); }
    .print-dash { font-weight: bold; text-align: center; color: var(--color-text); }
    /* Lettered/minimal leads read better flush-left, aligned under the step number. */
    .print-page-layout[data-lead-format="lettered"] .print-dash,
    .print-page-layout[data-lead-format="minimal"] .print-dash { text-align: left; }
    
    .print-row {
      display: block; 
      width: 100%;
      position: relative;
      line-height: 1.6;
      background-image: linear-gradient(to right, var(--color-text) 33%, transparent 33%);
      background-repeat: repeat-x;
      background-position: left 0 bottom 0.35em; 
      background-size: 6px 1px;
    }
    
    .print-text {
      display: inline;                  
      white-space: pre-wrap;
      background-color: var(--color-bg);
      padding-right: 6px;
    }
    
    .print-dest {
      float: right;                     
      white-space: nowrap;
      background-color: var(--color-bg); 
      padding-left: 6px;                 
      line-height: inherit;
    }
    
    .print-doc-title { font-family: serif; font-size: 22px; font-weight: bold; text-align: center; margin: 0 0 16px 0; color: var(--color-text); }
    .print-empty-notice { font-style: italic; color: var(--color-text-muted); text-align: center; }

    .print-dest-strong { font-weight: bold; color: var(--color-text); }
    .print-dest-taxon { font-weight: bold; font-style: italic; color: var(--color-text); }
    .error-text { font-weight: bold; color: #ef4444; }

    /* TAXA CHAPTERS */
    .print-taxa-heading { font-family: serif; font-size: 20px; font-weight: bold; margin: 24px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
    .print-taxon { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
    .print-taxon-name { font-family: serif; font-size: 20px; margin: 0 0 4px 0; }
    .print-taxon-auctor { font-weight: normal; font-size: 0.6em; color: var(--color-text-muted); }
    .print-taxon-field { margin: 2px 0; font-size: 14px; line-height: 1.5; }
    .print-confusables { margin: 2px 0; padding-left: 20px; }

    /* FIGURES SUB-ELEMENT PANELS */
    .print-fig-card {
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md);
      padding: 16px;
      background: var(--color-bg);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .print-fig-img { display: block; max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius-md); margin: 0 auto 12px auto; }
    .print-fig-caption { font-family: sans-serif; font-size: 13px; color: var(--color-text); line-height: 1.5; text-align: left; }
    
    @media print {
      html, body { height: auto; overflow: visible; }
      body { padding: 0; margin: 0; background: transparent; }
      .print-page-layout { height: auto; padding: 0; overflow: visible; display: block; }
      .print-page-layout.layout-has-figures { display: grid; grid-template-columns: 1fr 260px; gap: 30px; height: auto; }
      .print-key-column { height: auto; overflow: visible; }
      .print-figures-column { height: auto; max-height: none; overflow-y: visible; position: relative; top: 0; }
      .print-key-container { border: none; padding: 0; box-shadow: none; height: auto; overflow: visible; }
      .print-fig-card { box-shadow: none; border-color: var(--color-border); }
    }
${_n}
  </style>
</head>
<body>
  <div class="print-page-layout${a}" data-lead-format="${o}" style="--lead-col: ${s}">
    <div class="print-key-column">
      <div class="print-key-container">
        <h1 class="print-doc-title">${c}</h1>
        ${t}
        ${n}
      </div>
    </div>
    <div class="print-figures-column">
      ${r}
    </div>
  </div>
  <script>${vn}<\/script>
</body>
</html>`}function $(e){return e?e.replace(/[\r\n]+/g,` `).replace(/\\/g,`___TSKEY_LATEX_BACKSLASH___`).replace(/([&%$#_{}])/g,`\\$1`).replace(/~/g,`\\textasciitilde{}`).replace(/\^/g,`\\textasciicircum{}`).replace(/</g,`\\textless{}`).replace(/>/g,`\\textgreater{}`).replace(/___TSKEY_LATEX_BACKSLASH___/g,`\\textbackslash{}`):``}function Sn(e,t){return`\\makebox[${t}][l]{\\textbf{${$(e).replace(/—/g,`\\textemdash{}`)}}}`}function Cn(e,t,n,r){try{let i=e.getKey(),o=e.getFigures(),s=e.getTitle(),c=u(i),l=d(o),f=n?y(i):null,p=e.getTaxa(),h=m(p,r),_=n?`4.5em`:`2.5em`,v=w(),x=e=>e.replace(v,(e,t)=>{let n=parseInt(t,10),r=l.get(n);return r===void 0?e:` (Fig.~${r})`}),C=``;if(i.length===0)C=`
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add key steps in the editor to populate this document.]}
\\end{center}`;else{let e=``;i.forEach((n,r)=>{let i=r+1,a=e=>e.printClass===`print-dest-taxon`||e.printClass===`print-dest-taxon-unlinked`?`\\mbox{\\textbf{\\textit{${$(e.printText)}}}}`:e.printClass===`print-dest-strong`?`\\mbox{\\textbf{${$(e.printText)}}}`:`\\dots`,o=a(g(n.branch1,c,h)),s=a(g(n.branch2,c,h)),l=x($(n.alt1)),u=x($(n.alt2)),{lead1:d,lead2:p}=b(t,i,f?.get(n.id));e+=`{\\interlinepenalty=10000
`,e+=`\\noindent\\hangindent=${_}\\hangafter=1${Sn(d,_)}${l}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${o}\\par\\nopagebreak\n`,e+=`\\noindent\\hangindent=${_}\\hangafter=1${Sn(p,_)}${u}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${s}\\par}\n`,e+=`\\vspace{0.6em}

`}),C=`
{
\\setlength{\\parfillskip}{0pt}
${e}
\\par
}`}let T=[],E=``;o.length>0&&(E+=`\\newpage
\\section*{Figures Appendix}
`,E+=`\\textit{Instructions: Create a folder named \\texttt{figures} in the same directory as this \\texttt{.tex} file, and place the corresponding image files inside it before compiling.}
\\vspace{1.5em}

`,o.forEach((e,t)=>{let n=t+1,r=$(e.caption||`Figure ${n}`);E+=`\\begin{figure}[htbp]
`,E+=`  \\centering
`;let i=e.filename.trim();i?(E+=`  \\includegraphics[width=0.7\\linewidth]{\\detokenize{figures/${i}}}\n`,(/\s/.test(i)||(i.match(/\./g)?.length??0)>1)&&T.push(i)):E+=`  \\framebox[0.7\\linewidth]{\\vbox{\\vspace{1.5cm}\\centering\\textbf{[Image Placeholder]}\\par\\vspace{0.5em}\\small No filename provided in data store\\vspace{1.5cm}}}
`,E+=`  \\caption{${r}}\n`,E+=`  \\label{fig:${n}}\n`,E+=`\\end{figure}

`}));let D=``;if(p.length>0){let e=``,t=(e,t)=>`\\noindent\\textbf{${e}:} ${$(t)}\\par\n`;p.forEach(n=>{let r=$(n.scientificName||`Untitled taxon`),i=n.auctor?` {\\small ${$(n.auctor)}}`:``;e+=`\\subsection*{\\textit{${r}}${i}}\n`,n.vernacularName&&(e+=`\\noindent ${$(n.vernacularName)}\\par\n`),n.synonyms.length>0&&(e+=t(`Synonyms`,n.synonyms.join(`; `))),n.description&&(e+=t(`Description`,n.description)),n.biology&&(e+=t(`Biology`,n.biology)),n.distribution&&(e+=t(`Distribution`,n.distribution)),n.confusables.length>0&&(e+=`\\noindent\\textbf{Confusable species:}\\par
`,e+=`\\begin{itemize}
`,n.confusables.forEach(t=>{let n=t.distinction?` --- ${$(t.distinction)}`:``;e+=`  \\item ${$(t.name)}${n}\n`}),e+=`\\end{itemize}
`),e+=`\\vspace{0.8em}

`}),D=`\\newpage\n\\section*{Taxa}\n${e}`}a(`% =========================================================================
% LaTeX Dichotomous Key Export
% Companion Directory Configuration Notice:
% Create a directory called "figures/" alongside this file and ensure 
% your referenced image filenames match exactly to build the final document.
% =========================================================================

\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}
\\usepackage{parskip}
\\usepackage{graphicx} % Package to handle external image file parsing natively

\\title{\\textbf{${$(s)}}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${C}
${D}
${E}
\\end{document}`,S(s,`.tex`),`application/x-latex;charset=utf-8;`),T.length>0&&L(`⚠️ ${T.length} image filename(s) contain spaces or multiple dots and may fail to compile in LaTeX. Consider renaming: ${T.join(`, `)}`,`error`)}catch(e){console.error(`LaTeX Export system failure:`,e),L(`❌ An unexpected error disrupted the LaTeX document generation pipeline.`,`error`)}}function wn(e,t,n,r){try{let i=e.getKey(),o=e.getFigures(),s=u(i),c=d(o),l=n?y(i):null,f=e.getTaxa(),p=m(f,r),h=``;h+=`${e.getTitle()}\n\n`,i.length===0&&(h+=`[The identification key is currently empty. Add key steps in the editor to populate this document.]

`),i.forEach((n,r)=>{let i=r+1,a=g(n.branch1,s,p).printText,o=g(n.branch2,s,p).printText,u=e.resolveTextReferences(n.alt1,c)||`___`,d=e.resolveTextReferences(n.alt2,c)||`___`,{lead1:f,lead2:m}=b(t,i,l?.get(n.id));h+=`${f}\t${u}\t${a}\n`,h+=`${m}\t${d}\t${o}\n\n`}),f.length>0&&(h+=`========================================
`,h+=`TAXA
`,h+=`========================================

`,f.forEach((e,t)=>{let n=t+1,r=e.scientificName||`Untitled taxon`;h+=`${n}. ${r}${e.auctor?` `+e.auctor:``}\n`,e.vernacularName&&(h+=`  Vernacular name: ${e.vernacularName}\n`),e.synonyms.length>0&&(h+=`  Synonyms: ${e.synonyms.join(`; `)}\n`),e.description&&(h+=`  Description: ${e.description}\n`),e.biology&&(h+=`  Biology: ${e.biology}\n`),e.distribution&&(h+=`  Distribution: ${e.distribution}\n`),e.confusables.length>0&&(h+=`  Confusable species:
`,e.confusables.forEach(e=>{h+=`    - ${e.name}${e.distinction?` — ${e.distinction}`:``}\n`})),h+=`
`})),o.length>0&&(h+=`========================================
`,h+=`FIGURES DATA
`,h+=`========================================

`,o.forEach((e,t)=>{let n=t+1,r=e.filename||`Untitled File`,i=e.caption||`No caption provided.`;h+=`Figure #${n}\n`,h+=`  Filename: ${r}\n`,h+=`  Caption:  ${i}\n\n`})),a(h,S(e.getTitle(),`.txt`),`text/plain;charset=utf-8;`)}catch(e){console.error(`Plain Text Export system failure:`,e),L(`❌ An unexpected error disrupted the plain text document generation pipeline.`,`error`)}}async function Tn(e){try{let t=e.getFigures(),n=[],r=e.getActiveProjectUid();for(let e of t){let t=await A.getFigureBinary(r,e.id),i=null;t&&(i=await ee(t)),n.push({...e,binaryData:i})}let i={metadata:{application:P,version:Te,exportedAt:new Date().toISOString()},title:e.getTitle(),data:{title:e.getTitle(),key:e.getKey(),figures:n,taxa:e.getTaxa()}};a(JSON.stringify(i,null,2),S(e.getTitle(),`.tskey`),`application/json`)}catch(e){console.error(`JSON (.tskey) export system failure:`,e),L(`❌ An unexpected error disrupted the .tskey file export.`,`error`)}}function En(e,t,n,r){let i=document.getElementById(`modal-open-project`);document.querySelector(`#cmd-new`)?.addEventListener(`click`,async()=>{if(e.hasUnsavedChanges()&&!confirm(`You have unsaved workspace changes. Discard and make a brand new project memory space?`))return;let t=prompt(`Enter name/title for the new key:`,`Untitled Key`);if(t===null)return;let r=t.trim()||`Untitled Key`;try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Do you want to wipe it out and start fresh?`))return;await e.createNewProject(r),L(`📄 New workspace "${r}" initiated!`,`success`),W(n)}catch(e){console.error(`Failed to initialize a new project workspace safely: `,e),L(`⚠️ Could not initialize database workspace entries.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save-as`)?.addEventListener(`click`,async()=>{let t=e.getTitle(),r=prompt(`Save current configuration under a new title:`,t);if(r===null)return;let i=r.trim();if(!i){L(`⚠️ Invalid project title.`,`error`);return}try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===i.toLowerCase())&&!confirm(`A project named "${i}" already exists. Do you want to overwrite it?`))return;await e.saveAsProject(i),L(`💾 Saved workspace as "${i}"`,`success`),W(n)}catch{L(`⚠️ Save As operation failed.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save`)?.addEventListener(`click`,async()=>{let t=e.getPersistedTitle(),r=e.getTitle();try{if(t&&t!==r&&(await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Overwrite it?`))return;await e.saveToStorage(),L(t&&t!==r?`💾 Renamed and saved workspace as "${r}"`:`💾 Changes saved successfully!`,`success`),W(n)}catch(n){console.error(`Atomic save/rename failed:`,n),t&&t!==r&&e.setTitle(t),L(`⚠️ Save failed. Your changes were kept in memory.`,`error`)}},{signal:r}),document.querySelector(`#cmd-export-json`)?.addEventListener(`click`,()=>{Tn(e)},{signal:r});let a=document.querySelector(`#file-import-hidden`),o=!1;a?.addEventListener(`change`,async t=>{let r=t.target.files?.[0];if(!r)return;if(o){L(`⚠️ An import is currently in progress. Please wait.`,`error`),a&&(a.value=``);return}if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`)){a&&(a.value=``);return}let s=e.getPersistedTitle();try{o=!0;let t=await r.text(),s=JSON.parse(t),c=`Untitled Imported Key`;if(s&&typeof s.title==`string`&&s.title.trim()?c=s.title.trim():r.name&&(c=r.name.replace(/\.tskey$/i,``).trim()),(await A.getProjectList()).some(e=>e.name.toLowerCase()===c.toLowerCase())&&!confirm(`A local project named "${c}" already exists. Do you want to completely overwrite it with this import file?`)){a&&(a.value=``);return}let l=e.importJsonData(s);if(!l.success){alert(`Failed to import JSON schema:\n• ${l.errors.join(`
• `)}`),a&&(a.value=``);return}e.setTitle(c);let u=[];if(l.importedFigures&&l.importedFigures.length>0){for(let e of l.importedFigures)if(e.binaryData)try{let t=await(await fetch(e.binaryData)).blob();A.uploadFigureBinary(e.id,t);let n=j.get(e.id);n&&URL.revokeObjectURL(n);let r=URL.createObjectURL(t);j.set(e.id,r)}catch(t){console.error(`Failed to parse binary data for figure ${e.id}:`,t),u.push(e.id)}}await e.saveToStorage(),u.length===0?L(`📥 Imported workspace "${c}" successfully!`,`success`):(L(`⚠️ Workspace imported, but ${u.length} image(s) failed.`,`error`),alert(`Workspace "${c}" was loaded, but the following figure IDs encountered binary errors or corruption and could not be recovered:\n\n• Figure ID(s): ${u.join(`, `)}\n\nPlease try re-uploading these specific images in the editor.`)),i&&i.style.display===`flex`&&await wt(e),W(n)}catch(t){console.error(`Import processing error:`,t),s&&e.setTitle(s),A.clearStagedChanges(),alert(`Malformed JSON structure: Unable to parse file stream.`)}finally{o=!1,a&&(a.value=``)}},{signal:r}),document.querySelector(`#cmd-trigger-import`)?.addEventListener(`click`,()=>{if(o){L(`⚠️ An import is currently in progress. Please wait.`,`error`);return}a?.click()},{signal:r}),document.querySelector(`#cmd-import-text`)?.addEventListener(`click`,()=>{if(o){L(`⚠️ An import is currently in progress. Please wait.`,`error`);return}_t()},{signal:r}),document.querySelector(`#cmd-export-text`)?.addEventListener(`click`,()=>wn(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r}),document.querySelector(`#cmd-export-html`)?.addEventListener(`click`,()=>bn(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r}),document.querySelector(`#cmd-export-latex`)?.addEventListener(`click`,()=>Cn(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r})}function Dn(e,t,n,r){document.querySelector(`#cmd-undo`)?.addEventListener(`click`,()=>{t.typing.clearAll(),e.undo()&&W(n)},{signal:r}),document.querySelector(`#cmd-redo`)?.addEventListener(`click`,()=>{t.typing.clearAll(),e.redo()&&W(n)},{signal:r}),document.querySelector(`#cmd-cut`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&confirm(`Confirm cutting ${t} highlighted step(s) to clipboard?`)&&(e.cutSelectedCouplets(),L(`Cut ${t} step(s) to clipboard.`,`success`),W(n))},{signal:r}),document.querySelector(`#cmd-copy`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&(e.copySelectedCouplets(),L(`Copied ${t} step(s) to clipboard.`,`success`),W(n))},{signal:r}),document.querySelector(`#cmd-paste-above`)?.addEventListener(`click`,()=>{Ut(e,n,`above`)},{signal:r}),document.querySelector(`#cmd-paste-below`)?.addEventListener(`click`,()=>{Ut(e,n,`below`)},{signal:r}),document.querySelector(`#cmd-delete`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size,r=e.getSelectedFigureIds().size,i=e.getSelectedTaxonIds().size;if(i>0&&confirm(`Confirm removing highlighted taxa? Any key leads pointing at them will be cleared.`)&&(e.deleteSelectedTaxa(),L(`Deleted ${i} taxon(a).`,`success`),W(n)),t>0&&confirm(`Confirm removing highlighted key steps?`)&&(e.deleteSelectedCouplets(),L(`Deleted ${t} step(s).`,`success`),W(n)),r>0&&confirm(`Confirm removing highlighted figures?`)){let t=new Set(e.getSelectedFigureIds());e.deleteSelectedFigures(),t.forEach(e=>{A.deleteFigureBinary(e);let t=j.get(e);t&&URL.revokeObjectURL(t),j.delete(e)}),L(`Deleted ${r} figure(s).`,`success`),W(n)}},{signal:r}),document.querySelector(`#cmd-swap`)?.addEventListener(`click`,()=>{e.getSelectedCoupletIds().size>0&&e.swapSelectedCouplets()&&(L(`Swapped choice configurations.`,`success`),W(n))},{signal:r});let i=()=>Ht(e,n);document.querySelector(`#cmd-add`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#add-couplet-btn`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#cmd-clear`)?.addEventListener(`click`,()=>{e.clearSelection(),e.clearFigureSelection(),e.clearTaxonSelection(),W(n)},{signal:r}),document.querySelector(`#cmd-select-all`)?.addEventListener(`click`,()=>{e.selectAll(),W(n)},{signal:r}),document.querySelector(`#cmd-toggle-figures`)?.addEventListener(`click`,()=>{t.toggleFigures(),W(n)},{signal:r}),document.querySelector(`#cmd-toggle-images`)?.addEventListener(`click`,()=>{t.toggleImages(),W(n)},{signal:r}),document.querySelector(`#cmd-toggle-taxa`)?.addEventListener(`click`,()=>{t.toggleTaxa(),W(n)},{signal:r}),document.querySelector(`#cmd-toggle-print`)?.addEventListener(`click`,()=>{t.togglePrint(),W(n)},{signal:r}),document.querySelector(`#cmd-reorder-couplets`)?.addEventListener(`click`,()=>{e.autoOrderCouplets(),L(`Key steps reordered with shorter branches first!`,`success`),W(n)},{signal:r}),document.querySelector(`#cmd-reorder-figures`)?.addEventListener(`click`,()=>{e.autoOrderFigures(),L(`Figures reordered to match key reference order!`,`success`),W(n)},{signal:r})}function On(e){let t=document.querySelector(`.app-menu-bar`);if(!t)return;let n=()=>Array.from(t.querySelectorAll(`.menu-trigger`)),r=e=>{let t=e.nextElementSibling;return t?Array.from(t.querySelectorAll(`.dropdown-action:not(:disabled)`)):[]},i=()=>{n().forEach(e=>e.setAttribute(`aria-expanded`,`false`))};t.addEventListener(`click`,e=>{let t=e.target.closest(`.menu-trigger`);if(t){e.stopPropagation();let n=t.getAttribute(`aria-expanded`)===`true`;i(),t.setAttribute(`aria-expanded`,n?`false`:`true`)}},{signal:e}),document.addEventListener(`click`,()=>i(),{signal:e}),t.addEventListener(`keydown`,e=>{let t=document.activeElement;if(!t)return;let a=t.classList.contains(`menu-trigger`),o=t.classList.contains(`dropdown-action`);if(!a&&!o)return;let s=n(),c=a?t:t.closest(`.menu-item`)?.querySelector(`.menu-trigger`),l=r(c),u=s.indexOf(c),d=l.indexOf(t);switch(e.key){case`ArrowRight`:{if(e.preventDefault(),s.length===0)return;let t=s[(u+1)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowLeft`:{if(e.preventDefault(),s.length===0)return;let t=s[(u-1+s.length)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowDown`:e.preventDefault(),a&&c?(c.setAttribute(`aria-expanded`,`true`),l.length>0&&l[0].focus()):o&&l.length>0&&l[(d+1)%l.length].focus();break;case`ArrowUp`:e.preventDefault(),o&&l.length>0&&l[(d-1+l.length)%l.length].focus();break;case`Escape`:e.preventDefault(),i(),c?.focus();break;case`Enter`:case` `:if(a&&c){e.preventDefault();let t=c.getAttribute(`aria-expanded`)===`true`;c.setAttribute(`aria-expanded`,t?`false`:`true`),!t&&l.length>0&&setTimeout(()=>l[0].focus(),10)}break}},{signal:e})}function kn(e,t){let n=n=>{let r=document.getElementById(`plain-text-import-view`);if(r&&r.style.display===`flex`)return;let i=document.querySelectorAll(`.modal-overlay`),a=Array.from(i).find(e=>e.style.display===`flex`);if(a){if(n.key===`Escape`){a.style.display=`none`,n.preventDefault();return}if(n.key===`Tab`){n.preventDefault();let e=Array.from(a.querySelectorAll(`button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`)).filter(e=>e.offsetParent!==null);e.length>0&&e[(e.indexOf(document.activeElement)+(n.shiftKey?-1:1)+e.length)%e.length].focus();return}}let s=o?n.metaKey:n.ctrlKey,c=document.activeElement,l=c&&(c.tagName===`INPUT`||c.tagName===`TEXTAREA`||c.hasAttribute(`contenteditable`));if(n.altKey&&!s&&!n.shiftKey&&n.code===`KeyF`&&on(c)){n.preventDefault(),cn(c,c.selectionStart??0,c.selectionEnd??0);return}if(s&&n.key.toLowerCase()===`s`){n.preventDefault(),n.shiftKey?document.querySelector(`#cmd-save-as`)?.click():document.querySelector(`#cmd-save`)?.click();return}if(s&&n.key.toLowerCase()===`o`){n.preventDefault(),document.querySelector(`#cmd-open-dialog`)?.click();return}if(s&&n.altKey&&n.key.toLowerCase()===`n`){n.preventDefault(),document.querySelector(`#cmd-new`)?.click();return}if(s&&n.shiftKey&&n.key.toLowerCase()===`f`){n.preventDefault(),document.querySelector(`#cmd-toggle-figures`)?.click();return}if(s&&n.shiftKey&&n.key.toLowerCase()===`p`){n.preventDefault(),document.querySelector(`#cmd-toggle-print`)?.click();return}if(!l){if(n.altKey&&n.key.toLowerCase()===`n`){n.preventDefault(),document.querySelector(`#cmd-add`)?.click();return}if(s&&n.key.toLowerCase()===`a`){n.preventDefault(),document.querySelector(`#cmd-select-all`)?.click();return}if(n.altKey&&n.key.toLowerCase()===`s`){n.preventDefault(),document.querySelector(`#cmd-swap`)?.click();return}if(s&&n.key.toLowerCase()===`z`){n.preventDefault(),n.shiftKey?document.querySelector(`#cmd-redo`)?.click():document.querySelector(`#cmd-undo`)?.click();return}if(s&&n.key.toLowerCase()===`y`){n.preventDefault(),document.querySelector(`#cmd-redo`)?.click();return}if(n.key===`Delete`||n.key===`Backspace`){n.preventDefault(),document.querySelector(`#cmd-delete`)?.click();return}if(n.key===`Escape`){n.preventDefault(),document.querySelector(`#cmd-clear`)?.click();return}let r=(window.getSelection()?.toString()??``).trim()!==``;if(s&&n.key.toLowerCase()===`c`){if(r||e.getSelectedCoupletIds().size===0)return;n.preventDefault(),document.querySelector(`#cmd-copy`)?.click();return}if(s&&n.key.toLowerCase()===`x`){if(r||e.getSelectedCoupletIds().size===0)return;n.preventDefault(),document.querySelector(`#cmd-cut`)?.click();return}if(s&&n.key.toLowerCase()===`v`){if(!e.hasClipboardData())return;n.preventDefault(),Ut(e,t,n.shiftKey?`above`:`below`);return}}};return window.addEventListener(`keydown`,n),()=>{window.removeEventListener(`keydown`,n)}}var An=[{id:101,alt1:`Has feathers [figID: 101]`,alt2:`Lacks feathers`,branch1:{kind:`taxonDraft`,name:`Bird`},branch2:{kind:`linked`,targetId:102}},{id:102,alt1:`Has fur [figID: 102]`,alt2:`Scales or bare skin`,branch1:{kind:`taxonDraft`,name:`Mammal`},branch2:{kind:`linked`,targetId:103}},{id:103,alt1:`Has scales [figID: 103]`,alt2:`Skin is smooth and moist`,branch1:{kind:`taxonDraft`,name:`Reptile2`},branch2:{kind:`taxonDraft`,name:`Amphibian`}}],jn=[{id:101,filename:`feathers.jpg`,caption:`Bird feathers`},{id:102,filename:`fur.jpg`,caption:`Wolf fur`},{id:103,filename:`Lizard.jpg`,caption:`Lizard scales`}];function Mn(e,t,n){let r=document.querySelector(`#editor-container`);if(!r)return()=>{};let i=new AbortController,{signal:a}=i;return St(e,t,n,a),Lt(e,n,a),Rt(r,e,n,a),zt(r,e,t,n,a),Bt(r,e,t,n,a),Vt(r,e,n,a),ln(e,t,n,a),hn(e,t,n,a),gn(e,t,n,a),En(e,t,n,a),Dn(e,t,n,a),un(r,a),Pt(e,t,a),Ft(e,n,a),On(a),()=>{i.abort()}}async function Nn(){let e=document.querySelector(`#app`);if(!e)throw Error(`Application bootstrap failed: DOM target element '#app' was not found.`);let t=new Fe,n=t.activeProjectTitle,r=new Ae([],[]);r.setProjectPersistedListener(e=>t.setActiveProjectTitle(e));let i=!1;if(n&&n!==`Untitled Key`)try{i=await r.loadProject(n)}catch(e){console.error(`Failed to restore active project session "${n}":`,e)}i||(console.log(`🌱 No active database workspace recovered. Hydrating baseline sample template.`),await r.loadFromStorage([...An],[...jn],`Untitled Key`),t.setActiveProjectTitle(`Untitled Key`));let a=()=>{Le(t),Re(r,t),Ve(r),Qe(r,t),Ue(r,t,a),Je(r,t)},o=[],s=e=>{r.hasUnsavedChanges()&&(e.preventDefault(),e.returnValue=``)};window.addEventListener(`beforeunload`,s),o.push(()=>window.removeEventListener(`beforeunload`,s)),Ie(e);let c=Mn(r,t,a),l=kn(r,a);o.push(c),o.push(l),a()}Nn();