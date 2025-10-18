import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Cloud, LogOut, Upload, Download, Trash2, Share2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface FileItem {
  name: string;
  created_at: string;
  id: string;
  metadata?: {
    size?: number;
  };
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadFiles(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          loadFiles(session.user.id);
        } else {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadFiles = async (userId: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("uploads")
        .list(`${userId}/`, {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading files",
        description: error.message,
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10 MB",
      });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/${file.name}`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "File uploaded successfully",
      });

      loadFiles(user.id);
      e.target.value = "";
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.storage
        .from("uploads")
        .download(`${user.id}/${fileName}`);

      if (error) throw error;

      // Create a blob URL
      const url = window.URL.createObjectURL(data);

      // Create and trigger a hidden download link
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName; // forces local download
      document.body.appendChild(a); // ✅ must append to DOM
      a.click();
      document.body.removeChild(a); // cleanup
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error.message,
      });
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.storage
        .from("uploads")
        .remove([`${user.id}/${fileName}`]);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "File deleted successfully",
      });

      loadFiles(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    }
  };

  const handleShareLink = async (fileName: string) => {
    if (!user) return;
    try {
      const { data } = supabase.storage
        .from("uploads")
        .getPublicUrl(`${user.id}/${fileName}`);

      if (data?.publicUrl) {
        await navigator.clipboard.writeText(data.publicUrl);
        toast({
          title: "Link copied!",
          description: "Share link copied to clipboard",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">CloudBox</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back!
          </h1>
          <p className="text-muted-foreground">
            Upload and manage your files securely
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            <Button disabled={uploading} className="gap-2">
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Maximum file size: 10 MB
          </p>
        </div>

        {/* Files Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Cloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No files yet. Upload your first file!
              </p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors"
              >
                <h3 className="font-semibold mb-2 truncate" title={file.name}>
                  {file.name}
                </h3>
                <div className="text-sm text-muted-foreground mb-4">
                  <p>{formatFileSize(file.metadata?.size || 0)}</p>
                  <p>{formatDate(file.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(file.name)}
                    className="flex-1 gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleShareLink(file.name)}
                    className="gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(file.name)}
                    className="gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
