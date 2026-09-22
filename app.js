const C = window.REBORN_CONFIG;
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const state = { token: localStorage.getItem(C.SESSION_KEY)||'', me:null, page:'dashboard', data:{} };
const P = p => state.me?.permissions?.includes('*') || state.me?.permissions?.includes(p);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = n => new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(n||0));
const date = v => v ? new Date(v).toLocaleDateString('zh-TW') : '—';
const dt = v => v ? new Date(v).toLocaleString('zh-TW',{hour12:false}) : '—';
const uid = () => Math.random().toString(36).slice(2,9);

async function api(action, payload={}){
  if(!C.API_URL || C.API_URL.includes('PASTE_')) throw new Error('請先在 config.js 填入 Apps Script Web App URL');
  const res = await fetch(C.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:state.token,payload})});
  const out = await res.json();
  if(!out.ok){
    if(out.code==='UNAUTHORIZED'){ localStorage.removeItem(C.SESSION_KEY); state.token=''; state.me=null; showLogin(); }
    throw new Error(out.message||'系統發生錯誤');
  }
  return out.data;
}
function toast(msg,type='ok'){
  const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=msg; $('#toastRoot').appendChild(el); setTimeout(()=>el.remove(),3200);
}
function busy(btn,on=true,label='處理中…'){ if(!btn)return; if(on){btn.dataset.old=btn.textContent;btn.disabled=true;btn.textContent=label}else{btn.disabled=false;btn.textContent=btn.dataset.old||'完成'} }
function showLogin(){ $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); }
function showApp(){ $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); }

