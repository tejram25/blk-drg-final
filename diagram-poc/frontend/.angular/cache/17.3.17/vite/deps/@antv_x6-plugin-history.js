import {
  Basecoat,
  Graph,
  Model,
  main_exports,
  object_exports
} from "./chunk-XGPRPOXK.js";
import "./chunk-4MWRP73S.js";

// node_modules/@antv/x6-plugin-history/es/api.js
Graph.prototype.isHistoryEnabled = function() {
  const history = this.getPlugin("history");
  if (history) {
    return history.isEnabled();
  }
  return false;
};
Graph.prototype.enableHistory = function() {
  const history = this.getPlugin("history");
  if (history) {
    history.enable();
  }
  return this;
};
Graph.prototype.disableHistory = function() {
  const history = this.getPlugin("history");
  if (history) {
    history.disable();
  }
  return this;
};
Graph.prototype.toggleHistory = function(enabled) {
  const history = this.getPlugin("history");
  if (history) {
    history.toggleEnabled(enabled);
  }
  return this;
};
Graph.prototype.undo = function(options) {
  const history = this.getPlugin("history");
  if (history) {
    history.undo(options);
  }
  return this;
};
Graph.prototype.redo = function(options) {
  const history = this.getPlugin("history");
  if (history) {
    history.redo(options);
  }
  return this;
};
Graph.prototype.undoAndCancel = function(options) {
  const history = this.getPlugin("history");
  if (history) {
    history.cancel(options);
  }
  return this;
};
Graph.prototype.canUndo = function() {
  const history = this.getPlugin("history");
  if (history) {
    return history.canUndo();
  }
  return false;
};
Graph.prototype.canRedo = function() {
  const history = this.getPlugin("history");
  if (history) {
    return history.canRedo();
  }
  return false;
};
Graph.prototype.cleanHistory = function(options) {
  const history = this.getPlugin("history");
  if (history) {
    history.clean(options);
  }
  return this;
};
Graph.prototype.getHistoryStackSize = function() {
  const history = this.getPlugin("history");
  return history.getSize();
};
Graph.prototype.getUndoStackSize = function() {
  const history = this.getPlugin("history");
  return history.getUndoSize();
};
Graph.prototype.getRedoStackSize = function() {
  const history = this.getPlugin("history");
  return history.getRedoSize();
};
Graph.prototype.getUndoRemainSize = function() {
  const history = this.getPlugin("history");
  return history.getUndoRemainSize();
};

