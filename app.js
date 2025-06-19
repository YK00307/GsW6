// --- Gemini APIキー（ここで直接指定） ---
const GEMINI_API_KEY = "";


// --- データ ---
let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
let schedules = JSON.parse(localStorage.getItem('schedules') || '[]');
let repeatSettingTask = JSON.parse(localStorage.getItem('repeatSettingTask') || '[]');
let repeatSettingSchedule = JSON.parse(localStorage.getItem('repeatSettingSchedule') || '[]');
let calendarDate = new Date();
let selectedDay = null;
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');

// --- 画面遷移 ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  let screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
  document.querySelectorAll('.add-button').forEach(btn => btn.style.display = 'none');
  if (screenId === 'screen-main' || screenId === 'screen-calendar') {
    document.querySelectorAll('.add-button').forEach(btn => btn.style.display = 'block');
  }
  if (screenId === 'screen-main') {
    renderTaskLists();
    renderScheduleList();
  }
  if (screenId === 'screen-calendar') renderCalendar();
  if (screenId === 'screen-ai') renderChat();
  if (screenId === 'screen-repeat-task') renderRepeatSetting('task');
  if (screenId === 'screen-repeat-schedule') renderRepeatSetting('schedule');
  if (screenId === 'screen-dayview') renderDayView();
}

// --- 追加種別ダイアログ ---
function showAddTypeDialog() {
  let dialog = document.getElementById('add-type-dialog');
  if (dialog) dialog.style.display = 'block';
}
function closeAddTypeDialog() {
  let dialog = document.getElementById('add-type-dialog');
  if (dialog) dialog.style.display = 'none';
}

// --- タスク・予定リスト描画 ---
function renderTaskLists() {
  let now = new Date();
  let current = [];
  let finished = [];
  tasks.forEach((task, idx) => {
    let end = new Date(task.endDate + 'T' + task.endTime);
    if (task.completed || end < now) {
      finished.push({ ...task, idx });
    } else {
      current.push({ ...task, idx });
    }
  });
  current.sort((a, b) => new Date(a.endDate + 'T' + a.endTime) - new Date(b.endDate + 'T' + b.endTime));
  finished.sort((a, b) => new Date(b.endDate + 'T' + b.endTime) - new Date(a.endDate + 'T' + a.endTime));

  let htmlCurrent = '';
  current.forEach(t => {
    let end = new Date(t.endDate + 'T' + t.endTime);
    let remain = Math.max(0, Math.round((end - now) / 3600000));
    htmlCurrent += `<div class="task-item" title="${t.comment ? t.comment : ''}" onclick="editTask(${t.idx})">
      <div class="task-name">${t.name}</div>
      <div class="task-period">あと${remain}時間</div>
    </div>`;
  });
  document.getElementById('task-list-current').innerHTML = htmlCurrent;

  let htmlFinished = '';
  finished.forEach(t => {
    let end = new Date(t.endDate + 'T' + t.endTime);
    let status = t.completed ? '（完了）' : '（期限切れ）';
    htmlFinished += `<div class="task-item${t.completed ? ' completed' : ' expired'}">
      <div class="task-name">${t.name} ${status}</div>
      <div class="task-period">${t.startDate} ${t.startTime} ～ ${t.endDate} ${t.endTime}</div>
      <button class="task-delete-btn" onclick="deleteTask(${t.idx}, event)">✕</button>
    </div>`;
  });
  document.getElementById('task-list-finished').innerHTML = htmlFinished;

  let completedCount = tasks.filter(t => t.completed).length;
  document.getElementById('status').textContent = `現在：${completedCount}/${tasks.length} タスク完了`;
}

function renderScheduleList() {
  let now = new Date();
  let html = '';
  schedules.forEach((sch, idx) => {
    let end = new Date(sch.endDate + 'T' + sch.endTime);
    let status = end < now ? '（終了）' : '';
    html += `<div class="task-item" title="${sch.comment ? sch.comment : ''}" onclick="editSchedule(${idx})">
      <div class="task-name">${sch.name} ${status}</div>
      <div class="task-period">${sch.startDate} ${sch.startTime} ～ ${sch.endDate} ${sch.endTime}</div>
    </div>`;
  });
  document.getElementById('schedule-list').innerHTML = html;
}

