// API client with automatic auth headers
class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  }

  private getAuthHeaders() {
    if (typeof window === 'undefined') return {};
    
    const persistedAuth = localStorage.getItem('persist:auth');
    if (!persistedAuth) {
      console.warn('No auth data found in localStorage');
      return {};
    }

    try {
      const authData = JSON.parse(persistedAuth);
      const accessToken = authData.accessToken ? JSON.parse(authData.accessToken) : null;
      
      if (accessToken) {
        return { Authorization: `Bearer ${accessToken}` };
      } else {
        console.warn('No access token found in auth data');
        return {};
      }
    } catch (error) {
      console.error('Error parsing auth data:', error);
      return {};
    }
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const authHeaders = this.getAuthHeaders();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error ${response.status} for ${url}:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      return response;
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  // Convenience methods
  get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put(endpoint: string, data?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(); 