const navGroups = [
  ['工作臺',[
    ['dashboard','中央總覽','dashboard.view'],['projects','專案計畫','projects.view'],['proposals','員工提案','proposals.view'],['tasks','任務看板','tasks.view'],['worklogs','工作日誌','worklogs.view'],['announcements','公告中心','announcements.view']
  ]],
  ['人事與行政',[
    ['employees','員工檔案','employees.view'],['leave','請假申請','leave.view'],['expenses','費用申請','expenses.view'],['compensation','薪資／勞務報酬','compensation.view'],['documents','文件中心','documents.view']
  ]],
  ['系統與安全',[
    ['systems','控制台中心','systems.view'],['vault','工作臺機密庫','vault.view'],['accounts','帳號與權限','accounts.view'],['audit','操作紀錄','audit.view']
  ]]
];
function renderNav(){
  $('#nav').innerHTML=navGroups.map(([g,items])=>{
    const visible=items.filter(x=>P(x[2])); if(!visible.length)return '';
    return `<div class="nav-section">${esc(g)}</div>${visible.map(([id,t])=>`<a href="#${id}" data-page="${id}" class="nav-item ${state.page===id?'active':''}"><span class="nav-dot"></span>${esc(t)}</a>`).join('')}`;
  }).join('');
  $$('[data-page]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.page);});
}
function setTitle(title,eyebrow='REBORNNMENT CENTRAL'){ $('#pageTitle').textContent=title; $('#pageEyebrow').textContent=eyebrow; }
async function navigate(page){
  state.page=page; location.hash=page; renderNav(); $('#sidebar').classList.remove('open');
  const routes={dashboard:renderDashboard,projects:renderProjects,proposals:renderProposals,tasks:renderTasks,worklogs:renderWorklogs,announcements:renderAnnouncements,employees:renderEmployees,leave:renderLeave,expenses:renderExpenses,compensation:renderCompensation,documents:renderDocuments,systems:renderSystems,vault:renderVault,accounts:renderAccounts,audit:renderAudit};
  $('#content').innerHTML='<div class="empty">資料載入中…</div>';
  try{ await (routes[page]||renderDashboard)(); }catch(err){ $('#content').innerHTML=`<div class="empty">${esc(err.message)}</div>`; toast(err.message,'err'); }
}

function statusBadge(v){ const s=String(v||'').toUpperCase(); const c=/DONE|APPROVED|ACTIVE|PAID|COMPLETED/.test(s)?'green':/REJECT|SUSPEND|OVERDUE/.test(s)?'red':/REVIEW|IN_PROGRESS|OPEN|PENDING/.test(s)?'yellow':'blue'; return `<span class="badge ${c}"><i class="dot"></i>${esc(v||'—')}</span>`; }
function panel(title,body,action=''){ return `<section class="panel"><div class="panel-head"><h3>${esc(title)}</h3>${action}</div><div class="panel-body">${body}</div></section>`; }
function empty(text='目前沒有資料'){return `<div class="empty">${esc(text)}</div>`}
function modal(title,body,{saveText='儲存',onSave=null,wide=false}={}){
  const id='m'+uid();
  $('#modalRoot').innerHTML=`<div class="modal-backdrop" id="${id}"><div class="modal" style="${wide?'width:min(980px,100%)':''}"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close>×</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button>${onSave?`<button class="btn btn-primary" data-save>${esc(saveText)}</button>`:''}</div></div></div>`;
  const root=$('#'+id); $$('[data-close]',root).forEach(b=>b.onclick=()=>root.remove()); root.onclick=e=>{if(e.target===root)root.remove()};
  if(onSave){ $('[data-save]',root).onclick=async e=>{ try{busy(e.currentTarget,true); await onSave(root); root.remove();}catch(err){toast(err.message,'err');busy(e.currentTarget,false);} }; }
  return root;
}
function formDataObj(root){ const o={}; $$('[name]',root).forEach(el=>{ if(el.type==='checkbox')o[el.name]=el.checked; else o[el.name]=el.value; }); return o; }

async function boot(){
  $('#loginForm').onsubmit=async e=>{e.preventDefault();const b=e.submitter;try{busy(b,true,'登入中…');const d=await api('login',{username:$('#loginUsername').value.trim(),password:$('#loginPassword').value});state.token=d.token;localStorage.setItem(C.SESSION_KEY,state.token);state.me=d.user;initApp();}catch(err){toast(err.message,'err')}finally{busy(b,false)}};
  if(state.token){try{state.me=await api('me');initApp();}catch{showLogin();}}else showLogin();
}
function initApp(){
  showApp(); $('#sideName').textContent=state.me.name||state.me.username; $('#sideRole').textContent=state.me.roleName||state.me.role; $('#sideAvatar').textContent=(state.me.name||'R').slice(0,1);
  $('#logoutBtn').onclick=async()=>{try{await api('logout')}catch{} localStorage.removeItem(C.SESSION_KEY);state.token='';state.me=null;showLogin();};
  $('#openNav').onclick=()=>$('#sidebar').classList.add('open'); $('#closeNav').onclick=()=>$('#sidebar').classList.remove('open');
  $('#quickProposal').classList.toggle('hidden',!P('proposals.create')); $('#quickTask').classList.toggle('hidden',!P('tasks.create')); $('#quickProposal').onclick=()=>openProposalForm(); $('#quickTask').onclick=()=>openTaskForm();
  const start=(location.hash||'#dashboard').slice(1); navigate(start); if(state.me.mustChangePassword) setTimeout(forcePasswordChange,250);
}

async function renderDashboard(){
  setTitle('中央總覽'); const d=await api('dashboard'); state.data.dashboard=d;
  $('#content').innerHTML=`
    <section class="hero"><div><div class="eyebrow">${esc(d.greeting||'WELCOME BACK')}</div><h3>${esc(state.me.name||state.me.username)}，今天也把事情推進。</h3><p>這裡集中顯示專案、提案、任務、人力與費用狀態。</p></div><div class="meta"><span>${esc(state.me.employeeId||'ADMIN')}</span><span>${esc(state.me.roleName||state.me.role)}</span></div></section>
    <div class="stats">
      <div class="stat"><span>進行中專案</span><strong>${d.stats.projects}</strong><small>目前 ACTIVE / IN_PROGRESS</small></div>
      <div class="stat"><span>待審提案</span><strong>${d.stats.proposals}</strong><small>等待主管處理</small></div>
      <div class="stat"><span>我的未完成任務</span><strong>${d.stats.tasks}</strong><small>尚未 DONE</small></div>
      <div class="stat"><span>在職人員</span><strong>${d.stats.employees}</strong><small>ACTIVE 員工</small></div>
    </div>
    <div class="section-grid">
      ${panel('我的近期任務', d.myTasks?.length?`<div class="stack">${d.myTasks.map(t=>`<div class="task-card"><div class="meta"><span class="priority-${String(t.priority||'low').toLowerCase()}">${esc(t.priority||'NORMAL')}</span><span>${esc(t.projectName||'一般工作')}</span></div><h5>${esc(t.title)}</h5><div class="card-foot">${statusBadge(t.status)}<span class="tiny muted">截止 ${date(t.dueDate)}</span></div></div>`).join('')}</div>`:empty('目前沒有待辦任務'))}
      <div class="stack">
        ${panel('待處理',`<div class="kv"><dt>待審提案</dt><dd>${d.pending.proposals}</dd><dt>待審費用</dt><dd>${d.pending.expenses}</dd><dt>待審請假</dt><dd>${d.pending.leave}</dd></div>`)}
        ${panel('最新公告',d.announcements?.length?`<div class="timeline">${d.announcements.map(a=>`<div class="timeline-item"><div class="timeline-rail"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${esc(a.title)}</strong><p>${esc(a.content)}</p><p>${dt(a.createdAt)}</p></div></div>`).join('')}</div>`:empty())}
      </div>
    </div>`;
}

async function renderProjects(){
  setTitle('專案計畫','PROJECT MANAGEMENT'); const items=await api('listProjects'); state.data.projects=items;
  $('#content').innerHTML=`<div class="toolbar"><input class="search" id="projectSearch" placeholder="搜尋專案…"><div class="grow"></div>${P('projects.create')?'<button class="btn btn-primary" id="newProject">＋ 建立專案</button>':''}</div><div style="height:14px"></div><div class="cards" id="projectCards"></div>`;
  const draw=()=>{const q=$('#projectSearch').value.toLowerCase();$('#projectCards').innerHTML=items.filter(x=>(x.name+x.ownerName+x.status).toLowerCase().includes(q)).map(x=>`<div class="card"><div class="meta"><span>${esc(x.projectCode)}</span>${statusBadge(x.status)}</div><h4>${esc(x.name)}</h4><p>${esc(x.description||'尚無專案說明')}</p><div class="progress"><i style="width:${Math.max(0,Math.min(100,Number(x.progress||0)))}%"></i></div><div class="card-foot"><span class="tiny muted">${esc(x.ownerName||'未指定')} · ${date(x.dueDate)}</span><button class="btn btn-ghost btn-sm" data-project="${esc(x.id)}">查看</button></div></div>`).join('')||empty();$$('[data-project]').forEach(b=>b.onclick=()=>openProjectDetail(items.find(x=>x.id===b.dataset.project)));}; draw(); $('#projectSearch').oninput=draw; if($('#newProject'))$('#newProject').onclick=()=>openProjectForm();
}
function openProjectForm(x={}){
  modal(x.id?'編輯專案':'建立專案',`<div class="grid-2"><label class="field"><span>專案名稱</span><input name="name" value="${esc(x.name||'')}" required></label><label class="field"><span>專案代碼</span><input name="projectCode" value="${esc(x.projectCode||'')}" placeholder="WINTER-2026"></label><label class="field"><span>狀態</span><select name="status">${['DRAFT','PLANNING','IN_PROGRESS','REVIEW','COMPLETED','ARCHIVED'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>截止日期</span><input type="date" name="dueDate" value="${esc((x.dueDate||'').slice(0,10))}"></label><label class="field"><span>預算</span><input type="number" name="budget" value="${esc(x.budget||0)}"></label><label class="field"><span>進度 %</span><input type="number" min="0" max="100" name="progress" value="${esc(x.progress||0)}"></label></div><label class="field"><span>專案說明</span><textarea name="description">${esc(x.description||'')}</textarea></label>`,{saveText:'儲存專案',onSave:async r=>{const d=formDataObj(r);d.id=x.id||'';await api('saveProject',d);toast('專案已儲存');navigate('projects')}});
}
async function openProjectDetail(x){
  const d=await api('getProject',{id:x.id});
  const r=modal(x.name,`<div class="meta"><span>${esc(x.projectCode)}</span>${statusBadge(x.status)}</div><p class="muted small">${esc(x.description||'')}</p><div class="divider"></div><dl class="kv"><dt>負責人</dt><dd>${esc(x.ownerName||'—')}</dd><dt>期限</dt><dd>${date(x.dueDate)}</dd><dt>預算</dt><dd>${money(x.budget)}</dd><dt>進度</dt><dd><div class="progress"><i style="width:${Number(x.progress||0)}%"></i></div></dd></dl><div class="divider"></div><h4>里程碑</h4>${d.milestones?.length?`<div class="timeline">${d.milestones.map(m=>`<div class="timeline-item"><div class="timeline-rail"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${esc(m.title)}</strong><p>${date(m.dueDate)} · ${esc(m.status)}</p></div></div>`).join('')}</div>`:empty('尚未建立里程碑')}<div class="divider"></div><h4>專案任務</h4>${d.tasks?.length?d.tasks.map(t=>`<div class="task-card"><h5>${esc(t.title)}</h5><div class="card-foot">${statusBadge(t.status)}<span class="tiny muted">${esc(t.assigneeName||'未指派')}</span></div></div>`).join(''):empty('目前沒有專案任務')}`,{onSave:null,wide:true});
  if(P('projects.edit')){const foot=$('.modal-foot',r);foot.insertAdjacentHTML('beforeend','<button class="btn btn-ghost" data-mile>＋ 里程碑</button><button class="btn btn-primary" data-edit>編輯專案</button>');$('[data-edit]',r).onclick=()=>{r.remove();openProjectForm(x)};$('[data-mile]',r).onclick=()=>{r.remove();modal('新增里程碑',`<label class="field"><span>里程碑名稱</span><input name="title"></label><div class="grid-2"><label class="field"><span>截止日期</span><input type="date" name="dueDate"></label><label class="field"><span>狀態</span><select name="status"><option>OPEN</option><option>IN_PROGRESS</option><option>DONE</option></select></label></div>`,{onSave:async root=>{const d=formDataObj(root);d.projectId=x.id;await api('saveMilestone',d);toast('里程碑已建立');navigate('projects')}})}}
}

async function renderProposals(){
  setTitle('員工提案','IDEA & APPROVAL'); const items=await api('listProposals'); state.data.proposals=items;
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">員工可提出新專案、流程改善、活動企劃或採購需求。</div><div class="grow"></div>${P('proposals.create')?'<button class="btn btn-primary" id="newProposal">＋ 提交提案</button>':''}</div><div style="height:14px"></div>${panel('提案列表',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>編號</th><th>提案</th><th>提案人</th><th>類型</th><th>預估成本</th><th>狀態</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.proposalCode)}</td><td><strong>${esc(x.title)}</strong></td><td>${esc(x.proposerName)}</td><td>${esc(x.category)}</td><td>${money(x.estimatedCost)}</td><td>${statusBadge(x.status)}</td><td><button class="btn btn-ghost btn-sm" data-p="${esc(x.id)}">查看</button></td></tr>`).join('')}</tbody></table></div>`:empty())}`;
  if($('#newProposal'))$('#newProposal').onclick=()=>openProposalForm(); $$('[data-p]').forEach(b=>b.onclick=()=>openProposalDetail(items.find(x=>x.id===b.dataset.p)));
}
function openProposalForm(){
  modal('提交員工提案',`<div class="grid-2"><label class="field"><span>提案標題</span><input name="title"></label><label class="field"><span>類型</span><select name="category"><option>PROJECT</option><option>PROCESS</option><option>EVENT</option><option>PURCHASE</option><option>MARKETING</option><option>OTHER</option></select></label><label class="field"><span>預估成本</span><input name="estimatedCost" type="number" value="0"></label><label class="field"><span>希望完成日</span><input name="targetDate" type="date"></label></div><label class="field"><span>提案內容</span><textarea name="content" placeholder="問題、想法、具體作法與預期效益"></textarea></label><label class="field"><span>預期效益</span><textarea name="benefit"></textarea></label>`,{saveText:'送出審核',onSave:async r=>{await api('saveProposal',formDataObj(r));toast('提案已送出');navigate('proposals')}});
}
function openProposalDetail(x){
  const r=modal(x.title,`<div class="meta"><span>${esc(x.proposalCode)}</span>${statusBadge(x.status)}<span>${esc(x.category)}</span></div><div class="divider"></div><dl class="kv"><dt>提案人</dt><dd>${esc(x.proposerName)}</dd><dt>預估成本</dt><dd>${money(x.estimatedCost)}</dd><dt>目標日期</dt><dd>${date(x.targetDate)}</dd><dt>提案內容</dt><dd>${esc(x.content)}</dd><dt>預期效益</dt><dd>${esc(x.benefit||'—')}</dd><dt>審核備註</dt><dd>${esc(x.reviewNote||'—')}</dd></dl>`,{onSave:null});
  if(P('proposals.review') && x.status==='PENDING'){ const foot=$('.modal-foot',r);foot.insertAdjacentHTML('beforeend','<button class="btn btn-danger" data-reject>退回</button><button class="btn btn-primary" data-approve>核准</button>'); $('[data-approve]',r).onclick=()=>reviewProposal(x,'APPROVED',r); $('[data-reject]',r).onclick=()=>reviewProposal(x,'REJECTED',r); }
}
async function reviewProposal(x,status,root){ const note=prompt('審核備註（可留白）')||''; await api('reviewProposal',{id:x.id,status,reviewNote:note}); root.remove(); toast(`提案已${status==='APPROVED'?'核准':'退回'}`); navigate('proposals'); }

async function renderTasks(){
  setTitle('任務看板','TASK BOARD'); const items=await api('listTasks'); state.data.tasks=items; const cols=['TODO','IN_PROGRESS','REVIEW','DONE'];
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">依專案分派工作，員工可更新進度與提交工作結果。</div><div class="grow"></div>${P('tasks.create')?'<button class="btn btn-primary" id="newTask">＋ 建立任務</button>':''}</div><div style="height:14px"></div><div class="kanban">${cols.map(c=>`<section class="kanban-col"><div class="kanban-head"><span>${c}</span><span class="badge">${items.filter(x=>x.status===c).length}</span></div>${items.filter(x=>x.status===c).map(taskCard).join('')||empty('沒有任務')}</section>`).join('')}</div>`;
  if($('#newTask'))$('#newTask').onclick=()=>openTaskForm(); $$('[data-task-status]').forEach(b=>b.onclick=()=>changeTaskStatus(b.dataset.id,b.dataset.taskStatus));
}
function taskCard(t){ const next={TODO:'IN_PROGRESS',IN_PROGRESS:'REVIEW',REVIEW:'DONE',DONE:'TODO'}[t.status]; return `<div class="task-card"><div class="meta"><span class="priority-${String(t.priority||'low').toLowerCase()}">${esc(t.priority||'NORMAL')}</span><span>${esc(t.projectName||'一般工作')}</span></div><h5>${esc(t.title)}</h5><p>${esc(t.description||'')}</p><div class="card-foot"><span class="tiny muted">${esc(t.assigneeName||'未指派')} · ${date(t.dueDate)}</span>${P('tasks.edit')||t.assigneeId===state.me.employeeId?`<button class="btn btn-ghost btn-sm" data-id="${esc(t.id)}" data-task-status="${next}">→ ${next}</button>`:''}</div></div>`; }
async function changeTaskStatus(id,status){await api('updateTaskStatus',{id,status});toast('任務狀態已更新');navigate('tasks')}
async function openTaskForm(){
  const [projects,employees]=await Promise.all([api('listProjects'),api('listEmployeesLite')]);
  modal('建立任務',`<div class="grid-2"><label class="field"><span>任務名稱</span><input name="title"></label><label class="field"><span>專案</span><select name="projectId"><option value="">一般工作</option>${projects.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>指派給</span><select name="assigneeId"><option value="">未指定</option>${employees.map(x=>`<option value="${esc(x.employeeId)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>優先度</span><select name="priority"><option>LOW</option><option selected>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label><label class="field"><span>截止日期</span><input type="date" name="dueDate"></label><label class="field"><span>預估工時</span><input type="number" name="estimatedHours" value="1" step="0.5"></label></div><label class="field"><span>工作說明</span><textarea name="description"></textarea></label>`,{saveText:'建立任務',onSave:async r=>{await api('saveTask',formDataObj(r));toast('任務已建立');navigate('tasks')}});
}

async function renderWorklogs(){
  setTitle('工作日誌','WORK LOG'); const items=await api('listWorklogs');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">紀錄每日完成事項、工時與阻礙，方便專案回顧。</div><div class="grow"></div>${P('worklogs.create')?'<button class="btn btn-primary" id="newLog">＋ 填寫工作日誌</button>':''}</div><div style="height:14px"></div>${panel('工作紀錄',items.length?`<div class="timeline">${items.map(x=>`<div class="timeline-item"><div class="timeline-rail"><div class="timeline-dot"></div></div><div class="timeline-content"><strong>${esc(x.employeeName)} · ${date(x.workDate)} · ${esc(x.hours)} 小時</strong><p>${esc(x.summary)}</p><p>${esc(x.blockers||'')}</p></div></div>`).join('')}</div>`:empty())}`;
  if($('#newLog'))$('#newLog').onclick=()=>modal('新增工作日誌',`<div class="grid-2"><label class="field"><span>工作日期</span><input name="workDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="field"><span>工時</span><input name="hours" type="number" step="0.5" value="1"></label></div><label class="field"><span>完成事項</span><textarea name="summary"></textarea></label><label class="field"><span>遇到的問題 / 阻礙</span><textarea name="blockers"></textarea></label>`,{onSave:async r=>{await api('saveWorklog',formDataObj(r));toast('工作日誌已儲存');navigate('worklogs')}});
}

async function renderAnnouncements(){
  setTitle('公告中心','ANNOUNCEMENTS'); const items=await api('listAnnouncements');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">內部營運通知、賽事人員集合資訊與制度更新。</div><div class="grow"></div>${P('announcements.create')?'<button class="btn btn-primary" id="newAnn">＋ 發布公告</button>':''}</div><div style="height:14px"></div><div class="cards">${items.map(x=>`<div class="card"><div class="meta"><span>${esc(x.category)}</span><span>${dt(x.createdAt)}</span></div><h4>${esc(x.title)}</h4><p>${esc(x.content)}</p><div class="card-foot"><span class="tiny muted">${esc(x.authorName)}</span>${x.pinned==='TRUE'||x.pinned===true?'<span class="badge yellow">PINNED</span>':''}</div></div>`).join('')||empty()}</div>`;
  if($('#newAnn'))$('#newAnn').onclick=()=>modal('發布公告',`<div class="grid-2"><label class="field"><span>標題</span><input name="title"></label><label class="field"><span>分類</span><select name="category"><option>GENERAL</option><option>EVENT</option><option>HR</option><option>SYSTEM</option></select></label></div><label class="field"><span>公告內容</span><textarea name="content"></textarea></label><label class="field"><span><input type="checkbox" name="pinned"> 置頂公告</span></label>`,{onSave:async r=>{await api('saveAnnouncement',formDataObj(r));toast('公告已發布');navigate('announcements')}});
}

async function renderEmployees(){
  setTitle('員工檔案','HUMAN RESOURCES'); const items=await api('listEmployees'); state.data.employees=items;
  $('#content').innerHTML=`<div class="toolbar"><input id="empSearch" class="search" placeholder="搜尋姓名、部門、職稱…"><div class="grow"></div>${P('employees.create')?'<button class="btn btn-primary" id="newEmp">＋ 新增員工</button>':''}</div><div style="height:14px"></div>${panel('員工名冊',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>員工</th><th>編號</th><th>類型</th><th>部門 / 職稱</th><th>到職</th><th>狀態</th><th></th></tr></thead><tbody id="empRows"></tbody></table></div>`:empty())}`;
  const draw=()=>{if(!$('#empRows'))return;const q=$('#empSearch').value.toLowerCase();$('#empRows').innerHTML=items.filter(x=>(x.name+x.department+x.jobTitle+x.employeeId).toLowerCase().includes(q)).map(x=>`<tr><td><div class="person">${x.photoUrl?`<img class="avatar" src="${esc(x.photoUrl)}">`:`<div class="avatar">${esc(x.name.slice(0,1))}</div>`}<div><strong>${esc(x.name)}</strong><span>${esc(x.phone||'')}</span></div></div></td><td>${esc(x.employeeId)}</td><td>${esc(x.employeeType)}</td><td>${esc(x.department)} / ${esc(x.jobTitle)}</td><td>${date(x.startDate)}</td><td>${statusBadge(x.status)}</td><td><button class="btn btn-ghost btn-sm" data-emp="${esc(x.id)}">檢視</button></td></tr>`).join('');$$('[data-emp]').forEach(b=>b.onclick=()=>openEmployee(items.find(x=>x.id===b.dataset.emp)));};draw();$('#empSearch').oninput=draw;if($('#newEmp'))$('#newEmp').onclick=()=>openEmployeeForm();
}
function employeeFormHtml(x={}){return `<div class="grid-2"><label class="field"><span>姓名</span><input name="name" value="${esc(x.name||'')}"></label><label class="field"><span>出生日期</span><input type="date" name="birthDate" value="${esc((x.birthDate||'').slice(0,10))}"></label><label class="field"><span>電話</span><input name="phone" value="${esc(x.phone||'')}"></label><label class="field"><span>Email</span><input name="email" value="${esc(x.email||'')}"></label><label class="field"><span>員工類型</span><select name="employeeType">${['FULL_TIME','EVENT_PART_TIME','CONTRACTOR'].map(v=>`<option ${x.employeeType===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>部門</span><select name="department">${['ADMIN','EVENT','BROADCAST','DESIGN','MARKETING','HR','FINANCE','TECH'].map(v=>`<option ${x.department===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>職稱</span><input name="jobTitle" value="${esc(x.jobTitle||'')}"></label><label class="field"><span>到職日</span><input type="date" name="startDate" value="${esc((x.startDate||'').slice(0,10))}"></label><label class="field"><span>合作結束日</span><input type="date" name="endDate" value="${esc((x.endDate||'').slice(0,10))}"></label><label class="field"><span>報酬方式</span><select name="payType">${['MONTHLY','DAILY','PER_EVENT','ONE_TIME','HOURLY'].map(v=>`<option ${x.payType===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>基本報酬</span><input type="number" name="payRate" value="${esc(x.payRate||0)}"></label><label class="field"><span>狀態</span><select name="status">${['ACTIVE','PAUSED','LEFT'].map(v=>`<option ${x.status===v?'selected':''}>${v}</option>`).join('')}</select></label></div><label class="field"><span>備註</span><textarea name="note">${esc(x.note||'')}</textarea></label><label class="field"><span>員工照片</span><input type="file" accept="image/*" name="photo"></label>`}
function openEmployeeForm(x={}){ modal(x.id?'編輯員工':'新增員工',employeeFormHtml(x),{saveText:'儲存員工',onSave:async r=>{const d=formDataObj(r);d.id=x.id||'';const f=$('input[name=photo]',r).files[0];if(f){d.photo=await fileToPayload(f)}await api('saveEmployee',d);toast('員工資料已儲存');navigate('employees')},wide:true}); }
async function fileToPayload(f){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:f.name,type:f.type,base64:r.result.split(',')[1]});r.onerror=reject;r.readAsDataURL(f)})}
function openEmployee(x){
  const r=modal(`${x.name} · ${x.employeeId}`,`<div class="person">${x.photoUrl?`<img class="photo-preview" src="${esc(x.photoUrl)}">`:`<div class="photo-preview avatar">${esc(x.name.slice(0,1))}</div>`}<div><h3 style="margin:0">${esc(x.name)}</h3><div class="meta"><span>${esc(x.department)}</span><span>${esc(x.jobTitle)}</span>${statusBadge(x.status)}</div></div></div><div class="divider"></div><dl class="kv"><dt>電話</dt><dd>${esc(x.phone||'—')}</dd><dt>Email</dt><dd>${esc(x.email||'—')}</dd><dt>人員類型</dt><dd>${esc(x.employeeType)}</dd><dt>到職日期</dt><dd>${date(x.startDate)}</dd><dt>報酬方式</dt><dd>${esc(x.payType)} · ${money(x.payRate)}</dd><dt>備註</dt><dd>${esc(x.note||'—')}</dd></dl>`,{onSave:null});
  const foot=$('.modal-foot',r);if(P('employees.edit'))foot.insertAdjacentHTML('beforeend','<button class="btn btn-ghost" data-edit>編輯</button>');if(P('documents.create'))foot.insertAdjacentHTML('beforeend','<button class="btn btn-primary" data-pdf>產生員工 PDF</button>');if($('[data-edit]',r))$('[data-edit]',r).onclick=()=>{r.remove();openEmployeeForm(x)};if($('[data-pdf]',r))$('[data-pdf]',r).onclick=async()=>{const d=await api('generateEmployeePdf',{id:x.id});toast('PDF 已建立');window.open(d.url,'_blank')};
}

async function renderLeave(){
  setTitle('請假申請','LEAVE REQUESTS'); const items=await api('listLeave');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">正職、工讀皆可送出請假／無法排班申請。</div><div class="grow"></div>${P('leave.create')?'<button class="btn btn-primary" id="newLeave">＋ 申請</button>':''}</div><div style="height:14px"></div>${panel('申請紀錄',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>員工</th><th>類型</th><th>期間</th><th>原因</th><th>狀態</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.employeeName)}</td><td>${esc(x.leaveType)}</td><td>${date(x.startDate)} → ${date(x.endDate)}</td><td>${esc(x.reason)}</td><td>${statusBadge(x.status)}</td><td>${P('leave.review')&&x.status==='PENDING'?`<button class="btn btn-ghost btn-sm" data-leave="${esc(x.id)}">審核</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty())}`;
  if($('#newLeave'))$('#newLeave').onclick=()=>modal('請假 / 無法排班申請',`<div class="grid-2"><label class="field"><span>類型</span><select name="leaveType"><option>PERSONAL</option><option>SICK</option><option>EVENT_UNAVAILABLE</option><option>OTHER</option></select></label><label class="field"><span>開始日</span><input name="startDate" type="date"></label><label class="field"><span>結束日</span><input name="endDate" type="date"></label></div><label class="field"><span>原因</span><textarea name="reason"></textarea></label>`,{onSave:async r=>{await api('saveLeave',formDataObj(r));toast('申請已送出');navigate('leave')}});$$('[data-leave]').forEach(b=>b.onclick=()=>reviewSimple('reviewLeave',b.dataset.leave,'請假',()=>navigate('leave')));
}
async function reviewSimple(action,id,label,done){ const ok=confirm(`確定核准此${label}申請？\n按「取消」將改為退回。`); const note=prompt('審核備註（可留白）')||''; await api(action,{id,status:ok?'APPROVED':'REJECTED',reviewNote:note});toast('審核已完成');done(); }

async function renderExpenses(){
  setTitle('費用申請','EXPENSE REQUESTS'); const items=await api('listExpenses');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">採購、交通、賽事支出與代墊報銷都在這裡送審。</div><div class="grow"></div>${P('expenses.create')?'<button class="btn btn-primary" id="newExpense">＋ 費用申請</button>':''}</div><div style="height:14px"></div>${panel('費用紀錄',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>申請人</th><th>用途</th><th>分類</th><th>金額</th><th>專案</th><th>狀態</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.employeeName)}</td><td>${esc(x.title)}</td><td>${esc(x.category)}</td><td>${money(x.amount)}</td><td>${esc(x.projectName||'—')}</td><td>${statusBadge(x.status)}</td><td>${P('expenses.review')&&x.status==='PENDING'?`<button class="btn btn-ghost btn-sm" data-exp="${esc(x.id)}">審核</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:empty())}`;
  if($('#newExpense'))$('#newExpense').onclick=async()=>{const p=await api('listProjects');modal('費用申請',`<div class="grid-2"><label class="field"><span>用途</span><input name="title"></label><label class="field"><span>分類</span><select name="category"><option>EVENT</option><option>TRANSPORT</option><option>EQUIPMENT</option><option>DESIGN</option><option>MARKETING</option><option>OTHER</option></select></label><label class="field"><span>金額</span><input name="amount" type="number"></label><label class="field"><span>專案</span><select name="projectId"><option value="">非專案</option>${p.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label></div><label class="field"><span>說明</span><textarea name="description"></textarea></label>`,{onSave:async r=>{await api('saveExpense',formDataObj(r));toast('費用申請已送出');navigate('expenses')}})};$$('[data-exp]').forEach(b=>b.onclick=()=>reviewSimple('reviewExpense',b.dataset.exp,'費用',()=>navigate('expenses')));
}

async function renderCompensation(){
  setTitle('薪資／勞務報酬','COMPENSATION'); const items=await api('listCompensation'); const total=items.filter(x=>x.status!=='CANCELLED').reduce((s,x)=>s+Number(x.amount||0),0);
  $('#content').innerHTML=`<div class="stats"><div class="stat"><span>目前紀錄總額</span><strong>${money(total)}</strong></div><div class="stat"><span>待付款</span><strong>${items.filter(x=>x.status==='PENDING').length}</strong></div><div class="stat"><span>已付款</span><strong>${items.filter(x=>x.status==='PAID').length}</strong></div><div class="stat"><span>筆數</span><strong>${items.length}</strong></div></div><div class="toolbar"><div></div><div class="grow"></div>${P('compensation.create')?'<button class="btn btn-primary" id="newPay">＋ 新增報酬</button>':''}</div><div style="height:14px"></div>${panel('報酬紀錄',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>員工</th><th>項目</th><th>期間 / 賽事</th><th>金額</th><th>付款日</th><th>狀態</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.employeeName)}</td><td>${esc(x.compType)}</td><td>${esc(x.reference||'—')}</td><td>${money(x.amount)}</td><td>${date(x.paidDate)}</td><td>${statusBadge(x.status)}</td></tr>`).join('')}</tbody></table></div>`:empty())}`;
  if($('#newPay'))$('#newPay').onclick=async()=>{const e=await api('listEmployeesLite');modal('新增薪資／勞務報酬',`<div class="grid-2"><label class="field"><span>員工</span><select name="employeeId">${e.map(x=>`<option value="${esc(x.employeeId)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>類型</span><select name="compType"><option>SALARY</option><option>EVENT_FEE</option><option>BONUS</option><option>REIMBURSEMENT</option><option>OTHER</option></select></label><label class="field"><span>金額</span><input name="amount" type="number"></label><label class="field"><span>賽事 / 期間 / 說明</span><input name="reference"></label><label class="field"><span>狀態</span><select name="status"><option>PENDING</option><option>PAID</option></select></label><label class="field"><span>付款日</span><input name="paidDate" type="date"></label></div>`,{onSave:async r=>{await api('saveCompensation',formDataObj(r));toast('報酬紀錄已建立');navigate('compensation')}})};
}

async function renderDocuments(){
  setTitle('文件中心','DOCUMENT CENTER'); const items=await api('listDocuments');
  $('#content').innerHTML=`${panel('已產生文件',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>文件編號</th><th>名稱</th><th>類型</th><th>關聯對象</th><th>建立時間</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.documentCode)}</td><td>${esc(x.title)}</td><td>${esc(x.type)}</td><td>${esc(x.entityName||'—')}</td><td>${dt(x.createdAt)}</td><td><a class="btn btn-ghost btn-sm" target="_blank" href="${esc(x.url)}">開啟 PDF</a></td></tr>`).join('')}</tbody></table></div>`:empty('尚未產生文件'))}`;
}

