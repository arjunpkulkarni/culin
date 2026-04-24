import { API_BASE_URL } from '@/src/config/cognito';

interface ChatOptions {
  diagnosticCodes?: string[];
  complexity?: number;
  healthEffectIds?: number[];
}

interface ChatResponse {
  enhancedResponse?: string;
  nutrition?: any;
  instacart?: any;
  [key: string]: any;
}

interface HealthEffect {
  id: number;
  name: string;
  [key: string]: any;
}

interface DiagnosticCode {
  code: string;
  description: string;
  [key: string]: any;
}

interface NutritionGoalsRequest {
  goal: 'cut' | 'maintain' | 'bulk';
  height: number;
  weight: number;
  goalPace?: 'mild' | 'normal' | 'aggressive';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
  heightUnit?: 'cm' | 'in';
  weightUnit?: 'kg' | 'lb';
  age?: number;
  sex?: 'M' | 'F' | 'unknown';
}

interface NutritionGoalsResponse {
  success: boolean;
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    bmr: number;
    tdee: number;
    weightKg: number;
  };
}

/**
 * API Service for CulinAI Backend
 * Handles all communication with the AWS App Runner backend
 */
export class CulinAIApiService {
  private idToken: string;

  constructor(idToken: string) {
    this.idToken = idToken;
  }
  
  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs = 15_000,
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    const config: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${this.idToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timerId);
    }
  }

  /**
   * Chat API - Send a message to the CulinAI assistant
   * @param query The user's message/query
   * @param options Optional parameters (diagnostic codes, complexity, health effects)
   */
  async sendChatMessage(
    query: string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    return this.makeRequest<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        query,
        diagnosticCodes: options.diagnosticCodes || [],
        complexity: options.complexity || 3,
        healthEffectIds: options.healthEffectIds || undefined,
      }),
    });
  }

  /**
   * Health Effects API - Search for health effects
   * @param searchTerm The search term to find health effects
   */
  async searchHealthEffects(searchTerm: string): Promise<HealthEffect[]> {
    const encodedSearch = encodeURIComponent(searchTerm);
    return this.makeRequest<HealthEffect[]>(
      `/api/health-effects?search=${encodedSearch}`
    );
  }

  /**
   * Diagnostic Codes API - Get all diagnostic codes
   */
  async getAllDiagnosticCodes(): Promise<DiagnosticCode[]> {
    return this.makeRequest<DiagnosticCode[]>('/api/all-diagnostic-codes');
  }

  
  async saveUserProfile(profileData: any): Promise<any> {
    return this.makeRequest('/api/user/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  
  async getUserProfile(): Promise<any> {
    return this.makeRequest('/api/user/profile');
  }

  /**
   * Update user profile on backend (if your API supports this)
   */
  async updateUserProfile(profileData: any): Promise<any> {
    return this.makeRequest('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  /**
   * Get Nutrition Goals - Calculate daily macro targets
   * Uses Mifflin-St Jeor BMR algorithm
   */
  async getNutritionGoals(params: NutritionGoalsRequest): Promise<NutritionGoalsResponse> {
    return this.makeRequest<NutritionGoalsResponse>('/api/nutrition-goals', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

/**
 * Create an API service instance with the current user's ID token
 */
export const createCulinAIApi = (idToken: string) => {
  return new CulinAIApiService(idToken);
};

/**
 * Check if the CulinAI API is configured
 */
export const isCulinAIApiConfigured = () => {
  return Boolean(API_BASE_URL && API_BASE_URL.startsWith('http'));
};
