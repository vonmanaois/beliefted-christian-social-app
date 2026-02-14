"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import {
  ImageSquare,
  Quotes,
  TextHThree,
  TextHTwo,
  TextB,
  TextItalic,
  Minus,
} from "@phosphor-icons/react";

type MentionUser = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  image?: string | null;
};

const renderMentionList = (
  container: HTMLDivElement,
  items: MentionUser[],
  selectedIndex: number,
  command: (props: { id: string; label: string }) => void
) => {
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "mention-suggestions";
  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mention-suggestions__item ${
      index === selectedIndex ? "is-active" : ""
    }`;
    button.textContent = `${item.name ?? item.username ?? "User"}${
      item.username ? ` @${item.username}` : ""
    }`;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", () => {
      if (!item.username) return;
      command({ id: item.username, label: `@${item.username}` });
    });
    list.appendChild(button);
  });
  container.appendChild(list);
};

type FaithStoryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxImages?: number;
  allowImages?: boolean;
  onError?: (message: string | null) => void;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const normalizeContent = (value: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.includes("<")) return trimmed;
  return `<p>${escapeHtml(trimmed)}</p>`;
};

export default function FaithStoryEditor({
  value,
  onChange,
  placeholder = "Share your faith story...",
  disabled = false,
  maxImages = 2,
  allowImages = true,
  onError,
}: FaithStoryEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const imagesEnabled = allowImages;
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    h2: false,
    h3: false,
    quote: false,
  });
  const normalizedValue = useMemo(() => normalizeContent(value), [value]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: normalizedValue,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention-link",
        },
        suggestion: {
          char: "@",
          items: async ({ query }) => {
            if (query.length < 2) return [];
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) return [];
            const data = (await response.json()) as MentionUser[];
            return data.slice(0, 5);
          },
          render: () => {
            let container: HTMLDivElement | null = null;
            let selectedIndex = 0;
            let currentItems: MentionUser[] = [];
            let currentCommand: ((props: { id: string; label: string }) => void) | null = null;

            const update = (
              props: {
                items: MentionUser[];
                command: (props: { id: string; label: string }) => void;
                clientRect?: (() => DOMRect | null) | null;
              } | null
            ) => {
              if (!props) return;
              if (!container) return;
              if (!props.items.length) {
                currentItems = [];
                container.style.display = "none";
                container.innerHTML = "";
                return;
              }
              currentItems = props.items;
              currentCommand = props.command;
              container.style.display = "block";
              const rect = props.clientRect?.();
              if (rect) {
                container.style.left = `${rect.left + window.scrollX}px`;
                container.style.top = `${rect.bottom + window.scrollY + 6}px`;
              }
              renderMentionList(container, props.items, selectedIndex, props.command);
            };

            return {
              onStart: (props) => {
                selectedIndex = 0;
                container = document.createElement("div");
                container.className = "mention-suggestions-wrapper";
                container.style.position = "absolute";
                container.style.zIndex = "50";
                document.body.appendChild(container);
                update(props);
              },
              onUpdate: (props) => {
                update(props);
              },
              onKeyDown: (props) => {
                if (!currentItems.length) {
                  return false;
                }
                if (props.event.key === "ArrowDown") {
                  selectedIndex = (selectedIndex + 1) % currentItems.length;
                  update({
                    items: currentItems,
                    command: currentCommand ?? (() => {}),
                    clientRect: undefined,
                  });
                  return true;
                }
                if (props.event.key === "ArrowUp") {
                  selectedIndex =
                    (selectedIndex - 1 + currentItems.length) % currentItems.length;
                  update({
                    items: currentItems,
                    command: currentCommand ?? (() => {}),
                    clientRect: undefined,
                  });
                  return true;
                }
                if (props.event.key === "Enter") {
                  const item = currentItems[selectedIndex];
                  if (item?.username) {
                    currentCommand?.({ id: item.username, label: `@${item.username}` });
                  }
                  return true;
                }
                if (props.event.key === "Escape") {
                  return true;
                }
                return false;
              },
              onExit: () => {
                if (container) {
                  container.remove();
                  container = null;
                }
              },
            };
          },
        },
      }),
      ...(imagesEnabled
        ? [
            Image.configure({
              allowBase64: false,
              HTMLAttributes: {
                class: "faith-story-inline-image",
              },
            }),
          ]
        : []),
      Placeholder.configure({
        placeholder,
      }),
    ],
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const syncActive = () => {
      setActiveState({
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        h2: editor.isActive("heading", { level: 2 }),
        h3: editor.isActive("heading", { level: 3 }),
        quote: editor.isActive("blockquote"),
      });
    };
    syncActive();
    editor.on("selectionUpdate", syncActive);
    editor.on("transaction", syncActive);
    editor.on("focus", syncActive);
    editor.on("blur", syncActive);
    return () => {
      editor.off("selectionUpdate", syncActive);
      editor.off("transaction", syncActive);
      editor.off("focus", syncActive);
      editor.off("blur", syncActive);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, normalizedValue]);

  const inlineImageCount = useMemo(
    () => (imagesEnabled ? value.match(/<img /g)?.length ?? 0 : 0),
    [imagesEnabled, value]
  );

  const resizeImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = dataUrl;
    });

    const maxSize = 1200;
    let targetWidth = img.width;
    let targetHeight = img.height;
    if (targetWidth > targetHeight && targetWidth > maxSize) {
      targetHeight = Math.round((targetHeight * maxSize) / targetWidth);
      targetWidth = maxSize;
    } else if (targetHeight > maxSize) {
      targetWidth = Math.round((targetWidth * maxSize) / targetHeight);
      targetHeight = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) reject(new Error("Failed to compress image"));
          else resolve(result);
        },
        "image/jpeg",
        0.84
      );
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  };

  const handleInsertImage = async (file: File) => {
    if (!editor || !imagesEnabled) return;
    if (inlineImageCount >= maxImages) {
      onError?.(`You can add up to ${maxImages} images.`);
      return;
    }
    try {
      setIsUploading(true);
      const processed = await resizeImage(file);
      const signResponse = await fetch("/api/cloudinary/sign-faith-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      if (!signResponse.ok) {
        onError?.("Failed to prepare image upload.");
        return;
      }
      const signData = (await signResponse.json()) as {
        cloudName: string;
        apiKey: string;
        upload: {
          publicId: string;
          signature: string;
          timestamp: number;
          folder: string;
          invalidate: string;
        };
      };
      const formData = new FormData();
      formData.append("file", processed);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", String(signData.upload.timestamp));
      formData.append("signature", signData.upload.signature);
      formData.append("folder", signData.upload.folder);
      formData.append("public_id", signData.upload.publicId);
      formData.append("invalidate", signData.upload.invalidate);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!uploadResponse.ok) {
        onError?.("Failed to upload image.");
        return;
      }
      const uploaded = (await uploadResponse.json()) as {
        secure_url?: string;
        url?: string;
      };
      const imageUrl = uploaded.secure_url ?? uploaded.url ?? null;
      if (!imageUrl) {
        onError?.("Upload succeeded but no image URL returned.");
        return;
      }
      editor.chain().focus().setImage({ src: imageUrl }).run();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const openFilePicker = () => {
    if (!imagesEnabled || disabled || isUploading) return;
    if (inlineImageCount >= maxImages) {
      onError?.(`You can add up to ${maxImages} images.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleInsertImage(file);
    event.target.value = "";
  };


  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[color:var(--subtle)]">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={disabled}
          className={`editor-btn ${activeState.bold ? "is-active" : ""}`}
          aria-pressed={activeState.bold ? "true" : "false"}
        >
          <TextB size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={disabled}
          className={`editor-btn ${activeState.italic ? "is-active" : ""}`}
          aria-pressed={activeState.italic ? "true" : "false"}
        >
          <TextItalic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
          className={`editor-btn ${activeState.h2 ? "is-active" : ""}`}
          aria-pressed={activeState.h2 ? "true" : "false"}
        >
          <TextHTwo size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
          className={`editor-btn ${activeState.h3 ? "is-active" : ""}`}
          aria-pressed={activeState.h3 ? "true" : "false"}
        >
          <TextHThree size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          className={`editor-btn ${activeState.quote ? "is-active" : ""}`}
          aria-pressed={activeState.quote ? "true" : "false"}
        >
          <Quotes size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={disabled}
          className="editor-btn"
        >
          <Minus size={18} />
        </button>
        {imagesEnabled && (
          <>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={disabled || isUploading}
              className="editor-btn"
            >
              <ImageSquare size={18} />
              <span className="text-[11px] font-semibold">
                {inlineImageCount}/{maxImages}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      <div className="editor-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
