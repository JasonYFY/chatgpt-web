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
	// Additional methods like delete, clear, etc. can be added as needed
}
