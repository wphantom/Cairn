export type Priority =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
  | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T'
  | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';

export interface Task {
  raw: string;
  done: boolean;
  priority: Priority | null;
  completionDate: string | null;
  creationDate: string | null;
  description: string;
  projects: string[];
  contexts: string[];
  meta: Record<string, string>;
}

export type Mode = 'NORMAL' | 'INSERT' | 'COMMAND';

export interface Filter {
  must: string[];
  exclude: string[];
}
