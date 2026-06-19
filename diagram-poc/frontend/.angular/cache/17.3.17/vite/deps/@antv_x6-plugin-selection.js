import {
  Basecoat,
  Cell,
  Collection,
  Graph,
  ModifierKey,
  Rectangle,
  View,
  loader_exports,
  main_exports,
  main_exports3 as main_exports2
} from "./chunk-XGPRPOXK.js";
import "./chunk-4MWRP73S.js";

// node_modules/@antv/x6-plugin-selection/es/selection.js
var __decorate = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SelectionImpl = class extends View {
  get graph() {
    return this.options.graph;
  }
  get boxClassName() {
    return this.prefixClassName(Private.classNames.box);
  }
  get $boxes() {
    return main_exports2.children(this.container, this.boxClassName);
  }
  get handleOptions() {
    return this.options;
  }
  constructor(options) {
    super();
    this.options = options;
    if (this.options.model) {
      this.options.collection = this.options.model.collection;
    }
    if (this.options.collection) {
      this.collection = this.options.collection;
    } else {
      this.collection = new Collection([], {
        comparator: Private.depthComparator
      });
      this.options.collection = this.collection;
    }
    this.boxCount = 0;
    this.createContainer();
    this.startListening();
  }
  startListening() {
    const graph = this.graph;
    const collection = this.collection;
    this.delegateEvents({
      [`mousedown .${this.boxClassName}`]: "onSelectionBoxMouseDown",
      [`touchstart .${this.boxClassName}`]: "onSelectionBoxMouseDown"
    }, true);
    graph.on("scale", this.onGraphTransformed, this);
    graph.on("translate", this.onGraphTransformed, this);
    graph.model.on("updated", this.onModelUpdated, this);
    collection.on("added", this.onCellAdded, this);
    collection.on("removed", this.onCellRemoved, this);
    collection.on("reseted", this.onReseted, this);
    collection.on("updated", this.onCollectionUpdated, this);
    collection.on("node:change:position", this.onNodePositionChanged, this);
    collection.on("cell:changed", this.onCellChanged, this);
  }
  stopListening() {
    const graph = this.graph;
    const collection = this.collection;
    this.undelegateEvents();
    graph.off("scale", this.onGraphTransformed, this);
    graph.off("translate", this.onGraphTransformed, this);
    graph.model.off("updated", this.onModelUpdated, this);
    collection.off("added", this.onCellAdded, this);
    collection.off("removed", this.onCellRemoved, this);
    collection.off("reseted", this.onReseted, this);
    collection.off("updated", this.onCollectionUpdated, this);
    collection.off("node:change:position", this.onNodePositionChanged, this);
    collection.off("cell:changed", this.onCellChanged, this);
  }
  onRemove() {
    this.stopListening();
  }
  onGraphTransformed() {
    this.updateSelectionBoxes();
  }
  onCellChanged() {
    this.updateSelectionBoxes();
  }
  onNodePositionChanged({ node, options }) {
    const { showNodeSelectionBox, pointerEvents } = this.options;
    const { ui, selection, translateBy, snapped } = options;
    const allowTranslating = (showNodeSelectionBox !== true || pointerEvents && this.getPointerEventsValue(pointerEvents) === "none") && !this.translating && !selection;
    const translateByUi = ui && translateBy && node.id === translateBy;
    if (allowTranslating && (translateByUi || snapped)) {
      this.translating = true;
      const current = node.position();
      const previous = node.previous("position");
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      if (dx !== 0 || dy !== 0) {
        this.translateSelectedNodes(dx, dy, node, options);
      }
      this.translating = false;
    }
  }
  onModelUpdated({ removed }) {
    if (removed && removed.length) {
      this.unselect(removed);
    }
  }
  isEmpty() {
    return this.length <= 0;
  }
  isSelected(cell) {
    return this.collection.has(cell);
  }
  get length() {
    return this.collection.length;
  }
  get cells() {
    return this.collection.toArray();
  }
  select(cells, options = {}) {
    options.dryrun = true;
    const items = this.filter(Array.isArray(cells) ? cells : [cells]);
    this.collection.add(items, options);
    return this;
  }
  unselect(cells, options = {}) {
    options.dryrun = true;
    this.collection.remove(Array.isArray(cells) ? cells : [cells], options);
    return this;
  }
  reset(cells, options = {}) {
    if (cells) {
      if (options.batch) {
        const filterCells = this.filter(Array.isArray(cells) ? cells : [cells]);
        this.collection.reset(filterCells, Object.assign(Object.assign({}, options), { ui: true }));
        return this;
      }
      const prev = this.cells;
      const next = this.filter(Array.isArray(cells) ? cells : [cells]);
      const prevMap = {};
      const nextMap = {};
      prev.forEach((cell) => prevMap[cell.id] = cell);
      next.forEach((cell) => nextMap[cell.id] = cell);
      const added = [];
      const removed = [];
      next.forEach((cell) => {
        if (!prevMap[cell.id]) {
          added.push(cell);
        }
      });
      prev.forEach((cell) => {
        if (!nextMap[cell.id]) {
          removed.push(cell);
        }
      });
      if (removed.length) {
        this.unselect(removed, Object.assign(Object.assign({}, options), { ui: true }));
      }
      if (added.length) {
        this.select(added, Object.assign(Object.assign({}, options), { ui: true }));
      }
      if (removed.length === 0 && added.length === 0) {
        this.updateContainer();
      }
      return this;
    }
    return this.clean(options);
  }
  clean(options = {}) {
    if (this.length) {
      if (options.batch === false) {
        this.unselect(this.cells, options);
      } else {
        this.collection.reset([], Object.assign(Object.assign({}, options), { ui: true }));
      }
    }
    return this;
  }
  setFilter(filter) {
    this.options.filter = filter;
  }
  setContent(content2) {
    this.options.content = content2;
  }
  startSelecting(evt) {
    evt = this.normalizeEvent(evt);
    this.clean();
    let x;
    let y;
    const graphContainer = this.graph.container;
    if (evt.offsetX != null && evt.offsetY != null && graphContainer.contains(evt.target)) {
      x = evt.offsetX;
      y = evt.offsetY;
    } else {
      const offset = main_exports2.offset(graphContainer);
      const scrollLeft = graphContainer.scrollLeft;
      const scrollTop = graphContainer.scrollTop;
      x = evt.clientX - offset.left + window.pageXOffset + scrollLeft;
      y = evt.clientY - offset.top + window.pageYOffset + scrollTop;
    }
    main_exports2.css(this.container, {
      top: y,
      left: x,
      width: 1,
      height: 1
    });
    this.setEventData(evt, {
      action: "selecting",
      clientX: evt.clientX,
      clientY: evt.clientY,
      offsetX: x,
      offsetY: y,
      scrollerX: 0,
      scrollerY: 0,
      moving: false
    });
    this.delegateDocumentEvents(Private.documentEvents, evt.data);
  }
  filter(cells) {
    const filter = this.options.filter;
    return cells.filter((cell) => {
      if (Array.isArray(filter)) {
        return filter.some((item) => {
          if (typeof item === "string") {
            return cell.shape === item;
          }
          return cell.id === item.id;
        });
      }
      if (typeof filter === "function") {
        return main_exports.call(filter, this.graph, cell);
      }
      return true;
    });
  }
  stopSelecting(evt) {
    const graph = this.graph;
    const eventData = this.getEventData(evt);
    const action = eventData.action;
    switch (action) {
      case "selecting": {
        let width = main_exports2.width(this.container);
        let height = main_exports2.height(this.container);
        const offset = main_exports2.offset(this.container);
        const origin = graph.pageToLocal(offset.left, offset.top);
        const scale = graph.transform.getScale();
        width /= scale.sx;
        height /= scale.sy;
        const rect = new Rectangle(origin.x, origin.y, width, height);
        const cells = this.getCellViewsInArea(rect).map((view) => view.cell);
        this.reset(cells, { batch: true });
        this.hideRubberband();
        break;
      }
      case "translating": {
        const client = graph.snapToGrid(evt.clientX, evt.clientY);
        if (!this.options.following) {
          const data = eventData;
          this.updateSelectedNodesPosition({
            dx: data.clientX - data.originX,
            dy: data.clientY - data.originY
          });
        }
        this.graph.model.stopBatch("move-selection");
        this.notifyBoxEvent("box:mouseup", evt, client.x, client.y);
        break;
      }
      default: {
        this.clean();
        break;
      }
    }
  }
  onMouseUp(evt) {
    const action = this.getEventData(evt).action;
    if (action) {
      this.stopSelecting(evt);
      this.undelegateDocumentEvents();
    }
  }
  onSelectionBoxMouseDown(evt) {
    if (!this.options.following) {
      evt.stopPropagation();
    }
    const e = this.normalizeEvent(evt);
    if (this.options.movable) {
      this.startTranslating(e);
    }
    const activeView = this.getCellViewFromElem(e.target);
    this.setEventData(e, { activeView });
    const client = this.graph.snapToGrid(e.clientX, e.clientY);
    this.notifyBoxEvent("box:mousedown", e, client.x, client.y);
    this.delegateDocumentEvents(Private.documentEvents, e.data);
  }
  startTranslating(evt) {
    this.graph.model.startBatch("move-selection");
    const client = this.graph.snapToGrid(evt.clientX, evt.clientY);
    this.setEventData(evt, {
      action: "translating",
      clientX: client.x,
      clientY: client.y,
      originX: client.x,
      originY: client.y
    });
  }
  getRestrictArea() {
    const restrict = this.graph.options.translating.restrict;
    const area = typeof restrict === "function" ? main_exports.call(restrict, this.graph, null) : restrict;
    if (typeof area === "number") {
      return this.graph.transform.getGraphArea().inflate(area);
    }
    if (area === true) {
      return this.graph.transform.getGraphArea();
    }
    return area || null;
  }
  getSelectionOffset(client, data) {
    let dx = client.x - data.clientX;
    let dy = client.y - data.clientY;
    const restrict = this.getRestrictArea();
    if (restrict) {
      const cells = this.collection.toArray();
      const totalBBox = Cell.getCellsBBox(cells, { deep: true }) || Rectangle.create();
      const minDx = restrict.x - totalBBox.x;
      const minDy = restrict.y - totalBBox.y;
      const maxDx = restrict.x + restrict.width - (totalBBox.x + totalBBox.width);
      const maxDy = restrict.y + restrict.height - (totalBBox.y + totalBBox.height);
      if (dx < minDx) {
        dx = minDx;
      }
      if (dy < minDy) {
        dy = minDy;
      }
      if (maxDx < dx) {
        dx = maxDx;
      }
      if (maxDy < dy) {
        dy = maxDy;
      }
      if (!this.options.following) {
        const offsetX = client.x - data.originX;
        const offsetY = client.y - data.originY;
        dx = offsetX <= minDx || offsetX >= maxDx ? 0 : dx;
        dy = offsetY <= minDy || offsetY >= maxDy ? 0 : dy;
      }
    }
    return {
      dx,
      dy
    };
  }
  updateElementPosition(elem, dLeft, dTop) {
    const strLeft = main_exports2.css(elem, "left");
    const strTop = main_exports2.css(elem, "top");
    const left = strLeft ? parseFloat(strLeft) : 0;
    const top = strTop ? parseFloat(strTop) : 0;
    main_exports2.css(elem, "left", left + dLeft);
    main_exports2.css(elem, "top", top + dTop);
  }
  updateSelectedNodesPosition(offset) {
    const { dx, dy } = offset;
    if (dx || dy) {
      if (this.translateSelectedNodes(dx, dy), this.boxesUpdated) {
        if (this.collection.length > 1) {
          this.updateSelectionBoxes();
        }
      } else {
        const scale = this.graph.transform.getScale();
        for (let i = 0, $boxes = this.$boxes, len = $boxes.length; i < len; i += 1) {
          this.updateElementPosition($boxes[i], dx * scale.sx, dy * scale.sy);
        }
        this.updateElementPosition(this.selectionContainer, dx * scale.sx, dy * scale.sy);
      }
    }
  }
  autoScrollGraph(x, y) {
    const scroller = this.graph.getPlugin("scroller");
    if (scroller) {
      return scroller.autoScroll(x, y);
    }
    return { scrollerX: 0, scrollerY: 0 };
  }
  adjustSelection(evt) {
    const e = this.normalizeEvent(evt);
    const eventData = this.getEventData(e);
    const action = eventData.action;
    switch (action) {
      case "selecting": {
        const data = eventData;
        if (data.moving !== true) {
          main_exports2.appendTo(this.container, this.graph.container);
          this.showRubberband();
          data.moving = true;
        }
        const { scrollerX, scrollerY } = this.autoScrollGraph(e.clientX, e.clientY);
        data.scrollerX += scrollerX;
        data.scrollerY += scrollerY;
        const dx = e.clientX - data.clientX + data.scrollerX;
        const dy = e.clientY - data.clientY + data.scrollerY;
        const left = parseInt(main_exports2.css(this.container, "left") || "0", 10);
        const top = parseInt(main_exports2.css(this.container, "top") || "0", 10);
        main_exports2.css(this.container, {
          left: dx < 0 ? data.offsetX + dx : left,
          top: dy < 0 ? data.offsetY + dy : top,
          width: Math.abs(dx),
          height: Math.abs(dy)
        });
        break;
      }
      case "translating": {
        const client = this.graph.snapToGrid(e.clientX, e.clientY);
        const data = eventData;
        const offset = this.getSelectionOffset(client, data);
        if (this.options.following) {
          this.updateSelectedNodesPosition(offset);
        } else {
          this.updateContainerPosition(offset);
        }
        if (offset.dx) {
          data.clientX = client.x;
        }
        if (offset.dy) {
          data.clientY = client.y;
        }
        this.notifyBoxEvent("box:mousemove", evt, client.x, client.y);
        break;
      }
      default:
        break;
    }
    this.boxesUpdated = false;
  }
  translateSelectedNodes(dx, dy, exclude, otherOptions) {
    const map = {};
    const excluded = [];
    if (exclude) {
      map[exclude.id] = true;
    }
    this.collection.toArray().forEach((cell) => {
      cell.getDescendants({ deep: true }).forEach((child) => {
        map[child.id] = true;
      });
    });
    if (otherOptions && otherOptions.translateBy) {
      const currentCell = this.graph.getCellById(otherOptions.translateBy);
      if (currentCell) {
        map[currentCell.id] = true;
        currentCell.getDescendants({ deep: true }).forEach((child) => {
          map[child.id] = true;
        });
        excluded.push(currentCell);
      }
    }
    this.collection.toArray().forEach((cell) => {
      if (!map[cell.id]) {
        const options = Object.assign(Object.assign({}, otherOptions), { selection: this.cid, exclude: excluded });
        cell.translate(dx, dy, options);
        this.graph.model.getConnectedEdges(cell).forEach((edge) => {
          if (!map[edge.id]) {
            edge.translate(dx, dy, options);
            map[edge.id] = true;
          }
        });
      }
    });
  }
  getCellViewsInArea(rect) {
    const graph = this.graph;
    const options = {
      strict: this.options.strict
    };
    let views = [];
    if (this.options.rubberNode) {
      views = views.concat(graph.model.getNodesInArea(rect, options).map((node) => graph.renderer.findViewByCell(node)).filter((view) => view != null));
    }
    if (this.options.rubberEdge) {
      views = views.concat(graph.model.getEdgesInArea(rect, options).map((edge) => graph.renderer.findViewByCell(edge)).filter((view) => view != null));
    }
    return views;
  }
  notifyBoxEvent(name, e, x, y) {
    const data = this.getEventData(e);
    const view = data.activeView;
    this.trigger(name, { e, view, x, y, cell: view.cell });
  }
  getSelectedClassName(cell) {
    return this.prefixClassName(`${cell.isNode() ? "node" : "edge"}-selected`);
  }
  addCellSelectedClassName(cell) {
    const view = this.graph.renderer.findViewByCell(cell);
    if (view) {
      view.addClass(this.getSelectedClassName(cell));
    }
  }
  removeCellUnSelectedClassName(cell) {
    const view = this.graph.renderer.findViewByCell(cell);
    if (view) {
      view.removeClass(this.getSelectedClassName(cell));
    }
  }
  destroySelectionBox(cell) {
    this.removeCellUnSelectedClassName(cell);
    if (this.canShowSelectionBox(cell)) {
      main_exports2.remove(this.container.querySelector(`[data-cell-id="${cell.id}"]`));
      if (this.$boxes.length === 0) {
        this.hide();
      }
      this.boxCount = Math.max(0, this.boxCount - 1);
    }
  }
  destroyAllSelectionBoxes(cells) {
    cells.forEach((cell) => this.removeCellUnSelectedClassName(cell));
    this.hide();
    main_exports2.remove(this.$boxes);
    this.boxCount = 0;
  }
  hide() {
    main_exports2.removeClass(this.container, this.prefixClassName(Private.classNames.rubberband));
    main_exports2.removeClass(this.container, this.prefixClassName(Private.classNames.selected));
  }
  showRubberband() {
    main_exports2.addClass(this.container, this.prefixClassName(Private.classNames.rubberband));
  }
  hideRubberband() {
    main_exports2.removeClass(this.container, this.prefixClassName(Private.classNames.rubberband));
  }
  showSelected() {
    main_exports2.removeAttribute(this.container, "style");
    main_exports2.addClass(this.container, this.prefixClassName(Private.classNames.selected));
  }
  createContainer() {
    this.container = document.createElement("div");
    main_exports2.addClass(this.container, this.prefixClassName(Private.classNames.root));
    if (this.options.className) {
      main_exports2.addClass(this.container, this.options.className);
    }
    this.selectionContainer = document.createElement("div");
    main_exports2.addClass(this.selectionContainer, this.prefixClassName(Private.classNames.inner));
    this.selectionContent = document.createElement("div");
    main_exports2.addClass(this.selectionContent, this.prefixClassName(Private.classNames.content));
    main_exports2.append(this.selectionContainer, this.selectionContent);
    main_exports2.attr(this.selectionContainer, "data-selection-length", this.collection.length);
    main_exports2.prepend(this.container, this.selectionContainer);
  }
  updateContainerPosition(offset) {
    if (offset.dx || offset.dy) {
      this.updateElementPosition(this.selectionContainer, offset.dx, offset.dy);
    }
  }
  updateContainer() {
    const origin = { x: Infinity, y: Infinity };
    const corner = { x: 0, y: 0 };
    const cells = this.collection.toArray().filter((cell) => this.canShowSelectionBox(cell));
    cells.forEach((cell) => {
      const view = this.graph.renderer.findViewByCell(cell);
      if (view) {
        const bbox = view.getBBox({
          useCellGeometry: true
        });
        origin.x = Math.min(origin.x, bbox.x);
        origin.y = Math.min(origin.y, bbox.y);
        corner.x = Math.max(corner.x, bbox.x + bbox.width);
        corner.y = Math.max(corner.y, bbox.y + bbox.height);
      }
    });
    main_exports2.css(this.selectionContainer, {
      position: "absolute",
      pointerEvents: "none",
      left: origin.x,
      top: origin.y,
      width: corner.x - origin.x,
      height: corner.y - origin.y
    });
    main_exports2.attr(this.selectionContainer, "data-selection-length", this.collection.length);
    const boxContent = this.options.content;
    if (boxContent) {
      if (typeof boxContent === "function") {
        const content2 = main_exports.call(boxContent, this.graph, this, this.selectionContent);
        if (content2) {
          this.selectionContent.innerHTML = content2;
        }
      } else {
        this.selectionContent.innerHTML = boxContent;
      }
    }
    if (this.collection.length > 0 && !this.container.parentNode) {
      main_exports2.appendTo(this.container, this.graph.container);
    } else if (this.collection.length <= 0 && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
  canShowSelectionBox(cell) {
    return cell.isNode() && this.options.showNodeSelectionBox === true || cell.isEdge() && this.options.showEdgeSelectionBox === true;
  }
  getPointerEventsValue(pointerEvents) {
    return typeof pointerEvents === "string" ? pointerEvents : pointerEvents(this.cells);
  }
  createSelectionBox(cell) {
    this.addCellSelectedClassName(cell);
    if (this.canShowSelectionBox(cell)) {
      const view = this.graph.renderer.findViewByCell(cell);
      if (view) {
        const bbox = view.getBBox({
          useCellGeometry: true
        });
        const className = this.boxClassName;
        const box = document.createElement("div");
        const pointerEvents = this.options.pointerEvents;
        main_exports2.addClass(box, className);
        main_exports2.addClass(box, `${className}-${cell.isNode() ? "node" : "edge"}`);
        main_exports2.attr(box, "data-cell-id", cell.id);
        main_exports2.css(box, {
          position: "absolute",
          left: bbox.x,
          top: bbox.y,
          width: bbox.width,
          height: bbox.height,
          pointerEvents: pointerEvents ? this.getPointerEventsValue(pointerEvents) : "auto"
        });
        main_exports2.appendTo(box, this.container);
        this.showSelected();
        this.boxCount += 1;
      }
    }
  }
  updateSelectionBoxes() {
    if (this.collection.length > 0) {
      this.boxesUpdated = true;
      this.confirmUpdate();
    }
  }
  confirmUpdate() {
    if (this.boxCount) {
      this.hide();
      for (let i = 0, $boxes = this.$boxes, len = $boxes.length; i < len; i += 1) {
        const box = $boxes[i];
        const cellId = main_exports2.attr(box, "data-cell-id");
        main_exports2.remove(box);
        this.boxCount -= 1;
        const cell = this.collection.get(cellId);
        if (cell) {
          this.createSelectionBox(cell);
        }
      }
      this.updateContainer();
    }
    return 0;
  }
  getCellViewFromElem(elem) {
    const id = elem.getAttribute("data-cell-id");
    if (id) {
      const cell = this.collection.get(id);
      if (cell) {
        return this.graph.renderer.findViewByCell(cell);
      }
    }
    return null;
  }
  onCellRemoved({ cell }) {
    this.destroySelectionBox(cell);
    this.updateContainer();
  }
  onReseted({ previous, current }) {
    this.destroyAllSelectionBoxes(previous);
    current.forEach((cell) => {
      this.listenCellRemoveEvent(cell);
      this.createSelectionBox(cell);
    });
    this.updateContainer();
  }
  onCellAdded({ cell }) {
    this.listenCellRemoveEvent(cell);
    this.createSelectionBox(cell);
    this.updateContainer();
  }
  listenCellRemoveEvent(cell) {
    cell.off("removed", this.onCellRemoved, this);
    cell.on("removed", this.onCellRemoved, this);
  }
  onCollectionUpdated({ added, removed, options }) {
    added.forEach((cell) => {
      this.trigger("cell:selected", { cell, options });
      if (cell.isNode()) {
        this.trigger("node:selected", { cell, options, node: cell });
      } else if (cell.isEdge()) {
        this.trigger("edge:selected", { cell, options, edge: cell });
      }
    });
    removed.forEach((cell) => {
      this.trigger("cell:unselected", { cell, options });
      if (cell.isNode()) {
        this.trigger("node:unselected", { cell, options, node: cell });
      } else if (cell.isEdge()) {
        this.trigger("edge:unselected", { cell, options, edge: cell });
      }
    });
    const args = {
      added,
      removed,
      options,
      selected: this.cells.filter((cell) => !!this.graph.getCellById(cell.id))
    };
    this.trigger("selection:changed", args);
  }
  // #endregion
  dispose() {
    this.clean();
    this.remove();
    this.off();
  }
};
__decorate([
  View.dispose()
], SelectionImpl.prototype, "dispose", null);
var Private;
(function(Private2) {
  const base = "widget-selection";
  Private2.classNames = {
    root: base,
    inner: `${base}-inner`,
    box: `${base}-box`,
    content: `${base}-content`,
    rubberband: `${base}-rubberband`,
    selected: `${base}-selected`
  };
  Private2.documentEvents = {
    mousemove: "adjustSelection",
    touchmove: "adjustSelection",
    mouseup: "onMouseUp",
    touchend: "onMouseUp",
    touchcancel: "onMouseUp"
  };
  function depthComparator(cell) {
    return cell.getAncestors().length;
  }
  Private2.depthComparator = depthComparator;
})(Private || (Private = {}));

// node_modules/@antv/x6-plugin-selection/es/style/raw.js
var content = `.x6-widget-selection {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: 0;
  height: 0;
  touch-action: none;
}
.x6-widget-selection-rubberband {
  display: block;
  overflow: visible;
  opacity: 0.3;
}
.x6-widget-selection-selected {
  display: block;
}
.x6-widget-selection-box {
  cursor: move;
}
.x6-widget-selection-inner[data-selection-length='0'],
.x6-widget-selection-inner[data-selection-length='1'] {
  display: none;
}
.x6-widget-selection-content {
  position: absolute;
  top: 100%;
  right: -20px;
  left: -20px;
  margin-top: 30px;
  padding: 6px;
  line-height: 14px;
  text-align: center;
  border-radius: 6px;
}
.x6-widget-selection-content:empty {
  display: none;
}
.x6-widget-selection-rubberband {
  background-color: #3498db;
  border: 2px solid #2980b9;
}
.x6-widget-selection-box {
  box-sizing: content-box !important;
  margin-top: -4px;
  margin-left: -4px;
  padding-right: 4px;
  padding-bottom: 4px;
  border: 2px dashed #feb663;
  box-shadow: 2px 2px 5px #d3d3d3;
}
.x6-widget-selection-inner {
  box-sizing: content-box !important;
  margin-top: -8px;
  margin-left: -8px;
  padding-right: 12px;
  padding-bottom: 12px;
  border: 2px solid #feb663;
  box-shadow: 2px 2px 5px #d3d3d3;
}
.x6-widget-selection-content {
  color: #fff;
  font-size: 10px;
  background-color: #6a6b8a;
}
`;

// node_modules/@antv/x6-plugin-selection/es/api.js
Graph.prototype.isSelectionEnabled = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isEnabled();
  }
  return false;
};
Graph.prototype.enableSelection = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.enable();
  }
  return this;
};
Graph.prototype.disableSelection = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.disable();
  }
  return this;
};
Graph.prototype.toggleSelection = function(enabled) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.toggleEnabled(enabled);
  }
  return this;
};
Graph.prototype.isMultipleSelection = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isMultipleSelection();
  }
  return false;
};
Graph.prototype.enableMultipleSelection = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.enableMultipleSelection();
  }
  return this;
};
Graph.prototype.disableMultipleSelection = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.disableMultipleSelection();
  }
  return this;
};
Graph.prototype.toggleMultipleSelection = function(multiple) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.toggleMultipleSelection(multiple);
  }
  return this;
};
Graph.prototype.isSelectionMovable = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isSelectionMovable();
  }
  return false;
};
Graph.prototype.enableSelectionMovable = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.enableSelectionMovable();
  }
  return this;
};
Graph.prototype.disableSelectionMovable = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.disableSelectionMovable();
  }
  return this;
};
Graph.prototype.toggleSelectionMovable = function(movable) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.toggleSelectionMovable(movable);
  }
  return this;
};
Graph.prototype.isRubberbandEnabled = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isRubberbandEnabled();
  }
  return false;
};
Graph.prototype.enableRubberband = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.enableRubberband();
  }
  return this;
};
Graph.prototype.disableRubberband = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.disableRubberband();
  }
  return this;
};
Graph.prototype.toggleRubberband = function(enabled) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.toggleRubberband(enabled);
  }
  return this;
};
Graph.prototype.isStrictRubberband = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isStrictRubberband();
  }
  return false;
};
Graph.prototype.enableStrictRubberband = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.enableStrictRubberband();
  }
  return this;
};
Graph.prototype.disableStrictRubberband = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.disableStrictRubberband();
  }
  return this;
};
Graph.prototype.toggleStrictRubberband = function(strict) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.toggleStrictRubberband(strict);
  }
  return this;
};
Graph.prototype.setRubberbandModifiers = function(modifiers) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.setRubberbandModifiers(modifiers);
  }
  return this;
};
Graph.prototype.setSelectionFilter = function(filter) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.setSelectionFilter(filter);
  }
  return this;
};
Graph.prototype.setSelectionDisplayContent = function(content2) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.setSelectionDisplayContent(content2);
  }
  return this;
};
Graph.prototype.isSelectionEmpty = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isEmpty();
  }
  return true;
};
Graph.prototype.cleanSelection = function(options) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.clean(options);
  }
  return this;
};
Graph.prototype.resetSelection = function(cells, options) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.reset(cells, options);
  }
  return this;
};
Graph.prototype.getSelectedCells = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.getSelectedCells();
  }
  return [];
};
Graph.prototype.getSelectedCellCount = function() {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.getSelectedCellCount();
  }
  return 0;
};
Graph.prototype.isSelected = function(cell) {
  const selection = this.getPlugin("selection");
  if (selection) {
    return selection.isSelected(cell);
  }
  return false;
};
Graph.prototype.select = function(cells, options) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.select(cells, options);
  }
  return this;
};
Graph.prototype.unselect = function(cells, options) {
  const selection = this.getPlugin("selection");
  if (selection) {
    selection.unselect(cells, options);
  }
  return this;
};

