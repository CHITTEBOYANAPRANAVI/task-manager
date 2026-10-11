const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "taskflow_pro_tasks_v1";
const CATEGORY_COLORS = {Work:"#3478f6",Personal:"#13a779",Study:"#9561e9",Health:"#f28a3f",Other:"#8b9bb2"};
let tasks = loadTasks();
let activeFilter = "all";
let activeCategory = "";
let editingId = null;
let calendarDate = new Date();
let selectedDate = "";
let toastTimer;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (error) { return []; }
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function localDate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function dateFromString(value) { const [y,m,d] = value.split("-").map(Number); return new Date(y,m-1,d); }
function formatDate(value) {
  if (!value) return "No due date";
  return dateFromString(value).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function isOverdue(task) { return !!task.dueDate && task.dueDate < localDate() && !task.completed; }
function showToast(message) {
  const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function addSampleTasksIfFirstVisit() {
  // Keep a fresh account clean; users can start with their own tasks.
}
function resetForm() {
  editingId = null; $("taskForm").reset(); $("taskDueDate").value = "";
  $("submitTaskBtn").innerHTML = 'Add task <span>↗</span>';
  $("cancelEditBtn").classList.add("hidden"); $("taskTitle").placeholder = "What needs to get done?";
}
function beginEdit(id) {
  const task = tasks.find(item => item.id === id); if (!task) return;
  editingId = id; $("taskTitle").value = task.title; $("taskDescription").value = task.description || "";
  $("taskCategory").value = task.category; $("taskPriority").value = task.priority;
  $("taskDueDate").value = task.dueDate || ""; $("submitTaskBtn").innerHTML = 'Save changes <span>✓</span>';
  $("cancelEditBtn").classList.remove("hidden"); $("taskTitle").focus();
  $("taskForm").scrollIntoView({behavior:"smooth",block:"center"});
}
function createTask(event) {
  event.preventDefault();
  const title = $("taskTitle").value.trim();
  if (!title) { showToast("Please enter a task name."); $("taskTitle").focus(); return; }
  const taskData = {title,description:$("taskDescription").value.trim(),category:$("taskCategory").value,priority:$("taskPriority").value,dueDate:$("taskDueDate").value};
  if (editingId) {
    tasks = tasks.map(task => task.id === editingId ? {...task,...taskData,updatedAt:Date.now()} : task);
    showToast("Task updated successfully.");
  } else {
    tasks.unshift({id:uid(),...taskData,completed:false,important:false,createdAt:Date.now()});
    showToast("Task added. Keep the momentum going!");
  }
  saveTasks(); resetForm(); renderAll();
}
function toggleComplete(id) {
  const task = tasks.find(item => item.id === id); if (!task) return;
  task.completed = !task.completed; task.completedAt = task.completed ? Date.now() : null;
  saveTasks(); renderAll(); showToast(task.completed ? "Nice work! Task completed." : "Task moved back to pending.");
}
function toggleImportant(id) {
  const task = tasks.find(item => item.id === id); if (!task) return;
  task.important = !task.important; saveTasks(); renderAll();
  showToast(task.important ? "Added to Important." : "Removed from Important.");
}
function deleteTask(id) {
  const task = tasks.find(item => item.id === id); if (!task) return;
  if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
  tasks = tasks.filter(item => item.id !== id); saveTasks(); renderAll(); showToast("Task deleted.");
}
function getFilteredTasks() {
  const query = $("searchInput").value.trim().toLowerCase();
  let result = tasks.filter(task => {
    if (activeCategory && task.category !== activeCategory) return false;
    if (activeFilter === "today" && task.dueDate !== localDate()) return false;
    if (activeFilter === "upcoming" && (!task.dueDate || task.dueDate <= localDate() || task.completed)) return false;
    if (activeFilter === "important" && !task.important) return false;
    if (activeFilter === "completed" && !task.completed) return false;
    if (query && !`${task.title} ${task.description || ""} ${task.category}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const sort = $("sortSelect").value;
  if (sort === "due") result.sort((a,b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
  else if (sort === "priority") { const rank={high:0,medium:1,low:2}; result.sort((a,b)=>rank[a.priority]-rank[b.priority]); }
  else if (sort === "title") result.sort((a,b)=>a.title.localeCompare(b.title));
  else result.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return result;
}
function renderTasks() {
  const list = $("taskList"), visible = getFilteredTasks();
  list.innerHTML = "";
  $("emptyState").classList.toggle("hidden", visible.length !== 0);
  list.classList.toggle("hidden", visible.length === 0);
  visible.forEach(task => {
    const row = document.createElement("article");
    row.className = `task-row ${task.completed ? "is-complete" : ""}`;
    const priorityName = task.priority.charAt(0).toUpperCase()+task.priority.slice(1);
    const dueText = task.dueDate ? formatDate(task.dueDate) : "No due date";
    row.innerHTML = `
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(task.title)} complete" ${task.completed?"checked":""}>
      <div class="task-main">
        <div class="task-title-line"><span class="task-title">${escapeHTML(task.title)}</span>
          <button class="star-btn ${task.important?"starred":""}" title="${task.important?"Remove importance":"Mark important"}" aria-label="Toggle important">${task.important?"★":"☆"}</button>
        </div>
        ${task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : ""}
      </div>
      <div class="task-meta">
        <span class="tag category"><i class="category-dot" style="background:${CATEGORY_COLORS[task.category]||CATEGORY_COLORS.Other}"></i>${escapeHTML(task.category)}</span>
        <span class="tag priority-${task.priority}">⚑ ${priorityName}</span>
        <span class="due-date ${isOverdue(task)?"overdue":""}">${task.dueDate ? (isOverdue(task)?"Overdue · ":"▣ ")+escapeHTML(dueText) : "— No date"}</span>
        <div class="task-actions"><button class="edit-task" title="Edit task" aria-label="Edit task">✎</button><button class="delete-task" title="Delete task" aria-label="Delete task">⌫</button></div>
      </div>`;
    row.querySelector(".task-check").addEventListener("change",()=>toggleComplete(task.id));
    row.querySelector(".star-btn").addEventListener("click",()=>toggleImportant(task.id));
    row.querySelector(".edit-task").addEventListener("click",()=>beginEdit(task.id));
    row.querySelector(".delete-task").addEventListener("click",()=>deleteTask(task.id));
    list.appendChild(row);
  });
  $("listCount").textContent = `${visible.length} ${visible.length===1?"task":"tasks"} shown`;
  $("allTabCount").textContent = tasks.length;
}
function renderStats() {
  const completed = tasks.filter(task=>task.completed).length, pending = tasks.length-completed;
  const overdue = tasks.filter(isOverdue).length, percent = tasks.length ? Math.round(completed/tasks.length*100) : 0;
  $("totalStat").textContent=tasks.length; $("completedStat").textContent=completed; $("pendingStat").textContent=pending; $("overdueStat").textContent=overdue;
  $("completionNote").textContent=`${percent}% completion`; $("completionBar").style.width=`${percent}%`;
  $("navAllCount").textContent=tasks.length; $("navTodayCount").textContent=tasks.filter(t=>t.dueDate===localDate()&&!t.completed).length;
  const daily = tasks.filter(t=>t.dueDate===localDate()), dailyDone=daily.filter(t=>t.completed).length;
  const dailyPercent=daily.length?Math.round(dailyDone/daily.length*100):0;
  $("dailyProgressLabel").textContent=`${dailyPercent}%`; $("dailyProgressBar").style.width=`${dailyPercent}%`;
  $("focusMessage").textContent = daily.length ? `${dailyDone} of ${daily.length} tasks due today completed. ${dailyPercent===100?"Amazing work — you did it!":"Keep going, you're making progress."}` : "No tasks due today. Add one small goal to get started.";
}
function renderCategories() {
  const categories = Object.keys(CATEGORY_COLORS);
  $("categoryList").innerHTML = categories.map(cat => {
    const count=tasks.filter(t=>t.category===cat&&!t.completed).length;
    return `<button class="category-link" data-category="${cat}"><i class="category-dot" style="background:${CATEGORY_COLORS[cat]}"></i><span>${cat}</span><span class="category-count">${count}</span></button>`;
  }).join("");
  $("categoryList").querySelectorAll("[data-category]").forEach(button=>button.addEventListener("click",()=>{
    activeCategory=activeCategory===button.dataset.category?"":button.dataset.category;
    activeFilter="all"; updateFilterButtons(); renderAll();
    $("listTitle").textContent=activeCategory?`${activeCategory} tasks`:"Your tasks";
  }));
  const max=Math.max(1,...categories.map(cat=>tasks.filter(t=>t.category===cat).length));
  $("categorySummary").innerHTML=categories.map(cat=>{
    const count=tasks.filter(t=>t.category===cat).length, width=Math.round(count/max*100);
    return `<div class="category-summary-row"><i class="category-dot" style="background:${CATEGORY_COLORS[cat]}"></i><span class="cat-name">${cat}</span><strong>${count}</strong><div class="category-bar"><span style="width:${width}%;background:${CATEGORY_COLORS[cat]}"></span></div></div>`;
  }).join("");
}
function updateFilterButtons() {
  document.querySelectorAll(".filter-tab").forEach(button=>button.classList.toggle("active",button.dataset.filter===activeFilter));
  document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view===activeFilter && !activeCategory));
  const labels={all:["Your tasks","Stay organized and get things done."],today:["Today's tasks","Your plan for the day."],upcoming:["Upcoming tasks","See what's coming up next."],important:["Important tasks","Your highest-priority reminders."],completed:["Completed tasks","Look at everything you've accomplished."]};
  if (!activeCategory) { $("listTitle").textContent=labels[activeFilter][0]; $("listSubtitle").textContent=labels[activeFilter][1]; }
}
function setFilter(filter) {
  activeFilter=filter; activeCategory=""; updateFilterButtons(); renderAll();
}
function renderCalendar() {
  const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
  $("calendarMonth").textContent=calendarDate.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const firstDay=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate(), prevDays=new Date(year,month,0).getDate();
  const names=["Su","Mo","Tu","We","Th","Fr","Sa"];
  let html=names.map(day=>`<div class="calendar-day-name">${day}</div>`).join("");
  const cells=Math.ceil((firstDay+days)/7)*7;
  for(let i=0;i<cells;i++){
    let day, date, muted=false;
    if(i<firstDay){day=prevDays-firstDay+i+1;date=localDate(new Date(year,month-1,day));muted=true;}
    else if(i>=firstDay+days){day=i-(firstDay+days)+1;date=localDate(new Date(year,month+1,day));muted=true;}
    else {day=i-firstDay+1;date=localDate(new Date(year,month,day));}
    const hasTask=tasks.some(t=>t.dueDate===date);
    html+=`<button class="calendar-day ${muted?"muted":""} ${date===localDate()?"today":""} ${date===selectedDate?"selected":""} ${hasTask?"has-task":""}" data-date="${date}" aria-label="${date}${hasTask?", has tasks":""}">${day}</button>`;
  }
  $("calendarGrid").innerHTML=html;
  $("calendarGrid").querySelectorAll("[data-date]").forEach(button=>button.addEventListener("click",()=>{
    selectedDate=selectedDate===button.dataset.date?"":button.dataset.date;
    if(selectedDate){activeFilter="all";activeCategory="";$("searchInput").value="";$("listTitle").textContent=`Tasks for ${formatDate(selectedDate)}`;$("listSubtitle").textContent="Tasks scheduled for this date.";}
    else updateFilterButtons();
    renderCalendar();
    if(selectedDate){
      const list=$("taskList"), visible=tasks.filter(t=>t.dueDate===selectedDate);
      list.innerHTML="";$("emptyState").classList.toggle("hidden",visible.length!==0);list.classList.toggle("hidden",visible.length===0);
      visible.forEach(task=>{
        const tempFilter=activeFilter; const row=document.createElement("article");row.className=`task-row ${task.completed?"is-complete":""}`;
        row.innerHTML=`<input class="task-check" type="checkbox" ${task.completed?"checked":""} aria-label="Complete task"><div class="task-main"><div class="task-title-line"><span class="task-title">${escapeHTML(task.title)}</span><button class="star-btn ${task.important?"starred":""}" aria-label="Toggle important">${task.important?"★":"☆"}</button></div>${task.description?`<p class="task-description">${escapeHTML(task.description)}</p>`:""}</div><div class="task-meta"><span class="tag category">${escapeHTML(task.category)}</span><span class="tag priority-${task.priority}">${task.priority}</span><span class="due-date">${formatDate(task.dueDate)}</span><div class="task-actions"><button class="edit-task" aria-label="Edit">✎</button><button class="delete-task" aria-label="Delete">⌫</button></div></div>`;
        row.querySelector(".task-check").addEventListener("change",()=>toggleComplete(task.id));row.querySelector(".star-btn").addEventListener("click",()=>toggleImportant(task.id));row.querySelector(".edit-task").addEventListener("click",()=>beginEdit(task.id));row.querySelector(".delete-task").addEventListener("click",()=>deleteTask(task.id));list.appendChild(row);
      });
      $("listCount").textContent=`${visible.length} tasks on ${formatDate(selectedDate)}`;
    } else renderTasks();
  }));
}
function renderAll() {
  renderStats(); renderCategories(); renderTasks(); renderCalendar();
}
$("taskForm").addEventListener("submit",createTask);
$("cancelEditBtn").addEventListener("click",resetForm);
$("openTaskBtn").addEventListener("click",()=>{$("taskTitle").focus();$("taskForm").scrollIntoView({behavior:"smooth",block:"center"});});
$("emptyAddBtn").addEventListener("click",()=>{$("taskTitle").focus();$("taskForm").scrollIntoView({behavior:"smooth",block:"center"});});
document.querySelectorAll(".filter-tab").forEach(button=>button.addEventListener("click",()=>{selectedDate="";setFilter(button.dataset.filter);}));
document.querySelectorAll(".nav-link[data-view]").forEach(button=>button.addEventListener("click",()=>{selectedDate="";setFilter(button.dataset.view);if(window.innerWidth<=760)$("sidebar").classList.remove("open");}));
$("searchInput").addEventListener("input",()=>{selectedDate="";renderTasks();});
$("sortSelect").addEventListener("change",renderTasks);
$("clearCompletedBtn").addEventListener("click",()=>{
  const count=tasks.filter(t=>t.completed).length;if(!count){showToast("No completed tasks to clear.");return;}
  if(confirm(`Remove ${count} completed ${count===1?"task":"tasks"}?`)){tasks=tasks.filter(t=>!t.completed);saveTasks();renderAll();showToast("Completed tasks cleared.");}
});
$("themeBtn").addEventListener("click",()=>{
  document.body.classList.toggle("dark");localStorage.setItem("taskflow_dark",document.body.classList.contains("dark")?"yes":"no");
  $("themeBtn").textContent=document.body.classList.contains("dark")?"☾":"☼";
});
if(localStorage.getItem("taskflow_dark")==="yes"){document.body.classList.add("dark");$("themeBtn").textContent="☾";}
$("prevMonth").addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar();});
$("nextMonth").addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar();});
$("addCategoryBtn").addEventListener("click",()=>{
  const name=prompt("Category names available in this version are Work, Personal, Study, Health, and Other.\nWhich existing category would you like to view?");
  if(name){const match=Object.keys(CATEGORY_COLORS).find(c=>c.toLowerCase()===name.trim().toLowerCase());if(match){activeCategory=match;activeFilter="all";updateFilterButtons();renderAll();}else showToast("Use one of the listed categories for now.");}
});
$("settingsBtn").addEventListener("click",()=>alert("TaskFlow settings\n\n• Use the sun/moon button to switch themes.\n• Tasks are saved in this browser using local storage.\n• To reset all tasks, clear this site's local storage in your browser developer tools."));
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
document.addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("searchInput").focus();}
  if(event.key==="Escape"){$("sidebar").classList.remove("open");if(editingId)resetForm();}
});
$("todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
renderAll();