async function renderSystems(){
  setTitle('控制台中心','SYSTEM LAUNCHPAD'); const items=await api('listSystemLinks');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">依權限顯示可使用的內部控制台。</div><div class="grow"></div>${P('systems.edit')?'<button class="btn btn-primary" id="newSystem">＋ 新增系統</button>':''}</div><div style="height:14px"></div><div class="cards">${items.map(x=>`<a class="card link-card" target="_blank" href="${esc(x.url)}"><div class="meta"><span>${esc(x.category||'SYSTEM')}</span></div><h4>${esc(x.name)}</h4><p>${esc(x.description||'')}</p><div class="card-foot"><span class="tiny muted">${esc(x.requiredPermission||'')}</span><span>↗</span></div></a>`).join('')||empty()}</div>`;
  if($('#newSystem'))$('#newSystem').onclick=()=>modal('新增控制台連結',`<div class="grid-2"><label class="field"><span>名稱</span><input name="name"></label><label class="field"><span>網址</span><input name="url"></label><label class="field"><span>分類</span><input name="category" value="CONTROL"></label><label class="field"><span>所需權限</span><input name="requiredPermission" placeholder="systems.raa"></label></div><label class="field"><span>說明</span><textarea name="description"></textarea></label>`,{onSave:async r=>{await api('saveSystemLink',formDataObj(r));toast('系統連結已新增');navigate('systems')}});
}

