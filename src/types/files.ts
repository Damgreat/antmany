export interface FileItem {
  id: number;
  name: string;
  type: string;
  created_at: string;
  modified_at?: string;
  data?: string;
  metadata?: string;
  isSelected: boolean;
} 