"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const PLACEHOLDERS = [
  "{{full_name}}",
  "{{event_name}}",
  "{{event_date}}",
  "{{event_time}}",
  "{{event_end_time}}",
  "{{joining_link}}",
];

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
    ],
    content: value || `<p>${placeholder || ""}</p>`,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none min-h-[280px] px-4 py-3 focus:outline-none text-slate-200 text-sm leading-relaxed",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value]); // eslint-disable-line

  if (!editor) return null;

  const ToolBtn = ({ active, onClick, label, title }: {
    active: boolean; onClick: () => void; label: string; title?: string;
  }) => (
    <button type="button" onClick={onClick} title={title || label}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-700 bg-slate-900">
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="B" title="Bold" />
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" title="Italic" />
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="U" title="Underline" />
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="S̶" title="Strikethrough" />

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="H1" />
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" />
        <ToolBtn active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} label="¶" title="Paragraph" />

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="• List" />
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1. List" />

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} label="⬅" title="Left" />
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} label="↔" title="Center" />
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} label="➡" title="Right" />

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <button type="button" title="Insert link"
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700">
          🔗
        </button>
        <ToolBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} label="—" title="Divider" />

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} label="↩" title="Undo" />
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} label="↪" title="Redo" />
      </div>

      {/* Placeholder chips */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-700 bg-slate-900/50">
        <span className="text-xs text-slate-500 self-center">Insert placeholder:</span>
        {PLACEHOLDERS.map((ph) => (
          <button key={ph} type="button"
            onClick={() => editor.chain().focus().insertContent(ph).run()}
            className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 font-mono transition-colors">
            {ph}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="bg-slate-800/30 min-h-[280px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}