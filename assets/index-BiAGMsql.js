(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.freeze({kind:`empty`});function t(e){return e.kind===`linked`?e.targetId:null}function n(e,t){switch(e.kind){case`linked`:return t.has(e.targetId)?`linked`:`broken`;case`unresolved`:return`unresolved`;case`taxon`:return`taxon`;case`empty`:return`empty`}}var r={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`};function i(e){return e?e.replace(/[&<>"']/g,e=>r[e]):``}function a(e,t,n){let r=null,i=null;try{try{let t=new Blob([e],{type:n});r=URL.createObjectURL(t)}catch(t){console.warn(`Blob URL creation blocked by environment security constraints. Attempting standard Base64 encoding fallback.`,t);let i=new TextEncoder().encode(e),a=``,o=8192;for(let e=0;e<i.length;e+=o){let t=i.subarray(e,e+o);a+=String.fromCharCode(...t)}let s=btoa(a);r=`data:${n.toLowerCase().includes(`charset=`)?n:`${n};charset=utf-8`};base64,${s}`}i=document.createElement(`a`),i.href=r,i.download=t,i.style.display=`none`,i.style.pointerEvents=`none`,document.body.appendChild(i),i.click();let a=i,o=r;setTimeout(()=>{a&&document.body.contains(a)&&document.body.removeChild(a),o&&o.startsWith(`blob:`)&&URL.revokeObjectURL(o)},200)}catch(e){console.error(`An unhandled exception occurred during file synthesis/download processing:`,e),i&&document.body.contains(i)&&document.body.removeChild(i),r&&r.startsWith(`blob:`)&&URL.revokeObjectURL(r)}}var o=(()=>{let e=navigator.userAgentData;if(e?.platform)return e.platform.toLowerCase().includes(`mac`);let t=(navigator.platform||``).toLowerCase();if(t.includes(`mac`)||t.includes(`iphone`)||t.includes(`ipad`)||t.includes(`ipod`))return!0;let n=navigator.userAgent.toLowerCase();return n.includes(`macintosh`)||n.includes(`mac os x`)})();function s(e){if(!e||typeof e!=`object`)return!1;let t=e;switch(t.kind){case`linked`:return typeof t.targetId==`number`;case`unresolved`:return typeof t.couplet==`number`;case`taxon`:return typeof t.name==`string`;case`empty`:return!0;default:return!1}}function c(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.alt1==`string`&&typeof e.alt2==`string`&&s(e.branch1)&&s(e.branch2))||t.has(e.id)?!1:(t.add(e.id),!0))}function l(e){if(!Array.isArray(e))return!1;let t=new Set;return e.every(e=>!(e&&typeof e==`object`&&typeof e.id==`number`&&e.id>0&&typeof e.filename==`string`&&typeof e.caption==`string`)||t.has(e.id)?!1:(t.add(e.id),!0))}function u(e){let t=new Map;return e.forEach((e,n)=>t.set(e.id,n)),t}function d(e){let t=new Map;return e.forEach((e,n)=>{t.set(e.id,n+1)}),t}function f(e,t){switch(e.kind){case`linked`:{let n=t.get(e.targetId);if(n!==void 0){let e=(n+1).toString();return{inputValue:e,printText:e,printClass:`print-dest-strong`,isUnresolved:!1}}return{inputValue:`?`,printText:`?`,printClass:`error-text`,isUnresolved:!0}}case`unresolved`:{let t=e.couplet.toString();return{inputValue:t,printText:t,printClass:`error-text`,isUnresolved:!0}}case`taxon`:return{inputValue:e.name,printText:e.name,printClass:`print-dest-taxon`,isUnresolved:!1};case`empty`:return{inputValue:``,printText:`...`,printClass:``,isUnresolved:!1}}}var p=`classic`;function m(e){return e===`classic`||e===`lettered`||e===`minimal`}function h(e){let n=new Map;e.forEach((e,r)=>{let i=r+1;for(let r of[e.branch1,e.branch2]){let e=t(r);if(e===null)continue;let a=n.get(e);a||n.set(e,a=new Set),a.add(i)}});let r=new Map;for(let[e,t]of n)r.set(e,[...t].sort((e,t)=>e-t));return r}function g(e,t,n){let r;switch(e){case`lettered`:r={lead1:`${t}a`,lead2:`${t}b`};break;case`minimal`:r={lead1:`${t}`,lead2:`-`};break;default:r={lead1:`${t}.`,lead2:`—`};break}return n&&n.length>0&&(r.lead1+=` (${n.join(`, `)})`),r}function _(e,t){let n=e.trim();if(n===``)return{kind:`empty`};if(/^\d+$/.test(n)){let e=parseInt(n,10),r=e-1;return r>=0&&r<t.length?{kind:`linked`,targetId:t[r].id}:{kind:`unresolved`,couplet:e}}return{kind:`taxon`,name:n}}function v(e,t=`.tskey`){return`${e.toLowerCase().trim().replace(/[^a-z0-9_\-]/gi,`_`).replace(/_+/g,`_`).replace(/_$/,``)||`untitled_key`}${t}`}function y(e){return typeof e==`object`&&!!e}var b=()=>/\[figID:\s*(\d+)\s*\]/gi,x=()=>/\[fig:\s*([^\]]+?)\s*\]/gi;function S(e){let t=new Map,n=new Map,r=new Map,i=new Map;return e.forEach((e,a)=>{let o=a+1;t.set(e.id,o),n.set(o,e),i.set(e.id,e);let s=e.filename.trim().toLowerCase();s&&r.set(s,e)}),{idToDisplayNum:t,displayNumToFig:n,filenameToFig:r,idToFig:i}}function C(e,t){return new Promise((n,r)=>{e.oncomplete=()=>n(),e.onerror=()=>r(e.error),e.onabort=()=>r(Error(t))})}function w(e){return new Promise((t,n)=>{e.onsuccess=()=>t(e.result),e.onerror=()=>n(e.error)})}var T=class{dbName=`TSKey_Workspace_DB`;projectsStoreName=`projects`;figuresStoreName=`figures`;dbPromise=null;getDB(){return this.dbPromise?this.dbPromise:(this.dbPromise=new Promise((e,t)=>{let n=indexedDB.open(this.dbName,2);n.onupgradeneeded=()=>{let e=n.result;e.objectStoreNames.contains(this.projectsStoreName)||e.createObjectStore(this.projectsStoreName,{keyPath:`title`}),e.objectStoreNames.contains(this.figuresStoreName)||e.createObjectStore(this.figuresStoreName)},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error),n.onblocked=()=>{alert(`⚠️ TSKey could not open its database because another tab still has an older version open. Please close other TSKey tabs and reload.`),t(Error(`IndexedDB open blocked by another open connection.`))}}),this.dbPromise.catch(()=>{this.dbPromise=null}),this.dbPromise)}getFigureKey(e,t){return`${e}::${t}`}parseFigureId(e){return parseInt(e.substring(e.lastIndexOf(`::`)+2),10)}getProjectKeyRange(e){let t=`${e}::`,n=t.substring(0,t.length-1)+String.fromCharCode(t.charCodeAt(t.length-1)+1);return IDBKeyRange.bound(t,n,!1,!0)}async getProjectList(){return(await w((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).getAll())).map(e=>({name:e.title,lastModified:e.lastModified})).sort((e,t)=>t.lastModified-e.lastModified)}async saveProject(e,t,n,r){let i=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`);return i.objectStore(this.projectsStoreName).put({title:e,projectUid:t,dichotomousKey:n,figures:r,lastModified:Date.now()}),C(i,`Transaction aborted while saving project: ${e}`)}async loadProject(e){return await w((await this.getDB()).transaction(this.projectsStoreName,`readonly`).objectStore(this.projectsStoreName).get(e))||null}async deleteProject(e,t){let n=(await this.getDB()).transaction([this.projectsStoreName,this.figuresStoreName],`readwrite`);n.objectStore(this.projectsStoreName).delete(e);let r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(t));return r.onsuccess=e=>{let t=e.target.result;t&&(t.delete(),t.continue())},C(n,`Project deletion aborted for: ${e}`)}async deleteProjectRecordOnly(e){let t=(await this.getDB()).transaction(this.projectsStoreName,`readwrite`);return t.objectStore(this.projectsStoreName).delete(e),C(t,`Project record deletion aborted for: ${e}`)}async saveFigure(e,t,n){let r=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return r.objectStore(this.figuresStoreName).put(n,this.getFigureKey(e,t)),C(r,`Transaction aborted while saving figure ID ${t}`)}async deleteFigure(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`);return n.objectStore(this.figuresStoreName).delete(this.getFigureKey(e,t)),C(n,`Transaction aborted while deleting figure ID ${t}`)}async cleanupOrphanFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(e));return r.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key);t.has(e)||n.delete(),n.continue()}},C(n,`Orphan cleanup transaction aborted for project: ${e}`)}async getFigure(e,t){return await w((await this.getDB()).transaction(this.figuresStoreName,`readonly`).objectStore(this.figuresStoreName).get(this.getFigureKey(e,t)))||null}async cloneProjectFigures(e,t){let n=(await this.getDB()).transaction(this.figuresStoreName,`readwrite`),r=n.objectStore(this.figuresStoreName),i=r.openCursor(this.getProjectKeyRange(e));return i.onsuccess=e=>{let n=e.target.result;if(n){let e=this.parseFigureId(n.key),i=n.value;r.put(i,this.getFigureKey(t,e)),n.continue()}},C(n,`Cloning figures transaction aborted from "${e}" to "${t}"`)}},E=new class{storage=new T;pendingUploads=new Map;pendingDeletes=new Set;commitPromise=null;async getProjectList(){return this.storage.getProjectList()}async saveProject(e,t,n,r){await this.storage.saveProject(e,t,n,r),await this.commitStagedChanges(t,r)}async loadProject(e){this.resetActiveImageCache();let t=await this.storage.loadProject(e);return t?.projectUid&&await this.storage.cleanupOrphanFigures(t.projectUid,new Set(t.figures.map(e=>e.id))),t}async deleteProject(e){let t=await this.storage.loadProject(e);if(t)return this.storage.deleteProject(e,t.projectUid)}async deleteProjectRecord(e){return this.storage.deleteProjectRecordOnly(e)}async cloneProjectFigures(e,t){return this.storage.cloneProjectFigures(e,t)}clearStagedChanges(){this.pendingUploads.clear(),this.pendingDeletes.clear()}getStagingSnapshot(){return{uploads:new Map(this.pendingUploads),deletes:new Set(this.pendingDeletes)}}restoreStagingSnapshot(e){let t=new Set([...this.pendingUploads.keys(),...this.pendingDeletes,...e.uploads.keys(),...e.deletes]);for(let n of t){let t=this.pendingUploads.get(n)===e.uploads.get(n),r=this.pendingDeletes.has(n)===e.deletes.has(n);if(t&&r)continue;let i=D.get(n);i&&(URL.revokeObjectURL(i),D.delete(n))}this.pendingUploads=new Map(e.uploads),this.pendingDeletes=new Set(e.deletes)}resetActiveImageCache(){k(),this.clearStagedChanges()}deleteFigureBinary(e){this.pendingUploads.delete(e),this.pendingDeletes.add(e)}uploadFigureBinary(e,t){this.pendingDeletes.delete(e),this.pendingUploads.set(e,t)}async getFigureBinary(e,t){return this.pendingUploads.has(t)?this.pendingUploads.get(t):this.pendingDeletes.has(t)?null:this.storage.getFigure(e,t)}async commitStagedChanges(e,t){let n=this.commitPromise??Promise.resolve(),r=new Map(this.pendingUploads),i=new Set(this.pendingDeletes),a=(async()=>{await n.catch(()=>{});try{let n=new Set(t.map(e=>e.id));for(let[t,i]of r)n.has(t)&&await this.storage.saveFigure(e,t,i);for(let t of i)await this.storage.deleteFigure(e,t);await this.storage.cleanupOrphanFigures(e,n);for(let[e,t]of r)this.pendingUploads.get(e)===t&&this.pendingUploads.delete(e);for(let e of i)this.pendingDeletes.delete(e)}catch(e){throw e instanceof Error&&e.name===`QuotaExceededError`&&alert(`⚠️ Browser storage is full! Could not save the latest images. Please delete old workspaces to free up space.`),e}})().finally(()=>{this.commitPromise===a&&(this.commitPromise=null)});return this.commitPromise=a,a}},D=new Map;function O(e){return new Promise((t,n)=>{let r=new FileReader;r.onloadend=()=>t(r.result),r.onerror=n,r.readAsDataURL(e)})}function k(){for(let e of D.values())URL.revokeObjectURL(e);D.clear()}var A=`TSKey`,j=`0.0.1`;function M(){return crypto.randomUUID()}function N(e,n){let r=new Set;if(e.length===0)return r;let i=n||new Map(e.map(e=>[e.id,e])),a=[e[0].id];for(;a.length>0;){let e=a.pop();if(!r.has(e)){r.add(e);let n=i.get(e);if(n){let e=t(n.branch2);e!==null&&a.push(e);let r=t(n.branch1);r!==null&&a.push(r)}}}return r}function ee(e,n){let r={steps:[],reachable:!1};if(e.length===0)return r;let i=new Map(e.map(e=>[e.id,e])),a=new Map;if(e.forEach((e,t)=>a.set(e.id,t)),!i.has(n))return r;let o=e[0].id,s=new Map,c=new Set([o]),l=[o];for(;l.length>0;){let e=l.shift();if(e===n)break;let r=i.get(e);if(!r)continue;let a=[[r.branch1,`a`],[r.branch2,`b`]];for(let[n,r]of a){let a=t(n);a!==null&&i.has(a)&&!c.has(a)&&(c.add(a),s.set(a,{parentId:e,choice:r}),l.push(a))}}if(!c.has(n))return r;let u=[],d=n,f;for(;d!==void 0;){u.push({id:d,choice:f});let e=s.get(d);f=e?.choice,d=e?.parentId}return u.reverse(),{steps:u.map(e=>({id:e.id,stepNum:(a.get(e.id)??0)+1,choice:e.choice})),reachable:!0}}function te(e,n){let r=new Map;if(e.length===0)return r;let i=new Map,a=new Map,o=new Map,s=new Set(n.map(e=>e.id)),{displayNumToFig:c,filenameToFig:l}=S(n),u=e=>{let t=e.trim();if(t===``)return!1;let n=parseInt(t,10);return!isNaN(n)&&String(n)===t?c.has(n):l.has(t.toLowerCase())};e.forEach((e,n)=>{i.set(e.id,e),a.set(e.id,n);let r=t(e.branch1);if(r!==null){let t=o.get(r);t||o.set(r,t=new Set),t.add(e.id)}let s=t(e.branch2);if(s!==null){let t=o.get(s);t||o.set(s,t=new Set),t.add(e.id)}});let d=N(e,i),f=b(),p=x();return e.forEach((e,t)=>{let n=[];if(e.branch1.kind===`unresolved`?n.push({severity:`error`,message:`Choice A points to step '${e.branch1.couplet}' which does not exist yet.`}):e.branch1.kind===`empty`&&n.push({severity:`warning`,message:`Choice A is incomplete. Assign a Taxa or destination step.`}),e.branch2.kind===`unresolved`?n.push({severity:`error`,message:`Choice B points to step '${e.branch2.couplet}' which does not exist yet.`}):e.branch2.kind===`empty`&&n.push({severity:`warning`,message:`Choice B is incomplete. Assign a Taxa or destination step.`}),e.alt1){let t=[];for(let n of e.alt1.matchAll(f)){let e=parseInt(n[1],10);!s.has(e)&&!t.includes(e)&&t.push(e)}t.forEach(e=>{n.push({severity:`warning`,message:`Choice A references a missing or deleted figure (Internal ID: ${e}).`})});let r=[];for(let t of e.alt1.matchAll(p)){let e=t[1].trim();!u(e)&&!r.includes(e)&&r.push(e)}r.forEach(e=>{n.push({severity:`warning`,message:`Choice A references an unresolved figure reference '[fig: ${e}]'.`})})}if(e.alt2){let t=[];for(let n of e.alt2.matchAll(f)){let e=parseInt(n[1],10);!s.has(e)&&!t.includes(e)&&t.push(e)}t.forEach(e=>{n.push({severity:`warning`,message:`Choice B references a missing or deleted figure (Internal ID: ${e}).`})});let r=[];for(let t of e.alt2.matchAll(p)){let e=t[1].trim();!u(e)&&!r.includes(e)&&r.push(e)}r.forEach(e=>{n.push({severity:`warning`,message:`Choice B references an unresolved figure reference '[fig: ${e}]'.`})})}t>0&&!d.has(e.id)&&n.push({severity:`warning`,message:`Orphaned: This step is unreachable from Step #1.`}),e.branch1.kind===`linked`&&(e.branch1.targetId===e.id?n.push({severity:`error`,message:`Choice A loops directly into its own key step.`}):i.has(e.branch1.targetId)||n.push({severity:`error`,message:`Choice A points to an invalid or deleted step.`})),e.branch2.kind===`linked`&&(e.branch2.targetId===e.id?n.push({severity:`error`,message:`Choice B loops directly into its own key step.`}):i.has(e.branch2.targetId)||n.push({severity:`error`,message:`Choice B points to an invalid or deleted step.`}));let c=o.get(e.id);if(c&&c.size>1){let e=[];c.forEach(t=>{let n=a.get(t);n!==void 0&&n!==-1&&e.push(`#${n+1}`)}),n.push({severity:`warning`,message:`Convergence: Multiple steps (${e.join(`, `)}) link here.`})}n.length>0&&r.set(e.id,n)}),r}var ne=class{state;hasUncommittedChanges=!1;editScope=null;persistedTitle=``;activeProjectUid=M();onProjectPersisted;undoStack=[];redoStack=[];maxHistoryLimit;savedHistoryIndex=0;currentHistoryIndex=0;selectedCoupletIds=new Set;_draggedId=null;activeCoupletId=null;clipboardBuffer=[];clipboardMode=`copy`;cutIncomingLinksBuffer=[];selectedFigureIds=new Set;constructor(e,t=[],n=`Untitled Key`,r=100){this.state={title:n,dichotomousKey:e,figures:t},this.maxHistoryLimit=r,this.hasUncommittedChanges=!1,this.persistedTitle=n}getTitle(){return this.state.title}getPersistedTitle(){return this.persistedTitle}getActiveProjectUid(){return this.activeProjectUid}setTitle(e){let t=e.trim();this.state.title!==t&&(this.saveCheckpoint(),this.state.title=t||`Untitled Key`,this.hasUncommittedChanges=!0)}getKey(){return this.state.dichotomousKey}getFigures(){return this.state.figures||[]}getSelectedCoupletIds(){return this.selectedCoupletIds}setActiveCouplet(e){this.activeCoupletId=e}getActiveCoupletId(){return this.activeCoupletId}clearActiveCouplet(){this.activeCoupletId=null}get draggedCoupletId(){return this._draggedId}startDraggingCouplet(e){this._draggedId=e}stopDraggingCouplet(){this._draggedId=null}markSaved(){this.savedHistoryIndex=this.currentHistoryIndex,this.hasUncommittedChanges=!1,this.editScope=null}hasUnsavedChanges(){return this.currentHistoryIndex!==this.savedHistoryIndex||this.hasUncommittedChanges}resetTrackingContext(){this.undoStack=[],this.redoStack=[],this.currentHistoryIndex=0,this.savedHistoryIndex=0,this.hasUncommittedChanges=!1,this.editScope=null,this.selectedCoupletIds.clear(),this.activeCoupletId=null,this._draggedId=null}captureState(){return{title:this.state.title,dichotomousKey:this.state.dichotomousKey.map(e=>({...e})),figures:(this.state.figures||[]).map(e=>({...e}))}}captureHistoryEntry(){return{state:this.captureState(),staging:E.getStagingSnapshot()}}saveCheckpoint(){this.redoStack.length>0&&this.savedHistoryIndex>this.currentHistoryIndex&&(this.savedHistoryIndex=-1),this.redoStack=[],this.undoStack.push(this.captureHistoryEntry()),this.undoStack.length>this.maxHistoryLimit&&(this.undoStack.shift(),this.currentHistoryIndex--,this.savedHistoryIndex>0?this.savedHistoryIndex--:this.savedHistoryIndex=-1),this.currentHistoryIndex++,this.hasUncommittedChanges=!1,this.editScope=null}undo(){if(this.undoStack.length===0)return!1;this.redoStack.push(this.captureHistoryEntry()),this.redoStack.length>this.maxHistoryLimit&&this.redoStack.shift();let e=this.undoStack.pop();return e&&(this.state=e.state,E.restoreStagingSnapshot(e.staging)),this.currentHistoryIndex--,this.hasUncommittedChanges=!1,this.editScope=null,this.clipboardMode===`cut`&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[]),!0}redo(){if(this.redoStack.length===0)return!1;this.undoStack.push(this.captureHistoryEntry()),this.undoStack.length>this.maxHistoryLimit&&this.undoStack.shift(),this.currentHistoryIndex++;let e=this.redoStack.pop();return this.state=e.state,E.restoreStagingSnapshot(e.staging),this.hasUncommittedChanges=!1,this.editScope=null,this.clipboardMode===`cut`&&(this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[]),!0}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}copySelectedCouplets(){let e=this.getSelectedCoupletIds();e.size!==0&&(this.clipboardBuffer=this.state.dichotomousKey.filter(t=>e.has(t.id)).map(e=>({...e})),this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[])}hasClipboardData(){return this.clipboardBuffer.length>0}generateInboundLinksMap(){let e=new Map;return this.state.dichotomousKey.forEach((n,r)=>{let i=r+1,a=t(n.branch1);a!==null&&(e.has(a)||e.set(a,[]),e.get(a).push(`${i}a`));let o=t(n.branch2);o!==null&&(e.has(o)||e.set(o,[]),e.get(o).push(`${i}b`))}),e}getReachableNodes(e){return N(this.state.dichotomousKey,e)}endTypingSession(){this.hasUncommittedChanges&&(this.hasUncommittedChanges=!1,this.editScope=null)}updateCouplet(e,t){this.editScope!==`key`&&this.saveCheckpoint(),this.editScope=`key`;let n=this.state.dichotomousKey.findIndex(t=>t.id===e);if(n===-1)return;let r={...this.state.dichotomousKey[n],...t},i=[...this.state.dichotomousKey];i[n]=r,this.state.dichotomousKey=i,this.hasUncommittedChanges=!0}addCouplet(){this.saveCheckpoint();let t=this.state.dichotomousKey.reduce((e,t)=>{let n=Number(t?.id);return isNaN(n)?e:Math.max(e,n)},0)+1,n=this.state.dichotomousKey.length+1,r=-1,i=null;for(let e=this.state.dichotomousKey.length-1;e>=0;e--){let t=this.state.dichotomousKey[e];if(t.branch1.kind===`empty`){r=e,i=`branch1`;break}else if(t.branch2.kind===`empty`){r=e,i=`branch2`;break}}let a={kind:`linked`,targetId:t},o=e=>e.kind===`unresolved`&&e.couplet===n?a:e,s=this.state.dichotomousKey.map((e,t)=>{let n={...e};return n.branch1=o(n.branch1),n.branch2=o(n.branch2),t===r&&i&&(n[i]=a),n});return this.state.dichotomousKey=[...s,{id:t,alt1:``,alt2:``,branch1:e,branch2:e}],this.hasUncommittedChanges=!0,t}pasteCouplets(e,t=`below`){if(this.clipboardBuffer.length===0)return!1;this.saveCheckpoint();let n=this.state.dichotomousKey.length;if(e!==void 0){let r=this.state.dichotomousKey.findIndex(t=>t.id===e);r!==-1&&(n=t===`above`?r:r+1)}let r=this.state.dichotomousKey.reduce((e,t)=>Math.max(e,t.id),0),i=new Map;this.clipboardBuffer.forEach((e,t)=>{let n=r+t+1;i.set(e.id,n)});let a=e=>e.kind===`linked`&&i.has(e.targetId)?{kind:`linked`,targetId:i.get(e.targetId)}:e,o=this.clipboardBuffer.map(e=>({...e,id:i.get(e.id),branch1:a(e.branch1),branch2:a(e.branch2)})),s=[...this.state.dichotomousKey];return s.splice(n,0,...o),this.clipboardMode===`cut`&&this.cutIncomingLinksBuffer.length>0&&(s=s.map(e=>{let t={...e};return this.cutIncomingLinksBuffer.filter(t=>t.sourceId===e.id).forEach(e=>{let n=i.get(e.targetOldId);n!==void 0&&(t[e.field]={kind:`linked`,targetId:n})}),t}),this.clipboardMode=`copy`,this.cutIncomingLinksBuffer=[]),this.state.dichotomousKey=s,this.setSelectionBatch(o.map(e=>e.id)),this.hasUncommittedChanges=!0,!0}cutSelectedCouplets(){let n=this.getSelectedCoupletIds();n.size!==0&&(this.saveCheckpoint(),this.activeCoupletId!==null&&n.has(this.activeCoupletId)&&(this.activeCoupletId=null),this.clipboardBuffer=this.state.dichotomousKey.filter(e=>n.has(e.id)).map(e=>({...e})),this.clipboardMode=`cut`,this.cutIncomingLinksBuffer=[],this.state.dichotomousKey=this.state.dichotomousKey.filter(e=>!n.has(e.id)).map(r=>{let i={...r},a=t(r.branch1);a!==null&&n.has(a)&&(this.cutIncomingLinksBuffer.push({sourceId:r.id,field:`branch1`,targetOldId:a}),i.branch1=e);let o=t(r.branch2);return o!==null&&n.has(o)&&(this.cutIncomingLinksBuffer.push({sourceId:r.id,field:`branch2`,targetOldId:o}),i.branch2=e),i}),this.selectedCoupletIds=new Set,this.hasUncommittedChanges=!0)}deleteSelectedCouplets(){if(this.selectedCoupletIds.size===0)return;this.saveCheckpoint();let n=this.selectedCoupletIds;this.activeCoupletId!==null&&n.has(this.activeCoupletId)&&(this.activeCoupletId=null);let r=r=>{let i=t(r);return i!==null&&n.has(i)?e:r};this.state.dichotomousKey=this.state.dichotomousKey.filter(e=>!n.has(e.id)).map(e=>({...e,branch1:r(e.branch1),branch2:r(e.branch2)})),this.selectedCoupletIds=new Set,this.hasUncommittedChanges=!0}swapSelectedCouplets(){if(this.selectedCoupletIds.size===0)return!1;this.saveCheckpoint();let e=!1;return this.state.dichotomousKey=this.state.dichotomousKey.map(t=>this.selectedCoupletIds.has(t.id)?(e=!0,{...t,alt1:t.alt2,alt2:t.alt1,branch1:t.branch2,branch2:t.branch1}):t),e?(this.hasUncommittedChanges=!0,!0):!1}reorderCouplets(e,t,n=`above`){if(e===t)return!1;let r=[...this.state.dichotomousKey],i=r.findIndex(t=>t.id===e),a=r.findIndex(e=>e.id===t);if(i===-1||a===-1)return console.warn(`Aborted reordering: srcIdx (${i}) or targetIdx (${a}) was invalid.`),!1;this.saveCheckpoint();let[o]=r.splice(i,1),s=a;return n===`above`&&i<a?s--:n===`below`&&i>a&&s++,r.splice(s,0,o),this.state.dichotomousKey=r,this.hasUncommittedChanges=!0,!0}autoOrderCouplets(){if(this.state.dichotomousKey.length===0)return;this.saveCheckpoint();let e=new Map(this.state.dichotomousKey.map(e=>[e.id,e])),r=n=>{let r=t(n);return r!==null&&e.has(r)?r:null},i={taxon:1,linked:2,unresolved:2,broken:3,empty:3},a=new Map,o=new Set,s=t=>{switch(n(t,e)){case`taxon`:return 0;case`linked`:return c(t.targetId);case`unresolved`:return t.couplet||0;default:return 1e4}},c=t=>{if(!e.has(t))return 0;if(a.has(t))return a.get(t);if(o.has(t))return 0;o.add(t);let n=e.get(t),r=s(n.branch1),i=s(n.branch2);o.delete(t);let c=1+Math.max(r,i);return a.set(t,c),c};this.state.dichotomousKey.forEach(e=>c(e.id));let l=this.state.dichotomousKey.map(t=>{let r=n(t.branch1,e),a=n(t.branch2,e),o=i[r],c=i[a],l=!1;if(o>c)l=!0;else if(o===c&&o===2){let e=s(t.branch1),n=s(t.branch2);(n<e||n===e&&r!==a&&a===`linked`)&&(l=!0)}return l?{...t,alt1:t.alt2,alt2:t.alt1,branch1:t.branch2,branch2:t.branch1}:{...t}}),u=new Map(l.map(e=>[e.id,e])),d=new Map;l.forEach(e=>{let t=r(e.branch1);t!==null&&d.set(t,(d.get(t)||0)+1);let n=r(e.branch2);n!==null&&d.set(n,(d.get(n)||0)+1)});let f=l.filter(e=>!d.has(e.id));f.length===0&&l.length>0&&f.push(l[0]);let p=new Set,m=[],h=e=>{let t=[e];for(;t.length>0;){let e=t.pop();if(e===0||p.has(e))continue;let n=u.get(e);if(!n)continue;p.add(e),m.push(n);let i=r(n.branch2);i!==null&&!p.has(i)&&t.push(i);let a=r(n.branch1);a!==null&&!p.has(a)&&t.push(a)}};f.forEach(e=>h(e.id)),l.forEach(e=>{p.has(e.id)||h(e.id)}),this.state.dichotomousKey=m,this.hasUncommittedChanges=!0}getSelectedFigureIds(){return this.selectedFigureIds}toggleFigureSelection(e,t){t?this.selectedFigureIds.has(e)?this.selectedFigureIds.delete(e):this.selectedFigureIds.add(e):this.selectedFigureIds=new Set([e])}clearFigureSelection(){this.selectedFigureIds.clear()}deleteSelectedFigures(){if(this.selectedFigureIds.size===0)return;this.saveCheckpoint();let e=this.selectedFigureIds;this.state.figures=this.state.figures.filter(t=>!e.has(t.id)),this.selectedFigureIds=new Set,this.hasUncommittedChanges=!0}addFigure(e,t){this.saveCheckpoint();let n=this.state.figures||[],r=n.reduce((e,t)=>Math.max(e,t.id),0)+1;return this.state.figures=[...n,{id:r,filename:e,caption:t}],this.hasUncommittedChanges=!0,r}updateFigure(e,t){this.editScope!==`figures`&&this.saveCheckpoint(),this.editScope=`figures`;let n=this.state.figures.findIndex(t=>t.id===e);if(n===-1)return;let r={...this.state.figures[n],...t},i=[...this.state.figures];i[n]=r,this.state.figures=i,this.hasUncommittedChanges=!0}reorderFigures(e,t){if(!this.state.figures||e===t)return;this.saveCheckpoint();let n=[...this.state.figures],[r]=n.splice(e,1);n.splice(t,0,r),this.state.figures=n,this.hasUncommittedChanges=!0}autoOrderFigures(){let e=this.state.figures||[];if(e.length===0||this.state.dichotomousKey.length===0)return;this.saveCheckpoint();let{idToFig:t,displayNumToFig:n,filenameToFig:r}=S(e),i=[],a=new Set;for(let e of this.state.dichotomousKey){let o=e.branch1.kind===`taxon`?e.branch1.name:``,s=e.branch2.kind===`taxon`?e.branch2.name:``,c=[e.alt1,e.alt2,o,s];for(let e of c){if(!e)continue;let o,s=b();for(;(o=s.exec(e))!==null;){let e=parseInt(o[1].trim(),10),n=t.get(e);n&&!a.has(n.id)&&(a.add(n.id),i.push(n))}let c=x();for(;(o=c.exec(e))!==null;){let e=o[1].trim(),t,s=parseInt(e,10);if(!isNaN(s)&&String(s)===e&&n.has(s))t=n.get(s);else{let n=e.toLowerCase();r.has(n)&&(t=r.get(n))}t&&!a.has(t.id)&&(a.add(t.id),i.push(t))}}}for(let t of e)a.has(t.id)||i.push(t);this.state.figures=i,this.hasUncommittedChanges=!0}exportJsonData(){return{type:A,version:j,title:this.state.title,data:{title:this.state.title,key:this.state.dichotomousKey,figures:this.state.figures}}}importJsonData(e){try{let t=null,n=[],r=`Untitled Key`;if(y(e)&&y(e.data)){let i=e.data;c(i.key)&&(t=i.key,l(i.figures)&&(n=i.figures)),typeof i.title==`string`?r=i.title:typeof e.title==`string`&&(r=e.title)}if(!t&&c(e)&&(t=e),!t)return{success:!1,errors:[`The uploaded file does not match the required schema structure.`]};let i=[];return n.length>0&&(i=[...n],n=n.map(e=>{let{binaryData:t,...n}=e;return n})),this.saveCheckpoint(),this.state.title=r,this.activeProjectUid=M(),this.persistedTitle=r,this.state.dichotomousKey=t,this.state.figures=n,E.resetActiveImageCache(),this.clearSelection(),this.activeCoupletId=null,this.hasUncommittedChanges=!0,{success:!0,errors:[],importedFigures:i}}catch(e){return{success:!1,errors:[e instanceof Error?e.message:`Unknown engine exception during parsing the json file.`]}}}getProjectName(){return this.state.title}setProjectName(e){this.setTitle(e)}setProjectPersistedListener(e){this.onProjectPersisted=e}commitPersistedTitle(e){this.persistedTitle=e,this.onProjectPersisted?.(e)}async createNewProject(e){this.state.title=e,this.activeProjectUid=M(),this.commitPersistedTitle(e),this.state.dichotomousKey=[],this.state.figures=[],this.resetTrackingContext(),E.resetActiveImageCache(),await this.saveToStorage()}async loadProject(e){let t=await E.loadProject(e);return t?(this.state.title=t.title,this.activeProjectUid=t.projectUid||M(),this.commitPersistedTitle(t.title),this.state.dichotomousKey=t.dichotomousKey,this.state.figures=t.figures,this.resetTrackingContext(),!0):!1}async saveToStorage(){let e=this.persistedTitle&&this.persistedTitle!==this.state.title,t=this.persistedTitle;try{let n=this.state.dichotomousKey;await E.saveProject(this.state.title,this.activeProjectUid,n,this.state.figures),e&&t&&await E.deleteProjectRecord(t),this.commitPersistedTitle(this.state.title),this.markSaved()}catch(n){throw console.error(`Failed to save or rename project workspace:`,n),e&&t&&(this.state.title=t,E.clearStagedChanges()),n}}async saveAsProject(e){let t=this.persistedTitle,n=this.activeProjectUid,r=M();try{await E.cloneProjectFigures(n,r),this.state.title=e,this.activeProjectUid=r,await E.saveProject(e,r,this.state.dichotomousKey,this.state.figures),this.commitPersistedTitle(e),this.markSaved()}catch(e){throw console.error(`Save As Operation Failed:`,e),this.state.title=t,this.activeProjectUid=n,e}}async loadFromStorage(e=[],t=[],n=`Untitled Key`){let r=n,i=await this.loadProject(r);return i||(this.state={title:r,dichotomousKey:e,figures:t},this.persistedTitle=r,this.activeProjectUid=M(),E.resetActiveImageCache(),this.resetTrackingContext()),i}toggleSelection(e,t){t?this.selectedCoupletIds.has(e)?this.selectedCoupletIds.delete(e):this.selectedCoupletIds.add(e):this.selectedCoupletIds=new Set([e])}clearSelection(){this.selectedCoupletIds.size!==0&&this.selectedCoupletIds.clear()}setSelectionBatch(e){this.selectedCoupletIds=new Set(e)}selectAll(){this.selectedCoupletIds=new Set(this.state.dichotomousKey.map(e=>e.id))}runDiagnostics(){return te(this.state.dichotomousKey,this.state.figures)}resolveTextReferences(e,t){if(!e)return e;let n=this.state.figures.length,{filenameToFig:r}=S(this.state.figures);return e=e.replace(b(),(e,n)=>{let r=parseInt(n.trim(),10),i=t.get(r);return i===void 0?`[Broken Fig: ID ${r}]`:`(Fig. ${i})`}),e=e.replace(x(),(e,i)=>{let a=i.trim(),o=parseInt(a,10);if(!isNaN(o)&&String(o)===a&&o>=1&&o<=n)return`(Fig. ${o})`;let s=r.get(a.toLowerCase());if(s){let e=t.get(s.id);if(e!==void 0)return`(Fig. ${e})`}return`[Broken Fig: ${a}]`}),e}encodeFigureTokens(e){if(!e)return``;let{displayNumToFig:t,filenameToFig:n}=S(this.state.figures);return e.replace(x(),(e,r)=>{let i=r.trim(),a=parseInt(i,10);if(!isNaN(a)&&String(a)===i&&t.has(a))return`[figID: ${t.get(a).id}]`;let o=n.get(i.toLowerCase());return o?`[figID: ${o.id}]`:e})}decodeTextReferencesForEditor(e){if(!e)return``;let{idToDisplayNum:t}=S(this.state.figures);return e.replace(b(),(e,n)=>{let r=parseInt(n.trim(),10),i=t.get(r);return i===void 0?e:`[fig: ${i}]`})}},re=`dichotomous_key_ui`,P={isFiguresHidden:!1,isPrintHidden:!1,isImagesHidden:!1,activeProjectTitle:`Untitled Key`,leadFormat:p,showBackReference:!1},ie=class{active=!1;fieldKey=null;timeoutId=null;isActive(){return this.active}getFieldKey(){return this.fieldKey}start(e,t){(!this.active||this.fieldKey!==e)&&(this.clearTimer(),t(),this.active=!0,this.fieldKey=e)}extendTimeout(e,t){this.clearTimer(),this.timeoutId=window.setTimeout(()=>{this.timeoutId=null,this.active=!1,this.fieldKey=null,t()},e)}clearTimer(){this.timeoutId!==null&&(clearTimeout(this.timeoutId),this.timeoutId=null)}end(e,t){return!this.active&&this.fieldKey===null?!1:e===null||this.fieldKey===e?(this.active=!1,this.fieldKey=null,this.clearTimer(),t(),!0):!1}},ae=class{couplets=new ie;figures=new ie},oe=class{state;typing=new ae;constructor(){this.state=this.loadFromStorage()}get isFiguresHidden(){return this.state.isFiguresHidden}get isImagesHidden(){return this.state.isImagesHidden}get isPrintHidden(){return this.state.isPrintHidden}get activeProjectTitle(){return this.state.activeProjectTitle||`Untitled Key`}get leadFormat(){return this.state.leadFormat}get showBackReference(){return this.state.showBackReference}setActiveProjectTitle(e){this.state={...this.state,activeProjectTitle:e.trim()},this.persist()}toggleFigures(){this.state={...this.state,isFiguresHidden:!this.state.isFiguresHidden},this.persist()}togglePrint(){this.state={...this.state,isPrintHidden:!this.state.isPrintHidden},this.persist()}toggleImages(){this.state={...this.state,isImagesHidden:!this.state.isImagesHidden},this.persist()}setLeadFormat(e){!m(e)||this.state.leadFormat===e||(this.state={...this.state,leadFormat:e},this.persist())}setShowBackReference(e){this.state.showBackReference!==e&&(this.state={...this.state,showBackReference:e},this.persist())}loadFromStorage(){try{let e=localStorage.getItem(re);if(!e)return{...P};let t={...P,...JSON.parse(e)};return m(t.leadFormat)||(t.leadFormat=p),t}catch{return{...P}}}persist(){try{localStorage.setItem(re,JSON.stringify(this.state))}catch(e){console.warn(`UIStateStore: Failed to persist UI preferences to localStorage.`,e)}}};function se(e){e.innerHTML=`
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
              <span>ℹ️ About ${A}...</span>
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
          <h4 class="about-title">${A}</h4>
          <p class="about-version">
            Version ${j} (2026 Engine Core)
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
    `}function ce(e){document.querySelector(`.figure-column`)?.classList.toggle(`is-hidden`,e.isFiguresHidden),document.querySelector(`.print-column`)?.classList.toggle(`is-hidden`,e.isPrintHidden)}function F(e,t,n,r=!1){let i=e.querySelector(t);return i?((r||document.activeElement!==i)&&i.value!==n&&(i.value=n),i):null}function le(e,t){if(!document.querySelector(`.app-menu-bar`))return;let n=e=>document.getElementById(e),r=e.getSelectedCoupletIds().size,i=e.getSelectedFigureIds().size,a=r>0||i>0,o=r>0,s=e.getKey().length>0,c=e.hasClipboardData(),l=e.getProjectName(),u=e.hasUnsavedChanges(),d=`${l}${u?` *`:``}`;document.title=`${d} - ${A}`;let f=document.getElementById(`active-project-title`);f&&f.textContent!==d&&(f.textContent=d);let p=n(`cmd-save`),m=n(`cmd-export-json`),h=n(`cmd-export-text`),g=n(`cmd-export-html`),_=n(`cmd-export-latex`),v=n(`cmd-undo`),y=n(`cmd-redo`),b=n(`cmd-cut`),x=n(`cmd-copy`),S=n(`cmd-paste-below`),C=n(`cmd-paste-above`),w=n(`cmd-delete`),T=n(`cmd-swap`),E=n(`cmd-clear`),D=n(`cmd-reorder-couplets`),O=n(`cmd-reorder-figures`);p&&p.classList.toggle(`has-unsaved-changes`,u),m&&(m.disabled=!s),h&&(h.disabled=!s),g&&(g.disabled=!s),_&&(_.disabled=!s),v&&(v.disabled=!e.canUndo),y&&(y.disabled=!e.canRedo),b&&(b.disabled=!o),x&&(x.disabled=!o),w&&(w.disabled=!a),T&&(T.disabled=!o),E&&(E.disabled=!a),S&&(S.disabled=!c),C&&(C.disabled=!c),D&&(D.disabled=!s),O&&(O.disabled=!s||e.getFigures().length===0);let k=n(`cmd-toggle-figures`),j=n(`cmd-toggle-images`),M=n(`cmd-toggle-print`);if(k){let e=k.querySelector(`span`);e&&(e.textContent=t.isFiguresHidden?`🖼️ Show Figures Panel`:`🖼️ Hide Figures Panel`)}if(j){let e=j.querySelector(`span`);e&&(e.textContent=t.isImagesHidden?`🖼️ Show Images in Figures Panel`:`🖼️ Hide Images in Figures Panel`)}if(M){let e=M.querySelector(`span`);e&&(e.textContent=t.isPrintHidden?`🖨️ Show Print Preview`:`🖨️ Hide Print Preview`)}let N=document.querySelector(`.app-shell`);N&&F(N,`#key-title-input`,e.getTitle())}function ue(e,t){let n=document.getElementById(`project-hub-list`);if(n){if(e.length===0){n.innerHTML=`<div class="hub-empty">No keys saved inside local browser memory yet.</div>`;return}n.innerHTML=e.map(e=>{let n=e.name===t,r=new Date(e.lastModified).toLocaleString(),a=i(e.name);return`
            <div class="project-hub-item${n?` is-current`:``}" data-name="${a}">
                <div class="hub-item-clickable-zone" data-action="load" data-name="${a}">
                    <span class="hub-item-name">${a}${n?` <small class="hub-item-active-tag">(active)</small>`:``}</span>
                    <span class="hub-item-date">Last saved: ${r}</span>
                </div>
                <button class="btn-hub-delete" data-action="delete" data-name="${a}" title="Delete from local database">&times;</button>
            </div>
        `}).join(``)}}function de(e){let n=document.getElementById(`editor-container`);if(!n)return;let r=e.getKey(),a=e.getSelectedCoupletIds(),o=e.runDiagnostics(),s=u(r),c=e.generateInboundLinksMap(),l=a.size===1?[...a][0]:a.size===0?e.getActiveCoupletId():null,d=new Set,p=new Set;if(l!==null){let e=r.find(e=>e.id===l);if(e){let n=t(e.branch1);n!==null&&d.add(n);let r=t(e.branch2);r!==null&&d.add(r)}r.forEach(e=>{(t(e.branch1)===l||t(e.branch2)===l)&&p.add(e.id)})}let m=Array.from(n.querySelectorAll(`.key-card`)),h=new Map;m.forEach(e=>{let t=e.getAttribute(`data-id`);t&&h.set(Number(t),e)}),r.forEach((t,u)=>{let m=u+1,g=a.has(t.id),_=c.get(t.id)||[],v=f(t.branch1,s),y=f(t.branch2,s),b=o.get(t.id)||[],x=`${m}.`,S=_.length||u===0?`badge badge-linked`:`badge badge-isolated`,C=_.length?`← ${_.map(e=>{let t=r[parseInt(e,10)-1]?.id;return t===void 0?i(e):`<span class="badge-link" data-step-id="${t}">${i(e)}</span>`}).join(`, `)}`:u===0?`🏁 root`:`⚠️ isolated`,w=``;b.forEach(e=>{let t=e.severity===`error`?`error-text`:`warning-text`;w+=`<div class="${t}">⚠️ ${i(e.message)}</div>`});let T=b.length>0?`<div class="warning-block">${w}</div>`:``,E=t.id!==l&&d.has(t.id),D=t.id!==l&&p.has(t.id),O=h.get(t.id);if(O){h.delete(t.id),O.classList.toggle(`is-selected`,g),O.classList.toggle(`is-link-out`,E),O.classList.toggle(`is-link-in`,D);let r=O.querySelector(`.card-title`);r&&r.textContent!==x&&(r.textContent=x);let i=O.querySelector(`.badge`);i&&(i.className=S,i.innerHTML!==C&&(i.innerHTML=C)),F(O,`textarea[data-field="alt1"]`,e.decodeTextReferencesForEditor(t.alt1)),F(O,`input[data-field="dest1"]`,v.inputValue)?.classList.toggle(`input-error`,v.isUnresolved),F(O,`textarea[data-field="alt2"]`,e.decodeTextReferencesForEditor(t.alt2)),F(O,`input[data-field="dest2"]`,y.inputValue)?.classList.toggle(`input-error`,y.isUnresolved);let a=O.querySelector(`.warning-block`);b.length>0?a?a.innerHTML!==w&&(a.innerHTML=w):O.insertAdjacentHTML(`beforeend`,T):a&&a.remove(),n.children[u]!==O&&n.insertBefore(O,n.children[u]||null)}else O=document.createElement(`div`),O.draggable=!0,O.setAttribute(`data-id`,t.id.toString()),O.className=`key-card`,g&&O.classList.add(`is-selected`),E&&O.classList.add(`is-link-out`),D&&O.classList.add(`is-link-in`),O.innerHTML=`
                <div class="card-header">
                  <div class="card-header-left">
                    <h4 class="card-title">${x}</h4>
                    <span class="${S}">${C}</span>
                  </div>
                  <span class="drag-handle">☰</span>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt1" placeholder="Enter diagnostic trait details [fig: 1]...">${i(e.decodeTextReferencesForEditor(t.alt1))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${v.isUnresolved?`input-error`:``}" data-field="dest1" placeholder="Taxon or Step #" value="${i(v.inputValue)}" />
                    </label>
                  </div>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${i(e.decodeTextReferencesForEditor(t.alt2))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${y.isUnresolved?`input-error`:``}" data-field="dest2" placeholder="Taxon or Step #" value="${i(y.inputValue)}" />
                    </label>
                  </div>
                </div>
                ${T}
            `,n.insertBefore(O,n.children[u]||null)}),h.forEach(e=>e.remove())}var fe=null;function pe(e,t,n){if(t.isFiguresHidden)return;let r=document.getElementById(`figure-container`);if(!r)return;let i=e.getFigures(),a=Array.from(r.children),o=new Map;a.forEach(e=>{let t=Number(e.getAttribute(`data-id`));isNaN(t)||o.set(t,e)}),i.forEach((i,a)=>{let s=a+1,c=e.getSelectedFigureIds().has(i.id),l=o.get(i.id);if(!l)l=document.createElement(`div`),l.className=`figure-card`,l.setAttribute(`data-id`,i.id.toString()),l.draggable=!0,l.innerHTML=`
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
            `;else{let e=l.querySelector(`.figure-card-title`);e&&(e.textContent=`${s}.`),o.delete(i.id)}r.children[a]!==l&&r.insertBefore(l,r.children[a]||null),l.classList.toggle(`is-selected`,c);let u=l.querySelector(`.figure-preview-wrapper`),d=l.querySelector(`.figure-preview-img`);if(t.isImagesHidden)u&&(u.style.display=`none`),d&&(d.style.display=`none`);else{u&&(u.style.display=``);let t=D.get(i.id),r=l.querySelector(`.btn-remove-image`);if(t)d.src!==t&&(d.src=t),d.style.display=`block`,r&&(r.style.display=`inline-block`);else if(!d.hasAttribute(`data-loading-state`)){d.setAttribute(`data-loading-state`,`pending`);let t=e.getActiveProjectUid();E.getFigureBinary(t,i.id).then(a=>{if(d.removeAttribute(`data-loading-state`),e.getActiveProjectUid()===t)if(a){let e=URL.createObjectURL(a);D.set(i.id,e),fe===null&&(fe=requestAnimationFrame(()=>{fe=null,n()}))}else d.style.display=`none`,r&&(r.style.display=`none`)}).catch(e=>{console.error(`Failed to load binary thumbnail:`,e),d.removeAttribute(`data-loading-state`),r&&(r.style.display=`none`)})}}let f=l.querySelector(`.figure-input-filename`);f&&document.activeElement!==f&&f.value!==i.filename&&(f.value=i.filename);let p=l.querySelector(`.figure-input-caption`);p&&document.activeElement!==p&&p.value!==i.caption&&(p.value=i.caption)}),o.forEach(e=>e.remove());let s=new Set(i.map(e=>e.id));for(let[e,t]of D.entries())s.has(e)||(URL.revokeObjectURL(t),D.delete(e))}var me=/\[figID:\s*(\d+)\s*\]|\[fig:\s*([^\]]+?)\s*\]/gi;function he(e,t){return`<span class="fig-ref" data-fig-id="${e}">(Fig. ${t})</span>`}function ge(e,t,n){if(!e)return``;let{displayNumToFig:r,filenameToFig:a}=S(t),o=t.length,s=``,c=0,l=new RegExp(me.source,me.flags),u;for(;(u=l.exec(e))!==null;)if(s+=i(e.slice(c,u.index)),c=u.index+u[0].length,u[1]!==void 0){let e=parseInt(u[1],10),t=n.get(e);s+=t===void 0?`<span class="error-text">[Fig: ID ${e}]</span>`:he(e,t)}else{let e=(u[2]??``).trim(),t=null,c=parseInt(e,10);if(!isNaN(c)&&String(c)===e&&c>=1&&c<=o){let e=r.get(c);e&&(t={figId:e.id,displayNum:c})}else{let r=a.get(e.toLowerCase()),i=r?n.get(r.id):void 0;r&&i!==void 0&&(t={figId:r.id,displayNum:i})}s+=t?he(t.figId,t.displayNum):`<span class="error-text">[Fig: ${i(e)}]</span>`}return s+=i(e.slice(c)),s}function _e(e,t){if(t.isPrintHidden)return;let n=document.getElementById(`print-view-container`);if(!n)return;let r=e.getKey(),i=t.leadFormat,a=u(r),o=e.getFigures(),s=d(o),c=t.showBackReference?h(r):null;n.dataset.leadFormat=i;let l=Array.from(n.querySelectorAll(`.print-step-block`)),p=new Map;l.forEach(e=>{let t=e.getAttribute(`data-id`);t&&p.set(Number(t),e)}),r.forEach((e,t)=>{let{lead1:r,lead2:l}=g(i,t+1,c?.get(e.id)),u=f(e.branch1,a),d=f(e.branch2,a),m=ge(e.alt1,o,s)||`___`,h=ge(e.alt2,o,s)||`___`,_=p.get(e.id);if(_){p.delete(e.id);let i=_.querySelector(`.print-step-num`);i&&i.textContent!==r&&(i.textContent=r);let a=_.querySelector(`.print-dash`);a&&a.textContent!==l&&(a.textContent=l);let o=_.querySelector(`.print-row[data-choice="1"] .print-text`);o&&o.innerHTML!==m&&(o.innerHTML=m);let s=_.querySelector(`.print-row[data-choice="1"] .print-dest`);if(s){s.textContent!==u.printText&&(s.textContent=u.printText);let e=`print-dest ${u.printClass}`.trim();s.className!==e&&(s.className=e)}let c=_.querySelector(`.print-row[data-choice="2"] .print-text`);c&&c.innerHTML!==h&&(c.innerHTML=h);let f=_.querySelector(`.print-row[data-choice="2"] .print-dest`);if(f){f.textContent!==d.printText&&(f.textContent=d.printText);let e=`print-dest ${d.printClass}`.trim();f.className!==e&&(f.className=e)}n.children[t]!==_&&n.insertBefore(_,n.children[t]||null)}else{_=document.createElement(`div`),_.className=`print-step-block`,_.setAttribute(`data-id`,e.id.toString()),_.innerHTML=`
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
            `;let t=_.querySelector(`.print-step-num`);t&&(t.textContent=r);let i=_.querySelector(`.print-dash`);i&&(i.textContent=l);let a=_.querySelector(`.print-row[data-choice="1"] .print-text`);a&&(a.innerHTML=m);let o=_.querySelector(`.print-row[data-choice="1"] .print-dest`);o&&(o.textContent=u.printText,u.printClass&&(o.className=`print-dest ${u.printClass}`.trim()));let s=_.querySelector(`.print-row[data-choice="2"] .print-text`);s&&(s.innerHTML=h);let c=_.querySelector(`.print-row[data-choice="2"] .print-dest`);c&&(c.textContent=d.printText,d.printClass&&(c.className=`print-dest ${d.printClass}`.trim())),n.appendChild(_)}}),p.forEach(e=>e.remove())}function I(e,t=`success`){let n=document.querySelector(`.toast-container`);n||(n=document.createElement(`div`),n.className=`toast-container`,n.setAttribute(`aria-live`,`polite`),document.body.appendChild(n));let r=document.createElement(`div`);r.className=`toast toast-${t}`,r.textContent=e,t===`error`?r.setAttribute(`role`,`alert`):r.setAttribute(`role`,`status`),n.appendChild(r),setTimeout(()=>{r.remove(),n&&n.childElementCount===0&&n.remove()},3e3)}var ve=`...`,ye=`___`;function be(e){switch(e){case`auto`:return`Auto-detect`;case`utf-8`:return`UTF-8`;case`utf-16le`:return`UTF-16 LE`;case`utf-16be`:return`UTF-16 BE`;case`windows-1252`:return`Windows-1252 / Latin-1`}}function xe(e){return e.length>=3&&e[0]===239&&e[1]===187&&e[2]===191?`utf-8`:e.length>=2&&e[0]===255&&e[1]===254?`utf-16le`:e.length>=2&&e[0]===254&&e[1]===255?`utf-16be`:null}function Se(e){let t=xe(e);if(t)return t;let n=Math.min(e.length,4096),r=0,i=0;for(let t=0;t<n;t++)e[t]===0&&(t%2==0?r++:i++);if(n>0&&(r+i)/n>.2)return i>r?`utf-16le`:`utf-16be`;try{return new TextDecoder(`utf-8`,{fatal:!0}).decode(e),`utf-8`}catch{return`windows-1252`}}function Ce(e,t){let n=new Uint8Array(e),r=t===`auto`?Se(n):t;return{text:new TextDecoder(r).decode(e),encoding:r,autoDetected:t===`auto`}}var L=500,R={minLeaderDots:3,useWhitespaceSeparator:!0,joinWrappedLines:!0,dehyphenate:!0,recognizeLetteredCouplets:!0,recognizeDashSecondLead:!0,fillMissingCouplets:!0};function we(e){let t=(e??``).replace(/\s+/g,` `).trim();return t===ye?``:t}function Te(e){let t=e.findIndex(e=>e.trim().toUpperCase()===`FIGURES DATA`);return t===-1?e:e.slice(0,t).filter(e=>!/^=+$/.test(e.trim()))}function Ee(e,t){let n=t.recognizeLetteredCouplets?`([a-bA-B])?`:`()?`,r=e.match(RegExp(`^\\s*(\\d{1,4})\\s*${n}\\s*[.)]?\\s+(\\S.*)$`));if(r){let e=parseInt(r[1],10),n=(r[2]||``).toLowerCase(),i=r[3];return t.recognizeLetteredCouplets&&n===`b`?{kind:`second`,coupletNum:e,rest:i}:{kind:`first`,coupletNum:e,rest:i}}if(t.recognizeDashSecondLead){let t=e.match(/^\s*[-–—]\s+(\S.*)$/);if(t)return{kind:`second`,coupletNum:null,rest:t[1]}}return null}function De(e,t,n){let r=e.replace(/\s+$/,``),i=t.trim();return n.dehyphenate&&/[A-Za-zÀ-ÿ]-$/.test(r)?r.slice(0,-1)+i:`${r} ${i}`}function Oe(e,t){let n=e.lastIndexOf(`	`);if(n!==-1)return{text:e.slice(0,n),dest:e.slice(n+1)};let r=Math.max(2,Math.floor(t.minLeaderDots)||2),i=RegExp(`\\.(?:\\s?\\.){${r-1},}`,`g`),a=null,o;for(;(o=i.exec(e))!==null;)a=o;if(a)return{text:e.slice(0,a.index),dest:e.slice(a.index+a[0].length)};if(t.useWhitespaceSeparator){let t=/\s{2,}/g,n=null;for(;(o=t.exec(e))!==null;)n=o;if(n)return{text:e.slice(0,n.index),dest:e.slice(n.index+n[0].length)}}let s=e.match(/^(.*\S)\s+(\d{1,4})\.?\s*$/);return s?{text:s[1],dest:s[2]}:{text:e,dest:``}}function ke(e){let t=e.trim();if(t===``||t===ve||/^[.\s]+$/.test(t))return{linkNum:0,taxa:``};let n=t.match(/^(\d{1,4})\.?$/);return n?{linkNum:parseInt(n[1],10),taxa:``}:{linkNum:0,taxa:t}}function Ae(){return{alt1:``,link1:0,taxa1:``,alt2:``,link2:0,taxa2:``}}function je(e,t,n){if(e)return n.has(e)?{kind:`linked`,targetId:e}:{kind:`unresolved`,couplet:e};let r=t.trim();return r===``?{kind:`empty`}:/^\d+$/.test(r)?{kind:`unresolved`,couplet:parseInt(r,10)}:{kind:`taxon`,name:r}}function Me(e,t={}){let n={...R,...t},r=[],i=[],a=Te((e??``).replace(/\r\n?/g,`
`).split(`
`)),o=[],s=null,c=0,l=0,u=()=>{s&&=(o.push(s),null)};for(let e of a){if(e.trim()===``)continue;let t=Ee(e,n);if(t){if(u(),t.kind===`first`)c=t.coupletNum,s={num:t.coupletNum,isSecond:!1,body:t.rest};else{let n=t.coupletNum??c;if(n===0){r.push(`Ignored a second-alternative line before any numbered step: "${e.trim().slice(0,50)}"`);continue}t.coupletNum!==null&&(c=t.coupletNum),s={num:n,isSecond:!0,body:t.rest}}continue}s&&n.joinWrappedLines?s.body=De(s.body,e,n):s&&l++}if(u(),o.length===0)return i.push(`No key steps were recognized. Each step should start with a number (e.g. "1." or "1a") or a dash for the second alternative.`),{couplets:[],figures:[],warnings:r,errors:i,stepCount:0};l>0&&r.push(`${l} wrapped line(s) were dropped because "Join wrapped lines" is off.`);let d=new Map,f=e=>{let t=d.get(e);return t||(t=Ae(),d.set(e,t)),t},p=0,m=!1;for(let e of o){if(e.num>L){r.push(`Step number ${e.num} exceeds the safety ceiling of ${L} and was skipped.`);continue}p=Math.max(p,e.num);let{text:t,dest:i}=Oe(e.body,n),{linkNum:a,taxa:o}=ke(i);a>L&&(o=String(a),a=0,m=!0),p=Math.max(p,a);let s=f(e.num);e.isSecond?(s.alt2=we(t),s.link2=a,s.taxa2=o):((s.alt1||s.taxa1||s.link1)&&r.push(`Couplet ${e.num} has more than one first alternative; the later one overwrote the earlier.`),s.alt1=we(t),s.link1=a,s.taxa1=o)}if(m&&r.push(`One or more destination numbers were too large to be real step links and were kept as text.`),p=Math.min(p,L),n.fillMissingCouplets){let e=0;for(let t=1;t<=p;t++)d.has(t)||(f(t),e++);e>0&&r.push(`Generated ${e} empty key step(s) to fill gaps so links resolve.`)}let h=[...d.keys()].sort((e,t)=>e-t),g=new Set(h),_=h.map(e=>{let t=d.get(e);return{id:e,alt1:t.alt1,alt2:t.alt2,branch1:je(t.link1,t.taxa1,g),branch2:je(t.link2,t.taxa2,g)}});return{couplets:_,figures:[],warnings:r,errors:i,stepCount:_.length}}var z=`plain-text-import-view`,B=null,V=null;function H(e){return document.getElementById(e)}function Ne(){let e=(e,t)=>{let n=H(e);return n?n.checked:t},t=H(`pt-opt-min-dots`),n=t&&t.value!==``?parseInt(t.value,10):R.minLeaderDots;return{minLeaderDots:Number.isFinite(n)?n:R.minLeaderDots,useWhitespaceSeparator:e(`pt-opt-ws`,R.useWhitespaceSeparator),joinWrappedLines:e(`pt-opt-join`,R.joinWrappedLines),dehyphenate:e(`pt-opt-dehyphen`,R.dehyphenate),recognizeLetteredCouplets:e(`pt-opt-lettered`,R.recognizeLetteredCouplets),recognizeDashSecondLead:e(`pt-opt-dash`,R.recognizeDashSecondLead),fillMissingCouplets:e(`pt-opt-fill`,R.fillMissingCouplets)}}function Pe(){return H(`pt-import-encoding`)?.value||`auto`}function Fe(){let e=H(z);e&&(e.style.display=`flex`,H(`pt-import-source`)?.focus(),W())}function U(){let e=H(z);e&&(e.style.display=`none`)}function Ie(){let e=H(z);return!!e&&e.style.display!==`none`}function W(){let e=H(`pt-import-source`),t=H(`pt-import-preview`),n=H(`pt-import-status`),r=H(`pt-import-confirm`);if(!e||!t)return;let i=e.value;if(i.trim()===``){B=null,t.innerHTML=`<div class="import-preview-empty">Paste or load a key to see a live preview here.</div>`,n&&(n.textContent=``),r&&(r.disabled=!0);return}let a=Me(i,Ne());B=a;let o=a.couplets.length>0&&a.errors.length===0;r&&(r.disabled=!o),n&&(a.errors.length>0?(n.textContent=`⚠️ Could not parse`,n.className=`import-status import-status-error`):(n.textContent=`✓ ${a.stepCount} step(s)`,n.className=`import-status import-status-ok`)),t.innerHTML=Le(a)}function Le(e){let t=``;if(e.errors.length>0)return t+=`<div class="import-messages">`,e.errors.forEach(e=>{t+=`<div class="import-msg import-msg-error">⛔ ${i(e)}</div>`}),t+=`</div>`,t;e.warnings.length>0&&(t+=`<div class="import-messages">`,e.warnings.forEach(e=>{t+=`<div class="import-msg import-msg-warning">⚠️ ${i(e)}</div>`}),t+=`</div>`);let n=te(e.couplets,e.figures),r=0,a=0;if(n.forEach(e=>e.forEach(e=>{e.severity===`error`?r++:a++})),r>0||a>0){let e=[];r>0&&e.push(`${r} error${r===1?``:`s`}`),a>0&&e.push(`${a} warning${a===1?``:`s`}`),t+=`<div class="import-diagnostics-summary">🩺 Key check: ${e.join(`, `)}. Fixable after import in the editor.</div>`}let o=new Map;e.couplets.forEach((e,t)=>o.set(e.id,t+1));let s=e=>{switch(e.kind){case`linked`:{let t=o.get(e.targetId);return t===void 0?`→ ?`:`→ step ${t}`}case`unresolved`:return`→ step ${e.couplet}`;case`taxon`:return i(e.name);case`empty`:return`<span class="import-preview-muted">(empty)</span>`}},c=e=>{let t=n.get(e);return!t||t.length===0?``:`<div class="import-preview-diagnostics warning-block">${t.map(e=>`<div class="${e.severity===`error`?`error-text`:`warning-text`}">${e.severity===`error`?`⛔`:`⚠️`} ${i(e.message)}</div>`).join(``)}</div>`};return t+=`<ol class="import-preview-list">`,e.couplets.forEach((e,r)=>{let a=n.has(e.id);t+=`
            <li class="import-preview-step${a?` has-issues`:``}">
                <div class="import-preview-num">${r+1}.</div>
                <div class="import-preview-rows">
                    <div class="import-preview-row">
                        <span class="import-preview-text">${i(e.alt1)||`<span class="import-preview-muted">(blank)</span>`}</span>
                        <span class="import-preview-dest">${s(e.branch1)}</span>
                    </div>
                    <div class="import-preview-row">
                        <span class="import-preview-text">${i(e.alt2)||`<span class="import-preview-muted">(blank)</span>`}</span>
                        <span class="import-preview-dest">${s(e.branch2)}</span>
                    </div>
                    ${c(e.id)}
                </div>
            </li>`}),t+=`</ol>`,t}async function Re(e,t,n){if(!B||B.couplets.length===0||B.errors.length>0){I(`⚠️ There is nothing valid to import yet.`,`error`);return}let r=H(`pt-import-title`)?.value.trim()||`Imported Key`;if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`))return;let i=e.getPersistedTitle();try{if((await E.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A local project named "${r}" already exists. Overwrite it with this import?`))return;let i={type:A,version:j,title:r,data:{title:r,key:B.couplets,figures:B.figures}},a=e.importJsonData(i);if(!a.success){alert(`Failed to import parsed key:\n• ${a.errors.join(`
• `)}`);return}e.setProjectName(r),t.setActiveProjectTitle(r),await e.saveToStorage(),I(`📥 Imported "${r}" from plain text (${B.stepCount} step(s)).`,`success`),U(),n()}catch(n){console.error(`Plain text import failed:`,n),i&&(e.setProjectName(i),t.setActiveProjectTitle(i)),E.clearStagedChanges(),I(`⚠️ The plain text import could not be completed.`,`error`)}}function ze(e,t,n,r){let i=H(`pt-import-source`),a=H(`pt-import-file-hidden`);i?.addEventListener(`input`,()=>{V=null,W()},{signal:r}),[`pt-opt-min-dots`,`pt-opt-ws`,`pt-opt-join`,`pt-opt-dehyphen`,`pt-opt-lettered`,`pt-opt-dash`,`pt-opt-fill`].forEach(e=>{let t=H(e);t?.addEventListener(`change`,()=>W(),{signal:r}),t?.addEventListener(`input`,()=>W(),{signal:r})}),H(`pt-import-load-file`)?.addEventListener(`click`,()=>{a?.click()},{signal:r}),a?.addEventListener(`change`,async e=>{let t=e.target.files?.[0];if(t)try{let e=await t.arrayBuffer();V=e;let{text:n,encoding:r,autoDetected:a}=Ce(e,Pe());i&&(i.value=n,W()),a&&I(`📥 Loaded "${t.name}" — detected ${be(r)} encoding.`,`success`);let o=H(`pt-import-title`);o&&!o.value.trim()&&(o.value=t.name.replace(/\.txt$/i,``).trim())}catch(e){console.error(`Failed to read plain text file:`,e),I(`⚠️ Could not read the selected file.`,`error`)}finally{e.target.value=``}},{signal:r}),H(`pt-import-encoding`)?.addEventListener(`change`,()=>{if(!V)return;let{text:e}=Ce(V,Pe());i&&(i.value=e,W())},{signal:r}),H(`pt-import-clear`)?.addEventListener(`click`,()=>{i&&(i.value=``),V=null,W(),i?.focus()},{signal:r}),H(`pt-import-close`)?.addEventListener(`click`,()=>U(),{signal:r}),H(`pt-import-cancel`)?.addEventListener(`click`,()=>U(),{signal:r}),H(`pt-import-confirm`)?.addEventListener(`click`,()=>{Re(e,t,n)},{signal:r}),H(z)?.addEventListener(`keydown`,e=>{e.key===`Escape`&&Ie()&&(e.stopPropagation(),U())},{signal:r})}var G=!1;function K(e){G||(G=!0,requestAnimationFrame(()=>{G=!1,e()}))}async function q(e){let t=e.getProjectName();ue(await E.getProjectList(),t)}var J=null;function Be(e,t,n){let r=document.getElementById(`key-title-input`);r&&r.addEventListener(`blur`,()=>{e.endTypingSession();let n=r.value.trim();if(!n){r.value=e.getProjectName();return}e.setTitle(n),K(t)},{signal:n})}function Ve(e,t,n,r){e.addEventListener(`click`,e=>{let r=e.target;if(r.id===`editor-container`){t.clearSelection(),K(n);return}if(r.closest(`input, textarea`))return;let i=r.closest(`.key-card`);if(!i)return;let a=Number(i.getAttribute(`data-id`)),o=e.ctrlKey||e.metaKey||e.shiftKey;t.toggleSelection(a,o),K(n)},{signal:r})}function He(e,t,n,r,i){e.addEventListener(`input`,e=>{let i=e.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.key-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=i.getAttribute(`data-field`),c=`${o}-${s}`;t.setActiveCouplet(o),n.typing.couplets.start(c,()=>{t.endTypingSession()});let l={},d=i.value;if(s===`dest1`||s===`dest2`){let e=s===`dest1`?`branch1`:`branch2`;l[e]=_(d,t.getKey())}else l[s]=d;t.updateCouplet(o,l),n.typing.couplets.extendTimeout(800,()=>{if(s!==`dest1`&&s!==`dest2`){let e=t.getKey().find(e=>e.id===o);if(e){let n=e[s],r=t.encodeFigureTokens(n);r!==n&&t.updateCouplet(o,{[s]:r})}}if(s===`dest1`||s===`dest2`){let e=t.getKey(),n=e.find(e=>e.id===o);if(n){let t=f(s===`dest1`?n.branch1:n.branch2,u(e));i.classList.toggle(`input-error`,t.isUnresolved)}}K(r)})},{signal:i})}function Ue(e,t,n,r,i){e.addEventListener(`focusin`,e=>{let n=e.target;if(n.matches(`input, textarea`)){let e=n.closest(`.key-card`);if(!e)return;e.draggable=!1;let i=Number(e.getAttribute(`data-id`));t.setActiveCouplet(i),i!==J&&(J=i,K(r)),n.classList.contains(`input-destination`)&&n instanceof HTMLInputElement&&queueMicrotask(()=>{document.activeElement===n&&n.select()})}},{signal:i}),e.addEventListener(`focusout`,e=>{let i=e.target;if(i.matches(`input, textarea`)){let a=i.closest(`.key-card`);a&&(a.draggable=!0);let o=a?Number(a.getAttribute(`data-id`)):null,s=i.getAttribute(`data-field`),c=o&&s?`${o}-${s}`:null;n.typing.couplets.end(c,()=>{if(t.clearActiveCouplet(),s&&s!==`dest1`&&s!==`dest2`&&o!==null){let e=t.getKey().find(e=>e.id===o);if(e){let n=e[s],r=t.encodeFigureTokens(n);r!==n&&t.updateCouplet(o,{[s]:r})}}if(i.classList.contains(`input-error`)&&(i instanceof HTMLInputElement||i instanceof HTMLTextAreaElement)&&a){let e=i.value;I(`⚠️ Destination "${e}" is unresolved. Saved as text context.`,`error`)}let n=e.relatedTarget,c=n instanceof Element&&n.closest(`.key-card`),l=c||n instanceof Element&&(n.closest(`.app-menu-bar`)||n.closest(`#add-couplet-btn`));c||(J=null),l||K(r)})}},{signal:i})}function We(e,t,n,r){let i=null,a=null,o=null,s=0,c=()=>{i&&(i.classList.remove(`drag-drop-above`,`drag-drop-below`),i=null,a=null,o=null)},l=(t,n)=>{let r=n.closest(`.key-card`);if(!r){c();return}let l=e.scrollTop;(i!==r||!o||s!==l)&&(o=r.getBoundingClientRect(),s=l);let u=t-o.top<o.height/2?`drag-drop-above`:`drag-drop-below`;if(i!==r||a!==u){let e=o;c(),r.classList.add(u),i=r,a=u,o=e}};e.addEventListener(`dragstart`,e=>{let n=e.target.closest(`.key-card`);if(!n)return;let r=Number(n.getAttribute(`data-id`));t.startDraggingCouplet(r),requestAnimationFrame(()=>{n.style.opacity=`0.4`})},{signal:r}),e.addEventListener(`dragend`,e=>{let n=e.target.closest(`.key-card`);n&&(n.style.opacity=`1`,t.stopDraggingCouplet(),c())},{signal:r}),e.addEventListener(`dragover`,n=>{if(t.draggedCoupletId===null)return;n.preventDefault();let r=e.getBoundingClientRect();n.clientY-r.top<80?e.scrollBy(0,-15):r.bottom-n.clientY<80&&e.scrollBy(0,15),l(n.clientY,n.target)},{signal:r}),e.addEventListener(`dragleave`,t=>{let n=t.relatedTarget;(!n||!e.contains(n))&&c()},{signal:r}),e.addEventListener(`drop`,e=>{e.preventDefault();let r=e.target.closest(`.key-card`);if(!r)return;let i=Number(r.getAttribute(`data-id`));if(t.draggedCoupletId===null||t.draggedCoupletId===i)return;let a=r.classList.contains(`drag-drop-above`)?`above`:`below`;t.reorderCouplets(t.draggedCoupletId,i,a),K(n)},{signal:r})}function Ge(e,t){let n=e.addCouplet();t();let r=document.querySelector(`.key-card[data-id="${n}"]`)?.querySelector(`textarea[data-field="alt1"]`);r&&r.focus()}function Y(e,t,n){let r,i=e.getSelectedCoupletIds(),a=e.getKey(),o=a.filter(e=>i.has(e.id));o.length>0?r=n===`below`?o[o.length-1].id:o[0].id:a.length>0&&(r=n===`above`?a[0].id:a[a.length-1].id),e.pasteCouplets(r,n)&&(I(`Pasted steps ${o.length>0?`${n} selection`:n===`above`?`at the beginning`:`at the end`}.`,`success`),K(t))}var Ke=`[fig: ]`,qe=6,X=null;function Je(e){return e instanceof HTMLTextAreaElement&&(e.dataset.field===`alt1`||e.dataset.field===`alt2`)&&e.closest(`.key-card`)!==null}function Ye(){let e=document.activeElement;return Je(e)?{el:e,start:e.selectionStart??0,end:e.selectionEnd??0}:X&&document.body.contains(X.el)?X:null}function Xe(e,t,n){let r=e.value,i=Math.min(Math.max(t,0),r.length),a=Math.min(Math.max(n,i),r.length);e.value=r.slice(0,i)+Ke+r.slice(a);let o=i+qe;e.focus(),e.setSelectionRange(o,o),e.dispatchEvent(new Event(`input`,{bubbles:!0}))}function Ze(e,t,n,r){let i=document.getElementById(`add-figure-btn`);i&&i.addEventListener(`click`,()=>{e.addFigure(``,``),K(n)},{signal:r});let a=document.getElementById(`figure-container`);a&&(a.addEventListener(`input`,r=>{let i=r.target;if(!i.classList.contains(`input-sync`))return;let a=i.closest(`.figure-card`);if(!a)return;let o=Number(a.getAttribute(`data-id`)),s=i.getAttribute(`data-field`),c=`fig-${o}-${s}`;t.typing.figures.start(c,()=>{e.endTypingSession()});let l={[s]:i.value};e.updateFigure(o,l),t.typing.figures.extendTimeout(800,()=>{K(n)})},{signal:r}),a.addEventListener(`click`,t=>{let r=t.target;if(r.classList.contains(`btn-trigger-upload`)){(r.closest(`.figure-card`)?.querySelector(`.hidden-file-picker`))?.click();return}if(r.classList.contains(`btn-remove-image`)){let t=r.closest(`.figure-card`);if(!t)return;let i=Number(t.getAttribute(`data-id`));e.updateFigure(i,{filename:``}),E.deleteFigureBinary(i);let a=D.get(i);a&&URL.revokeObjectURL(a),D.delete(i),K(n);return}if(r===a){e.clearFigureSelection(),K(n);return}let i=r.closest(`.figure-card`);if(!i)return;let o=Number(i.getAttribute(`data-id`)),s=t.ctrlKey||t.metaKey||t.shiftKey;if(r.closest(`input, textarea`)){i.classList.contains(`is-selected`)||(e.toggleFigureSelection(o,s),K(n));return}e.toggleFigureSelection(o,s),K(n)},{signal:r}),a.addEventListener(`focusout`,e=>{let r=e.target;if(r.matches(`input, textarea`)){let i=r.closest(`.figure-card`);if(!i)return;let a=Number(i.getAttribute(`data-id`)),o=r.getAttribute(`data-field`),s=a&&o?`fig-${a}-${o}`:null;t.typing.figures.end(s,()=>{let t=e.relatedTarget;t instanceof Element&&(t.closest(`.figure-card`)||t.closest(`.key-card`)||t.closest(`.app-menu-bar`)||t.closest(`#add-figure-btn`))||K(n)})}},{signal:r}),a.addEventListener(`change`,async t=>{let r=t.target;if(r.classList.contains(`hidden-file-picker`)){let t=r.files?.[0];if(!t)return;if(!t.type.startsWith(`image/`)){I(`⚠️ Only image files are supported.`,`error`),r.value=``;return}let i=r.closest(`.figure-card`),a=Number(i?.getAttribute(`data-id`));if(isNaN(a))return;e.updateFigure(a,{filename:t.name}),E.uploadFigureBinary(a,t);let o=D.get(a);o&&URL.revokeObjectURL(o);let s=URL.createObjectURL(t);D.set(a,s),r.value=``,K(n)}},{signal:r}),Qe(a,e,n,r))}function Qe(e,t,n,r){let i=null,a=null,o=null,s=null,c=0,l=()=>{a&&(a.classList.remove(`drag-drop-above`,`drag-drop-below`),a=null,o=null,s=null)},u=(t,n)=>{let r=n.closest(`.figure-card`);if(!r){l();return}let i=e.scrollTop;(a!==r||!s||c!==i)&&(s=r.getBoundingClientRect(),c=i);let u=t-s.top<s.height/2?`drag-drop-above`:`drag-drop-below`;if(a!==r||o!==u){let e=s;l(),r.classList.add(u),a=r,o=u,s=e}};e.addEventListener(`dragstart`,e=>{let t=e.target.closest(`.figure-card`);t&&(i=Number(t.getAttribute(`data-id`)),requestAnimationFrame(()=>{t.style.opacity=`0.4`}))},{signal:r}),e.addEventListener(`dragend`,e=>{let t=e.target.closest(`.figure-card`);t&&(t.style.opacity=`1`),i=null,l()},{signal:r}),e.addEventListener(`dragover`,t=>{if(i===null)return;t.preventDefault();let n=e.getBoundingClientRect();t.clientY-n.top<80?e.scrollBy(0,-15):n.bottom-t.clientY<80&&e.scrollBy(0,15),u(t.clientY,t.target)},{signal:r}),e.addEventListener(`dragleave`,t=>{let n=t.relatedTarget;(!n||!e.contains(n))&&l()},{signal:r}),e.addEventListener(`drop`,e=>{e.preventDefault();let r=e.target.closest(`.figure-card`);if(!r||i===null)return;let a=Number(r.getAttribute(`data-id`));if(i===a)return;let o=r.classList.contains(`drag-drop-above`)?`above`:`below`,s=t.getFigures(),c=s.findIndex(e=>e.id===i),l=s.findIndex(e=>e.id===a);c===-1||l===-1||(l=o===`below`?c<l?l:l+1:c<l?l-1:l,c!==l&&(t.reorderFigures(c,l),K(n)))},{signal:r})}function $e(e,t){let n=e=>{if(Je(e.target)){let t=e.target;X={el:t,start:t.selectionStart??0,end:t.selectionEnd??0}}};[`focusout`,`keyup`,`mouseup`,`input`,`select`].forEach(r=>e.addEventListener(r,n,{signal:t})),document.querySelector(`#cmd-insert-figref`)?.addEventListener(`click`,()=>{let e=Ye();if(!e){I(`Click into a key step description first, then insert a figure reference.`,`error`);return}Xe(e.el,e.start,e.end)},{signal:t})}function et(e,t,n,r){let i=document.getElementById(`modal-shortcuts`),a=document.getElementById(`modal-options`),o=document.getElementById(`modal-about`),s=document.getElementById(`modal-open-project`),c=document.getElementById(`opt-lead-format`),l=document.getElementById(`opt-backref`),u=()=>{c?.querySelectorAll(`input[name="lead-format"]`).forEach(e=>{e.checked=e.value===t.leadFormat}),l&&(l.checked=t.showBackReference)};c?.addEventListener(`change`,e=>{let r=e.target;r.name!==`lead-format`||!m(r.value)||(t.setLeadFormat(r.value),K(n))},{signal:r}),l?.addEventListener(`change`,()=>{t.setShowBackReference(l.checked),K(n)},{signal:r});let d=e=>{e.style.display=`flex`,e.querySelector(`button, input:not([disabled]), [tabindex]:not([tabindex="-1"])`)?.focus()};document.getElementById(`cmd-open-shortcuts`)?.addEventListener(`click`,()=>{d(i)},{signal:r}),document.getElementById(`cmd-open-options`)?.addEventListener(`click`,()=>{u(),d(a)},{signal:r}),document.getElementById(`cmd-open-about`)?.addEventListener(`click`,()=>{d(o)},{signal:r}),document.getElementById(`cmd-open-dialog`)?.addEventListener(`click`,async()=>{d(s),await q(e)},{signal:r}),document.getElementById(`modal-shortcuts-close`)?.addEventListener(`click`,()=>{i.style.display=`none`},{signal:r}),document.getElementById(`modal-options-close`)?.addEventListener(`click`,()=>{a.style.display=`none`},{signal:r}),document.getElementById(`modal-about-close`)?.addEventListener(`click`,()=>{o.style.display=`none`},{signal:r}),document.getElementById(`modal-project-close`)?.addEventListener(`click`,()=>{s.style.display=`none`},{signal:r}),document.getElementById(`project-hub-list`)?.addEventListener(`click`,async t=>{let r=t.target,i=r.closest(`.hub-item-clickable-zone`),a=r.closest(`.btn-hub-delete`);if(i){let t=i.getAttribute(`data-name`);if(!t||e.hasUnsavedChanges()&&!confirm(`Your current key has unsaved tracking changes. Are you sure you want to discard them to switch workspaces?`))return;try{await e.loadProject(t),s.style.display=`none`,I(`📂 Swapped to workspace: "${t}"`,`success`),K(n)}catch(e){console.error(`Failed to load workspace safely:`,e),I(`⚠️ Could not open selected project database entries.`,`error`)}return}if(a){t.stopPropagation();let r=a.getAttribute(`data-name`);if(!r)return;let i=`Are you sure you want to permanently delete the workspace "${r}"?\nThis wipes it from your browser database.`;if(confirm(i))try{if(await E.deleteProject(r),I(`🗑️ Workspace "${r}" deleted.`,`success`),e.getProjectName()===r){let t=await E.getProjectList();t.length>0?await e.loadProject(t[0].name):await e.createNewProject(`Untitled Key`)}await q(e),K(n)}catch(e){console.error(`Failed to execute database deletion sequence:`,e),I(`⚠️ Failed to delete workspace from database.`,`error`)}}},{signal:r}),document.getElementById(`btn-hub-import`)?.addEventListener(`click`,()=>{document.querySelector(`#file-import-hidden`)?.click()},{signal:r})}function tt(e){let t=i(e.printText);return e.printClass===`print-dest-taxon`?`<strong class="print-dest-taxon">${t}</strong>`:e.printClass===`print-dest-strong`?`<strong class="print-dest-strong">${t}</strong>`:e.printClass===`error-text`?`<span class="error-text">${t}</span>`:`<span>${t}</span>`}async function nt(e,t,n){try{let r=e.getActiveProjectUid(),o=e.getKey(),s=e.getFigures(),c=e.getTitle(),l=u(o),p=d(s),m=n?h(o):null,_=(await Promise.all(s.map(async(e,t)=>{let n=t+1,a=``;try{let t=await E.getFigureBinary(r,e.id);t&&(a=`<img class="print-fig-img" src="${await O(t)}" alt="Figure ${n}" />`)}catch(t){console.warn(`Could not resolve binary payload stream for figure ID ${e.id}:`,t)}let o=i(e.caption||e.filename||`Untitled Asset`);return`
                    <div class="print-fig-card">
                        ${a}
                        <div class="print-fig-caption">
                            <strong>Fig. ${n}:</strong> ${o}
                        </div>
                    </div>
                `}))).join(``),y=``;o.length===0&&(y=`<p class="print-empty-notice">[The identification key is currently empty. Add couplets in the editor to populate this document.]</p>`);for(let n=0;n<o.length;n++){let r=o[n],a=n+1,s=f(r.branch1,l),c=f(r.branch2,l),u=tt(s),d=tt(c),h=e.resolveTextReferences(r.alt1,p)||`___`,_=e.resolveTextReferences(r.alt2,p)||`___`,{lead1:v,lead2:b}=g(t,a,m?.get(r.id));y+=`
            <div class="print-couplet" role="group" aria-label="Couplet ${a}">
                <div class="print-step-num">${i(v)}</div>
                <div class="print-row">
                  <span class="print-text">${i(h)}</span>
                  <span class="print-dest">${u}</span>
                </div>
                <div class="print-dash">${i(b)}</div>
                <div class="print-row">
                  <span class="print-text">${i(_)}</span>
                  <span class="print-dest">${d}</span>
                </div>
            </div>
            `}let b=s.length>0?` layout-has-figures`:``;a(rt(c,y,_,b,t),v(c,`.html`),`text/html;charset=utf-8;`)}catch(e){console.error(`HTML Export layout compilation system failure:`,e),I(`❌ An unexpected error disrupted the HTML file compilation pipeline.`,`error`)}}function rt(e,t,n,r,a){let o=i(e);return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${o}</title>
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
    
    .print-couplet { 
      display: grid; 
      grid-template-columns: auto 1fr; 
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
  </style>
</head>
<body>
  <div class="print-page-layout${r}" data-lead-format="${a}">
    <div class="print-key-column">
      <div class="print-key-container">
        <h1 class="print-doc-title">${o}</h1>
        ${t}
      </div>
    </div>
    <div class="print-figures-column">
      ${n}
    </div>
  </div>
</body>
</html>`}function Z(e){return e?e.replace(/[\r\n]+/g,` `).replace(/\\/g,`___TSKEY_LATEX_BACKSLASH___`).replace(/([&%$#_{}])/g,`\\$1`).replace(/~/g,`\\textasciitilde{}`).replace(/\^/g,`\\textasciicircum{}`).replace(/</g,`\\textless{}`).replace(/>/g,`\\textgreater{}`).replace(/___TSKEY_LATEX_BACKSLASH___/g,`\\textbackslash{}`):``}function it(e,t){return`\\makebox[${t}][l]{\\textbf{${Z(e).replace(/—/g,`\\textemdash{}`)}}}`}function at(e,t,n){try{let r=e.getKey(),i=e.getFigures(),o=e.getTitle(),s=u(r),c=d(i),l=n?h(r):null,p=n?`4.5em`:`2.5em`,m=b(),_=e=>e.replace(m,(e,t)=>{let n=parseInt(t,10),r=c.get(n);return r===void 0?e:` (Fig.~${r})`}),y=``;if(r.length===0)y=`
\\begin{center}
  \\vspace*{2cm}
  \\textit{\\small [The identification key is currently empty. Please add key steps in the editor to populate this document.]}
\\end{center}`;else{let e=``;r.forEach((n,r)=>{let i=r+1,a=e=>e.printClass===`print-dest-taxon`?`\\mbox{\\textbf{\\textit{${Z(e.printText)}}}}`:e.printClass===`print-dest-strong`?`\\mbox{\\textbf{${e.printText}}}`:`\\dots`,o=a(f(n.branch1,s)),c=a(f(n.branch2,s)),u=_(Z(n.alt1)),d=_(Z(n.alt2)),{lead1:m,lead2:h}=g(t,i,l?.get(n.id));e+=`{\\interlinepenalty=10000
`,e+=`\\noindent\\hangindent=${p}\\hangafter=1${it(m,p)}${u}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${o}\\par\\nopagebreak\n`,e+=`\\noindent\\hangindent=${p}\\hangafter=1${it(h,p)}${d}\\nobreak\\dotfill\\allowbreak\\hspace*{0pt}\\dotfill ${c}\\par}\n`,e+=`\\vspace{0.6em}

`}),y=`
{
\\setlength{\\parfillskip}{0pt}
${e}
\\par
}`}let x=[],S=``;i.length>0&&(S+=`\\newpage
\\section*{Figures Appendix}
`,S+=`\\textit{Instructions: Create a folder named \\texttt{figures} in the same directory as this \\texttt{.tex} file, and place the corresponding image files inside it before compiling.}
\\vspace{1.5em}

`,i.forEach((e,t)=>{let n=t+1,r=Z(e.caption||`Figure ${n}`);S+=`\\begin{figure}[htbp]
`,S+=`  \\centering
`;let i=e.filename.trim();i?(S+=`  \\includegraphics[width=0.7\\linewidth]{\\detokenize{figures/${i}}}\n`,(/\s/.test(i)||(i.match(/\./g)?.length??0)>1)&&x.push(i)):S+=`  \\framebox[0.7\\linewidth]{\\vbox{\\vspace{1.5cm}\\centering\\textbf{[Image Placeholder]}\\par\\vspace{0.5em}\\small No filename provided in data store\\vspace{1.5cm}}}
`,S+=`  \\caption{${r}}\n`,S+=`  \\label{fig:${n}}\n`,S+=`\\end{figure}

`})),a(`% =========================================================================
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

\\title{\\textbf{${Z(o)}}}
\\date{\\today}
\\author{}

\\begin{document}

\\maketitle

\\section*{Identification Key}
\\label{sec:key}
${y}
${S}
\\end{document}`,v(o,`.tex`),`application/x-latex;charset=utf-8;`),x.length>0&&I(`⚠️ ${x.length} image filename(s) contain spaces or multiple dots and may fail to compile in LaTeX. Consider renaming: ${x.join(`, `)}`,`error`)}catch(e){console.error(`LaTeX Export system failure:`,e),I(`❌ An unexpected error disrupted the LaTeX document generation pipeline.`,`error`)}}function ot(e,t,n){try{let r=e.getKey(),i=e.getFigures(),o=u(r),s=d(i),c=n?h(r):null,l=``;l+=`${e.getTitle()}\n\n`,r.length===0&&(l+=`[The identification key is currently empty. Add key steps in the editor to populate this document.]

`),r.forEach((n,r)=>{let i=r+1,a=f(n.branch1,o).printText,u=f(n.branch2,o).printText,d=e.resolveTextReferences(n.alt1,s)||`___`,p=e.resolveTextReferences(n.alt2,s)||`___`,{lead1:m,lead2:h}=g(t,i,c?.get(n.id));l+=`${m}\t${d}\t${a}\n`,l+=`${h}\t${p}\t${u}\n\n`}),i.length>0&&(l+=`========================================
`,l+=`FIGURES DATA
`,l+=`========================================

`,i.forEach((e,t)=>{let n=t+1,r=e.filename||`Untitled File`,i=e.caption||`No caption provided.`;l+=`Figure #${n}\n`,l+=`  Filename: ${r}\n`,l+=`  Caption:  ${i}\n\n`})),a(l,v(e.getTitle(),`.txt`),`text/plain;charset=utf-8;`)}catch(e){console.error(`Plain Text Export system failure:`,e),I(`❌ An unexpected error disrupted the plain text document generation pipeline.`,`error`)}}async function st(e){let t=e.getFigures(),n=[],r=e.getActiveProjectUid();for(let e of t){let t=await E.getFigureBinary(r,e.id),i=null;t&&(i=await O(t)),n.push({...e,binaryData:i})}let i={metadata:{application:A,version:j,exportedAt:new Date().toISOString()},title:e.getTitle(),data:{title:e.getTitle(),key:e.getKey(),figures:n}};a(JSON.stringify(i,null,2),v(e.getTitle(),`.tskey`),`application/json`)}function ct(e,t,n,r){let i=document.getElementById(`modal-open-project`);document.querySelector(`#cmd-new`)?.addEventListener(`click`,async()=>{if(e.hasUnsavedChanges()&&!confirm(`You have unsaved workspace changes. Discard and make a brand new project memory space?`))return;let t=prompt(`Enter name/title for the new key:`,`Untitled Key`);if(t===null)return;let r=t.trim()||`Untitled Key`;try{if((await E.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Do you want to wipe it out and start fresh?`))return;await e.createNewProject(r),I(`📄 New workspace "${r}" initiated!`,`success`),K(n)}catch(e){console.error(`Failed to initialize a new project workspace safely: `,e),I(`⚠️ Could not initialize database workspace entries.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save-as`)?.addEventListener(`click`,async()=>{let t=e.getProjectName(),r=prompt(`Save current configuration under a new title:`,t);if(r===null)return;let i=r.trim();if(!i){I(`⚠️ Invalid project title.`,`error`);return}try{if((await E.getProjectList()).some(e=>e.name.toLowerCase()===i.toLowerCase())&&!confirm(`A project named "${i}" already exists. Do you want to overwrite it?`))return;await e.saveAsProject(i),I(`💾 Saved workspace as "${i}"`,`success`),K(n)}catch{I(`⚠️ Save As operation failed.`,`error`)}},{signal:r}),document.querySelector(`#cmd-save`)?.addEventListener(`click`,async()=>{let t=e.getPersistedTitle(),r=e.getProjectName();try{if(t&&t!==r&&(await E.getProjectList()).some(e=>e.name.toLowerCase()===r.toLowerCase())&&!confirm(`A project named "${r}" already exists. Overwrite it?`))return;await e.saveToStorage(),I(t&&t!==r?`💾 Renamed and saved workspace as "${r}"`:`💾 Changes saved successfully!`,`success`),K(n)}catch(n){console.error(`Atomic save/rename failed:`,n),t&&t!==r&&e.setProjectName(t),I(`⚠️ Save failed. Your changes were kept in memory.`,`error`)}},{signal:r}),document.querySelector(`#cmd-export-json`)?.addEventListener(`click`,()=>{st(e)},{signal:r});let a=document.querySelector(`#file-import-hidden`),o=!1;a?.addEventListener(`change`,async t=>{let r=t.target.files?.[0];if(!r)return;if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`),a&&(a.value=``);return}if(e.hasUnsavedChanges()&&!confirm(`You have unsaved changes in the current key. Importing will discard them. Continue?`)){a&&(a.value=``);return}let s=e.getPersistedTitle();try{o=!0;let t=await r.text(),s=JSON.parse(t),c=`Untitled Imported Key`;if(s&&typeof s.title==`string`&&s.title.trim()?c=s.title.trim():r.name&&(c=r.name.replace(/\.tskey$/i,``).trim()),(await E.getProjectList()).some(e=>e.name.toLowerCase()===c.toLowerCase())&&!confirm(`A local project named "${c}" already exists. Do you want to completely overwrite it with this import file?`)){a&&(a.value=``);return}let l=e.importJsonData(s);if(!l.success){alert(`Failed to import JSON schema:\n• ${l.errors.join(`
• `)}`),a&&(a.value=``);return}e.setProjectName(c);let u=[];if(l.importedFigures&&l.importedFigures.length>0){for(let e of l.importedFigures)if(e.binaryData)try{let t=await(await fetch(e.binaryData)).blob();E.uploadFigureBinary(e.id,t);let n=D.get(e.id);n&&URL.revokeObjectURL(n);let r=URL.createObjectURL(t);D.set(e.id,r)}catch(t){console.error(`Failed to parse binary data for figure ${e.id}:`,t),u.push(e.id)}}await e.saveToStorage(),u.length===0?I(`📥 Imported workspace "${c}" successfully!`,`success`):(I(`⚠️ Workspace imported, but ${u.length} image(s) failed.`,`error`),alert(`Workspace "${c}" was loaded, but the following figure IDs encountered binary errors or corruption and could not be recovered:\n\n• Figure ID(s): ${u.join(`, `)}\n\nPlease try re-uploading these specific images in the editor.`)),i&&i.style.display===`flex`&&await q(e),K(n)}catch(t){console.error(`Import processing error:`,t),s&&e.setProjectName(s),E.clearStagedChanges(),alert(`Malformed JSON structure: Unable to parse file stream.`)}finally{o=!1,a&&(a.value=``)}},{signal:r}),document.querySelector(`#cmd-trigger-import`)?.addEventListener(`click`,()=>{if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`);return}a?.click()},{signal:r}),document.querySelector(`#cmd-import-text`)?.addEventListener(`click`,()=>{if(o){I(`⚠️ An import is currently in progress. Please wait.`,`error`);return}Fe()},{signal:r}),document.querySelector(`#cmd-export-text`)?.addEventListener(`click`,()=>ot(e,t.leadFormat,t.showBackReference),{signal:r}),document.querySelector(`#cmd-export-html`)?.addEventListener(`click`,()=>nt(e,t.leadFormat,t.showBackReference),{signal:r}),document.querySelector(`#cmd-export-latex`)?.addEventListener(`click`,()=>at(e,t.leadFormat,t.showBackReference),{signal:r})}function lt(e,t,n,r){document.querySelector(`#cmd-undo`)?.addEventListener(`click`,()=>{t.typing.couplets.clearTimer(),t.typing.figures.clearTimer(),e.undo()&&K(n)},{signal:r}),document.querySelector(`#cmd-redo`)?.addEventListener(`click`,()=>{t.typing.couplets.clearTimer(),t.typing.figures.clearTimer(),e.redo()&&K(n)},{signal:r}),document.querySelector(`#cmd-cut`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&confirm(`Confirm cutting ${t} highlighted step(s) to clipboard?`)&&(e.cutSelectedCouplets(),I(`Cut ${t} step(s) to clipboard.`,`success`),K(n))},{signal:r}),document.querySelector(`#cmd-copy`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size;t>0&&(e.copySelectedCouplets(),I(`Copied ${t} step(s) to clipboard.`,`success`),K(n))},{signal:r}),document.querySelector(`#cmd-paste-above`)?.addEventListener(`click`,()=>{Y(e,n,`above`)},{signal:r}),document.querySelector(`#cmd-paste-below`)?.addEventListener(`click`,()=>{Y(e,n,`below`)},{signal:r}),document.querySelector(`#cmd-delete`)?.addEventListener(`click`,()=>{let t=e.getSelectedCoupletIds().size,r=e.getSelectedFigureIds().size;if(t>0&&confirm(`Confirm removing highlighted key steps?`)&&(e.deleteSelectedCouplets(),I(`Deleted ${t} step(s).`,`success`),K(n)),r>0&&confirm(`Confirm removing highlighted figures?`)){let t=new Set(e.getSelectedFigureIds());e.deleteSelectedFigures(),t.forEach(e=>{E.deleteFigureBinary(e);let t=D.get(e);t&&URL.revokeObjectURL(t),D.delete(e)}),I(`Deleted ${r} figure(s).`,`success`),K(n)}},{signal:r}),document.querySelector(`#cmd-swap`)?.addEventListener(`click`,()=>{e.getSelectedCoupletIds().size>0&&e.swapSelectedCouplets()&&(I(`Swapped choice configurations.`,`success`),K(n))},{signal:r});let i=()=>Ge(e,n);document.querySelector(`#cmd-add`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#add-couplet-btn`)?.addEventListener(`click`,i,{signal:r}),document.querySelector(`#cmd-clear`)?.addEventListener(`click`,()=>{e.clearSelection(),e.clearFigureSelection(),K(n)},{signal:r}),document.querySelector(`#cmd-select-all`)?.addEventListener(`click`,()=>{e.selectAll(),K(n)},{signal:r}),document.querySelector(`#cmd-toggle-figures`)?.addEventListener(`click`,()=>{t.toggleFigures(),K(n)},{signal:r}),document.querySelector(`#cmd-toggle-images`)?.addEventListener(`click`,()=>{t.toggleImages(),K(n)},{signal:r}),document.querySelector(`#cmd-toggle-print`)?.addEventListener(`click`,()=>{t.togglePrint(),K(n)},{signal:r}),document.querySelector(`#cmd-reorder-couplets`)?.addEventListener(`click`,()=>{e.autoOrderCouplets(),I(`Key steps reordered with shorter branches first!`,`success`),K(n)},{signal:r}),document.querySelector(`#cmd-reorder-figures`)?.addEventListener(`click`,()=>{e.autoOrderFigures(),I(`Figures reordered to match key reference order!`,`success`),K(n)},{signal:r})}function ut(e){let t=document.querySelector(`.app-menu-bar`);if(!t)return;let n=()=>Array.from(t.querySelectorAll(`.menu-trigger`)),r=e=>{let t=e.nextElementSibling;return t?Array.from(t.querySelectorAll(`.dropdown-action:not(:disabled)`)):[]},i=()=>{n().forEach(e=>e.setAttribute(`aria-expanded`,`false`))};t.addEventListener(`click`,e=>{let t=e.target.closest(`.menu-trigger`);if(t){e.stopPropagation();let n=t.getAttribute(`aria-expanded`)===`true`;i(),t.setAttribute(`aria-expanded`,n?`false`:`true`)}},{signal:e}),document.addEventListener(`click`,()=>i(),{signal:e}),t.addEventListener(`keydown`,e=>{let t=document.activeElement;if(!t)return;let a=t.classList.contains(`menu-trigger`),o=t.classList.contains(`dropdown-action`);if(!a&&!o)return;let s=n(),c=a?t:t.closest(`.menu-item`)?.querySelector(`.menu-trigger`),l=r(c),u=s.indexOf(c),d=l.indexOf(t);switch(e.key){case`ArrowRight`:{if(e.preventDefault(),s.length===0)return;let t=s[(u+1)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowLeft`:{if(e.preventDefault(),s.length===0)return;let t=s[(u-1+s.length)%s.length],n=c?.getAttribute(`aria-expanded`)===`true`;i(),t.focus(),n&&t.setAttribute(`aria-expanded`,`true`);break}case`ArrowDown`:e.preventDefault(),a&&c?(c.setAttribute(`aria-expanded`,`true`),l.length>0&&l[0].focus()):o&&l.length>0&&l[(d+1)%l.length].focus();break;case`ArrowUp`:e.preventDefault(),o&&l.length>0&&l[(d-1+l.length)%l.length].focus();break;case`Escape`:e.preventDefault(),i(),c?.focus();break;case`Enter`:case` `:if(a&&c){e.preventDefault();let t=c.getAttribute(`aria-expanded`)===`true`;c.setAttribute(`aria-expanded`,t?`false`:`true`),!t&&l.length>0&&setTimeout(()=>l[0].focus(),10)}break}},{signal:e})}function dt(e){e.classList.remove(`nav-flash`),e.offsetWidth,e.classList.add(`nav-flash`);let t=()=>e.classList.remove(`nav-flash`);e.addEventListener(`animationend`,t,{once:!0}),window.setTimeout(t,1200)}function ft(e){let t=document.querySelector(e);return t?(t.scrollIntoView({behavior:`smooth`,block:`center`}),dt(t),!0):!1}function pt(e,t){for(let n of[x(),b()]){let r;for(;(r=n.exec(e))!==null;){let e=r.index,n=r.index+r[0].length;if(t>=e&&t<=n)return{start:e,end:n,value:r[1].trim()}}}return null}var Q=null;function mt(){Q?.()}function ht(e){mt();let t=document.createElement(`div`);t.className=`popover`,t.setAttribute(`role`,`menu`);let n=e.items.map((e,t)=>`<button type="button" class="popover-action ${e.className??``}" data-item-index="${t}">${i(e.label)}</button>`).join(``);t.innerHTML=(e.headerHtml??``)+n,document.body.appendChild(t);let r=t.getBoundingClientRect(),a=Math.max(8,Math.min(e.x,window.innerWidth-r.width-8)),o=Math.max(8,Math.min(e.y,window.innerHeight-r.height-8));t.style.left=`${a}px`,t.style.top=`${o}px`;let s=new AbortController,{signal:c}=s,l=()=>{s.abort(),t.remove(),Q===l&&(Q=null),e.onClose?.()};return Q=l,document.addEventListener(`mousedown`,e=>{t.contains(e.target)||l()},{signal:c}),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&(e.preventDefault(),l())},{signal:c}),window.addEventListener(`scroll`,l,{signal:c,capture:!0}),window.addEventListener(`resize`,l,{signal:c}),e.signal.addEventListener(`abort`,l,{signal:c}),t.addEventListener(`click`,t=>{let n=t.target,r=n.closest(`[data-step-id]`);if(r&&e.onCrumbSelect){let t=Number(r.getAttribute(`data-step-id`));l(),e.onCrumbSelect(t);return}let i=n.closest(`[data-item-index]`);if(i){let t=Number(i.getAttribute(`data-item-index`)),n=e.items[t];l(),n?.onSelect()}},{signal:c}),l}function $(e){return ft(`.key-card[data-id="${e}"]`)}function gt(e,t){let{displayNumToFig:n,filenameToFig:r}=S(t.getFigures()),i=parseInt(e,10);return!isNaN(i)&&String(i)===e?n.get(i)?.id??null:r.get(e.toLowerCase())?.id??null}async function _t(e,t,n,r,a,o){if(!n.isFiguresHidden&&ft(`.figure-card[data-id="${e}"]`))return;let s=t.getFigures(),c=s.findIndex(t=>t.id===e);if(c===-1)return;let l=s[c],u=c+1,d=D.get(e)??null,f=null;if(!d){let n=await E.getFigureBinary(t.getActiveProjectUid(),e);n&&(d=URL.createObjectURL(n),f=d)}ht({x:r,y:a,headerHtml:`<div class="popover-fig-title">Fig. ${u}</div>${d?`<img class="popover-fig-img" src="${d}" alt="${i(l.filename||`Figure ${u}`)}" />`:`<div class="popover-note">No image uploaded for this figure.</div>`}<div class="popover-fig-caption">${i(l.caption||l.filename||`Untitled figure`)}</div>`,items:[],signal:o,onClose:()=>{f&&URL.revokeObjectURL(f)}})}function vt(e,n,r){document.addEventListener(`click`,i=>{if(!(i.ctrlKey||i.metaKey))return;let a=i.target,o=()=>{i.preventDefault(),i.stopPropagation()},s=a.closest(`.badge-link[data-step-id]`);if(s){o(),$(Number(s.getAttribute(`data-step-id`)));return}let c=a.closest(`.fig-ref[data-fig-id]`);if(c){o(),_t(Number(c.getAttribute(`data-fig-id`)),e,n,i.clientX,i.clientY,r);return}let l=t=>t?e.getKey().find(e=>e.id===Number(t.getAttribute(`data-id`))):void 0,u=a.closest(`.input-destination`);if(u){let e=l(u.closest(`.key-card`)),n=e&&(u.dataset.field===`dest1`?e.branch1:e.branch2),r=n?t(n):null;r!==null&&(o(),$(r));return}let d=a.closest(`.print-dest`);if(d){let e=d.closest(`.print-row`),n=l(d.closest(`.print-step-block`)),r=n&&e&&(e.getAttribute(`data-choice`)===`1`?n.branch1:n.branch2),i=r?t(r):null;i!==null&&(o(),$(i));return}if(a instanceof HTMLTextAreaElement&&a.classList.contains(`card-textarea`)){let t=pt(a.value,a.selectionStart??-1);if(t){let a=gt(t.value,e);a!==null&&(o(),_t(a,e,n,i.clientX,i.clientY,r))}}},{signal:r,capture:!0})}function yt(e,t,n){document.addEventListener(`contextmenu`,r=>{let a=r.target;if(a.closest(`input, textarea`))return;let o=a.closest(`.key-card`)||a.closest(`.print-step-block`);if(!o)return;let s=Number(o.getAttribute(`data-id`));if(!Number.isFinite(s))return;r.preventDefault();let c=e.getKey(),l=ee(c,s),f=(u(c).get(s)??0)+1,p;if(!l.reachable)p=`<div class="popover-note">Step ${f} is unreachable from step 1.</div>`;else{let t=d(e.getFigures());p=`<div class="popover-path">${l.steps.map(n=>{let r=`${n.stepNum}${n.choice??``}`;if(n.choice===void 0)return`<div class="popover-path-row is-target"><span class="popover-path-num">${r}</span><span class="popover-path-text">(this step)</span></div>`;let a=c.find(e=>e.id===n.id),o=a?n.choice===`a`?a.alt1:a.alt2:``,s=e.resolveTextReferences(o,t).trim()||`(no description)`;return`<button type="button" class="popover-path-row" data-step-id="${n.id}"><span class="popover-path-num">${i(r)}</span><span class="popover-path-text">${i(s)}</span></button>`}).join(``)}</div>`}let m=[{label:`Go to step ${f}`,onSelect:()=>$(s)}];l.reachable&&l.steps.length>1&&m.push({label:`Select whole path`,onSelect:()=>{e.setSelectionBatch(l.steps.map(e=>e.id)),K(t)}}),ht({x:r.clientX,y:r.clientY,headerHtml:p,items:m,onCrumbSelect:e=>$(e),signal:n})},{signal:n})}function bt(e,t){let n=n=>{let r=document.getElementById(`plain-text-import-view`);if(r&&r.style.display===`flex`)return;let i=document.querySelectorAll(`.modal-overlay`),a=Array.from(i).find(e=>e.style.display===`flex`);if(a){if(n.key===`Escape`){a.style.display=`none`,n.preventDefault();return}if(n.key===`Tab`){n.preventDefault();let e=Array.from(a.querySelectorAll(`button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`)).filter(e=>e.offsetParent!==null);e.length>0&&e[(e.indexOf(document.activeElement)+(n.shiftKey?-1:1)+e.length)%e.length].focus();return}}let s=o?n.metaKey:n.ctrlKey,c=document.activeElement,l=c&&(c.tagName===`INPUT`||c.tagName===`TEXTAREA`||c.hasAttribute(`contenteditable`));if(n.altKey&&!s&&!n.shiftKey&&n.code===`KeyF`&&Je(c)){n.preventDefault(),Xe(c,c.selectionStart??0,c.selectionEnd??0);return}if(s&&n.key.toLowerCase()===`s`){n.preventDefault(),n.shiftKey?document.querySelector(`#cmd-save-as`)?.click():document.querySelector(`#cmd-save`)?.click();return}if(s&&n.key.toLowerCase()===`o`){n.preventDefault(),document.querySelector(`#cmd-open-dialog`)?.click();return}if(s&&n.altKey&&n.key.toLowerCase()===`n`){n.preventDefault(),document.querySelector(`#cmd-new`)?.click();return}if(s&&n.shiftKey&&n.key.toLowerCase()===`f`){n.preventDefault(),document.querySelector(`#cmd-toggle-figures`)?.click();return}if(s&&n.shiftKey&&n.key.toLowerCase()===`p`){n.preventDefault(),document.querySelector(`#cmd-toggle-print`)?.click();return}if(!l){if(n.altKey&&n.key.toLowerCase()===`n`){n.preventDefault(),document.querySelector(`#cmd-add`)?.click();return}if(s&&n.key.toLowerCase()===`a`){n.preventDefault(),document.querySelector(`#cmd-select-all`)?.click();return}if(n.altKey&&n.key.toLowerCase()===`s`){n.preventDefault(),document.querySelector(`#cmd-swap`)?.click();return}if(s&&n.key.toLowerCase()===`z`){n.preventDefault(),n.shiftKey?document.querySelector(`#cmd-redo`)?.click():document.querySelector(`#cmd-undo`)?.click();return}if(s&&n.key.toLowerCase()===`y`){n.preventDefault(),document.querySelector(`#cmd-redo`)?.click();return}if(n.key===`Delete`||n.key===`Backspace`){n.preventDefault(),document.querySelector(`#cmd-delete`)?.click();return}if(n.key===`Escape`){n.preventDefault(),document.querySelector(`#cmd-clear`)?.click();return}let r=(window.getSelection()?.toString()??``).trim()!==``;if(s&&n.key.toLowerCase()===`c`){if(r||e.getSelectedCoupletIds().size===0)return;n.preventDefault(),document.querySelector(`#cmd-copy`)?.click();return}if(s&&n.key.toLowerCase()===`x`){if(r||e.getSelectedCoupletIds().size===0)return;n.preventDefault(),document.querySelector(`#cmd-cut`)?.click();return}if(s&&n.key.toLowerCase()===`v`){if(!e.hasClipboardData())return;n.preventDefault(),Y(e,t,n.shiftKey?`above`:`below`);return}}};return window.addEventListener(`keydown`,n),()=>{window.removeEventListener(`keydown`,n)}}function xt(e,t,n){let r=document.querySelector(`#editor-container`);if(!r)return()=>{};let i=new AbortController,{signal:a}=i;return ze(e,t,n,a),Be(e,n,a),Ve(r,e,n,a),He(r,e,t,n,a),Ue(r,e,t,n,a),We(r,e,n,a),Ze(e,t,n,a),et(e,t,n,a),ct(e,t,n,a),lt(e,t,n,a),$e(r,a),vt(e,t,a),yt(e,n,a),ut(a),()=>{i.abort()}}var St=[{id:101,alt1:`Has feathers [figID: 101]`,alt2:`Lacks feathers`,branch1:{kind:`taxon`,name:`Bird`},branch2:{kind:`linked`,targetId:102}},{id:102,alt1:`Has fur [figID: 102]`,alt2:`Scales or bare skin`,branch1:{kind:`taxon`,name:`Mammal`},branch2:{kind:`linked`,targetId:103}},{id:103,alt1:`Has scales [figID: 103]`,alt2:`Skin is smooth and moist`,branch1:{kind:`taxon`,name:`Reptile2`},branch2:{kind:`taxon`,name:`Amphibian`}}],Ct=[{id:101,filename:`feathers.jpg`,caption:`Bird feathers`},{id:102,filename:`fur.jpg`,caption:`Wolf fur`},{id:103,filename:`Lizard.jpg`,caption:`Lizard scales`}];async function wt(){let e=document.querySelector(`#app`);if(!e)throw Error(`Application bootstrap failed: DOM target element '#app' was not found.`);let t=new oe,n=t.activeProjectTitle,r=new ne([],[]);r.setProjectPersistedListener(e=>t.setActiveProjectTitle(e));let i=!1;if(n&&n!==`Untitled Key`)try{i=await r.loadProject(n)}catch(e){console.error(`Failed to restore active project session "${n}":`,e)}i||(console.log(`🌱 No active database workspace recovered. Hydrating baseline sample template.`),await r.loadFromStorage([...St],[...Ct],`Untitled Key`),t.setActiveProjectTitle(`Untitled Key`));let a=()=>{ce(t),le(r,t),de(r),_e(r,t),pe(r,t,a)},o=[],s=e=>{r.hasUnsavedChanges()&&(e.preventDefault(),e.returnValue=``)};window.addEventListener(`beforeunload`,s),o.push(()=>window.removeEventListener(`beforeunload`,s)),se(e);let c=xt(r,t,a),l=bt(r,a);o.push(c),o.push(l),a()}wt();