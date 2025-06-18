import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchResult } from "@/lib/api/search";
import React from "react";

interface EditCorpusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingResult: SearchResult | null;
  onSave: () => void;
}

export const EditCorpusDialog: React.FC<EditCorpusDialogProps> = ({ open, onOpenChange, editingResult, onSave }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        {/* <DialogTitle>Update Entry</DialogTitle> */}
      </DialogHeader>
      {editingResult && (
        <div className="space-y-6">
          <div>
            <div><b>简体：</b> {editingResult.data}</div>
            <div><b>繁体：</b> {(editingResult.note && editingResult.note.context && (editingResult.note.context as any)['trad']) ? (editingResult.note.context as any)['trad'] : editingResult.data}</div>
          </div>
          <table className="w-full table-fixed border border-white/30 rounded text-base shadow-sm">
            <tbody>
              {editingResult.note?.context['pinyin'].length > 0
                ? (editingResult.note?.context['pinyin'] as string[]).map(function(item: string, idx: number) {
                    return (
                      <tr className="border-t border-white/20" key={idx}>
                        <td className="px-2 py-2 text-center font-medium text-white border border-white/20">粵音{idx + 1}</td>
                        <td className="px-2 py-2 text-purple-400 text-center border border-white/20">{item}</td>
                        <td className="px-2 py-2 text-purple-400 border border-white/20"></td>
                      </tr>
                    );
                  })
                : <tr>
                    <td className="px-2 py-2 text-center font-medium text-white border border-white/20">粵音1</td>
                    <td className="px-2 py-2 text-purple-400 text-center border border-white/20">{(editingResult.note?.context as any)['pinyin'] || ''}</td>
                    <td className="border border-white/20"></td>
                  </tr>
              }
              <tr className="border-t border-white/20">
                <td className="px-2 py-2 text-center font-medium text-white border border-white/20">释义</td>
                <td colSpan={2} className="px-2 py-2 text-purple-400 whitespace-pre-line leading-relaxed border border-white/20">
                  {
                    (editingResult.note?.context['meaning'] as string[]).map((item, idx) => <div key={idx}>{item}</div>)
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" className="h-12 px-6">Revert</Button>
        </DialogClose>
        <Button onClick={onSave} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white h-12 px-6 ml-2">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
); 