async function renderVault(){
  setTitle('工作臺機密庫','SECURE VAULT');
  $('#content').innerHTML=`<section class="panel"><div class="panel-head"><h3>二次驗證</h3></div><div class="panel-body"><p class="muted small">查看工作臺帳密前，需要重新輸入目前登入帳號的密碼。每次解鎖與查看都會寫入操作紀錄。</p><div class="grid-2"><label class="field"><span>目前登入密碼</span><input id="reauthPwd" type="password"></label><div style="display:flex;align-items:end"><button class="btn btn-primary" id="unlockVault">解鎖機密庫</button></div></div><div id="vaultArea" style="margin-top:18px"></div></div></section>`;
  $('#unlockVault').onclick=async e=>{try{busy(e.currentTarget,true,'驗證中…');const d=await api('reauthVault',{password:$('#reauthPwd').value});const items=await api('getVault',{vaultToken:d.vaultToken});$('#vaultArea').innerHTML=`<div class="cards">${items.map(x=>`<div class="card"><div class="meta"><span>${esc(x.name)}</span></div><h4>${esc(x.label)}</h4><div class="secret">${esc(x.secret)}</div><div class="card-foot"><span class="tiny muted">${esc(x.note||'')}</span>${x.url?`<a class="btn btn-ghost btn-sm" target="_blank" href="${esc(x.url)}">前往</a>`:''}</div></div>`).join('')}</div>`;toast('機密庫已解鎖')}catch(err){toast(err.message,'err')}finally{busy(e.currentTarget,false)}};
}

