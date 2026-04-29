import { state } from './store';

export function render() {
  const list = document.getElementById('list');
  if (!list) return;

  list.innerHTML = '';

  const tasks = state.filteredTasks;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const li = document.createElement('li');

    if (state.mode === 'INSERT' && i === state.cursor) {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = task.raw || '';
      input.dataset.taskEdit = 'true';
      input.className = 'task-edit';
      li.appendChild(input);
      setTimeout(() => input.focus(), 0);
    } else {
      const span = document.createElement('span');
      span.className = 'task-text';
      span.innerHTML = formatTaskHTML(task);
      li.appendChild(span);
    }

    li.className = 'task';
    if (task.done) li.classList.add('done');
    if (task.priority) li.classList.add(`prio-${task.priority.toLowerCase()}`);
    if (i === state.cursor && state.mode !== 'INSERT') li.classList.add('cursor');

    const dueDate = task.meta.due;
    if (dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 0) {
        li.classList.add('overdue');
      } else if (days <= 3) {
        li.classList.add('has-due-soon');
      }
    }

    list.appendChild(li);
  }

  updateStatusLine();
  updateFilterIndicator();
}

function formatTaskHTML(task: any): string {
  let html = escapeHtml(task.description);

  // Simple approach: find and replace the literal +/@ text in description
  for (const proj of task.projects) {
    const pattern = `+${proj}`;
    const replacement = `<strong class="project">+${escapeHtml(proj)}</strong>`;
    html = html.split(pattern).join(replacement);
  }

  for (const ctx of task.contexts) {
    const pattern = `@${ctx}`;
    const replacement = `<em class="context">@${escapeHtml(ctx)}</em>`;
    html = html.split(pattern).join(replacement);
  }

  // Don't show due date inline, it goes on the right
  for (const [key, val] of Object.entries(task.meta)) {
    if (key !== 'due') {
      const pattern = `${key}:${val}`;
      const replacement = `<span class="meta">${escapeHtml(key)}:${escapeHtml(val as string)}</span>`;
      html = html.split(pattern).join(replacement);
    }
  }

  // Add due date on the right
  if (task.meta.due) {
    html = `<div class="task-content"><span class="task-main">${html}</span><span class="task-due">${escapeHtml(task.meta.due as string)}</span></div>`;
  }

  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function updateStatusLine() {
  const modeSpan = document.querySelector('.statusline .mode');
  const countSpan = document.querySelector('.statusline .count');
  const statusSpan = document.querySelector('.statusline .status');

  if (modeSpan) modeSpan.textContent = state.mode;
  if (countSpan) {
    const total = state.tasks.length;
    const visible = state.filteredTasks.length;
    countSpan.textContent = `${visible}/${total}`;
  }
  if (statusSpan) {
    statusSpan.textContent = state.search ? `/ ${state.search}` : '';
  }
}

function updateFilterIndicator() {
  const indicator = document.querySelector('.filter-indicator');
  if (!indicator) return;

  if (state.filter) {
    indicator.textContent = `[filtered]`;
    indicator.classList.add('active');
  } else {
    indicator.textContent = '';
    indicator.classList.remove('active');
  }
}
