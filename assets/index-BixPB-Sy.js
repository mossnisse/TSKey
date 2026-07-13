(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.freeze({kind:`empty`});function t(e){return e.kind===`linked`?e.targetId:null}function n(e,t){switch(e.kind){case`linked`:return t.has(e.targetId)?`linked`:`broken`;case`unresolved`:return`unresolved`;case`taxon`:return`taxon`;case`taxonDraft`:return`taxon`;case`empty`:return`empty`}}var r={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`};function i(e){return e?e.replace(/[&<>"']/g,e=>r[e]):``}function a(e,t,n){let r=null,i=null;try{try{let t=new Blob([e],{type:n});r=URL.createObjectURL(t)}catch(t){console.warn(`Blob URL creation blocked by environment security constraints. Attempting standard Base64 encoding fallback.`,t);let i=new TextEncoder().encode(e),a=``,o=8192;for(let e=0;e<i.length;e+=o){let t=i.subarray(e,e+o);a+=String.fromCharCode(...t)}let s=btoa(a);r=`data:${n.toLowerCase().includes(`charset=`)?n:`${n};charset=utf-8`};base64,${s}`}i=document.createElement(`a`),i.href=r,i.download=t,i.style.display=`none`,i.style.pointerEvents=`none`,document.body.appendChild(i),i.click();let a=i,o=r;setTimeout(()=>{a&&document.body.contains(a)&&document.body.removeChild(a),o&&o.startsWith(`blob:`)&&URL.revokeObjectURL(o)},200)}catch(e){console.error(`An unhandled exception occurred during file synthesis/download processing:`,e),i&&document.body.contains(i)&&document.body.removeChild(i),r&&r.startsWith(`blob:`)&&URL.revokeObjectURL(r)}}var o=(()=>{let e=navigator.userAgentData;if(e?.platform)return e.platform.toLowerCase().includes(`mac`);let t=(navigator.platform||``).toLowerCase();if(t.includes(`mac`)||t.includes(`iphone`)||t.includes(`ipad`)||t.includes(`ipod`))return!0;let n=navigator.userAgent.toLowerCase();return n.includes(`macintosh`)||n.includes(`mac os x`)})();function s(e){if(!e||typeof e!=`object`)return!1;let t=e;switch(t.kind){case`linked`:return typeof t.targetId==`number`;case`unresolved`:return typeof t.couplet==`number`;case`taxon`:return typeof t.taxonId==`number`||typeof t.name==`string`;case`taxonDraft`:return typeof t.name==`string`;case`empty`:return!0;default:return!1}}function c(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.alt1==`string`&&typeof e.alt2==`string`&&s(e.branch1)&&s(e.branch2))||t.has(e.id)?!1:(t.add(e.id),!0))}function l(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.filename==`string`&&typeof e.caption==`string`)||t.has(e.id)?!1:(t.add(e.id),!0))}function u(e){let t=new Map;return e.forEach((e,n)=>t.set(e.id,n)),t}var d=`scientific`;function f(e){return e===`scientific`||e===`vernacular`}function p(e,t){let n=new Map;return e.forEach(e=>n.set(e.id,e)),{byId:n,nameMode:t}}function m(e,t){let n=e.scientificName.trim(),r=e.vernacularName.trim();return t===`vernacular`?r||n:n||r}function h(e,t,n){switch(e.kind){case`linked`:{let n=t.get(e.targetId);if(n!==void 0){let e=(n+1).toString();return{kind:`step`,inputValue:e,printText:e,printClass:`print-dest-strong`,isUnresolved:!1}}return{kind:`broken`,inputValue:`?`,printText:`?`,printClass:`error-text`,isUnresolved:!0}}case`unresolved`:{let t=e.couplet.toString();return{kind:`broken`,inputValue:t,printText:t,printClass:`error-text`,isUnresolved:!0}}case`taxon`:{let t=n?.byId.get(e.taxonId);return t?{kind:`taxon`,inputValue:m(t,n.nameMode),printText:m(t,n.nameMode),printClass:`print-dest-taxon`,isUnresolved:!1}:{kind:`broken`,inputValue:``,printText:`[missing taxon]`,printClass:`error-text`,isUnresolved:!0}}case`taxonDraft`:return{kind:`taxon`,inputValue:e.name,printText:e.name,printClass:`print-dest-taxon-unlinked`,isUnresolved:!1,isUnlinkedTaxon:!0};case`empty`:return{kind:`empty`,inputValue:``,printText:`...`,printClass:``,isUnresolved:!1}}}var g=`classic`;function _(e){return e===`classic`||e===`lettered`||e===`minimal`}function v(e){let n=new Map;e.forEach((e,r)=>{let i=r+1;for(let r of[e.branch1,e.branch2]){let e=t(r);if(e===null)continue;let a=n.get(e);a||n.set(e,a=new Set),a.add(i)}});let r=new Map;for(let[e,t]of n)r.set(e,[...t].sort((e,t)=>e-t));return r}function y(e,t,n){let r;switch(e){case`lettered`:r={lead1:`${t}a`,lead2:`${t}b`};break;case`minimal`:r={lead1:`${t}`,lead2:`-`};break;default:r={lead1:`${t}.`,lead2:`—`};break}return n&&n.length>0&&(r.lead1+=` (${n.join(`, `)})`),r}function b(e,t){let n=e.trim();if(n===``)return{kind:`empty`};if(/^\d+$/.test(n)){let e=parseInt(n,10),r=e-1;return r>=0&&r<t.length?{kind:`linked`,targetId:t[r].id}:{kind:`unresolved`,couplet:e}}return{kind:`taxonDraft`,name:n}}function x(e,t=`.tskey`){return`${e.toLowerCase().trim().replace(/[^a-z0-9_\-]/gi,`_`).replace(/_+/g,`_`).replace(/_$/,``)||`untitled_key`}${t}`}function S(e){return typeof e==`object`&&!!e}var C=()=>/\[figID:\s*(\d+)\s*\]/gi,w=()=>/\[fig:\s*([^\]]+?)\s*\]/gi;function T(e){let t=new Map,n=new Map,r=new Map,i=new Map;return e.forEach((e,a)=>{let o=a+1;t.set(e.id,o),n.set(o,e),i.set(e.id,e);let s=e.filename.trim().toLowerCase();s&&r.set(s,e)}),{idToDisplayNum:t,displayNumToFig:n,filenameToFig:r,idToFig:i}}function E(e,t,n){let{displayNumToFig:r,filenameToFig:i,idToDisplayNum:a}=t,o=parseInt(e,10);if(!isNaN(o)&&String(o)===e&&o>=1&&o<=n){let e=r.get(o);if(e)return{figId:e.id,displayNum:o}}let s=i.get(e.toLowerCase());if(s){let e=a.get(s.id);if(e!==void 0)return{figId:s.id,displayNum:e}}return null}function D(e,t){return new Promise((n,r)=>{e.oncomplete=()=>n(),e.onerror=()=>r(e.error),e.onabort=()=>r(Error(t))})}function O(e){return new Promise((t,n)=>{e.onsuccess=()=>t(e.result),e.onerror=()=>n(e.error)})}var k=class{dbName=`TSKey_Workspace_DB`;projectsStoreName=`projects`;figuresStoreName=`figures`;dbPromise=null;getDB(){return this.dbPromise?this.dbPromise:(this.dbPromise=new Promise((e,t)=>{let n=indexedDB.open(this.dbName,2);n.onupgradeneeded=()=>{let e=n.result;e.objectStoreNames.contains(this.projectsStoreName)||e.createObjectStore(this.projectsStoreName,{keyPath:`title`}),e.objectStoreNames.contains(this.figuresStoreName)||e.createObjectStore(this.figuresStoreName)},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error),n.onblocked=()=>{alert(`⚠️ TSKey could not open its database because another tab still has an older version open. Please close other TSKey tabs and reload.`),t(Error(`IndexedDB open blocked by another open connection.`))}}),this.dbPromise.catch(()=>{this.dbPromise=null}),this.dbPromise)}getFigureKey(e,t){return`${e}::${t}`}parseFigureId(e){return parseInt(e.substring(e.lastIndexOf(`::`)+2),10)}getProjectKeyRange(e){let t=`${e}::`,n=t.substring(0,t.length-1)+String.fromCharCode(t.charCodeAt(t.length-1)+1);return IDBKeyRange.bound(t,n,!1,!0)}async getProjectList(){return(await O((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).getAll())).map(e=>({name:e.title,lastModified:e.lastModified})).sort((e,t)=>t.lastModified-e.lastModified)}async saveProject(e,t,n){let r=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`),i={title:e,projectUid:t,schemaVersion:2,dichotomousKey:n.dichotomousKey,figures:n.figures,taxa:n.taxa,lastModified:Date.now()};return r.objectStore(this.projectsStoreName).put(i),D(r,`Transaction aborted while saving project: ${e}`)}async loadProject(e){let t=await O((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).get(e));return t?(t.dichotomousKey=t.dichotomousKey||[],t.figures=t.figures||[],t.taxa=t.taxa||[],t):null}async deleteProject(e,t){let n=(await this.getDB()).transaction([this.projectsStoreName,this.figuresStoreName],`readwrite`);n.objectStore(this.projectsStoreName).delete(e);let r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(t));return r.onsuccess=e=>{let t=e.target.result;t&&(t.delete(),t.continue())},D(n,`Project deletion aborted for: ${e}`)}async deleteProjectRecordOnly(e){let t=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`);return t.objectStore(this.projectsStoreName).delete(e),D(t,`Project record deletion aborted for: ${e}`)}async saveFigure(e,t,n){let r=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return r.objectStore(this.figuresStoreName).put(n,this.getFigureKey(e,t)),D(r,`Transaction aborted while saving figure ID ${t}`)}async deleteFigure(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return n.objectStore(this.figuresStoreName).delete(this.getFigureKey(e,t)),D(n,`Transaction aborted while deleting figure ID ${t}`)}async cleanupOrphanFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(e));return r.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key);t.has(e)||n.delete(),n.continue()}},D(n,`Orphan cleanup transaction aborted for project: ${e}`)}async getFigure(e,t){return await O((await this.getDB()).transaction(this.figuresStoreName,`readonly`).objectStore(this.figuresStoreName).get(this.getFigureKey(e,t)))||null}async cloneProjectFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName),i=r.openCursor(this.getProjectKeyRange(e));return i.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key),i=n.value;r.put(i,this.getFigureKey(t,e)),n.continue()}},D(n,`Cloning figures transaction aborted from "${e}" to "${t}"`)}async deleteProjectFigures(e){let t=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),n=t.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(e));return n.onsuccess=e=>{let t=e.target.result;t&&(t.delete(),t.continue())},D(t,`Figure cleanup aborted for displaced project: ${e}`)}},A=new class{storage;pendingUploads=new Map;pendingDeletes=new Set;commitPromise=null;constructor(e=new k){this.storage=e}async getProjectList(){return this.storage.getProjectList()}async saveProject(e,t,n){let r=this.getStagingSnapshot(),i=await this.storage.loadProject(e),a=i?.projectUid&&i.projectUid!==t?i.projectUid:null;if(await this.storage.saveProject(e,t,n),await this.commitStagedChanges(t,n.figures,r),a)try{await this.storage.deleteProjectFigures(a)}catch(e){console.warn(`Could not reclaim figure blobs for displaced project "${a}":`,e)}}async loadProject(e){this.resetActiveImageCache();let t=await this.storage.loadProject(e);return t?.projectUid&&await this.storage.cleanupOrphanFigures(t.projectUid,new Set(t.figures.map(e=>e.id))),t}async deleteProject(e){let t=await this.storage.loadProject(e);if(t)return this.storage.deleteProject(e,t.projectUid)}async deleteProjectRecord(e){return this.storage.deleteProjectRecordOnly(e)}async cloneProjectFigures(e,t){return this.storage.cloneProjectFigures(e,t)}clearStagedChanges(){this.pendingUploads.clear(),this.pendingDeletes.clear()}getStagingSnapshot(){return{uploads:new Map(this.pendingUploads),deletes:new Set(this.pendingDeletes)}}restoreStagingSnapshot(e){let t=new Set([...this.pendingUploads.keys(),...this.pendingDeletes,...e.uploads.keys(),...e.deletes]);for(let n of t){let t=this.pendingUploads.get(n)===e.uploads.get(n),r=this.pendingDeletes.has(n)===e.deletes.has(n);if(t&&r)continue;let i=j.get(n);i&&(URL.revokeObjectURL(i),j.delete(n))}this.pendingUploads=new Map(e.uploads),this.pendingDeletes=new Set(e.deletes)}resetActiveImageCache(){te(),this.clearStagedChanges()}deleteFigureBinary(e){this.pendingUploads.delete(e),this.pendingDeletes.add(e)}uploadFigureBinary(e,t){this.pendingDeletes.delete(e),this.pendingUploads.set(e,t)}async getFigureBinary(e,t){return this.pendingUploads.has(t)?this.pendingUploads.get(t):this.pendingDeletes.has(t)?null:this.storage.getFigure(e,t)}async commitStagedChanges(e,t,n=this.getStagingSnapshot()){let r=this.commitPromise??Promise.resolve(),i=n.uploads,a=n.deletes,o=(async()=>{await r.catch(()=>{});try{let n=new Set(t.map(e=>e.id));for(let[t,r]of i)n.has(t)&&await this.storage.saveFigure(e,t,r);for(let t of a)await this.storage.deleteFigure(e,t);await this.storage.cleanupOrphanFigures(e,n);for(let[e,t]of i)this.pendingUploads.get(e)===t&&this.pendingUploads.delete(e);for(let e of a)this.pendingDeletes.delete(e)}catch(e){throw e instanceof Error&&e.name===`QuotaExceededError`&&alert(`⚠️ Browser storage is full! Could not save the latest images. Please delete old workspaces to free up space.`),e}})().finally(()=>{this.commitPromise===o&&(this.commitPromise=null)});return this.commitPromise=o,o}},j=new Map;function ee(e){return new Promise((t,n)=>{let r=new FileReader;r.onloadend=()=>t(r.result),r.onerror=n,r.readAsDataURL(e)})}function te(){for(let e of j.values())URL.revokeObjectURL(e);j.clear()}function M(e){return e.reduce((e,t)=>{let n=Number(t?.id);return isNaN(n)?e:Math.max(e,n)},0)+1}function ne(e,t,n){let r=e.findIndex(e=>e.id===t);if(r===-1)return null;let i={...e[r],...n},a=[...e];return a[r]=i,a}function re(e,t){return e.filter(e=>!t.has(e.id))}function ie(e,t,n){let r=[...e],[i]=r.splice(t,1);return r.splice(n,0,i),r}function ae(t){let n=M(t),r=t.length+1,i=-1,a=null;for(let e=t.length-1;e>=0;e--){let n=t[e];if(n.branch1.kind===`empty`){i=e,a=`branch1`;break}else if(n.branch2.kind===`empty`){i=e,a=`branch2`;break}}let o={kind:`linked`,targetId:n},s=e=>e.kind===`unresolved`&&e.couplet===r?o:e;return{key:[...t.map((e,t)=>{let n={...e};return n.branch1=s(n.branch1),n.branch2=s(n.branch2),t===i&&a&&(n[a]=o),n}),{id:n,alt1:``,alt2:``,branch1:e,branch2:e}],newId:n}}function oe(e,t,n,r,i,a){let o=e.length;if(n!==void 0){let t=e.findIndex(e=>e.id===n);t!==-1&&(o=r===`above`?t:t+1)}let s=e.reduce((e,t)=>Math.max(e,t.id),0),c=new Map;t.forEach((e,t)=>{c.set(e.id,s+t+1)});let l=e=>e.kind===`linked`&&c.has(e.targetId)?{kind:`linked`,targetId:c.get(e.targetId)}:e,u=t.map(e=>({...e,id:c.get(e.id),branch1:l(e.branch1),branch2:l(e.branch2)})),d=[...e];return d.splice(o,0,...u),i&&a.length>0&&(d=d.map(e=>{let t=a.filter(t=>t.sourceId===e.id);if(t.length===0)return e;let n={...e};return t.forEach(e=>{let t=c.get(e.targetOldId);t!==void 0&&(n[e.field]={kind:`linked`,targetId:t})}),n})),{key:d,newIds:u.map(e=>e.id)}}function se(n,r){let i=[];return{key:n.filter(e=>!r.has(e.id)).map(n=>{let a={...n},o=t(n.branch1);o!==null&&r.has(o)&&(i.push({sourceId:n.id,field:`branch1`,targetOldId:o}),a.branch1=e);let s=t(n.branch2);return s!==null&&r.has(s)&&(i.push({sourceId:n.id,field:`branch2`,targetOldId:s}),a.branch2=e),a}),severedLinks:i}}function ce(n,r){let i=n=>{let i=t(n);return i!==null&&r.has(i)?e:n};return n.filter(e=>!r.has(e.id)).map(e=>({...e,branch1:i(e.branch1),branch2:i(e.branch2)}))}function le(e,t){let n=!1;return{key:e.map(e=>t.has(e.id)?(n=!0,{...e,alt1:e.alt2,alt2:e.alt1,branch1:e.branch2,branch2:e.branch1}):e),modified:n}}function ue(e,t,n,r){if(t===n)return null;let i=[...e],a=i.findIndex(e=>e.id===t),o=i.findIndex(e=>e.id===n);if(a===-1||o===-1)return console.warn(`Aborted reordering: srcIdx (${a}) or targetIdx (${o}) was invalid.`),null;let[s]=i.splice(a,1),c=o;return r===`above`&&a<o?c--:r===`below`&&a>o&&c++,i.splice(c,0,s),i}function de(e){let r=new Map(e.map(e=>[e.id,e])),i=e=>{let n=t(e);return n!==null&&r.has(n)?n:null},a={taxon:1,linked:2,unresolved:2,broken:3,empty:3},o=new Map,s=new Set,c=e=>{switch(n(e,r)){case`taxon`:return 0;case`linked`:return l(e.targetId);case`unresolved`:return e.couplet||0;default:return 1e4}},l=e=>{if(!r.has(e))return 0;if(o.has(e))return o.get(e);if(s.has(e))return 0;s.add(e);let t=r.get(e),n=c(t.branch1),i=c(t.branch2);s.delete(e);let a=1+Math.max(n,i);return o.set(e,a),a};e.forEach(e=>l(e.id));let u=e.map(e=>{let t=n(e.branch1,r),i=n(e.branch2,r),o=a[t],s=a[i],l=!1;if(o>s)l=!0;else if(o===s&&o===2){let n=c(e.branch1),r=c(e.branch2);(r<n||r===n&&t!==i&&i===`linked`)&&(l=!0)}return l?{...e,alt1:e.alt2,alt2:e.alt1,branch1:e.branch2,branch2:e.branch1}:{...e}}),d=new Map(u.map(e=>[e.id,e])),f=new Map;u.forEach(e=>{let t=i(e.branch1);t!==null&&f.set(t,(f.get(t)||0)+1);let n=i(e.branch2);n!==null&&f.set(n,(f.get(n)||0)+1)});let p=u.filter(e=>!f.has(e.id));p.length===0&&u.length>0&&p.push(u[0]);let m=new Set,h=[],g=e=>{let t=[e];for(;t.length>0;){let e=t.pop();if(e===0||m.has(e))continue;let n=d.get(e);if(!n)continue;m.add(e),h.push(n);let r=i(n.branch2);r!==null&&!m.has(r)&&t.push(r);let a=i(n.branch1);a!==null&&!m.has(a)&&t.push(a)}};return p.forEach(e=>g(e.id)),u.forEach(e=>{m.has(e.id)||g(e.id)}),h}function fe(e,t){let{idToFig:n,displayNumToFig:r,filenameToFig:i}=T(e),a=[],o=new Set;for(let e of t){let t=[e.alt1,e.alt2];for(let e of t){if(!e)continue;let t,s=C();for(;(t=s.exec(e))!==null;){let e=parseInt(t[1].trim(),10),r=n.get(e);r&&!o.has(r.id)&&(o.add(r.id),a.push(r))}let c=w();for(;(t=c.exec(e))!==null;){let e=t[1].trim(),n,s=parseInt(e,10);if(!isNaN(s)&&String(s)===e&&r.has(s))n=r.get(s);else{let t=e.toLowerCase();i.has(t)&&(n=i.get(t))}n&&!o.has(n.id)&&(o.add(n.id),a.push(n))}}}for(let t of e)o.has(t.id)||a.push(t);return a}function pe(e,t,n){if(!e)return e;let r=t.length,{filenameToFig:i}=T(t);return e=e.replace(C(),(e,t)=>{let r=parseInt(t.trim(),10),i=n.get(r);return i===void 0?`[Broken Fig: ID ${r}]`:`(Fig. ${i})`}),e=e.replace(w(),(e,t)=>{let a=t.trim(),o=parseInt(a,10);if(!isNaN(o)&&String(o)===a&&o>=1&&o<=r)return`(Fig. ${o})`;let s=i.get(a.toLowerCase());if(s){let e=n.get(s.id);if(e!==void 0)return`(Fig. ${e})`}return`[Broken Fig: ${a}]`}),e}function me(e,t){if(!e)return``;let{displayNumToFig:n,filenameToFig:r}=T(t);return e.replace(w(),(e,t)=>{let i=t.trim(),a=parseInt(i,10);if(!isNaN(a)&&String(a)===i&&n.has(a))return`[figID: ${n.get(a).id}]`;let o=r.get(i.toLowerCase());return o?`[figID: ${o.id}]`:e})}function he(e,t){if(!e)return``;let{idToDisplayNum:n}=T(t);return e.replace(C(),(e,t)=>{let r=parseInt(t.trim(),10),i=n.get(r);return i===void 0?e:`[fig: ${i}]`})}function N(e){return e.trim().toLowerCase()}function ge(e,t){let n=N(t);if(n!==``)return e.find(e=>N(e.scientificName)===n)??e.find(e=>N(e.vernacularName)===n)}function _e(e,t){return[...e].sort((e,n)=>m(e,t).localeCompare(m(n,t),void 0,{sensitivity:`base`}))}function ve(e){if(!Array.isArray(e))return[];let t=e=>typeof e==`string`?e:``,n=new Set,r=[];for(let i of e){if(!i||typeof i!=`object`)continue;let e=i,a=e.id;if(typeof a!=`number`||!Number.isFinite(a)||a<=0||n.has(a))continue;n.add(a);let o=ye(a,t(e.scientificName));o.auctor=t(e.auctor),o.vernacularName=t(e.vernacularName),o.description=t(e.description),o.biology=t(e.biology),o.distribution=t(e.distribution),Array.isArray(e.synonyms)&&(o.synonyms=e.synonyms.filter(e=>typeof e==`string`)),Array.isArray(e.confusables)&&(o.confusables=e.confusables.filter(e=>!!e&&typeof e==`object`).map(e=>({name:t(e.name),distinction:t(e.distinction)})).filter(e=>e.name!==``||e.distinction!==``)),r.push(o)}return r}function ye(e,t=``){return{id:e,scientificName:t.trim(),auctor:``,vernacularName:``,synonyms:[],description:``,biology:``,distribution:``,confusables:[]}}function be(e,t=!1){let n=new Map;return e.forEach(e=>{let t=N(e.scientificName);t&&!n.has(t)&&n.set(t,e.id)}),t&&e.forEach(e=>{let t=N(e.vernacularName);t&&!n.has(t)&&n.set(t,e.id)}),n}function xe(e,t){return e.map(e=>{let n=t(e.branch1),r=t(e.branch2);return n===e.branch1&&r===e.branch2?e:{...e,branch1:n,branch2:r}})}function Se(t,n,r){let i=be(n),a=[...n],o=M(a),s=!1;return{key:xe(t,t=>{let n=r(t);if(n===null)return t;s=!0;let c=n.trim();if(c===``)return e;let l=N(c),u=i.get(l);if(u!==void 0)return{kind:`taxon`,taxonId:u};let d=o++;return a.push(ye(d,c)),i.set(l,d),{kind:`taxon`,taxonId:d}}),taxa:a,changed:s}}function Ce(e,t){return Se(e,t,e=>e.kind===`taxonDraft`?e.name:null)}function we(e,t){let n=Se(e,t,e=>{let t=e;return e.kind===`taxon`&&typeof t.taxonId!=`number`&&typeof t.name==`string`?t.name:null});return{key:n.key,taxa:n.taxa}}function Te(e,t){let n=be(t,!0),r=!1;return{key:xe(e,e=>{if(e.kind!==`taxonDraft`)return e;let t=n.get(N(e.name));return t===void 0?e:(r=!0,{kind:`taxon`,taxonId:t})}),changed:r}}function Ee(t,n){return{key:xe(t,t=>t.kind===`taxon`&&n.has(t.taxonId)?e:t)}}var De=class{ids=new Set;get(){return this.ids}has(e){return this.ids.has(e)}get size(){return this.ids.size}toggle(e,t){t?this.ids.has(e)?this.ids.delete(e):this.ids.add(e):this.ids=new Set([e])}replace(e){this.ids=new Set(e)}clear(){this.ids.clear()}},Oe=`TSKey`,ke=`0.0.4`;function P(){return crypto.randomUUID()}var Ae=[`dichotomousKey`,`figures`,`taxa`];function je(e,n){let r=new Set;if(e.length===0)return r;let i=n||new Map(e.map(e=>[e.id,e])),a=[e[0].id];for(;a.length>0;){let e=a.pop();if(!r.has(e)){r.add(e);let n=i.get(e);if(n){let e=t(n.branch2);e!==null&&a.push(e);let r=t(n.branch1);r!==null&&a.push(r)}}}return r}function Me(e,n){let r={steps:[],reachable:!1};if(e.length===0)return r;let i=new Map(e.map(e=>[e.id,e])),a=new Map;if(e.forEach((e,t)=>a.set(e.id,t)),!i.has(n))return r;let o=e[0].id,s=new Map,c=new Set([o]),l=[o];for(;l.length>0;){let e=l.shift();if(e===n)break;let r=i.get(e);if(!r)continue;let a=[[r.branch1,`a`],[r.branch2,`b`]];for(let[n,r]of a){let a=t(n);a!==null&&i.has(a)&&!c.has(a)&&(c.add(a),s.set(a,{parentId:e,choice:r}),l.push(a))}}if(!c.has(n))return r;let u=[],d=n,f;for(;d!==void 0;){u.push({id:d,choice:f});let e=s.get(d);f=e?.choice,d=e?.parentId}return u.reverse(),{steps:u.map(e=>({id:e.id,stepNum:(a.get(e.id)??0)+1,choice:e.choice})),reachable:!0}}function Ne(e,n){let r=new Map;if(e.length===0)return r;let i=new Map,a=new Map,o=new Map,s=new Set(n.map(e=>e.id)),{displayNumToFig:c,filenameToFig:l}=T(n),u=e=>{let t=e.trim();if(t===``)return!1;let n=parseInt(t,10);return!isNaN(n)&&String(n)===t?c.has(n):l.has(t.toLowerCase())};e.forEach((e,n)=>{i.set(e.id,e),a.set(e.id,n);let r=t(e.branch1);if(r!==null){let t=o.get(r);t||o.set(r,t=new Set),t.add(e.id)}let s=t(e.branch2);if(s!==null){let t=o.get(s);t||o.set(s,t=new Set),t.add(e.id)}});let d=je(e,i),f=C(),p=w(),m=(e,t)=>{let n=[];if(!e)return n;let r=[];for(let t of e.matchAll(f)){let e=parseInt(t[1],10);!s.has(e)&&!r.includes(e)&&r.push(e)}r.forEach(e=>{n.push({severity:`warning`,message:`Choice ${t} references a missing or deleted figure (Internal ID: ${e}).`})});let i=[];for(let t of e.matchAll(p)){let e=t[1].trim();!u(e)&&!i.includes(e)&&i.push(e)}return i.forEach(e=>{n.push({severity:`warning`,message:`Choice ${t} references an unresolved figure reference '[fig: ${e}]'.`})}),n};return e.forEach((e,t)=>{let n=[];e.branch1.kind===`unresolved`?n.push({severity:`error`,message:`Choice A points to step '${e.branch1.couplet}' which does not exist yet.`}):e.branch1.kind===`empty`&&n.push({severity:`warning`,message:`Choice A is incomplete. Assign a Taxa or destination step.`}),e.branch2.kind===`unresolved`?n.push({severity:`error`,message:`Choice B points to step '${e.branch2.couplet}' which does not exist yet.`}):e.branch2.kind===`empty`&&n.push({severity:`warning`,message:`Choice B is incomplete. Assign a Taxa or destination step.`}),n.push(...m(e.alt1,`A`)),n.push(...m(e.alt2,`B`)),t>0&&!d.has(e.id)&&n.push({severity:`warning`,message:`Orphaned: This step is unreachable from Step #1.`}),t===0&&o.has(e.id)&&n.push({severity:`warning`,message:`Step #1 should be the key's starting point, but other steps link here.`}),e.branch1.kind===`linked`&&(e.branch1.targetId===e.id?n.push({severity:`error`,message:`Choice A loops directly into its own key step.`}):i.has(e.branch1.targetId)||n.push({severity:`error`,message:`Choice A points to an invalid or deleted step.`})),e.branch2.kind===`linked`&&(e.branch2.targetId===e.id?n.push({severity:`error`,message:`Choice B loops directly into its own key step.`}):i.has(e.branch2.targetId)||n.push({severity:`error`,message:`Choice B points to an invalid or deleted step.`}));let s=o.get(e.id);if(s&&s.size>1){let e=[];s.forEach(t=>{let n=a.get(t);n!==void 0&&n!==-1&&e.push(`#${n+1}`)}),n.push({severity:`warning`,message:`Convergence: Multiple steps (${e.join(`, `)}) link here.`})}n.length>0&&r.set(e.id,n)}),r}var Pe=class{state;hasUncommittedChanges=!1;editScope=null;persistedTitle=``;activeProjectUid=P();onProjectPersisted;undoStack=[];redoStack=[];maxHistoryLimit;savedDepth=0;mutationRevision=0;coupletSelection=new De;figureSelection=new De;taxonSelection=new De;_draggedId=null;activeCoupletId=null;clipboardBuffer=[];clipboardMode=`copy`;cutIncomingLinksBuffer=[];constructor(e,t=[],n=`Untitled Key`,r=100,i=[]){this.state={title:n,dichotomousKey:e,figures:t,taxa:i},this.maxHistoryLimit=r,this.hasUncommittedChanges=!1,this.persistedTitle=n}getTitle(){return this.state.title}getPersistedTitle(){return this.persistedTitle}getActiveProjectUid(){return this.activeProjectUid}setTitle(e){let t=e.trim();this.state.title!==t&&(this.saveCheckpoint(),this.state.title=t||`Untitled Key`,this.markChanged())}getKey(){return this.state.dichotomousKey}getFigures(){return this.state.figures||[]}getTaxa(){return this.state.taxa||[]}getSelectedCoupletIds(){return this.coupletSelection.get()}setActiveCouplet(e){this.activeCoupletId=e}getActiveCoupletId(){return this.activeCoupletId}clearActiveCouplet(){this.activeCoupletId=null}get draggedCoupletId(){return this._draggedId}startDraggingCouplet(e){this._draggedId=e}stopDraggingCouplet(){this._draggedId=null}markSaved(){this.savedDepth=this.undoStack.length,this.hasUncommittedChanges=!1,this.editScope=null}bumpMutationRevision(){this.mutationRevision+=1}markChanged(){this.bumpMutationRevision(),this.hasUncommittedChanges=!0}hasUnsavedChanges(){return this.undoStack.length!==this.savedDepth||this.hasUncommittedChanges}resetTrackingContext(){this.bumpMutationRevision(),this.undoStack=[],this.redoStack=[],this.savedDepth=0,this.hasUncommittedChanges=!1,this.editScope=null,this.coupletSelection.clear(),this.figureSelection.clear(),this.taxonSelection.clear(),this.activeCoupletId=null,this._draggedId=null}captureState(){let e={title:this.state.title};for(let t of Ae)e[t]=(this.state[t]||[]).map(e=>({...e}));return e}captureHistoryEntry(){return{state:this.captureState(),staging:A.getStagingSnapshot()}}saveCheckpoint(){this.savedDepth!==null&&this.savedDepth>this.undoStack.length&&(this.savedDepth=null),this.redoStack=[],this.undoStack.push(this.captureHistoryEntry()),this.undoStack.length>this.maxHistoryLimit&&(this.undoStack.shift(),this.savedDepth!==null&&(this.savedDepth=this.savedDepth>0?this.savedDepth-1:null)),this.hasUncommittedChanges=!1,this.editScope=null}beginScopedEdit(e){this.editScope!==e&&this.saveCheckpoint(),this.editScope=e}discardCutBuffer(){this.clipboardMode===`cut`&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[])}undo(){if(this.undoStack.length===0)return!1;this.redoStack.push(this.captureHistoryEntry());let e=this.undoStack.pop();return this.state=e.state,A.restoreStagingSnapshot(e.staging),this.bumpMutationRevision(),this.hasUncommittedChanges=!1,this.editScope=null,this.discardCutBuffer(),!0}redo(){if(this.redoStack.length===0)return!1;this.undoStack.push(this.captureHistoryEntry());let e=this.redoStack.pop();return this.state=e.state,A.restoreStagingSnapshot(e.staging),this.bumpMutationRevision(),this.hasUncommittedChanges=!1,this.editScope=null,this.discardCutBuffer(),!0}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}copySelectedCouplets(){let e=this.getSelectedCoupletIds();e.size!==0&&(this.clipboardBuffer=this.state.dichotomousKey.filter(t=>e.has(t.id)).map(e=>({...e})),this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[])}hasClipboardData(){return this.clipboardBuffer.length>0}generateInboundLinksMap(){let e=new Map;return this.state.dichotomousKey.forEach((n,r)=>{let i=r+1,a=t(n.branch1);a!==null&&(e.has(a)||e.set(a,[]),e.get(a).push(`${i}a`));let o=t(n.branch2);o!==null&&(e.has(o)||e.set(o,[]),e.get(o).push(`${i}b`))}),e}endTypingSession(){this.hasUncommittedChanges&&(this.hasUncommittedChanges=!1,this.editScope=null)}updateCouplet(e,t){this.beginScopedEdit(`key`);let n=ne(this.state.dichotomousKey,e,t);n&&(this.state.dichotomousKey=n,this.markChanged())}addCouplet(){this.saveCheckpoint();let{key:e,newId:t}=ae(this.state.dichotomousKey);return this.state.dichotomousKey=e,this.markChanged(),t}pasteCouplets(e,t=`below`){if(this.clipboardBuffer.length===0)return!1;this.saveCheckpoint();let{key:n,newIds:r}=oe(this.state.dichotomousKey,this.clipboardBuffer,e,t,this.clipboardMode===`cut`,this.cutIncomingLinksBuffer);return this.clipboardMode===`cut`&&this.cutIncomingLinksBuffer.length>0&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[]),this.state.dichotomousKey=n,this.setSelectionBatch(r),this.markChanged(),!0}cutSelectedCouplets(){let e=this.getSelectedCoupletIds();if(e.size===0)return;this.saveCheckpoint(),this.activeCoupletId!==null&&e.has(this.activeCoupletId)&&(this.activeCoupletId=null),this.clipboardBuffer=this.state.dichotomousKey.filter(t=>e.has(t.id)).map(e=>({...e})),this.clipboardMode=`cut`;let{key:t,severedLinks:n}=se(this.state.dichotomousKey,e);this.state.dichotomousKey=t,this.cutIncomingLinksBuffer=n,this.coupletSelection.clear(),this.markChanged()}deleteSelectedCouplets(){if(this.coupletSelection.size===0)return;this.saveCheckpoint();let e=new Set(this.coupletSelection.get());this.activeCoupletId!==null&&e.has(this.activeCoupletId)&&(this.activeCoupletId=null),this.state.dichotomousKey=ce(this.state.dichotomousKey,e),this.coupletSelection.clear(),this.markChanged()}swapSelectedCouplets(){if(this.coupletSelection.size===0)return!1;this.saveCheckpoint();let{key:e,modified:t}=le(this.state.dichotomousKey,this.coupletSelection.get());return this.state.dichotomousKey=e,t?(this.markChanged(),!0):!1}reorderCouplets(e,t,n=`above`){let r=ue(this.state.dichotomousKey,e,t,n);return r===null?!1:(this.saveCheckpoint(),this.state.dichotomousKey=r,this.markChanged(),!0)}autoOrderCouplets(){this.state.dichotomousKey.length!==0&&(this.saveCheckpoint(),this.state.dichotomousKey=de(this.state.dichotomousKey),this.markChanged())}getSelectedFigureIds(){return this.figureSelection.get()}clearSelectionsExcept(e){for(let t of[this.coupletSelection,this.figureSelection,this.taxonSelection])t!==e&&t.clear()}toggleFigureSelection(e,t){t||this.clearSelectionsExcept(this.figureSelection),this.figureSelection.toggle(e,t)}clearFigureSelection(){this.figureSelection.clear()}deleteSelectedFigures(){this.figureSelection.size!==0&&(this.saveCheckpoint(),this.state.figures=re(this.state.figures,this.figureSelection.get()),this.figureSelection.clear(),this.markChanged())}addFigure(e,t){this.saveCheckpoint();let n=this.state.figures||[],r=M(n);return this.state.figures=[...n,{id:r,filename:e,caption:t}],this.markChanged(),r}updateFigure(e,t){this.beginScopedEdit(`figures`);let n=ne(this.state.figures,e,t);n&&(this.state.figures=n,this.markChanged())}reorderFigures(e,t){!this.state.figures||e===t||(this.saveCheckpoint(),this.state.figures=ie(this.state.figures,e,t),this.markChanged())}autoOrderFigures(){let e=this.state.figures||[];e.length===0||this.state.dichotomousKey.length===0||(this.saveCheckpoint(),this.state.figures=fe(e,this.state.dichotomousKey),this.markChanged())}getSelectedTaxonIds(){return this.taxonSelection.get()}toggleTaxonSelection(e,t){t||this.clearSelectionsExcept(this.taxonSelection),this.taxonSelection.toggle(e,t)}clearTaxonSelection(){this.taxonSelection.clear()}deleteSelectedTaxa(){if(this.taxonSelection.size===0)return;this.saveCheckpoint();let e=new Set(this.taxonSelection.get());this.state.taxa=re(this.state.taxa,e),this.state.dichotomousKey=Ee(this.state.dichotomousKey,e).key,this.taxonSelection.clear(),this.markChanged()}sortTaxaByName(e){let t=this.state.taxa||[];t.length<2||(this.saveCheckpoint(),this.state.taxa=_e(t,e),this.markChanged())}addTaxon(e=``){this.saveCheckpoint();let t=this.state.taxa||[],n=M(t);return this.state.taxa=[...t,ye(n,e)],this.markChanged(),n}updateTaxon(e,t){this.beginScopedEdit(`taxa`);let n=ne(this.state.taxa,e,t);n&&(this.state.taxa=n,this.markChanged())}relinkTaxonDrafts(){let e=Te(this.state.dichotomousKey,this.state.taxa);return e.changed?(this.state.dichotomousKey=e.key,this.markChanged(),!0):!1}reorderTaxa(e,t){!this.state.taxa||e===t||(this.saveCheckpoint(),this.state.taxa=ie(this.state.taxa,e,t),this.markChanged())}createTaxonForBranch(e,t,n=`scientific`){let r=this.state.dichotomousKey.find(t=>t.id===e);if(!r)return null;let i=r[t];if(i.kind!==`taxonDraft`)return null;this.saveCheckpoint();let a=ge(this.state.taxa,i.name),o;if(a)o=a.id;else{o=M(this.state.taxa);let e=ye(o,n===`scientific`?i.name:``);n===`vernacular`&&(e.vernacularName=i.name),this.state.taxa=[...this.state.taxa,e]}return this.state.dichotomousKey=ne(this.state.dichotomousKey,e,{[t]:{kind:`taxon`,taxonId:o}})??this.state.dichotomousKey,this.markChanged(),o}importJsonData(e){try{let t=null,n=[],r=[],i=`Untitled Key`;if(S(e)&&S(e.data)){let a=e.data;c(a.key)&&(t=a.key,l(a.figures)&&(n=a.figures),r=ve(a.taxa)),typeof a.title==`string`?i=a.title:typeof e.title==`string`&&(i=e.title)}if(!t&&c(e)&&(t=e),!t)return{success:!1,errors:[`The uploaded file does not match the required schema structure.`]};let a=[];n.length>0&&(a=[...n],n=n.map(e=>{let{binaryData:t,...n}=e;return n}));let o=we(t,r),s=Ce(o.key,o.taxa);return this.state.title=i,this.activeProjectUid=P(),this.persistedTitle=``,this.state.dichotomousKey=s.key,this.state.figures=n,this.state.taxa=s.taxa,A.resetActiveImageCache(),this.resetTrackingContext(),this.markChanged(),{success:!0,errors:[],importedFigures:a}}catch(e){return{success:!1,errors:[e instanceof Error?e.message:`Unknown engine exception during parsing the json file.`]}}}setProjectPersistedListener(e){this.onProjectPersisted=e}commitPersistedTitle(e){this.persistedTitle=e,this.onProjectPersisted?.(e)}async createNewProject(e){this.state.title=e,this.activeProjectUid=P(),this.commitPersistedTitle(e),this.state.dichotomousKey=[],this.state.figures=[],this.state.taxa=[],this.resetTrackingContext(),A.resetActiveImageCache(),await this.saveToStorage()}async loadProject(e){let t=await A.loadProject(e);if(t){this.state.title=t.title,this.activeProjectUid=t.projectUid||P(),this.commitPersistedTitle(t.title);let e=we(t.dichotomousKey,ve(t.taxa)),n=Te(e.key,e.taxa);return this.state.dichotomousKey=n.key,this.state.taxa=e.taxa,this.state.figures=t.figures,this.resetTrackingContext(),!0}return!1}getProjectData(){return{dichotomousKey:this.state.dichotomousKey,figures:this.state.figures,taxa:this.state.taxa}}async saveToStorage(){let e=this.mutationRevision,t=this.state.title,n=this.activeProjectUid,r=this.getProjectData(),i=this.persistedTitle&&this.persistedTitle!==t,a=this.persistedTitle;try{await A.saveProject(t,n,r),i&&a&&await A.deleteProjectRecord(a),this.activeProjectUid===n&&(this.commitPersistedTitle(t),this.mutationRevision===e&&this.state.title===t&&this.markSaved())}catch(e){throw console.error(`Failed to save or rename project workspace:`,e),i&&a&&this.activeProjectUid===n&&this.state.title===t&&(this.state.title=a,this.markChanged()),e}}async saveAsProject(e){let t=this.state.title,n=this.activeProjectUid,r=P();try{if(await A.cloneProjectFigures(n,r),this.activeProjectUid!==n)throw Error(`The active project changed while Save As was running.`);this.state.title=e,this.activeProjectUid=r,this.bumpMutationRevision();let t=this.mutationRevision,i=this.getProjectData();await A.saveProject(e,r,i),this.activeProjectUid===r&&(this.commitPersistedTitle(e),this.mutationRevision===t&&this.state.title===e&&this.markSaved())}catch(e){throw console.error(`Save As Operation Failed:`,e),this.activeProjectUid===r&&(this.state.title=t,this.activeProjectUid=n,this.bumpMutationRevision()),e}}async loadFromStorage(e=[],t=[],n=`Untitled Key`,r=[]){let i=n,a=await this.loadProject(i);if(!a){let n=we(e,r),a=Ce(n.key,n.taxa);this.state={title:i,dichotomousKey:a.key,figures:t,taxa:a.taxa},this.persistedTitle=i,this.activeProjectUid=P(),A.resetActiveImageCache(),this.resetTrackingContext()}return a}toggleSelection(e,t){t||this.clearSelectionsExcept(this.coupletSelection),this.coupletSelection.toggle(e,t)}clearSelection(){this.coupletSelection.size!==0&&this.coupletSelection.clear()}setSelectionBatch(e){this.coupletSelection.replace(e)}selectAll(){this.coupletSelection.replace(this.state.dichotomousKey.map(e=>e.id))}runDiagnostics(){return Ne(this.state.dichotomousKey,this.state.figures)}resolveTextReferences(e,t){return pe(e,this.state.figures,t)}encodeFigureTokens(e){return me(e,this.state.figures)}decodeTextReferencesForEditor(e){return he(e,this.state.figures)}},Fe=`dichotomous_key_ui`,Ie={isFiguresHidden:!1,isPrintHidden:!1,isImagesHidden:!1,isTaxaHidden:!1,collapsedPanels:{editor:!1,figures:!1,taxa:!1,print:!1},activeProjectTitle:`Untitled Key`,leadFormat:g,showBackReference:!1,nameDisplayMode:d},Le=class{active=!1;fieldKey=null;timeoutId=null;isActive(){return this.active}getFieldKey(){return this.fieldKey}start(e,t){(!this.active||this.fieldKey!==e)&&(this.clearTimer(),t(),this.active=!0,this.fieldKey=e)}extendTimeout(e,t){this.clearTimer(),this.timeoutId=window.setTimeout(()=>{this.timeoutId=null,this.active=!1,this.fieldKey=null,t()},e)}clearTimer(){this.timeoutId!==null&&(clearTimeout(this.timeoutId),this.timeoutId=null)}end(e,t){return!this.active&&this.fieldKey===null?!1:e===null||this.fieldKey===e?(this.active=!1,this.fieldKey=null,this.clearTimer(),t(),!0):!1}},Re=class{couplets=new Le;figures=new Le;taxa=new Le;clearAll(){this.couplets.clearTimer(),this.figures.clearTimer(),this.taxa.clearTimer()}},ze=class{state;typing=new Re;constructor(){this.state=this.loadFromStorage()}get isFiguresHidden(){return this.state.isFiguresHidden}get isImagesHidden(){return this.state.isImagesHidden}get isTaxaHidden(){return this.state.isTaxaHidden}get nameDisplayMode(){return this.state.nameDisplayMode}get isPrintHidden(){return this.state.isPrintHidden}isPanelCollapsed(e){return this.state.collapsedPanels[e]??!1}get activeProjectTitle(){return this.state.activeProjectTitle||`Untitled Key`}get leadFormat(){return this.state.leadFormat}get showBackReference(){return this.state.showBackReference}setActiveProjectTitle(e){this.state={...this.state,activeProjectTitle:e.trim()},this.persist()}toggleFigures(){this.state={...this.state,isFiguresHidden:!this.state.isFiguresHidden},this.persist()}togglePrint(){this.state={...this.state,isPrintHidden:!this.state.isPrintHidden},this.persist()}toggleImages(){this.state={...this.state,isImagesHidden:!this.state.isImagesHidden},this.persist()}toggleTaxa(){this.state={...this.state,isTaxaHidden:!this.state.isTaxaHidden},this.persist()}togglePanelCollapse(e){let t=!(this.state.collapsedPanels[e]??!1);this.state={...this.state,collapsedPanels:{...this.state.collapsedPanels,[e]:t}},this.persist()}setNameDisplayMode(e){!f(e)||this.state.nameDisplayMode===e||(this.state={...this.state,nameDisplayMode:e},this.persist())}setLeadFormat(e){!_(e)||this.state.leadFormat===e||(this.state={...this.state,leadFormat:e},this.persist())}setShowBackReference(e){this.state.showBackReference!==e&&(this.state={...this.state,showBackReference:e},this.persist())}loadFromStorage(){try{let e=localStorage.getItem(Fe);if(!e)return{...Ie};let t=JSON.parse(e),n={...Ie,...t};return n.collapsedPanels={...Ie.collapsedPanels,...t.collapsedPanels??{}},_(n.leadFormat)||(n.leadFormat=g),f(n.nameDisplayMode)||(n.nameDisplayMode=d),n}catch{return{...Ie}}}persist(){try{localStorage.setItem(Fe,JSON.stringify(this.state))}catch(e){console.warn(`UIStateStore: Failed to persist UI preferences to localStorage.`,e)}}};function Be(e){e.innerHTML=`
    <div class="app-shell">
      <div class="app-menu-bar" role="menubar" aria-label="Application Menu">

        <div class="menu-item" role="none">
          <button id="menu-file-trigger" class="menu-trigger"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded="false">File</button>

          <div class="menu-dropdown" role="menu" aria-labelledby="menu-file-trigger">
            <button id="cmd-new" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>New Key</span>
              <span class="menu-shortcut">${o?`⌘⌥N`:`Ctrl+Alt+N`}</span>
            </button>
            <button id="cmd-open-dialog" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Open Key Workspace...</span>
              <span class="menu-shortcut">${o?`⌘O`:`Ctrl+O`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-save" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Save</span>
              <span class="menu-shortcut">${o?`⌘S`:`Ctrl+S`}</span>
            </button>
            <button id="cmd-save-as" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Save As...</span>
              <span class="menu-shortcut">${o?`⇧⌘S`:`Ctrl+Shift+S`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-trigger-import" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Import Native File (.tskey)...</span>
            </button>
            <button id="cmd-export-json" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Export Native File (.tskey)</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-import-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Import from Plain Text...</span>
            </button>
            <button id="cmd-export-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Export to Plain Text (.txt)</span>
            </button>
            <button id="cmd-export-html" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Export to Web Page (.html)</span>
            </button>
            <button id="cmd-export-latex" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Export to LaTeX Document (.tex)</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-edit-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Edit</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-edit-trigger">
            <button id="cmd-undo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Undo</span>
              <span class="menu-shortcut">${o?`⌘Z`:`Ctrl+Z`}</span>
            </button>
            <button id="cmd-redo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Redo</span>
              <span class="menu-shortcut">${o?`⌘Y / ⌘⇧Z`:`Ctrl+Y / Ctrl+Shift+Z`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-cut" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Cut Selected Steps</span>
              <span class="menu-shortcut">${o?`⌘X`:`Ctrl+X`}</span>
            </button>
            <button id="cmd-copy" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Copy Selected Steps</span>
              <span class="menu-shortcut">${o?`⌘C`:`Ctrl+C`}</span>
            </button>
            <button id="cmd-paste-below" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Paste steps below selection</span>
              <span class="menu-shortcut">${o?`⌘V`:`Ctrl+V`}</span>
            </button>
            <button id="cmd-paste-above" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Paste above selections</span>
              <span class="menu-shortcut">${o?`Shift+⌘V`:`Shift+Ctrl+V`}</span>
            </button>
            <button id="cmd-delete" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Delete Selected Steps and Figures</span>
              <span class="menu-shortcut">Delete</span>
            </button>
            <button id="cmd-swap" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Swap Alternatives</span>
              <span class="menu-shortcut">${o?`Option+S`:`Alt+S`}</span>
            </button>
            <button id="cmd-add" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Append New Step</span>
              <span class="menu-shortcut">Alt+N</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-insert-figref" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Insert Figure Reference</span>
              <span class="menu-shortcut">${o?`Option+F`:`Alt+F`}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-clear" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Clear Selections</span>
              <span class="menu-shortcut">Esc</span>
            </button>
            <button id="cmd-select-all" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Select All Steps</span>
              <span class="menu-shortcut">${o?`⌘A`:`Ctrl+A`}</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-view-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">View</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-view-trigger">
            <button id="cmd-toggle-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Hide Figures Panel</span>
              <span class="menu-shortcut">Ctrl+Shift+F</span>
            </button>
            <button id="cmd-toggle-images" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Hide Images in Figures Panel</span>
            </button>
            <button id="cmd-toggle-taxa" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Hide Taxa Panel</span>
            </button>
            <button id="cmd-toggle-print" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Hide Print Preview</span>
              <span class="menu-shortcut">Ctrl+Shift+P</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-tools-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Tools</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-tools-trigger">
            <button id="cmd-reorder-couplets" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Order Steps</span>
            </button>
            <button id="cmd-reorder-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Order Figures</span>
            </button>
            <button id="cmd-sort-taxa" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Sort Taxa Alphabetically</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-window-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Window</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-window-trigger">
            <button id="cmd-open-shortcuts" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Keyboard Shortcuts...</span>
            </button>
            <button id="cmd-open-options" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>Options &amp; Settings...</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-open-about" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>About ${Oe}...</span>
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
        <div class="editor-column" data-panel="editor">
          <h2 class="panel-header">
            <button type="button" class="panel-toggle" aria-expanded="true" title="Collapse / expand panel">
              <span class="panel-caret" aria-hidden="true">▾</span>
              <span class="panel-title">Key Editor: <span id="active-project-title">Untitled Key</span></span>
            </button>
          </h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step (Alt+N)</button>
        </div>

        <div class="figure-column" data-panel="figures">
          <h2 class="panel-header">
            <button type="button" class="panel-toggle" aria-expanded="true" title="Collapse / expand panel">
              <span class="panel-caret" aria-hidden="true">▾</span>
              <span class="panel-title">Figure References</span>
            </button>
          </h2>
          <div id="figure-container"></div>
          <button id="add-figure-btn" class="btn-add-block">+ Add New Figure</button>
        </div>

        <div class="taxa-column" data-panel="taxa">
          <h2 class="panel-header">
            <button type="button" class="panel-toggle" aria-expanded="true" title="Collapse / expand panel">
              <span class="panel-caret" aria-hidden="true">▾</span>
              <span class="panel-title">Taxa</span>
            </button>
          </h2>
          <div id="taxa-container"></div>
          <button id="add-taxon-btn" class="btn-add-block">+ Add New Taxon</button>
        </div>

        <div class="print-column" data-panel="print">
          <h2 class="panel-header">
            <button type="button" class="panel-toggle" aria-expanded="true" title="Collapse / expand panel">
              <span class="panel-caret" aria-hidden="true">▾</span>
              <span class="panel-title">Live Publication View</span>
            </button>
          </h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>

      </div>
    </div>

    <div id="modal-open-project" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-open-project-title">
      <div class="modal-window hub-modal-window">
        <div class="modal-header">
          <h3 id="modal-open-project-title">Open Key Workspace</h3>
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
          <h3 id="modal-shortcuts-title">Keyboard Shortcuts</h3>
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
          <h3 id="modal-options-title">Options &amp; Settings</h3>
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
          <h3 id="modal-about-title">About</h3>
          <button id="modal-about-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body about-modal-body">
          <h4 class="about-title">${Oe}</h4>
          <p class="about-version">
            Version ${ke} (2026 Engine Core)
          </p>
          <p class="about-description">
            An interactive editor for writing classical dichotomous keys used to identify taxonomic units on morphological characters.
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
        <h3 id="pt-import-title-label">Import Key from Plain Text</h3>
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
              <button id="pt-import-load-file" class="btn btn-secondary">Load .txt File...</button>
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
    `}function Ve(e){document.querySelector(`.figure-column`)?.classList.toggle(`is-hidden`,e.isFiguresHidden),document.querySelector(`.taxa-column`)?.classList.toggle(`is-hidden`,e.isTaxaHidden),document.querySelector(`.print-column`)?.classList.toggle(`is-hidden`,e.isPrintHidden);for(let t of[`editor`,`figures`,`taxa`,`print`]){let n=document.querySelector(`[data-panel="${t}"]`);if(!n)continue;let r=e.isPanelCollapsed(t);n.classList.toggle(`is-collapsed`,r),n.querySelector(`.panel-toggle`)?.setAttribute(`aria-expanded`,r?`false`:`true`)}}function F(e,t,n,r=!1){let i=e.querySelector(t);return i?((r||document.activeElement!==i)&&i.value!==n&&(i.value=n),i):null}function He(e){let{container:t,items:n,getId:r,create:i,update:a,onRemove:o}=e,s=new Map;for(let e of Array.from(t.children)){let t=e.getAttribute(`data-id`);if(t===null)continue;let n=Number(t);Number.isNaN(n)||s.set(n,e)}n.forEach((e,n)=>{let o=r(e),c=s.get(o);c?s.delete(o):c=i(e,n),t.children[n]!==c&&t.insertBefore(c,t.children[n]??null),a?.(c,e,n)}),s.forEach(e=>{o?.(e),e.remove()})}function I(e,t=`success`){let n=document.querySelector(`.toast-container`);n||(n=document.createElement(`div`),n.className=`toast-container`,n.setAttribute(`aria-live`,`polite`),document.body.appendChild(n));let r=document.createElement(`div`);r.className=`toast toast-${t}`,r.textContent=e,t===`error`?r.setAttribute(`role`,`alert`):r.setAttribute(`role`,`status`),n.appendChild(r),setTimeout(()=>{r.remove(),n&&n.childElementCount===0&&n.remove()},3e3)}function Ue(e,t){if(!document.querySelector(`.app-menu-bar`))return;let n=e=>document.getElementById(e),r=e.getSelectedCoupletIds().size,i=e.getSelectedFigureIds().size,a=e.getSelectedTaxonIds().size,o=r>0||i>0||a>0,s=r>0,c=e.getKey().length>0,l=e.hasClipboardData(),u=e.getTitle(),d=e.hasUnsavedChanges(),f=`${u}${d?` *`:``}`;document.title=`${f} - ${Oe}`;let p=document.getElementById(`active-project-title`);p&&p.textContent!==f&&(p.textContent=f);let m=n(`cmd-save`),h=n(`cmd-export-json`),g=n(`cmd-export-text`),_=n(`cmd-export-html`),v=n(`cmd-export-latex`),y=n(`cmd-undo`),b=n(`cmd-redo`),x=n(`cmd-cut`),S=n(`cmd-copy`),C=n(`cmd-paste-below`),w=n(`cmd-paste-above`),T=n(`cmd-delete`),E=n(`cmd-swap`),D=n(`cmd-clear`),O=n(`cmd-reorder-couplets`),k=n(`cmd-reorder-figures`),A=n(`cmd-sort-taxa`);m&&m.classList.toggle(`has-unsaved-changes`,d),h&&(h.disabled=!c),g&&(g.disabled=!c),_&&(_.disabled=!c),v&&(v.disabled=!c),y&&(y.disabled=!e.canUndo),b&&(b.disabled=!e.canRedo),x&&(x.disabled=!s),S&&(S.disabled=!s),T&&(T.disabled=!o),E&&(E.disabled=!s),D&&(D.disabled=!o),C&&(C.disabled=!l),w&&(w.disabled=!l),O&&(O.disabled=!c),k&&(k.disabled=!c||e.getFigures().length===0),A&&(A.disabled=e.getTaxa().length<2);let j=n(`cmd-toggle-figures`),ee=n(`cmd-toggle-images`),te=n(`cmd-toggle-taxa`),M=n(`cmd-toggle-print`);if(j){let e=j.querySelector(`span`);e&&(e.textContent=t.isFiguresHidden?`Show Figures Panel`:`Hide Figures Panel`)}if(ee){let e=ee.querySelector(`span`);e&&(e.textContent=t.isImagesHidden?`Show Images in Figures Panel`:`Hide Images in Figures Panel`)}if(te){let e=te.querySelector(`span`);e&&(e.textContent=t.isTaxaHidden?`Show Taxa Panel`:`Hide Taxa Panel`)}if(M){let e=M.querySelector(`span`);e&&(e.textContent=t.isPrintHidden?`Show Print Preview`:`Hide Print Preview`)}let ne=document.querySelector(`.app-shell`);ne&&F(ne,`#key-title-input`,e.getTitle())}function We(e,t){let n=document.getElementById(`project-hub-list`);if(n){if(e.length===0){n.innerHTML=`<div class="hub-empty">No keys saved inside local browser memory yet.</div>`;return}n.innerHTML=e.map(e=>{let n=e.name===t,r=new Date(e.lastModified).toLocaleString(),a=i(e.name);return`
            <div class="project-hub-item${n?` is-current`:``}" data-name="${a}">
                <div class="hub-item-clickable-zone" data-action="load" data-name="${a}">
                    <span class="hub-item-name">${a}${n?` <small class="hub-item-active-tag">(active)</small>`:``}</span>
                    <span class="hub-item-date">Last saved: ${r}</span>
                </div>
                <button class="btn-hub-delete" data-action="delete" data-name="${a}" title="Delete from local database">&times;</button>
            </div>
        `}).join(``)}}function Ge(e,t,n,r,i=e.length){if(n===r&&r.length===1){let n=r,a=!1,o=t;for(;o<i;){if(e[o]!==n){o++;continue}let t=o;for(;t+1<i&&e[t+1]===n;)t++;if(t===o)return o;if(a)a=!1;else{let r=n.repeat(t-o+1),s=e.indexOf(r,t+1);if(s!==-1&&s+r.length<=i)a=!0;else return o}o=t+1}return-1}let a=e.indexOf(r,t);return a!==-1&&a+r.length<=i?a:-1}function Ke(e,t,n,r,i){let a=r,o=r;for(;o<i;){let r=n.get(o);r&&r.end<=i?(o>a&&e.push({kind:`text`,value:t.slice(a,o)}),e.push(r.atom),o=r.end,a=o):o++}i>a&&e.push({kind:`text`,value:t.slice(a,i)})}function qe(e,t,n,r,i){let{open:a,close:o}=r;if(a!==o||a.length<2||![...a].every(e=>e===a[0]))return n;let s=a[0],c=0;for(;t+c<i&&e[t+c]===s;)c++;if(c===0)return n;let l=0;for(;n+l<i&&e[n+l]===s;)l++;return l>=o.length+c?n+c:n}function Je(e,t,n,r,i,a,o){let s=i,c=i,l=t=>{t>c&&Ke(o,e,r,c,t)};for(;s<a;){let i=!1;for(let u of n){if(s+u.open.length>a||!t.startsWith(u.open,s))continue;let d=s+u.open.length,f=Ge(t,d,u.open,u.close,a);if(f<=d)continue;f=qe(t,d,f,u,a),l(s);let p=[];Je(e,t,n,r,d,f,p),o.push({kind:`mark`,mark:u,children:p}),s=f+u.close.length,c=s,i=!0;break}i||s++}l(a)}function Ye(e,t,n){let r=[];for(let n of t.tokens){let t=n.pattern.flags.includes(`g`)?n.pattern.flags:n.pattern.flags+`g`,i=new RegExp(n.pattern.source,t),a;for(;(a=i.exec(e))!==null;){if(a[0]===``){i.lastIndex++;continue}let{html:e,className:t}=n.render(a);r.push({start:a.index,end:a.index+a[0].length,atom:{kind:`token`,src:a[0],html:e,className:t}})}}r.sort((e,t)=>e.start-t.start||t.end-t.start-(e.end-e.start));let i=[],a=0;for(let e of r)e.start<a||n!=null&&e.start<n&&n<e.end||(i.push(e),a=e.end);return i}function Xe(e,t,n){for(let r of Ye(e,t))if(r.start<n&&n<r.end)return{start:r.start,end:r.end};return null}function Ze(e,t){if(t.length===0)return e;let n=e.split(``);for(let e of t)for(let t=e.start;t<e.end;t++)n[t]=` `;return n.join(``)}function Qe(e,t){return Ze(e,Ye(e,t))}function $e(e,t,n){if(!e)return[];let r=Ye(e,t,n),i=Ze(e,r),a=new Map(r.map(e=>[e.start,e])),o=[...t.marks].sort((e,t)=>t.open.length-e.open.length),s=[];return Je(e,i,o,a,0,e.length,s),s}function et(e){let t=``;for(let n of e)if(n.kind===`text`)t+=i(n.value);else if(n.kind===`token`)t+=`<span class="${i(n.className)}" contenteditable="false" draggable="true" data-src="${i(n.src)}">${n.html}</span>`;else{let{tag:e,open:r,close:a,className:o}=n.mark,s=o?` class="${i(o)}"`:``;t+=`<${e}${s} data-open="${i(r)}" data-close="${i(a)}">`+et(n.children)+`</${e}>`}return t}var L=Node.TEXT_NODE,tt=Node.ELEMENT_NODE;function nt(e){return e.dataset.src!==void 0}var rt=e=>(e.dataset.src??``).length,it=e=>(e.dataset.open??``).length,at=e=>(e.dataset.close??``).length;function ot(e){if(e.nodeType===L)return(e.textContent??``).length;let t=e;if(nt(t))return rt(t);let n=it(t)+at(t);for(let e of Array.from(t.childNodes))n+=ot(e);return n}function st(e){let t=``;for(let n of Array.from(e.childNodes))if(n.nodeType===L)t+=n.textContent??``;else if(n.nodeType===tt){let e=n;nt(e)?t+=e.dataset.src??``:t+=(e.dataset.open??``)+st(e)+(e.dataset.close??``)}return t}function ct(e){let t=[],n=[],r=0,i=e=>{n.push({src:r,container:e,offset:0}),Array.from(e.childNodes).forEach((a,o)=>{if(a.nodeType===L){let e=(a.textContent??``).length;t.push({node:a,start:r,end:r+e}),r+=e}else if(a.nodeType===tt){let e=a;nt(e)?r+=rt(e):(r+=it(e),i(e),r+=at(e))}n.push({src:r,container:e,offset:o+1})})};return i(e),{stops:t,positions:n}}function lt(e,t,n){let r=t;for(;r&&r!==e;){if(r.nodeType===tt&&nt(r)){let e=r.parentNode;if(!e)break;let i=Array.prototype.indexOf.call(e.childNodes,r);t=e,n=i+(n===0?0:1);break}r=r.parentNode}let i=0,a=!1,o=e=>{if(!a){if(e===t&&e.nodeType!==L){for(let t=0;t<n;t++)i+=ot(e.childNodes[t]);a=!0;return}for(let r of Array.from(e.childNodes)){if(a)return;if(r===t&&r.nodeType===L){i+=n,a=!0;return}if(r.nodeType===L)i+=(r.textContent??``).length;else if(r.nodeType===tt){let e=r;if(nt(e))i+=rt(e);else{if(i+=it(e),o(e),a)return;i+=at(e)}}}}};return o(e),i}function ut(e,t){let n=t.parentNode;if(!n)return null;let r=Array.prototype.indexOf.call(n.childNodes,t);return r<0?null:{start:lt(e,n,r),end:lt(e,n,r+1)}}function dt(e){let t=window.getSelection();if(!t||t.rangeCount===0)return null;let n=t.getRangeAt(0);if(!e.contains(n.startContainer)||!e.contains(n.endContainer))return null;let r=lt(e,n.startContainer,n.startOffset),i=lt(e,n.endContainer,n.endOffset);return{start:Math.min(r,i),end:Math.max(r,i)}}function ft(e,t,n,r){for(let e of n)if(t>=e.start&&t<=e.end)return{node:e.node,offset:t-e.start};if(r.length===0)return{node:e,offset:0};let i=r[0],a=Math.abs(i.src-t);for(let e of r){let n=Math.abs(e.src-t);(n<a||n===a&&e.src<=t)&&(i=e,a=n)}return{node:i.container,offset:i.offset}}function pt(e,t,n){let r=window.getSelection();if(!r)return;let{stops:i,positions:a}=ct(e),o=ft(e,t,i,a),s=t===n?o:ft(e,n,i,a),c=document.createRange();c.setStart(o.node,o.offset),c.setEnd(s.node,s.offset),r.removeAllRanges(),r.addRange(c)}function mt(e,t){let{open:n,close:r}=t,i=n===r&&n.length===1,a=[],o=0;for(;o<e.length;){if(i&&e[o]===n){let t=o;for(;t+1<e.length&&e[t+1]===n;)t++;if(t>o){if((t-o+1)%2==0){o=t+1;continue}o=t}}if(e.startsWith(n,o)){let t=o+n.length,i=Ge(e,t,n,r);if(i>t){a.push({start:o,end:i+r.length,contentStart:t,contentEnd:i}),o=i+r.length;continue}}o++}return a}function ht(e,t,n,r=e){let{open:i,close:a}=n,{start:o,end:s}=t,c=mt(r,n),l=o===s?c.find(e=>o>e.start&&o<e.end):c.find(e=>o>=e.start&&s<=e.end&&o<e.contentEnd&&s>e.contentStart);if(l){let t=e.slice(l.contentStart,l.contentEnd),n=e.slice(0,l.start)+t+e.slice(l.end),r=e=>Math.min(Math.max(e-i.length,l.start),l.start+t.length);return{value:n,selection:{start:r(o),end:r(s)}}}if(o===s){let t=e.slice(0,o)+i+a+e.slice(s),n=o+i.length;return{value:t,selection:{start:n,end:n}}}let u=c.filter(e=>e.start<s&&o<e.end),d=Math.min(o,...u.map(e=>e.start)),f=Math.max(s,...u.map(e=>e.end)),p=u.flatMap(e=>[{at:e.start,len:i.length},{at:e.contentEnd,len:a.length}]).sort((e,t)=>e.at-t.at),m=``,h=d;for(let t of p)m+=e.slice(h,t.at),h=t.at+t.len;m+=e.slice(h,f);let g=e.slice(0,d)+i+m+a+e.slice(f),_=e=>{let t=0;for(let n of p)if(e>=n.at+n.len)t+=n.len;else if(e>n.at){t+=e-n.at;break}else break;return d+i.length+(e-d-t)};return{value:g,selection:{start:_(o),end:_(s)}}}function gt(e,t,n){let{start:r,end:i}=t,a=e.slice(0,r)+n+e.slice(i),o=r+n.length;return{value:a,selection:{start:o,end:o}}}var _t=`application/x-tskey-richtext-drag`,vt=0,R=null,yt=class{host;schema;value;changeHandlers=new Set;rafId=null;composing=!1;editingSpan=null;onInput=()=>{this.composing||this.scheduleRerender()};onKeydown=e=>this.handleKeydown(e);onPaste=e=>this.handlePaste(e);onDrop=e=>this.handleDrop(e);onDragOver=e=>{!R||!e.dataTransfer?.types.includes(_t)||(e.preventDefault(),e.dataTransfer&&(e.dataTransfer.dropEffect=`move`))};onDragStart=e=>{let t=(e.target instanceof Element?e.target:null)?.closest(`[data-src]`),n=t&&t!==this.host&&this.host.contains(t)?t:null,r=n?ut(this.host,n):null,i=dt(this.host),a=i&&i.end>i.start&&(!r||r.start>=i.start&&r.end<=i.end),o=a?i:r;if(!o){R=null;return}let s=e.dataTransfer;if(!s){R=null;return}let c=a?this.getValue().slice(o.start,o.end):n.dataset.src??``,l=String(++vt);s.setData(`text/plain`,c),s.setData(_t,l),a||(s.effectAllowed=`move`),R={id:l,editor:this,sel:o,text:c}};onDragEnd=()=>{R=null};onCompositionStart=()=>{this.composing=!0};onCompositionEnd=()=>{this.composing=!1,this.scheduleRerender()};onBlur=()=>{this.composing?(this.composing=!1,this.scheduleRerender()):this.editingSpan&&(this.editingSpan=null,this.scheduleRerender())};onSelectionChange=()=>{this.syncSelectedChips(),this.relockEditingTokenIfExited()};constructor(e,t){this.host=e,this.schema=t.schema,this.value=t.value??``,e.classList.add(`tsk-rte`),e.setAttribute(`contenteditable`,`true`),e.setAttribute(`role`,`textbox`),e.setAttribute(`aria-multiline`,`true`),e.setAttribute(`spellcheck`,`true`),t.placeholder&&(e.dataset.placeholder=t.placeholder),t.onChange&&this.changeHandlers.add(t.onChange),e.addEventListener(`input`,this.onInput),e.addEventListener(`keydown`,this.onKeydown),e.addEventListener(`paste`,this.onPaste),e.addEventListener(`drop`,this.onDrop),e.addEventListener(`dragenter`,this.onDragOver),e.addEventListener(`dragover`,this.onDragOver),e.addEventListener(`dragstart`,this.onDragStart),e.addEventListener(`dragend`,this.onDragEnd),e.addEventListener(`compositionstart`,this.onCompositionStart),e.addEventListener(`compositionend`,this.onCompositionEnd),e.addEventListener(`blur`,this.onBlur),document.addEventListener(`selectionchange`,this.onSelectionChange),this.render()}getValue(){return this.rafId===null?this.value:st(this.host)}hasPendingEdit(){return this.rafId!==null}flushPendingEdit(){if(this.rafId===null&&!this.composing)return;if(this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),!this.composing){this.rerenderFromDom();return}let e=st(this.host);e!==this.value&&(this.value=e,this.emitChange())}setValue(e){if(document.activeElement===this.host&&e===this.getValue())return;let t=this.rafId!==null;if(this.rafId!==null&&(cancelAnimationFrame(this.rafId),this.rafId=null),e===this.value&&!t){this.render();return}this.value=e,this.render()}toggleMark(e){let t=this.schema.marks.find(t=>t.name===e);t&&this.applyCommand(e=>ht(this.value,e,t,Qe(this.value,this.schema)))}insertToken(e,t){this.applyCommand(n=>gt(this.value,t??n,e))}getSelection(){return dt(this.host)}focus(){this.host.focus()}on(e,t){return this.changeHandlers.add(t),()=>this.changeHandlers.delete(t)}destroy(){R?.editor===this&&(R=null),this.rafId!==null&&cancelAnimationFrame(this.rafId),this.host.removeEventListener(`input`,this.onInput),this.host.removeEventListener(`keydown`,this.onKeydown),this.host.removeEventListener(`paste`,this.onPaste),this.host.removeEventListener(`drop`,this.onDrop),this.host.removeEventListener(`dragenter`,this.onDragOver),this.host.removeEventListener(`dragover`,this.onDragOver),this.host.removeEventListener(`dragstart`,this.onDragStart),this.host.removeEventListener(`dragend`,this.onDragEnd),this.host.removeEventListener(`compositionstart`,this.onCompositionStart),this.host.removeEventListener(`compositionend`,this.onCompositionEnd),this.host.removeEventListener(`blur`,this.onBlur),document.removeEventListener(`selectionchange`,this.onSelectionChange),this.host.querySelectorAll(`.tsk-chip-selected`).forEach(e=>e.classList.remove(`tsk-chip-selected`)),this.host.removeAttribute(`contenteditable`),this.changeHandlers.clear()}scheduleRerender(){this.rafId===null&&(this.rafId=requestAnimationFrame(()=>{this.rafId=null,this.rerenderFromDom()}))}rerenderFromDom(){let e=dt(this.host),t=st(this.host),n=t!==this.value;this.value=t;let r=e&&e.start===e.end?e.start:null;this.host.innerHTML=this.renderHtml(r),e&&pt(this.host,e.start,e.end),this.editingSpan=r===null?null:Xe(this.value,this.schema,r),this.syncSelectedChips(),this.host.classList.toggle(`tsk-rte-empty`,this.value.length===0),n&&this.emitChange()}relockEditingTokenIfExited(){if(!this.editingSpan||this.composing||this.rafId!==null)return;let e=dt(this.host);e&&(e.start===e.end&&e.start>this.editingSpan.start&&e.start<this.editingSpan.end||(this.editingSpan=null,this.scheduleRerender()))}renderHtml(e=null){let t=et($e(this.value,this.schema,e));return this.value.endsWith(`
`)&&(t+=`<br>`),t}flushPendingRerender(){this.flushPendingEdit()}applyCommand(e){this.flushPendingRerender();let t=e(dt(this.host)??{start:this.value.length,end:this.value.length}),n=t.value!==this.value;this.value=t.value,this.render(),this.focus(),pt(this.host,t.selection.start,t.selection.end),this.syncSelectedChips(),n&&this.emitChange()}render(){this.editingSpan=null,this.host.innerHTML=this.renderHtml(),this.host.classList.toggle(`tsk-rte-empty`,this.value.length===0)}syncSelectedChips(){let e=this.host.querySelectorAll(`.tsk-chip`);if(e.length===0)return;let t=window.getSelection(),n=t&&t.rangeCount>0?t.getRangeAt(0):null,r=!!t&&!!t.anchorNode&&!!t.focusNode&&this.host.contains(t.anchorNode)&&this.host.contains(t.focusNode);for(let t of e){let e=!1;if(r&&n&&!n.collapsed)try{e=n.intersectsNode(t)}catch{}t.classList.toggle(`tsk-chip-selected`,e)}}handleKeydown(e){if(e.isComposing)return;if(e.key===`Enter`){e.preventDefault(),this.applyCommand(e=>gt(this.value,e,`
`));return}if(!(e.ctrlKey||e.metaKey)||e.altKey)return;let t=e.key.toLowerCase(),n=this.schema.marks.find(e=>e.shortcut===t);n&&(e.preventDefault(),this.toggleMark(n.name))}handlePaste(e){e.preventDefault();let t=e.clipboardData?.getData(`text/plain`)??``;t&&this.applyCommand(e=>gt(this.value,e,t))}handleDrop(e){e.preventDefault();let t=e.dataTransfer,n=t?.getData(_t)??``,r=R?.id===n?R:null;R=null;let i=r?.text??t?.getData(`text/plain`)??``;if(!i)return;let a=r&&r.sel.end>r.sel.start?r:null;r&&t&&(t.dropEffect=`copy`);let o=this.caretRangeAtPoint(e.clientX,e.clientY);if(this.host.focus(),o&&this.host.contains(o.startContainer)){let e=window.getSelection();e?.removeAllRanges(),e?.addRange(o)}a&&a.editor!==this&&a.editor.removeSpan(a.sel,a.text),this.applyCommand(e=>{let t=this.value,n=e.start;a&&a.editor===this&&t.slice(a.sel.start,a.sel.end)===a.text&&(t=t.slice(0,a.sel.start)+t.slice(a.sel.end),n>=a.sel.end?n-=a.sel.end-a.sel.start:n>a.sel.start&&(n=a.sel.start));let r=n+i.length;return{value:t.slice(0,n)+i+t.slice(n),selection:{start:r,end:r}}})}removeSpan(e,t){this.flushPendingRerender(),this.value.slice(e.start,e.end)===t&&(this.value=this.value.slice(0,e.start)+this.value.slice(e.end),this.render(),this.emitChange())}caretRangeAtPoint(e,t){let n=document;if(typeof n.caretRangeFromPoint==`function`)return n.caretRangeFromPoint(e,t);let r=n.caretPositionFromPoint?.(e,t);if(!r)return null;let i=document.createRange();return i.setStart(r.offsetNode,r.offset),i.collapse(!0),i}emitChange(){for(let e of this.changeHandlers)e(this.value)}},bt=[{name:`bold`,open:`**`,close:`**`,tag:`strong`,shortcut:`b`},{name:`italic`,open:`*`,close:`*`,tag:`em`,shortcut:`i`},{name:`subscript`,open:`~`,close:`~`,tag:`sub`},{name:`superscript`,open:`^`,close:`^`,tag:`sup`}];function xt(e){let t=RegExp(`${C().source}|${w().source}`,`gi`),n=typeof e==`function`?e:()=>e;return{name:`figure`,pattern:t,render:e=>{let t,r=n();return r&&(t=e[1]===void 0?E((e[2]??``).trim(),r,r.displayNumToFig.size)?.displayNum:r.idToDisplayNum.get(parseInt(e[1],10))),t===void 0?{html:i(e[0]),className:`tsk-chip tsk-chip-broken`}:{html:i(`(Fig. ${t})`),className:`tsk-chip`}}}}function St(e,t){let n=new yt(e,{schema:t.schema,value:t.value,placeholder:t.placeholder,onChange:t.onChange});return e._rte=n,t.schema.tokens.length>0&&(e.dataset.rteFigures=`true`),n}function Ct(e){return e?e._rte:void 0}function wt(e,t){let n=e._rte;n&&(document.activeElement===e||n.hasPendingEdit()||n.setValue(t))}function Tt(e){let t=[...e.querySelectorAll(`.rte-host`)];e.matches?.(`.rte-host`)&&t.push(e);for(let e of t){let t=e._rte;t&&(t.destroy(),delete e._rte)}}var Et=null,Dt=null;function Ot(e){let t=e.getFigures();return t!==Et&&(Et=t,Dt=T(t)),Dt}function kt(e){return{marks:bt,tokens:[xt(()=>Ot(e))]}}function At(){return{marks:bt,tokens:[]}}function jt(e){for(let t of e.querySelectorAll(`.rte-host`))t._rte?.flushPendingEdit()}var Mt=!1;function z(e){Mt||(Mt=!0,requestAnimationFrame(()=>{Mt=!1,e()}))}function Nt(e){let{session:t,fieldKey:n,endTypingSession:r,applyUpdate:i,onSettle:a,refreshAll:o}=e;t.start(n,r),i(),t.extendTimeout(800,()=>{a?.(),z(o)})}async function Pt(e){let t=e.getTitle();We(await A.getProjectList(),t)}function Ft(e){let{container:t,cardSelector:n,getDraggedId:r,setDraggedId:i,onDrop:a,signal:o}=e,s=null,c=null,l=null,u=0,d=()=>{s&&(s.classList.remove(`drag-drop-above`,`drag-drop-below`),s=null,c=null,l=null)},f=(e,r)=>{let i=r.closest(n);if(!i){d();return}let a=t.scrollTop;(s!==i||!l||u!==a)&&(l=i.getBoundingClientRect(),u=a);let o=e-l.top<l.height/2?`drag-drop-above`:`drag-drop-below`;if(s!==i||c!==o){let e=l;d(),i.classList.add(o),s=i,c=o,l=e}};t.addEventListener(`dragstart`,e=>{let t=e.target instanceof Element?e.target:null;if(t?.closest(`.rte-host, input, textarea`))return;let r=t?.closest(n);r&&(i(Number(r.getAttribute(`data-id`))),requestAnimationFrame(()=>{r.style.opacity=`0.4`}))},{signal:o}),t.addEventListener(`dragend`,e=>{let t=e.target.closest(n);t&&(t.style.opacity=`1`),i(null),d()},{signal:o}),t.addEventListener(`dragover`,e=>{if(r()===null)return;e.preventDefault();let n=t.getBoundingClientRect();e.clientY-n.top<80?t.scrollBy(0,-15):n.bottom-e.clientY<80&&t.scrollBy(0,15),f(e.clientY,e.target)},{signal:o}),t.addEventListener(`dragleave`,e=>{let n=e.relatedTarget;(!n||!t.contains(n))&&d()},{signal:o}),t.addEventListener(`drop`,e=>{e.preventDefault();let t=e.target.closest(n);if(!t)return;let i=r(),o=Number(t.getAttribute(`data-id`));i===null||i===o||a(i,o,t.classList.contains(`drag-drop-above`)?`above`:`below`)},{signal:o})}var It=null;function Lt(){It?.()}function Rt(e){Lt();let t=document.createElement(`div`);t.className=`popover`,t.setAttribute(`role`,`menu`);let n=e.items.map((e,t)=>`<button type="button" class="popover-action ${e.className??``}" data-item-index="${t}">${i(e.label)}</button>`).join(``);t.innerHTML=(e.headerHtml??``)+n,document.body.appendChild(t);let r=t.getBoundingClientRect(),a=Math.max(8,Math.min(e.x,window.innerWidth-r.width-8)),o=Math.max(8,Math.min(e.y,window.innerHeight-r.height-8));t.style.left=`${a}px`,t.style.top=`${o}px`;let s=new AbortController,{signal:c}=s,l=()=>{s.abort(),t.remove(),It===l&&(It=null),e.onClose?.()};return It=l,document.addEventListener(`mousedown`,e=>{t.contains(e.target)||l()},{signal:c}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&(e.preventDefault(),l())},{signal:c}),window.addEventListener(`scroll`,l,{signal:c,capture:!0}),window.addEventListener(`resize`,l,{signal:c}),e.signal.addEventListener(`abort`,l,{signal:c}),t.addEventListener(`click`,t=>{let n=t.target,r=n.closest(`[data-step-id]`);if(r&&e.onCrumbSelect){let t=Number(r.getAttribute(`data-step-id`));l(),e.onCrumbSelect(t);return}let i=n.closest(`[data-item-index]`);if(i){let t=Number(i.getAttribute(`data-item-index`)),n=e.items[t];l(),n?.onSelect()}},{signal:c}),l}var zt=new Map(bt.map(e=>[e.name,e.tag]));function Bt(e,t){let n=zt.get(e);return n?`<${n}>${t}</${n}>`:t}function B(e,t){let n=``;for(let r of e)r.kind===`text`?n+=t.text(r.value):r.kind===`fig`?n+=t.fig(r):r.kind===`brokenFig`?n+=t.brokenFig(r):n+=t.mark(r.markName,B(r.children,t));return n}function Vt(){return{name:`figure`,pattern:RegExp(`${C().source}|${w().source}`,`gi`),render:()=>({html:``,className:``})}}function Ht(e,t,n){let r=/\[figID:\s*(\d+)\s*\]/i.exec(e);if(r){let e=parseInt(r[1],10),n=t.idToDisplayNum.get(e);return n===void 0?{kind:`brokenFig`,label:`ID ${e}`}:{kind:`fig`,figId:e,displayNum:n}}let i=(/\[fig:\s*([^\]]+?)\s*\]/i.exec(e)?.[1]??``).trim(),a=E(i,t,n);return a?{kind:`fig`,figId:a.figId,displayNum:a.displayNum}:{kind:`brokenFig`,label:i}}function Ut(e,t,n){let r=[];for(let i of e)i.kind===`text`?r.push({kind:`text`,value:i.value}):i.kind===`mark`?r.push({kind:`mark`,markName:i.mark.name,children:Ut(i.children,t,n)}):r.push(Ht(i.src,t,n));return r}function Wt(e,t,n,r){return e?Ut($e(e,{marks:bt,tokens:r?[Vt()]:[]}),t,n):[]}function Gt(e,t){let n=t!==void 0;return Wt(e,T(n?t:[]),t?.length??0,n)}function V(e,t,n){return B(Gt(e,n),t)}var Kt={text:e=>e,fig:e=>`(Fig. ${e.displayNum})`,brokenFig:e=>`[Broken Fig: ${e.label}]`,mark:(e,t)=>t};function qt(e,t){return V(e,Kt,t)}function Jt(e,t){let n=e.scientificName.trim(),r=e.vernacularName.trim(),i={name:n,isScientific:!0,auctor:e.auctor.trim()},a={name:r,isScientific:!1,auctor:``};return t===`vernacular`&&r?{heading:a,secondary:n?{...i,label:`Scientific name`}:null}:n?{heading:i,secondary:r?{...a,label:`Vernacular name`}:null}:{heading:r?a:{name:`Untitled taxon`,isScientific:!1,auctor:``},secondary:null}}function Yt(e,t){let n=e.getKey(),r=e.getFigures(),i=e.getTaxa(),a=u(n),o=T(r),s=r.length,c=t.showBackReference?v(n):null,l=p(i,t.nameMode),d=n.map((e,n)=>{let r=n+1,{lead1:i,lead2:u}=y(t.leadFormat,r,c?.get(e.id));return{id:e.id,displayNum:r,lead1:i,lead2:u,alt1:Wt(e.alt1,o,s,!0),alt2:Wt(e.alt2,o,s,!0),dest1:h(e.branch1,a,l),dest2:h(e.branch2,a,l)}});return{title:e.getTitle(),isEmpty:n.length===0,couplets:d,taxa:i,figures:r}}function Xt(e){e.classList.remove(`nav-flash`),e.offsetWidth,e.classList.add(`nav-flash`);let t=()=>e.classList.remove(`nav-flash`);e.addEventListener(`animationend`,t,{once:!0}),window.setTimeout(t,1200)}function Zt(e){let t=document.querySelector(e);return t?(t.scrollIntoView({behavior:`smooth`,block:`center`}),Xt(t),!0):!1}function Qt(e,t){let n=[[w(),`raw`],[C(),`id`]];for(let[r,i]of n){let n;for(;(n=r.exec(e))!==null;){let e=n.index,r=n.index+n[0].length;if(t>=e&&t<=r)return{start:e,end:r,value:n[1].trim(),form:i}}}return null}function $t(e){return Zt(`.key-card[data-id="${e}"]`)}function en(e,t){let{displayNumToFig:n,filenameToFig:r}=T(t.getFigures()),i=parseInt(e,10);return!isNaN(i)&&String(i)===e?n.get(i)?.id??null:r.get(e.toLowerCase())?.id??null}async function tn(e,t,n,r,a,o){if(!n.isFiguresHidden&&Zt(`.figure-card[data-id="${e}"]`))return;let s=t.getFigures(),c=s.findIndex(t=>t.id===e);if(c===-1)return;let l=s[c],u=c+1,d=j.get(e)??null,f=null;if(!d){let n=await A.getFigureBinary(t.getActiveProjectUid(),e);n&&(d=URL.createObjectURL(n),f=d)}Rt({x:r,y:a,headerHtml:`<div class="popover-fig-title">Fig. ${u}</div>${d?`<img class="popover-fig-img" src="${d}" alt="${i(l.filename||`Figure ${u}`)}" />`:`<div class="popover-note">No image uploaded for this figure.</div>`}<div class="popover-fig-caption">${i(l.caption||l.filename||`Untitled figure`)}</div>`,items:[],signal:o,onClose:()=>{f&&URL.revokeObjectURL(f)}})}function nn(e,n,r){document.addEventListener(`click`,i=>{if(!(i.ctrlKey||i.metaKey))return;let a=i.target,o=()=>{i.preventDefault(),i.stopPropagation()},s=a.closest(`.badge-link[data-step-id]`);if(s){o(),$t(Number(s.getAttribute(`data-step-id`)));return}let c=a.closest(`.fig-ref[data-fig-id]`);if(c){o(),tn(Number(c.getAttribute(`data-fig-id`)),e,n,i.clientX,i.clientY,r);return}let l=t=>t?e.getKey().find(e=>e.id===Number(t.getAttribute(`data-id`))):void 0,u=a.closest(`.input-destination`);if(u){let e=l(u.closest(`.key-card`)),n=e&&(u.dataset.field===`dest1`?e.branch1:e.branch2),r=n?t(n):null;r!==null&&(o(),$t(r));return}let d=a.closest(`.print-dest`);if(d){let e=d.closest(`.print-row`),n=l(d.closest(`.print-step-block`)),r=n&&e&&(e.getAttribute(`data-choice`)===`1`?n.branch1:n.branch2),i=r?t(r):null;i!==null&&(o(),$t(i));return}let f=a.closest(`.rte-host .tsk-chip[data-src]`);if(f){let t=Qt(f.getAttribute(`data-src`)??``,0),a=null;if(t)if(t.form===`id`){let n=parseInt(t.value,10);a=e.getFigures().some(e=>e.id===n)?n:null}else a=en(t.value,e);a!==null&&(o(),tn(a,e,n,i.clientX,i.clientY,r))}},{signal:r,capture:!0})}function rn(e,t,n){document.addEventListener(`contextmenu`,r=>{let a=r.target;if(a.closest(`input, textarea, .rte-host`))return;let o=a.closest(`.key-card`)||a.closest(`.print-step-block`);if(!o)return;let s=Number(o.getAttribute(`data-id`));if(!Number.isFinite(s))return;r.preventDefault();let c=e.getKey(),l=Me(c,s),d=(u(c).get(s)??0)+1,f;f=l.reachable?`<div class="popover-path">${l.steps.map(t=>{let n=`${t.stepNum}${t.choice??``}`;if(t.choice===void 0)return`<div class="popover-path-row is-target"><span class="popover-path-num">${n}</span><span class="popover-path-text">(this step)</span></div>`;let r=c.find(e=>e.id===t.id),a=qt(r?t.choice===`a`?r.alt1:r.alt2:``,e.getFigures()).trim()||`(no description)`;return`<button type="button" class="popover-path-row" data-step-id="${t.id}"><span class="popover-path-num">${i(n)}</span><span class="popover-path-text">${i(a)}</span></button>`}).join(``)}</div>`:`<div class="popover-note">Step ${d} is unreachable from step 1.</div>`;let p=[{label:`Go to step ${d}`,onSelect:()=>$t(s)}];l.reachable&&l.steps.length>1&&p.push({label:`Select whole path`,onSelect:()=>{e.setSelectionBatch(l.steps.map(e=>e.id)),z(t)}}),Rt({x:r.clientX,y:r.clientY,headerHtml:f,items:p,onCrumbSelect:e=>$t(e),signal:n})},{signal:n})}var an=null,on=null;async function sn(){await on?.()}function cn(e,t,n){let r=document.getElementById(`key-title-input`);if(!r)return;let i=null,a=()=>i||(i=(async()=>{e.endTypingSession();let n=r.value.trim();if(!n){r.value=e.getTitle();return}let i=e.getPersistedTitle().toLowerCase();if((await A.getProjectList()).some(e=>{let t=e.name.toLowerCase();return t===n.toLowerCase()&&t!==i})){I(`⚠️ A project named "${n}" already exists. Reverted the title.`,`error`),r.value=e.getTitle();return}e.setTitle(n),z(t)})().finally(()=>{i=null}),i);on=a,n.addEventListener(`abort`,()=>{on===a&&(on=null)},{once:!0}),r.addEventListener(`blur`,a,{signal:n}),r.addEventListener(`keydown`,t=>{t.key===`Enter`?(t.preventDefault(),a(),r.blur()):t.key===`Escape`&&(t.preventDefault(),r.value=e.getTitle(),r.blur())},{signal:n})}function ln(e,t,n){let r=e.getKey().find(e=>e.id===t);if(!r)return;let i=e.encodeFigureTokens(r[n]);i!==r[n]&&e.updateCouplet(t,{[n]:i})}function un(e,t,n,r,i,a){e.setActiveCouplet(r),Nt({session:t.typing.couplets,fieldKey:`${r}-${i}`,endTypingSession:()=>e.endTypingSession(),applyUpdate:()=>e.updateCouplet(r,{[i]:a}),onSettle:()=>ln(e,r,i),refreshAll:n})}function dn(e,t,n,r){e.addEventListener(`click`,e=>{let r=e.target,i=r.closest(`.btn-create-taxon`);if(i){let e=i.closest(`.key-card`),r=i.getAttribute(`data-for`);if(e&&(r===`dest1`||r===`dest2`)){let a=Number(e.getAttribute(`data-id`)),o=r===`dest1`?`branch1`:`branch2`,s=i.getAttribute(`data-name-field`)===`vernacular`?`vernacular`:`scientific`,c=t.createTaxonForBranch(a,o,s);if(n(),c!==null){let e=`.taxon-card[data-id="${c}"]`;Zt(e);let t=s===`vernacular`?`vernacularName`:`scientificName`;document.querySelector(`${e} input[data-field="${t}"]`)?.focus()}}return}if(r.id===`editor-container`){t.clearSelection(),z(n);return}if(r.closest(`input, textarea, .rte-host`))return;let a=r.closest(`.key-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=e.ctrlKey||e.metaKey||e.shiftKey;t.toggleSelection(o,s),z(n)},{signal:r})}function fn(e,t,n,r,i){e.addEventListener(`input`,e=>{let i=e.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.key-card`);if(!a)return;let o=i.getAttribute(`data-field`);if(o!==`dest1`&&o!==`dest2`)return;let s=Number(a.getAttribute(`data-id`)),c=`${s}-${o}`;t.setActiveCouplet(s),n.typing.couplets.start(c,()=>{t.endTypingSession()});let l=o===`dest1`?`branch1`:`branch2`,d=b(i.value,t.getKey());if(d.kind===`taxonDraft`){let e=ge(t.getTaxa(),d.name);e&&(d={kind:`taxon`,taxonId:e.id})}t.updateCouplet(s,{[l]:d}),n.typing.couplets.extendTimeout(800,()=>{let e=t.getKey(),a=e.find(e=>e.id===s);if(a){let r=u(e),o=p(t.getTaxa(),n.nameDisplayMode),s=h(a[l],r,o);i.classList.toggle(`input-error`,s.isUnresolved)}z(r)})},{signal:i})}function pn(e,t,n,r,i){e.addEventListener(`focusin`,e=>{let n=e.target;if(n.matches(`input, textarea, .rte-host`)){let e=n.closest(`.key-card`);if(!e)return;e.draggable=!1;let i=Number(e.getAttribute(`data-id`));t.setActiveCouplet(i),i!==an&&(an=i,z(r)),n.classList.contains(`input-destination`)&&n instanceof HTMLInputElement&&queueMicrotask(()=>{document.activeElement===n&&n.select()})}},{signal:i}),e.addEventListener(`focusout`,e=>{let i=e.target;if(i.matches(`input, textarea, .rte-host`)){let a=i.closest(`.key-card`);a&&(a.draggable=!0);let o=a?Number(a.getAttribute(`data-id`)):null,s=i.getAttribute(`data-field`),c=o&&s?`${o}-${s}`:null;n.typing.couplets.end(c,()=>{(s===`alt1`||s===`alt2`)&&o!==null&&ln(t,o,s)});let l=e.relatedTarget,u=l instanceof Element&&l.closest(`.key-card`),d=u||l instanceof Element&&(l.closest(`.app-menu-bar`)||l.closest(`#add-couplet-btn`));u||(an=null,t.clearActiveCouplet()),d||z(r)}},{signal:i})}function mn(e,t,n,r){Ft({container:e,cardSelector:`.key-card`,getDraggedId:()=>t.draggedCoupletId,setDraggedId:e=>e===null?t.stopDraggingCouplet():t.startDraggingCouplet(e),signal:r,onDrop:(e,r,i)=>{t.reorderCouplets(e,r,i),z(n)}})}function hn(e,t){let n=e.addCouplet();t(),(document.querySelector(`.key-card[data-id="${n}"]`)?.querySelector(`.rte-host[data-field="alt1"]`))?.focus()}function gn(e,t,n){let r,i=e.getSelectedCoupletIds(),a=e.getKey(),o=a.filter(e=>i.has(e.id));o.length>0?r=n===`below`?o[o.length-1].id:o[0].id:a.length>0&&(r=n===`above`?a[0].id:a[a.length-1].id),e.pasteCouplets(r,n)&&(I(`Pasted steps ${o.length>0?`${n} selection`:n===`above`?`at the beginning`:`at the end`}.`,`success`),z(t))}var _n={alt1:`Enter diagnostic trait details [fig: 1]...`,alt2:`Enter contrast alternative description...`};function vn(e,t,n,r,i){[`alt1`,`alt2`].forEach(a=>{let o=e.querySelector(`.rte-host[data-field="${a}"]`);o&&St(o,{schema:kt(n),value:n.decodeTextReferencesForEditor(t[a]),placeholder:_n[a],onChange:e=>un(n,r,i,t.id,a,e)})})}function yn(e,t,n){let r=e.querySelector(`.create-taxon-group[data-for="${t}"]`);r&&(r.hidden=!n)}function bn(e){return`
        <div class="create-taxon-group" data-for="${e}" hidden>
          <button type="button" class="btn-create-taxon" data-for="${e}" data-name-field="scientific" title="Create a taxon card with this scientific name">＋ scientific name</button>
          <button type="button" class="btn-create-taxon" data-for="${e}" data-name-field="vernacular" title="Create a taxon card with this vernacular name">＋ vernacular name</button>
        </div>`}function xn(e){let t=document.createElement(`div`);return t.className=`key-card`,t.draggable=!0,t.setAttribute(`data-id`,e.id.toString()),t.innerHTML=`
        <div class="card-header">
          <div class="card-header-left">
            <h4 class="card-title"></h4>
            <span class="badge"></span>
          </div>
          <span class="drag-handle">☰</span>
        </div>
        <div class="card-row">
          <div class="rte-host card-rte" data-field="alt1"></div>
          <div class="card-meta-pane">
            <label class="meta-label">→
              <input type="text" class="input-sync input-destination" data-field="dest1" placeholder="Taxon or Step #" />
            </label>
            ${bn(`dest1`)}
          </div>
        </div>
        <div class="card-row">
          <div class="rte-host card-rte" data-field="alt2"></div>
          <div class="card-meta-pane">
            <label class="meta-label">→
              <input type="text" class="input-sync input-destination" data-field="dest2" placeholder="Taxon or Step #" />
            </label>
            ${bn(`dest2`)}
          </div>
        </div>
    `,t}function Sn(e,n,r){let a=document.getElementById(`editor-container`);if(!a)return;let o=e.getKey(),s=e.getSelectedCoupletIds(),c=e.runDiagnostics(),l=u(o),d=e.generateInboundLinksMap(),f=p(e.getTaxa(),n.nameDisplayMode),m=s.size===1?[...s][0]:s.size===0?e.getActiveCoupletId():null,g=new Set,_=new Set;if(m!==null){let e=o.find(e=>e.id===m);if(e){let n=t(e.branch1);n!==null&&g.add(n);let r=t(e.branch2);r!==null&&g.add(r)}o.forEach(e=>{(t(e.branch1)===m||t(e.branch2)===m)&&_.add(e.id)})}He({container:a,items:o,getId:e=>e.id,create:t=>{let i=xn(t);return vn(i,t,e,n,r),i},update:(t,n,r)=>{let a=r+1,u=d.get(n.id)||[],p=h(n.branch1,l,f),v=h(n.branch2,l,f),y=c.get(n.id)||[],b=`${a}.`,x=u.length||r===0?`badge badge-linked`:`badge badge-isolated`,S=u.length?`← ${u.map(e=>{let t=o[parseInt(e,10)-1]?.id;return t===void 0?i(e):`<span class="badge-link" data-step-id="${t}">${i(e)}</span>`}).join(`, `)}`:r===0?`🏁 root`:`⚠️ isolated`,C=``;y.forEach(e=>{let t=e.severity===`error`?`error-text`:`warning-text`;C+=`<div class="${t}">⚠️ ${i(e.message)}</div>`}),t.classList.toggle(`is-selected`,s.has(n.id)),t.classList.toggle(`is-link-out`,n.id!==m&&g.has(n.id)),t.classList.toggle(`is-link-in`,n.id!==m&&_.has(n.id));let w=t.querySelector(`.card-title`);w&&w.textContent!==b&&(w.textContent=b);let T=t.querySelector(`.badge`);T&&(T.className!==x&&(T.className=x),T.innerHTML!==S&&(T.innerHTML=S));let E=t.querySelector(`.rte-host[data-field="alt1"]`);E&&(E.setAttribute(`aria-label`,`Step ${a}, first alternative description`),wt(E,e.decodeTextReferencesForEditor(n.alt1)));let D=F(t,`input[data-field="dest1"]`,p.inputValue);D?.setAttribute(`aria-label`,`Step ${a}, first alternative destination`),D?.classList.toggle(`input-error`,p.isUnresolved),D?.classList.toggle(`input-taxon-unlinked`,!!p.isUnlinkedTaxon),yn(t,`dest1`,p.isUnlinkedTaxon);let O=t.querySelector(`.rte-host[data-field="alt2"]`);O&&(O.setAttribute(`aria-label`,`Step ${a}, second alternative description`),wt(O,e.decodeTextReferencesForEditor(n.alt2)));let k=F(t,`input[data-field="dest2"]`,v.inputValue);k?.setAttribute(`aria-label`,`Step ${a}, second alternative destination`),k?.classList.toggle(`input-error`,v.isUnresolved),k?.classList.toggle(`input-taxon-unlinked`,!!v.isUnlinkedTaxon),yn(t,`dest2`,v.isUnlinkedTaxon);let A=t.querySelector(`.warning-block`);y.length>0?A?A.innerHTML!==C&&(A.innerHTML=C):t.insertAdjacentHTML(`beforeend`,`<div class="warning-block">${C}</div>`):A&&A.remove()},onRemove:Tt})}function Cn(e,t,n){return n===`below`?e<t?t:t+1:e<t?t-1:t}function wn(e){let{container:t,cardSelector:n,addButton:r,fieldKeyPrefix:i,typing:a,signal:o,refreshAll:s,onAdd:c,endTypingSession:l,buildUpdate:u,applyUpdate:d,toggleSelection:f,clearSelection:p,getItems:m,reorder:h,onSettle:g,settleField:_,extraClick:v,keepFocusWithin:y=[]}=e;r?.addEventListener(`click`,()=>{c(),z(s)},{signal:o}),t.addEventListener(`input`,e=>{let t=e.target;if(!t.classList.contains(`input-sync`))return;let r=t.closest(n);if(!r)return;let o=Number(r.getAttribute(`data-id`)),c=t.getAttribute(`data-field`),f=`${i}-${o}-${c}`;a.start(f,l);let p=u(c,t.value);p&&d(o,p),a.extendTimeout(800,()=>{g?.(),z(s)})},{signal:o}),t.addEventListener(`click`,e=>{let r=e.target;if(v?.(r,e))return;if(r===t){p(),z(s);return}let i=r.closest(n);if(!i)return;let a=Number(i.getAttribute(`data-id`)),o=e.ctrlKey||e.metaKey||e.shiftKey;if(r.closest(`input, textarea, .rte-host`)){i.classList.contains(`is-selected`)||(f(a,o),z(s));return}f(a,o),z(s)},{signal:o}),t.addEventListener(`focusin`,e=>{let t=e.target;if(!t.matches(`input, textarea, .rte-host`))return;let r=t.closest(n);r&&(r.draggable=!1)},{signal:o}),t.addEventListener(`focusout`,e=>{let t=e.target;if(!t.matches(`input, textarea, .rte-host`))return;let r=t.closest(n);if(!r)return;r.draggable=!0;let o=Number(r.getAttribute(`data-id`)),c=t.getAttribute(`data-field`),l=o&&c?`${i}-${o}-${c}`:null;a.end(l,()=>{c&&_?.(o,c);let t=g?.()??!1,r=e.relatedTarget,i=[n,`.app-menu-bar`,...y],a=r instanceof Element&&i.some(e=>r.closest(e));(t||!a)&&z(s)})},{signal:o});let b=null;Ft({container:t,cardSelector:n,getDraggedId:()=>b,setDraggedId:e=>{b=e},signal:o,onDrop:(e,t,n)=>{let r=m(),i=r.findIndex(t=>t.id===e),a=r.findIndex(e=>e.id===t);if(i===-1||a===-1)return;let o=Cn(i,a,n);i!==o&&(h(i,o),z(s))}})}var H=null,U,Tn,En,W=1,G=0,K=0,Dn=``,On=null,q=1,kn=8,An=(e,t,n)=>Math.min(n,Math.max(t,e));function jn(){let e=U.parentElement,t=Math.max(0,(U.offsetWidth*W-e.clientWidth)/2),n=Math.max(0,(U.offsetHeight*W-e.clientHeight)/2);G=An(G,-t,t),K=An(K,-n,n)}function Mn(){W<q&&(W=q),jn(),U.style.transform=`translate(${G}px, ${K}px) scale(${W})`,U.style.cursor=W>q?`grab`:`default`,En.textContent=`${Math.round(W*100)}%`}function Nn(){W=1,G=0,K=0,Mn()}function Pn(e,t,n){let r=U.parentElement.getBoundingClientRect(),i=e-(r.left+r.width/2),a=t-(r.top+r.height/2),o=An(W*n,q,kn),s=o/W;G=i*(1-s)+G*s,K=a*(1-s)+K*s,W=o,Mn()}function Fn(){!H||H.style.display===`none`||(H.style.display=`none`,U.removeAttribute(`src`),document.body.style.overflow=Dn,On?.focus?.(),On=null)}function In(){if(H)return;document.getElementById(`image-lightbox`)?.remove(),H=document.createElement(`div`),H.id=`image-lightbox`,H.className=`image-lightbox-overlay`,H.setAttribute(`role`,`dialog`),H.setAttribute(`aria-modal`,`true`),H.style.display=`none`,H.innerHTML=`
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
        </div>`,document.body.appendChild(H),U=H.querySelector(`.image-lightbox-img`),Tn=H.querySelector(`.image-lightbox-caption`),En=H.querySelector(`.image-lightbox-zoom`);let e=H.querySelector(`.image-lightbox-stage`);H.querySelector(`.image-lightbox-toolbar`).addEventListener(`click`,t=>{let n=t.target.closest(`button`)?.dataset.act;if(!n)return;let r=e.getBoundingClientRect(),i=r.left+r.width/2,a=r.top+r.height/2;n===`in`?Pn(i,a,1.3):n===`out`?Pn(i,a,1/1.3):n===`reset`?Nn():n===`close`&&Fn()}),e.addEventListener(`wheel`,e=>{e.preventDefault(),Pn(e.clientX,e.clientY,e.deltaY<0?1.15:1/1.15)},{passive:!1}),e.addEventListener(`click`,t=>{t.target===e&&Fn()}),U.addEventListener(`dblclick`,e=>{W>q?Nn():Pn(e.clientX,e.clientY,2.5)});let t=!1,n=0,r=0;U.addEventListener(`pointerdown`,e=>{W<=q||(t=!0,n=e.clientX,r=e.clientY,U.setPointerCapture(e.pointerId),U.style.cursor=`grabbing`)}),U.addEventListener(`pointermove`,e=>{t&&(G+=e.clientX-n,K+=e.clientY-r,n=e.clientX,r=e.clientY,Mn())});let i=e=>{if(t){t=!1;try{U.releasePointerCapture(e.pointerId)}catch{}U.style.cursor=W>q?`grab`:`default`}};U.addEventListener(`pointerup`,i),U.addEventListener(`pointercancel`,i),document.addEventListener(`keydown`,e=>{H&&H.style.display!==`none`&&e.key===`Escape`&&(e.stopPropagation(),Fn())})}function Ln(e,t=``){In(),H.style.display===`none`&&(Dn=document.body.style.overflow,document.body.style.overflow=`hidden`,On=document.activeElement),H.setAttribute(`aria-label`,t||`Figure image viewer`),Tn.textContent=t,U.src=e,Nn(),H.style.display=`flex`,H.querySelector(`.image-lightbox-close`)?.focus()}var Rn=null;function zn(e){return e instanceof HTMLElement&&e.classList.contains(`rte-host`)&&e.dataset.rteFigures===`true`}function Bn(){let e=document.activeElement;if(zn(e)){let t=Ct(e);if(t)return{editor:t,selection:t.getSelection()}}if(Rn&&document.body.contains(Rn.host)){let e=Ct(Rn.host);if(e)return{editor:e,selection:Rn.selection}}return null}function Vn(e,t,n,r){let i=Bn();if(!i){I(`Click into a key step or taxon description first, then insert a figure reference.`,`error`);return}let a=e.getFigures();if(a.length===0){I(`Add a figure in the Figures panel first, then insert a reference.`,`error`);return}Rt({x:t,y:n,signal:r,headerHtml:`<div class="popover-header">Insert figure reference</div>`,items:a.map((e,t)=>{let n=t+1,r=e.caption||e.filename||``;return{label:r?`Fig. ${n} — ${r}`:`Fig. ${n}`,onSelect:()=>i.editor.insertToken(`[fig: ${n}]`,i.selection??void 0)}})})}function Hn(e,t,n,r){let i=document.getElementById(`figure-container`);i&&(wn({container:i,cardSelector:`.figure-card`,addButton:document.getElementById(`add-figure-btn`),fieldKeyPrefix:`fig`,typing:t.typing.figures,signal:r,refreshAll:n,onAdd:()=>e.addFigure(``,``),endTypingSession:()=>e.endTypingSession(),buildUpdate:(e,t)=>({[e]:t}),applyUpdate:(t,n)=>e.updateFigure(t,n),toggleSelection:(t,n)=>e.toggleFigureSelection(t,n),clearSelection:()=>e.clearFigureSelection(),getItems:()=>e.getFigures(),reorder:(t,n)=>e.reorderFigures(t,n),extraClick:(t,r)=>{if(t.classList.contains(`btn-trigger-upload`))return(t.closest(`.figure-card`)?.querySelector(`.hidden-file-picker`))?.click(),!0;if(t.classList.contains(`btn-remove-image`)){let r=t.closest(`.figure-card`);if(!r)return!0;let i=Number(r.getAttribute(`data-id`));e.updateFigure(i,{filename:``}),A.deleteFigureBinary(i);let a=j.get(i);return a&&URL.revokeObjectURL(a),j.delete(i),z(n),!0}if(t.classList.contains(`figure-preview-img`)&&!(r.ctrlKey||r.metaKey||r.shiftKey)){let e=t,n=e.currentSrc||e.getAttribute(`src`)||``;if(e.style.display!==`none`&&n){let t=e.closest(`.figure-card`),r=t?.querySelector(`.figure-card-title`)?.textContent?.trim()??``,i=t?.querySelector(`.figure-input-caption`);return Ln(n,[r,qt((i?Ct(i)?.getValue():``)??``)].filter(Boolean).join(`  `)),!0}}return!1},keepFocusWithin:[`.key-card`,`#add-figure-btn`,`.format-toolbar`]}),i.addEventListener(`change`,async t=>{let r=t.target;if(!r.classList.contains(`hidden-file-picker`))return;let i=r.files?.[0];if(!i)return;if(!i.type.startsWith(`image/`)){I(`⚠️ Only image files are supported.`,`error`),r.value=``;return}let a=r.closest(`.figure-card`),o=Number(a?.getAttribute(`data-id`));if(isNaN(o))return;e.updateFigure(o,{filename:i.name}),A.uploadFigureBinary(o,i);let s=j.get(o);s&&URL.revokeObjectURL(s);let c=URL.createObjectURL(i);j.set(o,c),r.value=``,z(n)},{signal:r}))}function Un(e,t,n,r,i){Nt({session:t.typing.figures,fieldKey:`fig-${r}-caption`,endTypingSession:()=>e.endTypingSession(),applyUpdate:()=>e.updateFigure(r,{caption:i}),refreshAll:n})}function Wn(e,t){let n=e=>{let t=e.target instanceof HTMLElement?e.target.closest(`.rte-host`):null;t&&zn(t)&&(Rn={host:t,selection:Ct(t)?.getSelection()??null})};[`focusin`,`keyup`,`mouseup`,`input`].forEach(e=>document.addEventListener(e,n,{signal:t})),document.querySelector(`#cmd-insert-figref`)?.addEventListener(`click`,n=>{let r=n.currentTarget.getBoundingClientRect();Vn(e,r.left,r.bottom+4,t)},{signal:t})}var Gn=null;function Kn(e,t,n,r){let i=document.createElement(`div`);i.className=`figure-card`,i.setAttribute(`data-id`,e.id.toString()),i.draggable=!0,i.innerHTML=`
        <div class="figure-card-header">
            <span class="figure-card-title"></span>
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
            <div class="rte-host figure-input-caption" data-field="caption"></div>
        </div>
    `;let a=i.querySelector(`.rte-host[data-field="caption"]`);return a&&St(a,{schema:At(),value:e.caption,placeholder:`Caption — supports **bold**, *italic*…`,onChange:i=>Un(t,n,r,e.id,i)}),i}function qn(e,t,n){let r=e.getFigures(),i=new Set(r.map(e=>e.id));for(let[e,t]of j.entries())i.has(e)||(URL.revokeObjectURL(t),j.delete(e));if(t.isFiguresHidden)return;let a=document.getElementById(`figure-container`);a&&He({container:a,items:r,getId:e=>e.id,create:r=>Kn(r,e,t,n),onRemove:Tt,update:(r,i,a)=>{let o=a+1,s=r.querySelector(`.figure-card-title`);s&&(s.textContent=`${o}.`),r.querySelector(`.btn-trigger-upload`)?.setAttribute(`aria-label`,`Choose image for Figure ${o}`),r.querySelector(`.btn-remove-image`)?.setAttribute(`aria-label`,`Remove image for Figure ${o}`),r.querySelector(`.figure-input-filename`)?.setAttribute(`aria-label`,`Figure ${o} filename`),r.querySelector(`.rte-host[data-field="caption"]`)?.setAttribute(`aria-label`,`Figure ${o} caption`),r.classList.toggle(`is-selected`,e.getSelectedFigureIds().has(i.id));let c=r.querySelector(`.figure-preview-wrapper`),l=r.querySelector(`.figure-preview-img`);if(t.isImagesHidden)c&&(c.style.display=`none`),l&&(l.style.display=`none`);else{c&&(c.style.display=``);let t=j.get(i.id),a=r.querySelector(`.btn-remove-image`);if(t)l.src!==t&&(l.src=t),l.style.display=`block`,a&&(a.style.display=`inline-block`);else if(!l.hasAttribute(`data-loading-state`)){l.setAttribute(`data-loading-state`,`pending`);let t=e.getActiveProjectUid();A.getFigureBinary(t,i.id).then(r=>{if(l.removeAttribute(`data-loading-state`),e.getActiveProjectUid()!==t)return;let o=j.get(i.id);if(o){l.src!==o&&(l.src=o),l.style.display=`block`,a&&(a.style.display=`inline-block`);return}if(r){let e=URL.createObjectURL(r);j.set(i.id,e),Gn===null&&(Gn=requestAnimationFrame(()=>{Gn=null,n()}))}else l.style.display=`none`,a&&(a.style.display=`none`)}).catch(e=>{console.error(`Failed to load binary thumbnail:`,e),l.removeAttribute(`data-loading-state`),a&&(a.style.display=`none`)})}}let u=r.querySelector(`.figure-input-filename`);u&&document.activeElement!==u&&u.value!==i.filename&&(u.value=i.filename);let d=r.querySelector(`.rte-host[data-field="caption"]`);d&&wt(d,i.caption)}})}var Jn=new Set([`scientificName`,`auctor`,`vernacularName`,`description`,`biology`,`distribution`]);function Yn(e,t){let n=e.getTaxa().find(e=>e.id===t);if(!n)return;let r=e.encodeFigureTokens(n.description);r!==n.description&&e.updateTaxon(t,{description:r})}function Xn(e,t,n,r,i,a){Nt({session:t.typing.taxa,fieldKey:`taxon-${r}-${i}`,endTypingSession:()=>e.endTypingSession(),applyUpdate:()=>e.updateTaxon(r,{[i]:a}),onSettle:()=>{Yn(e,r),e.relinkTaxonDrafts()},refreshAll:n})}function Zn(e){return e.split(`
`).map(e=>e.trim()).filter(e=>e!==``)}function Qn(e){return e.split(`
`).map(e=>{let t=e.indexOf(`|`);return{name:(t===-1?e:e.slice(0,t)).trim(),distinction:t===-1?``:e.slice(t+1).trim()}}).filter(e=>e.name!==``||e.distinction!==``)}function $n(e,t){return Jn.has(e)?{[e]:t}:e===`synonyms`?{synonyms:Zn(t)}:e===`confusables`?{confusables:Qn(t)}:null}function er(e,t,n,r){let i=document.getElementById(`taxa-container`);i&&wn({container:i,cardSelector:`.taxon-card`,addButton:document.getElementById(`add-taxon-btn`),fieldKeyPrefix:`taxon`,typing:t.typing.taxa,signal:r,refreshAll:n,onAdd:()=>e.addTaxon(``),endTypingSession:()=>e.endTypingSession(),buildUpdate:$n,applyUpdate:(t,n)=>e.updateTaxon(t,n),toggleSelection:(t,n)=>e.toggleTaxonSelection(t,n),clearSelection:()=>e.clearTaxonSelection(),getItems:()=>e.getTaxa(),reorder:(t,n)=>e.reorderTaxa(t,n),onSettle:()=>e.relinkTaxonDrafts(),settleField:(t,n)=>{n===`description`&&Yn(e,t)},keepFocusWithin:[`#add-taxon-btn`,`.format-toolbar`]})}function tr(e){return e.join(`
`)}function nr(e){return e.map(e=>e.distinction?`${e.name} | ${e.distinction}`:e.name).join(`
`)}var rr=`
        <div class="taxon-field-row">
            <label>Scientific name:</label>
            <input type="text" class="input-sync taxon-input" data-field="scientificName" aria-label="Scientific name" />
        </div>`,ir=`
        <div class="taxon-field-row">
            <label>Auctor:</label>
            <input type="text" class="input-sync taxon-input" data-field="auctor" aria-label="Author citation (auctor)" />
        </div>`,ar=`
        <div class="taxon-field-row">
            <label>Vernacular name:</label>
            <input type="text" class="input-sync taxon-input" data-field="vernacularName" placeholder="Vernacular name" aria-label="Vernacular name" />
        </div>`;function or(e){return`
        <div class="taxon-card-header">
            <span class="taxon-card-title"></span>
        </div>
        ${e===`vernacular`?ar+rr+ir:rr+ir+ar}
        <div class="taxon-field-row">
            <label>Synonyms (one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="synonyms" rows="2" aria-label="Synonyms, one per line"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Description:</label>
            <div class="rte-host taxon-rte" data-field="description" aria-label="Taxon description"></div>
        </div>
        <div class="taxon-field-row">
            <label>Biology:</label>
            <textarea class="input-sync taxon-textarea" data-field="biology" rows="3" aria-label="Biology"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Distribution:</label>
            <textarea class="input-sync taxon-textarea" data-field="distribution" rows="2" aria-label="Distribution"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Confusable species (name | how to distinguish, one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="confusables" rows="3" aria-label="Confusable species, one per line"></textarea>
        </div>
    `}function sr(e,t,n,r){let i=e.querySelector(`.taxon-card-title`),a=`${n}.`;i&&i.textContent!==a&&(i.textContent=a),F(e,`input[data-field="scientificName"]`,t.scientificName),F(e,`input[data-field="auctor"]`,t.auctor),F(e,`input[data-field="vernacularName"]`,t.vernacularName),F(e,`textarea[data-field="synonyms"]`,tr(t.synonyms));let o=e.querySelector(`.rte-host[data-field="description"]`);o&&wt(o,r.decodeTextReferencesForEditor(t.description)),F(e,`textarea[data-field="biology"]`,t.biology),F(e,`textarea[data-field="distribution"]`,t.distribution),F(e,`textarea[data-field="confusables"]`,nr(t.confusables))}function cr(e,t,n,r,i){let a=document.createElement(`div`);a.className=`taxon-card`,a.setAttribute(`data-id`,e.id.toString()),a.draggable=!0,a.innerHTML=or(t);let o=a.querySelector(`.rte-host[data-field="description"]`);return o&&St(o,{schema:kt(n),value:n.decodeTextReferencesForEditor(e.description),placeholder:`Diagnostic description — supports **bold**, *italic*, and [fig: 1]…`,onChange:t=>Xn(n,r,i,e.id,`description`,t)}),a}function lr(e,t,n){if(t.isTaxaHidden)return;let r=document.getElementById(`taxa-container`);if(!r)return;let i=t.nameDisplayMode;r.dataset.nameMode!==i&&(Tt(r),r.replaceChildren(),r.dataset.nameMode=i);let a=e.getSelectedTaxonIds();He({container:r,items:e.getTaxa(),getId:e=>e.id,create:r=>cr(r,i,e,t,n),update:(t,n,r)=>{t.classList.toggle(`is-selected`,a.has(n.id)),sr(t,n,r+1,e)},onRemove:Tt})}function ur(e,t){return`<span class="fig-ref" data-fig-id="${e}">(Fig. ${t})</span>`}var dr={text:i,fig:e=>ur(e.figId,e.displayNum),brokenFig:e=>`<span class="error-text">[Fig: ${i(e.label)}]</span>`,mark:Bt};function fr(e){let t=document.createElement(`div`);return t.className=`print-step-block`,t.setAttribute(`data-id`,e.id.toString()),t.innerHTML=`
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
    `,t}function pr(e,t,n){let r=e.querySelector(`.print-row[data-choice="${t}"] .print-dest`);if(!r)return;r.textContent!==n.printText&&(r.textContent=n.printText);let i=`print-dest ${n.printClass}`.trim();r.className!==i&&(r.className=i)}function mr(e,t,n){let r=e.querySelector(`.print-row[data-choice="${t}"] .print-text`);r&&r.innerHTML!==n&&(r.innerHTML=n)}function hr(e,t){if(t.isPrintHidden)return;let n=document.getElementById(`print-view-container`);if(!n)return;let r=Yt(e,{leadFormat:t.leadFormat,showBackReference:t.showBackReference,nameMode:t.nameDisplayMode});if(n.dataset.leadFormat=t.leadFormat,r.isEmpty){n.innerHTML=`<p class="print-empty-notice">This preview updates as you build your key. Add a step in the editor to get started.</p>`;return}n.querySelector(`.print-empty-notice`)?.remove(),He({container:n,items:r.couplets,getId:e=>e.id,create:fr,update:(e,t)=>{let n=e.querySelector(`.print-step-num`);n&&n.textContent!==t.lead1&&(n.textContent=t.lead1);let r=e.querySelector(`.print-dash`);r&&r.textContent!==t.lead2&&(r.textContent=t.lead2),mr(e,`1`,B(t.alt1,dr)||`___`),pr(e,`1`,t.dest1),mr(e,`2`,B(t.alt2,dr)||`___`),pr(e,`2`,t.dest2)}})}var gr=`___`;function _r(e){switch(e){case`auto`:return`Auto-detect`;case`utf-8`:return`UTF-8`;case`utf-16le`:return`UTF-16 LE`;case`utf-16be`:return`UTF-16 BE`;case`windows-1252`:return`Windows-1252 / Latin-1`}}function vr(e){return e.length>=3&&e[0]===239&&e[1]===187&&e[2]===191?`utf-8`:e.length>=2&&e[0]===255&&e[1]===254?`utf-16le`:e.length>=2&&e[0]===254&&e[1]===255?`utf-16be`:null}function yr(e){let t=vr(e);if(t)return t;let n=Math.min(e.length,4096),r=0,i=0;for(let t=0;t<n;t++)e[t]===0&&(t%2==0?r++:i++);if(n>0&&(r+i)/n>.2)return i>r?`utf-16le`:`utf-16be`;try{return new TextDecoder(`utf-8`,{fatal:!0}).decode(e),`utf-8`}catch{return`windows-1252`}}function br(e,t){let n=new Uint8Array(e),r=t===`auto`?yr(n):t;return{text:new TextDecoder(r).decode(e),encoding:r,autoDetected:t===`auto`}}var xr=500,J={minLeaderDots:3,useWhitespaceSeparator:!0,joinWrappedLines:!0,dehyphenate:!0,recognizeLetteredCouplets:!0,recognizeDashSecondLead:!0,recognizeBackReferences:!0,fillMissingCouplets:!0};function Sr(e){let t=(e??``).replace(/\s+/g,` `).trim();return t===gr?``:t}function Cr(e){let t=e.findIndex(e=>e.trim().toUpperCase()===`FIGURES DATA`);return t===-1?e:e.slice(0,t).filter(e=>!/^=+$/.test(e.trim()))}function wr(e,t){let n=t.recognizeLetteredCouplets?`([a-bA-B])?`:`()?`,r=t.recognizeBackReferences?`(?:\\s*\\(\\s*\\d[\\d\\s,.–-]*\\))?`:``,i=e.match(RegExp(`^\\s*(\\d{1,4})\\s*${n}\\s*[.)]?${r}\\s+(\\S.*)$`));if(i){let e=parseInt(i[1],10),n=(i[2]||``).toLowerCase(),r=i[3];return t.recognizeLetteredCouplets&&n===`b`?{kind:`second`,coupletNum:e,rest:r}:{kind:`first`,coupletNum:e,rest:r}}if(t.recognizeDashSecondLead){let t=e.match(/^\s*[-–—]\s+(\S.*)$/);if(t)return{kind:`second`,coupletNum:null,rest:t[1]}}return null}function Tr(e,t,n){let r=e.replace(/\s+$/,``),i=t.trim();return n.dehyphenate&&/[A-Za-zÀ-ÿ]-$/.test(r)?r.slice(0,-1)+i:`${r} ${i}`}function Er(e,t){let n=null,r;for(;(r=e.exec(t))!==null;)n=r;return n}function Dr(e,t){let n=e.lastIndexOf(`	`);if(n!==-1)return{text:e.slice(0,n),dest:e.slice(n+1)};let r=Math.max(2,Math.floor(t.minLeaderDots)||2),i=Er(RegExp(`\\.(?:\\s?\\.){${r-1},}`,`g`),e);if(i)return{text:e.slice(0,i.index),dest:e.slice(i.index+i[0].length)};if(t.useWhitespaceSeparator){let t=Er(/\s{2,}/g,e);if(t)return{text:e.slice(0,t.index),dest:e.slice(t.index+t[0].length)}}let a=e.match(/^(.*\S)\s+(\d{1,4})\.?\s*$/);return a?{text:a[1],dest:a[2]}:{text:e,dest:``}}function Or(e){let t=e.trim();if(t===``||/^[.\s]+$/.test(t))return{linkNum:0,taxa:``};let n=t.match(/^(\d{1,4})\.?$/);return n?{linkNum:parseInt(n[1],10),taxa:``}:{linkNum:0,taxa:t}}function kr(){return{alt1:``,link1:0,taxa1:``,alt2:``,link2:0,taxa2:``}}function Ar(e,t,n){if(e)return n.has(e)?{kind:`linked`,targetId:e}:{kind:`unresolved`,couplet:e};let r=t.trim();return r===``?{kind:`empty`}:{kind:`taxonDraft`,name:r}}function jr(e,t={}){let n={...J,...t},r=[],i=[],a=Cr((e??``).replace(/\r\n?/g,`
`).split(`
`)),o=[],s=null,c=0,l=0,u=()=>{s&&=(o.push(s),null)};for(let e of a){if(e.trim()===``)continue;let t=wr(e,n);if(t){if(u(),t.kind===`first`)c=t.coupletNum,s={num:t.coupletNum,isSecond:!1,body:t.rest};else{let n=t.coupletNum??c;if(n===0){r.push(`Ignored a second-alternative line before any numbered step: "${e.trim().slice(0,50)}"`);continue}t.coupletNum!==null&&(c=t.coupletNum),s={num:n,isSecond:!0,body:t.rest}}continue}s&&n.joinWrappedLines?s.body=Tr(s.body,e,n):s&&l++}if(u(),o.length===0)return i.push(`No key steps were recognized. Each step should start with a number (e.g. "1." or "1a") or a dash for the second alternative.`),{couplets:[],figures:[],warnings:r,errors:i,stepCount:0};l>0&&r.push(`${l} wrapped line(s) were dropped because "Join wrapped lines" is off.`);let d=new Map,f=e=>{let t=d.get(e);return t||(t=kr(),d.set(e,t)),t},p=0,m=!1;for(let e of o){if(e.num>xr){r.push(`Step number ${e.num} exceeds the safety ceiling of ${xr} and was skipped.`);continue}p=Math.max(p,e.num);let{text:t,dest:i}=Dr(e.body,n),{linkNum:a,taxa:o}=Or(i);a>xr&&(o=String(a),a=0,m=!0),p=Math.max(p,a);let s=f(e.num);e.isSecond?(s.alt2=Sr(t),s.link2=a,s.taxa2=o):((s.alt1||s.taxa1||s.link1)&&r.push(`Couplet ${e.num} has more than one first alternative; the later one overwrote the earlier.`),s.alt1=Sr(t),s.link1=a,s.taxa1=o)}if(m&&r.push(`One or more destination numbers were too large to be real step links and were kept as text.`),p=Math.min(p,xr),n.fillMissingCouplets){let e=0;for(let t=1;t<=p;t++)d.has(t)||(f(t),e++);e>0&&r.push(`Generated ${e} empty key step(s) to fill gaps so links resolve.`)}let h=[...d.keys()].sort((e,t)=>e-t),g=new Set(h),_=h.map(e=>{let t=d.get(e);return{id:e,alt1:t.alt1,alt2:t.alt2,branch1:Ar(t.link1,t.taxa1,g),branch2:Ar(t.link2,t.taxa2,g)}});return{couplets:_,figures:[],warnings:r,errors:i,stepCount:_.length}}var Mr=`plain-text-import-view`,Y=null,Nr=null;function X(e){return document.getElementById(e)}function Pr(){let e=(e,t)=>{let n=X(e);return n?n.checked:t},t=X(`pt-opt-min-dots`),n=t&&t.value!==``?parseInt(t.value,10):J.minLeaderDots;return{minLeaderDots:Number.isFinite(n)?n:J.minLeaderDots,useWhitespaceSeparator:e(`pt-opt-ws`,J.useWhitespaceSeparator),joinWrappedLines:e(`pt-opt-join`,J.joinWrappedLines),dehyphenate:e(`pt-opt-dehyphen`,J.dehyphenate),recognizeLetteredCouplets:e(`pt-opt-lettered`,J.recognizeLetteredCouplets),recognizeDashSecondLead:e(`pt-opt-dash`,J.recognizeDashSecondLead),recognizeBackReferences:e(`pt-opt-backref`,J.recognizeBackReferences),fillMissingCouplets:e(`pt-opt-fill`,J.fillMissingCouplets)}}function Fr(){return X(`pt-import-encoding`)?.value||`auto`}function Ir(){let e=X(Mr);e&&(e.style.display=`flex`,X(`pt-import-source`)?.focus(),Z())}function Lr(){let e=X(Mr);e&&(e.style.display=`none`)}function Rr(){let e=X(Mr);return!!e&&e.style.display!==`none`}function Z(){let e=X(`pt-import-source`),t=X(`pt-import-preview`),n=X(`pt-import-status`),r=X(`pt-import-confirm`);if(!e||!t)return;let i=e.value;if(i.trim()===``){Y=null,t.innerHTML=`<div class="import-preview-empty">Paste or load a key to see a live preview here.</div>`,n&&(n.textContent=``),r&&(r.disabled=!0);return}let a=jr(i,Pr());Y=a;let o=a.couplets.length>0&&a.errors.length===0;r&&(r.disabled=!o),n&&(a.errors.length>0?(n.textContent=`⚠️ Could not parse`,n.className=`import-status import-status-error`):(n.textContent=`✓ ${a.stepCount} step(s)`,n.className=`import-status import-status-ok`)),t.innerHTML=zr(a)}function zr(e){let t=``;if(e.errors.length>0)return t+=`<div class="import-messages">`,e.errors.forEach(e=>{t+=`<div class="import-msg import-msg-error">⛔ ${i(e)}</div>`}),t+=`</div>`,t;e.warnings.length>0&&(t+=`<div class="import-messages">`,e.warnings.forEach(e=>{t+=`<div class="import-msg import-msg-warning">⚠️ ${i(e)}</div>`}),t+=`</div>`);let n=Ne(e.couplets,e.figures),r=0,a=0;if(n.forEach(e=>e.forEach(e=>{e.severity===`error`?r++:a++})),r>0||a>0){let e=[];r>0&&e.push(`${r} error${r===1?``:`s`}`),a>0&&e.push(`${a} warning${a===1?``:`s`}`),t+=`<div class="import-diagnostics-summary">🩺 Key check: ${e.join(`, `)}. Fixable after import in the editor.</div>`}let o=new Map;e.couplets.forEach((e,t)=>o.set(e.id,t+1));let s=e=>{switch(e.kind){case`linked`:{let t=o.get(e.targetId);return t===void 0?`→ ?`:`→ ${t}`}case`unresolved`:return`→ ${e.couplet}`;case`taxonDraft`:return i(e.name);case`taxon`:return`→ taxon`;case`empty`:return`<span class="import-preview-muted">(empty)</span>`}},c=e=>{let t=n.get(e);return!t||t.length===0?``:`<div class="import-preview-diagnostics warning-block">${t.map(e=>`<div class="${e.severity===`error`?`error-text`:`warning-text`}">${e.severity===`error`?`⛔`:`⚠️`} ${i(e.message)}</div>`).join(``)}</div>`};return t+=`<ol class="import-preview-list">`,e.couplets.forEach((e,r)=>{let a=n.has(e.id);t+=`
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
            </li>`}),t+=`</ol>`,t}async function Br(e,t,n){if(!Y||Y.couplets.length===0||Y.errors.length>0){I(`⚠️ There is nothing valid to import yet.`,`error`);return}let r=X(`pt-import-title`)?.value.trim()||`Imported Key`;if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`))return;let i=!1;try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A local project named "${r}" already exists. Overwrite it with this import?`))return;let a={type:Oe,version:ke,title:r,data:{title:r,key:Y.couplets,figures:Y.figures}},o=e.importJsonData(a);if(!o.success){alert(`Failed to import parsed key:\n• ${o.errors.join(`
• `)}`);return}i=!0,e.setTitle(r),t.setActiveProjectTitle(r),await e.saveToStorage(),I(`📥 Imported "${r}" from plain text (${Y.stepCount} step(s)).`,`success`),Lr(),n()}catch(e){console.error(`Plain text import failed:`,e),i?(I(`⚠️ The key was imported but could not be saved to browser storage. Use File → Save to retry.`,`error`),Lr(),n()):I(`⚠️ The plain text import could not be completed.`,`error`)}}function Vr(e,t,n,r){let i=X(`pt-import-source`),a=X(`pt-import-file-hidden`);i?.addEventListener(`input`,()=>{Nr=null,Z()},{signal:r}),[`pt-opt-min-dots`,`pt-opt-ws`,`pt-opt-join`,`pt-opt-dehyphen`,`pt-opt-lettered`,`pt-opt-dash`,`pt-opt-backref`,`pt-opt-fill`].forEach(e=>{let t=X(e);t?.addEventListener(`change`,()=>Z(),{signal:r}),t?.addEventListener(`input`,()=>Z(),{signal:r})}),X(`pt-import-load-file`)?.addEventListener(`click`,()=>{a?.click()},{signal:r}),a?.addEventListener(`change`,async e=>{let t=e.target.files?.[0];if(t)try{let e=await t.arrayBuffer();Nr=e;let{text:n,encoding:r,autoDetected:a}=br(e,Fr());i&&(i.value=n,Z()),a&&I(`📥 Loaded "${t.name}" — detected ${_r(r)} encoding.`,`success`);let o=X(`pt-import-title`);o&&!o.value.trim()&&(o.value=t.name.replace(/\.txt$/i,``).trim())}catch(e){console.error(`Failed to read plain text file:`,e),I(`⚠️ Could not read the selected file.`,`error`)}finally{e.target.value=``}},{signal:r}),X(`pt-import-encoding`)?.addEventListener(`change`,()=>{if(!Nr)return;let{text:e}=br(Nr,Fr());i&&(i.value=e,Z())},{signal:r}),X(`pt-import-clear`)?.addEventListener(`click`,()=>{i&&(i.value=``),Nr=null,Z(),i?.focus()},{signal:r}),X(`pt-import-close`)?.addEventListener(`click`,()=>Lr(),{signal:r}),X(`pt-import-cancel`)?.addEventListener(`click`,()=>Lr(),{signal:r}),X(`pt-import-confirm`)?.addEventListener(`click`,()=>{Br(e,t,n)},{signal:r}),X(Mr)?.addEventListener(`keydown`,e=>{e.key===`Escape`&&Rr()&&(e.stopPropagation(),Lr())},{signal:r})}function Hr(e,t,n,r){let a=null,o=null,s=[],c=-1,l=e=>e instanceof HTMLInputElement&&e.classList.contains(`input-destination`);function u(e){let r=e.trim().toLowerCase();if(/^\d+$/.test(r))return[];let i=n.nameDisplayMode,a=[];for(let e of t.getTaxa()){let t=e.scientificName.trim(),n=e.vernacularName.trim();if(!t&&!n||r&&!t.toLowerCase().includes(r)&&!n.toLowerCase().includes(r))continue;let o=m(e,i),s=o===t?n:t;a.push({taxon:e,primary:o,secondary:s===o?``:s})}let o=e=>!r||e.primary.toLowerCase().startsWith(r)||e.secondary.toLowerCase().startsWith(r)?0:1;return a.sort((e,t)=>o(e)-o(t)||e.primary.localeCompare(t.primary)),a}function d(){a&&(a.innerHTML=s.map((e,t)=>`
            <div class="dest-option${t===c?` is-active`:``}" role="option"
                 id="dest-option-${t}" aria-selected="${t===c}" data-index="${t}">
                <span class="dest-option-primary">${i(e.primary)}</span>
                ${e.secondary?`<span class="dest-option-secondary">${i(e.secondary)}</span>`:``}
            </div>`).join(``),c>=0?(o?.setAttribute(`aria-activedescendant`,`dest-option-${c}`),a.querySelector(`.is-active`)?.scrollIntoView({block:`nearest`})):o?.removeAttribute(`aria-activedescendant`))}function f(){if(!a||!o)return;let e=o.getBoundingClientRect();a.style.minWidth=`${Math.max(e.width,180)}px`;let t=a.getBoundingClientRect(),n=Math.max(8,Math.min(e.left,window.innerWidth-t.width-8)),r=e.bottom+4,i=r+t.height>window.innerHeight-8?Math.max(8,e.top-t.height-4):r;a.style.left=`${n}px`,a.style.top=`${i}px`}function p(){a?.remove(),a=null,o?.setAttribute(`aria-expanded`,`false`),o?.removeAttribute(`aria-activedescendant`),o?.removeAttribute(`aria-controls`),o=null,s=[],c=-1}function h(e){let t=s[e],n=o;p(),!(!t||!n)&&(n.value=t.primary,n.dispatchEvent(new Event(`input`,{bubbles:!0})),queueMicrotask(p))}function g(e,t){let n=u(t);if(n.length===0){o===e&&p();return}(!a||o!==e)&&(p(),o=e,a=document.createElement(`div`),a.className=`dest-combobox`,a.id=`dest-combobox-listbox`,a.setAttribute(`role`,`listbox`),a.addEventListener(`mousedown`,e=>{e.preventDefault();let t=e.target.closest(`[data-index]`);t&&h(Number(t.getAttribute(`data-index`)))}),document.body.appendChild(a),e.setAttribute(`aria-expanded`,`true`),e.setAttribute(`aria-autocomplete`,`list`),e.setAttribute(`aria-controls`,`dest-combobox-listbox`)),s=n,c=-1,d(),f()}e.addEventListener(`focusin`,e=>{l(e.target)&&g(e.target,``)},{signal:r}),e.addEventListener(`input`,e=>{l(e.target)&&g(e.target,e.target.value)},{signal:r}),e.addEventListener(`focusout`,e=>{l(e.target)&&p()},{signal:r}),e.addEventListener(`keydown`,e=>{if(!(!a||!l(e.target)||e.target!==o))if(e.key===`ArrowDown`||e.key===`ArrowUp`){e.preventDefault();let t=e.key===`ArrowDown`?1:-1;c=c===-1?t===1?0:s.length-1:(c+t+s.length)%s.length,d()}else e.key===`Enter`?c>=0?(e.preventDefault(),h(c)):p():e.key===`Escape`?(e.preventDefault(),e.stopPropagation(),p()):e.key===`Tab`&&p()},{signal:r}),document.addEventListener(`mousedown`,e=>{a&&!a.contains(e.target)&&e.target!==o&&p()},{signal:r}),window.addEventListener(`scroll`,e=>{a&&e.target instanceof Node&&a.contains(e.target)||p()},{signal:r,capture:!0}),window.addEventListener(`resize`,p,{signal:r}),r.addEventListener(`abort`,p)}function Ur(e,t,n,r){let i=document.getElementById(`modal-shortcuts`),a=document.getElementById(`modal-options`),o=document.getElementById(`modal-about`),s=document.getElementById(`modal-open-project`),c=document.getElementById(`opt-lead-format`),l=document.getElementById(`opt-backref`),u=document.getElementById(`opt-name-display`),d=()=>{c?.querySelectorAll(`input[name="lead-format"]`).forEach(e=>{e.checked=e.value===t.leadFormat}),l&&(l.checked=t.showBackReference),u?.querySelectorAll(`input[name="name-display"]`).forEach(e=>{e.checked=e.value===t.nameDisplayMode})};c?.addEventListener(`change`,e=>{let r=e.target;r.name!==`lead-format`||!_(r.value)||(t.setLeadFormat(r.value),z(n))},{signal:r}),l?.addEventListener(`change`,()=>{t.setShowBackReference(l.checked),z(n)},{signal:r}),u?.addEventListener(`change`,e=>{let r=e.target;r.name!==`name-display`||!f(r.value)||(t.setNameDisplayMode(r.value),z(n))},{signal:r});let p=e=>{e.style.display=`flex`,e.querySelector(`button, input:not([disabled]), [tabindex]:not([tabindex="-1"])`)?.focus()};document.getElementById(`cmd-open-shortcuts`)?.addEventListener(`click`,()=>{p(i)},{signal:r}),document.getElementById(`cmd-open-options`)?.addEventListener(`click`,()=>{d(),p(a)},{signal:r}),document.getElementById(`cmd-open-about`)?.addEventListener(`click`,()=>{p(o)},{signal:r}),document.getElementById(`cmd-open-dialog`)?.addEventListener(`click`,async()=>{p(s),await Pt(e)},{signal:r});let m=(e,t)=>{document.getElementById(t)?.addEventListener(`click`,()=>{e.style.display=`none`},{signal:r}),e.addEventListener(`click`,t=>{t.target===e&&(e.style.display=`none`)},{signal:r})};m(i,`modal-shortcuts-close`),m(a,`modal-options-close`),m(o,`modal-about-close`),m(s,`modal-project-close`),document.getElementById(`project-hub-list`)?.addEventListener(`click`,async t=>{let r=t.target,i=r.closest(`.hub-item-clickable-zone`),a=r.closest(`.btn-hub-delete`);if(i){let t=i.getAttribute(`data-name`);if(!t||e.hasUnsavedChanges()&&!confirm(`Your current key has unsaved tracking changes. Are you sure you want to discard them to switch workspaces?`))return;try{if(!await e.loadProject(t)){I(`⚠️ Project "${t}" was not found in the browser database.`,`error`),await Pt(e);return}s.style.display=`none`,I(`📂 Swapped to workspace: "${t}"`,`success`),z(n)}catch(e){console.error(`Failed to load workspace safely:`,e),I(`⚠️ Could not open selected project database entries.`,`error`)}return}if(a){t.stopPropagation();let r=a.getAttribute(`data-name`);if(!r)return;let i=`Are you sure you want to permanently delete the workspace "${r}"?\nThis wipes it from your browser database.`;if(confirm(i))try{if(await A.deleteProject(r),I(`🗑️ Workspace "${r}" deleted.`,`success`),e.getPersistedTitle()===r){let t=await A.getProjectList();t.length>0?await e.loadProject(t[0].name):await e.createNewProject(`Untitled Key`)}await Pt(e),z(n)}catch(e){console.error(`Failed to execute database deletion sequence:`,e),I(`⚠️ Failed to delete workspace from database.`,`error`)}}},{signal:r}),document.getElementById(`btn-hub-import`)?.addEventListener(`click`,()=>{document.querySelector(`#file-import-hidden`)?.click()},{signal:r})}var Wr=`
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
    }`,Gr=`
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
})();`,Kr={text:i,fig:e=>`(Fig. ${e.displayNum})`,brokenFig:e=>`[Broken Fig: ${i(e.label)}]`,mark:Bt},qr={...Kr,text:e=>i(e).replace(/\n/g,`<br>`)},Jr={text:e=>e,fig:e=>`(Fig. ${e.displayNum})`,brokenFig:e=>`[Broken Fig: ${e.label}]`,mark:(e,t)=>t};function Yr(e){let t=i(e.printText);switch(e.kind){case`taxon`:return`<strong class="print-dest-taxon">${t}</strong>`;case`step`:return`<strong class="print-dest-strong">${t}</strong>`;case`broken`:return`<span class="error-text">${t}</span>`;case`empty`:return`<span>${t}</span>`}}async function Xr(e,t,n,r){try{let o=e.getActiveProjectUid(),s=Yt(e,{leadFormat:t,showBackReference:n,nameMode:r}),{title:c,taxa:l,figures:u}=s,d=(await Promise.all(u.map(async(e,t)=>{let n=t+1,r=``;try{let t=await A.getFigureBinary(o,e.id);if(t){let a=await ee(t),o=V(e.caption,Jr);r=`<img class="print-fig-img" src="${a}" alt="Figure ${n}" data-caption="${i(`Fig. ${n}${o?`: ${o}`:``}`)}" />`}}catch(t){console.warn(`Could not resolve binary payload stream for figure ID ${e.id}:`,t)}let a=e.caption?V(e.caption,qr):i(e.filename||`Untitled Asset`);return`
                    <div class="print-fig-card">
                        ${r}
                        <div class="print-fig-caption">
                            <strong>Fig. ${n}:</strong> ${a}
                        </div>
                    </div>
                `}))).join(``),f=``,p=0;s.isEmpty&&(f=`<p class="print-empty-notice">[The identification key is currently empty. Add couplets in the editor to populate this document.]</p>`);for(let e of s.couplets){let t=Yr(e.dest1),n=Yr(e.dest2),r=B(e.alt1,Kr)||`___`,a=B(e.alt2,Kr)||`___`,{lead1:o,lead2:s}=e;p=Math.max(p,o.length,s.length),f+=`
            <div class="print-couplet" role="group" aria-label="Couplet ${e.displayNum}">
                <div class="print-step-num">${i(o)}</div>
                <div class="print-row">
                  <span class="print-text">${r}</span>
                  <span class="print-dest">${t}</span>
                </div>
                <div class="print-dash">${i(s)}</div>
                <div class="print-row">
                  <span class="print-text">${a}</span>
                  <span class="print-dest">${n}</span>
                </div>
            </div>
            `}let m=``;if(l.length>0){let e=e=>i(e).replace(/\n/g,`<br>`),t=(e,t)=>`<p class="print-taxon-field"><strong>${e}:</strong> ${t}</p>`,n=e=>(e.isScientific?`<em>${i(e.name)}</em>`:i(e.name))+(e.auctor?` <span class="print-taxon-auctor">${i(e.auctor)}</span>`:``);m=`<h2 class="print-taxa-heading">Taxa</h2>${l.map(a=>{let o=Jt(a,r),s=`<div class="print-taxon"><h3 class="print-taxon-name">${n(o.heading)}</h3>`;if(o.secondary&&(s+=`<p class="print-taxon-field">${n(o.secondary)}</p>`),a.synonyms.length>0&&(s+=t(`Synonyms`,a.synonyms.map(e=>`<em>${i(e)}</em>`).join(`; `))),a.description&&(s+=t(`Description`,V(a.description,qr,u))),a.biology&&(s+=t(`Biology`,e(a.biology))),a.distribution&&(s+=t(`Distribution`,e(a.distribution))),a.confusables.length>0){let e=a.confusables.map(e=>`<li><em>${i(e.name)}</em>${e.distinction?` — ${i(e.distinction)}`:``}</li>`).join(``);s+=`<div class="print-taxon-field"><strong>Confusable species:</strong><ul class="print-confusables">${e}</ul></div>`}return s+`</div>`}).join(``)}`}let h=u.length>0?` layout-has-figures`:``,g=`${Math.max(p,3)}ch`;a(Zr(c,f,m,d,h,t,g),x(c,`.html`),`text/html;charset=utf-8;`)}catch(e){console.error(`HTML Export layout compilation system failure:`,e),I(`❌ An unexpected error disrupted the HTML file compilation pipeline.`,`error`)}}function Zr(e,t,n,r,a,o,s){let c=i(e);return`<!DOCTYPE html>
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
${Wr}
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
  <script>${Gr}<\/script>