async function renderAccounts(){
  setTitle('帳號與權限','ACCESS CONTROL'); const items=await api('listUsers');
  $('#content').innerHTML=`<div class="toolbar"><div class="muted small">帳號不可自行註冊，只能由授權管理員建立。</div><div class="grow"></div>${P('accounts.create')?'<button class="btn btn-primary" id="newUser">＋ 建立員工帳號</button>':''}</div><div style="height:14px"></div>${panel('系統帳號',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>帳號</th><th>員工</th><th>角色</th><th>狀態</th><th>最後登入</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.username)}</td><td>${esc(x.employeeName||x.employeeId)}</td><td>${esc(x.role)}</td><td>${statusBadge(x.status)}</td><td>${dt(x.lastLoginAt)}</td></tr>`).join('')}</tbody></table></div>`:empty())}`;
  if($('#newUser'))$('#newUser').onclick=async()=>{const [e,roles]=await Promise.all([api('listEmployeesLite'),api('listRoles')]);modal('建立員工帳號',`<div class="grid-2"><label class="field"><span>員工</span><select name="employeeId">${e.map(x=>`<option value="${esc(x.employeeId)}">${esc(x.name)} · ${esc(x.employeeId)}</option>`).join('')}</select></label><label class="field"><span>帳號</span><input name="username" placeholder="RN26001"></label><label class="field"><span>角色</span><select name="role">${roles.map(x=>`<option value="${esc(x.role)}">${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>暫時密碼</span><input name="tempPassword" value="${esc(randomPassword())}"></label></div><p class="small muted">第一次登入後，員工應立即更換密碼。系統資料庫只儲存加鹽雜湊，不儲存原始登入密碼。</p>`,{saveText:'建立帳號',onSave:async r=>{await api('createUser',formDataObj(r));toast('員工帳號已建立');navigate('accounts')}})};
}
function randomPassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';return Array.from({length:12},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}

async function renderAudit(){
  setTitle('操作紀錄','AUDIT LOG'); const items=await api('listAudit');
  $('#content').innerHTML=`${panel('最近 300 筆操作',items.length?`<div class="table-wrap"><table class="table"><thead><tr><th>時間</th><th>使用者</th><th>動作</th><th>目標</th><th>結果</th><th>IP / 裝置</th></tr></thead><tbody>${items.map(x=>`<tr><td>${dt(x.createdAt)}</td><td>${esc(x.actorName||x.actorUserId)}</td><td>${esc(x.action)}</td><td>${esc(x.target||'—')}</td><td>${statusBadge(x.result)}</td><td>${esc(x.meta||'')}</td></tr>`).join('')}</tbody></table></div>`:empty())}`;
}


function forcePasswordChange(){
  const r=modal('第一次登入：設定新密碼',`<p class="small muted">這是第一次登入或管理員剛建立的帳號。請先更換暫時密碼再繼續使用。</p><label class="field"><span>目前暫時密碼</span><input type="password" name="currentPassword"></label><label class="field"><span>新密碼（至少 8 碼）</span><input type="password" name="newPassword"></label><label class="field"><span>再次輸入新密碼</span><input type="password" name="confirmPassword"></label>`,{saveText:'更新密碼',onSave:async root=>{const d=formDataObj(root);if(d.newPassword!==d.confirmPassword)throw new Error('兩次新密碼不一致');await api('changePassword',d);state.me.mustChangePassword=false;toast('密碼已更新')}});
  $$('[data-close]',r).forEach(b=>b.remove()); r.onclick=()=>{};
}

window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(state.me&&p&&p!==state.page)navigate(p)});
boot();
