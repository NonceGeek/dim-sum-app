import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RoleTipDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleTipDialog({ isOpen, onClose }: RoleTipDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Role Change Required</DialogTitle>
        </DialogHeader>
        <div className="py-4 text-center">
          <p className="text-muted-foreground">
            For Tagger and Researcher roles, please contact{" "}
            <a 
              href="mailto:leeduckgo@gmail.com" 
              className="text-primary hover:underline"
            >
              leeduckgo@gmail.com
            </a>
            {" "}to request role changes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 