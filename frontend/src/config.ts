export const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://iseetv-backend:8000'
  : '/api';  // For production if we add a reverse proxy 