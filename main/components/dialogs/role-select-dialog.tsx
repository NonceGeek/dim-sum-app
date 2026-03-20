import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type UserRole = 'learner' | 'tagger' | 'researcher';

interface RoleSelectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (role: UserRole) => void;
}

export function RoleSelectDialog({ isOpen, onClose, onConfirm }: RoleSelectDialogProps) {
  const t = useTranslations("Auth");
  const tc = useTranslations("Common");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleConfirm = () => {
    if (selectedRole) {
      onConfirm(selectedRole);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">{t("selectRole")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("selectRoleDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup
            value={selectedRole || ''}
            onValueChange={(value) => setSelectedRole(value as UserRole)}
            className="flex flex-col items-center space-y-4"
          >
            <div className="w-full max-w-[200px]">
              <RadioGroupItem value="learner" id="learner" className="peer sr-only" />
              <Label
                htmlFor="learner"
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary",
                )}
              >
                {t("learner")}
              </Label>
            </div>

            <div className="w-full max-w-[200px]">
              <RadioGroupItem value="tagger" id="tagger" className="peer sr-only" />
              <Label
                htmlFor="tagger"
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary",
                )}
              >
                {t("tagger")}
              </Label>
            </div>

            <div className="w-full max-w-[200px]">
              <RadioGroupItem value="researcher" id="researcher" className="peer sr-only" />
              <Label
                htmlFor="researcher"
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary",
                )}
              >
                {t("researcher")}
              </Label>
            </div>
          </RadioGroup>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedRole}
            >
              {tc("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 