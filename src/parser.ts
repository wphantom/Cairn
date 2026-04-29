import { Task, Priority } from './types';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_RE = /^\([A-Z]\)$/;

export function parse(text: string): Task[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return lines.map(line => parseLine(line));
}

function parseLine(raw: string): Task {
  let rest = raw;
  let done = false;
  let completionDate: string | null = null;
  let creationDate: string | null = null;
  let priority: Priority | null = null;

  if (rest.startsWith('x ')) {
    done = true;
    rest = rest.slice(2).trim();

    const match = rest.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)/);
    if (match) {
      completionDate = match[1];
      rest = match[2];

      const match2 = rest.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)/);
      if (match2) {
        creationDate = match2[1];
        rest = match2[2];
      }
    }
  } else {
    const prioMatch = rest.match(/^\(([A-Z])\)\s+(.*)/);
    if (prioMatch) {
      priority = prioMatch[1] as Priority;
      rest = prioMatch[2];
    }

    const dateMatch = rest.match(/^(\d{4}-\d{2}-\d{2})\s+(.*)/);
    if (dateMatch) {
      creationDate = dateMatch[1];
      rest = dateMatch[2];
    }
  }

  const projects: string[] = [];
  const contexts: string[] = [];
  const meta: Record<string, string> = {};

  const parts = rest.split(/\s+/);
  for (const part of parts) {
    if (part.startsWith('+')) {
      projects.push(part.slice(1));
    } else if (part.startsWith('@')) {
      contexts.push(part.slice(1));
    } else if (part.includes(':') && !part.includes('://')) {
      const [key, val] = part.split(':');
      if (key && val && !key.includes(' ') && !val.includes(' ')) {
        meta[key] = val;
      }
    }
  }

  if (meta.pri) {
    priority = meta.pri as Priority;
  }

  // Keep description with projects/contexts but remove metadata tags
  const description = rest
    .replace(/\S+:\S+/g, '')
    .trim();

  return {
    raw,
    done,
    priority,
    completionDate,
    creationDate,
    description,
    projects,
    contexts,
    meta,
  };
}

export function serialize(tasks: Task[]): string {
  return tasks.map(serializeTask).join('\n');
}

function serializeTask(task: Task): string {
  if (task.done) {
    let line = 'x';
    if (task.completionDate) line += ` ${task.completionDate}`;
    if (task.creationDate) line += ` ${task.creationDate}`;
    line += ` ${task.description}`;

    for (const [key, val] of Object.entries(task.meta)) {
      if (key !== 'pri') {
        line += ` ${key}:${val}`;
      }
    }

    if (task.priority) {
      line += ` pri:${task.priority}`;
    }

    for (const proj of task.projects) {
      if (!line.includes(`+${proj}`)) line += ` +${proj}`;
    }

    for (const ctx of task.contexts) {
      if (!line.includes(`@${ctx}`)) line += ` @${ctx}`;
    }

    return line.trim();
  } else {
    let line = '';
    if (task.priority) line += `(${task.priority}) `;
    if (task.creationDate) line += `${task.creationDate} `;

    line += task.description;

    for (const proj of task.projects) {
      if (!line.includes(`+${proj}`)) line += ` +${proj}`;
    }

    for (const ctx of task.contexts) {
      if (!line.includes(`@${ctx}`)) line += ` @${ctx}`;
    }

    for (const [key, val] of Object.entries(task.meta)) {
      if (!line.includes(`${key}:${val}`)) line += ` ${key}:${val}`;
    }

    return line.trim();
  }
}
