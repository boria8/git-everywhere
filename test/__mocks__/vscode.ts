export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showInputBox: async () => undefined,
  showQuickPick: async () => undefined,
  setStatusBarMessage: () => ({ dispose: () => {} }),
  withProgress: async (_opts: unknown, task: (progress: unknown) => Promise<unknown>) => task({ report: () => {} }),
  createTreeView: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (_id: string, _handler: unknown) => ({ dispose: () => {} }),
  executeCommand: async () => undefined,
};

export const env = {
  clipboard: { writeText: async () => {} },
};

export const workspace = {
  workspaceFolders: [],
  onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
};

export const Uri = {
  file: (p: string) => ({ fsPath: p, toString: () => p }),
};

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label: string;
  collapsibleState?: TreeItemCollapsibleState;
  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter<T> {
  event = (listener: (e: T) => void) => { void listener; return { dispose: () => {} }; };
  fire(_e: T) {}
  dispose() {}
}

export const ExtensionContext = {};
