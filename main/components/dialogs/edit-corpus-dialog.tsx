import { SearchResult } from "@/lib/api/search";
import { ZYZDCorpusDialog } from "./zyzd-corpus-dialog";
import { OtherCorpusDialog } from "./other-corpus-dialog";

interface EditCorpusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingResult: SearchResult | null;
}

export const EditCorpusDialog = ({
  open,
  onOpenChange,
  editingResult,
}: EditCorpusDialogProps) => {

  return (
    (editingResult?.category === "广州话正音字典") ? (
    <ZYZDCorpusDialog
      open={open}
      onOpenChange={onOpenChange}
      editingResult={editingResult}
    />
  ) : (
    <OtherCorpusDialog
      open={open}
      onOpenChange={onOpenChange}
      editingResult={editingResult}
    />
  )
  );
};