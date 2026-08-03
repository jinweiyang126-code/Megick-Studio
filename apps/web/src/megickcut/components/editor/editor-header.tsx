"use client";

import {
	useCallback,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CommandIcon, Logout05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft } from "lucide-react";
import { MagiCoreIcon, magiCoreIcons } from "@/components/brand/MagiCoreIcon";
import { Button } from "@/megickcut/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/megickcut/components/ui/dropdown-menu";
import { ShortcutsDialog } from "@/megickcut/actions/components/shortcuts-dialog";
import { ExportButton } from "@/megickcut/components/editor/export-button";
import { useEditor } from "@/megickcut/editor/use-editor";
import { useMegickEditorContext } from "@/megickcut/integration/editor-context";
import { cn } from "@/megickcut/utils/ui";
import { useI18n } from "@/lib/i18n";

export function EditorHeader() {
	const { t } = useI18n();
	const { embedded } = useMegickEditorContext();
	const exitControls = useExitToStudio();
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	return (
		<header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-[#1b1c21] px-4 sm:px-6">
			<div className="flex min-w-0 items-center gap-2">
				{exitControls.hasReturnToSession ? <ReturnToSessionButton {...exitControls} /> : null}
				{!embedded ? (
					<div className="hidden min-w-0 sm:block">
						<p className="truncate text-base font-medium tracking-tight text-white">
							{t("studio.shell.edit.title")}
						</p>
						<p className="mt-0.5 truncate text-xs text-[#8b8e94]">
							{t("studio.shell.edit.subtitle")}
						</p>
					</div>
				) : null}
				<ProjectDropdown {...exitControls} onOpenShortcuts={() => setShortcutsOpen(true)} />
				<EditableProjectName />
			</div>
			<nav className="flex items-center gap-2">
				{!embedded ? (
					<>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="hidden h-10 gap-2 rounded-xl border-border bg-[#1b1c21] px-4 text-sm text-foreground hover:bg-[#1b1c21]/90 sm:inline-flex"
							onClick={() => setShortcutsOpen(true)}
						>
							<MagiCoreIcon src={magiCoreIcons.guide} className="h-3.5 w-3.5" />
							{t("studio.shell.guide")}
						</Button>
						<Button
							asChild
							variant="outline"
							size="sm"
							className="hidden h-10 gap-2 rounded-xl border-border bg-[#1b1c21] px-4 text-sm text-foreground hover:bg-[#1b1c21]/90 sm:inline-flex"
						>
							<Link to="/dashboard/media-center">
								<MagiCoreIcon src={magiCoreIcons.asset} className="h-3.5 w-3.5" />
								{t("studio.shell.assets")}
							</Link>
						</Button>
					</>
				) : null}
				<ExportButton />
			</nav>
			<ShortcutsDialog
				isOpen={shortcutsOpen}
				onOpenChange={(isOpen) => setShortcutsOpen(isOpen)}
			/>
		</header>
	);
}

function useExitToStudio() {
	const [isExiting, setIsExiting] = useState(false);
	const editor = useEditor();
	const { returnToStudio } = useMegickEditorContext();

	const exitToStudio = useCallback(async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
		} catch (error) {
			console.error("Failed to prepare project exit:", error);
		} finally {
			editor.project.closeProject();
			returnToStudio?.();
		}
	}, [editor, isExiting, returnToStudio]);

	return { exitToStudio, isExiting, hasReturnToSession: !!returnToStudio };
}

function ReturnToSessionButton({
	exitToStudio,
	isExiting,
}: ReturnType<typeof useExitToStudio>) {
	const { t } = useI18n();
	const label = t("editor.action.backToSession");

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={() => void exitToStudio()}
			disabled={isExiting}
			className="h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border-border bg-[#17181d] px-3"
			title={label}
			aria-label={label}
		>
			<ArrowLeft className="size-3.5" />
			<span className="text-sm font-medium">{label}</span>
		</Button>
	);
}

function ProjectDropdown({
	exitToStudio,
	isExiting,
	onOpenShortcuts,
}: ReturnType<typeof useExitToStudio> & { onOpenShortcuts: () => void }) {
	const { t } = useI18n();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-10 w-auto rounded-xl px-3 py-1 text-xs font-bold tracking-tight text-primary"
					aria-label="MagiCoreAI"
				>
					<span aria-hidden="true">M</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="z-100 w-44">
				<DropdownMenuItem
					onClick={() => void exitToStudio()}
					disabled={isExiting}
					icon={<HugeiconsIcon icon={Logout05Icon} />}
				>
					{t("editor.action.backToSession")}
				</DropdownMenuItem>

				<DropdownMenuItem
					onClick={onOpenShortcuts}
					icon={<HugeiconsIcon icon={CommandIcon} />}
				>
					{t("editor.action.shortcuts")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function EditableProjectName() {
	const editor = useEditor();
	const { t } = useI18n();
	const activeProject = useEditor((e) => e.project.getActive());
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const originalNameRef = useRef("");

	const projectName =
		activeProject?.metadata.name || t("editor.project.defaultName");

	const startEditing = () => {
		if (isEditing) return;
		originalNameRef.current = projectName;
		setIsEditing(true);

		requestAnimationFrame(() => {
			inputRef.current?.select();
		});
	};

	const saveEdit = async () => {
		if (!inputRef.current || !activeProject) return;
		const newName = inputRef.current.value.trim();
		setIsEditing(false);

		if (!newName) {
			inputRef.current.value = originalNameRef.current;
			return;
		}

		if (newName !== originalNameRef.current) {
			try {
				await editor.project.renameProject({
					projectId: activeProject.metadata.id,
					name: newName,
				});
			} catch {
				toast.error(t("editor.project.renameFailed"));
				if (inputRef.current) inputRef.current.value = originalNameRef.current;
			}
		}
	};

	const cancelEdit = () => {
		if (inputRef.current) inputRef.current.value = originalNameRef.current;
		setIsEditing(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			void saveEdit();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			cancelEdit();
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				defaultValue={projectName}
				onBlur={() => void saveEdit()}
				onKeyDown={onKeyDown}
				className="h-8 max-w-[14rem] truncate rounded-xl border border-border bg-[#17181d] px-3 text-sm text-white outline-none focus-visible:ring-1 focus-visible:ring-ring"
				style={{ fieldSizing: "content" } as CSSProperties}
			/>
		);
	}

	return (
		<button
			type="button"
			onDoubleClick={startEditing}
			className={cn(
				"max-w-[14rem] truncate rounded-xl px-3 py-1.5 text-left text-sm font-medium text-white transition hover:bg-[#17181d]",
			)}
			title={projectName}
		>
			{projectName}
		</button>
	);
}
