import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';

/**
 * Owns the X6 {@link Graph} instance for the editor. Provided at the editor
 * component level (not root), so each editor instance gets its own graph and
 * its child feature components can obtain the same instance through DI instead
 * of having it threaded down via @Input bindings.
 */
@Injectable()
export class GraphService {
  /** The live graph. Set once the canvas is initialised; undefined before then. */
  graph!: Graph;

  /** True once the graph has been created. */
  get ready(): boolean {
    return this.graph != null;
  }

  /** Tear down the graph (called on editor destroy). */
  dispose(): void {
    if (this.graph) {
      this.graph.dispose();
    }
  }
}
