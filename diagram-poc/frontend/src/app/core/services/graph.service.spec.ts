import { GraphService } from './graph.service';
import { Graph } from '@antv/x6';

describe('GraphService', () => {
  it('is not ready before a graph is set', () => {
    const service = new GraphService();
    expect(service.ready).toBeFalse();
  });

  it('becomes ready once a graph is assigned and disposes it', () => {
    const service = new GraphService();
    const fakeGraph = { dispose: jasmine.createSpy('dispose') } as unknown as Graph;
    service.graph = fakeGraph;
    expect(service.ready).toBeTrue();
    service.dispose();
    expect(fakeGraph.dispose).toHaveBeenCalled();
  });
});
