import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { FileSystemService } from "./filesystem.js";
import { FrontmatterHandler, parseFrontmatter } from "./frontmatter.js";
import { PathFilter } from "./pathfilter.js";
import { SearchService } from "./search.js";
import { resolve } from "path";
export function createServer(vaultPath, options = {}) {
    const { name = "mcpvault", version = "0.0.0", pathFilter = new PathFilter(), frontmatterHandler = new FrontmatterHandler(), } = options;
    const resolvedVaultPath = resolve(vaultPath);
    const fileSystem = new FileSystemService(resolvedVaultPath, pathFilter, frontmatterHandler);
    const searchService = new SearchService(resolvedVaultPath, pathFilter);
    // Paths to the vault onboarding files (relative to vault root)
    const VAULT_GUIDE_PATH = "500-599_Conexao_e_Navegacao/Guia_IA_No_Vault.md";
    const VAULT_MISSION_PATH = "500-599_Conexao_e_Navegacao/MOC_Missao_Ativa.md";
    const VAULT_RULES_PATH = "700-799_Operacao_e_Memoria_IA/720_Global/Regras_Memoria_e_Identidade_IA.md";
    async function readVaultBootstrap() {
        let guideContent = "";
        let missionContent = "";
        let rulesContent = "";
        try {
            const guide = await fileSystem.readNote(VAULT_GUIDE_PATH);
            guideContent = guide.content ?? "";
        }
        catch {
            guideContent = `(${VAULT_GUIDE_PATH} not found — vault onboarding guide has not been created yet)`;
        }
        try {
            const mission = await fileSystem.readNote(VAULT_MISSION_PATH);
            missionContent = mission.content ?? "";
        }
        catch {
            missionContent = `(${VAULT_MISSION_PATH} not found — active projects list has not been created yet)`;
        }
        try {
            const rules = await fileSystem.readNote(VAULT_RULES_PATH);
            rulesContent = rules.content ?? "";
        }
        catch {
            rulesContent = `(${VAULT_RULES_PATH} not found)`;
        }
        const SESSION_START_PROTOCOL = [
            "=== MANDATORY SESSION START PROTOCOL ===",
            "",
            "You have just bootstrapped. Follow these steps NOW before doing anything else:",
            "",
            "1. READ the vault guide below — understand folder structure, YAML rules, taxonomy vocabulary.",
            "2. READ the active projects list below — identify which project is relevant to this session.",
            "3. READ the Estado_Atual of the relevant project (path: 700-799_Operacao_e_Memoria_IA/710_Projetos/<ID>/<ID>_Estado_Atual.md).",
            "4. If you need narrative context from the last session, read the Handoff file linked in MOC_Missao_Ativa.",
            "5. Only then start working.",
            "",
            "MEMORY RULES — non-negotiable:",
            "- Obsidian vault (via MCP) is the ONLY valid memory. Never use .claude-pj or any local harness memory.",
            "- Vault path and username vary per machine — never hardcode them. You already have access via MCP.",
            "- Every piece of context that must persist between sessions goes into the vault, nowhere else.",
        ].join("\n");
        const SESSION_CLOSE_PROTOCOL = [
            "=== MANDATORY SESSION CLOSE PROTOCOL ===",
            "",
            "At the end of any significant work session, you MUST do ALL of the following:",
            "",
            "1. UPDATE Estado_Atual (700-799_Operacao_e_Memoria_IA/710_Projetos/<ID>/<ID>_Estado_Atual.md):",
            "   - File status tables",
            "   - Pending tasks (checkboxes)",
            "   - Next immediate step",
            "   - Active decisions table (if anything changed)",
            "",
            "2. CREATE a session note at: 700-799_Operacao_e_Memoria_IA/710_Projetos/<ID>/Sessoes/<ID>_Sessao_YYYY-MM-DD_HHmm.md",
            "   - YAML field 'anterior:' must link to the previous session note",
            "   - Body must also reference the previous session",
            "   - Content: what the user asked, what was done, decisions with rationale, bugs found, what remains",
            "",
            "3. UPDATE the Handoff file (LIFO stack — most recent session at the TOP):",
            "   - Keep only the 5 most recent sessions in the stack",
            "   - If a 6th entry would be added, remove the oldest (but the session note itself stays in Sessoes/)",
            "",
            "4. UPDATE MOC_Missao_Ativa (500-599_Conexao_e_Navegacao/MOC_Missao_Ativa.md):",
            "   - Update project status",
            "   - Update the Ultimo Handoff link",
            "",
            "DO NOT end the session without completing these steps.",
            "If the session was trivial (single question, no code changed), steps 2-4 can be skipped — but step 1 is always required if anything changed.",
        ].join("\n");
        return [
            SESSION_START_PROTOCOL,
            "",
            "=== VAULT GUIDE (Guia_IA_No_Vault.md) ===",
            "",
            guideContent,
            "",
            "=== ACTIVE PROJECTS (MOC_Missao_Ativa.md) ===",
            "",
            missionContent,
            "",
            "=== MEMORY & IDENTITY RULES (Regras_Memoria_e_Identidade_IA.md) ===",
            "",
            rulesContent,
            "",
            SESSION_CLOSE_PROTOCOL,
        ].join("\n");
    }
    const server = new Server({ name, version }, {
        capabilities: { tools: {}, prompts: {} },
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "vault_bootstrap",
                    description: [
                        "CALL THIS FIRST at the start of EVERY session, no exceptions.",
                        "Returns everything you need to operate in this vault:",
                        "1. SESSION START PROTOCOL — mandatory steps to follow right now before doing anything else.",
                        "2. The complete vault onboarding guide: folder structure (000-999 layers), YAML schema, full taxonomy vocabulary, how Estado_Atual and Handoff work, rules for IAs, what you can and cannot do.",
                        "3. The active projects list (MOC_Missao_Ativa): all current projects with direct links to Estado_Atual and last Handoff.",
                        "4. Memory & identity rules: why .claude-pj and local memory are prohibited, why paths must never be hardcoded.",
                        "5. SESSION CLOSE PROTOCOL — mandatory steps you MUST follow at the end of every significant session (update Estado_Atual, create session note, update Handoff, update MOC_Missao_Ativa).",
                        "After calling this tool you will have everything needed to operate without asking the user for explanations.",
                    ].join(" "),
                    inputSchema: {
                        type: "object",
                        properties: {},
                    }
                },
                {
                    name: "read_note",
                    description: "Read a note from the Obsidian vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "write_note",
                    description: "Write a note to the Obsidian vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            content: { type: "string", description: "Content of the note" },
                            frontmatter: { type: "object", description: "Frontmatter object (optional)" },
                            mode: { type: "string", enum: ["overwrite", "append", "prepend"], description: "Write mode: 'overwrite' (default), 'append', or 'prepend'", default: "overwrite" }
                        },
                        required: ["path", "content"]
                    }
                },
                {
                    name: "patch_note",
                    description: "Efficiently update part of a note by replacing a specific string. This is more efficient than rewriting the entire note for small changes.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            oldString: { type: "string", description: "The exact string to replace. Must match exactly including whitespace and line breaks." },
                            newString: { type: "string", description: "The new string to insert in place of oldString" },
                            replaceAll: { type: "boolean", description: "If true, replace all occurrences. If false (default), the operation will fail if multiple matches are found to prevent unintended replacements.", default: false }
                        },
                        required: ["path", "oldString", "newString"]
                    }
                },
                {
                    name: "list_directory",
                    description: "List files and directories in the vault (includes non-note filenames, while read/write tools remain note-only)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path relative to vault root (default: '/')", default: "/" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                },
                {
                    name: "delete_note",
                    description: "Delete a note from the Obsidian vault (requires confirmation)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            confirmPath: { type: "string", description: "Confirmation: must exactly match the path parameter to proceed with deletion" }
                        },
                        required: ["path", "confirmPath"]
                    }
                },
                {
                    name: "search_notes",
                    description: "Search for notes in the vault by content or frontmatter",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Search query text" },
                            limit: { type: "number", description: "Maximum number of results (default: 5, max: 20)", default: 5 },
                            searchContent: { type: "boolean", description: "Search in note content (default: true)", default: true },
                            searchFrontmatter: { type: "boolean", description: "Search in frontmatter (default: false)", default: false },
                            caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)", default: false },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "move_note",
                    description: "Move or rename a note in the vault",
                    inputSchema: {
                        type: "object",
                        properties: {
                            oldPath: { type: "string", description: "Current path of the note" },
                            newPath: { type: "string", description: "New path for the note" },
                            overwrite: { type: "boolean", description: "Allow overwriting existing file (default: false)", default: false }
                        },
                        required: ["oldPath", "newPath"]
                    }
                },
                {
                    name: "move_file",
                    description: "Move or rename any file in the vault (binary-safe, file-only, requires confirmation)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            oldPath: { type: "string", description: "Current path of the file" },
                            newPath: { type: "string", description: "New path for the file" },
                            confirmOldPath: { type: "string", description: "Confirmation: must exactly match oldPath" },
                            confirmNewPath: { type: "string", description: "Confirmation: must exactly match newPath" },
                            overwrite: { type: "boolean", description: "Allow overwriting existing file (default: false)", default: false }
                        },
                        required: ["oldPath", "newPath", "confirmOldPath", "confirmNewPath"]
                    }
                },
                {
                    name: "read_multiple_notes",
                    description: "Read multiple notes in a batch (max 10 files)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            paths: { type: "array", items: { type: "string" }, description: "Array of note paths to read", maxItems: 10 },
                            includeContent: { type: "boolean", description: "Include note content (default: true)", default: true },
                            includeFrontmatter: { type: "boolean", description: "Include frontmatter (default: true)", default: true },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["paths"]
                    }
                },
                {
                    name: "update_frontmatter",
                    description: "Update frontmatter of a note without changing content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note" },
                            frontmatter: { type: "object", description: "Frontmatter object to update" },
                            merge: { type: "boolean", description: "Merge with existing frontmatter (default: true)", default: true }
                        },
                        required: ["path", "frontmatter"]
                    }
                },
                {
                    name: "get_notes_info",
                    description: "Get metadata for notes without reading full content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            paths: { type: "array", items: { type: "string" }, description: "Array of note paths to get info for" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["paths"]
                    }
                },
                {
                    name: "get_frontmatter",
                    description: "Extract frontmatter from a note without reading the content",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        },
                        required: ["path"]
                    }
                },
                {
                    name: "manage_tags",
                    description: "Add, remove, or list tags in a note",
                    inputSchema: {
                        type: "object",
                        properties: {
                            path: { type: "string", description: "Path to the note relative to vault root" },
                            operation: { type: "string", enum: ["add", "remove", "list"], description: "Operation to perform: 'add', 'remove', or 'list'" },
                            tags: { type: "array", items: { type: "string" }, description: "Array of tags (required for 'add' and 'remove' operations)" }
                        },
                        required: ["path", "operation"]
                    }
                },
                {
                    name: "get_vault_stats",
                    description: "Get vault statistics including total notes, folders, size, and recently modified files. Useful for understanding vault scope before batch operations.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            recentCount: { type: "number", description: "Number of recently modified files to return (default: 5, max: 20)", default: 5 },
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                },
                {
                    name: "list_all_tags",
                    description: "List all tags across the vault with occurrence counts. Returns both frontmatter tags and inline #hashtags, deduplicated and sorted by frequency. Useful for discovering existing tags before creating or organizing notes.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prettyPrint: { type: "boolean", description: "Format JSON response with indentation (default: false)", default: false }
                        }
                    }
                }
            ]
        };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name: toolName, arguments: args } = request.params;
        const trimmedArgs = trimPaths(args);
        try {
            switch (toolName) {
                case "vault_bootstrap": {
                    const bootstrapContent = await readVaultBootstrap();
                    return {
                        content: [{ type: "text", text: bootstrapContent }]
                    };
                }
                case "read_note": {
                    const note = await fileSystem.readNote(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ fm: note.frontmatter, content: note.content }, null, indent) }]
                    };
                }
                case "write_note": {
                    const fm = parseFrontmatter(trimmedArgs.frontmatter);
                    await fileSystem.writeNote({
                        path: trimmedArgs.path,
                        content: trimmedArgs.content,
                        ...(fm !== undefined && { frontmatter: fm }),
                        mode: trimmedArgs.mode || 'overwrite'
                    });
                    return {
                        content: [{ type: "text", text: `Successfully wrote note: ${trimmedArgs.path} (mode: ${trimmedArgs.mode || 'overwrite'})` }]
                    };
                }
                case "patch_note": {
                    const result = await fileSystem.patchNote({
                        path: trimmedArgs.path,
                        oldString: trimmedArgs.oldString,
                        newString: trimmedArgs.newString,
                        replaceAll: trimmedArgs.replaceAll
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "list_directory": {
                    const listing = await fileSystem.listDirectory(trimmedArgs.path || '');
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ dirs: listing.directories, files: listing.files }, null, indent) }]
                    };
                }
                case "delete_note": {
                    const result = await fileSystem.deleteNote({
                        path: trimmedArgs.path,
                        confirmPath: trimmedArgs.confirmPath
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "search_notes": {
                    const results = await searchService.search({
                        query: trimmedArgs.query,
                        limit: trimmedArgs.limit,
                        searchContent: trimmedArgs.searchContent,
                        searchFrontmatter: trimmedArgs.searchFrontmatter,
                        caseSensitive: trimmedArgs.caseSensitive
                    });
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(results, null, indent) }]
                    };
                }
                case "move_note": {
                    const result = await fileSystem.moveNote({
                        oldPath: trimmedArgs.oldPath,
                        newPath: trimmedArgs.newPath,
                        overwrite: trimmedArgs.overwrite
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "move_file": {
                    const result = await fileSystem.moveFile({
                        oldPath: trimmedArgs.oldPath,
                        newPath: trimmedArgs.newPath,
                        confirmOldPath: trimmedArgs.confirmOldPath,
                        confirmNewPath: trimmedArgs.confirmNewPath,
                        overwrite: trimmedArgs.overwrite
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "read_multiple_notes": {
                    const result = await fileSystem.readMultipleNotes({
                        paths: trimmedArgs.paths,
                        includeContent: trimmedArgs.includeContent,
                        includeFrontmatter: trimmedArgs.includeFrontmatter
                    });
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ ok: result.successful, err: result.failed }, null, indent) }]
                    };
                }
                case "update_frontmatter": {
                    const fm = parseFrontmatter(trimmedArgs.frontmatter);
                    if (!fm) {
                        throw new Error('frontmatter is required');
                    }
                    await fileSystem.updateFrontmatter({
                        path: trimmedArgs.path,
                        frontmatter: fm,
                        merge: trimmedArgs.merge
                    });
                    return {
                        content: [{ type: "text", text: `Successfully updated frontmatter for: ${trimmedArgs.path}` }]
                    };
                }
                case "get_notes_info": {
                    const result = await fileSystem.getNotesInfo(trimmedArgs.paths);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, indent) }]
                    };
                }
                case "get_frontmatter": {
                    const note = await fileSystem.readNote(trimmedArgs.path);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(note.frontmatter, null, indent) }]
                    };
                }
                case "manage_tags": {
                    const result = await fileSystem.manageTags({
                        path: trimmedArgs.path,
                        operation: trimmedArgs.operation,
                        tags: trimmedArgs.tags
                    });
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                        isError: !result.success
                    };
                }
                case "get_vault_stats": {
                    const recentCount = Math.min(trimmedArgs.recentCount || 5, 20);
                    const stats = await fileSystem.getVaultStats(recentCount);
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify({ notes: stats.totalNotes, folders: stats.totalFolders, size: stats.totalSize, recent: stats.recentlyModified }, null, indent) }]
                    };
                }
                case "list_all_tags": {
                    const tags = await fileSystem.listAllTags();
                    const indent = trimmedArgs.prettyPrint ? 2 : undefined;
                    return {
                        content: [{ type: "text", text: JSON.stringify(tags, null, indent) }]
                    };
                }
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        }
        catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                isError: true
            };
        }
    });
    // MCP Prompts — vault context injected as a named prompt template.
    // Clients that auto-load prompts (e.g. Claude Desktop) will inject this at session start.
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
            prompts: [
                {
                    name: "vault_context",
                    description: "Complete Obsidian vault onboarding guide and active projects list. Read before any vault operation when you have no prior session context.",
                }
            ]
        };
    });
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name: promptName } = request.params;
        if (promptName === "vault_context") {
            const bootstrapContent = await readVaultBootstrap();
            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: [
                                "You are connecting to an Obsidian vault. The vault has a specific structure, YAML schema, taxonomy vocabulary, and operational rules that you must follow.",
                                "Read the vault guide and active projects below before taking any action.",
                                "",
                                bootstrapContent,
                            ].join("\n"),
                        }
                    }
                ]
            };
        }
        throw new Error(`Prompt not found: ${promptName}`);
    });
    return server;
}
function trimPaths(args) {
    const trimmed = { ...args };
    if (trimmed.path && typeof trimmed.path === 'string')
        trimmed.path = trimmed.path.trim();
    if (trimmed.oldPath && typeof trimmed.oldPath === 'string')
        trimmed.oldPath = trimmed.oldPath.trim();
    if (trimmed.newPath && typeof trimmed.newPath === 'string')
        trimmed.newPath = trimmed.newPath.trim();
    if (trimmed.confirmPath && typeof trimmed.confirmPath === 'string')
        trimmed.confirmPath = trimmed.confirmPath.trim();
    if (trimmed.confirmOldPath && typeof trimmed.confirmOldPath === 'string')
        trimmed.confirmOldPath = trimmed.confirmOldPath.trim();
    if (trimmed.confirmNewPath && typeof trimmed.confirmNewPath === 'string')
        trimmed.confirmNewPath = trimmed.confirmNewPath.trim();
    if (trimmed.paths && Array.isArray(trimmed.paths)) {
        trimmed.paths = trimmed.paths.map((p) => typeof p === 'string' ? p.trim() : p);
    }
    return trimmed;
}