</body>
</html>`}function Q(e){return e?e.replace(/[\r\n]+/g,` `).replace(/\\/g,`___TSKEY_LATEX_BACKSLASH___`).replace(/([&%$#_{}])/g,`\\$1`).replace(/~/g,`\\textasciitilde{}`).replace(/\^/g,`\\textasciicircum{}`).replace(/</g,`\\textless{}`).replace(/>/g,`\\textgreater{}`).replace(/___TSKEY_LATEX_BACKSLASH___/g,`\\textbackslash{}`):``}function Qr(e,t){return`\\makebox[${t}][l]{\\textbf{${Q(e).replace(/—/g,`\\textemdash{}`)}}}`}var $r={bold:e=>`\\textbf{${e}}`,italic:e=>`\\textit{${e}}`,subscript:e=>`\\textsubscript{${e}}`,superscript:e=>`\\textsuperscript{${e}}`},ei={text:Q,fig:e=>` (Fig.~${e.displayNum})`,brokenFig:e=>`[Broken Fig: ${Q(e.label)}]`,mark:(e,t)=>($r[e]??(e=>e))(t)};function ti(e,t,n,r){try{let i=Yt(e,{leadFormat:t,showBackReference:n,nameMode:r}),{title:o,taxa:s,figures:c}=i,l=n?`4.5em`:`2.5em`,u=``;if(i.isEmpty)u=`
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add key steps in the editor to populate this document.]}
\\end{center}`;else{let e=``,t=e=>{switch(e.kind){case`taxon`:return`\\mbox{\\textbf{\\textit{${Q(e.printText)}}}}`;case`step`:return`\\mbox{\\textbf{${Q(e.printText)}}}`;default:return`\\dots`}};i.couplets.forEach(n=>{let r=t(n.dest1),i=t(n.dest2),a=B(n.alt1,ei),o=B(n.alt2,ei),{lead1:s,lead2:c}=n;e+=`{\\interlinepenalty=10000
`,e+=`\\noindent\\hangindent=${l}\\hangafter=1${Qr(s,l)}${a}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${r}\\par\\nopagebreak\n`,e+=`\\noindent\\hangindent=${l}\\hangafter=1${Qr(c,l)}${o}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${i}\\par}\n`,e+=`\\vspace{0.6em}

