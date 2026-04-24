import { Configuration, PipelinesApi, RetrieveDocumentsResponse } from "@vectorize-io/vectorize-client";

export interface SearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number;
}

interface VectorizeDocument {
  id?: string;
  text?: string;
  metadata?: Record<string, any>;
  score?: number;
}

class VectorStore {
  private pipelinesApi: PipelinesApi;
  private organizationId = 'ffc0fef7-9354-4901-88da-6d1d9154c4c9';
  private pipelineId = 'b502ddf8-9717-4941-ad61-868408c21b88';

  constructor() {
    const configuration = new Configuration({
      accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjIxMzkxMTUsImF1ZCI6ImZmYzBmZWY3LTkzNTQtNDkwMS04OGRhLTZkMWQ5MTU0YzRjOSIsInJvbGUiOiJhZG1pbiIsImF1dGhvcml6YXRpb25fZGV0YWlscyI6W3sibmFtZSI6IlJFVFJJRVZBTF9BQ0NFU1NfVE9LRU4iLCJpc1N0YW5kYXJkUm9sZSI6dHJ1ZSwicGVybWlzc2lvbnMiOnsiVmVyc2lvbiI6IjEuMCIsIlN0YXRlbWVudCI6W3siQWN0aW9uIjpbIk9yZzpQaXBlbGluZXM6UmV0cmlldmFsIl0sIlJlc291cmNlIjpbIi9vcmdhbml6YXRpb24vZmZjMGZlZjctOTM1NC00OTAxLTg4ZGEtNmQxZDkxNTRjNGM5Il0sIkVmZmVjdCI6IkFsbG93In1dfX1dLCJleHAiOjE3NjQ3MzExMTUsInN1YiI6Ik15IHRva2VuIn0.d4B_jCez4_tAVckN9q_xHs-q1XDux7wp5W48jqI-59DjExRk5Rxd_m9eDNr9qIDxtTUlbPcrwnDQdmhpDtH4wEm_fBwJuPQpOcJUrkXwrwOJ_HxAFXxxUCE6MYhDMwyASQBOLvndw7nQJ13jiwSMmqhWK4qToPlJpQxcHATQnQa9iyOjH9cKN34xGYfPIG6CQE2boaj_40bLiIxOse31rNNTQXTzEd_h2YlGhj-RI_G_D3OmhNxO2KxUfN-Azi8s_aFczKC-XAuBp79LYz_hTlIgaKGXxUHSOJNIfh2oVslqm0oQ0bUpB2TsBCgNaPJoFf6EEhm30ip6UCvfgakKDA',
      basePath: "https://api.vectorize.io/v1",
    });
    this.pipelinesApi = new PipelinesApi(configuration);
    console.log('🔑 Initialized Vectorize API client');
  }

  async search(query: string, limit: number = 5, filterType?: string): Promise<SearchResult[]> {
    try {
      // console.log('🔍 Vector Store Search Request:', {
      //   query,
      //   limit,
      //   filterType,
      //   organization: this.organizationId,
      //   pipeline: this.pipelineId,
      //   timestamp: new Date().toISOString()
      // });

      let response = await this.pipelinesApi.retrieveDocuments({
        organization: this.organizationId,
        pipeline: this.pipelineId,
        retrieveDocumentsRequest: {
          question: query,
          numResults: limit, // Simplified: using limit directly, removed rerank for now
        }
      });

      const documents = (response as RetrieveDocumentsResponse).documents;
      
      // Log the raw response for debugging
      // console.log('📥 Raw Response:', {
      //   documentCount: documents.length,
      //   firstDocument: documents[0] ? {
      //     id: documents[0].id,
      //     text: documents[0].text?.substring(0, 100) + '...',
      //     score: documents[0].score,
      //     metadata: documents[0].metadata
      //   } : null
      // });

      // Filter results if filterType is provided
      let filteredResults = documents;
      if (filterType) {
        filteredResults = documents.filter(doc => 
          doc.metadata?.type === filterType || 
          doc.metadata?.category === filterType ||
          (doc.text && doc.text.toLowerCase().includes(filterType.toLowerCase()))
        );
      }

      // Sort by score and take the top results
      const results = filteredResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit)
        .map((doc: VectorizeDocument) => ({
          id: doc.id || '',
          text: doc.text || '',
          metadata: doc.metadata || {},
          score: doc.score || 0
        }));

      // console.log('✅ Processed Results:', {
      //   totalDocuments: documents.length,
      //   filteredCount: filteredResults.length,
      //   finalResults: results.length,
      //   topScore: results[0]?.score,
      //   resultTypes: results.map(r => r.metadata?.type || 'unknown')
      // });

      return results;
    } catch (error: any) {
      console.error('❌ Vector Store Search Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data, // Original logging of data
        query,
        filterType,
        timestamp: new Date().toISOString()
      });
      // Add more detailed error logging as in the JS example
      if (error.response && typeof error.response.text === 'function') {
        console.error('📄 API Response Text:', await error.response.text());
      } else if (error.response) {
        console.error('📄 API Response (could not get text):', error.response);
      }
      throw error;
    }
  }

  async searchReference(query: string, limit: number = 3): Promise<SearchResult[]> {
    // Try to get any relevant results first
    const results = await this.search(query, limit * 2);
    
    // Filter for reference-type results if available
    const referenceResults = results.filter(result => 
      result.metadata?.type === 'reference' || 
      result.metadata?.category === 'reference' ||
      result.text.toLowerCase().includes('reference')
    );

    // If we found reference results, return them
    if (referenceResults.length > 0) {
      return referenceResults.slice(0, limit);
    }

    // If no reference results found, return the best matches anyway
    return results.slice(0, limit);
  }
}

export const vectorStore = new VectorStore(); 