// --- タスク追加 ---
document.getElementById('add-task-save-btn').onclick = function() {
  let name = document.getElementById('task-name').value.trim();
  let startDate = document.getElementById('task-start-date').value;
  let startTime = document.getElementById('task-start-time').value;
  let endDate = document.getElementById('task-end-date').value;
  let endTime = document.getElementById('task-end-time').value;
  let comment = document.getElementById('task-comment').value.trim();
  if (!name || !startDate || !startTime || !endDate || !endTime) {
    alert('すべて入力してください');
    return;
  }
  // 規則的追加
  if (repeatSettingTask.length > 0) {
    let baseStart = new Date(startDate + 'T' + startTime);
    let baseEnd = new Date(endDate + 'T' + endTime);
    let cur = new Date(baseStart);
    let until = new Date();
    until.setMonth(until.getMonth() + 1);
    while (cur <= until) {
      let day = cur.getDay();
      if (repeatSettingTask.includes('every') || repeatSettingTask.includes(day + '')) {
        let s = cur.toISOString().slice(0,10);
        let e = new Date(cur.getTime() + (baseEnd-baseStart));
        let et = e.toISOString().slice(0,10);
        tasks.push({ name, startDate: s, startTime, endDate: et, endTime, comment, completed: false });
      }
      cur.setDate(cur.getDate() + 1);
    }
    repeatSettingTask = [];
    localStorage.setItem('repeatSettingTask', JSON.stringify([]));
  } else {
    tasks.push({ name, startDate, startTime, endDate, endTime, comment, completed: false });
  }
  saveTasks();
  showScreen('screen-main');
  clearAddForm();
};

// --- 予定追加 ---
document.getElementById('add-schedule-save-btn').onclick = function() {
  let name = document.getElementById('schedule-name').value.trim();
  let startDate = document.getElementById('schedule-start-date').value;
  let startTime = document.getElementById('schedule-start-time').value;
  let endDate = document.getElementById('schedule-end-date').value;
  let endTime = document.getElementById('schedule-end-time').value;
  let comment = document.getElementById('schedule-comment').value.trim();
  if (!name || !startDate || !startTime || !endDate || !endTime) {
    alert('すべて入力してください');
    return;
  }
  // 規則的追加
  if (repeatSettingSchedule.length > 0) {
    let baseStart = new Date(startDate + 'T' + startTime);
    let baseEnd = new Date(endDate + 'T' + endTime);
    let cur = new Date(baseStart);
    let until = new Date();
    until.setMonth(until.getMonth() + 1);
    while (cur <= until) {
      let day = cur.getDay();
      if (repeatSettingSchedule.includes('every') || repeatSettingSchedule.includes(day + '')) {
        let s = cur.toISOString().slice(0,10);
        let e = new Date(cur.getTime() + (baseEnd-baseStart));
        let et = e.toISOString().slice(0,10);
        schedules.push({ name, startDate: s, startTime, endDate: et, endTime, comment });
      }
      cur.setDate(cur.getDate() + 1);
    }
    repeatSettingSchedule = [];
    localStorage.setItem('repeatSettingSchedule', JSON.stringify([]));
  } else {
    schedules.push({ name, startDate, startTime, endDate, endTime, comment });
  }
  saveSchedules();
  showScreen('screen-main');
  clearScheduleAddForm();
  showPopup('カレンダーに追加しました。ご確認ください');
};

function clearAddForm() {
  document.getElementById('task-name').value = '';
  document.getElementById('task-start-date').value = '';
  document.getElementById('task-start-time').value = '';
  document.getElementById('task-end-date').value = '';
  document.getElementById('task-end-time').value = '';
  document.getElementById('task-comment').value = '';
}
function clearScheduleAddForm() {
  document.getElementById('schedule-name').value = '';
  document.getElementById('schedule-start-date').value = '';
  document.getElementById('schedule-start-time').value = '';
  document.getElementById('schedule-end-date').value = '';
  document.getElementById('schedule-end-time').value = '';
  document.getElementById('schedule-comment').value = '';
}

