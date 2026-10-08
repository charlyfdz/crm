type LocalDemoAuthEnvironment = {
	NODE_ENV?: string;
	CRM_LOCAL_DEMO_AUTH?: string;
};

export function isLocalDemoAuthEnabled(
	environment: LocalDemoAuthEnvironment = process.env,
): boolean {
	return (
		environment.NODE_ENV === "development" &&
		environment.CRM_LOCAL_DEMO_AUTH === "1"
	);
}
