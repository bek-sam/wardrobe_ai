import type { DragEvent } from "react";

export function createDragDropHandlers(
  setDragging: (value: boolean) => void,
  onDropFile: (file: File) => void,
) {
  return {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (event.currentTarget === event.target) setDragging(false);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = Array.from(event.dataTransfer.files).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) onDropFile(file);
    },
  };
}
