export class CustomMap<K, V, D> {
	private map: Map<K, { value: V; dateValue: D }>;
	constructor() {
		this.map = new Map<K, { value: V; dateValue: D }>();
	}
	set(key: K, value: V, dateValue: D): void {
		this.map.set(key, { value, dateValue });
	}
	get(key: K): V | undefined {
		const entry = this.map.get(key);
		return entry ? entry.value : undefined;
	}
	getDate(key: K): D | undefined {
		const entry = this.map.get(key);
		return entry ? entry.dateValue : undefined;
	}
	// Method to traverse the map
	forEach(callback: (key: K, value: V, dateValue: D) => void): void {
		this.map.forEach((entry, key) => {
			callback(key, entry.value, entry.dateValue);
		});
	}
	delete(key: K): boolean {
		return this.map.delete(key);
	}
	// 将CustomMap序列化为JSON字符串
	toJSON(): string {
		const plainObject = Object.fromEntries(this.map);
		return JSON.stringify(plainObject);
	}
	// 从JSON字符串反序列化为CustomMap
	static fromJSON<K, V, D>(jsonString: string): CustomMap<K, V, D> {
		const obj = JSON.parse(jsonString);
		const customMap = new CustomMap<K, V, D>();
		for (const [key, { value, dateValue }] of Object.entries(obj)) {
			customMap.set(key, value, dateValue);
		}
		return customMap;
	}

	// 检查CustomMap是否为空
	isEmpty(): boolean {
		return this.map.size === 0;
	}
	// Additional methods like delete, clear, etc. can be added as needed
}
