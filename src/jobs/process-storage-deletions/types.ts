export type StorageDeletionTask = {
  id: string;
  user_id: string;
  bucket_id: string;
  storage_path: string;
  attempt_count: number;
};