// --- 規則的設定UI ---
function renderRepeatSetting(type) {
  let repeatSetting = (type === 'task') ? repeatSettingTask : repeatSettingSchedule;
  document.querySelectorAll(`.repeat-day-${type}`).forEach(cb => {
    cb.checked = repeatSetting.includes(cb.value);
  });
  document.getElementById(`repeat-everyday-${type}`).checked = repeatSetting.includes('every');
}
document.querySelectorAll('.repeat-day-task').forEach(cb => {
  cb.addEventListener('change', function() {
    if (document.getElementById('repeat-everyday-task').checked) {
      document.getElementById('repeat-everyday-task').checked = false;
      repeatSettingTask = [];
    }
    if (this.checked) {
      repeatSettingTask.push(this.value);
    } else {
      repeatSettingTask = repeatSettingTask.filter(v => v !== this.value);
    }
  });
});
document.getElementById('repeat-everyday-task').addEventListener('change', function() {
  if (this.checked) {
    repeatSettingTask = ['every'];
    document.querySelectorAll('.repeat-day-task').forEach(cb => cb.checked = false);
  } else {
    repeatSettingTask = [];
  }
});
document.querySelectorAll('.repeat-day-schedule').forEach(cb => {
  cb.addEventListener('change', function() {
    if (document.getElementById('repeat-everyday-schedule').checked) {
      document.getElementById('repeat-everyday-schedule').checked = false;
      repeatSettingSchedule = [];
    }
    if (this.checked) {
      repeatSettingSchedule.push(this.value);
    } else {
      repeatSettingSchedule = repeatSettingSchedule.filter(v => v !== this.value);
    }
  });
});
document.getElementById('repeat-everyday-schedule').addEventListener('change', function() {
  if (this.checked) {
    repeatSettingSchedule = ['every'];
    document.querySelectorAll('.repeat-day-schedule').forEach(cb => cb.checked = false);
  } else {
    repeatSettingSchedule = [];
  }
});
function saveRepeatSetting(type) {
  if (type === 'task') {
    localStorage.setItem('repeatSettingTask', JSON.stringify(repeatSettingTask));
    showScreen('screen-add-task');
  } else {
    localStorage.setItem('repeatSettingSchedule', JSON.stringify(repeatSettingSchedule));
    showScreen('screen-add-schedule');
  }
}

// --- タスク編集 ---
function editTask(idx) {
  editTaskIndex = idx;
  let task = tasks[idx];
  document.getElementById('edit-task-name').value = task.name;
  document.getElementById('edit-task-start-date').value = task.startDate;
  document.getElementById('edit-task-start-time').value = task.startTime;
  document.getElementById('edit-task-end-date').value = task.endDate;
  document.getElementById('edit-task-end-time').value = task.endTime;
  document.getElementById('edit-task-comment').value = task.comment;
  showScreen('screen-edit-task');
}
document.getElementById('edit-task-save-btn').onclick = function() {
  if (editTaskIndex === null) return;
  let name = document.getElementById('edit-task-name').value.trim();
  let startDate = document.getElementById('edit-task-start-date').value;
  let startTime = document.getElementById('edit-task-start-time').value;
  let endDate = document.getElementById('edit-task-end-date').value;
  let endTime = document.getElementById('edit-task-end-time').value;
  let comment = document.getElementById('edit-task-comment').value.trim();
  if (!name || !startDate || !startTime || !endDate || !endTime) {
    alert('すべて入力してください');
    return;
  }
  tasks[editTaskIndex] = { ...tasks[editTaskIndex], name, startDate, startTime, endDate, endTime, comment };
  saveTasks();
  showScreen('screen-main');
};
document.getElementById('edit-task-delete-btn').onclick = function() {
  if (editTaskIndex === null) return;
  if (confirm('本当に削除しますか？')) {
    tasks.splice(editTaskIndex, 1);
    saveTasks();
    showScreen('screen-main');
  }
};
document.getElementById('finish-task-btn').onclick = function() {
  if (editTaskIndex === null) return;
  tasks[editTaskIndex].completed = true;
  saveTasks();
  showScreen('screen-main');
  showPopup('課題を完了しました！やったね！！次も頑張ろう');
};

