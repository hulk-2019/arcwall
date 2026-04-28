export interface User {
  id?: number;
  email?: string;
  nickname: string;
  avatar_url: string;
  created_at?: string;
  roles?: string[];
  credits?: UserCredits;
}

export interface UserCredits {
  total_credits: number;
  used_credits: number;
  left_credits: number;
}
