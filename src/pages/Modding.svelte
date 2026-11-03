<script lang="ts">
    import { onMount } from "svelte";
    import * as path from "@tauri-apps/api/path";
    import * as dialog from "@tauri-apps/plugin-dialog";
    import * as fs from "@tauri-apps/plugin-fs";
    import { Command } from "@tauri-apps/plugin-shell";
    import { openPath, openUrl } from "@tauri-apps/plugin-opener";
    import { getDirectoryPath, isPathValid, notify, runTask } from "../lib/store";
    import FeatureList from "../lib/FeatureList.svelte";
    import { ueFeature } from "../lib/featureInstaller";
    import UilPlusCircle from "~icons/uil/plus-circle";
    import UilArrowCircleDown from "~icons/uil/arrow-circle-down";
    import UilExclamationTriangle from "~icons/uil/exclamation-triangle";
    import UilCheckCircle from "~icons/uil/check-circle";

    const SDK_URL = "https://dotnet.microsoft.com/en-us/download/dotnet";

    type TemplateState = "checking" | "missing" | "installed" | "no-dotnet";

    let templateState: TemplateState = $state("checking");
    let modName = $state("MyMod");
    let appendComments = $state(true);

    // the template uses the name for the C# namespace and class, so it has to be a valid identifier
    let nameError = $derived(!modName.trim()
        ? "Enter a name for your mod."
        : !/^[A-Za-z_][A-Za-z0-9_]*$/.test(modName.trim())
            ? "Use letters, numbers and underscores only, starting with a letter."
            : null);

    async function checkForTemplate() {
        templateState = "checking";
        try {
            const result = await Command.create("dotnet-template-check", ["new", "sotfmod", "-h"]).execute();
            const output = result.stdout + result.stderr;
            templateState = result.code === 0 && !/No templates (or subcommands )?found/i.test(output) ? "installed" : "missing";
        } catch (err) {
            // spawning failed, so the dotnet CLI isn't on PATH
            console.log(err);
            templateState = "no-dotnet";
        }
    }

    async function installTemplate() {
        await runTask("Installing RedLoader template...", async () => {
            let result = await Command.create("dotnet-install-template-new", ["new", "install", "RedLoader.Templates"]).execute();
            if (result.code !== 0) {
                // .NET 6 SDKs only know the older --install syntax
                result = await Command.create("dotnet-install-template", ["new", "--install", "RedLoader.Templates"]).execute();
            }
            if (result.code !== 0) {
                throw new Error(`Template install failed: ${(result.stderr || result.stdout).trim()}`);
            }
        }, "Template installed.");

        await checkForTemplate();
    }

    async function createProject() {
        if (nameError) return;
        const name = modName.trim();

        const selected = await dialog.open({ directory: true, multiple: false, title: "Choose where to create the project" });
        if (typeof selected !== "string") return;

        const targetLocation = await path.join(selected, name);
        if (await fs.exists(targetLocation)) {
            notify(`A folder named "${name}" already exists there.`, "error");
            return;
        }

        const ok = await runTask(`Creating ${name}...`, async () => {
            const gameDir = await getDirectoryPath();
            const argList = ["new", "sotfmod", "-n", name, "-g", gameDir, "-o", targetLocation];
            if (!appendComments) {
                argList.push("-c", "false");
            }

            const result = await Command.create("dotnet-create-project", argList).execute();
            if (result.code !== 0) {
                throw new Error(`dotnet new failed: ${(result.stderr || result.stdout).trim()}`);
            }
        }, `Created ${name}.`);

        if (ok) {
            await openPath(targetLocation).catch(console.log);
        }
    }

    onMount(checkForTemplate);
</script>

<div class="page">
    <div>
        <h2>Mod Creation</h2>
        <p class="muted">Tools for building your own RedLoader mods.</p>
    </div>

    <span class="section-title">New project</span>
    <div class="card project-card">
        {#if templateState === "checking"}
            <span class="muted">Checking for the RedLoader project template...</span>
        {:else if templateState === "no-dotnet"}
            <div class="banner banner-warning">
                <UilExclamationTriangle />
                <span>
                    The .NET SDK wasn't found. <button class="link" onclick={() => openUrl(SDK_URL)}>Install the .NET SDK</button>, then
                    <button class="link" onclick={checkForTemplate}>check again</button>.
                </span>
            </div>
        {:else if templateState === "missing"}
            <div class="row">
                <div class="grow">
                    <span class="name">RedLoader template</span>
                    <p class="muted small">Install the dotnet template to create new mod projects.</p>
                </div>
                <button class="btn-primary" onclick={installTemplate}><UilArrowCircleDown /> Install Template</button>
            </div>
        {:else}
            <div class="row">
                <span class="badge badge-success"><UilCheckCircle /> Template installed</span>
            </div>

            <label class="field">
                <span class="field-label">Mod name</span>
                <input type="text" bind:value={modName} spellcheck="false" />
                {#if nameError}<span class="field-error">{nameError}</span>{/if}
            </label>

            <label class="check">
                <input type="checkbox" bind:checked={appendComments} />
                <span>
                    <span>Add explanatory comments</span>
                    <span class="muted small">Documents the generated code. Recommended for your first mod.</span>
                </span>
            </label>

            {#if !$isPathValid}
                <span class="field-error">Set the game location on the Loader tab first. The project references the game's files.</span>
            {/if}

            <div class="row">
                <button class="btn-primary" disabled={!!nameError || !$isPathValid} onclick={createProject}><UilPlusCircle /> Create Project</button>
            </div>
        {/if}
    </div>

    {#if $isPathValid}
        <span class="section-title">Developer tools</span>
        <FeatureList features={[ueFeature]} />
    {/if}
</div>

<style>
    h2 {
        font-size: 1.3em;
        margin-bottom: 2px;
    }

    .project-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .grow {
        flex: 1;
    }

    .name {
        font-weight: 600;
    }

    .small {
        font-size: 0.88em;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .field-label {
        font-size: 0.88em;
        font-weight: 500;
        color: var(--text-muted);
    }

    .field-error {
        font-size: 0.85em;
        color: var(--danger);
    }

    .check {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
    }

    .check > span {
        display: flex;
        flex-direction: column;
    }
</style>