`}),u=`
{
\\setlength{\\parfillskip}{0pt}
${e}
\\par
}`}let d=[],f=``;c.length>0&&(f+=`\\newpage
\\section*{Figures Appendix}
`,f+=`\\textit{Instructions: Create a folder named \\texttt{figures} in the same directory as this \\texttt{.tex} file, and place the corresponding image files inside it before compiling.}
\\vspace{1.5em}

`,c.forEach((e,t)=>{let n=t+1,r=e.caption?V(e.caption,ei):Q(`Figure ${n}`);f+=`\\begin{figure}[htbp]
`,f+=`  \\centering
`;let i=e.filename.trim();i?(f+=`  \\includegraphics[width=0.7\\linewidth]{\\detokenize{figures/${i}}}\n`,(/\s/.test(i)||(i.match(/\./g)?.length??0)>1||/[{}\\%#]/.test(i))&&d.push(i)):f+=`  \\framebox[0.7\\linewidth]{\\vbox{\\vspace{1.5cm}\\centering\\textbf{[Image Placeholder]}\\par\\vspace{0.5em}\\small No filename provided in data store\\vspace{1.5cm}}}
`,f+=`  \\caption{${r}}\n`,f+=`  \\label{fig:${n}}\n`,f+=`\\end{figure}

`}));let p=``;if(s.length>0){let e=``,t=(e,t)=>`\\noindent\\textbf{${e}:} ${Q(t)}\\par\n`,n=e=>(e.isScientific?`\\textit{${Q(e.name)}}`:Q(e.name))+(e.auctor?` {\\small ${Q(e.auctor)}}`:``);s.forEach(i=>{let a=Jt(i,r);e+=`\\subsection*{${n(a.heading)}}\n`,a.secondary&&(e+=`\\noindent ${n(a.secondary)}\\par\n`),i.synonyms.length>0&&(e+=t(`Synonyms`,i.synonyms.join(`; `))),i.description&&(e+=`\\noindent\\textbf{Description:} ${V(i.description,ei,c)}\\par\n`),i.biology&&(e+=t(`Biology`,i.biology)),i.distribution&&(e+=t(`Distribution`,i.distribution)),i.confusables.length>0&&(e+=`\\noindent\\textbf{Confusable species:}\\par
`,e+=`\\begin{itemize}
`,i.confusables.forEach(t=>{let n=t.distinction?` --- ${Q(t.distinction)}`:``;e+=`  \\item ${Q(t.name)}${n}\n`}),e+=`\\end{itemize}
`),e+=`\\vspace{0.8em}

