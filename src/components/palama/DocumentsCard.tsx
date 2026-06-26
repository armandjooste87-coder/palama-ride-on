import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DOC_TYPES = [
  { key: "driver_license", label: "Driver's licence" },
  { key: "vehicle_registration", label: "Vehicle registration" },
  { key: "insurance", label: "Insurance certificate" },
  { key: "profile_photo", label: "Profile photo" },
] as const;

type DocRow = {
  id: string;
  doc_type: string;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  updated_at: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function DocumentsCard() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function refresh() {
    if (!user) return;
    const { data } = await supabase
      .from("driver_documents")
      .select("id,doc_type,storage_path,status,admin_note,updated_at")
      .eq("driver_id", user.id);
    setDocs((data ?? []) as DocRow[]);
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [user?.id]);

  async function handleFile(doc_type: string, file: File) {
    if (!user) return;
    if (file.size > MAX_BYTES) { toast.error("File too large (max 10 MB)"); return; }
    if (!/^image\/|application\/pdf/.test(file.type)) { toast.error("Only images or PDF allowed"); return; }
    setUploading(doc_type);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 5);
      const path = `${user.id}/${doc_type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("driver-docs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: rpcErr } = await supabase.rpc("driver_doc_upsert", {
        _doc_type: doc_type, _storage_path: path,
      });
      if (rpcErr) throw rpcErr;
      toast.success("Submitted for review");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <FileText className="size-4" /> Verification documents
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload clear images or PDFs (max 10 MB each). An admin will review.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {DOC_TYPES.map((t) => {
          const d = docs.find((x) => x.doc_type === t.key);
          const busy = uploading === t.key;
          return (
            <li key={t.key} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.label}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {d ? <StatusBadge status={d.status} /> : <Badge variant="outline">Not uploaded</Badge>}
                  {d?.admin_note && <span className="truncate text-xs text-muted-foreground">{d.admin_note}</span>}
                </div>
              </div>
              <input
                ref={(el) => { fileRefs.current[t.key] = el; }}
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(t.key, f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileRefs.current[t.key]?.click()}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                <span className="ml-1">{d ? "Replace" : "Upload"}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StatusBadge({ status }: { status: DocRow["status"] }) {
  if (status === "approved") return <Badge className="bg-success text-success-foreground"><Check className="mr-1 size-3" />Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive"><X className="mr-1 size-3" />Rejected</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
}