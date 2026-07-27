import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/** A document or dataset held in the external repository, not in this workspace. */
export interface RepositoryHit {
  externalId: string;
  name: string;
  /** Which artefact folder it lands in once linked. */
  kind: 'document' | 'dataset';
  /** Owning system, shown so users know where the file actually lives. */
  source: string;
  updated: string;
  size?: number;
}

export interface RepositorySearchResult {
  /** False while no repository is wired up — the UI says so instead of showing an empty list. */
  connected: boolean;
  hits: RepositoryHit[];
}

/**
 * Search seam for the external document/dataset system.
 *
 * Documents and datasets are not authored here: engineers find them in a
 * separate application and link them onto a project. That system is not
 * integrated yet, so this abstract class is the single thing the rest of the
 * app depends on — mirroring how the backend depends on IntegrationService and
 * swaps its mock for a real Salesforce client without callers changing.
 *
 * To integrate: write an HTTP-backed subclass and swap the provider in
 * app.config.ts. Nothing in the UI needs to move.
 */
export abstract class DocumentRepository {
  abstract search(query: string): Observable<RepositorySearchResult>;
}

/**
 * Default implementation: reports "not connected" rather than inventing
 * results. Users can still upload files themselves in the meantime.
 */
@Injectable()
export class NotConnectedDocumentRepository extends DocumentRepository {
  search(_query: string): Observable<RepositorySearchResult> {
    return of({ connected: false, hits: [] });
  }
}
