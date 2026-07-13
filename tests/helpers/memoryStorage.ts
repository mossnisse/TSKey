import type {
    ProjectData,
    ProjectRecord,
    WorkspaceStorageEngine,
} from '../../src/store/db.ts';

const figureKey = (uid: string, id: number) => `${uid}::${id}`;

export class MemoryStorageEngine implements WorkspaceStorageEngine {
    readonly projects = new Map<string, ProjectRecord>();
    readonly figures = new Map<string, Blob>();
    beforeProjectSave?: () => Promise<void>;

    async getProjectList(): Promise<{ name: string; lastModified: number }[]> {
        return [...this.projects.values()]
            .map(project => ({ name: project.title, lastModified: project.lastModified }))
            .sort((a, b) => b.lastModified - a.lastModified);
    }

    async saveProject(title: string, projectUid: string, data: ProjectData): Promise<void> {
        await this.beforeProjectSave?.();
        this.projects.set(title, {
            title,
            projectUid,
            schemaVersion: 2,
            lastModified: Date.now(),
            dichotomousKey: data.dichotomousKey,
            figures: data.figures,
            taxa: data.taxa,
        });
    }

    async loadProject(title: string): Promise<ProjectRecord | null> {
        return this.projects.get(title) ?? null;
    }

    async deleteProject(title: string, projectUid: string): Promise<void> {
        this.projects.delete(title);
        await this.deleteProjectFigures(projectUid);
    }

    async deleteProjectRecordOnly(title: string): Promise<void> {
        this.projects.delete(title);
    }

    async saveFigure(projectUid: string, id: number, blob: Blob): Promise<void> {
        this.figures.set(figureKey(projectUid, id), blob);
    }

    async deleteFigure(projectUid: string, id: number): Promise<void> {
        this.figures.delete(figureKey(projectUid, id));
    }

    async cleanupOrphanFigures(projectUid: string, activeIds: Set<number>): Promise<void> {
        for (const key of this.figures.keys()) {
            if (!key.startsWith(`${projectUid}::`)) continue;
            const id = Number(key.slice(key.lastIndexOf('::') + 2));
            if (!activeIds.has(id)) this.figures.delete(key);
        }
    }

    async getFigure(projectUid: string, id: number): Promise<Blob | null> {
        return this.figures.get(figureKey(projectUid, id)) ?? null;
    }

    async cloneProjectFigures(oldUid: string, newUid: string): Promise<void> {
        for (const [key, blob] of this.figures) {
            if (!key.startsWith(`${oldUid}::`)) continue;
            const id = Number(key.slice(key.lastIndexOf('::') + 2));
            this.figures.set(figureKey(newUid, id), blob);
        }
    }

    async deleteProjectFigures(projectUid: string): Promise<void> {
        for (const key of this.figures.keys()) {
            if (key.startsWith(`${projectUid}::`)) this.figures.delete(key);
        }
    }
}
