-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('uploads', 'uploads', true, 10485760)
ON CONFLICT (id) DO NOTHING;