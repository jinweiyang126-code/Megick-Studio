export const REGIONS = [
	{ id: "Western Europe", aliases: ["west europe"] },
	{ id: "Eastern Europe", aliases: ["east europe"] },
	{ id: "Northern Europe", aliases: ["north europe"] },
	{ id: "Southern Europe", aliases: ["south europe"] },
	{ id: "South Asia", aliases: ["southern asia"] },
	{ id: "Southeast Asia", aliases: ["south east asia"] },
	{ id: "East Asia", aliases: ["eastern asia", "far east"] },
	{ id: "Central Asia", aliases: [] },
	{ id: "Middle East", aliases: ["west asia"] },
	{ id: "North Africa", aliases: ["northern africa"] },
	{ id: "Sub-Saharan Africa", aliases: ["subsaharan africa"] },
	{ id: "North America", aliases: ["northern america"] },
	{ id: "South America", aliases: ["southern america", "latin america"] },
	{ id: "Central America", aliases: ["central am"] },
	{ id: "Caribbean", aliases: ["caribbean islands"] },
	{ id: "Oceania", aliases: ["pacific", "pacific islands"] },
	{ id: "Antarctica", aliases: [] },
	{ id: "Atlantic Ocean", aliases: ["atlantic"] },
	{ id: "North Atlantic", aliases: [] },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export const REGION_GROUPS: Partial<Record<string, RegionId[]>> = {
	europe: ["Western Europe", "Eastern Europe", "Northern Europe", "Southern Europe"],
	asia: ["South Asia", "Southeast Asia", "East Asia", "Central Asia"],
	africa: ["Sub-Saharan Africa", "North Africa"],
	america: ["North America", "South America", "Central America", "Caribbean"],
};

export interface CountryRecord {
	name: string;
	code: string;
	languages?: string[];
	flag_colors?: string[];
	region?: RegionId;
}