// --- 予定編集 ---
function editSchedule(idx) {
  editScheduleIndex = idx;
  let sch = schedules[idx];
  document.getElementById('edit-schedule-name').value = sch.name;
  document.getElementById('edit-schedule-start-date').value = sch.startDate;
  document.getElementById('edit-schedule-start-time').value = sch.startTime;
  document.getElementById('edit-schedule-end-date').value = sch.endDate;
  document.getElementById('edit-schedule-end-time').value = sch.endTime;
  document.getElementById('edit-schedule-comment').value = sch.comment;
  showScreen('screen-edit-schedule');
}
document.getElementById('edit-schedule-save-btn').onclick = function() {
  if (editScheduleIndex === null) return;
  let name = document.getElementById('edit-schedule-name').value.trim();
  let startDate = document.getElementById('edit-schedule-start-date').value;
  let startTime = document.getElementById('edit-schedule-start-time').value;
  let endDate = document.getElementById('edit-schedule-end-date').value;
  let endTime = document.getElementById('edit-schedule-end-time').value;
  let comment = document.getElementById('edit-schedule-comment').value.trim();
  if (!name || !startDate || !startTime || !endDate || !endTime) {
    alert('すべて入力してください');
    return;
  }
  schedules[editScheduleIndex] = { ...schedules[editScheduleIndex], name, startDate, startTime, endDate, endTime, comment };
  saveSchedules();
  showScreen('screen-main');
};
document.getElementById('edit-schedule-delete-btn').onclick = function() {
  if (editScheduleIndex === null) return;
  if (confirm('本当に削除しますか？')) {
    schedules.splice(editScheduleIndex, 1);
    saveSchedules();
    showScreen('screen-main');
  }
};

function deleteTask(idx, e) {
  e.stopPropagation();
  if (confirm('本当に削除しますか？')) {
    tasks.splice(idx, 1);
    saveTasks();
    renderTaskLists();
  }
}
function deleteAllFinishedTasks() {
  if (confirm('本当に削除しますか？')) {
    let now = new Date();
    tasks = tasks.filter(t => {
      let end = new Date(t.endDate + 'T' + t.endTime);
      return !t.completed && end >= now;
    });
    saveTasks();
    renderTaskLists();
  }
}
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}
function saveSchedules() {
  localStorage.setItem('schedules', JSON.stringify(schedules));
}

// --- AIチャット ---
// Gemini APIに直接問い合わせる
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  // ユーザーの発言をチャット欄に追加
  chatHistory.push({ role: 'user', text: msg });
  renderChat();

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + "",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: msg }] }
          ]
        })
      }
    );
    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text) {
      chatHistory.push({ role: 'ai', text: data.candidates[0].content.parts[0].text });
    } else if (data.error) {
      chatHistory.push({ role: 'ai', text: "（Gemini APIエラー: " + data.error.message + "）" });
      console.error(data.error);
    } else {
      chatHistory.push({ role: 'ai', text: "（AI応答エラー）" });
    }
    renderChat();
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  } catch (e) {
    chatHistory.push({ role: 'ai', text: "（AI応答エラー）" });
    renderChat();
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    console.error(e);
  }
}

function renderChat() {
  const chat = document.getElementById('chat-container');
  if (!chat) return;
  chat.innerHTML = '';
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'chat-message ' + msg.role;
    div.textContent = msg.text;
    chat.appendChild(div);
  });
  chat.scrollTop = chat.scrollHeight;
}

// Enterキー送信対応
document.addEventListener('DOMContentLoaded', function() {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
});

