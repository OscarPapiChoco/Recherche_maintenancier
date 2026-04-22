
export interface MaintenanceWorker {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviews: number;
  experience: string;
  hourlyRate: number;
  status: 'online' | 'busy' | 'offline';
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  phone: string;
  avatar: string;
  skills: string[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