// node_modules/@antv/x6-plugin-history/es/index.js
var __decorate = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var History = class _History extends Basecoat {
  constructor(options = {}) {
    super();
    this.name = "history";
    this.batchCommands = null;
    this.batchLevel = 0;
    this.lastBatchIndex = -1;
    this.freezed = false;
    this.stackSize = 0;
    this.handlers = [];
    const { stackSize = 0 } = options;
    this.stackSize = stackSize;
    this.options = Util.getOptions(options);
    this.validator = new _History.Validator({
      history: this,
      cancelInvalid: this.options.cancelInvalid
    });
  }
  init(graph) {
    this.graph = graph;
    this.model = this.graph.model;
    this.clean();
    this.startListening();
  }
  // #region api
  isEnabled() {
    return !this.disabled;
  }
  enable() {
    if (this.disabled) {
      this.options.enabled = true;
    }
  }
  disable() {
    if (!this.disabled) {
      this.options.enabled = false;
    }
  }
  toggleEnabled(enabled) {
    if (enabled != null) {
      if (enabled !== this.isEnabled()) {
        if (enabled) {
          this.enable();
        } else {
          this.disable();
        }
      }
    } else if (this.isEnabled()) {
      this.disable();
    } else {
      this.enable();
    }
    return this;
  }
  undo(options = {}) {
    if (!this.disabled) {
      const cmd = this.undoStack.pop();
      if (cmd) {
        this.revertCommand(cmd, options);
        this.redoStack.push(cmd);
        this.notify("undo", cmd, options);
      }
    }
    return this;
  }
  redo(options = {}) {
    if (!this.disabled) {
      const cmd = this.redoStack.pop();
      if (cmd) {
        this.applyCommand(cmd, options);
        this.undoStackPush(cmd);
        this.notify("redo", cmd, options);
      }
    }
    return this;
  }
  /**
   * Same as `undo()` but does not store the undo-ed command to the
   * `redoStack`. Canceled command therefore cannot be redo-ed.
   */
  cancel(options = {}) {
    if (!this.disabled) {
      const cmd = this.undoStack.pop();
      if (cmd) {
        this.revertCommand(cmd, options);
        this.redoStack = [];
        this.notify("cancel", cmd, options);
      }
    }
    return this;
  }
  getSize() {
    return this.stackSize;
  }
  getUndoRemainSize() {
    const ul = this.undoStack.length;
    return this.stackSize - ul;
  }
  getUndoSize() {
    return this.undoStack.length;
  }
  getRedoSize() {
    return this.redoStack.length;
  }
  canUndo() {
    return !this.disabled && this.undoStack.length > 0;
  }
  canRedo() {
    return !this.disabled && this.redoStack.length > 0;
  }
  clean(options = {}) {
    this.undoStack = [];
    this.redoStack = [];
    this.notify("clean", null, options);
    return this;
  }
  // #endregion
  get disabled() {
    return this.options.enabled !== true;
  }
  validate(events, ...callbacks) {
    this.validator.validate(events, ...callbacks);
    return this;
  }
  startListening() {
    this.model.on("batch:start", this.initBatchCommand, this);
    this.model.on("batch:stop", this.storeBatchCommand, this);
    if (this.options.eventNames) {
      this.options.eventNames.forEach((name, index) => {
        this.handlers[index] = this.addCommand.bind(this, name);
        this.model.on(name, this.handlers[index]);
      });
    }
    this.validator.on("invalid", (args) => this.trigger("invalid", args));
  }
  stopListening() {
    this.model.off("batch:start", this.initBatchCommand, this);
    this.model.off("batch:stop", this.storeBatchCommand, this);
    if (this.options.eventNames) {
      this.options.eventNames.forEach((name, index) => {
        this.model.off(name, this.handlers[index]);
      });
      this.handlers.length = 0;
    }
    this.validator.off("invalid");
  }
  createCommand(options) {
    return {
      batch: options ? options.batch : false,
      data: {}
    };
  }
  revertCommand(cmd, options) {
    this.freezed = true;
    const cmds = Array.isArray(cmd) ? Util.sortBatchCommands(cmd) : [cmd];
    for (let i = cmds.length - 1; i >= 0; i -= 1) {
      const cmd2 = cmds[i];
      const localOptions = Object.assign(Object.assign({}, options), object_exports.pick(cmd2.options, this.options.revertOptionsList || []));
      this.executeCommand(cmd2, true, localOptions);
    }
    this.freezed = false;
  }
  applyCommand(cmd, options) {
    this.freezed = true;
    const cmds = Array.isArray(cmd) ? Util.sortBatchCommands(cmd) : [cmd];
    for (let i = 0; i < cmds.length; i += 1) {
      const cmd2 = cmds[i];
      const localOptions = Object.assign(Object.assign({}, options), object_exports.pick(cmd2.options, this.options.applyOptionsList || []));
      this.executeCommand(cmd2, false, localOptions);
    }
    this.freezed = false;
  }
  executeCommand(cmd, revert, options) {
    const model = this.model;
    const cell = model.getCell(cmd.data.id);
    const event = cmd.event;
    if (Util.isAddEvent(event) && revert || Util.isRemoveEvent(event) && !revert) {
      cell && cell.remove(options);
    } else if (Util.isAddEvent(event) && !revert || Util.isRemoveEvent(event) && revert) {
      const data = cmd.data;
      if (data.node) {
        model.addNode(data.props, options);
      } else if (data.edge) {
        model.addEdge(data.props, options);
      }
    } else if (Util.isChangeEvent(event)) {
      const data = cmd.data;
      const key = data.key;
      if (key && cell) {
        const value = revert ? data.prev[key] : data.next[key];
        if (data.key === "attrs") {
          const hasUndefinedAttr = this.ensureUndefinedAttrs(value, revert ? data.next[key] : data.prev[key]);
          if (hasUndefinedAttr) {
            options.dirty = true;
          }
        }
        cell.prop(key, value, options);
      }
    } else {
      const executeCommand = this.options.executeCommand;
      if (executeCommand) {
        main_exports.call(executeCommand, this, cmd, revert, options);
      }
    }
  }
  addCommand(event, args) {
    if (this.freezed || this.disabled) {
      return;
    }
    const eventArgs = args;
    const options = eventArgs.options || {};
    if (options.dryrun) {
      return;
    }
    if (Util.isAddEvent(event) && this.options.ignoreAdd || Util.isRemoveEvent(event) && this.options.ignoreRemove || Util.isChangeEvent(event) && this.options.ignoreChange) {
      return;
    }
    const before = this.options.beforeAddCommand;
    if (before != null && main_exports.call(before, this, event, args) === false) {
      return;
    }
    if (event === "cell:change:*") {
      event = `cell:change:${eventArgs.key}`;
    }
    const cell = eventArgs.cell;
    const isModelChange = Model.isModel(cell);
    let cmd;
    if (this.batchCommands) {
      cmd = this.batchCommands[Math.max(this.lastBatchIndex, 0)];
      const diffId = isModelChange && !cmd.modelChange || cmd.data.id !== cell.id;
      const diffName = cmd.event !== event;
      if (this.lastBatchIndex >= 0 && (diffId || diffName)) {
        const index = this.batchCommands.findIndex((cmd2) => (isModelChange && cmd2.modelChange || cmd2.data.id === cell.id) && cmd2.event === event);
        if (index < 0 || Util.isAddEvent(event) || Util.isRemoveEvent(event)) {
          cmd = this.createCommand({ batch: true });
        } else {
          cmd = this.batchCommands[index];
          this.batchCommands.splice(index, 1);
        }
        this.batchCommands.push(cmd);
        this.lastBatchIndex = this.batchCommands.length - 1;
      }
    } else {
      cmd = this.createCommand({ batch: false });
    }
    if (Util.isAddEvent(event) || Util.isRemoveEvent(event)) {
      const data = cmd.data;
      cmd.event = event;
      cmd.options = options;
      data.id = cell.id;
      data.props = object_exports.cloneDeep(cell.toJSON());
      if (cell.isEdge()) {
        data.edge = true;
      } else if (cell.isNode()) {
        data.node = true;
      }
      return this.push(cmd, options);
    }
    if (Util.isChangeEvent(event)) {
      const key = args.key;
      const data = cmd.data;
      if (!cmd.batch || !cmd.event) {
        cmd.event = event;
        cmd.options = options;
        data.key = key;
        if (data.prev == null) {
          data.prev = {};
        }
        data.prev[key] = object_exports.cloneDeep(cell.previous(key));
        if (isModelChange) {
          cmd.modelChange = true;
        } else {
          data.id = cell.id;
        }
      }
      if (data.next == null) {
        data.next = {};
      }
      data.next[key] = object_exports.cloneDeep(cell.prop(key));
      return this.push(cmd, options);
    }
    const afterAddCommand = this.options.afterAddCommand;
    if (afterAddCommand) {
      main_exports.call(afterAddCommand, this, event, args, cmd);
    }
    this.push(cmd, options);
  }
  /**
   * Gather multiple changes into a single command. These commands could
   * be reverted with single `undo()` call. From the moment the function
   * is called every change made on model is not stored into the undoStack.
   * Changes are temporarily kept until `storeBatchCommand()` is called.
   */
  // eslint-disable-next-line
  initBatchCommand(options) {
    if (this.freezed) {
      return;
    }
    if (this.batchCommands) {
      this.batchLevel += 1;
    } else {
      this.batchCommands = [this.createCommand({ batch: true })];
      this.batchLevel = 0;
      this.lastBatchIndex = -1;
    }
  }
  /**
   * Store changes temporarily kept in the undoStack. You have to call this
   * function as many times as `initBatchCommand()` been called.
   */
  storeBatchCommand(options) {
    if (this.freezed) {
      return;
    }
    if (this.batchCommands && this.batchLevel <= 0) {
      const cmds = this.filterBatchCommand(this.batchCommands);
      if (cmds.length > 0) {
        this.redoStack = [];
        this.undoStackPush(cmds);
        this.consolidateCommands();
        this.notify("add", cmds, options);
      }
      this.batchCommands = null;
      this.lastBatchIndex = -1;
      this.batchLevel = 0;
    } else if (this.batchCommands && this.batchLevel > 0) {
      this.batchLevel -= 1;
    }
  }
  filterBatchCommand(batchCommands) {
    let cmds = batchCommands.slice();
    const result = [];
    while (cmds.length > 0) {
      const cmd = cmds.shift();
      const evt = cmd.event;
      const id = cmd.data.id;
      if (evt != null && (id != null || cmd.modelChange)) {
        if (Util.isAddEvent(evt)) {
          const index = cmds.findIndex((c) => Util.isRemoveEvent(c.event) && c.data.id === id);
          if (index >= 0) {
            cmds = cmds.filter((c, i) => index < i || c.data.id !== id);
            continue;
          }
        } else if (Util.isRemoveEvent(evt)) {
          const index = cmds.findIndex((c) => Util.isAddEvent(c.event) && c.data.id === id);
          if (index >= 0) {
            cmds.splice(index, 1);
            continue;
          }
        } else if (Util.isChangeEvent(evt)) {
          const data = cmd.data;
          if (object_exports.isEqual(data.prev, data.next)) {
            continue;
          }
        } else {
        }
        result.push(cmd);
      }
    }
    return result;
  }
  notify(event, cmd, options) {
    const cmds = cmd == null ? null : Array.isArray(cmd) ? cmd : [cmd];
    this.emit(event, { cmds, options });
    this.graph.trigger(`history:${event}`, { cmds, options });
    this.emit("change", { cmds, options });
    this.graph.trigger("history:change", { cmds, options });
  }
  push(cmd, options) {
    this.redoStack = [];
    if (cmd.batch) {
      this.lastBatchIndex = Math.max(this.lastBatchIndex, 0);
      this.emit("batch", { cmd, options });
    } else {
      this.undoStackPush(cmd);
      this.consolidateCommands();
      this.notify("add", cmd, options);
    }
  }
  /**
   * Conditionally combine multiple undo items into one.
   *
   * Currently this is only used combine a `cell:changed:position` event
   * followed by multiple `cell:change:parent` and `cell:change:children`
   * events, such that a "move + embed" action can be undone in one step.
   *
   * See https://github.com/antvis/X6/issues/2421
   *
   * This is an ugly WORKAROUND. It does not solve deficiencies in the batch
   * system itself.
   */
  consolidateCommands() {
    var _a;
    const lastCommandGroup = this.undoStack[this.undoStack.length - 1];
    const penultimateCommandGroup = this.undoStack[this.undoStack.length - 2];
    if (!Array.isArray(lastCommandGroup)) {
      return;
    }
    const eventTypes = new Set(lastCommandGroup.map((cmd) => cmd.event));
    if (eventTypes.size !== 2 || !eventTypes.has("cell:change:parent") || !eventTypes.has("cell:change:children")) {
      return;
    }
    if (!lastCommandGroup.every((cmd) => {
      var _a2;
      return cmd.batch && ((_a2 = cmd.options) === null || _a2 === void 0 ? void 0 : _a2.ui);
    })) {
      return;
    }
    if (!Array.isArray(penultimateCommandGroup) || penultimateCommandGroup.length !== 1) {
      return;
    }
    const maybePositionChange = penultimateCommandGroup[0];
    if (maybePositionChange.event !== "cell:change:position" || !((_a = maybePositionChange.options) === null || _a === void 0 ? void 0 : _a.ui)) {
      return;
    }
    penultimateCommandGroup.push(...lastCommandGroup);
    this.undoStack.pop();
  }
  undoStackPush(cmd) {
    if (this.stackSize === 0) {
      this.undoStack.push(cmd);
      return;
    }
    if (this.undoStack.length >= this.stackSize) {
      this.undoStack.shift();
    }
    this.undoStack.push(cmd);
  }
  ensureUndefinedAttrs(newAttrs, oldAttrs) {
    let hasUndefinedAttr = false;
    if (newAttrs !== null && oldAttrs !== null && typeof newAttrs === "object" && typeof oldAttrs === "object") {
      Object.keys(oldAttrs).forEach((key) => {
        if (newAttrs[key] === void 0 && oldAttrs[key] !== void 0) {
          newAttrs[key] = void 0;
          hasUndefinedAttr = true;
        } else if (typeof newAttrs[key] === "object" && typeof oldAttrs[key] === "object") {
          hasUndefinedAttr = this.ensureUndefinedAttrs(newAttrs[key], oldAttrs[key]);
        }
      });
    }
    return hasUndefinedAttr;
  }
  dispose() {
    this.validator.dispose();
    this.clean();
    this.stopListening();
    this.off();
  }
};
__decorate([
  Basecoat.dispose()
], History.prototype, "dispose", null);
(function(History2) {
  class Validator extends Basecoat {
    constructor(options) {
      super();
      this.map = {};
      this.command = options.history;
      this.cancelInvalid = options.cancelInvalid !== false;
      this.command.on("add", this.onCommandAdded, this);
    }
    onCommandAdded({ cmds }) {
      return Array.isArray(cmds) ? cmds.every((cmd) => this.isValidCommand(cmd)) : this.isValidCommand(cmds);
    }
    isValidCommand(cmd) {
      if (cmd.options && cmd.options.validation === false) {
        return true;
      }
      const callbacks = cmd.event && this.map[cmd.event] || [];
      let handoverErr = null;
      callbacks.forEach((routes) => {
        let i = 0;
        const rollup = (err) => {
          const fn = routes[i];
          i += 1;
          try {
            if (fn) {
              fn(err, cmd, rollup);
            } else {
              handoverErr = err;
              return;
            }
          } catch (err2) {
            rollup(err2);
          }
        };
        rollup(handoverErr);
      });
      if (handoverErr) {
        if (this.cancelInvalid) {
          this.command.cancel();
        }
        this.emit("invalid", { err: handoverErr });
        return false;
      }
      return true;
    }
    validate(events, ...callbacks) {
      const evts = Array.isArray(events) ? events : events.split(/\s+/);
      callbacks.forEach((callback) => {
        if (typeof callback !== "function") {
          throw new Error(`${evts.join(" ")} requires callback functions.`);
        }
      });
      evts.forEach((event) => {
        if (this.map[event] == null) {
          this.map[event] = [];
        }
        this.map[event].push(callbacks);
      });
      return this;
    }
    dispose() {
      this.command.off("add", this.onCommandAdded, this);
    }
  }
  __decorate([
    Basecoat.dispose()
  ], Validator.prototype, "dispose", null);
  History2.Validator = Validator;
})(History || (History = {}));
var Util;
(function(Util2) {
  function isAddEvent(event) {
    return event === "cell:added";
  }
  Util2.isAddEvent = isAddEvent;
  function isRemoveEvent(event) {
    return event === "cell:removed";
  }
  Util2.isRemoveEvent = isRemoveEvent;
  function isChangeEvent(event) {
    return event != null && event.startsWith("cell:change:");
  }
  Util2.isChangeEvent = isChangeEvent;
  function getOptions(options) {
    const reservedNames = [
      "cell:added",
      "cell:removed",
      "cell:change:*"
    ];
    const batchEvents = ["batch:start", "batch:stop"];
    const eventNames = options.eventNames ? options.eventNames.filter((event) => !(Util2.isChangeEvent(event) || reservedNames.includes(event) || batchEvents.includes(event))) : reservedNames;
    return Object.assign(Object.assign({ enabled: true }, options), { eventNames, applyOptionsList: options.applyOptionsList || ["propertyPath"], revertOptionsList: options.revertOptionsList || ["propertyPath"] });
  }
  Util2.getOptions = getOptions;
  function sortBatchCommands(cmds) {
    const results = [];
    for (let i = 0, ii = cmds.length; i < ii; i += 1) {
      const cmd = cmds[i];
      let index = null;
      if (Util2.isAddEvent(cmd.event)) {
        const id = cmd.data.id;
        for (let j = 0; j < i; j += 1) {
          if (cmds[j].data.id === id) {
            index = j;
            break;
          }
        }
      }
      if (index !== null) {
        results.splice(index, 0, cmd);
      } else {
        results.push(cmd);
      }
    }
    return results;
  }
  Util2.sortBatchCommands = sortBatchCommands;
})(Util || (Util = {}));
export {
  History
};
//# sourceMappingURL=@antv_x6-plugin-history.js.map