// チャット欄にメッセージを追加・削除
function addChatMessage(role, text) {
  const chat = document.getElementById('chat-container');
  const div = document.createElement('div');
  div.className = 'chat-message ' + role;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function clearChatHistory() {
  if (confirm('本当にチャット履歴を削除しますか？')) {
    chatHistory = [];
    localStorage.removeItem('chatHistory');
    renderChat();
  }
}
window.clearChatHistory = clearChatHistory; // グローバル登録

// --- カレンダー ---
function renderCalendar() {
  let year = calendarDate.getFullYear();
  let month = calendarDate.getMonth();
  document.getElementById('calendar-month').textContent = `${year}年${month+1}月`;
  let firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  let daysInMonth = new Date(year, month+1, 0).getDate();
  let prevMonthDays = new Date(year, month, 0).getDate();
  let days = [];
  for (let i = startDay-1; i >= 0; i--) {
    days.push({ day: prevMonthDays-i, other: true, year, month: month-1 });
  }
  for (let d=1; d<=daysInMonth; d++) {
    days.push({ day: d, other: false, year, month });
  }
  let totalCells = days.length;
  for (let d=1; totalCells+d <= 42; d++) {
    days.push({ day: d, other: true, year, month: month+1 });
  }
  let weekDays = ['日','月','火','水','木','金','土'];
  let html = weekDays.map(w => `<div class="calendar-day" style="background:#e3f2fd;font-weight:bold;">${w}</div>`).join('');
  let today = new Date();
  days.forEach((obj, idx) => {
    let cellDate = new Date(year, month, obj.day);
    if (obj.other && idx < 7) cellDate = new Date(year, month-1, obj.day);
    if (obj.other && idx >= daysInMonth+startDay) cellDate = new Date(year, month+1, obj.day);
    let isToday = cellDate.toDateString() === today.toDateString();
    let cellTasks = tasks.filter(t => {
      let s = new Date(t.startDate + 'T' + t.startTime);
      let e = new Date(t.endDate + 'T' + t.endTime);
      return (s <= cellDate && cellDate <= e);
    });
    let cellSchedules = schedules.filter(sch => {
      let s = new Date(sch.startDate + 'T' + sch.startTime);
      let e = new Date(sch.endDate + 'T' + sch.endTime);
      return (s <= cellDate && cellDate <= e);
    });
    let cellStr = cellTasks.map(t =>
      `<div class="calendar-task${t.completed ? ' completed' : (new Date(t.endDate+'T'+t.endTime)<today?' expired':'')}"
        >${t.name}</div>`).join('') +
      cellSchedules.map(sch =>
        `<div class="calendar-task" style="background:#ff9800;">${sch.name}</div>`
      ).join('');
    html += `<div class="calendar-day${obj.other ? ' other-month' : ''}${isToday ? ' today' : ''}"
      onclick="showDayView('${cellDate.getFullYear()}-${('0'+(cellDate.getMonth()+1)).slice(-2)}-${('0'+cellDate.getDate()).slice(-2)}')">
      <div class="day-number">${obj.day}</div>
      ${cellStr}
    </div>`;
  });
  document.getElementById('calendar-grid').innerHTML = html;
}
function changeMonth(diff) {
  calendarDate.setMonth(calendarDate.getMonth() + diff);
  renderCalendar();
}

// --- 1日スケジュール ---
function showDayView(dateStr) {
  selectedDay = dateStr;
  showScreen('screen-dayview');
}
function renderDayView() {
  document.getElementById('dayview-title').textContent = `${selectedDay} の予定`;
  let html = '';
  for (let h=0; h<24; h++) {
    let hourStr = ('0'+h).slice(-2) + ':00';
    let hourTasks = tasks.filter(t => {
      let s = new Date(t.startDate + 'T' + t.startTime);
      let e = new Date(t.endDate + 'T' + t.endTime);
      let d = new Date(selectedDay + 'T' + hourStr);
      return s <= d && d < e;
    });
    let hourSchedules = schedules.filter(sch => {
      let s = new Date(sch.startDate + 'T' + sch.startTime);
      let e = new Date(sch.endDate + 'T' + sch.endTime);
      let d = new Date(selectedDay + 'T' + hourStr);
      return s <= d && d < e;
    });
    html += `<div class="dayview-hour"><span class="hour-label">${hourStr}</span>`;
    hourTasks.forEach(t => {
      html += `<span class="dayview-task">${t.name}</span>`;
    });
    hourSchedules.forEach(sch => {
      html += `<span class="dayview-schedule">${sch.name}</span>`;
    });
    html += '</div>';
  }
  document.getElementById('dayview-hours').innerHTML = html;
}

// --- ポップアップ ---
function showPopup(msg) {
  document.getElementById('popup-msg').textContent = msg;
  document.getElementById('popup').style.display = 'block';
}
function closePopup() {
  document.getElementById('popup').style.display = 'none';
}

// --- 初期表示 ---
showScreen('screen-main');

// --- グローバル登録 ---
window.showScreen = showScreen;
window.showAddTypeDialog = showAddTypeDialog;
window.closeAddTypeDialog = closeAddTypeDialog;
window.saveRepeatSetting = saveRepeatSetting;
window.sendChat = sendChat;


// --- 初期表示 ---
showScreen('screen-main');