`}),p=`\\newpage\n\\section*{Taxa}\n${e}`}a(`% =========================================================================
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

\\title{\\textbf{${Q(o)}}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${u}
${p}
${f}
\\end{document}`,x(o,`.tex`),`application/x-latex;charset=utf-8;`),d.length>0&&I(`⚠️ ${d.length} image filename(s) contain spaces, multiple dots, or LaTeX-special characters ({ } % # \\) and may fail to compile. Rename the image file(s) to match: ${d.join(`, `)}`,`error`)}catch(e){console.error(`LaTeX Export system failure:`,e),I(`❌ An unexpected error disrupted the LaTeX document generation pipeline.`,`error`)}}var ni={text:e=>e,fig:e=>`(Fig. ${e.displayNum})`,brokenFig:e=>`[Broken Fig: ${e.label}]`,mark:(e,t)=>t};function ri(e,t,n,r){try{let i=Yt(e,{leadFormat:t,showBackReference:n,nameMode:r}),{taxa:o,figures:s}=i,c=``;if(c+=`${i.title}\n\n`,i.isEmpty&&(c+=`[The identification key is currently empty. Add key steps in the editor to populate this document.]

`),i.couplets.forEach(e=>{let t=B(e.alt1,ni)||`___`,n=B(e.alt2,ni)||`___`;c+=`${e.lead1}\t${t}\t${e.dest1.printText}\n`,c+=`${e.lead2}\t${n}\t${e.dest2.printText}\n\n`}),o.length>0){c+=`========================================
`,c+=`TAXA
`,c+=`========================================

`;let e=e=>e.auctor?`${e.name} ${e.auctor}`:e.name;o.forEach((t,n)=>{let i=n+1,a=Jt(t,r);c+=`${i}. ${e(a.heading)}\n`,a.secondary&&(c+=`  ${a.secondary.label}: ${e(a.secondary)}\n`),t.synonyms.length>0&&(c+=`  Synonyms: ${t.synonyms.join(`; `)}\n`),t.description&&(c+=`  Description: ${V(t.description,ni,s)}\n`),t.biology&&(c+=`  Biology: ${t.biology}\n`),t.distribution&&(c+=`  Distribution: ${t.distribution}\n`),t.confusables.length>0&&(c+=`  Confusable species:
`,t.confusables.forEach(e=>{c+=`    - ${e.name}${e.distinction?` — ${e.distinction}`:``}\n`})),c+=`
`})}s.length>0&&(c+=`========================================
`,c+=`FIGURES DATA
`,c+=`========================================

`,s.forEach((e,t)=>{let n=t+1,r=e.filename||`Untitled File`,i=e.caption?V(e.caption,ni):`No caption provided.`;c+=`Figure #${n}\n`,c+=`  Filename: ${r}\n`,c+=`  Caption:  ${i}\n\n`})),a(c,x(i.title,`.txt`),`text/plain;charset=utf-8;`)}catch(e){console.error(`Plain Text Export system failure:`,e),I(`❌ An unexpected error disrupted the plain text document generation pipeline.`,`error`)}}async function ii(e){try{let t=e.getFigures(),n=[],r=e.getActiveProjectUid();for(let e of t){let t=await A.getFigureBinary(r,e.id),i=null;t&&(i=await ee(t)),n.push({...e,binaryData:i})}let i={metadata:{application:Oe,version:ke,exportedAt:new Date().toISOString()},title:e.getTitle(),data:{title:e.getTitle(),key:e.getKey(),figures:n,taxa:e.getTaxa()}};a(JSON.stringify(i,null,2),x(e.getTitle(),`.tskey`),`application/json`)}catch(e){console.error(`JSON (.tskey) export system failure:`,e),I(`❌ An unexpected error disrupted the .tskey file export.`,`error`)}}function ai(e,t,n,r){let i=document.getElementById(`modal-open-project`);document.querySelector(`#cmd-new`)?.addEventListener(`click`,async()=>{if(e.hasUnsavedChanges()&&!confirm(`You have unsaved workspace changes. Discard and make a brand new project memory space?`))return;let t=prompt(`Enter name/title for the new key:`,`Untitled Key`);if(t===null)return;let r=t.trim()||`Untitled Key`;try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Do you want to wipe it out and start fresh?`))return;await e.createNewProject(r),I(`📄 New workspace "${r}" initiated!`,`success`),z(n)}catch(e){console.error(`Failed to initialize a new project workspace safely: `,e),I(`⚠️ Could not initialize database workspace entries.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save-as`)?.addEventListener(`click`,async()=>{jt(document),await sn();let t=e.getTitle(),r=prompt(`Save current configuration under a new title:`,t);if(r===null)return;let i=r.trim();if(!i){I(`⚠️ Invalid project title.`,`error`);return}try{if((await A.getProjectList()).some(e=>e.name.toLowerCase()===i.toLowerCase())&&!confirm(`A project named "${i}" already exists. Do you want to overwrite it?`))return;await e.saveAsProject(i),I(`💾 Saved workspace as "${i}"`,`success`),z(n)}catch{I(`⚠️ Save As operation failed.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save`)?.addEventListener(`click`,async()=>{jt(document),await sn();let t=e.getPersistedTitle(),r=e.getTitle();try{if(t&&t!==r&&(await A.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Overwrite it?`))return;await e.saveToStorage(),I(t&&t!==r?`💾 Renamed and saved workspace as "${r}"`:`💾 Changes saved successfully!`,`success`),z(n)}catch(e){console.error(`Atomic save/rename failed:`,e),I(`⚠️ Save failed. Your changes were kept in memory.`,`error`)}},{signal:r}),document.querySelector(`#cmd-export-json`)?.addEventListener(`click`,()=>{ii(e)},{signal:r});let a=document.querySelector(`#file-import-hidden`),o=!1;a?.addEventListener(`change`,async t=>{let r=t.target.files?.[0];if(!r)return;if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`),a&&(a.value=``);return}if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`)){a&&(a.value=``);return}let s=!1;try{o=!0;let t;try{t=JSON.parse(await r.text())}catch(e){console.error(`Import parse error:`,e),alert(`Malformed JSON structure: Unable to parse file stream.`);return}let c=`Untitled Imported Key`;if(S(t)&&typeof t.title==`string`&&t.title.trim()?c=t.title.trim():r.name&&(c=r.name.replace(/\.tskey$/i,``).trim()),(await A.getProjectList()).some(e=>e.name.toLowerCase()===c.toLowerCase())&&!confirm(`A local project named "${c}" already exists. Do you want to completely overwrite it with this import file?`)){a&&(a.value=``);return}let l=e.importJsonData(t);if(!l.success){alert(`Failed to import JSON schema:\n• ${l.errors.join(`
• `)}`),a&&(a.value=``);return}s=!0,e.setTitle(c);let u=[];if(l.importedFigures&&l.importedFigures.length>0){for(let e of l.importedFigures)if(e.binaryData)try{let t=await(await fetch(e.binaryData)).blob();A.uploadFigureBinary(e.id,t);let n=j.get(e.id);n&&URL.revokeObjectURL(n);let r=URL.createObjectURL(t);j.set(e.id,r)}catch(t){console.error(`Failed to parse binary data for figure ${e.id}:`,t),u.push(e.id)}}await e.saveToStorage(),u.length===0?I(`📥 Imported workspace "${c}" successfully!`,`success`):(I(`⚠️ Workspace imported, but ${u.length} image(s) failed.`,`error`),alert(`Workspace "${c}" was loaded, but the following figure IDs encountered binary errors or corruption and could not be recovered:\n\n• Figure ID(s): ${u.join(`, `)}\n\nPlease try re-uploading these specific images in the editor.`)),i&&i.style.display===`flex`&&await Pt(e),z(n)}catch(e){console.error(`Import processing error:`,e);let t=e instanceof Error?e.message:String(e);s?(alert(`The key was imported into the editor, but saving it to browser storage failed:\n${t}\n\nUse File → Save to retry.`),z(n)):alert(`Import failed before any data was changed:\n${t}`)}finally{o=!1,a&&(a.value=``)}},{signal:r}),document.querySelector(`#cmd-trigger-import`)?.addEventListener(`click`,()=>{if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`);return}a?.click()},{signal:r}),document.querySelector(`#cmd-import-text`)?.addEventListener(`click`,()=>{if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`);return}Ir()},{signal:r}),document.querySelector(`#cmd-export-text`)?.addEventListener(`click`,()=>ri(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r}),document.querySelector(`#cmd-export-html`)?.addEventListener(`click`,()=>Xr(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r}),document.querySelector(`#cmd-export-latex`)?.addEventListener(`click`,()=>ti(e,t.leadFormat,t.showBackReference,t.nameDisplayMode),{signal:r})}function oi(e,t,n,r){document.querySelector(`#cmd-undo`)?.addEventListener(`click`,()=>{t.typing.clearAll(),e.undo()&&z(n)},{signal:r}),document.querySelector(`#cmd-redo`)?.addEventListener(`click`,()=>{t.typing.clearAll(),e.redo()&&z(n)},{signal:r}),document.querySelector(`#cmd-cut`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&confirm(`Confirm cutting ${t} highlighted step(s) to clipboard?`)&&(e.cutSelectedCouplets(),I(`Cut ${t} step(s) to clipboard.`,`success`),z(n))},{signal:r}),document.querySelector(`#cmd-copy`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&(e.copySelectedCouplets(),I(`Copied ${t} step(s) to clipboard.`,`success`),z(n))},{signal:r}),document.querySelector(`#cmd-paste-above`)?.addEventListener(`click`,()=>{gn(e,n,`above`)},{signal:r}),document.querySelector(`#cmd-paste-below`)?.addEventListener(`click`,()=>{gn(e,n,`below`)},{signal:r}),document.querySelector(`#cmd-delete`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size,r=e.getSelectedFigureIds().size,i=e.getSelectedTaxonIds().size;if(i>0&&confirm(`Confirm removing highlighted taxa? Any key leads pointing at them will be cleared.`)&&(e.deleteSelectedTaxa(),I(`Deleted ${i} taxon(a).`,`success`),z(n)),t>0&&confirm(`Confirm removing highlighted key steps?`)&&(e.deleteSelectedCouplets(),I(`Deleted ${t} step(s).`,`success`),z(n)),r>0&&confirm(`Confirm removing highlighted figures?`)){let t=new Set(e.getSelectedFigureIds());e.deleteSelectedFigures(),t.forEach(e=>{A.deleteFigureBinary(e);let t=j.get(e);t&&URL.revokeObjectURL(t),j.delete(e)}),I(`Deleted ${r} figure(s).`,`success`),z(n)}},{signal:r}),document.querySelector(`#cmd-swap`)?.addEventListener(`click`,()=>{e.getSelectedCoupletIds().size>0&&e.swapSelectedCouplets()&&(I(`Swapped choice configurations.`,`success`),z(n))},{signal:r});let i=()=>hn(e,n);document.querySelector(`#cmd-add`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#add-couplet-btn`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#cmd-clear`)?.addEventListener(`click`,()=>{e.clearSelection(),e.clearFigureSelection(),e.clearTaxonSelection(),z(n)},{signal:r}),document.querySelector(`#cmd-select-all`)?.addEventListener(`click`,()=>{e.selectAll(),z(n)},{signal:r}),document.querySelector(`#cmd-toggle-figures`)?.addEventListener(`click`,()=>{t.toggleFigures(),z(n)},{signal:r}),document.querySelector(`#cmd-toggle-images`)?.addEventListener(`click`,()=>{t.toggleImages(),z(n)},{signal:r}),document.querySelector(`#cmd-toggle-taxa`)?.addEventListener(`click`,()=>{t.toggleTaxa(),z(n)},{signal:r}),document.querySelector(`#cmd-toggle-print`)?.addEventListener(`click`,()=>{t.togglePrint(),z(n)},{signal:r}),document.querySelector(`#cmd-reorder-couplets`)?.addEventListener(`click`,()=>{e.autoOrderCouplets(),I(`Key steps reordered with shorter branches first!`,`success`),z(n)},{signal:r}),document.querySelector(`#cmd-reorder-figures`)?.addEventListener(`click`,()=>{e.autoOrderFigures(),I(`Figures reordered to match key reference order!`,`success`),z(n)},{signal:r}),document.querySelector(`#cmd-sort-taxa`)?.addEventListener(`click`,()=>{let r=t.nameDisplayMode;e.sortTaxaByName(r),I(`Taxa sorted alphabetically by ${r} name!`,`success`),z(n)},{signal:r})}function si(e,t,n){let r=document.querySelector(`.main-layout`);r&&r.addEventListener(`click`,n=>{let r=n.target.closest(`.panel-toggle`);if(!r)return;let i=r.closest(`[data-panel]`)?.dataset.panel;i&&(e.togglePanelCollapse(i),z(t))},{signal:n})}function ci(e){let t=document.querySelector(`.app-menu-bar`);if(!t)return;let n=()=>Array.from(t.querySelectorAll(`.menu-trigger`)),r=e=>{let t=e.nextElementSibling;return t?Array.from(t.querySelectorAll(`.dropdown-action:not(:disabled)`)):[]},i=()=>{n().forEach(e=>e.setAttribute(`aria-expanded`,`false`))};t.addEventListener(`click`,e=>{let t=e.target.closest(`.menu-trigger`);if(t){e.stopPropagation();let n=t.getAttribute(`aria-expanded`)===`true`;i(),t.setAttribute(`aria-expanded`,n?`false`:`true`)}},{signal:e}),t.addEventListener(`pointerover`,e=>{let t=e.target.closest(`.menu-trigger`);!t||t.getAttribute(`aria-expanded`)===`true`||n().some(e=>e.getAttribute(`aria-expanded`)===`true`)&&(i(),t.setAttribute(`aria-expanded`,`true`))},{signal:e}),document.addEventListener(`click`,()=>i(),{signal:e}),t.addEventListener(`keydown`,e=>{let t=document.activeElement;if(!t)return;let a=t.classList.contains(`menu-trigger`),o=t.classList.contains(`dropdown-action`);if(!a&&!o)return;let s=n(),c=a?t:t.closest(`.menu-item`)?.querySelector(`.menu-trigger`),l=r(c),u=s.indexOf(c),d=l.indexOf(t);switch(e.key){case`ArrowRight`:{if(e.preventDefault(),s.length===0)return;let t=s[(u+1)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowLeft`:{if(e.preventDefault(),s.length===0)return;let t=s[(u-1+s.length)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowDown`:e.preventDefault(),a&&c?(c.setAttribute(`aria-expanded`,`true`),l.length>0&&l[0].focus()):o&&l.length>0&&l[(d+1)%l.length].focus();break;case`ArrowUp`:e.preventDefault(),o&&l.length>0&&l[(d-1+l.length)%l.length].focus();break;case`Escape`:e.preventDefault(),i(),c?.focus();break;case`Enter`:case` `:if(a&&c){e.preventDefault();let t=c.getAttribute(`aria-expanded`)===`true`;c.setAttribute(`aria-expanded`,t?`false`:`true`),!t&&l.length>0&&setTimeout(()=>l[0].focus(),10)}break}},{signal:e})}function li(e,t){let n=new AbortController;return window.addEventListener(`keydown`,r=>{let i=document.getElementById(`plain-text-import-view`);if(i&&i.style.display===`flex`)return;let a=document.querySelectorAll(`.modal-overlay`),s=Array.from(a).find(e=>e.style.display===`flex`);if(s){if(r.key===`Escape`){s.style.display=`none`,r.preventDefault();return}if(r.key===`Tab`){r.preventDefault();let e=Array.from(s.querySelectorAll(`button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`)).filter(e=>e.offsetParent!==null);e.length>0&&e[(e.indexOf(document.activeElement)+(r.shiftKey?-1:1)+e.length)%e.length].focus();return}}let c=o?r.metaKey:r.ctrlKey,l=document.activeElement,u=l&&(l.tagName===`INPUT`||l.tagName===`TEXTAREA`||l.hasAttribute(`contenteditable`));if(r.altKey&&!c&&!r.shiftKey&&r.code===`KeyF`&&zn(l)){r.preventDefault();let t=l.getBoundingClientRect();Vn(e,t.left+16,t.top+24,n.signal);return}if(c&&r.key.toLowerCase()===`s`){r.preventDefault(),r.shiftKey?document.querySelector(`#cmd-save-as`)?.click():document.querySelector(`#cmd-save`)?.click();return}if(c&&r.key.toLowerCase()===`o`){r.preventDefault(),document.querySelector(`#cmd-open-dialog`)?.click();return}if(c&&r.altKey&&r.key.toLowerCase()===`n`){r.preventDefault(),document.querySelector(`#cmd-new`)?.click();return}if(c&&r.shiftKey&&r.key.toLowerCase()===`f`){r.preventDefault(),document.querySelector(`#cmd-toggle-figures`)?.click();return}if(c&&r.shiftKey&&r.key.toLowerCase()===`p`){r.preventDefault(),document.querySelector(`#cmd-toggle-print`)?.click();return}if(!u){if(r.altKey&&r.key.toLowerCase()===`n`){r.preventDefault(),document.querySelector(`#cmd-add`)?.click();return}if(c&&r.key.toLowerCase()===`a`){r.preventDefault(),document.querySelector(`#cmd-select-all`)?.click();return}if(r.altKey&&r.key.toLowerCase()===`s`){r.preventDefault(),document.querySelector(`#cmd-swap`)?.click();return}if(c&&r.key.toLowerCase()===`z`){r.preventDefault(),r.shiftKey?document.querySelector(`#cmd-redo`)?.click():document.querySelector(`#cmd-undo`)?.click();return}if(c&&r.key.toLowerCase()===`y`){r.preventDefault(),document.querySelector(`#cmd-redo`)?.click();return}let n=()=>document.querySelector(`.popover, .menu-trigger[aria-expanded="true"]`)!==null;if(r.key===`Delete`||r.key===`Backspace`){if(n())return;r.preventDefault(),document.querySelector(`#cmd-delete`)?.click();return}if(r.key===`Escape`){if(n())return;r.preventDefault(),document.querySelector(`#cmd-clear`)?.click();return}let i=(window.getSelection()?.toString()??``).trim()!==``;if(c&&r.key.toLowerCase()===`c`){if(i||e.getSelectedCoupletIds().size===0)return;r.preventDefault(),document.querySelector(`#cmd-copy`)?.click();return}if(c&&r.key.toLowerCase()===`x`){if(i||e.getSelectedCoupletIds().size===0)return;r.preventDefault(),document.querySelector(`#cmd-cut`)?.click();return}if(c&&r.key.toLowerCase()===`v`){if(!e.hasClipboardData())return;r.preventDefault(),gn(e,t,r.shiftKey?`above`:`below`);return}}},{signal:n.signal}),()=>{n.abort()}}var ui=[{mark:`bold`,title:`Bold (Ctrl/Cmd+B)`,html:`<b>B</b>`},{mark:`italic`,title:`Italic (Ctrl/Cmd+I)`,html:`<i>I</i>`},{mark:`subscript`,title:`Subscript`,html:`x<sub>2</sub>`},{mark:`superscript`,title:`Superscript`,html:`x<sup>2</sup>`}],di=new Map(bt.map(e=>[e.tag.toUpperCase(),e.name]));function fi(e){let t=new Set,n=window.getSelection();if(!n||n.rangeCount===0)return t;let r=n.getRangeAt(0).commonAncestorContainer;for(;r&&r!==e;){if(r.nodeType===Node.ELEMENT_NODE){let e=r;if(e.dataset.open!==void 0){let n=di.get(e.tagName);n&&t.add(n)}}r=r.parentNode}return t}var $=null,pi=null,mi=null,hi=null,gi=null;function _i(e){return e?(e.nodeType===Node.ELEMENT_NODE?e:e.parentElement)?.closest(`.rte-host`)??null:null}function vi(){let e=window.getSelection();if(!e||e.rangeCount===0||e.isCollapsed)return null;let t=_i(e.anchorNode);return!t||t!==_i(e.focusNode)?null:t}function yi(){let e=document.createElement(`div`);return e.className=`format-toolbar`,e.setAttribute(`role`,`toolbar`),e.style.display=`none`,e.innerHTML=ui.map(e=>`<button type="button" data-mark="${e.mark}" title="${e.title}" aria-pressed="false">${e.html}</button>`).join(``)+`<button type="button" data-fig title="Insert figure reference (Alt+F)">Fig</button>`,e.addEventListener(`mousedown`,e=>e.preventDefault()),e.addEventListener(`click`,t=>{let n=t.target.closest(`button`);if(!n||!pi)return;let r=n.getAttribute(`data-mark`);if(r)Ct(pi)?.toggleMark(r);else if(n.hasAttribute(`data-fig`)&&hi&&gi){let t=e.getBoundingClientRect();Vn(hi,t.left,t.bottom+4,gi)}}),e}function bi(){$&&($.style.display=`none`),pi=null}function xi(){mi=null;let e=vi();if(!e){bi();return}pi=e,$||($=yi(),document.body.appendChild($));let t=$.querySelector(`[data-fig]`);t.style.display=e.dataset.rteFigures===`true`?``:`none`;let n=fi(e);$.querySelectorAll(`[data-mark]`).forEach(e=>{let t=n.has(e.getAttribute(`data-mark`));e.classList.toggle(`is-active`,t),e.setAttribute(`aria-pressed`,t?`true`:`false`)}),$.style.display=`flex`,$.style.visibility=`hidden`;let r=window.getSelection().getRangeAt(0).getBoundingClientRect(),i=$.getBoundingClientRect(),a=r.top-i.height-8;a<4&&(a=r.bottom+8);let o=r.left+r.width/2-i.width/2;o=Math.max(8,Math.min(o,window.innerWidth-i.width-8)),$.style.top=`${a}px`,$.style.left=`${o}px`,$.style.visibility=`visible`}function Si(){mi===null&&(mi=requestAnimationFrame(xi))}function Ci(e,t){hi=e,gi=t,document.addEventListener(`selectionchange`,Si,{signal:t}),window.addEventListener(`scroll`,Si,{signal:t,capture:!0}),window.addEventListener(`resize`,Si,{signal:t}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&bi()},{signal:t}),t.addEventListener(`abort`,()=>{mi!==null&&cancelAnimationFrame(mi),mi=null,$?.remove(),$=null,pi=null,hi=null,gi=null})}var wi=[{id:101,alt1:`Has feathers [figID: 101]`,alt2:`Lacks feathers`,branch1:{kind:`taxonDraft`,name:`Bird`},branch2:{kind:`linked`,targetId:102}},{id:102,alt1:`Has fur [figID: 102]`,alt2:`Scales or bare skin`,branch1:{kind:`taxonDraft`,name:`Mammal`},branch2:{kind:`linked`,targetId:103}},{id:103,alt1:`Has scales [figID: 103]`,alt2:`Skin is smooth and moist`,branch1:{kind:`taxonDraft`,name:`Reptile2`},branch2:{kind:`taxonDraft`,name:`Amphibian`}}],Ti=[{id:101,filename:`feathers.jpg`,caption:`Bird feathers`},{id:102,filename:`fur.jpg`,caption:`Wolf fur`},{id:103,filename:`Lizard.jpg`,caption:`Lizard scales`}];function Ei(e,t,n){let r=document.querySelector(`#editor-container`);if(!r)return()=>{};let i=new AbortController,{signal:a}=i;return Vr(e,t,n,a),cn(e,n,a),dn(r,e,n,a),fn(r,e,t,n,a),Hr(r,e,t,a),pn(r,e,t,n,a),mn(r,e,n,a),Hn(e,t,n,a),er(e,t,n,a),Ur(e,t,n,a),ai(e,t,n,a),oi(e,t,n,a),Wn(e,a),Ci(e,a),nn(e,t,a),rn(e,n,a),ci(a),si(t,n,a),()=>{i.abort()}}async function Di(){let e=document.querySelector(`#app`);if(!e)throw Error(`Application bootstrap failed: DOM target element '#app' was not found.`);let t=new ze,n=t.activeProjectTitle,r=new Pe([],[]);r.setProjectPersistedListener(e=>t.setActiveProjectTitle(e));let i=!1;if(n&&n!==`Untitled Key`)try{i=await r.loadProject(n)}catch(e){console.error(`Failed to restore active project session "${n}":`,e)}i||(console.log(`🌱 No active database workspace recovered. Hydrating baseline sample template.`),await r.loadFromStorage([...wi],[...Ti],`Untitled Key`),t.setActiveProjectTitle(`Untitled Key`));let a=()=>{Ve(t),Ue(r,t),Sn(r,t,a),hr(r,t),qn(r,t,a),lr(r,t,a)},o=[],s=e=>{r.hasUnsavedChanges()&&(e.preventDefault(),e.returnValue=``)};window.addEventListener(`beforeunload`,s),o.push(()=>window.removeEventListener(`beforeunload`,s)),Be(e);let c=Ei(r,t,a),l=li(r,a);o.push(c),o.push(l),a()}Di().catch(e=>{console.error(`Application bootstrap failed:`,e);let t=document.querySelector(`#app`);if(t){let n=document.createElement(`p`);n.className=`bootstrap-error`,n.textContent=`⚠️ TSKey could not start: `+(e instanceof Error?e.message:String(e))+` — close other TSKey tabs and reload.`,t.replaceChildren(n)}});