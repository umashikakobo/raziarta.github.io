export class GameFlags {
    private static flags: Map<string, any> = new Map();

    public static set(key: string, value: any): void {
        this.flags.set(key, value);
        console.log(`[GameFlags] ${key} = ${value}`);
    }

    public static get(key: string, defaultValue: any = false): any {
        if (!this.flags.has(key)) {
            return defaultValue;
        }
        return this.flags.get(key);
    }

    public static has(key: string): boolean {
        return this.flags.has(key);
    }

    public static resetAll(): void {
        this.flags.clear();
    }
}
