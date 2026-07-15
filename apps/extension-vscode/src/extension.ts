// VS Code shell (plan §10, Phase 3). Two surfaces:
//   - status-bar live token count of the active selection
//   - "Refine Selection" command → rewrite via the same Core Engine + backend.
// The engine is shared; only the surface differs.
import * as vscode from "vscode";
import { estimateTokens, parseResult, ruleTrim, MIN_CHARS_FOR_REWRITE } from "@promptforge/core";

const API = process.env.PF_API ?? "http://localhost:3000/api/rewrite";

export function activate(context: vscode.ExtensionContext) {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  const update = () => {
    const sel = vscode.window.activeTextEditor?.document.getText(
      vscode.window.activeTextEditor.selection,
    );
    status.text = `⚒ ${estimateTokens(sel ?? "")} tok`;
    status.show();
  };
  update();
  context.subscriptions.push(
    status,
    vscode.window.onDidChangeTextEditorSelection(update),
    vscode.commands.registerCommand("promptforge.refineSelection", refineSelection),
  );
}

async function refineSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const raw = editor.document.getText(editor.selection);
  if (ruleTrim(raw).cleaned.length < MIN_CHARS_FOR_REWRITE) {
    vscode.window.showInformationMessage("PromptForge: selection too short to refine.");
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "PromptForge: forging…" },
    async () => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: raw, platform: "vscode" }),
      });
      // Backend streams SSE; collect it, then parse the final JSON.
      const text = await res.text();
      const full = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => {
          try {
            const e = JSON.parse(l.slice(5).trim());
            return e?.delta?.type === "text_delta" ? (e.delta.text as string) : "";
          } catch {
            return "";
          }
        })
        .join("");
      const result = parseResult(full || text);
      await editor.edit((b) => b.replace(editor.selection, result.refined_prompt));
    },
  );
}

export function deactivate() {}
