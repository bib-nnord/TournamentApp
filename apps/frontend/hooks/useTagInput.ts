import type { KeyboardEvent, Dispatch, SetStateAction } from "react";
import { generateUniqueName } from "@/lib/helpers";

/**
 * Shared keyboard / blur handlers for tag-style inputs that
 * add unique names on Enter, comma, or blur and remove on Backspace.
 */
export function useTagInput(allNames: string[]) {
  function addTag(value: string, setList: Dispatch<SetStateAction<string[]>>) {
    const finalName = generateUniqueName(value, allNames);
    if (!finalName) return;
    setList((prev) => [...prev, finalName]);
  }

  function removeTag(index: number, setList: Dispatch<SetStateAction<string[]>>) {
    setList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: Dispatch<SetStateAction<string>>,
    list: string[],
    setList: Dispatch<SetStateAction<string[]>>
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input, setList);
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && list.length > 0) {
      setList((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur(
    input: string,
    setInput: Dispatch<SetStateAction<string>>,
    setList: Dispatch<SetStateAction<string[]>>
  ) {
    if (input.trim()) {
      addTag(input, setList);
      setInput("");
    }
  }

  return { addTag, removeTag, handleKeyDown, handleBlur };
}
