export type ImageRow = {
  id: string;
  kind: string;
  bucket_id: string;
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  file_size: number;
  is_primary: boolean;
  generation_model?: string | null;
  parent_image_id?: string | null;
  created_at?: string;
};
