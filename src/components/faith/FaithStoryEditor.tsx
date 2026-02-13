"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ImageSquare,
  Quotes,
  TextHThree,
  TextHTwo,
  TextB,
  TextItalic,
  Minus,
} from "@phosphor-icons/react";

type FaithStoryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxImages?: number;
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
  onError,
}: FaithStoryEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "faith-story-inline-image",
        },
      }),
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
    () => (value.match(/<img /g) ?? []).length,
    [value]
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
    if (!editor) return;
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
    if (disabled || isUploading) return;
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
      </div>

      <div className="editor-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
