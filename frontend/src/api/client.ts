const API_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

interface ApiOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Add this function to handle API calls
export const fetchApi = async (endpoint: string, options: ApiOptions = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  
  return response.json();
}; 