// node_modules/@antv/x6-plugin-selection/es/index.js
var __decorate2 = function(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var Selection = class _Selection extends Basecoat {
  get rubberbandDisabled() {
    return this.options.enabled !== true || this.options.rubberband !== true;
  }
  get disabled() {
    return this.options.enabled !== true;
  }
  get length() {
    return this.selectionImpl.length;
  }
  get cells() {
    return this.selectionImpl.cells;
  }
  constructor(options = {}) {
    super();
    this.name = "selection";
    this.movedMap = /* @__PURE__ */ new WeakMap();
    this.unselectMap = /* @__PURE__ */ new WeakMap();
    this.options = Object.assign(Object.assign({ enabled: true }, _Selection.defaultOptions), options);
    loader_exports.ensure(this.name, content);
  }
  init(graph) {
    this.graph = graph;
    this.selectionImpl = new SelectionImpl(Object.assign(Object.assign({}, this.options), { graph }));
    this.setup();
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
  isMultipleSelection() {
    return this.isMultiple();
  }
  enableMultipleSelection() {
    this.enableMultiple();
    return this;
  }
  disableMultipleSelection() {
    this.disableMultiple();
    return this;
  }
  toggleMultipleSelection(multiple) {
    if (multiple != null) {
      if (multiple !== this.isMultipleSelection()) {
        if (multiple) {
          this.enableMultipleSelection();
        } else {
          this.disableMultipleSelection();
        }
      }
    } else if (this.isMultipleSelection()) {
      this.disableMultipleSelection();
    } else {
      this.enableMultipleSelection();
    }
    return this;
  }
  isSelectionMovable() {
    return this.options.movable !== false;
  }
  enableSelectionMovable() {
    this.selectionImpl.options.movable = true;
    return this;
  }
  disableSelectionMovable() {
    this.selectionImpl.options.movable = false;
    return this;
  }
  toggleSelectionMovable(movable) {
    if (movable != null) {
      if (movable !== this.isSelectionMovable()) {
        if (movable) {
          this.enableSelectionMovable();
        } else {
          this.disableSelectionMovable();
        }
      }
    } else if (this.isSelectionMovable()) {
      this.disableSelectionMovable();
    } else {
      this.enableSelectionMovable();
    }
    return this;
  }
  isRubberbandEnabled() {
    return !this.rubberbandDisabled;
  }
  enableRubberband() {
    if (this.rubberbandDisabled) {
      this.options.rubberband = true;
    }
    return this;
  }
  disableRubberband() {
    if (!this.rubberbandDisabled) {
      this.options.rubberband = false;
    }
    return this;
  }
  toggleRubberband(enabled) {
    if (enabled != null) {
      if (enabled !== this.isRubberbandEnabled()) {
        if (enabled) {
          this.enableRubberband();
        } else {
          this.disableRubberband();
        }
      }
    } else if (this.isRubberbandEnabled()) {
      this.disableRubberband();
    } else {
      this.enableRubberband();
    }
    return this;
  }
  isStrictRubberband() {
    return this.selectionImpl.options.strict === true;
  }
  enableStrictRubberband() {
    this.selectionImpl.options.strict = true;
    return this;
  }
  disableStrictRubberband() {
    this.selectionImpl.options.strict = false;
    return this;
  }
  toggleStrictRubberband(strict) {
    if (strict != null) {
      if (strict !== this.isStrictRubberband()) {
        if (strict) {
          this.enableStrictRubberband();
        } else {
          this.disableStrictRubberband();
        }
      }
    } else if (this.isStrictRubberband()) {
      this.disableStrictRubberband();
    } else {
      this.enableStrictRubberband();
    }
    return this;
  }
  setRubberbandModifiers(modifiers) {
    this.setModifiers(modifiers);
  }
  setSelectionFilter(filter) {
    this.setFilter(filter);
    return this;
  }
  setSelectionDisplayContent(content2) {
    this.setContent(content2);
    return this;
  }
  isEmpty() {
    return this.length <= 0;
  }
  clean(options = {}) {
    this.selectionImpl.clean(options);
    return this;
  }
  reset(cells, options = {}) {
    this.selectionImpl.reset(cells ? this.getCells(cells) : [], options);
    return this;
  }
  getSelectedCells() {
    return this.cells;
  }
  getSelectedCellCount() {
    return this.length;
  }
  isSelected(cell) {
    return this.selectionImpl.isSelected(cell);
  }
  select(cells, options = {}) {
    const selected = this.getCells(cells);
    if (selected.length) {
      if (this.isMultiple()) {
        this.selectionImpl.select(selected, options);
      } else {
        this.reset(selected.slice(0, 1), options);
      }
    }
    return this;
  }
  unselect(cells, options = {}) {
    this.selectionImpl.unselect(this.getCells(cells), options);
    return this;
  }
  // #endregion
  setup() {
    this.selectionImpl.on("*", (name, args) => {
      this.trigger(name, args);
      this.graph.trigger(name, args);
    });
  }
  startListening() {
    this.graph.on("blank:mousedown", this.onBlankMouseDown, this);
    this.graph.on("blank:click", this.onBlankClick, this);
    this.graph.on("cell:mousemove", this.onCellMouseMove, this);
    this.graph.on("cell:mouseup", this.onCellMouseUp, this);
    this.selectionImpl.on("box:mousedown", this.onBoxMouseDown, this);
  }
  stopListening() {
    this.graph.off("blank:mousedown", this.onBlankMouseDown, this);
    this.graph.off("blank:click", this.onBlankClick, this);
    this.graph.off("cell:mousemove", this.onCellMouseMove, this);
    this.graph.off("cell:mouseup", this.onCellMouseUp, this);
    this.selectionImpl.off("box:mousedown", this.onBoxMouseDown, this);
  }
  onBlankMouseDown({ e }) {
    if (!this.allowBlankMouseDown(e)) {
      return;
    }
    const allowGraphPanning = this.graph.panning.allowPanning(e, true);
    const scroller = this.graph.getPlugin("scroller");
    const allowScrollerPanning = scroller && scroller.allowPanning(e, true);
    if (this.allowRubberband(e, true) || this.allowRubberband(e) && !allowScrollerPanning && !allowGraphPanning) {
      this.startRubberband(e);
    }
  }
  allowBlankMouseDown(e) {
    const eventTypes = this.options.eventTypes;
    return (eventTypes === null || eventTypes === void 0 ? void 0 : eventTypes.includes("leftMouseDown")) && e.button === 0 || (eventTypes === null || eventTypes === void 0 ? void 0 : eventTypes.includes("mouseWheelDown")) && e.button === 1;
  }
  onBlankClick() {
    this.clean();
  }
  allowRubberband(e, strict) {
    return !this.rubberbandDisabled && ModifierKey.isMatch(e, this.options.modifiers, strict);
  }
  allowMultipleSelection(e) {
    return this.isMultiple() && ModifierKey.isMatch(e, this.options.multipleSelectionModifiers);
  }
  onCellMouseMove({ cell }) {
    this.movedMap.set(cell, true);
  }
  onCellMouseUp({ e, cell }) {
    const options = this.options;
    let disabled = this.disabled;
    if (!disabled && this.movedMap.has(cell)) {
      disabled = options.selectCellOnMoved === false;
      if (!disabled) {
        disabled = options.selectNodeOnMoved === false && cell.isNode();
      }
      if (!disabled) {
        disabled = options.selectEdgeOnMoved === false && cell.isEdge();
      }
    }
    if (!disabled) {
      if (!this.allowMultipleSelection(e)) {
        this.reset(cell);
      } else if (this.unselectMap.has(cell)) {
        this.unselectMap.delete(cell);
      } else if (this.isSelected(cell)) {
        this.unselect(cell);
      } else {
        this.select(cell);
      }
    }
    this.movedMap.delete(cell);
  }
  onBoxMouseDown({ e, cell }) {
    if (!this.disabled) {
      if (this.allowMultipleSelection(e)) {
        this.unselect(cell);
        this.unselectMap.set(cell, true);
      }
    }
  }
  getCells(cells) {
    return (Array.isArray(cells) ? cells : [cells]).map((cell) => typeof cell === "string" ? this.graph.getCellById(cell) : cell).filter((cell) => cell != null);
  }
  startRubberband(e) {
    if (!this.rubberbandDisabled) {
      this.selectionImpl.startSelecting(e);
    }
    return this;
  }
  isMultiple() {
    return this.options.multiple !== false;
  }
  enableMultiple() {
    this.options.multiple = true;
    return this;
  }
  disableMultiple() {
    this.options.multiple = false;
    return this;
  }
  setModifiers(modifiers) {
    this.options.modifiers = modifiers;
    return this;
  }
  setContent(content2) {
    this.selectionImpl.setContent(content2);
    return this;
  }
  setFilter(filter) {
    this.selectionImpl.setFilter(filter);
    return this;
  }
  dispose() {
    this.stopListening();
    this.off();
    this.selectionImpl.dispose();
    loader_exports.clean(this.name);
  }
};
__decorate2([
  Basecoat.dispose()
], Selection.prototype, "dispose", null);
(function(Selection2) {
  Selection2.defaultOptions = {
    rubberband: false,
    rubberNode: true,
    rubberEdge: false,
    pointerEvents: "auto",
    multiple: true,
    multipleSelectionModifiers: ["ctrl", "meta"],
    movable: true,
    strict: false,
    selectCellOnMoved: false,
    selectNodeOnMoved: false,
    selectEdgeOnMoved: false,
    following: true,
    content: null,
    eventTypes: ["leftMouseDown", "mouseWheelDown"]
  };
})(Selection || (Selection = {}));
export {
  Selection
};
//# sourceMappingURL=@antv_x6-plugin-selection.js.map
