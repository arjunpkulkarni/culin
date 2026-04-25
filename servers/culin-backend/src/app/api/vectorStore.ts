// Vectorize / RAG disabled for now.
// To re-enable, restore this file from git history and configure
// VECTORIZE_TOKEN in the environment.

export interface SearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
}

class VectorStore {
  async search(
    _query: string,
    _limit: number = 5,
    _filterType?: string
  ): Promise<SearchResult[]> {
    return [];
  }

  async searchReference(
    _query: string,
    _limit: number = 3
  ): Promise<SearchResult[]> {
    return [];
  }
}

export const vectorStore = new VectorStore();
