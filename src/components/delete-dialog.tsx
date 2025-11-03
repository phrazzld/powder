"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  hasAssignedName: boolean;
};

export function DeleteDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  hasAssignedName,
}: DeleteDialogProps) {
  const [releaseNames, setReleaseNames] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteProject = useMutation(api.projects.deleteProject);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject({
        projectId: projectId as any,
        releaseNames,
      });
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {projectName || "this project"}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {hasAssignedName && (
          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="release-names"
              checked={releaseNames}
              onCheckedChange={(checked) => setReleaseNames(!!checked)}
            />
            <Label
              htmlFor="release-names"
              className="text-sm font-normal cursor-pointer"
            >
              Release project name back to available pool
            </Label>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
